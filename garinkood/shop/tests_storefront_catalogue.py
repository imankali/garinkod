"""Ads filed in the catalogue's own taxonomy, and the filter bar that reads it.

The storefront tab of the shop is only as good as the rows it can filter, so these
tests pin the parts that make one filter bar serve both sources: a seller filing an
ad under a department and a subcategory, the filter grammar that accepts several
values at once, the facets that narrow the brand list to the chosen department, and
the identity a seller has to declare before opening a stall.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .catalog_classify import classify
from .models import (
    Category, FarmConsultationRequest, FarmLand, MarketplaceListing, Storefront,
    StorefrontConversation, StorefrontMessage, StorefrontPost, SubCategory, Tag,
    UserAccount,
)

VALID_NATIONAL_ID = '3971857299'


def make_seller(username='filer', *, with_identity=True):
    user = User.objects.create_user(username=username, password='safe-password-123')
    if with_identity:
        user.first_name = 'زهرا'
        user.last_name = 'بهاران'
        user.save(update_fields=['first_name', 'last_name'])
        account = UserAccount.objects.get(user=user)
        account.national_id = VALID_NATIONAL_ID
        account.save(update_fields=['national_id'])
    storefront = Storefront.objects.create(
        user=user, name=f'غرفه {username}', slug=f'ghorfe-{username}',
        province='فارس', city='شیراز',
    )
    return user, storefront


def make_catalog():
    """Two departments, one of them only the marketplace trades in.

    ``update_or_create`` because the produce departments already exist: migration
    0043 files them, and the tests that classify an ad into «محصولات گلخانه‌ای»
    are asserting against the very tree the migration created.
    """
    fertilizer, _ = Category.objects.update_or_create(
        slug='fertilizer', defaults={'name': 'کود کشاورزی', 'storefront_only': False}
    )
    npk, _ = SubCategory.objects.update_or_create(
        slug='npk', defaults={'name': 'کود NPK', 'category': fertilizer}
    )
    produce, _ = Category.objects.update_or_create(
        slug='greenhouse-produce',
        defaults={'name': 'محصولات گلخانه‌ای', 'storefront_only': True},
    )
    tomato, _ = SubCategory.objects.update_or_create(
        slug='tomato-cucumber', defaults={'name': 'گوجه و خیار', 'category': produce}
    )
    return fertilizer, npk, produce, tomato


def make_ad(storefront, *, title='گندم درجه یک', category=None, subcategory=None,
             brand='', package_size='', is_stock=False, discount=0, status='published',
             price=100_000, quantity=Decimal('50'), views=0, sales=0):
    return MarketplaceListing.objects.create(
        storefront=storefront, title=title, slug=f'ad-{title}-{storefront.id}-{category}',
        crop_name='گندم', description='محصول سالم و تازه', price=price, unit='کیلوگرم',
        quantity_available=quantity, min_order_quantity=Decimal('1'), status=status,
        category=category, subcategory=subcategory, brand=brand, package_size=package_size,
        is_stock=is_stock, discount_percent=discount, views=views, sales_count=sales,
    )


@override_settings(SECURE_SSL_REDIRECT=False)
class AdCatalogueFilingTests(TestCase):
    """A seller picks a department the same way a manager files a product."""

    def setUp(self):
        self.client = APIClient()
        self.user, self.storefront = make_seller()
        self.fertilizer, self.npk, self.produce, self.tomato = make_catalog()
        self.client.force_authenticate(user=self.user)

    def _payload(self, **overrides):
        payload = {
            'title': 'کود کامل ۲۰-۲۰-۲۰', 'crop_name': 'کود', 'description': 'بسته ۵۰ کیلویی',
            'price': 250000, 'unit': 'کیسه', 'quantity_available': '40', 'min_order_quantity': '1',
        }
        payload.update(overrides)
        return payload

    def test_seller_files_ad_under_category_and_subcategory(self):
        response = self.client.post('/api/marketplace/listings/', {
            **self._payload(),
            'category': 'fertilizer', 'subcategory': 'npk',
            'brand': 'روی‌آگرو', 'package_size': 'گونی ۵۰ کیلویی', 'is_stock': True,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        listing = MarketplaceListing.objects.get(pk=response.data['id'])
        self.assertEqual(listing.category_id, self.fertilizer.id)
        self.assertEqual(listing.subcategory_id, self.npk.id)
        self.assertTrue(listing.is_stock)
        self.assertEqual(listing.brand_slug, 'روی-اگرو')
        self.assertEqual(response.data['category_name'], 'کود کشاورزی')
        self.assertEqual(response.data['subcategory_name'], 'کود NPK')

    def test_subcategory_alone_inherits_its_department(self):
        response = self.client.post(
            '/api/marketplace/listings/',
            self._payload(subcategory='tomato-cucumber'),
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        listing = MarketplaceListing.objects.get(pk=response.data['id'])
        self.assertEqual(listing.category_id, self.produce.id)

    def test_mismatched_pair_is_rejected(self):
        response = self.client.post('/api/marketplace/listings/', self._payload(
            category='fertilizer', subcategory='tomato-cucumber',
        ), format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('subcategory', response.data['fields'])

    def _ensure_department(self, slug, name):
        return Category.objects.update_or_create(
            slug=slug, defaults={'name': name, 'storefront_only': False}
        )[0]

    def test_unfiled_ad_is_classified_from_its_title(self):
        """Nobody can filter an ad out of a department it was never filed in.

        The composer offers the pickers, but a seller who skips them still gets a
        findable ad — the keywords decide, and only when the seller stayed silent.
        """
        self._ensure_department('pesticide', 'سموم و آفت‌کش‌ها')
        response = self.client.post(
            '/api/marketplace/listings/', self._payload(title='سم مالاتیون ۵۷ درصد'), format='json'
        )
        self.assertEqual(response.status_code, 201, response.data)
        listing = MarketplaceListing.objects.get(pk=response.data['id'])
        self.assertEqual(listing.category.slug, 'pesticide')

    def test_sellers_choice_beats_the_classifier(self):
        response = self.client.post(
            '/api/marketplace/listings/',
            self._payload(title='سم مالاتیون ۵۷ درصد', category='fertilizer'),
            format='json',
        )
        listing = MarketplaceListing.objects.get(pk=response.data['id'])
        self.assertEqual(listing.category_id, self.fertilizer.id)

    def test_discount_is_the_sellers_own_and_capped(self):
        allowed = self.client.post(
            '/api/marketplace/listings/', self._payload(discount_percent=20), format='json'
        )
        self.assertEqual(allowed.status_code, 201, allowed.data)
        self.assertEqual(allowed.data['discount_percent'], 20)
        self.assertEqual(allowed.data['discounted_price'], 200000)

        absurd = self.client.post(
            '/api/marketplace/listings/', self._payload(discount_percent=95), format='json'
        )
        self.assertEqual(absurd.status_code, 400)
        self.assertIn('discount_percent', absurd.data['fields'])


@override_settings(SECURE_SSL_REDIRECT=False)
class AdFilterGrammarTests(TestCase):
    """One filter grammar for both catalogue sources, multi-value included."""

    def setUp(self):
        self.client = APIClient()
        _buyer, first = make_seller('filter-a')
        _other, second = make_seller('filter-b')
        self.fertilizer, self.npk, self.produce, self.tomato = make_catalog()
        self.irrigation, _ = Category.objects.update_or_create(
            slug='irrigation', defaults={'name': 'آبیاری', 'storefront_only': False}
        )
        self.drip, _ = SubCategory.objects.update_or_create(
            slug='drip-irrigation', defaults={'name': 'قطره‌ای', 'category': self.irrigation}
        )

        self.urea = make_ad(first, title='اوره', category=self.fertilizer, brand='آگروفام',
                            package_size='گونی ۵۰ کیلویی')
        self.npk_ad = make_ad(first, title='NPK', category=self.npk and self.fertilizer,
                              subcategory=self.npk, brand='روی‌آگرو', discount=25)
        self.tomato_ad = make_ad(second, title='گوجه گلخانه‌ای', category=self.produce,
                                subcategory=self.tomato, views=40, sales=3)
        self.drip_ad = make_ad(second, title='نوار قطره‌ای', category=self.irrigation,
                               subcategory=self.drip, is_stock=True, views=90)
        make_ad(second, title='آگهی بررسی‌نشده', category=self.fertilizer, status='pending_review')

    def _slugs(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        return {row['slug'] for row in response.data['results']}

    def test_department_includes_ads_filed_under_its_subcategory(self):
        response = self.client.get('/api/marketplace/listings/?category=fertilizer')
        self.assertEqual(self._slugs(response), {self.urea.slug, self.npk_ad.slug})

    def test_two_departments_at_once(self):
        response = self.client.get('/api/marketplace/listings/?category=irrigation,fertilizer')
        self.assertEqual(
            self._slugs(response),
            {self.urea.slug, self.npk_ad.slug, self.drip_ad.slug},
        )

    def test_two_brands_and_two_packages_at_once(self):
        both_brands = self.client.get('/api/marketplace/listings/?brand=آگروفام,روی‌آگرو')
        self.assertEqual(self._slugs(both_brands), {self.urea.slug, self.npk_ad.slug})

        both_packages = self.client.get(
            '/api/marketplace/listings/?package_size=گونی ۵۰ کیلویی,کارتن ۱۰ کیلویی'
        )
        self.assertEqual(self._slugs(both_packages), {self.urea.slug})

    def test_stock_discount_and_fresh_are_three_different_questions(self):
        self.assertEqual(
            self._slugs(self.client.get('/api/marketplace/listings/?stock=1')), {self.drip_ad.slug}
        )
        self.assertEqual(
            self._slugs(self.client.get('/api/marketplace/listings/?stock=0')),
            {self.urea.slug, self.npk_ad.slug, self.tomato_ad.slug},
        )
        self.assertEqual(
            self._slugs(self.client.get('/api/marketplace/listings/?has_discount=1')),
            {self.npk_ad.slug},
        )

    def test_most_viewed_sorting_and_view_counting(self):
        ordered = self.client.get('/api/marketplace/listings/?ordering=-views')
        self.assertEqual(
            [row['slug'] for row in ordered.data['results']][:2],
            [self.drip_ad.slug, self.tomato_ad.slug],
        )
        # A combined sort is a real query, not a wish: cheapest first, then the
        # one that sold best.
        combined = self.client.get('/api/marketplace/listings/?ordering=-views,sales_count')
        self.assertEqual(combined.status_code, 200)

        before = MarketplaceListing.objects.get(pk=self.urea.pk).views
        self.client.get(f'/api/marketplace/listings/{self.urea.slug}/')
        self.assertEqual(MarketplaceListing.objects.get(pk=self.urea.pk).views, before + 1)

    def test_facets_narrow_the_brand_list_to_the_chosen_department(self):
        everything = self.client.get('/api/marketplace/listings/facets/')
        self.assertEqual(everything.status_code, 200)
        self.assertEqual(
            {row['value'] for row in everything.data['brands']}, {'آگروفام', 'روی‌آگرو'}
        )

        fertilizer_only = self.client.get('/api/marketplace/listings/facets/?category=fertilizer')
        self.assertEqual(
            {row['value'] for row in fertilizer_only.data['brands']}, {'آگروفام', 'روی‌آگرو'}
        )
        irrigation_only = self.client.get('/api/marketplace/listings/facets/?category=irrigation')
        self.assertEqual({row['value'] for row in irrigation_only.data['brands']}, set())
        # The department list is never narrowed by its own selection, so a buyer
        # can always see what else they could add.
        self.assertEqual(
            {row['value'] for row in irrigation_only.data['categories']},
            {'fertilizer', 'irrigation', 'greenhouse-produce'},
        )
        counts = {row['value']: row['count'] for row in everything.data['categories']}
        self.assertEqual(counts['fertilizer'], 2)

    def test_facets_offer_the_subcategories_of_the_selected_department(self):
        response = self.client.get('/api/marketplace/listings/facets/?category=fertilizer')
        rows = {row['value']: row for row in response.data['subcategories']}
        self.assertIn('npk', rows)
        self.assertNotIn('drip', rows)
        self.assertEqual(rows['npk']['category'], 'fertilizer')


@override_settings(SECURE_SSL_REDIRECT=False)
class CategoryScopeTests(TestCase):
    """The warehouse grid and the storefront composer ask for two different lists."""

    def setUp(self):
        self.client = APIClient()
        self.fertilizer, self.npk, self.produce, self.tomato = make_catalog()

    def test_storefront_only_departments_are_kept_out_of_the_warehouse_grid(self):
        slugs = {row['slug'] for row in self.client.get('/api/categories/').data['results']}
        self.assertIn('fertilizer', slugs)
        self.assertNotIn('greenhouse-produce', slugs)

    def test_marketplace_scope_offers_the_whole_tree(self):
        slugs = {
            row['slug'] for row in self.client.get('/api/categories/?scope=marketplace').data['results']
        }
        self.assertIn('fertilizer', slugs)
        self.assertIn('greenhouse-produce', slugs)
        self.assertIn('orchard', slugs)

    def test_the_fresh_departments_exist_in_the_database(self):
        """Migration 0043 files the produce departments the ads are sorted into."""
        stocked = set(
            Category.objects.filter(
                slug__in=['greenhouse-produce', 'orchard', 'nuts-dried', 'grain-pulse', 'livestock-feed']
            ).values_list('slug', flat=True)
        )
        self.assertEqual(
            stocked,
            {'greenhouse-produce', 'orchard', 'nuts-dried', 'grain-pulse', 'livestock-feed'},
        )
        # …and none of them may show up as an empty tile in the warehouse grid.
        self.assertFalse(
            Category.objects.filter(slug__in=stocked, storefront_only=False).exists()
        )


@override_settings(SECURE_SSL_REDIRECT=False)
class CatalogClassifyTests(TestCase):
    def setUp(self):
        self.fertilizer, self.npk, self.produce, self.tomato = make_catalog()

    def test_titles_are_filed_by_keyword(self):
        for slug, name in (
            ('pesticide', 'سموم و آفت‌کش‌ها'), ('irrigation', 'آبیاری'),
            ('livestock-feed', 'خوراک دام و طیور'),
        ):
            Category.objects.update_or_create(slug=slug, defaults={'name': name})
        self.assertEqual(classify('سم مالاتیون ۵۷ درصد', '')[0].slug, 'pesticide')
        self.assertEqual(classify('نوار آبیاری قطره‌ای', '')[0].slug, 'irrigation')
        self.assertEqual(classify('گوجه فرنگی گلخانه‌ای درجه یک', '')[0].slug, 'greenhouse-produce')
        self.assertEqual(classify('جوجه یک روزه', '')[0].slug, 'livestock-feed')

    def test_nothing_is_invented_when_the_words_do_not_match(self):
        category, _sub = classify('علائم نابسته', '')
        self.assertIsNone(category)


@override_settings(SECURE_SSL_REDIRECT=False)
class StorefrontMessagePostAttachmentTests(TestCase):
    """«گفتگو با غرفه‌دار» on a post carries the post, not a screenshot of it."""

    def setUp(self):
        self.client = APIClient()
        self.seller, self.storefront = make_seller('attach-seller')
        self.buyer = User.objects.create_user(username='attach-buyer', password='safe-password-123')
        self.post = StorefrontPost.objects.create(
            storefront=self.storefront, post_type='post', status='published',
            caption='برداشت این هفته',
        )
        self.conversation = StorefrontConversation.objects.create(
            storefront=self.storefront, customer=self.buyer
        )
        self.other_seller, self.other_storefront = make_seller('attach-other')
        self.foreign_post = StorefrontPost.objects.create(
            storefront=self.other_storefront, post_type='post', status='published', caption='یکی دیگر'
        )

    def _post_message(self, user, data):
        self.client.force_authenticate(user=user)
        return self.client.post(
            f'/api/marketplace/conversations/{self.conversation.id}/messages/', data, format='json'
        )

    def test_a_post_from_the_threads_storefront_travels_with_the_message(self):
        response = self._post_message(self.buyer, {'body': 'این رو توضیح می‌دید؟', 'post': self.post.id})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['post']['id'], self.post.id)
        self.assertEqual(response.data['post']['caption'], 'برداشت این هفته')
        message = StorefrontMessage.objects.get(pk=response.data['id'])
        self.assertEqual(message.post_id, self.post.id)

    def test_somebody_elses_post_is_rejected(self):
        response = self._post_message(self.buyer, {'body': 'فلان پست', 'post': self.foreign_post.id})
        self.assertEqual(response.status_code, 400)

    def test_a_post_alone_is_a_message(self):
        response = self._post_message(self.seller, {'post': self.post.id})
        self.assertEqual(response.status_code, 201, response.data)


@override_settings(SECURE_SSL_REDIRECT=False)
class ConsultationThreadSyncTests(TestCase):
    """A consultation and its chat are one conversation seen from two entrances."""

    def setUp(self):
        self.client = APIClient()
        self.farmer = User.objects.create_user(username='farmer-sync', password='safe-password-123')
        self.land = FarmLand.objects.create(
            owner=self.farmer, name='باغ شمالی', land_type='orchard',
            area=Decimal('2.00'), area_unit='hectare',
        )
        self.consultant = User.objects.create_user(username='consultant-sync', password='safe-password-123')
        # Written through the *cached* profile and then re-read: the permission
        # gate looks the account up on the request's user object, and a stale
        # in-memory copy is how a level test silently ends up 403.
        self.consultant.account.level = UserAccount.LEVEL_MODERATOR
        self.consultant.account.save(update_fields=['level'])
        # Reading a farmer's consulting thread is what makes somebody staff on
        # the desk, so the model permission — not only the ladder level — has to
        # be on the account for the chat side to open.
        from django.contrib.auth.models import Permission

        self.consultant.user_permissions.add(
            Permission.objects.get(codename='view_farmconsultationrequest')
        )
        self.consultant.refresh_from_db()
        self.farmer.refresh_from_db()

    def _file_request(self):
        self.client.force_authenticate(user=self.farmer)
        return self.client.post('/api/farm/consultations/', {
            'land_id': self.land.id, 'subject': 'pest', 'message': 'شاخه‌ها زرد شده‌اند، چه کنم؟',
        }, format='json')

    def test_filing_a_request_opens_the_thread_with_the_question(self):
        response = self._file_request()
        self.assertEqual(response.status_code, 201, response.data)
        conversation_id = response.data['conversation_id']
        self.assertIsNotNone(conversation_id)

        conversation = StorefrontConversation.objects.get(pk=conversation_id)
        self.assertEqual(conversation.channel, 'consulting')
        first = conversation.messages.order_by('created_at').first()
        self.assertEqual(first.body, 'شاخه‌ها زرد شده‌اند، چه کنم؟')
        self.assertEqual(first.land_id, self.land.id)

        # The same request, saved again, must not post the question twice.
        consultation = FarmConsultationRequest.objects.get(pk=response.data['id'])
        consultation.save()
        from .consultations import open_consultation_thread

        open_consultation_thread(consultation)
        self.assertEqual(conversation.messages.count(), 1)

    def test_an_answer_typed_in_the_panel_reaches_the_messenger(self):
        created = self._file_request()
        conversation = StorefrontConversation.objects.get(pk=created.data['conversation_id'])
        consultation = FarmConsultationRequest.objects.get(pk=created.data['id'])

        self.client.force_authenticate(user=self.consultant)
        reply = self.client.patch(
            f'/api/farm/consulting/requests/{consultation.id}/reply/',
            {'reply': 'زنگی‌زدگی است؛ محلول گوگرد اسپری کنید.'},
            format='json',
        )
        self.assertEqual(reply.status_code, 200, reply.data)
        message = conversation.messages.order_by('-created_at').first()
        self.assertEqual(message.body, 'زنگی‌زدگی است؛ محلول گوگرد اسپری کنید.')
        self.assertEqual(message.sender_id, self.consultant.id)

    def test_an_answer_typed_in_the_chat_closes_the_pending_request(self):
        created = self._file_request()
        conversation = StorefrontConversation.objects.get(pk=created.data['conversation_id'])
        consultation = FarmConsultationRequest.objects.get(pk=created.data['id'])

        self.client.force_authenticate(user=self.consultant)
        response = self.client.post(
            f'/api/marketplace/conversations/{conversation.id}/messages/',
            {'body': 'گوگرد کافی است، هفته بعد دوباره بفرستید.'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['answered_consultations'], [consultation.id])

        consultation.refresh_from_db()
        self.assertEqual(consultation.status, 'answered')
        self.assertIn('گوگرد کافی است', consultation.reply)
        self.assertEqual(consultation.replied_by_id, self.consultant.id)

    def test_the_farmers_own_follow_up_does_not_answer_itself(self):
        created = self._file_request()
        conversation = StorefrontConversation.objects.get(pk=created.data['conversation_id'])
        consultation = FarmConsultationRequest.objects.get(pk=created.data['id'])

        self.client.force_authenticate(user=self.farmer)
        response = self.client.post(
            f'/api/marketplace/conversations/{conversation.id}/messages/',
            {'body': 'یک عکس هم فرستادم.'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn('answered_consultations', response.data)
        consultation.refresh_from_db()
        self.assertEqual(consultation.status, 'pending')


@override_settings(SECURE_SSL_REDIRECT=False)
class ProductFilterMultiValueTests(TestCase):
    """The catalogue's own filters take several values, like the ad filters do."""

    def setUp(self):
        self.client = APIClient()
        self.fertilizer, self.npk, self.produce, self.tomato = make_catalog()
        self.irrigation, _ = Category.objects.update_or_create(
            slug='irrigation', defaults={'name': 'آبیاری', 'storefront_only': False}
        )
        author = User.objects.create_user(username='writer', password='safe-password-123')
        self.a = self._product(author, 'اوره', self.fertilizer, brand='آگروفام', package='گونی ۵۰ کیلویی', price=900)
        self.b = self._product(author, 'NPK', self.fertilizer, self.npk, brand='روی‌آگرو', package='گونی ۲۵ کیلویی', price=1200)
        self.c = self._product(author, 'سیستم قطره‌ای', self.irrigation, brand='آگروفام', package='کارتن ۱۰ کیلویی', price=700)

    def _product(self, author, title, category, subcategory=None, *, brand='', package='', price=100):
        from .models import Product

        return Product.objects.create(
            author=author, title=title, slug=f'p-{title}', description='توضیح',
            price=price, stock=10, category=category, subcategory=subcategory,
            brand=brand, package_weight=package, status='published',
        )

    def _slugs(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        return {row['slug'] for row in response.data['results']}

    def test_two_departments(self):
        self.assertEqual(
            self._slugs(self.client.get('/api/products/?category=fertilizer,irrigation')),
            {self.a.slug, self.b.slug, self.c.slug},
        )

    def test_two_brands_and_two_packages(self):
        self.assertEqual(
            self._slugs(self.client.get('/api/products/?brand=آگروفام,روی‌آگرو')),
            {self.a.slug, self.b.slug, self.c.slug},
        )
        self.assertEqual(
            self._slugs(self.client.get('/api/products/?package_weight=گونی ۵۰ کیلویی,کارتن ۱۰ کیلویی')),
            {self.a.slug, self.c.slug},
        )

    def test_facets_are_scoped_to_the_selected_department(self):
        all_brands = self.client.get('/api/products/facets/').data['brands']
        self.assertEqual({row['value'] for row in all_brands}, {'آگروفام', 'روی‌آگرو'})

        only_irrigation = self.client.get('/api/products/facets/?category=irrigation').data['brands']
        self.assertEqual({row['value'] for row in only_irrigation}, {'آگروفام'})
        # …while the department list itself stays complete.
        self.assertEqual(
            {row['value'] for row in self.client.get('/api/products/facets/?category=irrigation').data['categories']},
            {'irrigation', 'fertilizer'},
        )

    def test_subcategory_facets_follow_the_department(self):
        data = self.client.get('/api/products/facets/?category=fertilizer').data
        self.assertEqual({row['value'] for row in data['subcategories']}, {'npk'})


@override_settings(SECURE_SSL_REDIRECT=False)
class ContentStudioApiTests(TestCase):
    """Adding a product or an article from the console, with nothing omitted."""

    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(username='studio', password='safe-password-123')
        self.staff.account.level = UserAccount.LEVEL_MODERATOR
        self.staff.account.save(update_fields=['level'])
        self.staff.refresh_from_db()
        self.buyer = User.objects.create_user(username='plain-buyer', password='safe-password-123')
        self.fertilizer, self.npk, self.produce, self.tomato = make_catalog()
        self.client.force_authenticate(user=self.staff)

    def test_product_is_created_with_every_field_the_model_has(self):
        response = self.client.post('/api/management/content/products/', {
            'title': 'کود فسفره ۳۶٪',
            'description': 'برای starters مناسب است',
            'category': self.fertilizer.id,
            'subcategory': self.npk.id,
            'price': 480000,
            'discount_percent': 15,
            'stock': 40,
            'brand': 'آگروفام',
            'package_weight': 'گونی ۲۵ کیلویی',
            'sku': 'FP-36-25',
            'seo_title': 'کود فسفره ۳۶ درصد',
            'seo_description': 'قیمت و مشخصات کود فسفره',
            'production_date': '2025-04-01',
            'expiry_date': '2028-04-01',
            'min_order_quantity': 5,
            'bulk_note': 'فله با هماهنگی',
            'video_url': 'https://example.org/film',
            'shipping_weight_grams': 25000,
            'tag_names': ['کود فسفره', 'عمده'],
            'attributes': [{'label': 'فرمول NPK', 'value': '10-52-10'}, {'label': 'بدون مقدار', 'value': ''}],
            'packages': [
                {'label': 'گونی ۲۵ کیلویی', 'weight_kg': '25', 'price': 480000, 'stock': 40, 'is_default': True},
                {'label': 'فله ۱ تن', 'weight_kg': '1000', 'min_order_quantity': 1},
            ],
            'status': 'published',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        data = response.data
        self.assertEqual(data['slug'], 'کود-فسفره-۳۶')
        self.assertEqual(data['discounted_price'], 408000)
        self.assertEqual(data['category_name'], 'کود کشاورزی')
        self.assertEqual({row['name'] for row in data['tags']}, {'کود فسفره', 'عمده'})
        self.assertEqual(len(data['packages']), 2)
        self.assertTrue(data['packages'][0]['is_default'])
        # The blank row survives the round trip on purpose — it is the seeded
        # template the manager still has to fill — while the public product
        # serializer hides it.
        self.assertEqual([row['label'] for row in data['attributes']], ['فرمول NPK', 'بدون مقدار'])
        self.assertEqual(data['author'], self.staff.id)

        from .models import Tag

        self.assertTrue(Tag.objects.filter(slug='کود-فسفره').exists())

    def test_publish_toggle_flips_the_status(self):
        created = self.client.post('/api/management/content/products/', {
            'title': 'محصول پیش‌نویس', 'price': 1000, 'stock': 1, 'status': 'draft',
        }, format='json')
        product_id = created.data['id']
        toggled = self.client.post(f'/api/management/content/products/{product_id}/publish/')
        self.assertEqual(toggled.data['status'], 'published')
        self.assertEqual(
            self.client.post(f'/api/management/content/products/{product_id}/publish/').data['status'],
            'draft',
        )

    def test_a_published_product_needs_a_price_or_a_quote_flag(self):
        response = self.client.post('/api/management/content/products/', {
            'title': 'بدون قیمت', 'price': 0, 'status': 'published',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('price', response.data['fields'])

    def test_article_is_created_and_linked_to_the_catalogue(self):
        product = self.client.post('/api/management/content/products/', {
            'title': 'بذر گوجه', 'price': 50000, 'stock': 5, 'status': 'published',
        }, format='json').data
        response = self.client.post('/api/management/content/articles/', {
            'title': 'راهنمای کشت گوجه گلخانه‌ای',
            'kind': 'guide',
            'crop': 'گوجه فرنگی',
            'body': 'بستر، دما، آبیاری و برداشت را در این راهنما بخوانید. ' * 12,
            'excerpt': 'از نشا تا برداشت',
            'products': [product['id']],
            'seo_title': 'راهنمای کشت گوجه',
            'is_published': True,
            'is_featured': True,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['slug'], 'راهنمای-کشت-گوجه-گلخانه-ای')
        self.assertTrue(response.data['reading_minutes'])
        self.assertEqual(response.data['products'], [product['id']])
        self.assertEqual([row['title'] for row in response.data['linked_products']], ['بذر گوجه'])
        self.assertEqual(response.data['url'], f"/guides/{response.data['slug']}")

        listed = self.client.get('/api/management/content/articles/?kind=guide').data['results']
        self.assertEqual(len(listed), 1)

    def test_options_feed_the_two_forms(self):
        data = self.client.get('/api/management/content/options/').data
        listed = {row['slug'] for row in data['categories']}
        self.assertIn('fertilizer', listed)
        self.assertIn('greenhouse-produce', listed)
        self.assertIn('نوع رقم', data['spec_template'])
        self.assertEqual(data['article_kinds']['guide'], 'راهنمای کشت')

    def test_taxonomy_can_be_extended_from_the_console(self):
        created = self.client.post('/api/management/content/categories/', {
            'name': 'زیست‌فناوری', 'storefront_only': False,
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['slug'], 'زیست-فناوری')

        sub = self.client.post('/api/management/content/subcategories/', {
            'name': 'قارچ‌کش بیولوژیک', 'category': created.data['id'],
        }, format='json')
        self.assertEqual(sub.status_code, 201, sub.data)
        self.assertEqual(sub.data['slug'], 'قارچ-کش-بیولوژیک')

    def test_a_buyer_cannot_reach_the_studio(self):
        self.client.force_authenticate(user=self.buyer)
        response = self.client.get('/api/management/content/products/')
        self.assertIn(response.status_code, {403, 404})

    def test_a_new_catalogue_row_is_untouched_by_the_public_shop_until_published(self):
        # A draft must stay invisible: the shop's own list only ever reads
        # published rows, so publishing from the console is the only gate.
        created = self.client.post('/api/management/content/products/', {
            'title': 'کود جدید', 'price': 1000, 'stock': 4, 'status': 'draft',
        }, format='json')
        self.assertEqual(created.data['status'], 'draft')
        listed = self.client.get('/api/products/?search=کود جدید').data
        self.assertEqual(listed['count'], 0)
