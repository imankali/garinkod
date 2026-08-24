"""Test runner that keeps throttle state out of unrelated tests.

Throttle counters live in the cache, and the cache outlives an individual test
case. Without this, a suite that performs a dozen checkouts would exhaust the
checkout budget and fail every later test for reasons that have nothing to do
with what they assert.

The default cache is therefore a no-op during tests. Tests that *do* exercise
throttling opt back in with ``override_settings(CACHES=...)`` plus a real
backend, which is exactly what ``ThrottleTests`` does.
"""

from django.test.runner import DiscoverRunner


class GarinKoodTestRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)

        from django.test import override_settings

        self._cache_override = override_settings(
            CACHES={
                'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
            }
        )
        self._cache_override.enable()

    def teardown_test_environment(self, **kwargs):
        self._cache_override.disable()
        super().teardown_test_environment(**kwargs)
