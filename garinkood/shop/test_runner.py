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

A third failure mode used to live here invisibly: ``manage.py test --parallel``.
Django's own ``ParallelTestSuite`` runs each subsuite with its stock
``RemoteTestRunner``, which calls the module-level ``setup_test_environment`` —
never ours — so the DummyCache override only ever existed in the parent
process. On fork platforms (CI on Linux) the workers inherit the parent's
overridden module state and stay correct by accident; on spawn platforms
(Windows) each worker re-imports settings and gets the real LocMemCache, where
DRF's throttle counters accumulate per worker under a single shared client IP.
The first suite to cross an endpoint's budget then hands every later suite in
that worker a 429 with a multi-thousand-second ``retry_after`` — observed as
four failures in ``tests_messaging`` and ``tests_inventory_race`` that passed
in isolation and serially.

The fix pins the environment on the suite itself: a subclass of
``ParallelTestSuite`` that wraps each subsuite with the same
``override_settings`` context this runner installs in the parent. The wrapped
context is entered before any of the subsuite's tests run and exited after the
last one, so every worker — fork or spawn — enforces the same "throttling is
inert unless a test opts in" contract the serial run has always had.
"""

from contextlib import ExitStack

from django.test.runner import DiscoverRunner, ParallelTestSuite


def _with_test_environment(args):
    """Run one subsuite under the runner's test environment.

    Same single-tuple signature as Django's ``_run_subsuite`` (the pool calls
    it by reference with one packed tuple). Runs in the worker process, per
    subsuite; the context wraps the whole subsuite run.
    """
    runner_class, subsuite_index, subsuite, failfast, buffer = args
    # The worker already ran ``setup_test_environment()`` — directly via
    # ``_init_worker`` on spawn, or inherited from the parent on fork — and
    # Django guards it against a second call.
    from shop.test_environment import test_environment

    with test_environment():
        runner = runner_class(failfast=failfast, buffer=buffer)
        result = runner.run(subsuite)
    return subsuite_index, result.events


class GarinKoodParallelTestSuite(ParallelTestSuite):
    # Plain function attribute, exactly like Django's stock ``run_subsuite``:
    # the pool unwraps ``self.run_subsuite.__func__`` and pickles it by reference.
    run_subsuite = _with_test_environment


class GarinKoodTestRunner(DiscoverRunner):
    # Django 5.2 honours this attribute when --parallel builds its suite.
    parallel_test_suite = GarinKoodParallelTestSuite

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)

        from shop.test_environment import test_environment

        self._environment_override = test_environment()
        self._environment_override.enable()

    def teardown_test_environment(self, **kwargs):
        self._environment_override.disable()
        super().teardown_test_environment(**kwargs)
