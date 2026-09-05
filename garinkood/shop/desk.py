"""Shared behaviour of the two service desks (consulting and support).

Everything the desks agree on lives here rather than in the views, because the
same rules apply from three directions: the customer's chat window, the staff
queue, and the notification written when a comment gets a reply.

The rules:

* **Duty** — the desk answers inside its published hours
  (:class:`~shop.models.DeskSettings`, compared in the project timezone so
  «۶ صبح» means six in the morning for the farmer). An individual operator can
  narrow that with their own shift.
* **Presence** — «آنلاین» is not a status anyone sets; it is whether the
  operator touched the desk within the last few minutes. Saying "online" when
  nobody is there is worse than saying nothing.
* **Distribution** — a service thread is visible to every operator of its desk
  (a queue), but it is *assigned* to the person with the fewest open threads so
  one consultant does not collect the whole morning.
* **The desk answers in its own name** — a notice written by the platform has no
  sender, so the reader can tell an automatic line from a person's reply.
"""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import DeskAgent, DeskSettings, QuickReply, StorefrontConversation, StorefrontMessage
from .persian import datetime_label

CHANNEL_LABELS = {
    StorefrontConversation.CHANNEL_CONSULTING: 'مشاوره کشاورزی',
    StorefrontConversation.CHANNEL_SUPPORT: 'پشتیبانی',
}

# The desk channel a thread belongs to, for the two queues operators work.
DESK_CHANNELS = {
    StorefrontConversation.CHANNEL_CONSULTING: DeskAgent.ROLE_CONSULTING,
    StorefrontConversation.CHANNEL_SUPPORT: DeskAgent.ROLE_SUPPORT,
}


def desk_channel(channel: str) -> str | None:
    """The roster role a thread's channel maps to, or None for private chats."""
    return DESK_CHANNELS.get(channel)


def roster(channel: str):
    """Active operators of one desk, in display order."""
    role = desk_channel(channel)
    queryset = DeskAgent.objects.select_related('user', 'user__account')
    if role is None:
        return queryset.none()
    return queryset.filter(role=role, is_active=True)


def touch_presence(user) -> None:
    """Stamp "this operator is at their desk right now".

    Called from the inbox read path rather than from a heartbeat endpoint: an
    operator working the queue is polling it anyway, and a client that has to
    remember to ping is a client that eventually does not.
    """
    if not getattr(user, 'is_authenticated', False):
        return
    now = timezone.now()
    DeskAgent.objects.filter(user=user, is_active=True).update(last_seen_at=now)


def agent_payload(agent: DeskAgent, settings_row: DeskSettings, moment) -> dict:
    return {
        'id': agent.id,
        'name': agent.display_label,
        'title': agent.title,
        'photo_url': agent.photo_url,
        'role': agent.role,
        'specialties': agent.specialty_list,
        'on_duty': agent.is_on_duty(settings_row, moment),
        'online': agent.is_on_duty(settings_row, moment) and agent.is_present(settings_row, moment),
        'open_threads': agent.open_threads().count(),
        'rating_average': agent.rating_average,
        'rating_count': agent.rating_count,
    }


def quick_replies(channel: str, audience: str) -> list[dict]:
    """Tap-to-send lines for one desk, whatever audience is looking at it."""
    rows = QuickReply.objects.filter(
        is_active=True, audience=audience,
    ).filter(Q(channel='any') | Q(channel=channel)).order_by('order', 'id')
    return [
        {
            'id': row.id,
            'label': row.label or row.text[:60],
            'text': row.text,
            'first_message_only': row.is_first_message_only,
        }
        for row in rows
    ]


def next_open_moment(channel: str, settings_row: DeskSettings, now=None):
    """The exact moment the desk next opens, or ``None`` if it never will.

    The label a farmer sees («بازگشایی: شنبه ۰۶:۰۰») has to be the configured
    opening time, not the nearest quarter-hour the code happened to test, so
    this walks day by day and compares against ``window_for`` instead of
    sampling :meth:`DeskSettings.is_open_at`.
    """
    moment = now or timezone.localtime()
    start, _end = settings_row.window_for(channel)
    for offset in range(8):
        day = moment + timedelta(days=offset)
        if settings_row.platform_day_index(day) not in settings_row.work_day_indexes:
            continue
        opening = day.replace(hour=start.hour, minute=start.minute, second=0, microsecond=0)
        if opening > moment:
            return opening
    return None


def next_open_at(channel: str, settings_row: DeskSettings, now=None) -> str | None:
    """:func:`next_open_moment` as an ISO string, for the chat header and banner."""
    opening = next_open_moment(channel, settings_row, now)
    return opening.isoformat() if opening else None


def desk_state(channel: str, *, user=None) -> dict:
    """One object that answers "who is there, and when do they answer?".

    The chat header, the composer's chips and the out-of-hours banner are all
    driven from this, so three surfaces cannot disagree about whether the desk is
    open.
    """
    settings_row = DeskSettings.load()
    now = timezone.localtime()
    role = desk_channel(channel)
    is_open = settings_row.is_open_at(channel, now) if role else True

    agents = [
        agent_payload(agent, settings_row, now)
        for agent in (roster(channel).order_by('order', 'display_name', 'id') if role else DeskAgent.objects.none())
    ]
    present = [agent for agent in agents if agent['online']]
    on_duty = [agent for agent in agents if agent['on_duty']]

    viewer_is_staff = bool(user and role and (user.is_superuser or _is_operator(user, channel)))

    return {
        'channel': channel,
        'channel_label': CHANNEL_LABELS.get(channel, ''),
        'is_open': is_open,
        'tracked': bool(settings_row.is_active and role),
        'hours': settings_row.hours_label(channel) if role else '',
        'work_days': [label for value, label in DeskSettings.DAY_CHOICES if value in settings_row.work_day_indexes],
        'opens_at': next_open_at(channel, settings_row, now) if not is_open and role else None,
        'opens_at_label': (
            datetime_label(next_open_moment(channel, settings_row, now))
            if (not is_open and role) else ''
        ),
        'now': now.isoformat(),
        'out_of_hours_note': settings_row.out_of_hours_note if role else '',
        'online_count': len(present),
        # "Someone is working their desk right now" is the useful answer for a
        # farmer; an exact head count of staff would only invite a wait.
        'waiting_expected_minutes': 5 if present else (20 if on_duty else 120),
        'agents': agents,
        'viewer_is_staff': viewer_is_staff,
        'quick_replies': quick_replies(channel, 'staff' if viewer_is_staff else 'customer'),
    }


