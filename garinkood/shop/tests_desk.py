"""Tests for the service desks: hours, presence, distribution, survey and dossiers.

These cover the promises made to a farmer in the chat window, which are exactly
the promises that break silently:

* the desk says it is open only when somebody is scheduled to answer, and a
  message sent outside those hours is acknowledged once rather than stamped on
  every line;
* «آنلاین» follows the operator's real activity, not a flag nobody remembers to
  clear;
* every operator on a desk can work a thread, while the workload is still shared
  instead of piling on whoever answers fastest;
* the name in the header is the person who actually replied;
* a land case file travels as the record it is, and only to the desk that owns
  the thread;
* closing a thread opens the survey for the farmer and for nobody else.
"""

from datetime import time, timedelta

from django.contrib.auth.models import Permission, User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from .models import (
    Category, Comment, ConversationRating, DeskAgent, DeskSettings, FarmLand,
    MarketplaceListing, Product, QuickReply, Storefront, StorefrontConversation,
    StorefrontMessage, StorefrontPost, StorefrontPostComment, UserAccount,
)

CLOSED_WINDOW = dict(support_start=time(0, 0), support_end=time(0, 0), consulting_start=time(0, 0),
                     consulting_end=time(0, 0))
OPEN_WINDOW = dict(support_start=time(0, 0), support_end=time(23, 59, 58),
                   consulting_start=time(0, 0), consulting_end=time(23, 59, 58))


def make_farmer(username):
    return User.objects.create_user(username=username, password='safe-password-123')


def make_operator(username, *, role, display_name='کارشناس نمونه', title='کارشناس ارشد'):
    """A desk operator, with the model permission the queue is gated on."""
    user = User.objects.create_user(username=username, password='safe-password-123', is_staff=True)
    codename = 'view_platformfeedback' if role == DeskAgent.ROLE_SUPPORT else 'view_farmconsultationrequest'
    user.user_permissions.add(Permission.objects.get(codename=codename, content_type__app_label='shop'))
    return DeskAgent.objects.create(
        user=user, role=role, display_name=display_name, title=title, is_active=True,
    )


def make_land(owner, **kwargs):
    defaults = {
        'owner': owner, 'name': 'باغ پسته شمالی', 'land_type': 'orchard', 'area': 2.5,
        'area_unit': 'hectare', 'crop_type': 'پسته', 'crop_variety': 'اکبری',
        'province': 'کرمان', 'city': 'رفسنجان', 'soil_type': 'sandy', 'irrigation_type': 'drip',
        'notes': 'خاک سبک، آبیاری قطره‌ای',
    }
    defaults.update(kwargs)
    return FarmLand.objects.create(**defaults)


def api(user=None):
    client = APIClient()
    if user is not None:
        client.force_authenticate(user=user)
    return client


