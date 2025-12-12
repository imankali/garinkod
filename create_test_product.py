
from django.contrib.auth import get_user_model
from .garinkood.shop.models import Category, Item

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
Item.objects.create(
    category=category,
    author=author,
    title='Test Product',
    slug='test-product',
    body='This is a test product.',
    price=1000,
    stock=10,
    status='published'
)

print("Test product created successfully.")
