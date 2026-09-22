"""The test-run environment, defined once.

Both the serial runner path and every ``--parallel`` worker must run tests
under the same overrides — see ``shop/test_runner.py`` for why throttling must
be inert and the HTTPS redirect off for the whole run. Defining it in one
place is what keeps a future tweak from re-forking the two code paths.
"""


class TestEnvironment:
    """The project's test-environment overrides.

    Supports both call styles: ``enable()``/``disable()`` for the runner's
    whole-run lifetime, and use as a context manager for one subsuite inside a
    parallel worker.
    """

    def __init__(self):
        from django.test import override_settings

        self._override = override_settings(
            CACHES={
                'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
            },
            SECURE_SSL_REDIRECT=False,
        )

    def enable(self):
        self._override.enable()

    def disable(self):
        self._override.disable()

    def __enter__(self):
        self.enable()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.disable()
        return False


def test_environment():
    """Build a fresh, not-yet-enabled TestEnvironment."""
    return TestEnvironment()
