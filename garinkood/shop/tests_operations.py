"""Tests for the operations layer: capacity, presence, the waiting room and the log.

These are written against the fear that makes the feature exist at all — a shop that
falls over during a rainstorm of orders — so the assertions are mostly about what the
site must *never* do: never invent a load number, never let a queue swallow a purchase,
never let a secret into a log, never let the door itself cause the outage.

Where a test could pass just as well on a machine with two cores as on sixty-four,
the measurement is mocked at the /proc boundary and the arithmetic is checked by hand.
"""

import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from . import capacity
from .admission import ADMISSION_QUERY_PATH, REFRESH_SECONDS
from .models import (
    CapacitySettings, Order, PlatformFeedback, PresenceBeat, Product, QueueTicket,
    ResourceSample, SystemLogEntry,
)
from .persian import fa_digits

# A machine nobody has: two cores, four gigabytes, nothing straining.
ROOMY = {
    'cpu_count': 2,
    'load_1m': 0.4,
    'memory_total_mb': 4096,
    'memory_available_mb': 3500,
    'container_limit_mb': None,
    'disk_free_mb': 40000,
    'disk_total_mb': 90000,
    'gpu': '',
}


def make_capacity_row(**overrides):
    """The singleton, in the state a test needs, with the class cache cleared.

    Every override goes through the same row that production reads, so a settings
    field that stops being honoured fails a test rather than shipping.
    """
    row, _created = CapacitySettings.objects.get_or_create(pk=1)
    for field, value in overrides.items():
        setattr(row, field, value)
    row.save()
    CapacitySettings.clear_cache()
    return row


def park_visitor(identity='u:farmer', path='/products/', minutes_ago=0):
    """Somebody else standing in the shop.

    update_or_create because the identity column is unique and the middleware is
    writing real beats for the test client while the test runs: a collision would
    otherwise be an IntegrityError dressed up as a broken assertion.
    """
    row, _created = PresenceBeat.objects.update_or_create(
        identity=identity,
        defaults={
            'kind': PresenceBeat.KIND_GUEST if identity.startswith('g:') else PresenceBeat.KIND_USER,
            'path': path, 'requests': 1,
            'last_seen_at': timezone.now() - timedelta(minutes=minutes_ago),
        },
    )
    return row


def visitor_client(tag):
    """A test client with its own session, so it is its own person in line.

    The waiting room recognises visitors by their session identity, and every
    client in a test process shares one IP; without a session of their own they
    would all be the same farmer.
    """
    client = APIClient()
    session = client.session
    session['visitor'] = tag
    session.save()
    return client


