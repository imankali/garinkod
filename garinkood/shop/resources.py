"""Narrow, permission-gated spreadsheet resources for Django admin.

Product import intentionally excludes primary keys, images, sales counters and
related detail tables. A slug is the stable import identity and all rows pass
Django model validation before being saved. Orders are export-only in admin.
"""

from import_export import fields, resources
from import_export.widgets import ForeignKeyWidget

from django.contrib.auth import get_user_model

from .models import Category, Order, Product, SubCategory


class ProductResource(resources.ModelResource):
    author = fields.Field(
        attribute="author",
        column_name="author_username",
        widget=ForeignKeyWidget(get_user_model(), field="username"),
    )
    category = fields.Field(
        attribute="category",
        column_name="category_slug",
        widget=ForeignKeyWidget(Category, field="slug"),
    )
    subcategory = fields.Field(
        attribute="subcategory",
        column_name="subcategory_slug",
        widget=ForeignKeyWidget(SubCategory, field="slug"),
    )

    class Meta:
        model = Product
        import_id_fields = ("slug",)
        fields = (
            "slug",
            "title",
            "author",
            "category",
            "subcategory",
            "description",
            "status",
            "publish",
            "price",
            "stock",
            "available",
            "is_featured",
            "discount_percent",
            "brand",
            "sku",
            "gtin",
            "seo_title",
            "seo_description",
            "shipping_weight_grams",
            "shipping_length_cm",
            "shipping_width_cm",
            "shipping_height_cm",
        )
        export_order = fields
        skip_unchanged = True
        report_skipped = True
        clean_model_instances = True
        use_bulk = False


class OrderResource(resources.ModelResource):
    items = fields.Field(column_name="items")

    class Meta:
        model = Order
        fields = (
            "code",
            "customer_name",
            "phone",
            "email",
            "province",
            "city",
            "address",
            "postal_code",
            "subtotal",
            "discount_amount",
            "shipping_price",
            "total_price",
            "payment_method",
            "payment_status",
            "status",
            "coupon_code",
            "items",
            "created_at",
            "updated_at",
        )
        export_order = fields

    def dehydrate_items(self, order):
        return " | ".join(
            f"{item.quantity} × {item.product_title} ({item.unit_price} تومان)"
            for item in order.items.all()
        )
