"""Test runner that keeps the environment out of the tests.

Two things make ``manage.py test`` fail for reasons no assertion caused:

Throttle counters live in the cache, and the cache outlives an individual test
case, so a suite that performs a dozen checkouts exhausts the checkout budget
and every later test fails. The default cache is therefore a no-op during tests.
Tests that *do* exercise throttling opt back in with
``override_settings(CACHES=...)`` plus a real backend, which is exactly what
``ThrottleTests`` does.

And the HTTPS hardening block in settings — which is live whenever DEBUG is off,
as it is in CI — answers the test client with a 301 on every single API request.
The suite is not about whether that redirect fires; the tests that reach an
endpoint want the endpoint. So the redirect is off for the whole run, and the
tests that assert on it (``tests_security``) set it themselves.
"""

from django.test.runner import DiscoverRunner


class GarinKoodTestRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)

        from django.test import override_settings

        self._environment_override = override_settings(
            CACHES={
                'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
            },
            SECURE_SSL_REDIRECT=False,
        )
        self._environment_override.enable()

    def teardown_test_environment(self, **kwargs):
        self._environment_override.disable()
        super().teardown_test_environment(**kwargs)