class CapacityMathTests(TestCase):
    """The number the operator sees, and how it was arrived at."""

    def setUp(self):
        PresenceBeat.objects.all().delete()
        QueueTicket.objects.all().delete()
        ResourceSample.objects.all().delete()
        make_capacity_row(strategy=CapacitySettings.STRATEGY_AUTO, queue_enabled=False)

    def test_auto_limit_comes_from_the_smaller_of_processor_and_memory(self):
        # 2 cores × 80 = 160, 3 usable GB × 40 = 120 → 120, then 75 % of it.
        with mock_measure(**ROOMY):
            limit, basis = capacity.effective_limit()
        self.assertEqual(limit, 90)
        self.assertIn('۹۰', fa_digits(limit))
        self.assertTrue(basis.strip())
        self.assertLessEqual(len(basis), 220)

    def test_a_tight_memory_reading_is_the_one_that_lowers_the_limit(self):
        # Six hundred free megabytes is less than a whole gigabyte, so memory stops
        # being a multiplier at all and the «tight» derating is what bites.
        tight = dict(ROOMY, memory_available_mb=600)
        with mock_measure(**tight):
            limit, basis = capacity.effective_limit()
        self.assertEqual(limit, 80)  # 160 → 75 % → 120 → two thirds
        self.assertIn('حافظه', basis)

    def test_a_container_limit_below_the_host_memory_is_used_instead(self):
        # A pod on a shared server is told the host's RAM; the cgroup is the only
        # honest number, so it has to win — and the shop's ceiling follows the box
        # the process actually lives in, not the one it was lied to about.
        with mock_measure(**dict(ROOMY, container_limit_mb=1024)):
            limit, _basis = capacity.effective_limit()
        self.assertEqual(limit, 30)  # 1 GB usable → 40, then 75 %
        self.assertLess(limit, 90)

    def test_the_cgroup_parsing_ignores_both_ways_of_saying_unlimited(self):
        from unittest.mock import mock_open, patch

        for raw, expected in (('max', None), ('9223372036854771712', None), ('536870912', 512)):
            with patch('builtins.open', mock_open(read_data=raw)):
                self.assertEqual(capacity._read_container_memory_limit_mb(), expected)

    def test_a_strained_processor_lowers_the_limit_and_says_so(self):
        strained = dict(ROOMY, load_1m=6.0)
        with mock_measure(**strained):
            limit, basis = capacity.effective_limit()
        self.assertLess(limit, 90)
        self.assertIn('بار هر هسته', basis)

    def test_a_machine_that_reports_nothing_still_has_a_floor(self):
        with mock_measure(cpu_count=None, memory_available_mb=None, memory_total_mb=None, container_limit_mb=None):
            limit, basis = capacity.effective_limit()
        self.assertEqual(limit, capacity.MINIMUM_LIMIT)
        self.assertIn('کف امن', basis)

    def test_fixed_number_wins_and_is_labelled_as_a_human_choice(self):
        make_capacity_row(strategy=CapacitySettings.STRATEGY_FIXED, fixed_limit=42)
        with mock_measure(**ROOMY):
            limit, basis = capacity.effective_limit()
        self.assertEqual(limit, 42)
        self.assertIn('دستی', basis)

    def test_fixed_mode_without_a_number_falls_back_to_the_measured_one(self):
        # An operator who saves the wrong radio button must not be able to leave the
        # shop with a ceiling of nothing.
        from .admission import settings_row_safe

        row = make_capacity_row(strategy=CapacitySettings.STRATEGY_FIXED, fixed_limit=None)
        safe = settings_row_safe(row)
        self.assertEqual(safe.strategy, CapacitySettings.STRATEGY_AUTO)
        with mock_measure(**ROOMY):
            limit, _basis = capacity.effective_limit(settings=safe)
        self.assertEqual(limit, 90)

    def test_a_gpu_is_reported_only_when_a_driver_actually_answers(self):
        # A web shop on a VPS has no GPU to report, and «۰ پردازنده گرافیکی» in a
        # health panel reads as a measurement of an idle card. So: nothing claimed
        # until a driver really answers, and a label when one does.
        self.assertEqual(capacity.Measurements().gpu, '')
        listing = capacity.os.listdir
        try:
            capacity.os.listdir = lambda path: (_ for _ in ()).throw(OSError('no driver'))
            self.assertEqual(capacity._read_gpu(), '')
        finally:
            capacity.os.listdir = listing
        with mock_measure(**dict(ROOMY, gpu='Tesla T4')):
            self.assertEqual(capacity.measure_server().gpu, 'Tesla T4')

    @override_settings(CACHES={'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'measure-test',
    }})
    def test_one_reading_is_reused_for_a_few_seconds_rather_than_per_request(self):
        # A waiting room that stats /proc on every request is a self-inflicted
        # denial of service, so the reading is cached; and it must not be cached
        # for so long that the operator is steering by last week's numbers.
        from django.core.cache import cache

        calls = []
        original = capacity._read_cpu_allowance

        def counting():
            calls.append(1)
            return original()

        capacity._read_cpu_allowance = counting
        try:
            cache.delete('ops:measurements')
            capacity.measure_server()
            capacity.measure_server()
            self.assertEqual(len(calls), 1)
            cache.delete('ops:measurements')
            capacity.measure_server()
            self.assertEqual(len(calls), 2)
        finally:
            capacity._read_cpu_allowance = original
            cache.delete('ops:measurements')


class mock_measure:
    """Patch the reading, not the arithmetic.

    Only the part that opens /proc is replaced; the limit, the derating and the
    sentence that explains them are the code under test.
    """

    def __init__(self, **values):
        self.reading = capacity.Measurements(**values)

    def __call__(self):
        return self.reading

    def __enter__(self):
        self.original = capacity.measure_server
        capacity.measure_server = self
        return self

    def __exit__(self, *_exc):
        capacity.measure_server = self.original
        return False