class DeskHoursTests(TestCase):
    """The working-hours sentence the chat shows, and the notice it sends."""

    def setUp(self):
        self.farmer = make_farmer('hours-farmer')
        self.settings_row = DeskSettings.load()
        for key, value in OPEN_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.work_days = '0,1,2,3,4,5,6'
        self.settings_row.save()

    def test_open_desk_reports_its_hours_without_an_out_of_hours_notice(self):
        state = api(self.farmer).get('/api/desk/state/?channel=support').data
        self.assertTrue(state['is_open'])
        # Persian digits, because the sentence is read by a person, not parsed.
        self.assertEqual(state['hours'], '۰۰:۰۰ تا ۲۳:۵۹')
        self.assertIsNone(state['opens_at'])
        self.assertEqual(state['out_of_hours_note'].count('ساعت کاری'), 1)

    def test_persian_time_window_is_evaluated_in_the_project_timezone(self):
        # A window that only covers the next hour in Tehran must be open even if
        # the server's UTC clock says otherwise.
        now = timezone.localtime()
        self.settings_row.support_start = now.time()
        self.settings_row.support_end = (now + timedelta(hours=1)).time()
        if now.hour == 23 and now.minute > 30:  # keep the window on one calendar day
            self.settings_row.support_start = time(0, 0)
        self.settings_row.save()

        state = api(self.farmer).get('/api/desk/state/?channel=support').data
        self.assertTrue(state['is_open'])

    def test_closed_desk_names_the_next_opening_in_persian(self):
        for key, value in CLOSED_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()

        state = api(self.farmer).get('/api/desk/state/?channel=support').data
        self.assertFalse(state['is_open'])
        self.assertIsNotNone(state['opens_at'])
        # A weekday name and Persian digits, not «Sunday 06:00».
        self.assertRegex(state['opens_at_label'], r'^(شنبه|یکشنبه|دوشنبه|سه\u200cشنبه|چهارشنبه|پنجشنبه|جمعه) ۰۰:۰۰$')

    def test_message_outside_hours_is_answered_by_exactly_one_notice(self):
        for key, value in CLOSED_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()
        conversation = api(self.farmer).post('/api/marketplace/conversations/service/support/').data

        for body in ('پکیج پمپ آب دارید؟', 'قیمت هم ارسال شده؟'):
            api(self.farmer).post(
                f'/api/marketplace/conversations/{conversation["id"]}/messages/',
                {'body': body}, format='json',
            )

        thread = api(self.farmer).get(f'/api/marketplace/conversations/{conversation["id"]}/messages/').data
        notices = [row for row in thread['results'] if row['is_system']]
        self.assertEqual(len(notices), 1, 'a second notice per burst would bury the operator')
        self.assertIn('ساعت کاری', notices[0]['body'])
        # The notice is not unread mail: it was not addressed to the farmer.
        inbox = api(self.farmer).get('/api/marketplace/conversations/').data
        # Only channels with something to badge appear in the map.
        self.assertEqual(inbox['unread_by_channel'].get('support', 0), 0)

    def test_private_storefront_chat_is_never_told_about_desk_hours(self):
        seller, storefront = self._make_storefront('hours-seller')
        conversation = api(self.farmer).post(
            f'/api/marketplace/storefronts/{storefront.slug}/conversation/'
        ).data
        for key, value in CLOSED_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()

        api(self.farmer).post(
            f'/api/marketplace/conversations/{conversation["id"]}/messages/',
            {'body': 'سلام، موجودی؟'}, format='json',
        )
        thread = api(self.farmer).get(f'/api/marketplace/conversations/{conversation["id"]}/messages/').data
        self.assertFalse([row for row in thread['results'] if row['is_system']])

    def _make_storefront(self, username):
        user = User.objects.create_user(username=username, password='safe-password-123')
        return user, Storefront.objects.create(
            user=user, name='غرفه آفتاب', slug=f'ghorfe-{username}',
            province='فارس', city='شیراز',
        )


