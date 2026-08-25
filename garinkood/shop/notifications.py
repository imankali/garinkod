"""Delivery of platform notifications into the unified inbox.

Every part of the platform that needs to reach a user — support, agricultural
consulting, a reply to their comment — writes into the same
``StorefrontConversation``/``StorefrontMessage`` pair that storefront chat
already uses, distinguished by ``channel``.

Doing it this way, rather than adding a separate notifications table, means a
user has exactly one place to look for anything addressed to them, every
message keeps its provenance ("پشتیبانی", "غرفه", …), and replying to a
notification is just replying in a thread.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model

from .models import StorefrontConversation, StorefrontMessage

User = get_user_model()


def get_or_create_service_thread(
    user,
    channel: str,
    *,
    subject: str = '',
    agent=None,
) -> StorefrontConversation:
    """The user's single thread for a service channel, created on demand.

    Support and consulting are continuous relationships rather than one thread
    per ticket, so a user's history with each desk stays in one place. The
    uniqueness constraint on (customer, channel) enforces that at the database
    level; this helper is the matching read path.
    """
    conversation, created = StorefrontConversation.objects.get_or_create(
        customer=user,
        channel=channel,
        defaults={'subject': subject, 'agent': agent},
    )
    updates = []
    if subject and not conversation.subject:
        conversation.subject = subject
        updates.append('subject')
    if agent is not None and conversation.agent_id is None:
        conversation.agent = agent
        updates.append('agent')
    if updates and not created:
        conversation.save(update_fields=updates)
    return conversation


def post_system_message(
    conversation: StorefrontConversation,
    sender,
    body: str,
    *,
    listing=None,
) -> StorefrontMessage:
    """Append a message and bump the thread so it sorts to the top of the inbox."""
    message = StorefrontMessage.objects.create(
        conversation=conversation,
        sender=sender,
        body=body[:2000],
        listing=listing,
    )
    # `updated_at` is auto_now, so an empty save refreshes the ordering key.
    conversation.save(update_fields=['updated_at'])
    return message


def notify_comment_reply(comment) -> StorefrontMessage | None:
    """Tell the author of a comment that someone replied to it.

    The notification lands in the ``comment`` channel so the inbox can label it
    "پاسخ به دیدگاه" and the reader immediately knows where it came from,
    rather than seeing a bare message from a stranger.
    """
    parent = comment.parent
    if parent is None or parent.user_id == comment.user_id:
        return None

    conversation, _created = StorefrontConversation.objects.get_or_create(
        customer=parent.user,
        channel=StorefrontConversation.CHANNEL_COMMENT,
        defaults={'subject': 'پاسخ به دیدگاه‌های شما'},
    )

    author = comment.user.get_full_name() or comment.user.username
    storefront_name = comment.post.storefront.name
    excerpt = comment.body[:120]
    body = (
        f'{author} به دیدگاه شما در پست «{storefront_name}» پاسخ داد:\n'
        f'«{excerpt}»'
    )
    return post_system_message(conversation, comment.user, body)


def notify_support(user, body: str, *, sender=None, subject: str = '') -> StorefrontMessage:
    """Send a message to a user from the support desk."""
    conversation = get_or_create_service_thread(
        user, StorefrontConversation.CHANNEL_SUPPORT, subject=subject or 'پشتیبانی گرین کود'
    )
    return post_system_message(conversation, sender or user, body)


def notify_consulting(user, body: str, *, sender=None, subject: str = '') -> StorefrontMessage:
    """Send a message to a farmer from the agricultural consulting desk."""
    conversation = get_or_create_service_thread(
        user,
        StorefrontConversation.CHANNEL_CONSULTING,
        subject=subject or 'پشتیبانی کشاورزان',
        agent=sender,
    )
    return post_system_message(conversation, sender or user, body)
