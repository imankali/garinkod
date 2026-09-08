"""Serializers for machinery — mechanical profile + product summary payload.

Architectural note: we deliberately do NOT import agri_inputs' summary
serializer — bounded contexts stay self-contained (DDD). The tiny duplication
buys module independence; either module can be removed without breaking the
other. Cross-module DRY stops at the context border by design.
"""

from rest_framework import serializers

from shop.models import Product

from .models import Implement, Tractor


class ProductSummarySerializer(serializers.ModelSerializer):
    """Minimal, stable subset of shop.Product that the machinery UI needs."""

    image_url = serializers.SerializerMethodField()
    image_srcset = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "slug", "title", "brand", "price", "stock",
            "available", "is_in_stock", "image_url", "image_srcset",
        ]
        read_only_fields = fields

    def get_image_url(self, obj) -> str:
        return obj.image_url

    def get_image_srcset(self, obj) -> dict:
        return obj.get_image_srcset()

    def get_is_in_stock(self, obj) -> bool:
        return obj.is_in_stock


class TractorSerializer(serializers.ModelSerializer):
    product = ProductSummarySerializer(read_only=True)
    condition_label = serializers.SerializerMethodField()

    class Meta:
        model = Tractor
        fields = [
            "id", "product",
            "horsepower", "manufacture_year", "working_hours",
            "warranty_months", "is_second_hand", "condition_label",
        ]
        read_only_fields = fields

    def get_condition_label(self, obj) -> str:
        return "دست دوم" if obj.is_second_hand else "نو"


class ImplementSerializer(serializers.ModelSerializer):
    product = ProductSummarySerializer(read_only=True)
    implement_type_label = serializers.CharField(source="get_implement_type_display", read_only=True)

    class Meta:
        model = Implement
        fields = [
            "id", "product",
            "implement_type", "implement_type_label",
            "working_width", "compatible_tractors", "warranty_months",
        ]
        read_only_fields = fields