class PresenceAndDistributionTests(TestCase):
    """Who is at the desk, and which desk gets the next thread."""

    def setUp(self):
        self.farmer = make_farmer('presence-farmer')
        self.settings_row = DeskSettings.load()
        for key, value in OPEN_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()
        self.first = make_operator('presence-agent-1', role=DeskAgent.ROLE_CONSULTING)
        self.second = make_operator('presence-agent-2', role=DeskAgent.ROLE_CONSULTING)

    def test_reading_the_inbox_is_what_makes_an_operator_online(self):
        state = api(self.farmer).get('/api/desk/state/?channel=consulting').data
        self.assertEqual(state['online_count'], 0)
        self.assertFalse(state['agents'][0]['online'])

        api(self.first.user).get('/api/marketplace/conversations/')

        state = api(self.farmer).get('/api/desk/state/?channel=consulting').data
        self.assertEqual(state['online_count'], 1)
        self.assertTrue([agent for agent in state['agents'] if agent['online']][0]['on_duty'])

    def test_staleness_window_comes_from_the_settings_not_the_client(self):
        self.first.user.last_seen_marker = None
        self.first.last_seen_at = timezone.now() - timedelta(minutes=8)
        self.first.save(update_fields=['last_seen_at'])
        self.settings_row.presence_minutes = 5
        self.settings_row.save()
        self.assertFalse(self.first.is_present(self.settings_row))
        self.settings_row.presence_minutes = 30
        self.settings_row.save()
        self.assertTrue(self.first.is_present(self.settings_row))

    def test_a_new_question_is_placed_with_the_operator_who_has_least_work(self):
        busy = StorefrontConversation.objects.create(
            customer=make_farmer('presence-other'), channel=StorefrontConversation.CHANNEL_CONSULTING,
            agent=self.first.user,
        )
        StorefrontMessage.objects.create(conversation=busy, sender=self.first.user, body='پاسخ')

        conversation = api(self.farmer).post('/api/marketplace/conversations/service/consulting/').data

        self.assertEqual(conversation['agent']['name'], self.second.display_label)

    def test_a_follow_up_after_an_answer_is_told_about_the_hours_again(self):
        for key, value in CLOSED_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()
        conversation = api(self.farmer).post('/api/marketplace/conversations/service/support/').data
        url = f'/api/marketplace/conversations/{conversation["id"]}/messages/'
        agent = make_operator('hours-answer', role=DeskAgent.ROLE_SUPPORT)

        api(self.farmer).post(url, {'body': 'صورت حساب را ببینید'}, format='json')
        api(agent.user).post(url, {'body': 'فایل را فرستادم'}, format='json')
        for key, value in CLOSED_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()
        api(self.farmer).post(url, {'body': 'و فاکتور نهایی؟'}, format='json')

        thread = api(self.farmer).get(
            f'/api/marketplace/conversations/{conversation["id"]}/messages/'
        ).data
        self.assertEqual(len([row for row in thread['results'] if row['is_system']]), 2)

    def test_the_whole_desk_can_work_one_thread_without_a_handoff(self):
        conversation = api(self.farmer).post('/api/marketplace/conversations/service/consulting/').data
        for operator in (self.first, self.second):
            listed = api(operator.user).get('/api/marketplace/conversations/').data
            self.assertIn(conversation['id'], [row['id'] for row in listed['results']])

        api(self.second.user).post(
            f'/api/marketplace/conversations/{conversation["id"]}/messages/',
            {'body': 'خاک آزمایش شد؛ از کود فسفره شروع کنید.'}, format='json',
        )
        thread = api(self.farmer).get(f'/api/marketplace/conversations/{conversation["id"]}/messages/').data
        self.assertEqual(thread['results'][-1]['sender_name'], self.second.display_label)

    def test_queue_filters_for_the_staff_view(self):
        conversation = api(self.farmer).post('/api/marketplace/conversations/service/consulting/').data
        StorefrontConversation.objects.filter(pk=conversation['id']).update(agent=self.first.user)

        mine = api(self.first.user).get('/api/desk/queue/?assigned_to=me').data
        unassigned = api(self.second.user).get('/api/desk/queue/?assigned_to=unassigned').data
        self.assertEqual(mine['count'], 1)
        self.assertEqual(unassigned['count'], 0)

    def test_a_customer_cannot_read_the_staff_queue(self):
        response = api(self.farmer).get('/api/desk/queue/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0, 'their own threads come from the inbox endpoint')


class QuickReplyTests(TestCase):
    """Canned lines, per desk and per side of the conversation."""

    def setUp(self):
        self.farmer = make_farmer('reply-farmer')
        self.support = make_operator('reply-support', role=DeskAgent.ROLE_SUPPORT)
        # The shipped defaults are covered by their own test; these filter
        # assertions need a desk they control.
        QuickReply.objects.all().delete()
        QuickReply.objects.create(
            audience=QuickReply.AUDIENCE_CUSTOMER, channel='any',
            label='قیمت عمده', text='قیمت عمده چند است؟', order=1,
        )
        QuickReply.objects.create(
            audience=QuickReply.AUDIENCE_CUSTOMER, channel='consulting',
            text='چطور دوز مصرف را حساب کنم؟', is_first_message_only=True, order=2,
        )
        QuickReply.objects.create(
            audience=QuickReply.AUDIENCE_STAFF, channel='support',
            label='درخواست تصویر', text='میشه تصویر مشکل را بفرستید؟', order=1,
        )
        QuickReply.objects.create(
            audience=QuickReply.AUDIENCE_CUSTOMER, channel='support',
            text='پنهان', is_active=False, order=0,
        )

    def test_customer_sees_the_shared_and_channel_lines_but_not_the_staff_ones(self):
        state = api(self.farmer).get('/api/desk/state/?channel=consulting').data
        labels = [row['label'] for row in state['quick_replies']]
        self.assertEqual(labels, ['قیمت عمده', 'چطور دوز مصرف را حساب کنم؟'])
        self.assertEqual(
            [row['first_message_only'] for row in state['quick_replies']], [False, True],
        )

    def test_support_desk_does_not_inherit_the_consulting_line(self):
        state = api(self.farmer).get('/api/desk/state/?channel=support').data
        self.assertEqual([row['label'] for row in state['quick_replies']], ['قیمت عمده'])

    def test_an_operator_gets_their_own_replies(self):
        state = api(self.support.user).get('/api/desk/state/?channel=support').data
        self.assertTrue(state['viewer_is_staff'])
        self.assertEqual([row['text'] for row in state['quick_replies']], ['میشه تصویر مشکل را بفرستید؟'])

class SeededQuickReplyTests(TestCase):
    """The defaults a fresh install opens with, before anyone edits the desk.

    A canned-message strip that is empty on day one is a feature nobody
    configured; the seed rows are the starting point an admin edits rather than
    a list frozen in the front-end bundle.
    """

    def test_both_desks_have_lines_for_the_farmer_and_for_the_operator(self):
        for audience in (QuickReply.AUDIENCE_CUSTOMER, QuickReply.AUDIENCE_STAFF):
            for channel in (DeskAgent.ROLE_CONSULTING, DeskAgent.ROLE_SUPPORT):
                with self.subTest(audience=audience, channel=channel):
                    self.assertTrue(
                        QuickReply.objects.filter(audience=audience, channel=channel).exists()
                    )

    def test_every_seeded_line_is_a_persian_sentence_with_a_label(self):
        for row in QuickReply.objects.all():
            self.assertTrue(row.text.strip())
            self.assertTrue(
                any('\u0600' <= char <= '\u06FF' for char in row.text),
                f'{row.pk} is not written for a Persian reader',
            )

    def test_the_first_touch_faq_lines_are_marked_as_opening_only(self):
        # The «سلام، خوش آمدید» block is only useful before the conversation has
        # started; mid-thread it is noise, and the flag is what hides it.
        self.assertGreaterEqual(
            QuickReply.objects.filter(
                audience=QuickReply.AUDIENCE_CUSTOMER, is_first_message_only=True,
            ).count(), 1,
        )

    def test_the_seeded_lines_are_editable_and_can_be_switched_off(self):
        row = QuickReply.objects.filter(audience=QuickReply.AUDIENCE_CUSTOMER).first()
        row.is_active = False
        row.save(update_fields=['is_active'])
        state = api(make_farmer('seed-reader')).get('/api/desk/state/?channel=consulting').data
        self.assertNotIn(row.text, [item['text'] for item in state['quick_replies']])


class LandDossierTests(TestCase):
    """Sharing a field's record with the desk instead of describing it."""

    def setUp(self):
        self.farmer = make_farmer('land-farmer')
        self.other_farmer = make_farmer('land-stranger')
        self.consultant = make_operator('land-consultant', role=DeskAgent.ROLE_CONSULTING)
        self.settings_row = DeskSettings.load()
        for key, value in OPEN_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()
        self.land = make_land(self.farmer)
        self.foreign_land = make_land(self.other_farmer, name='مزرعه همسایه')
        self.conversation = api(self.farmer).post(
            '/api/marketplace/conversations/service/consulting/'
        ).data

    def _messages(self):
        return api(self.farmer).get(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/'
        ).data['results']

    def test_land_card_carries_the_facts_a_consultation_needs(self):
        response = api(self.farmer).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'پرونده زمینم را فرستادم.', 'land': self.land.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        card = self._messages()[-1]['land']
        self.assertEqual(card['name'], 'باغ پسته شمالی')
        self.assertEqual(card['crop_type'], 'پسته')
        self.assertIn('2.5', card['area_label'])
        self.assertIn('هکتار', card['area_label'])
        self.assertEqual(card['soil_type_label'], 'شنی')
        self.assertEqual(card['irrigation_type_label'], 'قطره‌ای')
        self.assertEqual(card['owner_name'], self.farmer.username)

    def test_a_land_that_is_not_the_threads_owner_is_not_shared(self):
        response = api(self.farmer).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'زمین همسایه', 'land': self.foreign_land.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('مربوط نیست', response.data['error'])

    def test_a_land_needs_no_body_and_a_body_needs_no_land(self):
        response = api(self.farmer).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'land': self.land.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        empty = api(self.farmer).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/', {}, format='json',
        )
        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_land_card_is_only_for_desk_threads(self):
        _seller, storefront = self._storefront()
        conversation = api(self.farmer).post(
            f'/api/marketplace/storefronts/{storefront.slug}/conversation/'
        ).data
        response = api(self.farmer).post(
            f'/api/marketplace/conversations/{conversation["id"]}/messages/',
            {'body': 'ببین', 'land': self.land.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deleting_the_message_takes_the_dossier_with_it(self):
        message = api(self.farmer).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'فقط تو ببینی', 'land': self.land.id}, format='json',
        ).data
        api(self.farmer).delete(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/{message["id"]}/'
        )
        self.assertIsNone(StorefrontMessage.objects.get(pk=message['id']).land_id)

    def _storefront(self):
        user = User.objects.create_user(username='land-seller', password='safe-password-123')
        return user, Storefront.objects.create(
            user=user, name='غرفه سبز', slug='ghorfe-sabz-land', province='گیلان', city='رشت',
        )


