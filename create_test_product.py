
import os
import sys
import django

# Add garinkood directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'garinkood'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'garinkood.settings')
django.setup()

from django.contrib.auth import get_user_model
from shop.models import Category, Product

User = get_user_model()

# پیدا کردن کاربر ادمین
try:
    author = User.objects.get(username='admin')
except User.DoesNotExist:
    print("Admin user not found. Please create a superuser first.")
    exit()


# ایجاد دسته
category, created = Category.objects.get_or_create(name='Test Category', defaults={'slug': 'test-category'})

# ایجاد محصول
product, created = Product.objects.get_or_create(
    slug='test-product',
    defaults={
        'category': category,
        'author': author,
        'title': 'Test Product',
        'description': 'This is a test product.',
        'price': 1000,
        'stock': 10,
        'status': 'published'
    }
)

if created:
    print("Test product created successfully.")
else:
    print("Test product already exists.")
