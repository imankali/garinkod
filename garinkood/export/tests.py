"""Tests for the export bounded context.

Contracts pinned here:

* a trade file persists with its documents, exactly one file per kernel
  order (OneToOne), and deleting the order cascades through both;
* storage lifecycle is hygienic end to end: uuid-prefixed names never
  collide, replacing the file on an existing row scrubs the superseded
  bytes (pre_save), and deleting the row removes the file from disk
  (post_delete);
* documents are validated at the serializer fence (format and size), never
  at the storage door after bytes already landed;
* the API enforces row-level ownership (intruder gets 404, never a hint),
  refuses mutation for non-staff (403), refuses anonymous callers (401),
  and lets staff do every verb including paper upload and verification.
"""

import tempfile
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from shop.models import Order

from .models import ExportDocument, ExportOrder
from .serializers import ExportDocumentSerializer

User = get_user_model()

PDF_BYTES = b"%PDF-1.4 sample customs paper bytes"


def make_order(user, *, code):
    """Minimal but realistic kernel order for a trade file to hang off."""
    return Order.objects.create(
        code=code,
        user=user,
        customer_name="خریدار صادراتی آزمون",
        phone="09120000000",
        province="تهران",
        city="تهران",
        address="خیابان آزمایش، پلاک ۱",
    )


class ExportMediaTestCase(TestCase):
    """Documents write files; those bytes belong in a scratch dir, never in
    the repository's media root (same isolation shop's media tests use)."""

    def setUp(self):
        self.media_scratch = tempfile.TemporaryDirectory(prefix="export-test-media-")
        self.addCleanup(self.media_scratch.cleanup)
        media_override = override_settings(MEDIA_ROOT=self.media_scratch.name)
        media_override.enable()
        self.addCleanup(media_override.disable)
        super().setUp()


