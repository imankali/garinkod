"""Database connection tuning used by the development SQLite configuration."""

from django.db.backends.signals import connection_created
from django.dispatch import receiver


@receiver(connection_created)
def configure_sqlite_connection(sender, connection, **_kwargs):
    """Make file-backed SQLite safer for concurrent local smoke tests.

    Production is configured for PostgreSQL and is unaffected. WAL lets readers
    and the one SQLite writer proceed concurrently; the busy timeout gives a
    short write queue instead of returning an immediate database-locked error.
    """
    if connection.vendor != "sqlite" or connection.settings_dict["NAME"] in {":memory:", ""}:
        return

    with connection.cursor() as cursor:
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=30000;")
