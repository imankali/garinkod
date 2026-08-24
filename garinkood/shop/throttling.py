"""Endpoint-specific throttles.

The global anon/user rates protect the catalogue. Sensitive endpoints need
tighter, *separate* budgets so that exhausting the search limit cannot lock a
user out of checking out, and vice versa — each scope has its own counter.

Two keying strategies are used deliberately:

* :class:`IPRateThrottle` keys purely on the client IP. Login and register are
  throttled this way because a credential-stuffing client is anonymous by
  definition and must not get a fresh budget per attempted username.
* :class:`UserOrIPRateThrottle` keys on the user id when authenticated and the
  IP otherwise, so one signed-in user cannot spend a shared NAT's budget.
"""

import logging

from rest_framework.throttling import SimpleRateThrottle

# Blocked requests are logged so a spike is visible in monitoring rather than
# only being felt by users. The logger is configured in settings.LOGGING.
throttle_logger = logging.getLogger('garinkood.throttle')


class LoggingThrottleMixin:
    """Emit a warning whenever a request is actually blocked."""

    def allow_request(self, request, view):
        allowed = super().allow_request(request, view)
        if not allowed:
            throttle_logger.warning(
                'throttled scope=%s ident=%s path=%s method=%s',
                self.scope,
                self.get_ident(request),
                request.path,
                request.method,
                extra={
                    'throttle_scope': self.scope,
                    'client_ip': self.get_ident(request),
                    'path': request.path,
                    'user_id': getattr(request.user, 'id', None),
                },
            )
        return allowed


class IPRateThrottle(LoggingThrottleMixin, SimpleRateThrottle):
    """Throttle strictly by client IP, ignoring authentication state."""

    scope = 'ip'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class UserOrIPRateThrottle(LoggingThrottleMixin, SimpleRateThrottle):
    """Throttle per authenticated user, falling back to the client IP."""

    scope = 'user_or_ip'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = f'user-{request.user.pk}'
        else:
            ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class LoginRateThrottle(IPRateThrottle):
    scope = 'login'


class RegisterRateThrottle(IPRateThrottle):
    scope = 'register'


class SearchRateThrottle(UserOrIPRateThrottle):
    scope = 'search'


class CheckoutRateThrottle(UserOrIPRateThrottle):
    scope = 'checkout'


class UploadRateThrottle(UserOrIPRateThrottle):
    scope = 'upload'


class FeedbackRateThrottle(UserOrIPRateThrottle):
    scope = 'feedback'
