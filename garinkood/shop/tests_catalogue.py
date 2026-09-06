"""Tests for the catalogue depth layer: packaging, trust data and landing pages.

Written against how fertiliser is actually bought: the same 50 kg bag also sells
loose by the kilo, the minimum order differs per bag, the date printed on a bag
matters more than a badge, and a category or brand deserves an address of its own.

The theme running through these assertions is that a number is either derived from
real rows or it is absent: an unset return window, a product without dates and a
brand without a supplier record all have to say so rather than fill in a value.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .persian import fa_digits
from .catalog_views import policy_payload
from .models import (
    BrandPartner, CartItem, Category, Comment, CommentVote, Order, OrderItem, PlatformFeedback,
    Product, ProductImage, ProductPackage, ReturnPolicySettings, SitePage, SitePageBlock, SubCategory, Tag,
)
from .shipping import quote_shipping, shipping_options
from .tests_content import make_product

CHECKOUT_PAYLOAD = {
    'customer_name': 'کشاورز آزمون', 'phone': '09121110000', 'province': 'فارس',
    'city': 'شیراز', 'address': 'خیابان نمونه، پلاک ۱', 'payment_method': 'coordination',
    'terms_accepted': True,
}


def paid_order_for(buyer, product, quantity=1):
    """An order with a paid invoice — the only evidence a review has of a purchase."""
    order = Order.objects.create(
        user=buyer, customer_name=buyer.username, phone='09121110000',
        province='فارس', city='شیراز', address='نشانی آزمون', payment_status='paid',
        status='completed', subtotal=product.price * quantity,
    )
    OrderItem.objects.create(
        order=order, product=product, kind='product', product_title=product.title,
        product_slug=product.slug, unit_price=product.price, quantity=quantity,
    )
    return order


@override_settings(SECURE_SSL_REDIRECT=False)
class PackagingTests(TestCase):
    """Package rows are a price source; the product row is their fallback."""

    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='seller-pack')
        self.category = Category.objects.create(name='کود', slug='fertilizer')
        self.product = make_product(
            self.category, self.seller, slug='nitro-pack', price=1_000_000, stock=60,
            discount_percent=10,
        )

    def test_product_without_declared_packages_exposes_one_implicit_row(self):
        packages = self.client.get(f'/api/products/{self.product.slug}/').data['packages']

        self.assertEqual(len(packages), 1)
        row = packages[0]
        # A synthetic row (no id) keeps "no packaging chosen" out of the UI, and it
        # carries the product's own numbers instead of inventing a zero.
        self.assertIsNone(row['id'])
        self.assertEqual(row['label'], '۲۵ کیلوگرم')
        self.assertEqual(row['price'], 1_000_000)
        self.assertEqual(row['discounted_price'], 900_000)
        self.assertEqual(row['effective_stock'], 60)
        self.assertTrue(row['is_default'])

    def test_effective_price_stock_and_unit_price_are_read_off_the_row(self):
        ProductPackage.objects.create(
            product=self.product, label='کیسه ۵۰ کیلویی', weight_kg=50, price=3_000_000,
            stock=8, is_default=True, order=0,
        )
        loose = ProductPackage.objects.create(
            product=self.product, label='فله ۱ کیلویی', weight_kg=1, price=90_000,
            min_order_quantity=5, order=1,
            bulk_note='زیر ۵۰ کیلو از همان کیسه پر و ارسال می‌شود.',
        )

        rows = {row['label']: row for row in self.client.get(f'/api/products/{self.product.slug}/').data['packages']}

        self.assertEqual(rows['کیسه ۵۰ کیلویی']['effective_price'], 3_000_000)
        self.assertEqual(rows['کیسه ۵۰ کیلویی']['discounted_price'], 2_700_000)
        self.assertEqual(rows['کیسه ۵۰ کیلویی']['effective_stock'], 8)
        self.assertEqual(rows['کیسه ۵۰ کیلویی']['price_per_kg'], 60_000)
        self.assertTrue(rows['کیسه ۵۰ کیلویی']['is_default'])

        # A bag that follows the product's total must not be read as unlimited:
        # its own declared stock is null, so the effective figure is the product's.
        self.assertIsNone(rows['فله ۱ کیلویی']['stock'])
        self.assertEqual(rows['فله ۱ کیلویی']['effective_stock'], 60)
        self.assertEqual(rows['فله ۱ کیلویی']['price_per_kg'], 90_000)
        self.assertEqual(rows['فله ۱ کیلویی']['min_order_quantity'], 5)
        self.assertTrue(rows['فله ۱ کیلویی']['bulk_note'].startswith('زیر ۵۰ کیلو'))

        # Loose is the dearer kilo — the number a bulk buyer needs and no single
        # product price could express.
        self.assertGreater(rows['فله ۱ کیلویی']['price_per_kg'], rows['کیسه ۵۰ کیلویی']['price_per_kg'])
        self.assertTrue(loose.is_in_stock)

    def test_two_packages_are_two_cart_rows_priced_separately(self):
        bag = ProductPackage.objects.create(
            product=self.product, label='کیسه ۲۵ کیلویی', weight_kg=25, price=1_500_000, stock=4
        )
        loose = ProductPackage.objects.create(
            product=self.product, label='فله', weight_kg=1, price=70_000
        )

        for package, quantity in ((bag, 1), (loose, 3)):
            added = self.client.post(
                '/api/cart/add/',
                {'product_id': self.product.id, 'quantity': quantity, 'package_id': package.id},
                format='json',
            )
            self.assertEqual(added.status_code, 201, added.content.decode())

        cart = self.client.get('/api/cart/').data
        self.assertEqual(len(cart['items']), 2)
        by_label = {row['package_label']: row for row in cart['items']}
        self.assertEqual(by_label['کیسه ۲۵ کیلویی']['unit_price'], 1_500_000)
        self.assertEqual(by_label['فله']['unit_price'], 70_000)
        self.assertEqual(cart['total_price'], 1_500_000 + 3 * 70_000)

    def test_cart_enforces_the_package_minimum_and_its_own_stock(self):
        package = ProductPackage.objects.create(
            product=self.product, label='گالن ۲۰ لیتری', weight_kg=20, price=800_000,
            stock=2, min_order_quantity=3,
        )

        too_few = self.client.post(
            '/api/cart/add/',
            {'product_id': self.product.id, 'quantity': 1, 'package_id': package.id},
            format='json',
        )
        self.assertEqual(too_few.status_code, 400)
        self.assertIn('3', too_few.data['error'])

        # Over the stock is not an error but a clamp: the cart keeps what can be
        # sold, and the buyer is shown two rather than told nothing.
        too_many = self.client.post(
            '/api/cart/add/',
            {'product_id': self.product.id, 'quantity': 5, 'package_id': package.id},
            format='json',
        )
        self.assertEqual(too_many.status_code, 201)
        self.assertEqual([row['quantity'] for row in too_many.data['items']], [2])
        self.assertEqual(too_many.data['items'][0]['available_quantity'], 2)

        sold_out = ProductPackage.objects.create(product=self.product, label='تمام‌شده', stock=0)
        empty = self.client.post(
            '/api/cart/add/',
            {'product_id': self.product.id, 'quantity': 1, 'package_id': sold_out.id},
            format='json',
        )
        self.assertEqual(empty.status_code, 400)
        self.assertIn('موجود نیست', empty.data['error'])

    def test_checkout_snapshots_the_label_and_decrements_the_bag_that_declared_stock(self):
        package = ProductPackage.objects.create(
            product=self.product, label='کیسه ۵۰ کیلویی', weight_kg=50, price=2_000_000, stock=3
        )
        inherits = ProductPackage.objects.create(product=self.product, label='فله', weight_kg=1, price=2_000_000 // 50)

        self.client.post(
            '/api/cart/add/',
            {'product_id': self.product.id, 'quantity': 2, 'package_id': package.id},
            format='json',
        )
        self.client.post(
            '/api/cart/add/',
            {'product_id': self.product.id, 'quantity': 10, 'package_id': inherits.id},
            format='json',
        )
        response = self.client.post('/api/orders/checkout/', CHECKOUT_PAYLOAD, format='json')
        self.assertEqual(response.status_code, 201, response.content.decode())

        lines = {line.package_label: line for line in OrderItem.objects.filter(order_id=response.data['order']['id'])}
        self.assertEqual(lines['کیسه ۵۰ کیلویی'].unit_price, 2_000_000)
        self.assertEqual(lines['فله'].unit_price, 40_000)

        package.refresh_from_db()
        inherits.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(package.stock, 1, 'the declared bag stock moved')
        self.assertIsNone(inherits.stock, 'one that inherits must not be double counted')
        self.assertEqual(self.product.stock, 60 - 12)

        # Relabelling the product afterwards must not rewrite a sold invoice.
        package.label = 'کیسه ۵۰ کیلویی (نسخه جدید)'
        package.save(update_fields=['label'])
        lines['کیسه ۵۰ کیلویی'].refresh_from_db()
        self.assertEqual(lines['کیسه ۵۰ کیلویی'].package_label, 'کیسه ۵۰ کیلویی')

    def test_weight_and_expiry_read_from_the_row_that_was_bought(self):
        package = ProductPackage.objects.create(
            product=self.product, label='کیسه ۵۰ کیلویی', weight_kg=51, price=2_000_000,
            expiry_date=timezone.localdate() + timedelta(days=40),
        )
        loose = ProductPackage.objects.create(product=self.product, label='فله', weight_kg=1)

        self.client.post(
            '/api/cart/add/',
            {'product_id': self.product.id, 'quantity': 2, 'package_id': package.id},
            format='json',
        )
        row = CartItem.objects.get(product=self.product, product_package=package)
        self.assertEqual(row.shipping_weight_grams, 51_000)
        self.assertEqual(row.quantity * row.shipping_weight_grams, 102_000)

        self.assertEqual(package.expiry_days_left, 40)
        self.assertTrue(package.expiry_days_left <= 90)
        # An unpriced, undated bag inherits the price rather than reporting zero,
        # and for the date it reports the nearest one the shop declares anywhere for
        # the product — which is why the storefront calls it «انقضای اعلام‌شده».
        self.assertEqual(loose.effective_price, self.product.price)
        self.assertEqual(loose.expiry_days_left, 40)

    def test_a_product_without_dates_is_never_reported_as_expiring(self):
        plain = make_product(self.category, self.seller, slug='undated-pack')
        self.assertFalse(plain.is_expiring_soon)
        self.assertIsNone(plain.expiry_days_left)

        plain.expiry_date = timezone.localdate() + timedelta(days=365)
        plain.save(update_fields=['expiry_date'])
        self.assertFalse(plain.is_expiring_soon)

        plain.expiry_date = timezone.localdate() + timedelta(days=30)
        plain.save(update_fields=['expiry_date'])
        self.assertTrue(plain.is_expiring_soon)
        self.assertIn('undated-pack', self.slugs_of('expiring_soon=true'))

    def slugs_of(self, query):
        response = self.client.get(f'/api/products/?{query}')
        self.assertEqual(response.status_code, 200, response.content.decode())
        return {row['slug'] for row in response.data['results']}

    def test_gallery_is_ordered_and_the_card_hover_uses_its_second_photo(self):
        ProductImage.objects.create(product=self.product, image='gallery-b.jpg', caption='نمای کلی', order=1)
        ProductImage.objects.create(product=self.product, image='gallery-a.jpg', caption='در مزرعه', order=0)

        detail = self.client.get(f'/api/products/{self.product.slug}/').data
        self.assertTrue(detail['gallery'][0]['url'], 'the cover leads the gallery')
        self.assertEqual([row['caption'] for row in detail['gallery'][1:]], ['در مزرعه', 'نمای کلی'])

        row = next(item for item in self.client.get('/api/products/').data['results'] if item['slug'] == 'nitro-pack')
        self.assertTrue(row['image_alt_url'].endswith('gallery-a.jpg'))
        # The detail read above counted, and the list prints the same counter.
        self.assertEqual(row['views'], 1)


@override_settings(SECURE_SSL_REDIRECT=False)
class ProductFacetAndLandingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='seller-facets')
        self.category = Category.objects.create(name='کود', slug='fertilizer')
        self.other_category = Category.objects.create(name='سموم', slug='pesticide')
        self.subcategory = SubCategory.objects.create(
            category=self.category, name='سولفوریک', slug='سولفوریک'
        )
        self.tag = Tag.objects.create(name='مینای آب', slug='مینای-آب')

        self.cheap = make_product(
            self.category, self.seller, slug='cheap', price=100_000, stock=5, brand='رویال'
        )
        self.pricey = make_product(
            self.category, self.seller, slug='pricey', price=9_000_000, stock=5,
            brand='دانو', subcategory=self.subcategory,
        )
        self.inOther = make_product(
            self.other_category, self.seller, slug='poison', price=500_000, stock=5, brand='دانو'
        )
        self.pricey.tags.add(self.tag)

        Comment.objects.create(
            product=self.cheap, name='a', body='عالی بود برای مزرعه ما و قیمتش هم مناسب است',
            rating=5, active=True,
        )
        Comment.objects.create(
            product=self.pricey, name='b', body='بسته‌بندی آسیب دیده بود و دیر رسید', rating=2, active=True,
        )

    def slugs_of(self, query):
        response = self.client.get(f'/api/products/?{query}')
        self.assertEqual(response.status_code, 200, response.content.decode())
        return {row['slug'] for row in response.data['results']}

    def test_price_rating_and_review_filters(self):
        self.assertEqual(self.slugs_of('min_price=1000000'), {'pricey'})
        self.assertEqual(self.slugs_of('max_price=500000'), {'cheap', 'poison'})
        self.assertEqual(self.slugs_of('min_rating=4'), {'cheap'})
        self.assertEqual(self.slugs_of('has_reviews=true'), {'cheap', 'pricey'})
        # A product in a category nobody reviewed is dropped by the review filter.
        self.assertEqual(self.slugs_of('has_reviews=true&category=fertilizer'), {'cheap', 'pricey'})
        self.assertNotIn('poison', self.slugs_of('has_reviews=true'))

    def test_tag_and_subcategory_filters(self):
        self.assertEqual(self.slugs_of('tag=مینای-آب'), {'pricey'})
        self.assertEqual(self.slugs_of('subcategory=سولفوریک'), {'pricey'})

    def test_most_viewed_ordering_uses_the_real_counter(self):
        for _ in range(3):
            self.client.get(f'/api/products/{self.cheap.slug}/')
        self.client.get(f'/api/products/{self.pricey.slug}/')

        self.cheap.refresh_from_db()
        self.pricey.refresh_from_db()
        self.assertEqual((self.cheap.views, self.pricey.views), (3, 1))

        ordered = [row['slug'] for row in self.client.get('/api/products/?ordering=-views').data['results']]
        self.assertEqual(ordered[0], 'cheap')
        self.assertEqual(ordered[1], 'pricey')

    def test_brand_slug_is_derived_from_the_brand_name(self):
        self.pricey.refresh_from_db()
        self.assertEqual(self.pricey.brand_slug, 'دانو')
        self.assertEqual(self.cheap.brand_slug, 'رویال')

        # A seller typing the brand with stray spacing lands on the same page.
        other = make_product(self.category, self.seller, slug='danoo-2', brand='  دانو  ')
        self.assertEqual(other.brand_slug, 'دانو')

        partner = BrandPartner.objects.create(name='دانو', is_active=True)
        self.assertEqual(partner.slug, 'دانو')
        self.assertEqual(partner.product_count(), 3)

    def test_brand_landing_selects_exactly_its_own_products(self):
        landing = self.client.get('/api/catalog/landing/brand/دانو/').data
        self.assertEqual(landing['title'], 'دانو')
        self.assertEqual(landing['count'], 2)
        self.assertEqual(landing['filters'], {'brand_slug': 'دانو'})
        # The page and the grid can never disagree: the filter object the page
        # hands the client returns the same rows it counted.
        self.assertEqual(self.slugs_of('brand_slug=دانو'), {'pricey', 'poison'})
        self.assertIsNone(landing['partner'], 'a catalogue brand without a supplier row still has a page')

    def test_unknown_and_empty_group_addresses(self):
        self.assertEqual(self.client.get('/api/catalog/landing/brand/nobody-here/').status_code, 404)

        landing = self.client.get('/api/catalog/landing/category/pesticide/').data
        self.assertEqual(landing['count'], 1)
        self.assertEqual(landing['description'], '')
        self.assertIn('seo_title', landing)

    def test_tag_landing_lists_the_other_tags_as_siblings(self):
        Tag.objects.create(name='کود جلبی', slug='کود-جلبی')
        landing = self.client.get('/api/catalog/landing/tag/مینای-آب/').data
        self.assertEqual(landing['kind'], 'tag')
        self.assertEqual(landing['filters'], {'tag': 'مینای-آب'})
        # The page lists its siblings, never itself.
        self.assertEqual({row['slug'] for row in landing['siblings']}, {'کود-جلبی'})

    def test_category_landing_offers_its_subcategories_as_cards(self):
        self.category.description = 'راهنمای خرید کود شیمیایی برای زراعت و باغ'
        self.category.seo_title = 'کود شیمیایی | گرین کود'
        self.category.save(update_fields=['description', 'seo_title'])

        landing = self.client.get('/api/catalog/landing/category/fertilizer/').data
        self.assertEqual(landing['description'], 'راهنمای خرید کود شیمیایی برای زراعت و باغ')
        self.assertEqual(landing['seo_title'], 'کود شیمیایی | گرین کود')
        self.assertEqual(landing['filters'], {'category': 'fertilizer'})
        self.assertEqual(landing['count'], 2)
        self.assertEqual([row['slug'] for row in landing['children']], ['سولفوریک'])
        self.assertEqual(landing['children'][0]['count'], 1)
        self.assertEqual(landing['children'][0]['url'], '/sc/سولفوریک')
        self.assertEqual(landing['avg_rating'], 3.5)
        self.assertEqual(landing['facets']['price']['min'], 100_000)
        self.assertEqual({row['slug'] for row in landing['facets']['brands']}, {'دانو', 'رویال'})

    def test_brand_page_links_to_the_other_brands_of_the_shelf(self):
        landing = self.client.get('/api/catalog/landing/brand/رویال/').data
        # A page for one maker is a dead end unless the next maker is one hop away.
        self.assertEqual({row['slug'] for row in landing['siblings']}, {'دانو'})
        self.assertEqual(landing['siblings'][0]['url'], '/brand/دانو')
        self.assertEqual(landing['siblings'][0]['count'], 2)

    def test_catalog_index_groups_only_what_the_database_holds(self):
        data = self.client.get('/api/catalog/index/').data
        self.assertEqual({row['slug'] for row in data['brands']}, {'دانو', 'رویال'})
        # One card shape for every group, so one renderer serves all of them.
        for group in ('categories', 'tags', 'brands'):
            for row in data[group]:
                self.assertEqual(
                    sorted(row),
                    sorted(['kind', 'title', 'slug', 'image_url', 'description', 'count', 'url']),
                )
        self.assertEqual(data['brands'][0]['count'], 2, 'the busiest brand leads')
        self.assertEqual({row['slug'] for row in data['tags']}, {'مینای-آب'})
        self.assertEqual({row['slug'] for row in data['categories']}, {'fertilizer', 'pesticide'})
        by_slug = {row['slug']: row for row in data['categories']}
        self.assertEqual(by_slug['fertilizer']['count'], 2)
        self.assertEqual(by_slug['fertilizer']['url'], '/c/fertilizer')

    def test_sitemap_publishes_the_group_addresses(self):
        body = self.client.get('/sitemap.xml').content.decode()
        for needle in ('/brand/دانو', '/tag/مینای-آب', '/c/fertilizer', '/sc/سولفوریک', '/faq', '/customers'):
            self.assertIn(needle, body)


@override_settings(SECURE_SSL_REDIRECT=False)
class ShippingAndPolicyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='seller-ship')
        self.category = Category.objects.create(name='کود', slug='fertilizer')
        self.product = make_product(
            self.category, self.seller, slug='bulk-bag', price=1_000_000, stock=10,
            shipping_weight_grams=25_000,
        )

    def services(self, *, weight_grams=30_000, subtotal=1_000_000):
        return {
            quote.service: quote.amount
            for quote in shipping_options(
                subtotal=subtotal, province='فارس', city='شیراز', weight_grams=weight_grams
            )
        }

    def test_express_is_offered_only_after_the_admin_turns_it_on(self):
        self.assertEqual(list(self.services()), ['standard'])
        standard_only = self.services()['standard']

        policy = ReturnPolicySettings.load()
        policy.express_shipping_enabled = True
        policy.express_shipping_fee = 120_000
        policy.save()

        costs = self.services()
        self.assertEqual(sorted(costs), ['express', 'standard'])
        self.assertEqual(costs['express'], standard_only + 120_000)

        # The quote endpoint a buyer sees before paying lists both services too.
        self.client.post('/api/cart/add/', {'product_id': self.product.id, 'quantity': 1}, format='json')
        quoted = self.client.post('/api/shipping/quote/', {'province': 'فارس', 'city': 'شیراز'}, format='json').data
        self.assertEqual([row['service'] for row in quoted['quotes']], ['standard', 'express'])
        self.assertTrue(quoted['authoritative_at_checkout'])

    def test_policy_endpoint_refuses_to_invent_a_window(self):  # digits, not raw ints:
        data = self.client.get('/api/site/policies/').data
        self.assertIsNone(data['return_window_days'])
        self.assertEqual(data['return_window_label'], '')
        self.assertFalse(data['express_shipping']['enabled'])

        policy = ReturnPolicySettings.load()
        policy.window_days = 7
        policy.conditions = 'بسته‌بندی باز نشده باشد و فاکتور همراه باشد.'
        policy.save()

        data = self.client.get('/api/site/policies/').data
        self.assertEqual(data['return_window_days'], 7)
        self.assertIn('۷', data['return_window_label'])
        self.assertIn('فاکتور', policy_payload()['return_conditions'])

    def test_legal_returns_document_carries_the_live_value(self):
        ReturnPolicySettings.objects.create(pk=1, window_days=5)
        document = self.client.get('/api/legal/returns/').data
        self.assertEqual(document['policy']['return_window_days'], 5)
        # Only that document gets the value; another must not imply one.
        self.assertNotIn('policy', self.client.get('/api/legal/privacy/').data)

    def test_checkout_accepts_express_only_when_it_is_enabled(self):
        self.client.post('/api/cart/add/', {'product_id': self.product.id, 'quantity': 1}, format='json')
        disabled = self.client.post(
            '/api/orders/checkout/', {**CHECKOUT_PAYLOAD, 'shipping_service': 'express'}, format='json'
        )
        self.assertEqual(disabled.status_code, 400)

        policy = ReturnPolicySettings.load()
        policy.express_shipping_enabled = True
        policy.express_shipping_fee = 50_000
        policy.save()

        express = self.client.post(
            '/api/orders/checkout/', {**CHECKOUT_PAYLOAD, 'shipping_service': 'express'}, format='json'
        )
        self.assertEqual(express.status_code, 201, express.content.decode())
        plain = quote_shipping(subtotal=1_000_000, province='فارس', city='شیراز', weight_grams=25_000).amount
        self.assertEqual(express.data['order']['shipping_price'], plain + 50_000)

        # No service chosen still means the ordinary one.
        self.client.post('/api/cart/add/', {'product_id': self.product.id, 'quantity': 1}, format='json')
        standard = self.client.post('/api/orders/checkout/', CHECKOUT_PAYLOAD, format='json')
        self.assertEqual(standard.data['order']['shipping_price'], plain)
        self.assertEqual(
            Order.objects.get(pk=standard.data['order']['id']).shipping_service, 'standard'
        )


@override_settings(SECURE_SSL_REDIRECT=False)
class ReviewTrustTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='seller-review')
        self.buyer = User.objects.create_user(username='buyer-review', password='pw-12345')
        self.category = Category.objects.create(name='کود', slug='fertilizer')
        self.product = make_product(
            self.category, self.seller, slug='reviewed', price=100_000, stock=1
        )
        self.comment = Comment.objects.create(
            product=self.product, name='کشاورز', body='کیفیت خوب و بسته‌بندی سالم بود.',
            rating=5, active=True,
        )

    def test_helpful_count_is_counted_from_votes_not_posted(self):
        for offset in range(3):
            response = self.client.post(
                f'/api/comments/{self.comment.pk}/helpful/', REMOTE_ADDR=f'10.0.0.{offset}'
            )
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data['voted'])

        self.comment.refresh_from_db()
        self.assertEqual(self.comment.helpful_count, 3)
        self.assertEqual(CommentVote.objects.count(), 3)

        listed = self.client.get(f'/api/comments/by_product/?product={self.product.slug}').data
        self.assertEqual(listed[0]['helpful_count'], 3)

        # The same visitor clicking again takes the vote back — a toggle, not an
        # increment, so a determined reader cannot inflate a score.
        back = self.client.post(f'/api/comments/{self.comment.pk}/helpful/', REMOTE_ADDR='10.0.0.0')
        self.assertFalse(back.data['voted'])
        self.assertEqual(back.data['helpful_count'], 2)

    def test_an_account_votes_once_no_matter_how_many_networks_it_uses(self):
        self.client.force_authenticate(self.buyer)
        first = self.client.post(f'/api/comments/{self.comment.pk}/helpful/', REMOTE_ADDR='10.0.0.1')
        self.assertTrue(first.data['voted'])

        # Same account from another network: the second click is the same reader
        # taking their vote back, not a second vote appearing.
        second = self.client.post(f'/api/comments/{self.comment.pk}/helpful/', REMOTE_ADDR='10.0.0.2')
        self.assertFalse(second.data['voted'])
        self.assertEqual(second.data['helpful_count'], 0)
        self.assertEqual(CommentVote.objects.count(), 0)

        # A different account is a different reader, and counts.
        other = User.objects.create_user(username='other-reviewer')
        self.client.force_authenticate(other)
        self.assertEqual(
            self.client.post(f'/api/comments/{self.comment.pk}/helpful/').data['helpful_count'], 1
        )
        self.assertEqual(CommentVote.objects.filter(user=other).count(), 1)

    def test_reporting_files_a_note_and_leaves_the_review_published(self):
        response = self.client.post(
            f'/api/comments/{self.comment.pk}/report/', {'reason': 'توهین به سایر خریداران'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['reported'])

        self.comment.refresh_from_db()
        self.assertTrue(self.comment.is_reported)
        self.assertTrue(self.comment.active, 'staff decide; the reporter does not silence anyone')

        note = PlatformFeedback.objects.get()
        self.assertIn('توهین به سایر خریداران', note.message)
        self.assertIn(self.product.title, note.subject)


@override_settings(SECURE_SSL_REDIRECT=False)
class TestimonialTierTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='seller-quotes')
        self.buyer = User.objects.create_user(username='buyer-quotes')
        self.category = Category.objects.create(name='کود', slug='fertilizer')
        self.product = make_product(self.category, self.seller, slug='quoted', price=100_000, stock=1)
        self.good = Comment.objects.create(
            product=self.product, user=self.buyer, name='خوب',
            body='بسیار راضی بودم، نتیجه در مزرعه مشخص بود.', rating=5, active=True,
        )
        self.mediocre = Comment.objects.create(
            product=self.product, name='متوسط', body='معمولی بود و زیاد خوشایند نبود.',
            rating=3, active=True,
        )
        self.bad = Comment.objects.create(
            product=self.product, name='بد', body='موجودی تمام بود و ارسال دیر انجام شد.',
            rating=1, active=True,
        )

    def test_open_tier_shows_the_rated_reviews_and_says_so(self):
        data = self.client.get('/api/testimonials/').data
        self.assertEqual(data['mode'], 'open')
        # Three published reviews exist and all are counted, but only the ones
        # worth reading unprompted are shown.
        self.assertEqual(data['total'], 3)
        self.assertEqual({row['id'] for row in data['items']}, {self.good.id})
        self.assertFalse(data['items'][0]['verified_purchase'])

    def test_verified_tier_requires_a_paid_order(self):
        paid_order_for(self.buyer, self.product)

        data = self.client.get('/api/testimonials/').data
        self.assertEqual(data['mode'], 'verified')
        self.assertTrue(data['items'][0]['verified_purchase'])

        # An anonymous review with no account can never claim the badge.
        self.mediocre.rating = 5
        self.mediocre.save(update_fields=['rating'])
        self.assertNotIn(
            self.mediocre.id, {row['id'] for row in self.client.get('/api/testimonials/').data['items']}
        )

    def test_curated_tier_wins_and_keeps_an_editor_picked_low_score_visible(self):
        self.bad.is_featured = True
        self.bad.save(update_fields=['is_featured'])

        data = self.client.get('/api/testimonials/').data
        self.assertEqual(data['mode'], 'curated')
        self.assertEqual([row['id'] for row in data['items']], [self.bad.id])
        self.assertEqual(data['items'][0]['rating'], 1)

    def test_product_cards_carry_the_pinned_review_and_the_count(self):
        self.good.is_featured = True
        self.good.save(update_fields=['is_featured'])

        row = next(item for item in self.client.get('/api/products/').data['results'] if item['slug'] == 'quoted')
        self.assertEqual(row['reviews_count'], 3)
        self.assertEqual(row['avg_rating'], 3.0)
        self.assertEqual(row['tags'], [])


@override_settings(SECURE_SSL_REDIRECT=False)
class FaqPageTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_seeder_creates_a_published_page_and_never_overwrites_an_edit(self):
        call_command('seed_faq_page')
        page = SitePage.objects.get(slug='faq')
        self.assertTrue(page.published)
        questions = [row[0] for block in page.blocks.all() for row in block.table_rows if row]
        self.assertTrue(questions)
        self.assertTrue(all(len(row) >= 2 for block in page.blocks.all() for row in block.table_rows))

        block = page.blocks.first()
        block.rows = 'سؤالی که تیم افزوده | پاسخ تیم'
        block.save(update_fields=['rows'])

        call_command('seed_faq_page')
        block.refresh_from_db()
        self.assertEqual(block.rows, 'سؤالی که تیم افزوده | پاسخ تیم')

        call_command('seed_faq_page', '--force')
        # --force rebuilds the blocks, so read the first one of the new set.
        first = SitePage.objects.get(slug='faq').blocks.first()
        self.assertNotEqual(first.rows, 'سؤالی که تیم افزوده | پاسخ تیم')
        self.assertGreaterEqual(len(first.rows.splitlines()), 2)

    def test_the_seeded_answers_match_what_the_code_actually_does(self):
        """The page may not promise a behaviour the shop does not implement.

        Two of the answers quote numbers — the cart ceiling and the delivery
        estimate — so those two are read back out of the running code here.
        """
        call_command('seed_faq_page', '--force')
        answers = ' '.join(
            row[1]
            for block in SitePage.objects.get(slug='faq').blocks.all()
            for row in block.table_rows
            if len(row) >= 2
        )

        quote = shipping_options(subtotal=1_000_000, province='فارس', city='شیراز', weight_grams=25_000)[0]
        promised = f'{fa_digits(quote.estimated_days_min)} تا {fa_digits(quote.estimated_days_max)} روز'
        self.assertIn(promised, answers)

        # «تا ۱۰ عدد» has to be the real ceiling of the cart: the page promises a
        # cap, so the cart has to clamp at ten instead of accepting eleven.
        unlimited = make_product(
            Category.objects.create(name='دسته فک', slug='faq-cat'),
            User.objects.create_user(username='seller-faq'),
            slug='faq-cart', price=10_000, stock=500,
        )
        client = APIClient()
        self.assertIn('۱۰ عدد', answers)
        cart = client.post('/api/cart/add/', {'product_id': unlimited.id, 'quantity': 11}, format='json').data
        self.assertEqual([row['quantity'] for row in cart['items']], [10])

    def test_faq_block_rows_split_on_the_pipe_and_drop_half_finished_lines(self):
        page = SitePage.objects.create(title='پرسش و پاسخ', slug='faq-page', kind='page', published=True)
        block = SitePageBlock.objects.create(
            page=page, position=0, block_type='faq', title='خرید و سفارش',
            rows='سؤال یکم | پاسخ یکم\nسؤال دوم | پاسخ دو | ادامه همان پاسخ\nبدون پاسخ',
        )

        rows = block.table_rows
        self.assertEqual(rows[0], ['سؤال یکم', 'پاسخ یکم'])
        # The splitter keeps every cell; the reader rejoins everything after the
        # first one into the answer, so a pipe inside an answer survives.
        self.assertEqual(rows[1], ['سؤال دوم', 'پاسخ دو', 'ادامه همان پاسخ'])
        self.assertEqual(rows[2], ['بدون پاسخ'])

        self.assertEqual(SitePageBlock.BLOCK_CHOICES[-1][0], 'faq')

    def test_public_pages_payload_includes_the_faq_page(self):
        call_command('seed_faq_page')
        slugs = [row['slug'] for row in self.client.get('/api/pages/').data]
        self.assertIn('faq', slugs)


@override_settings(SECURE_SSL_REDIRECT=False)
class PackagingCopyActionTests(TestCase):
    """The admin can repeat one product's packaging across a selection.

    Nobody fills thirty products' bags in by hand, so the alternative is nobody
    filling them in at all; the guard rail is that money never travels with the
    structure.
    """

    def setUp(self):
        self.seller = User.objects.create_user(username='seller-copy')
        self.category = Category.objects.create(name='کود', slug='fertilizer')
        self.source = make_product(self.category, self.seller, slug='source-bag', price=1_000_000)
        self.target = make_product(self.category, self.seller, slug='target-bag', price=4_000_000, stock=3)
        ProductPackage.objects.create(
            product=self.source, label='کیسه ۵۰ کیلویی', weight_kg=50, price=4_000_000, stock=9,
            min_order_quantity=2, bulk_note='زیر ۵۰ کیلو فله.', is_default=True,
        )
        self.tag = Tag.objects.create(name='کود شیمیایی', slug='کود-شیمیایی')
        self.source.tags.add(self.tag)

    def run_action(self):
        """Call the action the way the changelist does, keeping its message.

        ``request`` is only used for the message, so ``None`` is enough here —
        what is under test is which columns travel, not the admin plumbing.
        """
        from django.contrib import admin as django_admin

        from .models import Product as ProductModel

        seen = []
        original = django_admin.ModelAdmin.message_user
        django_admin.ModelAdmin.message_user = (
            lambda self, request, message, *args, **kwargs: seen.append(message)
        )
        try:
            django_admin.site._registry[ProductModel].copy_packaging(
                None, ProductModel.objects.filter(pk__in=[self.source.pk, self.target.pk]).order_by('id')
            )
        finally:
            django_admin.ModelAdmin.message_user = original
        return seen[0]

    def test_structure_travels_and_money_does_not(self):
        message = self.run_action()

        copied = self.target.packages.get(label='کیسه ۵۰ کیلویی')
        self.assertEqual(copied.weight_kg, 50)
        self.assertEqual(copied.min_order_quantity, 2)
        self.assertEqual(copied.bulk_note, 'زیر ۵۰ کیلو فله.')
        self.assertTrue(copied.is_default)
        self.assertIsNone(copied.price, 'a copied bag must not carry the other price')
        self.assertIsNone(copied.stock)
        # An empty field means "follow the product", so the copy is sellable now.
        self.assertEqual(copied.effective_price, 4_000_000)
        self.assertEqual(copied.effective_stock, 3)
        self.assertIn('قیمت و موجودی هیچ‌کدام کپی نشد', message)

    def test_the_source_product_is_left_alone_and_tags_are_shared(self):
        self.run_action()
        self.assertEqual(self.source.tags.count(), 1)
        self.assertEqual(list(self.target.tags.values_list('slug', flat=True)), ['کود-شیمیایی'])
        self.assertEqual(self.source.packages.count(), 1)

    def test_rerunning_the_action_does_not_duplicate_labels(self):
        self.run_action()
        self.run_action()
        self.assertEqual(self.target.packages.count(), 1)
        self.assertEqual(self.target.tags.count(), 1)