OPERATOR_PERMISSIONS = {
    StorefrontConversation.CHANNEL_SUPPORT: 'shop.view_platformfeedback',
    StorefrontConversation.CHANNEL_CONSULTING: 'shop.view_farmconsultationrequest',
}


def _is_operator(user, channel: str) -> bool:
    permission = OPERATOR_PERMISSIONS.get(channel)
    return bool(permission and user.has_perm(permission))


def is_operator_for(user, channel: str) -> bool:
    """Whether `user` may answer threads of this desk."""
    return bool(getattr(user, 'is_superuser', False) or _is_operator(user, channel))


def customer_of(conversation: StorefrontConversation):
    return conversation.customer


@transaction.atomic
def assign_thread(conversation: StorefrontConversation, *, force: bool = False) -> DeskAgent | None:
    """Give an unassigned service thread to the least-loaded operator on duty.

    Everyone in the desk still sees the thread — an assignment is a workload
    hint, not a lock — and the round-robin only matters while nobody has picked
    the thread up yet.
    """
    role = desk_channel(conversation.channel)
    if role is None:
        return None
    if conversation.agent_id and not force:
        return None

    settings_row = DeskSettings.load()
    now = timezone.localtime()
    candidates = list(roster(conversation.channel))
    if not candidates:
        return None

    def load(agent: DeskAgent) -> int:
        return agent.open_threads().count()

    available = [agent for agent in candidates if agent.is_on_duty(settings_row, now)]
    pool = available or candidates
    if conversation.agent_id:
        current = next((agent for agent in candidates if agent.user_id == conversation.agent_id), None)
        if current is not None and (current.is_on_duty(settings_row, now) or not available):
            return current

    limits = [
        (load(agent), agent.order, agent.id, agent)
        for agent in pool
        if not agent.max_open_threads or load(agent) < agent.max_open_threads
    ]
    if not limits:
        limits = [(load(agent), agent.order, agent.id, agent) for agent in pool]
    if not limits:
        return None
    _count, _order, _id, chosen = min(limits)

    updates = []
    if conversation.agent_id != chosen.user_id:
        conversation.agent = chosen.user
        updates.append('agent')
    if not conversation.subject and chosen.display_label:
        conversation.subject = CHANNEL_LABELS.get(conversation.channel, '')
    if updates:
        conversation.save(update_fields=[*updates, 'updated_at'])
    return chosen


def post_notice(conversation: StorefrontConversation, body: str) -> StorefrontMessage:
    """A centred line from the platform, with no author to reply to.

    ``is_notice`` is what keeps it out of the unread badge: the thread says
    «گفتگو بسته شد» so the reader knows the state changed, and a red number on
    that would teach them to ignore real messages.
    """
    message = StorefrontMessage.objects.create(
        conversation=conversation, sender=None, body=body[:2000], is_notice=True,
    )
    conversation.save(update_fields=['updated_at'])
    return message


def announce_out_of_hours(conversation: StorefrontConversation) -> StorefrontMessage | None:
    """Tell a farmer the desk is closed, once per burst of their messages.

    Without the "once" guard every new message would add another notice to the
    thread and the operator would read a wall of boilerplate.
    """
    role = desk_channel(conversation.channel)
    if role is None:
        return None
    settings_row = DeskSettings.load()
    if not settings_row.is_active or settings_row.is_open_at(conversation.channel):
        return None

    last_notice = conversation.messages.filter(is_notice=True).order_by('-created_at').first()
    last_question = conversation.messages.filter(
        sender_id=conversation.customer_id, is_notice=False,
    ).order_by('-created_at').first()
    if last_question is None:
        return None
    # One notice per burst: if the desk already told this farmer it is closed
    # after their latest message, saying it again is noise, not information.
    if last_notice is not None and last_notice.created_at > last_question.created_at:
        return None

    opening = next_open_moment(conversation.channel, settings_row)
    note = settings_row.out_of_hours_note.strip()
    if opening is not None:
        note = f'{note}\nبازگشایی: {datetime_label(opening)} — وقت ایران.'
    return post_notice(conversation, note)


def survey_prompt(conversation: StorefrontConversation) -> dict:
    """What the customer should be shown after the thread was closed."""
    rating = conversation.ratings.order_by('-created_at').first()
    agent = None
    if conversation.agent_id:
        agent = DeskAgent.for_user(
            conversation.agent, desk_channel(conversation.channel),
        )
    return {
        'closed': conversation.is_closed,
        'closed_at': conversation.closed_at.isoformat() if conversation.closed_at else None,
        'can_rate': bool(conversation.is_closed and rating is None),
        'agent': agent_payload(agent, DeskSettings.load(), timezone.localtime()) if agent else None,
        'rating': None if rating is None else {
            'score': rating.score,
            'solved': rating.solved,
            'comment': rating.comment,
            'created_at': rating.created_at.isoformat(),
        },
    }
