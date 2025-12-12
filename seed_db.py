
from django.contrib.auth.models import User
from django.core.files import File
from shop.models import Category, Item
import os

# Create a user to be the author of the product
user, created = User.objects.get_or_create(username='testuser', defaults={'password': 'testpassword'})

# Create the categories
categories_data = [
    {'name': 'کودها', 'slug': 'kod'},
    {'name': 'سموم', 'slug': 'sam'},
    {'name': 'بذرها', 'slug': 'bazr'},
    {'name': 'ادوات', 'slug': 'adavat'},
]

for cat_data in categories_data:
    Category.objects.get_or_create(name=cat_data['name'], slug=cat_data['slug'])

# Create or get the sample product in the "کودها" category
fertilizer_category = Category.objects.get(slug='kod')
item, created = Item.objects.get_or_create(
    title='کود کامل',
    slug='komple-fertilizer',
    defaults={
        'author': user,
        'category': fertilizer_category,
        'body': 'این یک کود کامل برای تست است.',
        'status': 'published',
        'price': 15000,
        'stock': 10,
    }
)

# Associate the dummy image with the product, regardless of whether it was created or not
image_path = os.path.join('media', 'products', 'dummy_image.png')
with open(image_path, 'rb') as f:
    item.image.save('dummy_image.png', File(f), save=True)

print("Database seeded successfully!")
