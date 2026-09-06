"""Tests for the access ladder and the rule that staff are not desk customers.

The ladder is the one place that decides both «what may this account do» and
«what does the site tell them about it», so these tests guard three things:

* the ladder's own shape — eight ordered steps, choices and staff membership
  derived from it rather than repeated, so a label and a gate cannot disagree;
* the ranks that are granted by what a user actually has (a verified phone, a
  verified storefront) and never by a client's request;
* the one thing the ladder *takes away*: a person who staffs a service desk, or
  who is above that in the ladder, is not allowed to stand in the customer queue
  of the same desk. Farmers come first, and a ticket from a colleague is handled
  in the queue, not against it.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status

from . import desk, levels
from .models import (
    DeskAgent,
    Storefront,
    StorefrontConversation,
    StorefrontMessage,
    UserAccount,
)
from .tests_desk import OPEN_WINDOW, api, make_farmer, make_operator


class LadderShapeTests(TestCase):
    """The ladder is a ladder: ordered, complete, and the only source of labels."""

    def test_choices_are_derived_from_the_ladder(self):
        self.assertEqual(
            [value for value, _label in UserAccount.LEVEL_CHOICES],
            [rank.value for rank in levels.LADDER],
        )
        self.assertNotIn(levels.LEVEL_GUEST, dict(UserAccount.LEVEL_CHOICES))

    def test_levels_are_contiguous_and_end_at_the_owner(self):
        values = [rank.value for rank in levels.LADDER]
        self.assertEqual(values, sorted(set(values)))
        self.assertEqual(values, list(range(levels.MINIMUM_LEVEL, levels.MAXIMUM_LEVEL + 1)))
        self.assertEqual(levels.MAXIMUM_LEVEL, levels.LEVEL_OWNER)

    def test_staff_membership_follows_the_staff_floor(self):
        self.assertEqual(
            set(UserAccount.STAFF_LEVELS),
            {rank.value for rank in levels.LADDER if rank.value >= levels.LEVEL_DESK_AGENT},
        )
        for value in (levels.LEVEL_BUYER, levels.LEVEL_VERIFIED_BUYER, levels.LEVEL_SELLER,
                      levels.LEVEL_VERIFIED_SELLER):
            self.assertFalse(levels.is_staff_level(value), f'level {value} must not be staff')
        for value in (levels.LEVEL_DESK_AGENT, levels.LEVEL_MODERATOR, levels.LEVEL_ADMIN,
                      levels.LEVEL_OWNER):
            self.assertTrue(levels.is_staff_level(value), f'level {value} must be staff')

    def test_every_capability_floor_is_a_real_step(self):
        for key, (_label, floor) in levels.CAPABILITIES.items():
            self.assertIn(floor, levels.RANK_BY_VALUE, f'{key} points at a level that does not exist')

    def test_labels_are_persian_and_ranked(self):
        self.assertEqual(UserAccount.LEVEL_CHOICES[0][1], 'سطح ۱ — خریدار')
        self.assertEqual(UserAccount.LEVEL_CHOICES[-1][1], 'سطح ۸ — مالک سیستم')
        self.assertEqual(levels.label(levels.LEVEL_SELLER), 'سطح ۳ — غرفه‌دار')
        self.assertEqual(levels.rank_for(levels.LEVEL_DESK_AGENT).short, 'کارشناس میز خدمات')
        self.assertEqual(levels.label('nope'), '')
        self.assertEqual(levels.label(None), '')

    def test_validation_accepts_only_stored_levels(self):
        self.assertTrue(levels.is_valid(levels.LEVEL_BUYER))
        self.assertTrue(levels.is_valid(levels.LEVEL_OWNER))
        self.assertFalse(levels.is_valid(levels.LEVEL_GUEST))
        self.assertFalse(levels.is_valid(levels.LEVEL_OWNER + 1))
        self.assertFalse(levels.is_valid('3'))

    def test_matrix_names_what_each_step_unlocks(self):
        rows = {row['value']: row for row in levels.matrix()}
        self.assertEqual(len(rows), len(levels.LADDER))
        self.assertIn('میز', rows[levels.LEVEL_DESK_AGENT]['promise'])
        self.assertEqual(levels.CAPABILITY_LABELS['desk_queue'], 'کار روی صف میز خدمات')
        unlocks = {item['key'] for item in rows[levels.LEVEL_VERIFIED_BUYER]['unlocks']}
        self.assertIn('verified_badge', unlocks)

    def test_next_step_stops_at_the_appointed_ranks(self):
        farmer = make_farmer('ladder-next-step')
        nxt = levels.next_step(farmer)
        self.assertEqual(nxt['value'], levels.LEVEL_VERIFIED_BUYER)
        self.assertIn('تأیید', nxt['how'])

        account = farmer.account
        account.level = levels.LEVEL_VERIFIED_SELLER
        account.save(update_fields=['level'])
        # Nobody walks from a storefront into a staff job, so the profile must
        # not suggest a next step it cannot grant.
        self.assertIsNone(levels.next_step(farmer))


class CapabilityTests(TestCase):
    def test_buyer_sees_the_customer_capabilities(self):
        farmer = make_farmer('caps-buyer')
        caps = levels.capabilities_for(farmer)
        self.assertTrue(caps['order'])
        self.assertTrue(caps['support_chat'])
        self.assertTrue(caps['consult_desk'])
        self.assertFalse(caps['sell'])
        self.assertFalse(caps['console'])
        self.assertFalse(caps['desk_queue'])
        self.assertFalse(caps['verified_badge'])

    def test_verified_phone_unlocks_the_badge_only(self):
        farmer = make_farmer('caps-verified')
        farmer.account.phone_verified_at = timezone.now()
        farmer.account.save(update_fields=['phone_verified_at', 'updated'])
        caps = levels.capabilities_for(farmer)
        self.assertTrue(caps['verified_badge'])
        self.assertFalse(caps['sell'])

    def test_staff_levels_lose_the_customer_capabilities(self):
        for value in (levels.LEVEL_DESK_AGENT, levels.LEVEL_MODERATOR, levels.LEVEL_ADMIN,
                      levels.LEVEL_OWNER):
            user = make_farmer(f'caps-staff-{value}')
            user.account.level = value
            user.account.save(update_fields=['level'])
            caps = levels.capabilities_for(user)
            self.assertFalse(caps['support_chat'], f'level {value} may not queue as a support customer')
            self.assertTrue(caps['desk_queue'])
            self.assertTrue(caps['review'])

    def test_superuser_owns_everything(self):
        boss = User.objects.create_superuser(username='caps-boss', password='x' * 12, email='b@example.test')
        caps = levels.capabilities_for(boss)
        self.assertTrue(caps['own'])
        self.assertFalse(caps['support_chat'])


class DerivedRankTests(TestCase):
    """Ranks a user earns from what they own, never from what they post."""

    def test_phone_verification_promotes_to_level_two(self):
        farmer = make_farmer('derived-phone')
        self.assertEqual(levels.level_for(farmer), levels.LEVEL_BUYER)
        farmer.account.phone_verified_at = timezone.now()
        farmer.account.save(update_fields=['phone_verified_at', 'updated'])
        farmer.refresh_from_db()
        self.assertEqual(farmer.account.level, levels.LEVEL_VERIFIED_BUYER)

    def test_storefront_creates_a_seller_and_verification_a_verified_seller(self):
        farmer = make_farmer('derived-storefront')
        storefront = Storefront.objects.create(
            user=farmer, name='باغ تست', slug='bagh-test-derived', province='کرمان', city='رفسنجان',
        )
        farmer.refresh_from_db()
        self.assertEqual(farmer.account.level, levels.LEVEL_SELLER)

        storefront.is_verified = True
        storefront.save(update_fields=['is_verified'])
        farmer.refresh_from_db()
        self.assertEqual(farmer.account.level, levels.LEVEL_VERIFIED_SELLER)

    def test_promotion_never_walks_someone_down(self):
        farmer = make_farmer('derived-moderator')
        farmer.account.level = levels.LEVEL_MODERATOR
        farmer.account.save(update_fields=['level'])
        Storefront.objects.create(
            user=farmer, name='باغ ناظر', slug='bagh-moderator-derived', province='کرمان', city='کرمان',
        )
        farmer.refresh_from_db()
        self.assertEqual(farmer.account.level, levels.LEVEL_MODERATOR)

    def test_unverifying_a_storefront_leaves_the_rank_alone(self):
        farmer = make_farmer('derived-unverify')
        storefront = Storefront.objects.create(
            user=farmer, name='باغ لغو', slug='bagh-unverify-derived', province='کرمان', city='یزد',
            is_verified=True,
        )
        farmer.refresh_from_db()
        self.assertEqual(farmer.account.level, levels.LEVEL_VERIFIED_SELLER)
        storefront.is_verified = False
        storefront.save(update_fields=['is_verified'])
        farmer.refresh_from_db()
        self.assertEqual(farmer.account.level, levels.LEVEL_VERIFIED_SELLER)


class DeskCustomerRuleTests(TestCase):
    """Nobody queues in front of a farmer at the desk they answer."""

    def setUp(self):
        StorefrontConversation.objects.all().delete()

    def test_a_farmer_opens_their_support_thread(self):
        farmer = make_farmer('rule-farmer')
        response = api(farmer).post('/api/marketplace/conversations/service/support/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(StorefrontConversation.objects.filter(customer=farmer).exists())

    def test_staff_may_not_open_a_support_chat(self):
        for value, who in (
            (levels.LEVEL_DESK_AGENT, 'پشتیبان'),
            (levels.LEVEL_MODERATOR, 'ناظر'),
            (levels.LEVEL_ADMIN, 'مدیر'),
            (levels.LEVEL_OWNER, 'مالک'),
        ):
            user = make_farmer(f'rule-staff-{value}')
            user.account.level = value
            user.account.save(update_fields=['level'])
            response = api(user).post('/api/marketplace/conversations/service/support/')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, f'{who} must be refused')
            self.assertEqual(response.data['code'], 'staff_not_a_desk_customer')
            self.assertIn('کشاورز', response.data['error'])
            # The refusal is useless without a door to walk through instead.
            self.assertEqual(response.data['alt'][0]['url'], '/messages')
        self.assertFalse(StorefrontConversation.objects.exists())

    def test_a_superuser_is_refused_too(self):
        boss = User.objects.create_superuser(username='rule-boss', password='x' * 12, email='s@example.test')
        response = api(boss).get('/api/marketplace/conversations/service/support/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_an_operator_of_a_desk_may_not_be_its_customer_even_at_a_low_rank(self):
        agent = make_operator('rule-consultant', role=DeskAgent.ROLE_CONSULTING)
        response = api(agent.user).post('/api/marketplace/conversations/service/consulting/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('همین میز', response.data['error'])
        # Their rank still buys them the other desk's queue as a customer? No —
        # they are staff of the platform only in the roster sense, so a farmer's
        # consult thread is not theirs to open. Support, however, is.
        support = api(agent.user).post('/api/marketplace/conversations/service/support/')
        self.assertEqual(support.status_code, status.HTTP_201_CREATED)

    def test_a_promoted_account_keeps_reading_but_not_writing_its_old_thread(self):
        farmer = make_farmer('rule-promoted')
        opened = api(farmer).post('/api/marketplace/conversations/service/support/')
        self.assertEqual(opened.status_code, status.HTTP_201_CREATED)
        conversation_id = opened.data['id']
        api(farmer).post(
            f'/api/marketplace/conversations/{conversation_id}/messages/',
            {'body': 'سلام، یک سؤال دارم'},
            format='json',
        )

        farmer.account.level = levels.LEVEL_DESK_AGENT
        farmer.account.save(update_fields=['level'])

        read = api(farmer).get(f'/api/marketplace/conversations/{conversation_id}/messages/')
        self.assertEqual(read.status_code, status.HTTP_200_OK)

        refused = api(farmer).post(
            f'/api/marketplace/conversations/{conversation_id}/messages/',
            {'body': 'ادامه سؤال من'},
            format='json',
        )
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(refused.data['code'], 'staff_not_a_desk_customer')
        self.assertFalse(StorefrontMessage.objects.filter(body='ادامه سؤال من').exists())

    def test_answering_a_farmer_thread_is_untouched(self):
        farmer = make_farmer('rule-customer')
        agent = make_operator('rule-support', role=DeskAgent.ROLE_SUPPORT)
        farmer.account.level = levels.LEVEL_SELLER
        farmer.account.save(update_fields=['level'])
        opened = api(farmer).post('/api/marketplace/conversations/service/support/')
        conversation_id = opened.data['id']
        response = api(agent.user).post(
            f'/api/marketplace/conversations/{conversation_id}/messages/',
            {'body': 'در خدمتم'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_desk_state_answers_the_question_before_it_is_asked(self):
        farmer = make_farmer('rule-state-farmer')
        public = desk.desk_state(StorefrontConversation.CHANNEL_SUPPORT, user=farmer)
        self.assertTrue(public['customer_allowed'])
        self.assertEqual(public['customer_denied_reason'], '')

        steward = make_farmer('rule-state-staff')
        steward.account.level = levels.LEVEL_MODERATOR
        steward.account.save(update_fields=['level'])
        staff = desk.desk_state(StorefrontConversation.CHANNEL_SUPPORT, user=steward)
        self.assertFalse(staff['customer_allowed'])
        self.assertIn('گفتگو نمی‌کند', staff['customer_denied_reason'])

    def test_desk_settings_hours_are_untouched_by_the_rule(self):
        from .models import DeskSettings

        DeskSettings.objects.all().delete()
        DeskSettings.objects.create(is_active=True, **OPEN_WINDOW)
        state = desk.desk_state(StorefrontConversation.CHANNEL_SUPPORT, user=None)
        self.assertTrue(state['is_open'])


class LevelsEndpointTests(TestCase):
    def test_the_ladder_is_readable_without_signing_in(self):
        response = api().get('/api/levels/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['ladder']), len(levels.LADDER))
        self.assertEqual(data['level_range'], {'min': 1, 'max': 8})
        self.assertEqual(data['viewer_level'], 0)
        self.assertEqual(data['viewer_capabilities'], {})
        self.assertEqual(
            [row['value'] for row in data['ladder']],
            [rank.value for rank in levels.LADDER],
        )
        self.assertTrue(all(row['promise'] and row['how'] for row in data['ladder']))

    def test_a_signed_in_viewer_gets_their_own_row(self):
        farmer = make_farmer('endpoint-farmer')
        data = api(farmer).get('/api/levels/').json()
        self.assertEqual(data['viewer_level'], levels.LEVEL_BUYER)
        self.assertTrue(data['viewer_capabilities']['order'])
        self.assertFalse(data['viewer_is_staff'])
        self.assertEqual(data['next_step']['value'], levels.LEVEL_VERIFIED_BUYER)

    def test_session_payload_carries_the_capabilities(self):
        farmer = make_farmer('endpoint-session')
        farmer.account.phone_verified_at = timezone.now()
        farmer.account.save(update_fields=['phone_verified_at', 'updated'])
        account = api(farmer).get('/api/auth/session/').json()['account']
        self.assertEqual(account['level'], levels.LEVEL_VERIFIED_BUYER)
        self.assertEqual(account['level_short_label'], 'خریدار تأییدشده')
        self.assertTrue(account['capabilities']['verified_badge'])
        self.assertEqual(account['next_level']['value'], levels.LEVEL_SELLER)
        self.assertIn('غرفه', account['next_level']['how'])

    def test_message_payload_marks_a_verified_sender(self):
        farmer = make_farmer('endpoint-sender')
        agent = make_operator('endpoint-agent', role=DeskAgent.ROLE_SUPPORT)
        conversation = StorefrontConversation.objects.create(
            customer=farmer, channel=StorefrontConversation.CHANNEL_SUPPORT,
        )
        StorefrontMessage.objects.create(conversation=conversation, sender=agent.user, body='پاسخ کارشناس')
        StorefrontMessage.objects.create(conversation=conversation, sender=farmer, body='سؤال کشاورز')
        rows = api(farmer).get(
            f'/api/marketplace/conversations/{conversation.id}/messages/'
        ).json()['results']
        by_sender = {row['body']: row['sender_verified'] for row in rows}
        self.assertFalse(by_sender['سؤال کشاورز'])
        self.assertFalse(by_sender['پاسخ کارشناس'])

        agent.user.account.phone_verified_at = timezone.now()
        agent.user.account.save(update_fields=['phone_verified_at', 'updated'])
        rows = api(farmer).get(
            f'/api/marketplace/conversations/{conversation.id}/messages/'
        ).json()['results']
        by_sender = {row['body']: row['sender_verified'] for row in rows}
        self.assertTrue(by_sender['پاسخ کارشناس'])


class ManagementLevelTests(TestCase):
    """The console assigns the ladder, so its numbers must move with it."""

    def setUp(self):
        self.owner = User.objects.create_superuser(
            username='mgmt-owner', password='x' * 12, email='o@example.test',
        )

    def test_appointing_a_desk_agent_makes_them_staff(self):
        target = make_farmer('mgmt-agent')
        response = api(self.owner).patch(
            '/api/management/users/', {'username': target.username, 'level': levels.LEVEL_DESK_AGENT},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertEqual(target.account.level, levels.LEVEL_DESK_AGENT)
        self.assertTrue(target.is_staff)

    def test_out_of_range_level_names_the_real_bounds(self):
        target = make_farmer('mgmt-bad-level')
        response = api(self.owner).patch(
            '/api/management/users/', {'username': target.username, 'level': 99}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('بین ۱ تا ۸', response.data['fields']['level'][0])

    def test_the_rank_grants_the_queue_it_promises_and_takes_it_back(self):
        """«کارشناس میز خدمات» is only real if the queue opens with it."""
        target = make_farmer('mgmt-queue')
        self.assertFalse(target.has_perm('shop.view_platformfeedback'))

        api(self.owner).patch(
            '/api/management/users/', {'username': target.username, 'level': levels.LEVEL_DESK_AGENT},
            format='json',
        )
        target = User.objects.get(pk=target.pk)
        self.assertTrue(target.has_perm('shop.view_platformfeedback'))
        self.assertTrue(target.has_perm('shop.view_farmconsultationrequest'))

        api(self.owner).patch(
            '/api/management/users/', {'username': target.username, 'level': levels.LEVEL_SELLER},
            format='json',
        )
        target = User.objects.get(pk=target.pk)
        self.assertFalse(target.has_perm('shop.view_platformfeedback'))
        self.assertFalse(target.is_staff)

    def test_the_console_list_publishes_the_ladder(self):
        data = api(self.owner).get('/api/management/users/').json()
        self.assertEqual([row['value'] for row in data['levels']], [rank.value for rank in levels.LADDER])
        self.assertEqual(len(data['ladder']), len(levels.LADDER))
