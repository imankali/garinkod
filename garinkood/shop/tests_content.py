"""Tests for the catalogue-depth and site-content features.

These are the pieces a wholesale competitor has and the platform did not:
structured specification sheets, real star ratings, brand/package facets,
quote-only products, a site-wide blog with growing guides, per-service pages,
admin-editable landing/information pages and the newsletter.
"""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    BrandPartner, Category, Comment, ListingAttribute, MarketplaceListing, NewsletterSubscriber,
    Product, ProductAttribute, Service, SiteArticle, SiteContact, SitePage, SitePageBlock,
    Storefront, TeamMember,
)


def make_product(category, author, **kwargs):
    defaults = {
        'title': 'کمپوست مرغی ۲۵ کیلوگرم',
        'slug': 'compost-25',
        'author': author,
        'category': category,
        'description': 'کود آلی پوسیده مناسب سبزیجات',
        'status': 'published',
        'price': 180_000,
        'stock': 10,
        'available': True,
        'brand': 'رویال',
        'package_weight': '۲۵ کیلوگرم',
    }
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


@override_settings(SECURE_SSL_REDIRECT=False)
class SpecificationAndRatingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(username='seller', password='safe-password-123')
        self.reviewer = User.objects.create_user(username='buyer', password='safe-password-123')
        self.category = Category.objects.create(name='کود', slug='fertilizer')
        self.product = make_product(self.category, self.author)

    def test_detail_exposes_ordered_attributes_and_skips_empty_labels(self):
        ProductAttribute.objects.create(product=self.product, label='وزن بسته', value='۲۵ کیلوگرم', order=1)
        ProductAttribute.objects.create(product=self.product, label='کشور سازنده', value='هلند', order=0)
        ProductAttribute.objects.create(product=self.product, label='بچ نامبر', value='', order=2)

        response = self.client.get(f'/api/products/{self.product.slug}/')

        self.assertEqual(response.status_code, 200)
        labels = [row['label'] for row in response.data['attributes']]
        # Ordered by ``order``, and the seeded-but-empty label is not published.
        self.assertEqual(labels, ['کشور سازنده', 'وزن بسته'])

    def test_rating_only_counts_approved_top_level_reviews(self):
        Comment.objects.create(product=self.product, name='a', body='خوب', rating=4, active=True)
        Comment.objects.create(product=self.product, name='b', body='بد', rating=2, active=True)
        # Not counted: unapproved, no score, and a reply that carries a score.
        Comment.objects.create(product=self.product, name='c', body='?', rating=1, active=False)
        question = Comment.objects.create(product=self.product, name='d', body='سوال', active=True)
        Comment.objects.create(product=self.product, name='e', body='پاسخ', parent=question, rating=5, active=True)

        detail = self.client.get(f'/api/products/{self.product.slug}/')
        summary = detail.data['rating_summary']
        self.assertEqual(summary['average'], 3.0)
        self.assertEqual(summary['reviews_count'], 2)
        self.assertEqual(summary['distribution']['4'], 1)
        self.assertEqual(summary['distribution']['2'], 1)

        listing = self.client.get('/api/products/')
        row = next(item for item in listing.data['results'] if item['slug'] == self.product.slug)
        self.assertEqual(row['avg_rating'], 3.0)
        self.assertEqual(row['reviews_count'], 2)

    def test_rating_summary_endpoint(self):
        Comment.objects.create(product=self.product, name='a', body='x', rating=5, active=True)

        response = self.client.get('/api/comments/rating_summary/', {'product': self.product.slug})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['average'], 5.0)
        self.assertEqual(response.data['reviews_count'], 1)

    def test_replies_cannot_carry_a_rating(self):
        parent = Comment.objects.create(product=self.product, name='a', body='سوال', active=True)
        self.client.force_authenticate(self.reviewer)

        response = self.client.post(
            '/api/comments/',
            {'product': self.product.id, 'name': 'بایر', 'body': 'پاسخ', 'parent': parent.id, 'rating': 3},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_products_can_be_sorted_by_rating(self):
        cheap = make_product(self.category, self.author, title='کود ارزان', slug='cheap', price=10_000)
        Comment.objects.create(product=cheap, name='a', body='عالی', rating=5, active=True)

        response = self.client.get('/api/products/', {'ordering': '-avg_rating'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['slug'], 'cheap')

    def test_verified_purchase_flag_follows_a_paid_order(self):
        from .models import Order, OrderItem

        order = Order.objects.create(
            user=self.reviewer, customer_name='بایر', phone='09120000000', province='فارس',
            city='شیراز', address='نشانی', subtotal=1000, total_price=1000, payment_status='paid', status='confirmed',
        )
        OrderItem.objects.create(
            order=order, product=self.product, kind='product', product_title=self.product.title,
            product_slug=self.product.slug, unit_price=1000, quantity=1,
        )
        Comment.objects.create(product=self.product, user=self.reviewer, name='بایر', body='خرید کردم', rating=5, active=True)

        response = self.client.get('/api/comments/by_product/', {'product': self.product.slug})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data[0]['is_verified_purchase'])


@override_settings(SECURE_SSL_REDIRECT=False)
class FacetAndQuoteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(username='seller', password='safe-password-123')
        self.category = Category.objects.create(name='کود', slug='fertilizer')
        self.normal = make_product(self.category, self.author)
        self.other = make_product(
            self.category, self.author, title='هیومیک اسید', slug='humic',
            brand='آگرین', package_weight='۵ کیلوگرم', price=90_000,
        )
        self.quote_only = make_product(
            self.category, self.author, title='کنجاله عمده', slug='bulk-cake',
            price=0, price_on_request=True, package_weight='۱ تن',
        )
        # A draft must not widen the facets.
        make_product(self.category, self.author, title='پیش‌نویس', slug='draft', brand='مخفی', status='draft')

    def test_brand_and_package_filters(self):
        by_brand = self.client.get('/api/products/', {'brand': 'آگرین'})
        self.assertEqual([row['slug'] for row in by_brand.data['results']], ['humic'])
        # The lookup ignores Persian/Latin case and is exact, so a partial brand
        # name must not silently match a longer one.
        self.assertEqual([row['slug'] for row in self.client.get('/api/products/', {'brand': 'آگر'}).data['results']], [])

        by_package = self.client.get('/api/products/', {'package_weight': '۱ تن'})
        self.assertEqual([row['slug'] for row in by_package.data['results']], ['bulk-cake'])

    def test_facets_only_list_published_values(self):
        response = self.client.get('/api/products/facets/')

        self.assertEqual(response.status_code, 200)
        brands = {row['value'] for row in response.data['brands']}
        packages = {row['value'] for row in response.data['package_weights']}
        self.assertEqual(brands, {'رویال', 'آگرین'})
        self.assertEqual(packages, {'۲۵ کیلوگرم', '۵ کیلوگرم', '۱ تن'})
        self.assertEqual(response.data['max_price'], 180_000)

    def test_quote_only_product_is_listed_without_a_cart_path(self):
        row = self.client.get(f'/api/products/{self.quote_only.slug}/')
        self.assertTrue(row.data['price_on_request'])

        add = self.client.post('/api/cart/add/', {'product_id': self.quote_only.id}, format='json')
        self.assertEqual(add.status_code, 409)
        self.assertIn('تماس', add.data['error'])

    def test_price_on_request_filter(self):
        response = self.client.get('/api/products/', {'price_on_request': 'true'})
        self.assertEqual([row['slug'] for row in response.data['results']], ['bulk-cake'])


@override_settings(SECURE_SSL_REDIRECT=False)
class ArticleAndGuideTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        author = User.objects.create_user(username='editor', password='safe-password-123')
        category = Category.objects.create(name='بذر', slug='seed')
        self.product = make_product(category, author, title='بذر گل کلم', slug='cabbage-seed')
        self.guide = SiteArticle.objects.create(
            title='راهنمای کشت گل کلم', slug='grow-cabbage', kind=SiteArticle.KIND_GUIDE,
            excerpt='آب‌وهوا، خاک، کاشت و برداشت', crop='گل کلم', is_published=True,
            body=(
                'مقدمه مقاله.\n\n## آب‌وهوای مناسب\nمتن.\n\n## خاک و آماده‌سازی بستر\nمتن.\n\n'
                '## کاشت\nمتن.\n\n## داشت\nمتن.\n\n## برداشت و نگهداری\nمتن.'
            ),
            author=author,
        )
        self.guide.products.add(self.product)
        self.draft = SiteArticle.objects.create(
            title='پیش‌نویس', slug='draft-article', is_published=False, body='x',
        )

    def test_list_returns_only_published_articles(self):
        response = self.client.get('/api/articles/')

        self.assertEqual(response.status_code, 200)
        slugs = [row['slug'] for row in response.data]
        self.assertEqual(slugs, ['grow-cabbage'])

    def test_detail_exposes_table_of_contents_and_products(self):
        response = self.client.get(f'/api/articles/{self.guide.slug}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [heading['title'] for heading in response.data['headings']],
            ['آب‌وهوای مناسب', 'خاک و آماده‌سازی بستر', 'کاشت', 'داشت', 'برداشت و نگهداری'],
        )
        self.assertEqual(response.data['products'][0]['slug'], 'cabbage-seed')
        self.assertGreaterEqual(response.data['reading_minutes'], 1)

    def test_view_counter_increments_on_detail_only(self):
        self.client.get(f'/api/articles/{self.guide.slug}/')
        self.client.get('/api/articles/')

        self.guide.refresh_from_db()
        self.assertEqual(self.guide.views, 1)

    def test_guides_and_crops_endpoints(self):
        guides = self.client.get('/api/articles/guides/')
        crops = self.client.get('/api/articles/crops/')

        self.assertEqual([row['slug'] for row in guides.data], ['grow-cabbage'])
        self.assertEqual(crops.data, [{'crop': 'گل کلم', 'article_count': 1}])

    def test_limit_param_trims_the_list_without_breaking_filters(self):
        # ``?limit=`` is what the home rails and the product page send; slicing
        # inside get_queryset used to make the later .distinct() raise a 500.
        for _ in range(4):
            SiteArticle.objects.create(
                title='مقاله اضافه', slug=f'extra-{_}', body='متن', is_published=True,
            )

        response = self.client.get('/api/articles/?limit=2')
        guides = self.client.get('/api/articles/guides/?limit=1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(guides.status_code, 200)
        self.assertEqual(len(guides.data), 1)

    def test_product_filter_does_not_duplicate_an_article(self):
        # An article joined to two products of the same category must still be
        # listed once: the ?product= filter goes through an M2M join.
        second = make_product(self.product.category, self.product.author, title='بذر دوم', slug='cabbage-seed-2')
        self.guide.products.add(second)

        response = self.client.get('/api/articles/?product=cabbage-seed')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['slug'] for row in response.data], ['grow-cabbage'])

    def test_related_articles_backfill_from_the_same_kind(self):
        extra = SiteArticle.objects.create(
            title='مقاله دیگر', slug='other-guide', kind=SiteArticle.KIND_GUIDE,
            crop='گل کلم', body='متن', is_published=True,
        )
        response = self.client.get(f'/api/articles/{self.guide.slug}/related/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['slug'] for row in response.data], ['other-guide'])

    def test_unpublished_article_is_a_404(self):
        response = self.client.get(f'/api/articles/{self.draft.slug}/')
        self.assertEqual(response.status_code, 404)


@override_settings(SECURE_SSL_REDIRECT=False)
class ServicePageTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.service = Service.objects.create(
            title='مشاوره زراعی', slug='agronomy', code='agronomy',
            summary='برنامه تغذیه و آفت', body='## مراحل\nمتن',
            highlights='مورد یک\nمورد دو', is_active=True, order=0,
        )
        Service.objects.create(title='غیرفعال', slug='off', code='other', summary='', is_active=False)

    def test_list_and_detail(self):
        listing = self.client.get('/api/services/catalog/')
        self.assertEqual([row['slug'] for row in listing.data], ['agronomy'])

        detail = self.client.get('/api/services/catalog/agronomy/')
        self.assertEqual(detail.data['highlights'], ['مورد یک', 'مورد دو'])

    def test_inactive_service_is_hidden(self):
        self.assertEqual(self.client.get('/api/services/catalog/off/').status_code, 404)


@override_settings(SECURE_SSL_REDIRECT=False)
class SitePageTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.page = SitePage.objects.create(title='شماره حساب‌ها', slug='accounts', kind='page', published=True)
        SitePageBlock.objects.create(page=self.page, block_type='spec_table', title='جدول', rows='a | b\nc | d', position=1)
        SitePageBlock.objects.create(page=self.page, block_type='heading', title='سرِتیتر', position=0)
        self.draft = SitePage.objects.create(title='پیش‌نویس', slug='draft-page', published=False)

    def test_blocks_are_ordered_and_rows_parsed(self):
        response = self.client.get('/api/pages/accounts/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([block['title'] for block in response.data['blocks']], ['سرِتیتر', 'جدول'])
        self.assertEqual(response.data['blocks'][1]['rows'], [['a', 'b'], ['c', 'd']])

    def test_unpublished_page_is_hidden(self):
        self.assertEqual(self.client.get('/api/pages/draft-page/').status_code, 404)

    def test_pages_can_be_filtered_by_kind(self):
        SitePage.objects.create(title='لندینگ', slug='offer-compost', kind='landing', published=True)
        response = self.client.get('/api/pages/', {'kind': 'landing'})
        self.assertEqual([row['slug'] for row in response.data], ['offer-compost'])


@override_settings(SECURE_SSL_REDIRECT=False)
class SiteInfoAndNewsletterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        author = User.objects.create_user(username='seller', password='safe-password-123')
        category = Category.objects.create(name='کود', slug='fertilizer')
        make_product(category, author)
        user = User.objects.create_user(username='grower', password='safe-password-123')
        Storefront.objects.create(user=user, name='غرفه سبز', slug='green', province='فارس', is_active=True)
        TeamMember.objects.create(name='مهندس رضایی', role='کارشناس ارشد تغذیه گیاه', order=0)
        BrandPartner.objects.create(name='رویال کشت', order=0)

    def test_contact_endpoint_reflects_the_admin_record(self):
        contact = SiteContact.load()
        contact.address = 'تهران، خیابان نمونه'
        contact.phones = '021-88000000\n09120000000'
        contact.emails = 'info@example.test'
        contact.save()

        response = self.client.get('/api/site/contact/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['phones'], ['021-88000000', '09120000000'])
        self.assertEqual(response.data['emails'], ['info@example.test'])

    def test_about_endpoint_counts_real_rows(self):
        response = self.client.get('/api/site/about/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['team']), 1)
        self.assertEqual(len(response.data['brands']), 1)
        self.assertEqual(response.data['stats']['products'], 1)
        self.assertEqual(response.data['stats']['storefronts'], 1)

    def test_newsletter_subscription_is_idempotent(self):
        first = self.client.post(
            '/api/newsletter/subscribe/', {'email': 'grower@example.test', 'source': 'footer'}, format='json'
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(NewsletterSubscriber.objects.count(), 1)

        again = self.client.post('/api/newsletter/subscribe/', {'email': 'grower@example.test'}, format='json')
        self.assertEqual(again.status_code, 201)
        self.assertEqual(NewsletterSubscriber.objects.count(), 1)

    def test_newsletter_requires_one_channel(self):
        response = self.client.post('/api/newsletter/subscribe/', {'topics': 'کود'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_newsletter_unsubscribe_deactivates(self):
        NewsletterSubscriber.objects.create(email='grower@example.test', mobile='09120000000')

        response = self.client.post('/api/newsletter/unsubscribe/', {'email': 'grower@example.test'}, format='json')

        self.assertEqual(response.status_code, 200)
        subscriber = NewsletterSubscriber.objects.get(email='grower@example.test')
        self.assertFalse(subscriber.is_active)


@override_settings(SECURE_SSL_REDIRECT=False)
class ListingAttributeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='grower', password='safe-password-123')
        self.storefront = Storefront.objects.create(user=self.seller, name='غرفه', slug='ghorfe')
        self.listing = MarketplaceListing.objects.create(
            storefront=self.storefront, title='گوجه تازه', slug='tomato', crop_name='گوجه',
            description='سالم', price=50_000, unit='کیلوگرم', quantity_available=100,
            min_order_quantity=1, status='published',
        )

    def test_seller_can_write_spec_rows_and_blanks_are_hidden(self):
        self.client.force_authenticate(self.seller)

        response = self.client.post(
            '/api/marketplace/listings/',
            {
                'title': 'خیار گلخانه', 'crop_name': 'خیار', 'description': 'تازه',
                'price': 40_000, 'unit': 'کیلوگرم', 'quantity_available': 50,
                'min_order_quantity': 1,
                'attributes': [
                    {'label': 'بسته‌بندی', 'value': 'کارتن ۱۰ کیلوگرم', 'order': 0},
                    {'label': 'رنگ', 'value': '', 'order': 1},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([row['label'] for row in response.data['attributes']], ['بسته‌بندی'])
        self.assertEqual(ListingAttribute.objects.count(), 2)

    def test_attributes_are_updated_by_replacing_the_set(self):
        ListingAttribute.objects.create(listing=self.listing, label='قدیم', value='۱', order=0)
        self.client.force_authenticate(self.seller)

        response = self.client.patch(
            f'/api/marketplace/listings/{self.listing.slug}/',
            {'attributes': [{'label': 'جدید', 'value': '۲', 'order': 0}]},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row['label'] for row in response.data['attributes']], ['جدید'])
        self.assertFalse(ListingAttribute.objects.filter(label='قدیم').exists())


@override_settings(SECURE_SSL_REDIRECT=False)
class SitemapContentTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_content_routes_are_indexed(self):
        SiteArticle.objects.create(
            title='راهنمای پیاز', slug='grow-onion', kind=SiteArticle.KIND_GUIDE,
            body='x', is_published=True,
        )
        Service.objects.create(title='آبیاری', slug='irrigation', code='irrigation', summary='', is_active=True)
        SitePage.objects.create(title='محیط زیست', slug='environment', kind='page', published=True)

        response = self.client.get('/sitemap.xml')

        body = response.content.decode()
        self.assertIn('/guides/grow-onion', body)
        self.assertIn('/services/irrigation', body)
        self.assertIn('/page/environment', body)
        self.assertIn('/blog', body)
