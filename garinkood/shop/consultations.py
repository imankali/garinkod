"""One conversation, two rooms: a consultation request and its messenger thread.

A farmer filing «درخواست مشاوره» in مزرعه من used to create a row in a queue that
only a consultant could see, and a chat opened from the same farmer's profile was
a *different* object entirely. So the two sides talked past each other: an answer
typed in the consulting panel never appeared in the messenger, and a follow-up
asked in the messenger never reached the panel.

The rule this module enforces is that the consultation and the thread are the
same conversation seen from two entrances:

* filing a request opens (or reuses) the farmer's consulting thread and posts the
  question there, carrying the land it is about;
* answering in the panel appends the answer to that thread, so the farmer gets it
  where they already read messages;
* answering in the thread marks the open request answered, so a consultant never
  has to write the same sentence twice and the queue never shows a stale «در
  انتظار پاسخ».

Everything here is deliberately best-effort: a consultation must still be filed
even if the messenger side is disabled, so callers wrap these in try/except or the
functions swallow their own failures. A missing chat is an inconvenience; a lost
request is data loss.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

CONSULTING_CHANNEL = 'consulting'


def _thread_for(consultation, *, subject: str = ''):
    """The farmer's consulting thread, created on demand."""
    from .notifications import get_or_create_service_thread

    return get_or_create_service_thread(
        consultation.farmer, CONSULTING_CHANNEL, subject=subject or _subject(consultation)
    )


def _subject(consultation) -> str:
    land = getattr(consultation, 'land', None)
    label = consultation.get_subject_display() if hasattr(consultation, 'get_subject_display') else ''
    return f'{label} — {land.name}' if land else (label or 'مشاوره')


def open_consultation_thread(consultation) -> int | None:
    """Mirror a freshly filed request into the messenger as the first message.

    Returns the conversation id so the caller can hand the farmer a link
    («گفتگو را باز کنید») instead of making them hunt for it in the inbox.
    """
    from .models import StorefrontMessage

    try:
        conversation = _thread_for(consultation)
    except Exception:  # pragma: no cover - a broken inbox must not eat the request
        logger.exception('consultation %s: could not open the consulting thread', consultation.pk)
        return None

    # The request row stamps its own id on the message, so re-saving the
    # consultation — a retry, a PATCH, an admin edit — can never post the same
    # question into the chat a second time.
    if StorefrontMessage.objects.filter(consultation=consultation).exists():
        return conversation.pk

    message = StorefrontMessage.objects.create(
        conversation=conversation,
        sender=consultation.farmer,
        body=(consultation.message or '').strip()[:2000],
        land=consultation.land,
        consultation=consultation,
    )
    # The inbox sorts by the thread's own timestamp, so a message written outside
    # the view has to bump it — otherwise a new consultation question would sit
    # quietly in the middle of the list.
    conversation.save(update_fields=['updated_at'])
    return conversation.pk


def mirror_answer_in_thread(consultation, reply: str, *, author) -> bool:
    """Append a panel answer to the thread. Safe to call with no thread yet."""
    from .models import StorefrontMessage

    text = (reply or '').strip()
    if not text:
        return False
    try:
        conversation = _thread_for(consultation)
        StorefrontMessage.objects.create(
            conversation=conversation,
            sender=author,
            body=text[:2000],
            land=consultation.land,
            consultation=consultation,
            link_kind='consulting',
            link_label='پاسخ در پنل مشاوره',
            link_url='/farmers?tab=consulting',
        )
        conversation.save(update_fields=['updated_at'])
    except Exception:  # pragma: no cover
        logger.exception('consultation %s: could not mirror the answer in the thread', consultation.pk)
        return False
    return True


def answer_open_consultation(message) -> list[int]:
    """Mark the request a thread reply answers as answered.

    Called after a staff message lands in a consulting thread. The land the
    message carries picks the request when it can — a farmer with three fields
    asks about one of them at a time — and the newest open request is the fallback.
    Returns the ids it closed so the caller can expose them to the client.
    """
    from .models import FarmConsultationRequest

    conversation = getattr(message, 'conversation', None)
    if conversation is None or conversation.channel != CONSULTING_CHANNEL:
        return []
    if message.sender_id == conversation.customer_id:
        # The farmer's own follow-up is not an answer to themselves.
        return []

    queryset = FarmConsultationRequest.objects.filter(
        farmer_id=conversation.customer_id, status='pending'
    )
    target = None
    if message.land_id:
        target = queryset.filter(land_id=message.land_id).order_by('-created_at').first()
    if target is None:
        target = queryset.order_by('-created_at').first()
    if target is None:
        return []

    text = (message.body or '').strip()
    if not text:
        return []
    previous = (target.reply or '').strip()
    target.reply = (f'{previous}\n\n{text}' if previous else text)[:3000]
    target.status = 'answered'
    target.replied_by_id = message.sender_id
    target.save(update_fields=['reply', 'status', 'replied_by', 'updated_at'])
    if message.consultation_id is None:
        type(message).objects.filter(pk=message.pk).update(consultation=target.pk)
    return [target.pk]
