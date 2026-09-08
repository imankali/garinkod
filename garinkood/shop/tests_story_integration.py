from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Storefront, StorefrontPost, StorefrontStoryView


@override_settings(SECURE_SSL_REDIRECT=False)
class StoryIntegrationTests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username='story-seller')
        self.storefront = Storefront.objects.create(
            user=self.seller,
            name='غرفه استوری',
            slug='story-storefront',
        )
        self.client = APIClient()

    def test_story_without_expiry_gets_a_24_hour_lifetime(self):
        before = timezone.now()
        story = StorefrontPost.objects.create(
            storefront=self.storefront,
            post_type='story',
            status='published',
            caption='استوری تازه',
        )
        after = timezone.now()

        self.assertIsNotNone(story.expires_at)
        self.assertGreaterEqual(story.expires_at, before + timedelta(hours=24))
        self.assertLessEqual(story.expires_at, after + timedelta(hours=24))

    def test_explicit_expiry_is_preserved(self):
        explicit_expiry = timezone.now() + timedelta(hours=2)
        story = StorefrontPost.objects.create(
            storefront=self.storefront,
            post_type='story',
            status='published',
            expires_at=explicit_expiry,
        )

        self.assertEqual(story.expires_at, explicit_expiry)

    def test_expired_stories_are_filtered_from_public_feed(self):
        expired = StorefrontPost.objects.create(
            storefront=self.storefront,
            post_type='story',
            status='published',
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        active = StorefrontPost.objects.create(
            storefront=self.storefront,
            post_type='story',
            status='published',
        )

        response = self.client.get(
            '/api/marketplace/posts/',
            {'post_type': 'story', 'storefront': self.storefront.slug},
        )

        self.assertEqual(response.status_code, 200)
        returned_ids = {row['id'] for row in response.data['results']}
        self.assertIn(active.id, returned_ids)
        self.assertNotIn(expired.id, returned_ids)

    def test_directory_exposes_active_and_unseen_story_flags(self):
        story = StorefrontPost.objects.create(
            storefront=self.storefront,
            post_type='story',
            status='published',
        )
        viewer = User.objects.create_user(username='story-viewer')
        self.client.force_authenticate(viewer)

        unseen_response = self.client.get('/api/marketplace/storefronts/')
        unseen_row = next(
            row for row in unseen_response.data['results']
            if row['id'] == self.storefront.id
        )
        self.assertTrue(unseen_row['has_active_stories'])
        self.assertTrue(unseen_row['has_unseen_stories'])

        StorefrontStoryView.objects.create(post=story, user=viewer)
        seen_response = self.client.get('/api/marketplace/storefronts/')
        seen_row = next(
            row for row in seen_response.data['results']
            if row['id'] == self.storefront.id
        )
        self.assertTrue(seen_row['has_active_stories'])
        self.assertFalse(seen_row['has_unseen_stories'])

    def test_storefront_property_ignores_expired_and_unpublished_stories(self):
        StorefrontPost.objects.create(
            storefront=self.storefront,
            post_type='story',
            status='published',
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        StorefrontPost.objects.create(
            storefront=self.storefront,
            post_type='story',
            status='draft',
        )
        self.assertFalse(self.storefront.has_active_stories)

        StorefrontPost.objects.create(
            storefront=self.storefront,
            post_type='story',
            status='published',
        )
        self.assertTrue(self.storefront.has_active_stories)
