"""The public storefront endpoints, one by one, as the pages actually call them.

``/storefronts`` (the merged browse page), the home-page rail and a storefront's
own page read four endpoints: the directory, ``featured``, ``profile`` and the
post feed — plus the follow button. Each of them has a rule that only shows up in
the browser: a hand-typed limit, a story that expired an hour ago, a buyer who
follows the same stall twice, a seller who must still see their own draft. Those
rules live here, at the API edge, so the component tests can stay about rendering.
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Storefront,
    StorefrontFollow,
    StorefrontPost,
    StorefrontPostLike,
    MarketplaceListing,
)

DIRECTORY = '/api/marketplace/storefronts/'


def make_user(username, *, first='زهرا', last='بهاران'):
    user = User.objects.create_user(username=username, password='p-123456')
    user.first_name, user.last_name = first, last
    user.save(update_fields=['first_name', 'last_name'])
    return user


def make_storefront(name, slug, *, owner=None, **extra):
    """A stall, with a fresh owner unless one was supplied.

    An account owns exactly one storefront — that is what «غرفه من» means — so a
    test that needs several stalls needs several users.
    """
    return Storefront.objects.create(
        user=owner or make_user(f'user-{slug}'),
        name=name, slug=slug, province='فارس', city='شیراز', **extra,
    )


def make_ad(storefront, *, title, status='published', price=100_000):
    return MarketplaceListing.objects.create(
        storefront=storefront, title=title, slug=f'{storefront.slug}-{title}',
        crop_name='گندم', description='محصول سالم', price=price, unit='کیلوگرم',
        quantity_available=Decimal('50'), min_order_quantity=Decimal('1'), status=status,
    )


def make_post(storefront, *, caption, kind='post', status='published', hours_ago=0):
    created = timezone.now() - timedelta(hours=hours_ago)
    post = StorefrontPost.objects.create(
        storefront=storefront, post_type=kind, caption=caption, status=status
    )
    # ``created_at`` is auto_now_add; a feed ranked by recency is only testable
    # if the test can place rows in time, so it is written after the fact.
    StorefrontPost.objects.filter(pk=post.pk).update(created_at=created)
    if kind == 'story':
        post.expires_at = created + timedelta(hours=24)
        post.save(update_fields=['expires_at'])
    return post


@override_settings(SECURE_SSL_REDIRECT=False)
class FeaturedRailTests(TestCase):
    """The home-page rail: «غرفه‌های پیشنهادی»."""

    def setUp(self):
        self.storefronts = [
            make_storefront(name=f'غرفه {i}', slug=f'rail-{i}') for i in range(14)
        ]
        self.client = APIClient()

    def test_the_rail_asks_for_five_by_default(self):
        self.assertEqual(len(self.client.get(f'{DIRECTORY}featured/').json()), 5)

    def test_a_requested_count_is_honoured(self):
        body = self.client.get(f'{DIRECTORY}featured/?limit=2').json()
        self.assertEqual(len(body), 2)

    def test_a_rough_query_still_returns_the_rail_instead_of_a_server_error(self):
        """A hand-typed address is not a 500.

        Junk falls back to the default count; a count that is merely too small is
        clamped to one; and a limit typed in Persian digits means exactly what it
        looks like, because every number on this site is written that way.
        """
        expected = {'': 5, 'abc': 5, 'null': 5, '[]': 5, '-1': 1, '0': 1, '۱۲': 12}
        for junk, count in expected.items():
            with self.subTest(limit=junk):
                response = self.client.get(f'{DIRECTORY}featured/?limit={junk}')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.json()), count)

    def test_a_greedy_count_is_capped(self):
        body = self.client.get(f'{DIRECTORY}featured/?limit=5000').json()
        self.assertEqual(len(body), 12, 'the rail is not a way to dump the directory')

    def test_a_closed_stall_never_appears_on_the_rail(self):
        self.storefronts[0].is_active = False
        self.storefronts[0].save(update_fields=['is_active'])

        slugs = [row['slug'] for row in self.client.get(f'{DIRECTORY}featured/').json()]

        self.assertNotIn('rail-0', slugs)


@override_settings(SECURE_SSL_REDIRECT=False)
class DirectoryFilterTests(TestCase):
    """Browse, filter, count — the list under the hero on /storefronts."""

    @classmethod
    def setUpTestData(cls):
        cls.verified = make_storefront('انگور شیراز', 'verified-one', is_verified=True)
        cls.plain = make_storefront('غرفه ساده', 'plain-one')
        cls.dormant = make_storefront('بدون آگهی', 'dormant-one')
        cls.closed = make_storefront('خوابیده', 'closed-one', is_active=False)
        make_ad(cls.verified, title='انگور')
        make_ad(cls.plain, title='کشمش')
        make_post(cls.verified, caption='باغ انگور', hours_ago=2)
        make_post(cls.plain, caption='انگور چیده شده', hours_ago=1)

    def setUp(self):
        self.client = APIClient()

    def slugs(self, params=''):
        body = self.client.get(f'{DIRECTORY}?{params}').json()
        return [row['slug'] for row in body['results']], body['count']

    def test_a_closed_stall_is_simply_not_in_the_directory(self):
        found, _count = self.slugs()
        self.assertNotIn('closed-one', found)

    def test_count_is_the_directory_not_the_page(self):
        found, count = self.slugs('page_size=1')
        self.assertEqual(len(found), 1)
        self.assertEqual(count, 3)

    def test_search_reaches_the_city_as_well_as_the_name(self):
        by_name, _ = self.slugs('search=انگور')
        self.assertIn('verified-one', by_name)
        by_city, count = self.slugs('search=شیراز')
        self.assertEqual(count, 3, 'every stall here is in شیراز')

    def test_verified_narrows_to_the_badged_ones(self):
        found, count = self.slugs('verified=1')
        self.assertEqual(found, ['verified-one'])
        self.assertEqual(count, 1)

    def test_has_listings_hides_the_stall_with_nothing_to_sell(self):
        found, _ = self.slugs('has_listings=1')
        self.assertNotIn('dormant-one', found)
        for row in ['verified-one', 'plain-one']:
            self.assertIn(row, found)

    def test_province_and_city_are_exact_enough_to_be_useful(self):
        found, _ = self.slugs('province=فارس&city=شیراز')
        self.assertEqual(len(found), 3)
        found, _ = self.slugs('province=گیلان')
        self.assertEqual(found, [])

    def test_popular_ranks_by_followers_before_the_newest(self):
        StorefrontFollow.objects.create(storefront=self.dormant, user=make_user('fan-1'))
        StorefrontFollow.objects.create(storefront=self.dormant, user=make_user('fan-2'))

        found, _ = self.slugs('ordering=popular')
        self.assertEqual(found[0], 'dormant-one', 'two followers beat a newer stall')

        found, _ = self.slugs('ordering=newest')
        self.assertEqual(found, ['dormant-one', 'plain-one', 'verified-one'])

    def test_the_serializer_reports_the_owner_has_declared_their_identity(self):
        """The directory card and the create form share this rule."""
        body = self.client.get(f'{DIRECTORY}verified-one/').json()
        self.assertIn('profile_complete', body)
        self.assertFalse(body['profile_complete'])
        self.assertNotIn('owner_national_id', body, 'the code itself is never sent to a browser')

    def test_a_page_of_the_directory_does_not_query_per_stall(self):
        for index in range(12):
            make_storefront(f'ح{index}', f'bulk-{index}')
        self.client.get(f'{DIRECTORY}page_size=1')  # warm any lazy cache

        with CaptureQueriesContext(connection) as captured:
            body = self.client.get(f'{DIRECTORY}?page_size=12').json()

        self.assertEqual(len(body['results']), 12)
        self.assertLess(
            len(captured.captured_queries), 12, 'one page should not pay one query per card'
        )


@override_settings(SECURE_SSL_REDIRECT=False)
class FollowButtonTests(TestCase):
    def setUp(self):
        self.owner = make_user('follow-owner')
        self.buyer = make_user('follow-buyer')
        self.storefront = make_storefront('غرفه دنبال', 'follow-me', owner=self.owner)
        self.client = APIClient()

    def test_following_then_unfollowing_moves_the_number_both_ways(self):
        self.client.force_authenticate(user=self.buyer)
        url = f'{DIRECTORY}{self.storefront.slug}/follow/'

        after_follow = self.client.post(url).json()
        self.assertTrue(after_follow['is_following'])
        self.assertEqual(after_follow['followers_count'], 1)
        self.assertTrue(
            StorefrontFollow.objects.filter(storefront=self.storefront, user=self.buyer).exists()
        )

        after_unfollow = self.client.delete(url).json()
        self.assertFalse(after_unfollow['is_following'])
        self.assertEqual(after_unfollow['followers_count'], 0)

    def test_following_twice_is_one_follow(self):
        self.client.force_authenticate(user=self.buyer)
        url = f'{DIRECTORY}{self.storefront.slug}/follow/'

        self.client.post(url)
        again = self.client.post(url)

        self.assertEqual(again.status_code, 200)
        self.assertEqual(StorefrontFollow.objects.filter(storefront=self.storefront).count(), 1)

    def test_a_seller_does_not_follow_their_own_stall(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(f'{DIRECTORY}{self.storefront.slug}/follow/')

        self.assertEqual(response.status_code, 400)
        self.assertIn('دنبال', response.json()['error'])

    def test_anonymous_cannot_follow(self):
        response = self.client.post(f'{DIRECTORY}{self.storefront.slug}/follow/')
        self.assertIn(response.status_code, (401, 403))


@override_settings(SECURE_SSL_REDIRECT=False)
class StorefrontProfileTests(TestCase):
    """One round trip for the stall's own page — with the seller's privileges."""

    def setUp(self):
        self.owner = make_user('profile-owner')
        self.visitor = make_user('profile-visitor')
        self.storefront = make_storefront('غرفه صفحه', 'profile-page', owner=self.owner)
        make_ad(self.storefront, title='فروش', status='published')
        make_ad(self.storefront, title='در انتظار', status='pending_review')
        make_post(self.storefront, caption='منتشر شده', hours_ago=5)
        make_post(self.storefront, caption='پیش‌نویس', status='draft', hours_ago=4)
        make_post(self.storefront, caption='استوری زنده', kind='story', hours_ago=1)
        expired = make_post(self.storefront, caption='استوری تمام‌شده', kind='story', hours_ago=30)
        StorefrontPost.objects.filter(pk=expired.pk).update(
            expires_at=timezone.now() - timedelta(hours=5)
        )
        self.client = APIClient()

    def body(self, user=None):
        if user:
            self.client.force_authenticate(user=user)
        return self.client.get(f'{DIRECTORY}{self.storefront.slug}/profile/').json()

    def test_a_buyer_sees_only_what_is_public(self):
        body = self.body()
        self.assertEqual([row['title'] for row in body['listings']], ['فروش'])
        self.assertEqual([row['caption'] for row in body['posts']], ['منتشر شده'])
        self.assertEqual([row['caption'] for row in body['stories']], ['استوری زنده'])
        self.assertEqual(body['counts']['listings'], 1)

    def test_the_seller_sees_their_own_pending_and_draft_work(self):
        body = self.body(self.owner)
        self.assertEqual(
            sorted(row['title'] for row in body['listings']), ['در انتظار', 'فروش']
        )
        self.assertEqual(
            sorted(row['caption'] for row in body['posts']), ['منتشر شده', 'پیش‌نویس']
        )

    def test_an_expired_story_is_gone_even_for_its_author(self):
        for body in (self.body(), self.body(self.owner)):
            self.assertNotIn(
                'استوری تمام‌شده', [row['caption'] for row in body['stories']]
            )

    def test_the_header_carries_the_follow_number_the_page_prints(self):
        StorefrontFollow.objects.create(storefront=self.storefront, user=self.visitor)
        body = self.body()
        self.assertEqual(body['counts']['followers'], 1)
        self.assertEqual(body['storefront']['followers_count'], 1)


@override_settings(SECURE_SSL_REDIRECT=False)
class PostFeedContractTests(TestCase):
    """``/api/marketplace/posts/`` — the strip on /storefronts and Explore."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user('feed-owner')
        cls.storefront = make_storefront('غرفه فید', 'feed-one', owner=cls.owner)
        cls.other = make_storefront('غرفه دیگر', 'feed-two')
        cls.mild = make_post(cls.storefront, caption='کم‌لایک', hours_ago=3)
        cls.famous = make_post(cls.storefront, caption='پرلایک', hours_ago=9)
        cls.story = make_post(cls.storefront, caption='استوری', kind='story', hours_ago=1)
        cls.foreign = make_post(cls.other, caption='غرفه دیگر', hours_ago=2)
        for index in range(3):
            StorefrontPostLike.objects.create(
                post=cls.famous, user=make_user(f'liker-{index}', first='لایق', last='کاربر')
            )

    def setUp(self):
        self.client = APIClient()

    def feed(self, params=''):
        body = self.client.get(f'/api/marketplace/posts/?{params}').json()
        return [row['caption'] for row in body['results']], body

    def test_the_posts_strip_asks_for_posts_and_is_not_handed_stories(self):
        captions, _ = self.feed('post_type=post')
        self.assertNotIn('استوری', captions)
        self.assertIn('کم‌لایک', captions)

    def test_ranking_is_done_in_the_database_not_in_the_browser(self):
        """The page asks for five and shows them in order.

        Sorting the returned page client-side would rank the first five posts by
        likes, which is a different list from the five most-liked ones.
        """
        captions, _ = self.feed('post_type=post&ordering=-likes_total&storefront=%s' % self.storefront.id)
        self.assertEqual(captions[0], 'پرلایک')
        self.assertEqual(captions, ['پرلایک', 'کم‌لایک'])

    def test_a_storefront_can_be_named_by_id_or_by_slug(self):
        by_id, _ = self.feed(f'storefront={self.storefront.id}')
        by_slug, _ = self.feed(f'storefront={self.storefront.slug}')
        self.assertIn('کم‌لایک', by_id)
        self.assertNotIn('غرفه دیگر', by_id)
        self.assertEqual(sorted(by_slug), sorted(by_id))

    def test_the_like_counter_travels_with_the_row(self):
        captions, body = self.feed('post_type=post&ordering=-likes_total')
        by_caption = {row['caption']: row for row in body['results']}
        self.assertEqual(by_caption['پرلایک']['like_count'], 3)
        self.assertEqual(by_caption['کم‌لایک']['like_count'], 0)

    def test_the_story_strip_gets_live_stories_only(self):
        captions, _ = self.feed('post_type=story')
        self.assertEqual(captions, ['استوری'])

    def test_an_expired_story_leaves_the_feed_without_waiting_for_a_cleanup(self):
        self.story.expires_at = timezone.now() - timedelta(minutes=1)
        self.story.save(update_fields=['expires_at'])

        captions, _ = self.feed('post_type=story')

        self.assertEqual(captions, [])

    def test_the_feed_honours_the_page_size_the_caller_asked_for(self):
        """Five is five.

        The strip on /storefronts asks for the five most-liked posts. The feed
        used to be paginated by the global default, which ignored ``page_size``
        and handed the page twelve rows — the rail grew past its own heading and
        the count on «پست‌های بیشتر» stopped meaning anything.
        """
        for index in range(20):
            make_post(self.storefront, caption=f'پست {index}', hours_ago=index + 1)

        body = self.client.get('/api/marketplace/posts/?page_size=5&post_type=post').json()

        self.assertEqual(len(body['results']), 5)
        # 20 added here + the three posts the class set up; the story is not a post.
        self.assertEqual(body['count'], 23, 'the count is the whole feed, not the page')

    def test_a_greedy_page_size_is_capped(self):
        body = self.client.get('/api/marketplace/posts/?page_size=5000')
        self.assertEqual(body.status_code, 200)
        self.assertLessEqual(len(body.json()['results']), 48)

    def test_the_feed_costs_a_handful_of_queries_not_one_per_post(self):
        for index in range(20):
            make_post(self.storefront, caption=f'پست {index}', hours_ago=index + 1)
        self.client.get('/api/marketplace/posts/?page_size=1')

        with CaptureQueriesContext(connection) as captured:
            body = self.client.get('/api/marketplace/posts/?page_size=20&post_type=post').json()

        self.assertEqual(len(body['results']), 20)
        self.assertLess(
            len(captured.captured_queries), 12, 'counters must be annotated, not fetched per row'
        )
