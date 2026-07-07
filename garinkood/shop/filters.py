"""
فیلترهای سفارشی محصولات
✅ مطابق با پارامترهایی که فرانت‌اند ارسال می‌کند:
   category (slug)، min_price، max_price، available، is_featured
"""
import django_filters

from .models import Product


class ProductFilter(django_filters.FilterSet):
    # فرانت‌اند slug دسته را با کلید `category` می‌فرستد
    category = django_filters.CharFilter(field_name='category__slug', lookup_expr='iexact')
    subcategory = django_filters.CharFilter(field_name='subcategory__slug', lookup_expr='iexact')
    min_price = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    in_stock = django_filters.BooleanFilter(method='filter_in_stock')

    class Meta:
        model = Product
        fields = ['category', 'subcategory', 'is_featured', 'available', 'min_price', 'max_price', 'in_stock']

    def filter_in_stock(self, queryset, name, value):
        if value:
            return queryset.filter(available=True, stock__gt=0)
        return queryset