class ExportModelTests(ExportMediaTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(username="export-model", password="safe-pass-1")
        self.order = make_order(self.user, code="EXP-M-1")

    def test_export_order_persists_with_documents(self):
        export_order = ExportOrder.objects.create(
            order=self.order,
            destination_country="IQ",
            currency="USD",
            total_value_foreign=Decimal("12500.50"),
        )
        document = ExportDocument.objects.create(
            export_order=export_order,
            document_type="certificate_of_origin",
            file=SimpleUploadedFile("origin.pdf", PDF_BYTES, content_type="application/pdf"),
            issue_date="2026-08-20",
        )
        self.assertEqual(export_order.status, "draft")
        self.assertEqual(self.order.export_details, export_order)
        self.assertEqual(list(export_order.documents.all()), [document])
        self.assertFalse(document.is_verified)
        self.assertEqual(document.get_document_type_display(), "گواهی مبدأ")
        self.assertIn("عراق", str(export_order))
        self.assertTrue(document.file.name.startswith(f"export/docs/{export_order.pk}/"))

    def test_order_delete_cascades_export_profile_and_documents(self):
        export_order = ExportOrder.objects.create(
            order=self.order,
            destination_country="AE",
            currency="AED",
            total_value_foreign=Decimal("8000"),
        )
        ExportDocument.objects.create(
            export_order=export_order,
            document_type="packing_list",
            file=SimpleUploadedFile("packing.pdf", PDF_BYTES, content_type="application/pdf"),
            issue_date="2026-08-21",
        )
        self.order.delete()
        self.assertEqual(ExportOrder.objects.count(), 0)
        self.assertEqual(ExportDocument.objects.count(), 0)

    def test_one_order_one_export_profile(self):
        ExportOrder.objects.create(
            order=self.order,
            destination_country="TR",
            currency="EUR",
            total_value_foreign=Decimal("3000"),
        )
        # A second trade file on the SAME order dies at the database fence;
        # the savepoint keeps the outer test transaction usable afterwards.
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                ExportOrder.objects.create(
                    order=self.order,
                    destination_country="RU",
                    currency="USD",
                    total_value_foreign=Decimal("4500"),
                )

    def test_upload_names_are_uuid_prefixed(self):
        export_order = ExportOrder.objects.create(
            order=self.order,
            destination_country="QA",
            currency="USD",
            total_value_foreign=Decimal("700"),
        )
        # Two uploads with the SAME original name must become two siblings,
        # never one overwrite - the uuid prefix is the guarantee.
        first = ExportDocument.objects.create(
            export_order=export_order,
            document_type="commercial_invoice",
            file=SimpleUploadedFile("invoice.pdf", PDF_BYTES, content_type="application/pdf"),
            issue_date="2026-08-20",
        )
        second = ExportDocument.objects.create(
            export_order=export_order,
            document_type="packing_list",
            file=SimpleUploadedFile("invoice.pdf", PDF_BYTES, content_type="application/pdf"),
            issue_date="2026-08-21",
        )
        self.assertNotEqual(first.file.name, second.file.name)
        prefix = f"export/docs/{export_order.pk}/"
        self.assertTrue(first.file.name.startswith(prefix))
        first_leaf = first.file.name[len(prefix):]
        uuid_part, _, original = first_leaf.partition("_")
        self.assertEqual(len(uuid_part), 32)
        int(uuid_part, 16)  # raises if the prefix is not an honest uuid4 hex
        self.assertEqual(original, "invoice.pdf")
        # Both bytesets really exist - nothing silently replaced anything.
        self.assertTrue(first.file.storage.exists(first.file.name))
        self.assertTrue(second.file.storage.exists(second.file.name))

    def test_document_row_delete_removes_file_from_disk(self):
        export_order = ExportOrder.objects.create(
            order=self.order,
            destination_country="KW",
            currency="AED",
            total_value_foreign=Decimal("950"),
        )
        document = ExportDocument.objects.create(
            export_order=export_order,
            document_type="certificate_of_origin",
            file=SimpleUploadedFile("origin.pdf", PDF_BYTES, content_type="application/pdf"),
            issue_date="2026-08-20",
        )
        stored_name = document.file.name
        self.assertTrue(document.file.storage.exists(stored_name))
        document.delete()
        self.assertFalse(document.file.storage.exists(stored_name))

    def test_document_file_replacement_removes_old_file_from_disk(self):
        export_order = ExportOrder.objects.create(
            order=self.order,
            destination_country="AZ",
            currency="USD",
            total_value_foreign=Decimal("400"),
        )
        document = ExportDocument.objects.create(
            export_order=export_order,
            document_type="commercial_invoice",
            file=SimpleUploadedFile("scan_old.pdf", PDF_BYTES, content_type="application/pdf"),
            issue_date="2026-08-20",
        )
        old_name = document.file.name
        self.assertTrue(document.file.storage.exists(old_name))
        # A specialist replaces the scan on the SAME row: pre_save must
        # scrub the superseded bytes while the fresh upload lands, and the
        # uuid prefix guarantees the two stored names never coincide.
        document.file = SimpleUploadedFile(
            "scan_new.pdf", PDF_BYTES, content_type="application/pdf"
        )
        document.save()
        new_name = document.file.name
        self.assertNotEqual(old_name, new_name)
        self.assertFalse(document.file.storage.exists(old_name))
        self.assertTrue(document.file.storage.exists(new_name))

    def test_document_update_without_file_change_keeps_file(self):
        export_order = ExportOrder.objects.create(
            order=self.order,
            destination_country="AM",
            currency="EUR",
            total_value_foreign=Decimal("250"),
        )
        document = ExportDocument.objects.create(
            export_order=export_order,
            document_type="certificate_of_origin",
            file=SimpleUploadedFile("origin.pdf", PDF_BYTES, content_type="application/pdf"),
            issue_date="2026-08-20",
        )
        stored_name = document.file.name
        # Metadata-only edit - the daily bread of the specialist desk
        # (verify the paper, correct its issue date): the file did not
        # change, so pre_save must leave the bytes exactly where they are.
        document.is_verified = True
        document.issue_date = "2026-08-23"
        document.save()
        self.assertEqual(document.file.name, stored_name)
        self.assertTrue(document.file.storage.exists(stored_name))

    def test_document_upload_validation_at_serializer_fence(self):
        export_order = ExportOrder.objects.create(
            order=self.order,
            destination_country="OM",
            currency="USD",
            total_value_foreign=Decimal("1500"),
        )
        base = {
            "export_order": export_order.pk,
            "document_type": "phytosanitary",
            "issue_date": "2026-08-22",
        }
        wrong_format = ExportDocumentSerializer(
            data={
                **base,
                "file": SimpleUploadedFile(
                    "payload.exe", b"MZ-not-a-document", content_type="application/octet-stream"
                ),
            }
        )
        self.assertFalse(wrong_format.is_valid())
        self.assertIn("فرمت سند مجاز نیست", str(wrong_format.errors["file"]))
        oversized = ExportDocumentSerializer(
            data={
                **base,
                "file": SimpleUploadedFile(
                    "scan.pdf",
                    b"%PDF" + b"0" * (ExportDocumentSerializer.MAX_UPLOAD_BYTES + 1),
                    content_type="application/pdf",
                ),
            }
        )
        self.assertFalse(oversized.is_valid())
        self.assertIn("۱۰ مگابایت", str(oversized.errors["file"]))
        valid = ExportDocumentSerializer(
            data={
                **base,
                "file": SimpleUploadedFile("phyto.pdf", PDF_BYTES, content_type="application/pdf"),
            }
        )
        self.assertTrue(valid.is_valid(), valid.errors)
        valid.save()
        self.assertEqual(export_order.documents.count(), 1)


@override_settings(SECURE_SSL_REDIRECT=False)
class ExportApiTests(ExportMediaTestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(username="export-owner", password="safe-pass-1")
        self.intruder = User.objects.create_user(username="export-intruder", password="safe-pass-1")
        self.staff = User.objects.create_user(
            username="export-staff", password="safe-pass-1", is_staff=True
        )
        self.owner_order = make_order(self.owner, code="EXP-A-1")
        self.intruder_order = make_order(self.intruder, code="EXP-B-1")
        self.owner_file = ExportOrder.objects.create(
            order=self.owner_order,
            destination_country="IQ",
            currency="USD",
            total_value_foreign=Decimal("9000"),
            status="pending_docs",
        )
        ExportDocument.objects.create(
            export_order=self.owner_file,
            document_type="commercial_invoice",
            file=SimpleUploadedFile("invoice.pdf", PDF_BYTES, content_type="application/pdf"),
            issue_date="2026-08-20",
            is_verified=True,
        )
        ExportOrder.objects.create(
            order=self.intruder_order,
            destination_country="TR",
            currency="EUR",
            total_value_foreign=Decimal("2000"),
        )
        self.client = APIClient()

    def test_owner_reads_own_trade_file_with_documents(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/export/orders/{self.owner_file.pk}/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["order_code"], "EXP-A-1")
        self.assertEqual(payload["destination_country_label"], "عراق")
        self.assertEqual(payload["currency_label"], "دلار آمریکا")
        self.assertEqual(payload["status_label"], "در انتظار اسناد")
        documents = payload["documents"]
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["document_type"], "commercial_invoice")
        self.assertEqual(documents[0]["document_type_label"], "فاکتور تجاری")
        self.assertTrue(documents[0]["is_verified"])

    def test_intruder_gets_404_and_never_sees_foreign_files(self):
        self.client.force_authenticate(self.intruder)
        detail = self.client.get(f"/api/export/orders/{self.owner_file.pk}/")
        self.assertEqual(detail.status_code, 404)
        listing = self.client.get("/api/export/orders/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()["count"], 1)
        self.assertEqual(listing.json()["results"][0]["order_code"], "EXP-B-1")

    def test_non_staff_cannot_mutate_anything(self):
        self.client.force_authenticate(self.owner)
        patch = self.client.patch(
            f"/api/export/orders/{self.owner_file.pk}/", {"status": "shipped"}, format="json"
        )
        self.assertEqual(patch.status_code, 403)
        create = self.client.post(
            "/api/export/orders/",
            {
                "order": self.intruder_order.pk,
                "destination_country": "RU",
                "currency": "USD",
                "total_value_foreign": "100.00",
            },
            format="json",
        )
        self.assertEqual(create.status_code, 403)
        upload = self.client.post(
            "/api/export/documents/",
            {
                "export_order": self.owner_file.pk,
                "document_type": "packing_list",
                "issue_date": "2026-08-25",
                "file": SimpleUploadedFile("packing.pdf", PDF_BYTES, content_type="application/pdf"),
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, 403)

    def test_staff_full_write_flow(self):
        self.client.force_authenticate(self.staff)
        listing = self.client.get("/api/export/orders/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()["count"], 2)
        # Status advances only because the specialist says so.
        patch = self.client.patch(
            f"/api/export/orders/{self.owner_file.pk}/",
            {"status": "customs_clearance"},
            format="json",
        )
        self.assertEqual(patch.status_code, 200)
        self.assertEqual(patch.json()["status"], "customs_clearance")
        # A new trade file on a fresh order; duplicate file is refused in Persian.
        fresh_order = make_order(self.staff, code="EXP-A-9")
        create = self.client.post(
            "/api/export/orders/",
            {
                "order": fresh_order.pk,
                "destination_country": "RU",
                "currency": "USD",
                "total_value_foreign": "1500.00",
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.content)
        duplicate = self.client.post(
            "/api/export/orders/",
            {
                "order": fresh_order.pk,
                "destination_country": "CN",
                "currency": "EUR",
                "total_value_foreign": "10.00",
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("قبلاً پرونده صادراتی", str(duplicate.json()))
        # Paper upload + verification through the staff-only desk.
        upload = self.client.post(
            "/api/export/documents/",
            {
                "export_order": self.owner_file.pk,
                "document_type": "phytosanitary",
                "issue_date": "2026-08-25",
                "file": SimpleUploadedFile("phyto.pdf", PDF_BYTES, content_type="application/pdf"),
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, 201, upload.content)
        verify = self.client.patch(
            f"/api/export/documents/{upload.json()['id']}/",
            {"is_verified": True},
            format="json",
        )
        self.assertEqual(verify.status_code, 200)
        self.assertTrue(verify.json()["is_verified"])
        bad_upload = self.client.post(
            "/api/export/documents/",
            {
                "export_order": self.owner_file.pk,
                "document_type": "packing_list",
                "issue_date": "2026-08-26",
                "file": SimpleUploadedFile("note.txt", b"plain text", content_type="text/plain"),
            },
            format="multipart",
        )
        self.assertEqual(bad_upload.status_code, 400)

    def test_anonymous_is_refused(self):
        response = self.client.get("/api/export/orders/")
        self.assertEqual(response.status_code, 401)
        detail = self.client.get(f"/api/export/orders/{self.owner_file.pk}/")
        self.assertEqual(detail.status_code, 401)
