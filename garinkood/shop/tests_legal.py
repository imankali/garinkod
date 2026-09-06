"""Tests for the legal documents: the registry, the admin override, the
published hub/sitemap surface, the seeder's respect for edits, and the
acceptance record an order carries."""

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import legal
from .models import (
    Category, Order, Product, SitePage, SitePageBlock, User,
)


class LegalRegistryTests(TestCase):
    def test_every_document_is_complete_and_reachable(self):
        docs = legal.documents()
        self.assertGreaterEqual(len(docs), 6)
        seen = set()
        for doc in docs:
            with self.subTest(slug=doc.slug):
                self.assertNotIn(doc.slug, seen, 'duplicate legal slug would hide a document')
                seen.add(doc.slug)
                self.assertTrue(doc.title.strip())
                self.assertIn(doc.group, legal.GROUP_LABELS)
                self.assertTrue(doc.summary.strip())
                self.assertGreaterEqual(len(doc.sections), 3, 'a legal page of one paragraph is not a policy')
                for heading, body in doc.sections:
                    self.assertTrue(heading.strip())
                    self.assertGreater(len(body.strip()), 80)
                # The URL the frontend links to must resolve to this document.
                self.assertIs(legal.get(doc.slug), doc)

    def test_legacy_routes_still_point_at_a_real_document(self):
        for path, slug in legal.LEGACY_ROUTES.items():
            with self.subTest(path=path):
                self.assertIsNotNone(legal.get(slug))

    def test_version_is_stable_and_moves_with_the_text(self):
        before = legal.legal_version()
        self.assertEqual(before, legal.legal_version())

        doc = legal.documents()[0]
        SitePage.objects.create(slug=doc.slug, kind=SitePage.KIND_PAGE, title=doc.title, published=True)
        SitePageBlock.objects.create(page_id=SitePage.objects.get(slug=doc.slug).pk, block_type='text', text='متن اول')
        after = legal.legal_version()
        self.assertNotEqual(before, after, 'publishing different text must change the fingerprint')

        block = SitePageBlock.objects.first()
        block.text = 'متن دوم، متفاوت'
        block.save()
        self.assertNotEqual(after, legal.legal_version(), 'an edit is a new version')

    def test_cited_figures_come_from_the_code_that_enforces_them(self):
        """The loyalty page quotes the reward rule; it must quote the real one."""
        from .rewards import LOYALTY_MAX_REWARD, LOYALTY_PERCENT
        from .settlements import SELLER_HOLD_DAYS

        loyalty = legal.get('loyalty')
        body = '\n'.join(f'{head}\n{text}' for head, text in loyalty.sections)
        self.assertIn(f'{LOYALTY_PERCENT} درصد', body)
        self.assertIn(f'{LOYALTY_MAX_REWARD:,}', body)

        returns = '\n'.join(text for _head, text in legal.get('returns').sections)
        marketplace = '\n'.join(text for _head, text in legal.get('marketplace').sections)
        self.assertIn(str(SELLER_HOLD_DAYS), returns)
        self.assertIn(str(SELLER_HOLD_DAYS), marketplace)


class LegalApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_index_is_public_and_lists_every_document(self):
        response = self.client.get('/api/legal/')
        self.assertEqual(response.status_code, 200)
        slugs = {row['slug'] for row in response.data['documents']}
        self.assertEqual(slugs, {doc.slug for doc in legal.documents()})
        self.assertTrue(response.data['version'].startswith('GK-'))
        # The hub groups its cards; a group with no document would render empty.
        for group in response.data['groups']:
            self.assertTrue(group['items'])

    def test_document_falls_back_to_the_shipped_text(self):
        response = self.client.get('/api/legal/returns/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'code')
        self.assertIsNone(response.data['updated_at'])
        self.assertGreaterEqual(len(response.data['sections']), 3)
        self.assertEqual(response.data['blocks'], [])

    def test_unknown_slug_is_a_404_not_an_empty_page(self):
        self.assertEqual(self.client.get('/api/legal/not-a-document/').status_code, 404)

    def test_published_page_replaces_the_fallback(self):
        page = SitePage.objects.create(
            slug='privacy', kind=SitePage.KIND_PAGE, title='حریم خصوصی (نسخه آزمایشی)',
            hero_text='خلاصه‌ای که تیم نوشته', published=True,
        )
        SitePageBlock.objects.create(page=page, block_type='text', title='بخش اول', text='متن اول', position=20)
        SitePageBlock.objects.create(page=page, block_type='bullets', title='فهرست', text='یک\nدو', position=10)
        SitePageBlock.objects.create(
            page=page, block_type='price_table', title='جدول', text='a|b', rows='1|2', position=30,
        )

        data = self.client.get('/api/legal/privacy/').data
        self.assertEqual(data['source'], 'page')
        self.assertEqual(data['title'], 'حریم خصوصی (نسخه آزمایشی)')
        self.assertEqual(data['summary'], 'خلاصه‌ای که تیم نوشته')
        self.assertEqual(data['sections'], [])
        # Blocks arrive in the admin's own order, and a table is not legal prose.
        self.assertEqual([block['title'] for block in data['blocks']], ['فهرست', 'بخش اول'])
        self.assertEqual(data['updated_at'][:4], str(page.updated_at.year))

    def test_unpublished_page_does_not_take_over(self):
        page = SitePage.objects.create(slug='terms', kind=SitePage.KIND_PAGE, title='پیش‌نویس', published=False)
        SitePageBlock.objects.create(page=page, block_type='text', title='محرمانه', text='هنوز آماده نیست')
        data = self.client.get('/api/legal/terms/').data
        self.assertEqual(data['source'], 'code')
        self.assertNotIn('محرمانه', str(data))


@override_settings(SECURE_SSL_REDIRECT=False)
class LegalSeederTests(TestCase):
    def _page_count(self):
        return SitePage.objects.filter(slug__in=[doc.slug for doc in legal.documents()]).count()

    def test_seeder_creates_editable_pages_and_ignores_nothing_on_rerun(self):
        call_command('seed_legal_pages', verbosity=0)
        pages = self._page_count()
        blocks = SitePageBlock.objects.count()
        self.assertEqual(pages, len(legal.documents()))
        self.assertEqual(blocks, sum(len(doc.sections) for doc in legal.documents()))
        for page in SitePage.objects.filter(slug__in=[doc.slug for doc in legal.documents()]):
            self.assertTrue(page.published, 'a legal page nobody can read is no page at all')

        call_command('seed_legal_pages', verbosity=0)
        self.assertEqual((self._page_count(), SitePageBlock.objects.count()), (pages, blocks))

    def test_an_admin_edit_survives_the_next_seed_run(self):
        call_command('seed_legal_pages', verbosity=0)
        block = SitePageBlock.objects.filter(page__slug='returns').first()
        block.text = 'متنی که تیم حقوقی با دست نوشته است.'
        block.save()

        call_command('seed_legal_pages', verbosity=0)
        block.refresh_from_db()
        self.assertEqual(block.text, 'متنی که تیم حقوقی با دست نوشته است.')

        # ``--force`` is the explicit way back to the shipped text.
        call_command('seed_legal_pages', '--force', verbosity=0)
        reopened = SitePageBlock.objects.filter(page__slug='returns').order_by('position').first()
        self.assertNotEqual(reopened.text, 'متنی که تیم حقوقی با دست نوشته است.')

    def test_dry_run_writes_nothing(self):
        call_command('seed_legal_pages', '--dry-run', verbosity=0)
        self.assertEqual(self._page_count(), 0)


@override_settings(SECURE_SSL_REDIRECT=False)
class OrderAcceptanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        category = Category.objects.create(name='کود', slug='legal-fertilizer')
        self.product = Product.objects.create(
            title='کود حقوقی', slug='legal-checkout-product', author=User.objects.create_user('legal-seller'),
            category=category, description='برای آزمون ثبت پذیرش شرایط', status='published',
            price=400_000, stock=5, available=True,
        )

    def test_checkout_records_when_and_under_which_text(self):
        self.client.post('/api/cart/add/', {'product_id': self.product.id, 'quantity': 1}, format='json')
        response = self.client.post(
            '/api/orders/checkout/',
            {
                'customer_name': 'کشاورز', 'phone': '09120000000', 'province': 'فارس',
                'city': 'شیراز', 'address': 'خیابان نمونه', 'payment_method': 'coordination',
                'terms_accepted': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(pk=response.data['order']['id'])
        self.assertIsNotNone(order.terms_accepted_at)
        self.assertEqual(order.legal_version, legal.legal_version())
        self.assertIn('legal_version', response.data['order'])
        self.assertIn('terms_accepted_at', response.data['order'])


@override_settings(SECURE_SSL_REDIRECT=False)
class LegalSeoTests(TestCase):
    def test_sitemap_lists_the_canonical_legal_pages(self):
        response = self.client.get('/sitemap.xml')
        body = response.content.decode()
        self.assertIn('/legal', body)
        for doc in legal.documents():
            self.assertIn(f'/legal/{doc.slug}', body)

    def test_llms_guide_points_at_the_legal_hub(self):
        body = self.client.get('/llms.txt').content.decode()
        self.assertIn('/legal', body)
