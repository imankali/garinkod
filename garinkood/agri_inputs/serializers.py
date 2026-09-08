"""Serializers for agri inputs — domain profile + product summary in one payload.

Pattern mirrors the rest of the platform (ModelSerializer), with a small
local ``ProductSummarySerializer`` instead of importing shop's serializer:
the holding-kernel contract stays in THIS bounded context, so a refactored
shop serializer can never silently change the AgriInputs API.
"""

from rest_framework import serializers

from shop.models import Product

from .models import Fertilizer, Pesticide, Seed, Seedling


class ProductSummarySerializer(serializers.ModelSerializer):
    """Minimal, stable subset of shop.Product that the inputs UI needs."""

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


class _AgriInputSerializer(serializers.ModelSerializer):
    product = ProductSummarySerializer(read_only=True)


class FertilizerSerializer(_AgriInputSerializer):
    class Meta:
        model = Fertilizer
        fields = [
            "id", "product",
            "active_ingredient", "npk_ratio", "expiry_date", "registration_number",
        ]
        read_only_fields = fields


class PesticideSerializer(_AgriInputSerializer):
    class Meta:
        model = Pesticide
        fields = [
            "id", "product",
            "target_pest", "toxicity_level", "waiting_period",
            "expiry_date", "registration_number",
        ]
        read_only_fields = fields


class SeedSerializer(_AgriInputSerializer):
    class Meta:
        model = Seed
        fields = [
            "id", "product",
            "germination_rate", "planting_season", "seed_treatment", "variety_name",
        ]
        read_only_fields = fields


class SeedlingSerializer(_AgriInputSerializer):
    class Meta:
        model = Seedling
        fields = [
            "id", "product",
            "rootstock", "scion_variety", "age_years", "height_cm",
        ]
        read_only_fields = fields
