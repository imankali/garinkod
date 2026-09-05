"""Delivery of platform notifications into the unified inbox.

Every part of the platform that needs to reach a user — support, agricultural
consulting, a reply to their comment — writes into the same
``StorefrontConversation``/``StorefrontMessage`` pair that storefront chat
already uses, distinguished by ``channel``.

Doing it this way, rather than adding a separate notifications table, means a
user has exactly one place to look for anything addressed to them, every
message keeps its provenance ("پشتیبانی", "غرفه", …), and replying to a
notification is just replying in a thread.

A notification also carries where it came from: the row it was written about is
posted as a link on the message, so tapping the line in the inbox lands the
reader on the exact post or product page — finding their own comment again is
not their job.
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
    link: dict | None = None,
    is_notice: bool = False,
) -> StorefrontMessage:
    """Append a message and bump the thread so it sorts to the top of the inbox.

    ``link`` is ``{'kind': …, 'label': …, 'url': …}`` — the button rendered
    inside the bubble that takes the reader to whatever the message is about.
    """
    message = StorefrontMessage(
        conversation=conversation,
        sender=sender,
        body=body[:2000],
        listing=listing,
        is_notice=is_notice,
    )
    if link:
        message.link_kind = (link.get('kind') or 'link')[:20]
        message.link_label = (link.get('label') or 'مشاهده')[:120]
        message.link_url = (link.get('url') or '')[:300]
    message.save()
    # `updated_at` is auto_now, so an empty save refreshes the ordering key.
    conversation.save(update_fields=['updated_at'])
    return message


def comment_target(comment):
    """Where a comment lives, as ``(label, kind, url)`` for a notification.

    Both kinds of comment are answered here — a post in the marketplace and a
    product review — because a reply matters the same to whoever asked, and each
    has to send the reader somewhere different. The URL carries the id of the
    *parent* comment so the page opens scrolled to the reader's own line instead
    of the top of a thread they would have to hunt through.
    """
    parent_id = comment.parent_id or comment.id
    post = getattr(comment, 'post', None)
    if post is not None:
        return (
            f'پست «{post.storefront.name}»',
            'post',
            f'/storefronts/{post.storefront.slug}?tab=posts&post={post.id}&comment={parent_id}',
        )
    product = getattr(comment, 'product', None)
    if product is not None:
        return (
            f'نظر «{product.title}»',
            'product',
            f'/products/{product.slug}?comment={parent_id}',
        )
    return 'دیدگاه شما', 'comment', ''


def notify_comment_reply(comment) -> StorefrontMessage | None:
    """Tell the author of a comment that someone replied to it.

    The notification lands in the ``comment`` channel so the inbox can label it
    "پاسخ به دیدگاه" and the reader immediately knows where it came from, rather
    than seeing a bare message from a stranger.

    Two details are deliberate. A reply written by a logged-in reader's own
    successor on a guest comment has no account to attribute, so the guest's name
    is used in the text. And the message is authored, not system-generated: it
    must raise the unread badge, which a desk notice («گفتگو بسته شد»)
    deliberately does not.
    """
    parent = comment.parent
    if parent is None or parent.user_id is None or parent.user_id == comment.user_id:
        return None

    conversation, _created = StorefrontConversation.objects.get_or_create(
        customer=parent.user,
        channel=StorefrontConversation.CHANNEL_COMMENT,
        defaults={'subject': 'پاسخ به دیدگاه‌های شما'},
    )

    if comment.user_id:
        author = comment.user.get_full_name() or comment.user.username
    else:
        author = getattr(comment, 'name', '') or 'یکی از کاربران'
    subject_label, kind, url = comment_target(comment)
    body = f'{author} به دیدگاه شما در {subject_label} پاسخ داد:\n«{comment.body[:120]}»'
    return post_system_message(
        conversation,
        comment.user,
        body,
        link={'kind': kind, 'label': 'دیدن پاسخ', 'url': url} if url else None,
    )


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