class RedactionTests(TestCase):
    """A log that helps is a log that can be shown to people; so it holds nothing back
    except what should never be written down at all."""

    def test_secrets_are_masked_in_a_flat_body(self):
        cleaned = capacity.redact({'password': 'hunter2', 'amount': 5000})
        self.assertNotIn('hunter2', str(cleaned))
        self.assertEqual(cleaned['password'], '•••')
        self.assertEqual(cleaned['amount'], 5000)

    def test_secrets_are_masked_nested_and_under_a_card_number(self):
        body = {'data': {'cvv2': '123', 'card_number': '6037991122334455', 'note': 'ok'},
                'items': [{'token': 'abc'}]}
        cleaned = capacity.redact(body)
        self.assertEqual(cleaned['data']['cvv2'], '•••')
        self.assertEqual(cleaned['data']['card_number'], '•••')
        self.assertEqual(cleaned['data']['note'], 'ok')
        self.assertEqual(cleaned['items'][0]['token'], '•••')
        self.assertNotIn('123', str(cleaned['data']['cvv2']))

    def test_long_values_and_deep_nesting_are_cut_off(self):
        import json

        body = {'blob': 'x' * 2000, 'level': {'a': {'b': {'c': {'d': {'e': 'deep'}}}}}}
        cleaned = capacity.redact(body)
        self.assertLessEqual(len(cleaned['blob']), 620)
        self.assertNotIn('deep', json.dumps(cleaned, ensure_ascii=False))

    def test_a_very_long_string_and_a_raw_body_are_shortened_not_dropped(self):
        # The shape of a fault survives; the gigabyte of it does not.
        cleaned = capacity.redact({'trace': 'line\n' * 4000})
        self.assertLessEqual(len(cleaned['trace']), 620)
        self.assertTrue(cleaned['trace'].startswith('line'))
        self.assertEqual(capacity.redact(b'\x00\x01' * 10), '<20 بایت>')


