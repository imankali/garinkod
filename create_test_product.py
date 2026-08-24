"""Create one test product for local development.

Usage (from the repository root):

    .venv/bin/python garinkood/manage.py shell < create_test_product.py
"""

from django.contrib.auth import get_user_model
from shop.models import Category, Product

User = get_user_model()

# پیدا کردن کاربر ادمین
try:
    author = User.objects.get(username='admin')
except User.DoesNotExist:
    print("Admin user not found. Please create a superuser first.")
    raise SystemExit(1)


# ایجاد دسته
category, _created = Category.objects.get_or_create(
    name='Test Category', defaults={'slug': 'test-category'}
)

# ایجاد محصول
Product.objects.update_or_create(
    slug='test-product',
    defaults={
        'category': category,
        'author': author,
        'title': 'Test Product',
        'description': 'This is a test product.',
        'price': 1000,
        'stock': 10,
        'status': 'published',
        'discount_percent': 15,
        'sales_count': 42,
    },
)

print("Test product created successfully.")
