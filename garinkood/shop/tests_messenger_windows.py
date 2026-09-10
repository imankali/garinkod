"""How a thread is cut into windows — the messenger's loading contract.

A conversation is opened to read the *recent* part. Plain pagination counts from
the front, so a thread of three hundred messages used to answer with its first
forty — the buyer saw the greeting from last winter and no way to reach what
happened yesterday. The window is therefore taken from the newest end, and older
history is walked back from a cursor rather than a page number (a chat has no
stable page numbers: the other end keeps growing).

These tests pin the window's shape, the cursor walk, and that the older callers —
plain ``?page=`` paging — still get exactly what they got before.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Storefront, StorefrontConversation, StorefrontMessage


@override_settings(SECURE_SSL_REDIRECT=False)
class ThreadWindowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='seller-window', password='p-123456')
        self.buyer = User.objects.create_user(username='buyer-window', password='p-123456')
        self.storefront = Storefront.objects.create(
            user=self.owner, name='غرفه پنجره', slug='ghorfe-penhere',
            province='فارس', city='شیراز',
        )
        self.conversation = StorefrontConversation.objects.create(
            storefront=self.storefront, customer=self.buyer,
            channel=StorefrontConversation.CHANNEL_STOREFRONT,
        )
        self.client = APIClient()

    def url(self, **params):
        base = f'/api/marketplace/conversations/{self.conversation.id}/messages/'
        if not params:
            return base
        from urllib.parse import urlencode

        return f'{base}?{urlencode(params)}'

    def fill(self, total, *, stamp=None, sender=None):
        """``total`` messages, oldest first, all inside one second by default.

        Sharing a timestamp is the realistic case (a fast exchange) and the one a
        cursor boundary gets wrong unless ids break the tie.
        """
        base = stamp or timezone.now()
        for index in range(1, total + 1):
            StorefrontMessage.objects.create(
                conversation=self.conversation,
                sender=sender or self.buyer,
                body=f'پیام {index}',
            )
        if stamp is not None:
            StorefrontMessage.objects.filter(conversation=self.conversation).update(
                created_at=stamp
            )
        return list(self.conversation.messages.order_by('id'))

    # — the opening window ————————————————————————————————————————————————

    def test_a_thread_opens_on_its_newest_messages(self):
        rows = self.fill(130)
        self.client.force_authenticate(user=self.buyer)

        response = self.client.get(self.url(page_size=80))

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['count'], 130, 'the whole thread size, not the window size')
        self.assertEqual(len(body['results']), 80)
        self.assertEqual(
            [row['id'] for row in body['results']],
            [row.id for row in rows[-80:]],
            'the newest window, oldest first',
        )
        self.assertTrue(body['older_available'])

    def test_a_short_thread_returns_all_of_it_and_no_more_to_load(self):
        self.fill(7)
        self.client.force_authenticate(user=self.buyer)

        body = self.client.get(self.url(page_size=80)).json()

        self.assertEqual(len(body['results']), 7)
        self.assertFalse(body['older_available'])

    def test_opening_a_window_marks_the_thread_read(self):
        """Reading the newest 80 of 120 marks all 120.

        Deliberate: the window ends at the newest message, so nothing is left
        below it unseen — and an inbox that keeps counting a conversation the
        reader has just opened is an inbox nobody trusts. The owner's own rows are
        never marked, because their receipt is the buyer's read flag, not their
        own.
        """
        self.fill(120, sender=self.owner)
        self.client.force_authenticate(user=self.buyer)
        self.assertTrue(
            self.conversation.messages.filter(sender=self.owner, is_read=False).exists()
        )

        self.client.get(self.url(page_size=80))

        self.assertFalse(
            self.conversation.messages.filter(sender=self.owner, is_read=False).exists(),
            'reading the tail is reading the thread; the «خوانده شد» tick must follow',
        )

    def test_a_history_page_finds_the_thread_already_read_and_leaves_it_so(self):
        self.fill(60, sender=self.owner)
        self.fill_sender = None
        self.client.force_authenticate(user=self.buyer)
        window = self.client.get(self.url(page_size=20)).json()

        again = self.client.get(
            self.url(page_size=20, before_id=window['results'][0]['id'])
        )

        self.assertEqual(again.status_code, 200)
        self.assertEqual(len(again.json()['results']), 20)
        self.assertFalse(self.conversation.messages.filter(is_read=False).exists())

    def test_the_window_does_not_cost_one_query_per_message(self):
        """A bigger window must not mean more queries per row.

        The relations a message row reads — sender and their account, the listing
        and its storefront, the quoted message, the post and its storefront, the
        land — are joined in the one select that fetches the window. Without that
        list an 80-message window is 80 rows plus 80 lookups, which is the whole
        reason a chat felt slower the longer it had been going.

        The fixed cost (session, the read update, the presence write, the
        conversation header, the count) is allowed; growth with the row count is
        not, so the assertion compares two window sizes rather than naming a
        number that changes whenever the header gains a field.
        """
        self.fill(80)
        self.client.force_authenticate(user=self.buyer)

        with CaptureQueriesContext(connection) as small:
            self.client.get(self.url(page_size=20))
        with CaptureQueriesContext(connection) as big:
            response = self.client.get(self.url(page_size=80))

        self.assertEqual(len(response.json()['results']), 80)
        growth = len(big.captured_queries) - len(small.captured_queries)
        self.assertLessEqual(
            growth, 1, f'a 60-row bigger window added {growth} queries to the same page'
        )
        self.assertLess(
            len(big.captured_queries),
            25,
            'a window should be a handful of queries, not one per message',
        )

    # — walking back ————————————————————————————————————————————————————————

    def test_history_walks_back_from_the_first_visible_message(self):
        rows = self.fill(130)
        self.client.force_authenticate(user=self.buyer)

        first = self.client.get(self.url(page_size=80)).json()
        oldest_on_screen = first['results'][0]['id']

        second = self.client.get(
            self.url(page_size=80, before_id=oldest_on_screen)
        ).json()

        self.assertEqual(len(second['results']), 50, 'what is left, not another 80')
        self.assertEqual(
            [row['id'] for row in second['results']],
            [row.id for row in rows[:50]],
        )
        self.assertFalse(second['older_available'], 'the walk has reached the start')
        covered = {row['id'] for row in first['results']} | {row['id'] for row in second['results']}
        self.assertEqual(len(covered), 130, 'no gap')
        self.assertEqual(
            len(first['results']) + len(second['results']), 130, 'no overlap'
        )

    def test_messages_sharing_a_timestamp_are_neither_skipped_nor_repeated(self):
        same_second = timezone.now().replace(microsecond=0)
        rows = self.fill(9, stamp=same_second)
        self.client.force_authenticate(user=self.buyer)

        window = self.client.get(self.url(page_size=4)).json()
        self.assertEqual([row['id'] for row in window['results']], [row.id for row in rows[5:]])

        older = self.client.get(
            self.url(page_size=4, before_id=window['results'][0]['id'])
        ).json()
        self.assertEqual([row['id'] for row in older['results']], [row.id for row in rows[1:5]])

        oldest = self.client.get(
            self.url(page_size=4, before_id=older['results'][0]['id'])
        ).json()
        self.assertEqual([row['id'] for row in oldest['results']], [rows[0].id])

    def test_a_deleted_cursor_still_walks_back_from_where_it_was(self):
        rows = self.fill(20)
        self.client.force_authenticate(user=self.buyer)
        window = self.client.get(self.url(page_size=10)).json()
        anchor_id = window['results'][0]['id']

        StorefrontMessage.objects.get(pk=anchor_id).delete()
        older = self.client.get(self.url(page_size=10, before_id=anchor_id)).json()

        # Everything before the anchor is still there — ten rows, since the
        # deleted one was the eleventh and is not part of what remains.
        self.assertEqual(
            [row['id'] for row in older['results']],
            [row.id for row in rows if row.id < anchor_id],
            'the anchor row is gone but its id still marks the boundary',
        )
        self.assertFalse(older['older_available'])

    def test_a_cursor_from_another_thread_is_not_answered_with_foreign_messages(self):
        other = StorefrontConversation.objects.create(
            storefront=self.storefront,
            customer=User.objects.create_user(username='other-buyer', password='p-123456'),
            channel=StorefrontConversation.CHANNEL_STOREFRONT,
        )
        foreign = StorefrontMessage.objects.create(
            conversation=other, sender=other.customer, body='غرفه دیگر'
        )
        self.fill(3)
        self.client.force_authenticate(user=self.buyer)

        window = self.client.get(self.url(page_size=80, before_id=foreign.id)).json()

        bodies = [row['body'] for row in window['results']]
        self.assertNotIn('غرفه دیگر', bodies, 'a cursor from another thread leaks nothing')
        for row in window['results']:
            self.assertEqual(row['conversation'], self.conversation.id)

    # — the callers that were here first —————————————————————————————————————

    def test_plain_pagination_is_untouched_by_the_window(self):
        self.fill(95)
        self.client.force_authenticate(user=self.buyer)

        body = self.client.get(self.url(page=2)).json()

        self.assertIn('next', body)
        self.assertIn('previous', body)
        self.assertEqual(len(body['results']), 40, 'the default page size still applies')
        self.assertNotIn('older_available', body)
        self.assertEqual(body['results'][0]['body'], 'پیام 41', 'still counted from the front')

    def test_a_page_number_wins_over_a_window_request(self):
        """``?page=`` with a stray ``page_size`` is pagination, not both."""
        self.fill(95)
        self.client.force_authenticate(user=self.buyer)

        body = self.client.get(self.url(page=1, page_size=80)).json()

        # ``page_size`` is a plain pagination parameter too (the viewset's own
        # cap), so the caller gets 80 rows *from the front* — not the newest 80.
        self.assertEqual(len(body['results']), 80)
        self.assertEqual(body['results'][0]['body'], 'پیام 1')
        self.assertNotIn('older_available', body)

    def test_junk_in_page_size_falls_back_to_the_default_behaviour(self):
        self.fill(95)
        self.client.force_authenticate(user=self.buyer)

        body = self.client.get(self.url(page_size='abc')).json()

        self.assertEqual(len(body['results']), 40, 'a broken parameter is not a window')
        self.assertEqual(body['results'][0]['body'], 'پیام 1')

    def test_a_window_is_capped_however_greedy_the_request(self):
        self.fill(150)
        self.client.force_authenticate(user=self.buyer)

        body = self.client.get(self.url(page_size=5000)).json()

        self.assertEqual(len(body['results']), 100, 'the same cap plain paging has')

    def test_the_conversation_header_travels_with_the_window(self):
        self.fill(3)
        self.client.force_authenticate(user=self.buyer)

        body = self.client.get(self.url(page_size=2)).json()

        self.assertEqual(body['conversation']['id'], self.conversation.id)

    def test_a_stranger_cannot_read_a_thread_by_guessing_its_number(self):
        self.fill(3)
        self.client.force_authenticate(
            user=User.objects.create_user(username='nosy', password='p-123456')
        )

        response = self.client.get(self.url(page_size=80))

        self.assertIn(response.status_code, (403, 404))

    def test_the_read_flag_never_touches_what_the_reader_wrote_themself(self):
        rows = self.fill(30)  # all from the buyer
        self.client.force_authenticate(user=self.buyer)
        self.conversation.messages.update(is_read=False)

        self.client.get(self.url(page_size=10))

        self.assertEqual(
            self.conversation.messages.filter(is_read=False).count(),
            30,
            'marking a thread read is about the other side\u2019s messages',
        )
        self.assertEqual(len(rows), 30)


@override_settings(SECURE_SSL_REDIRECT=False)
class ThreadWindowClockTests(TestCase):
    """The window is a query, so it must survive a clock that moves."""

    def setUp(self):
        self.buyer = User.objects.create_user(username='clock-window', password='p-123456')
        self.owner = User.objects.create_user(username='clock-seller', password='p-123456')
        storefront = Storefront.objects.create(
            user=self.owner, name='غرفه ساعت', slug='ghorfe-saat',
            province='فارس', city='شیراز',
        )
        self.conversation = StorefrontConversation.objects.create(
            storefront=storefront, customer=self.buyer,
            channel=StorefrontConversation.CHANNEL_STOREFRONT,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.buyer)

    def test_the_newest_window_follows_the_timestamp_not_the_insertion_order(self):
        now = timezone.now()
        for index, offset in enumerate((-3, -1, -2, 0, -4), start=1):
            StorefrontMessage.objects.create(
                conversation=self.conversation, sender=self.buyer, body=f'پ{index}',
            )
        # Write the timestamps by hand, out of id order, and expect the ordering
        # to follow the time — with ids only as a tie-break.
        for index, offset in enumerate((-3, -1, -2, 0, -4), start=1):
            StorefrontMessage.objects.filter(pk=index).update(created_at=now + timedelta(hours=offset))

        body = self.client.get(
            f'/api/marketplace/conversations/{self.conversation.id}/messages/?page_size=2'
        ).json()

        self.assertEqual([row['body'] for row in body['results']], ['پ2', 'پ4'])