class SystemLogTests(TestCase):
    """Grouping, and the promise that logging never breaks the shop."""

    def setUp(self):
        SystemLogEntry.objects.all().delete()

    def test_repeated_failures_group_into_one_row_with_a_count(self):
        for _attempt in range(3):
            SystemLogEntry.record(
                level=SystemLogEntry.LEVEL_ERROR, source='catalogue', title='ZeroDivisionError in x.py:1',
                message='division by zero', path='/api/products/', method='GET', status_code=500,
            )
        self.assertEqual(SystemLogEntry.objects.count(), 1)
        row = SystemLogEntry.objects.get()
        self.assertEqual(row.count, 3)
        self.assertEqual(row.level, SystemLogEntry.LEVEL_ERROR)  # a group never downgrades
        self.assertGreaterEqual(row.last_at, row.first_at)

    def test_a_different_source_or_title_is_a_different_group(self):
        SystemLogEntry.record(source='catalogue', title='Boom in a.py:1')
        SystemLogEntry.record(source='checkout', title='Boom in a.py:1')
        SystemLogEntry.record(source='catalogue', title='Boom in b.py:2')
        self.assertEqual(SystemLogEntry.objects.count(), 3)

    def test_recording_never_raises_when_the_database_is_the_problem(self):
        # The whole point: a failing write inside the error logger must not turn one
        # broken page into a broken site.
        original = SystemLogEntry.group_key
        try:
            def explode(*args, **kwargs):
                raise RuntimeError('the database is the thing that is broken')

            SystemLogEntry.group_key = staticmethod(explode)
            self.assertIsNone(SystemLogEntry.record(source='x', title='anything'))
        finally:
            SystemLogEntry.group_key = original
        # and the notebook still works once the ground is solid again
        self.assertIsNotNone(SystemLogEntry.record(source='x', title='anything'))

    def test_the_error_middleware_records_what_the_server_could_not_answer(self):
        # The middleware is driven directly here: the point is what it does when a
        # view raises, and no view in a shop this careful should be broken on purpose.
        from django.test import RequestFactory

        from .logs import ErrorLogMiddleware

        def exploding_view(request):
            raise RuntimeError('کارت بانکی تأیید نشد')

        middleware = ErrorLogMiddleware(exploding_view)
        body = json.dumps({'card_number': '6037991122334455', 'cvv2': '123', 'amount': 450000})
        request = RequestFactory().post(
            '/api/orders/checkout/', data=body, content_type='application/json'
        )
        with self.assertRaises(RuntimeError):
            middleware(request)

        row = SystemLogEntry.objects.order_by('-id').first()
        self.assertIsNotNone(row)
        self.assertIn('RuntimeError', row.title)
        self.assertEqual(row.level, SystemLogEntry.LEVEL_ERROR)
        self.assertEqual(row.count, 1)
        self.assertEqual(row.status_code, 500)
        self.assertEqual(row.path, '/api/orders/checkout/')
        self.assertEqual(row.method, 'POST')
        # The row says what broke without carrying the card that was being typed.
        self.assertNotIn('6037991122334455', str(row.context))
        self.assertEqual(row.context['body']['card_number'], '•••')

    def test_the_error_middleware_lets_an_ordinary_page_through_untouched(self):
        from django.http import HttpResponse
        from django.test import RequestFactory

        from .logs import ErrorLogMiddleware

        seen = []

        def view(request):
            seen.append(request.path)
            return HttpResponse('ok')

        response = ErrorLogMiddleware(view)(RequestFactory().get('/robots.txt'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(seen, ['/robots.txt'])
        self.assertEqual(SystemLogEntry.objects.count(), 0)

    def test_a_page_nobody_asked_for_is_not_logged_as_an_error(self):
        client = APIClient()
        before = SystemLogEntry.objects.count()
        self.assertEqual(client.get('/api/does-not-exist/').status_code, 404)
        self.assertEqual(SystemLogEntry.objects.count(), before)




class HealthEndpointTests(TestCase):
    """What the shop tells its own operators about itself."""

    def setUp(self):
        make_capacity_row(strategy=CapacitySettings.STRATEGY_FIXED, fixed_limit=25)
        PresenceBeat.objects.all().delete()
        SystemLogEntry.objects.all().delete()
        self.staff = User.objects.create_user('ops-staff', password='x', is_staff=True)
        self.farmer = User.objects.create_user('ops-farmer', password='x')
        self.client = APIClient()

    def test_the_console_is_closed_to_nobody_is_closed_to_the_public(self):
        # A probe that leaks «we are at 91 % capacity» is a how-to for a denial of
        # service; outsiders get a 404, not a login prompt.
        self.assertEqual(self.client.get('/api/ops/health/').status_code, 404)
        self.assertEqual(self.client.get('/api/ops/logs/').status_code, 404)
        self.client.force_login(self.farmer)
        self.assertEqual(self.client.get('/api/ops/health/').status_code, 404)
        self.assertEqual(self.client.get('/api/ops/logs/').status_code, 404)
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/api/ops/health/').status_code, 200)
        self.assertEqual(self.client.get('/api/ops/logs/').status_code, 200)

    def test_the_payload_reports_the_measured_basis_next_to_the_number(self):
        self.client.force_login(self.staff)
        payload = self.client.get('/api/ops/health/').json()
        self.assertEqual(payload['capacity'], 25)
        self.assertIn('دستی', payload['capacity_basis'])
        for key in ('measurements', 'queue', 'presence', 'signals', 'samples', 'uptime', 'database'):
            self.assertIn(key, payload)
        self.assertIn('load_1m', payload['measurements'])
        self.assertIn('open_logs', payload['signals'])
        self.assertIn('label', payload['uptime'])

    def test_online_counts_are_the_rows_and_nothing_else(self):
        # Guests with deliberate hashes: a user identity here would collide with
        # whoever the middleware is tracking for the staff session itself.
        park_visitor('g:aaaabbbb1111')
        park_visitor('g:ccccdddd2222')
        park_visitor('g:eeeeffff3333', minutes_ago=120)  # long gone
        self.client.force_login(self.staff)
        payload = self.client.get('/api/ops/health/').json()
        # The console shows the tail of each identity rather than the whole key, so
        # that a screenshot of the panel does not hand out visitor hashes.
        identities = [row['identity'] for row in payload['presence']['recent']]
        self.assertIn('aaaabbbb', identities)
        self.assertIn('ccccdddd', identities)
        self.assertNotIn('eeeeffff', identities)
        self.assertGreaterEqual(payload['inside_now'], 2)
        self.assertEqual(payload['online_guests'], 2)
        self.assertLessEqual(payload['spare_places'], payload['capacity'])

    def test_samples_come_from_the_history_table(self):
        self.client.force_login(self.staff)
        ResourceSample.objects.create(
            online_users=3, online_guests=1, queue_waiting=2, capacity_limit=25, capacity_basis='آزمون', load_1m=0.5,
        )
        payload = self.client.get('/api/ops/health/').json()
        # The panel also samples while it is being looked at, so the row the test
        # wrote is somewhere in the history rather than necessarily the last one.
        self.assertIn('آزمون', [row['basis'] for row in payload['samples']])
        written = [row for row in payload['samples'] if row['basis'] == 'آزمون'][0]
        self.assertEqual(written['capacity'], 25)
        self.assertEqual(written['online'], 4)
        self.assertEqual(written['waiting'], 2)

    def test_an_authenticated_visitor_can_ask_where_they_stand(self):
        payload = self.client.get(ADMISSION_QUERY_PATH).json()
        self.assertIn(payload['state'], ('inside', 'waiting'))
        self.assertIn('refresh_seconds', payload)


class LogConsoleTests(TestCase):
    """Grouping shown to a human, and the two buttons that matter."""

    def setUp(self):
        self.staff = User.objects.create_user('log-staff', password='x', is_staff=True)
        self.client = APIClient()
        self.client.force_login(self.staff)
        SystemLogEntry.objects.all().delete()

    def _row(self, **overrides):
        base = dict(level=SystemLogEntry.LEVEL_ERROR, source='api', title='Boom in a.py', message='bad',
                    path='/api/x/', method='GET', status_code=500)
        base.update(overrides)
        return SystemLogEntry.record(**base)

    def test_the_list_groups_and_counts_without_showing_anything_to_a_stranger(self):
        self.assertEqual(APIClient().get('/api/ops/logs/').status_code, 404)
        self._row(title='Same in a.py')
        self._row(title='Same in a.py', path='/api/y/')
        self._row(title='Other in b.py', level=SystemLogEntry.LEVEL_WARNING)
        payload = self.client.get('/api/ops/logs/').json()
        self.assertEqual(payload['count'], 2)
        grouped = {row['title']: row for row in payload['results']}
        self.assertEqual(grouped['Same in a.py']['count'], 2)  # two failures, one row
        self.assertEqual(grouped['Other in b.py']['count'], 1)
        self.assertEqual(grouped['Same in a.py']['path'], '/api/y/')  # the newest address wins
        self.assertEqual(payload['summary']['error_24h'], 1)
        self.assertEqual(payload['summary']['warning_24h'], 1)

    def test_filtering_is_by_level_source_and_the_text_a_farmer_would_type(self):
        self._row(title='Pay in a.py', path='/api/checkout/pay/')
        self._row(title='Ship in b.py', source='shipping', level=SystemLogEntry.LEVEL_WARNING)
        self.assertEqual(self.client.get('/api/ops/logs/?level=error').json()['count'], 1)
        self.assertEqual(self.client.get('/api/ops/logs/?source=shipping').json()['count'], 1)
        self.assertEqual(self.client.get('/api/ops/logs/?search=checkout').json()['count'], 1)

    def test_resolving_a_log_stamps_who_did_it_and_reopening_clears_them(self):
        row = self._row()
        response = self.client.post(f'/api/ops/logs/{row.pk}/resolve/',
                                    {'note': 'به‌روزرسانی شد', 'action': 'resolve'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['is_open'])
        self.assertEqual(response.json()['resolved_by'], 'log-staff')
        row.refresh_from_db()
        reopened = self.client.post(f'/api/ops/logs/{row.pk}/resolve/', {'action': 'reopen'}, format='json').json()
        self.assertTrue(reopened['is_open'])
        self.assertIsNone(reopened['resolved_at'])

    def test_a_farmer_cannot_resolve_the_shop_s_notebook(self):
        row = self._row()
        farmer = APIClient()
        farmer.force_login(User.objects.create_user('quiet-farmer', password='x'))
        self.assertEqual(
            farmer.post(f'/api/ops/logs/{row.pk}/resolve/', {'action': 'resolve'}, format='json').status_code, 404
        )


class ClientReportTests(TestCase):
    """The button in the error screen, and what it is allowed to do."""

    def setUp(self):
        SystemLogEntry.objects.all().delete()
        PlatformFeedback.objects.all().delete()
        self.client = APIClient()

    def test_a_report_from_a_broken_screen_lands_in_the_same_notebook_as_a_server_error(self):
        response = self.client.post('/api/system/report/', {
            'title': 'سبد خرید باز نمی‌شود', 'message': 'Cannot read properties of undefined',
            'path': '/cart', 'source': 'client', 'note': 'بعد از زدودن کالا این شد',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['reported'])
        row = SystemLogEntry.objects.filter(source__startswith='client').get()
        self.assertIn('سبد خرید', row.title)
        self.assertIn('Cannot read', row.message)
        self.assertGreaterEqual(row.count, 1)
        # The same crash again is a higher number, not a second page of noise.
        self.client.post('/api/system/report/', {
            'title': 'سبد خرید باز نمی‌شود', 'message': 'Cannot read properties of undefined',
            'path': '/cart', 'source': 'client',
        }, format='json')
        row.refresh_from_db()
        self.assertEqual(row.count, 2)
        self.assertEqual(SystemLogEntry.objects.filter(source__startswith='client').count(), 1)

    def test_an_empty_report_is_refused_in_persian(self):
        response = self.client.post('/api/system/report/', {}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('متن خطا یا نشانی صفحه', response.json()['error'])
        self.assertEqual(SystemLogEntry.objects.count(), 0)

    def test_a_report_with_a_note_reaches_the_inbox_a_human_reads(self):
        self.client.post('/api/system/report/', {
            'message': 'صفحه سفید شد', 'source': 'client', 'note': 'شماره سفارش ۱۲۳ بود',
        }, format='json')
        note = PlatformFeedback.objects.get()
        self.assertEqual(note.kind, 'other')
        self.assertIn('شماره سفارش ۱۲۳ بود', note.message)
        self.assertEqual(note.status, 'new')

    def test_a_report_never_stores_a_password_that_was_echoed_back(self):
        self.client.post('/api/system/report/', {
            'message': 'خطا در /api/auth/login/', 'source': 'client',
            'context': {'password': 'hunter2', 'phone': '09121110000'},
        }, format='json')
        row = SystemLogEntry.objects.get()
        self.assertNotIn('hunter2', str(row.context))


class WaitingRoomTests(TestCase):
    """The traffic light, with the switch off until somebody opens it."""

    def setUp(self):
        PresenceBeat.objects.all().delete()
        QueueTicket.objects.all().delete()
        make_capacity_row(strategy=CapacitySettings.STRATEGY_FIXED, fixed_limit=1, queue_enabled=False,
                          activity_window_minutes=15, queue_max_minutes=30, bypass_staff=True)
        self.staff = User.objects.create_user('queue-staff', password='x', is_staff=True)

    def test_nothing_is_held_until_the_operator_opens_the_door(self):
        park_visitor('u:busy')
        client = visitor_client('alone')
        self.assertNotEqual(client.get('/robots.txt').status_code, 503)

    def test_a_page_gets_a_waiting_page_and_the_api_gets_a_wait_instead_of_a_break(self):
        make_capacity_row(queue_enabled=True)
        park_visitor('u:busy')
        client = visitor_client('held')

        page = client.get('/')
        self.assertEqual(page.status_code, 200)
        self.assertIn('صف', page.content.decode())
        self.assertIn(f'content="{REFRESH_SECONDS}"', page.content.decode())  # it refreshes itself
        self.assertEqual(page['X-Robots-Tag'], 'noindex,nofollow')  # and is never indexed as the shop

        api = client.get('/api/products/')
        self.assertEqual(api.status_code, 503)
        self.assertEqual(api['Retry-After'], str(REFRESH_SECONDS))
        self.assertEqual(api.json()['code'], 'shop_overloaded')
        self.assertEqual(QueueTicket.objects.count(), 1)

    def test_the_status_question_is_always_answered(self):
        make_capacity_row(queue_enabled=True)
        park_visitor('u:busy')
        client = visitor_client('watcher')
        self.assertEqual(client.get('/api/products/').status_code, 503)
        answer = client.get(ADMISSION_QUERY_PATH)
        self.assertEqual(answer.status_code, 200)
        self.assertEqual(answer.json()['state'], 'waiting')
        self.assertEqual(answer.json()['position'], 1)

    def test_a_place_freeing_up_lets_the_oldest_person_in(self):
        make_capacity_row(queue_enabled=True)
        busy = park_visitor('u:busy')
        waiting = visitor_client('next')
        waiting.get('/')  # take a place in line
        self.assertEqual(waiting.get('/api/products/').status_code, 503)

        PresenceBeat.objects.filter(pk=busy.pk).update(last_seen_at=timezone.now() - timedelta(hours=2))
        self.assertEqual(waiting.get(ADMISSION_QUERY_PATH).json()['state'], 'inside')
        self.assertEqual(waiting.get('/api/products/').status_code, 200)
        self.assertEqual(QueueTicket.objects.get().status, QueueTicket.STATUS_ADMITTED)

    def test_nobody_waits_past_the_ceiling_even_when_the_hall_is_still_full(self):
        # The ceiling is the reason the switch can ever be trusted: the line delays
        # people, it does not abandon them.
        make_capacity_row(queue_enabled=True, queue_max_minutes=5)
        park_visitor('u:busy')
        waiting = visitor_client('patient')
        self.assertEqual(waiting.get('/').status_code, 200)
        self.assertEqual(QueueTicket.objects.get().status, QueueTicket.STATUS_WAITING)

        QueueTicket.objects.filter(pk=QueueTicket.objects.get().pk).update(
            created_at=timezone.now() - timedelta(minutes=6)
        )
        self.assertEqual(waiting.get('/api/products/').status_code, 200)
        self.assertEqual(QueueTicket.objects.get().status, QueueTicket.STATUS_ADMITTED)
        self.assertEqual(waiting.get(ADMISSION_QUERY_PATH).json()['state'], 'inside')

    def test_a_purchase_is_never_held_at_the_door(self):
        # The line may delay a page; it must never swallow an order.
        make_capacity_row(queue_enabled=True)
        park_visitor('u:busy')
        client = visitor_client('buyer')
        response = client.post('/api/orders/checkout/', {'nothing': 1}, format='json')
        self.assertNotEqual(response.status_code, 503)

    def test_staff_and_the_back_office_are_never_in_the_line(self):
        make_capacity_row(queue_enabled=True)
        park_visitor('u:busy')
        staff = APIClient()
        session = staff.session
        session['who'] = 'staff'
        session.save()
        staff.force_login(self.staff)
        self.assertNotEqual(staff.get('/api/products/').status_code, 503)
        self.assertNotEqual(staff.get('/admin/login/').status_code, 503)

    def test_the_waiting_page_repeats_the_operator_s_own_words(self):
        make_capacity_row(queue_enabled=True, queue_message='فقط در این دقیقه شلوغ است؛ کمی صبر کنید.')
        park_visitor('u:busy')
        body = visitor_client('reader').get('/').content.decode()
        self.assertIn('فقط در این دقیقه شلوغ است', body)

    def test_the_queue_never_adds_a_broken_page_of_its_own(self):
        make_capacity_row(queue_enabled=True)
        client = visitor_client('healthy')
        self.assertEqual(client.get('/robots.txt').status_code, 200)
        self.assertEqual(QueueTicket.objects.count(), 0)  # room to spare, no ticket

    def test_a_broken_capacity_setting_cannot_stop_the_shop(self):
        # No fixed number with the fixed strategy selected: the page still answers.
        make_capacity_row(strategy=CapacitySettings.STRATEGY_FIXED, fixed_limit=None, queue_enabled=True)
        client = visitor_client('unconfigured')
        self.assertEqual(client.get('/robots.txt').status_code, 200)


ADMIN_STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    # The manifest backend wants collectstatic to have run, and a test suite has
    # no reason to have built a static bundle: without this every admin page
    # would fail on {% static %} rather than on anything being tested.
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


@override_settings(STORAGES=ADMIN_STORAGES)
class AdminOpsScreensTests(TestCase):
    """The panels behind the API, because a broken admin page is how a shop ends up
    fixing nothing at 2 a.m.

    Assertions here look for one phrase at a time: an admin page is enormous, and
    a failure that dumps it is a failure nobody reads.
    """

    def setUp(self):
        self.owner = User.objects.create_user('ops-owner', password='x', is_staff=True, is_superuser=True)
        self.client.force_login(self.owner)
        make_capacity_row(strategy=CapacitySettings.STRATEGY_AUTO, queue_enabled=False)

    def test_the_capacity_form_shows_the_live_measurement_next_to_the_fields(self):
        body = self.client.get('/admin/shop/capacitysettings/1/change/').content.decode()
        self.assertIn('آنچه از سرور خوانده می‌شود', body)
        self.assertIn('هسته پردازنده در دسترس', body)
        self.assertIn('نحوه محاسبه', body)  # the sentence, not only the number
        self.assertIn('این اعداد همین حالا از هسته‌ی لینوکس', body)

    def test_the_list_shows_the_limit_in_effect_not_only_the_settings(self):
        body = self.client.get('/admin/shop/capacitysettings/').content.decode()
        self.assertIn('سقف همین لحظه', body)

    def test_the_singleton_is_created_once_and_never_deleted(self):
        from django.contrib import admin as dj_admin
        from django.test import RequestFactory

        from .admin import AdminCapacitySettings

        model_admin = dj_admin.site._registry[CapacitySettings]
        request = RequestFactory().get('/admin/shop/capacitysettings/')
        request.user = self.owner
        self.assertIsInstance(model_admin, AdminCapacitySettings)
        self.assertFalse(model_admin.has_add_permission(request))  # the row exists now
        self.assertFalse(model_admin.has_delete_permission(request))

    def test_the_measurement_history_is_viewable_and_immutable(self):
        ResourceSample.objects.create(online_users=1, online_guests=2, queue_waiting=3, capacity_limit=50, capacity_basis='آزمون')
        listing = self.client.get('/admin/shop/resourcesample/')
        self.assertEqual(listing.status_code, 200)
        self.assertIn('>50<', listing.content.decode())
        # Editing a measurement would mean editing history. Nothing can be added,
        # and the detail page is the read-only view Django renders for a staff user
        # who may look but may not change — so no save control exists at all.
        self.assertEqual(self.client.get('/admin/shop/resourcesample/add/').status_code, 403)
        detail = self.client.get('/admin/shop/resourcesample/1/change/').content.decode()
        self.assertIn('مشاهده نمونه وضعیت سرور', detail)
        self.assertNotIn('name="_save"', detail)
        self.assertNotIn('name="_addanother"', detail)

    def test_presence_rows_are_readable_but_not_editable(self):
        park_visitor('g:11112222')
        listing = self.client.get('/admin/shop/presencebeat/?q=11112222')
        self.assertEqual(listing.status_code, 200)
        self.assertIn('مهمان', listing.content.decode())  # found by hash, shown as a guest
        self.assertEqual(self.client.get('/admin/shop/presencebeat/add/').status_code, 403)

    def test_the_waiting_list_can_be_let_in_and_let_go_from_the_admin(self):
        first = QueueTicket.objects.create(key='aaa', path='/products/')
        second = QueueTicket.objects.create(key='bbb', path='/cart/')

        self.client.post(
            '/admin/shop/queueticket/',
            {'action': 'admit_tickets', '_selected_action': [first.pk], 'index': 0},
        )
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, QueueTicket.STATUS_ADMITTED)
        self.assertEqual(second.status, QueueTicket.STATUS_WAITING)  # only the ticked row

        self.client.post(
            '/admin/shop/queueticket/',
            {'action': 'release_tickets', '_selected_action': [first.pk], 'index': 0},
        )
        first.refresh_from_db()
        self.assertEqual(first.status, QueueTicket.STATUS_WAITING)
        self.assertIsNone(first.admitted_at)

    def test_a_queue_action_says_how_many_it_moved(self):
        row = QueueTicket.objects.create(key='ccc', path='/products/')
        response = self.client.post(
            '/admin/shop/queueticket/',
            {'action': 'admit_tickets', '_selected_action': [row.pk], 'index': 0},
            follow=True,
        )
        notes = ''.join(str(message) for message in response.context['messages'])
        self.assertIn('1 نفر وارد شدند', notes)  # it counted the rows it moved

    def test_the_notebook_groups_and_the_status_filter_splits_open_from_fixed(self):
        SystemLogEntry.record(source='api', title='Boom in a.py', level=SystemLogEntry.LEVEL_ERROR)
        fixed = SystemLogEntry.record(source='api', title='Fixed in b.py')
        SystemLogEntry.objects.filter(pk=fixed.pk).update(resolved_at=timezone.now())

        body = self.client.get('/admin/shop/systemlogentry/').content.decode()
        self.assertIn('Boom in a.py', body)

        opened = self.client.get('/admin/shop/systemlogentry/?state=open').content.decode()
        self.assertIn('Boom in a.py', opened)
        self.assertNotIn('Fixed in b.py', opened)

        closed = self.client.get('/admin/shop/systemlogentry/?state=resolved').content.decode()
        self.assertIn('Fixed in b.py', closed)
        self.assertNotIn('Boom in a.py', closed)

    def test_a_search_in_the_notebook_answers_the_way_a_farmer_would_type_it(self):
        SystemLogEntry.record(source='checkout', title='Boom in a.py', path='/api/orders/checkout/')
        SystemLogEntry.record(source='catalogue', title='Zoom in b.py', path='/api/products/')
        body = self.client.get('/admin/shop/systemlogentry/?q=checkout').content.decode()
        self.assertIn('Boom in a.py', body)
        self.assertNotIn('Zoom in b.py', body)

    def test_marking_logs_resolved_from_the_list_stamps_who_did_it(self):
        row = SystemLogEntry.record(source='api', title='Boom in a.py')
        self.client.post(
            '/admin/shop/systemlogentry/',
            {'action': 'mark_logs_resolved', '_selected_action': [row.pk], 'index': 0},
        )
        row.refresh_from_db()
        self.assertIsNotNone(row.resolved_at)
        self.assertEqual(row.resolved_by, self.owner)

        self.client.post(
            '/admin/shop/systemlogentry/',
            {'action': 'reopen_logs', '_selected_action': [row.pk], 'index': 0},
        )
        row.refresh_from_db()
        self.assertIsNone(row.resolved_at)
        self.assertIsNone(row.resolved_by)