class ClosingAndSurveyTests(TestCase):
    """Ending a conversation, and the only survey that follows it."""

    def setUp(self):
        self.farmer = make_farmer('survey-farmer')
        self.consultant = make_operator('survey-consultant', role=DeskAgent.ROLE_CONSULTING)
        self.settings_row = DeskSettings.load()
        for key, value in OPEN_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()
        self.conversation = api(self.farmer).post(
            '/api/marketplace/conversations/service/consulting/'
        ).data
        self.url = f'/api/desk/conversations/{self.conversation["id"]}'

    def _notices(self):
        thread = api(self.farmer).get(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/'
        ).data
        return [row for row in thread['results'] if row['is_system']]

    def test_an_operator_can_close_and_the_farmer_is_told(self):
        response = api(self.consultant.user).post(
            f'{self.url}/close/', {'note': 'مورد حل شد؛ اگر سؤال داشتید بنویسید.'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'closed')
        self.assertTrue(response.data['survey']['closed'])
        self.assertTrue(response.data['survey']['can_rate'])
        self.assertIn('گفتگو پایان یافت', self._notices()[-1]['body'])

    def test_the_farmer_can_close_it_too(self):
        response = api(self.farmer).post(f'{self.url}/close/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'closed')

    def test_closing_twice_does_not_write_the_notice_twice(self):
        api(self.farmer).post(f'{self.url}/close/', {}, format='json')
        api(self.consultant.user).post(f'{self.url}/close/', {}, format='json')
        self.assertEqual(len([row for row in self._notices() if 'پایان' in row['body']]), 1)

    def test_a_new_question_reopens_the_thread(self):
        api(self.consultant.user).post(f'{self.url}/close/', {}, format='json')
        api(self.farmer).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'یک سؤال دیگر'}, format='json',
        )
        inbox = api(self.farmer).get('/api/marketplace/conversations/').data
        row = [item for item in inbox['results'] if item['id'] == self.conversation['id']][0]
        self.assertEqual(row['status'], 'open')

    def test_the_survey_accepts_one_answer_and_only_from_the_farmer(self):
        too_early = api(self.farmer).post(f'{self.url}/rate/', {'score': 5}, format='json')
        self.assertEqual(too_early.status_code, status.HTTP_400_BAD_REQUEST)

        api(self.farmer).post(f'{self.url}/close/', {}, format='json')
        first = api(self.farmer).post(
            f'{self.url}/rate/', {'score': 4, 'solved': True, 'comment': 'سریع جواب دادید'}, format='json',
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)

        again = api(self.farmer).post(f'{self.url}/rate/', {'score': 1}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

        by_operator = api(self.consultant.user).post(f'{self.url}/rate/', {'score': 5}, format='json')
        self.assertEqual(by_operator.status_code, status.HTTP_403_FORBIDDEN, 'an operator cannot grade themselves')

    def test_a_rating_is_recorded_out_of_range_or_missing_as_invalid(self):
        api(self.farmer).post(f'{self.url}/close/', {}, format='json')
        self.assertEqual(
            api(self.farmer).post(f'{self.url}/rate/', {'score': 6}, format='json').status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            api(self.farmer).post(f'{self.url}/rate/', {}, format='json').status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_the_average_and_solved_rate_follow_the_ratings(self):
        api(self.farmer).post(f'{self.url}/close/', {}, format='json')
        api(self.farmer).post(f'{self.url}/rate/', {'score': 4, 'solved': True}, format='json')

        self.consultant.refresh_from_db()
        self.assertEqual(self.consultant.rating_average, 4)
        self.assertEqual(self.consultant.rating_count, 1)

        report = api(self.consultant.user).get('/api/desk/ratings/?channel=consulting').data
        self.assertEqual(report['window']['ratings'], 1)
        self.assertEqual(report['window']['average'], 4)
        self.assertEqual(report['window']['solved_rate'], 1.0)
        self.assertEqual(report['agents'][0]['agent']['name'], self.consultant.display_label)

    def test_the_report_is_not_public(self):
        self.assertEqual(api(self.farmer).get('/api/desk/ratings/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(api().get('/api/desk/ratings/').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_stranger_cannot_close_someone_elses_thread(self):
        intruder = make_farmer('survey-intruder')
        response = api(intruder).post(f'{self.url}/close/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AgentIdentityTests(TestCase):
    """The name in the header is the person who is actually answering."""

    def setUp(self):
        self.farmer = make_farmer('identity-farmer')
        self.settings_row = DeskSettings.load()
        for key, value in OPEN_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()
        self.assigned = make_operator(
            'identity-1', role=DeskAgent.ROLE_CONSULTING, display_name='دکتر رضایی', title='کارشناس تغذیه',
        )
        self.cover = make_operator(
            'identity-2', role=DeskAgent.ROLE_CONSULTING, display_name='مهندس کریمی', title='کارشناس آفات',
        )
        self.conversation = api(self.farmer).post(
            '/api/marketplace/conversations/service/consulting/'
        ).data
        StorefrontConversation.objects.filter(pk=self.conversation['id']).update(agent=self.assigned.user)

    def _thread(self):
        return api(self.farmer).get(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/'
        ).data

    def test_the_assigned_expert_is_named_with_their_title(self):
        api(self.assigned.user).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'آزمایش برگ دادید؟'}, format='json',
        )
        message = self._thread()['results'][-1]
        self.assertEqual(message['sender_name'], 'دکتر رضایی')
        self.assertEqual(message['sender_role_label'], 'کارشناس تغذیه')
        self.assertNotIn('identity-1', str(message))

    def test_the_header_switches_when_a_colleague_takes_over(self):
        api(self.assigned.user).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'من در دسترس نیستم، همکارم ادامه می‌دهد.'}, format='json',
        )
        api(self.cover.user).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'سلام، من جای دکتر رضایی هستم.'}, format='json',
        )
        row = [item for item in api(self.farmer).get('/api/marketplace/conversations/').data['results']
               if item['id'] == self.conversation['id']][0]
        self.assertEqual(row['agent']['name'], 'دکتر رضایی', 'the assignment is unchanged')
        self.assertEqual(row['last_agent']['name'], 'مهندس کریمی', 'the reader must see who wrote last')
        self.assertEqual(self._thread()['conversation']['last_agent']['title'], 'کارشناس آفات')

    def test_a_notice_has_no_person_attached_to_it(self):
        api(self.farmer).post(f'/api/desk/conversations/{self.conversation["id"]}/close/', {}, format='json')
        notice = self._thread()['results'][-1]
        self.assertTrue(notice['is_system'])
        self.assertEqual(notice['sender_name'], 'گرین کود')
        self.assertFalse(notice['is_mine'])
        self.assertFalse(notice['can_edit'])


