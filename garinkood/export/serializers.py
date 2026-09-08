"""Serializers for the export bounded context.

DDD local contract (identical rule to the other holding modules): the module
exposes its own state plus the kernel order code as a plain string; it never
imports a shop serializer. Upload validation lives HERE, in the serializer,
so no byte of a bad document is ever written to storage - the same lock the
platform already applies to avatars and message attachments.
"""

from pathlib import Path

from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from shop.models import Order

from .models import ExportDocument, ExportOrder


class ExportDocumentSerializer(serializers.ModelSerializer):
    """One customs paper; the two upload fences below are the whole contract."""

    # Scoped to this module on purpose: legal scans are heavier than avatars,
    # and the formats customs actually accepts are PDF and plain images.
    MAX_UPLOAD_BYTES = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS = frozenset({".pdf", ".jpg", ".jpeg", ".png"})

    file = serializers.FileField(write_only=True)
    download_url = serializers.SerializerMethodField()
    document_type_label = serializers.CharField(
        source="get_document_type_display", read_only=True
    )

    class Meta:
        model = ExportDocument
        fields = [
            "id",
            "export_order",
            "document_type",
            "document_type_label",
            "file",
            "download_url",
            "issue_date",
            "is_verified",
            "created_at",
        ]
        read_only_fields = ["id", "document_type_label", "download_url", "created_at"]

    def get_download_url(self, obj) -> str:
        return f"/api/export/documents/{obj.pk}/download/"

    def validate_file(self, value):
        extension = Path(value.name).suffix.lower()
        if extension not in self.ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                "فرمت سند مجاز نیست؛ فقط PDF یا تصویر (JPG/PNG) بارگذاری کنید."
            )
        if value.size > self.MAX_UPLOAD_BYTES:
            raise serializers.ValidationError(
                "حجم سند بیش از حد مجاز است؛ سقف هر سند ۱۰ مگابایت است."
            )
        return value


class ExportOrderSerializer(serializers.ModelSerializer):
    """Trade file: kernel order code beside trade terms and its papers."""

    order = serializers.PrimaryKeyRelatedField(
        queryset=Order.objects.all(),
        # One trade file per order, with a readable Persian refusal instead
        # of a raw 500 from the database's unique fence.
        validators=[
            UniqueValidator(
                queryset=ExportOrder.objects.all(),
                message="برای این سفارش قبلاً پرونده صادراتی ثبت شده است.",
            )
        ],
    )
    order_code = serializers.CharField(source="order.code", read_only=True)
    destination_country_label = serializers.CharField(
        source="get_destination_country_display", read_only=True
    )
    currency_label = serializers.CharField(source="get_currency_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    documents = ExportDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = ExportOrder
        fields = [
            "id",
            "order",
            "order_code",
            "destination_country",
            "destination_country_label",
            "currency",
            "currency_label",
            "total_value_foreign",
            "status",
            "status_label",
            "documents",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "order_code",
            "destination_country_label",
            "currency_label",
            "status_label",
            "documents",
            "created_at",
            "updated_at",
        ]
