"""Minimal public liveness and privileged operational endpoints."""

import hmac
from functools import wraps

from asgiref.sync import sync_to_async
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from django_prometheus.exports import ExportToDjangoView
from health_check.views import HealthCheckView


def _token_matches(request) -> bool:
    expected = settings.OPERATIONS_TOKEN
    if not expected:
        return False
    authorization = request.headers.get("Authorization", "")
    supplied = authorization[7:] if authorization.startswith("Bearer ") else ""
    if not supplied:
        supplied = request.headers.get("X-Operations-Token", "")
    return bool(supplied) and hmac.compare_digest(supplied, expected)


def user_from_token_header(request):
    """The user behind an ``Authorization: Token …`` header, when the key is valid.

    DRF views authenticate that header themselves; the operations endpoints are plain
    Django views so that a monitoring box and the console read the same URL, and
    without this lookup they answer 404 to a client presenting a perfectly good
    credential — which is how an embedded preview behaves, its browser refusing to keep
    a cookie. Nothing is widened here: an active account is recognised from a key it
    already proved, exactly as TokenAuthentication would.
    """
    from rest_framework.authtoken.models import Token

    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Token "):
        return None
    key = authorization[len("Token "):].strip()
    if not key:
        return None
    row = Token.objects.select_related("user").filter(key=key[:64]).first()
    if row is None or not row.user.is_active:
        return None
    return row.user


def has_operations_access(request) -> bool:
    if bool(getattr(request.user, "is_staff", False)) or _token_matches(request):
        return True
    user = user_from_token_header(request)
    if user is None:
        return False
    # These views attribute their own writes — a resolved log line names who closed it —
    # so the operator is put on the request instead of being answered with a bare yes.
    request.user = user
    return True


def operations_access_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not has_operations_access(request):
            response = JsonResponse({"detail": "Not found."}, status=404)
            response["Cache-Control"] = "no-store"
            return response
        response = view(request, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response

    return wrapped


@require_GET
@never_cache
def liveness(request):
    """Reveal no dependencies or build internals on the public endpoint."""
    return JsonResponse({"status": "ok"})


@require_GET
@never_cache
@operations_access_required
def metrics(request):
    return ExportToDjangoView(request)


class ProtectedReadinessView(HealthCheckView):
    """Database/cache/storage checks, hidden behind staff or an ops token."""

    checks = (
        "health_check.checks.Database",
        "health_check.checks.Cache",
        "health_check.checks.Storage",
    )

    async def dispatch(self, request, *args, **kwargs):
        is_staff = await sync_to_async(
            lambda: bool(getattr(request.user, "is_staff", False)), thread_sensitive=True
        )()
        if not is_staff and not _token_matches(request):
            response = JsonResponse({"detail": "Not found."}, status=404)
            response["Cache-Control"] = "no-store"
            return response
        response = await super().dispatch(request, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response