class HandoffTests(TestCase):
    """Redirecting a question to the desk that can answer it."""

    def setUp(self):
        self.farmer = make_farmer('handoff-farmer')
        self.settings_row = DeskSettings.load()
        for key, value in OPEN_WINDOW.items():
            setattr(self.settings_row, key, value)
        self.settings_row.save()
        self.support = make_operator('handoff-support', role=DeskAgent.ROLE_SUPPORT)
        self.consultant = make_operator('handoff-consultant', role=DeskAgent.ROLE_CONSULTING)
        self.conversation = api(self.farmer).post(
            '/api/marketplace/conversations/service/support/'
        ).data
        api(self.farmer).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'کودم را که زدم برگ‌ها سوخت؛ چه کار کنم؟'}, format='json',
        )

    def test_support_sends_the_consulting_link_with_a_ready_message(self):
        response = api(self.support.user).post(
            f'/api/desk/conversations/{self.conversation["id"]}/handoff/',
            {'target': 'consulting', 'note': 'این تخصصی است؛ مشاور پاسخ می‌دهد.'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        message = response.data['message']
        self.assertEqual(message['link']['kind'], 'handoff')
        self.assertIn('مشاوره', message['link']['label'])
        self.assertEqual(message['link']['url'], '/messages?channel=consulting')

        thread = api(self.farmer).get(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/'
        ).data
        self.assertEqual(thread['results'][-1]['link']['url'], '/messages?channel=consulting')

    def test_the_receiving_desk_gets_the_question_not_just_a_pointer(self):
        response = api(self.support.user).post(
            f'/api/desk/conversations/{self.conversation["id"]}/handoff/',
            {'target': 'consulting'}, format='json',
        )
        target = api(self.farmer).get(
            f'/api/marketplace/conversations/{response.data["target_conversation_id"]}/messages/'
        ).data
        body = target['results'][-1]['body']
        self.assertIn('کودم را که زدم برگ‌ها سوخت', body)
        self.assertIn('ارجاع از', body)
        self.assertEqual(target['conversation']['agent']['name'], self.consultant.display_label)

    def test_the_farmer_cannot_move_their_own_thread(self):
        response = api(self.farmer).post(
            f'/api/desk/conversations/{self.conversation["id"]}/handoff/', {'target': 'consulting'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_handing_a_thread_to_its_own_desk_is_refused(self):
        response = api(self.support.user).post(
            f'/api/desk/conversations/{self.conversation["id"]}/handoff/', {'target': 'support'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_an_operator_can_put_a_button_in_a_bubble(self):
        api(self.farmer).post(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/',
            {'body': 'لینک من', 'link_url': 'https://example.com/', 'link_label': 'بخر'}, format='json',
        )
        thread = api(self.farmer).get(
            f'/api/marketplace/conversations/{self.conversation["id"]}/messages/'
        ).data
        self.assertIsNone(thread['results'][-1]['link'])


class CommentReplyLinkTests(TestCase):
    """A reply to a comment arrives in the inbox and opens the right page."""

    def setUp(self):
        self.author = User.objects.create_user(username='link-seller', password='safe-password-123')
        self.storefront = Storefront.objects.create(
            user=self.author, name='نهاده‌های سبز', slug='nahade-sabz-link',
            province='گیلان', city='رشت',
        )
        self.post = StorefrontPost.objects.create(
            storefront=self.storefront, caption='کمپوست آماده تحویل', status='published',
        )
        self.farmer = make_farmer('link-farmer')
        self.neighbour = make_farmer('link-neighbour')
        self.category = Category.objects.create(name='کود', slug='link-fertilizer')
        self.seller = User.objects.create_user(username='link-producer', password='safe-password-123')
        self.product = Product.objects.create(
            title='کمپوست', slug='compost-link', author=self.seller, category=self.category,
            price=100_000, status='published', available=True,
        )

    def test_reply_under_a_post_links_to_that_post(self):
        root = StorefrontPostComment.objects.create(
            post=self.post, user=self.farmer, body='قیمت هر کیسه؟',
        )
        response = api(self.neighbour).post(
            f'/api/marketplace/posts/{self.post.id}/comments/',
            {'body': 'کیسه‌ای ۴۵ هزار تومان', 'parent': root.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        inbox = api(self.farmer).get('/api/marketplace/conversations/').data
        row = [item for item in inbox['results'] if item['channel'] == 'comment'][0]
        thread = api(self.farmer).get(f'/api/marketplace/conversations/{row["id"]}/messages/').data
        message = thread['results'][-1]
        self.assertIn('نهاده‌های سبز', message['body'])
        self.assertEqual(
            message['link']['url'],
            f'/storefronts/{self.storefront.slug}?tab=posts&post={self.post.id}&comment={root.id}',
        )

    def test_reply_under_a_product_review_reaches_the_inbox(self):
        root = Comment.objects.create(
            product=self.product, user=self.farmer, name='کشاورز', body='برای مرکبات مناسب است؟',
            rating=4, active=True,
        )
        api(self.neighbour).post(
            '/api/comments/',
            {'product': self.product.id, 'parent': root.id, 'name': 'همسایه',
             'body': 'بله، با آبیاری قطره‌ای عالی است.'},
            format='json',
        )

        inbox = api(self.farmer).get('/api/marketplace/conversations/').data
        row = [item for item in inbox['results'] if item['channel'] == 'comment'][0]
        thread = api(self.farmer).get(f'/api/marketplace/conversations/{row["id"]}/messages/').data
        message = thread['results'][-1]
        self.assertIn('به دیدگاه شما در نظر «کمپوست» پاسخ داد', message['body'])
        self.assertEqual(message['link']['url'], f'/products/{self.product.slug}?comment={root.id}')

    def test_answering_your_own_comment_does_not_notify(self):
        root = StorefrontPostComment.objects.create(post=self.post, user=self.farmer, body='سؤال من')
        StorefrontPostComment.objects.create(
            post=self.post, user=self.farmer, body='جواب خودم', parent=root,
        )
        inbox = api(self.farmer).get('/api/marketplace/conversations/').data
        self.assertEqual([item for item in inbox['results'] if item['channel'] == 'comment'], [])

    def test_a_reply_to_a_guest_comment_does_not_hijack_anyones_inbox(self):
        # The guest whose comment was answered has no account to notify; the
        # reply must still be saved, and no thread may be created for some other
        # user by accident.
        root = Comment.objects.create(
            product=self.product, name='مهمان', email='guest@example.com', body='قیمت؟', active=True,
        )
        response = api(self.neighbour).post(
            '/api/comments/',
            {'product': self.product.id, 'parent': root.id, 'name': 'فروشنده', 'body': '۱۲۰ تومان'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(
            StorefrontConversation.objects.filter(channel=StorefrontConversation.CHANNEL_COMMENT).count(), 0,
        )

