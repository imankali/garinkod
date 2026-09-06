"""What this machine can carry, read from the machine itself.

A shop that says «۵۰۰ نفر هم‌زمان» usually means someone typed a hopeful number
into a config file. Here the limit is derived from what the process can actually
see — its own CPU allowance and its own memory ceiling — and the arithmetic is
returned next to the number so an operator can disagree with it in the admin
rather than in a ticket.

Two details are load-bearing:

* memory is read from the **cgroup** limit when there is one, because a container
  given 1 GB on a 64 GB host must be sized as a 1 GB box;
* the limit shrinks while the load average says the host is already busy, so the
  door closes before the request queue does, not after.

Everything here degrades quietly: a kernel that hides ``/proc`` yields ``None``
fields and a floor value rather than a crash, since this module runs on the path
of real page views.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import time
from dataclasses import asdict, dataclass
from datetime import timedelta

from django.core.cache import cache
from django.db.models import F
from django.utils import timezone

MINIMUM_LIMIT = 10
"""A machine that reports nothing still serves somebody."""

PRESENCE_WRITE_SECONDS = 45
"""How often one visitor's row may be rewritten.

Longer than a page's worth of clicks, shorter than the presence window, so a busy
site pays a handful of queries per visitor per minute instead of one per request.
"""

MEASURE_CACHE_SECONDS = 10

# Which identities this worker wrote for recently. Presence rows are one per
# visitor, but the *query* is what a flood would multiply, so the dict in front of
# it turns a busy minute into one UPDATE per visitor instead of sixty.
_written_recently: dict[str, float] = {}
_SWEEP_AFTER = 4096

# When this worker last stored a resource sample (see ``sample_if_due``).
_SAMPLE_CLOCK = 0.0

SECRET_MARKERS = (
    'password', 'passwd', 'secret', 'token', 'authorization', 'cookie', 'session',
    'card', 'cvv', 'cvc', 'otp', 'pin', 'api_key', 'apikey', 'private',
)


@dataclass(frozen=True)
class Measurements:
    """A single reading of the box, with ``None`` for anything it cannot see."""

    cpu_count: int | None = None
    load_1m: float | None = None
    load_5m: float | None = None
    memory_total_mb: int | None = None
    memory_available_mb: int | None = None
    container_limit_mb: int | None = None
    disk_free_mb: int | None = None
    disk_total_mb: int | None = None
    gpu: str = ''

    @property
    def usable_memory_mb(self) -> int:
        """What this process may allocate, container ceiling first."""
        pool = self.memory_available_mb or self.memory_total_mb or 0
        if self.container_limit_mb:
            pool = min(pool, self.container_limit_mb) if pool else self.container_limit_mb
        return int(pool)

    @property
    def memory_is_tight(self) -> bool:
        usable = self.usable_memory_mb
        return bool(usable and self.memory_total_mb and usable * 100 < self.memory_total_mb * 15)

    def as_dict(self) -> dict:
        return asdict(self)


def _read_meminfo_mb() -> tuple[int | None, int | None]:
    """``(total, available)`` from /proc/meminfo, or (None, None) off Linux."""
    try:
        with open('/proc/meminfo', encoding='ascii') as handle:
            values = {}
            for line in handle:
                key, _, rest = line.partition(':')
                if key in ('MemTotal', 'MemAvailable'):
                    values[key] = int(rest.strip().split()[0]) // 1024
                if len(values) == 2:
                    break
        return values.get('MemTotal'), values.get('MemAvailable')
    except (OSError, ValueError, IndexError):
        return None, None


def _read_container_memory_limit_mb() -> int | None:
    """The memory ceiling of this container, when it is inside one.

    v2 keeps it in ``memory.max`` (the literal string ``max`` meaning unlimited);
    v1 used ``memory.limit_in_bytes``, whose "unlimited" is an absurdly large
    number, so anything above a terabyte is read as no limit.
    """
    for path in (
        '/sys/fs/cgroup/memory.max',
        '/sys/fs/cgroup/memory/memory.limit_in_bytes',
    ):
        try:
            with open(path, encoding='ascii') as handle:
                raw = handle.read().strip()
        except OSError:
            continue
        if not raw or raw == 'max':
            continue
        try:
            megabytes = int(raw) // (1024 * 1024)
        except ValueError:
            continue
        # cgroup v1 writes "no limit" as an enormous number, which is not a ceiling.
        if 0 < megabytes < 1_048_576:
            return megabytes
    return None


def _read_cpu_allowance() -> int | None:
    """Cores usable by this process, not cores on the host.

    A cpuset or a CFS quota is what actually bounds the shop, and reading the host
    count instead is how a small container promises more than it can keep.
    """
    try:
        affinity = len(os.sched_getaffinity(0))
    except (AttributeError, OSError):
        affinity = os.cpu_count() or 0

    try:
        with open('/sys/fs/cgroup/cpu.max', encoding='ascii') as handle:
            quota, _, period = handle.read().strip().partition(' ')
        if quota not in ('', 'max'):
            allowed = int(int(quota) / max(int(period or 100000), 1))
            if allowed > 0:
                return min(allowed, affinity) if affinity else allowed
    except (OSError, ValueError):
        pass
    return affinity or None


def _read_gpu() -> str:
    """A GPU name if the box really exposes one — otherwise nothing is claimed.

    A web shop on a VPS has no GPU to report, and inventing «۰ پردازنده گرافیکی»
    in a health panel reads as though the number were meaningful. It stays absent
    until a driver is actually present.
    """
    base = '/proc/driver/nvidia/gpus'
    try:
        for entry in sorted(os.listdir(base)):
            info = os.path.join(base, entry, 'information')
            with open(info, encoding='utf-8', errors='replace') as handle:
                for line in handle:
                    if line.lower().startswith('model:'):
                        return line.split(':', 1)[1].strip()[:140]
    except OSError:
        pass
    return ''


def measure_server() -> Measurements:
    """One reading, cached briefly so a flood does not multiply syscalls."""
    def probe() -> dict:
        total, available = _read_meminfo_mb()
        free_bytes, total_bytes = (None, None)
        try:
            usage = shutil.disk_usage(os.path.dirname(os.path.abspath(__file__)))
            free_bytes, total_bytes = usage.free, usage.total
        except OSError:
            pass
        try:
            load_1m, load_5m, _ = os.getloadavg()
        except (OSError, AttributeError):
            load_1m = load_5m = None
        return {
            'cpu_count': _read_cpu_allowance(),
            'load_1m': load_1m,
            'load_5m': load_5m,
            'memory_total_mb': total,
            'memory_available_mb': available,
            'container_limit_mb': _read_container_memory_limit_mb(),
            'disk_free_mb': int(free_bytes // (1024 * 1024)) if free_bytes is not None else None,
            'disk_total_mb': int(total_bytes // (1024 * 1024)) if total_bytes is not None else None,
            'gpu': _read_gpu(),
        }

    data = cache.get_or_set('ops:measurements', probe, MEASURE_CACHE_SECONDS)
    return Measurements(**data)


def _fa(value) -> str:
    from .persian import fa_digits

    return fa_digits(value)


def effective_limit(measurements: Measurements | None = None, settings=None) -> tuple[int, str]:
    """The concurrent-visitor ceiling and the sentence that explains it.

    Never an exception, never zero: whatever the kernel refuses to say, the shop
    keeps a floor so the waiting room cannot be switched on into a locked door.
    """
    from .models import CapacitySettings

    row = settings or CapacitySettings.load()
    if row.strategy == CapacitySettings.STRATEGY_FIXED and row.fixed_limit:
        return int(row.fixed_limit), f"عدد دستی پنل: {_fa(row.fixed_limit)} نفر"

    data = measurements or measure_server()
    cpu_based = (data.cpu_count or 0) * max(1, row.users_per_cpu_core)
    memory_based = int(data.usable_memory_mb / 1024) * max(1, row.users_per_gb_ram)
    options = [value for value in (cpu_based, memory_based) if value > 0]

    if options:
        base = min(options)
        limit = max(base * max(20, row.safety_percent) // 100, MINIMUM_LIMIT)
        basis = (
            f"{_fa(data.cpu_count or 0)} هسته × {_fa(row.users_per_cpu_core)} و "
            f"{_fa(round(data.usable_memory_mb / 1024, 1))} گیگ × {_fa(row.users_per_gb_ram)} "
            f"→ {_fa(base)}؛ ضریب اطمینان ٪{_fa(row.safety_percent)} → {_fa(limit)}"
        )
    else:
        limit = MINIMUM_LIMIT
        basis = f"هیچ عددی از سرور خوانده نشد؛ کف امن {_fa(MINIMUM_LIMIT)} نفر"

    if data.load_1m and data.cpu_count:
        per_core = data.load_1m / data.cpu_count
        threshold = max(50, row.derate_load_percent) / 100
        if per_core > threshold:
            limit = max(int(limit * threshold / per_core), MINIMUM_LIMIT)
            basis += f"؛ بار هر هسته ٪{_fa(round(per_core * 100))} از آستانه ٪{_fa(row.derate_load_percent)} → {_fa(limit)}"
    if data.memory_is_tight:
        limit = max(int(limit * 2 // 3), MINIMUM_LIMIT)
        basis += f"؛ حافظه در دسترس کم است → {_fa(limit)}"
    if data.container_limit_mb and not data.memory_total_mb:
        basis += f" (سقف کانتینر {_fa(data.container_limit_mb)} مگابایت)"

    return int(limit), basis[:220]


def pressure(settings=None) -> dict:
    """The live picture the console and the waiting room both read."""
    from .models import CapacitySettings

    row = settings or CapacitySettings.load()
    data = measure_server()
    limit, basis = effective_limit(data, row)
    window = max(1, row.activity_window_minutes)
    since = timezone.now() - timedelta(minutes=window)

    from .models import PresenceBeat, QueueTicket

    beats = PresenceBeat.objects.filter(last_seen_at__gte=since)
    members = beats.filter(kind=PresenceBeat.KIND_USER).count()
    guests = beats.filter(kind=PresenceBeat.KIND_GUEST).count()
    inside = members + guests
    waiting = QueueTicket.objects.filter(status=QueueTicket.STATUS_WAITING).count()

    return {
        'capacity': limit,
        'capacity_basis': basis,
        'strategy': row.strategy,
        'strategy_label': row.get_strategy_display(),
        'inside_now': inside,
        'online_users': members,
        'online_guests': guests,
        'waiting_now': waiting,
        'spare_places': max(limit - inside, 0),
        'utilisation_percent': min(int(inside * 100 / max(limit, 1)), 100) if limit else 100,
        'queue_enabled': row.queue_enabled,
        'queue_max_minutes': row.queue_max_minutes,
        'activity_window_minutes': window,
        'measurements': data.as_dict(),
        'measured_at': timezone.now().isoformat(),
    }


def redact(value, depth: int = 0):
    """Strip anything that could turn a log line into a credential.

    A stack trace is safe to read; the POST body that produced it is not, and an
    error log is exactly where someone least expects their customers' passwords to
    end up. Keys that look secret are masked and long strings are cut.
    """
    if depth > 3:
        return '…'
    if isinstance(value, dict):
        clean = {}
        for index, (key, item) in enumerate(value.items()):
            if index >= 24:
                clean['…'] = 'ادامه حذف شد'
                break
            label = str(key).lower()
            if any(marker in label for marker in SECRET_MARKERS):
                clean[str(key)] = '•••'
            else:
                clean[str(key)] = redact(item, depth + 1)
        return clean
    if isinstance(value, (list, tuple)):
        return [redact(item, depth + 1) for item in list(value)[:12]]
    if isinstance(value, (bytes, bytearray)):
        return f'<{len(value)} بایت>'
    if isinstance(value, str):
        return value if len(value) <= 600 else value[:600] + '…'
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)[:200]


def visitor_key(request) -> str:
    """A stable, non-reversible id for whoever is holding this connection.

    The same value the review votes use, so "this visitor" means the same thing in
    every table of the shop.
    """
    session = getattr(request, 'session', None)
    seed = f"{getattr(session, 'session_key', '') or ''}|{request.META.get('REMOTE_ADDR', '')}"
    return hashlib.sha256(seed.encode('utf-8')).hexdigest()[:64]


def presence_identity(request) -> tuple[str, int | None, bool]:
    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        return f"u:{user.pk}", user.pk, bool(user.is_staff)
    return f"g:{visitor_key(request)}", None, False


def record_activity(request) -> None:
    """Touch this visitor's presence row, at most once per write window.

    Called from the middleware on every request but doing almost nothing most of
    the time — and it can never fail a page: whoever is reading a product should
    not lose it because a bookkeeping row wanted writing.
    """
    from .models import PresenceBeat

    # Writes are not how you find out who is browsing: a farmer posting an order is
    # here whether or not the row is touched, and keeping the beat off the write path
    # is what leaves a checkout's locking alone.
    if request.method not in ('GET', 'HEAD'):
        return
    if request.path.startswith(('/media/', '/static/', '/favicon')):
        return
    identity, user_pk, is_staff = presence_identity(request)

    clock = time.monotonic()
    last = _written_recently.get(identity)
    if last is not None and clock - last < PRESENCE_WRITE_SECONDS:
        return
    if len(_written_recently) > _SWEEP_AFTER:
        for key, stamp in list(_written_recently.items()):
            if stamp < clock - PRESENCE_WRITE_SECONDS:
                _written_recently.pop(key, None)
    _written_recently[identity] = clock

    now = timezone.now()
    stale_before = now - timedelta(seconds=PRESENCE_WRITE_SECONDS)
    try:
        updated = PresenceBeat.objects.filter(identity=identity, last_seen_at__lt=stale_before).update(
            last_seen_at=now, path=request.path[:200], requests=F('requests') + 1
        )
        if updated:
            return
        if PresenceBeat.objects.filter(identity=identity).exists():
            return
        PresenceBeat.objects.create(
            identity=identity, user_id=user_pk, kind=PresenceBeat.KIND_USER if user_pk else PresenceBeat.KIND_GUEST,
            is_staff=is_staff, path=request.path[:200], last_seen_at=now,
        )
    except Exception:
        return


def sample_if_due(pressure_snapshot: dict | None = None) -> None:
    """Store one reading, at most once per interval, whichever worker gets there.

    ``cache.add`` is the lock: it is per-process with LocMemCache and shared with
    Redis, which is the honest behaviour to document — a second worker may add a
    second sample line, never a stampede of them.
    """
    global _SAMPLE_CLOCK

    from .models import CapacitySettings, PresenceBeat, ResourceSample, SystemLogEntry

    row = CapacitySettings.load()
    interval = max(10, row.sample_interval_seconds)

    # A process-local clock first, then the cache as the cross-worker lock. Both
    # matter: the lock is what stops two workers writing two rows for the same
    # minute, and the clock is what keeps the interval honest when there is no
    # cache to answer (a misconfigured Redis or a test suite with a dummy one,
    # where ``cache.add`` always says yes and every request would sample).
    clock = time.monotonic()
    if clock - _SAMPLE_CLOCK < interval:
        return
    _SAMPLE_CLOCK = clock
    if not cache.add('ops:sample-lock', 1, interval):
        return

    snapshot = pressure_snapshot or pressure(row)
    data = snapshot['measurements']
    try:
        ResourceSample.objects.create(
            cpu_count=data.get('cpu_count'),
            load_1m=data.get('load_1m'),
            load_5m=data.get('load_5m'),
            memory_total_mb=data.get('memory_total_mb'),
            memory_available_mb=data.get('memory_available_mb'),
            container_limit_mb=data.get('container_limit_mb'),
            disk_free_mb=data.get('disk_free_mb'),
            disk_total_mb=data.get('disk_total_mb'),
            gpu=data.get('gpu') or '',
            online_users=snapshot['online_users'],
            online_guests=snapshot['online_guests'],
            queue_waiting=snapshot['waiting_now'],
            capacity_limit=snapshot['capacity'],
            capacity_basis=snapshot['capacity_basis'][:220],
        )
    except Exception:
        return

    # The tables that grow per visitor are trimmed here so the same feature cannot
    # become the next outage: a presence row is worth exactly its window.
    cutoff = timezone.now() - timedelta(days=2)
    try:
        from .models import QueueTicket

        # A queue ticket older than two days is somebody who left long ago; its
        # presence row has expired, so it holds no place and tells no one anything.
        QueueTicket.objects.filter(created_at__lt=cutoff).delete()
        PresenceBeat.objects.filter(last_seen_at__lt=cutoff).delete()
        ResourceSample.objects.filter(created_at__lt=timezone.now() - timedelta(days=14)).delete()
        SystemLogEntry.objects.filter(resolved_at__isnull=False, resolved_at__lt=timezone.now() - timedelta(days=90)).delete()
    except Exception:
        pass


def queue_key(request, ticket_id: str | None) -> str:
    """The id a visitor presents at the door: their own ticket, or a fresh one."""
    if ticket_id and len(ticket_id) == 32 and all(char in '0123456789abcdef' for char in ticket_id):
        return ticket_id
    return hashlib.sha256(f"{visitor_key(request)}|{time.time()}".encode()).hexdigest()[:32]
