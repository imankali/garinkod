"""Build a fresh Meilisearch product index and atomically swap it live."""

from datetime import datetime, timezone
import math

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from shop.models import Product
from shop.search import product_document


class Command(BaseCommand):
    help = "Rebuild the optional Meilisearch product index"

    def add_arguments(self, parser):
        parser.add_argument("--batch-size", type=int, default=500)

    def handle(self, *args, **options):
        if not settings.MEILISEARCH_ENABLED:
            raise CommandError("MEILISEARCH_ENABLED is false; refusing to contact an external index.")
        try:
            import meilisearch
            from meilisearch.errors import MeilisearchApiError

            client = meilisearch.Client(
                settings.MEILISEARCH_URL,
                settings.MEILISEARCH_API_KEY or None,
                timeout=max(1, math.ceil(settings.MEILISEARCH_TIMEOUT_SECONDS)),
            )
            live_uid = settings.MEILISEARCH_PRODUCTS_INDEX
            temp_uid = f"{live_uid}_build_{datetime.now(timezone.utc):%Y%m%d%H%M%S}"
            self._wait(client, client.create_index(temp_uid, {"primaryKey": "id"}))
            index = client.index(temp_uid)
            for task in (
                index.update_searchable_attributes(
                    ["title", "description", "brand", "sku", "category_name"]
                ),
                index.update_filterable_attributes(
                    ["status", "available", "stock", "category", "price", "discount_percent"]
                ),
                index.update_sortable_attributes(
                    ["price", "publish_timestamp", "discount_percent"]
                ),
            ):
                self._wait(client, task)

            queryset = Product.objects.filter(status="published").select_related("category")
            batch_size = max(1, min(options["batch_size"], 5000))
            count = 0
            batch = []
            for product in queryset.iterator(chunk_size=batch_size):
                batch.append(product_document(product))
                if len(batch) >= batch_size:
                    self._wait(client, index.add_documents(batch, primary_key="id"), timeout=60_000)
                    count += len(batch)
                    batch = []
            if batch:
                self._wait(client, index.add_documents(batch, primary_key="id"), timeout=60_000)
                count += len(batch)

            try:
                client.get_index(live_uid)
            except MeilisearchApiError:
                self._wait(client, client.create_index(live_uid, {"primaryKey": "id"}))
            self._wait(
                client,
                client.swap_indexes([{"indexes": [live_uid, temp_uid]}]),
                timeout=60_000,
            )
            self._wait(client, client.delete_index(temp_uid), timeout=60_000)
        except Exception as exc:
            raise CommandError(f"Meilisearch rebuild failed: {exc}") from exc
        self.stdout.write(self.style.SUCCESS(f"Indexed {count} published products into {live_uid}."))

    @staticmethod
    def _wait(client, task, timeout=10_000):
        result = client.wait_for_task(task.task_uid, timeout_in_ms=timeout)
        if result.status != "succeeded":
            raise CommandError(f"Meilisearch task {task.task_uid} ended as {result.status}.")
        return result
