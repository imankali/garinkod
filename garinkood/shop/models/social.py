"""Social domain models for the shop app (split from models.py)."""

from datetime import time, timedelta

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from .marketplace import MarketplaceListing, Storefront



class StorefrontPost(models.Model):
    POST_TYPE_CHOICES = (
        ('post', 'پست'),
        ('story', 'استوری'),
    )
    STATUS_CHOICES = (
        ('draft', 'پیش‌نویس'),
        ('pending_review', 'در انتظار بررسی'),
        ('published', 'منتشر شده'),
        ('rejected', 'رد شده'),
        ('archived', 'بایگانی'),
    )

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='posts')
    listing = models.ForeignKey(MarketplaceListing, null=True, blank=True, on_delete=models.SET_NULL, related_name='posts')
    post_type = models.CharField(max_length=12, choices=POST_TYPE_CHOICES, default='post')
    caption = models.TextField(max_length=2200)
    image = models.ImageField(upload_to='storefront-posts/%Y/%m/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'پست غرفه'
        verbose_name_plural = 'پست‌ها و استوری‌های غرفه'

    def __str__(self):
        return f'{self.storefront.name} — {self.get_post_type_display()}'

    def save(self, *args, **kwargs):
        """Give new stories a 24-hour lifetime unless one was supplied."""
        if self.post_type == 'story' and self.expires_at is None:
            self.expires_at = timezone.now() + timedelta(hours=24)
            update_fields = kwargs.get('update_fields')
            if update_fields is not None:
                kwargs['update_fields'] = set(update_fields) | {'expires_at'}
        super().save(*args, **kwargs)

    @property
    def image_url(self):
        return self.image.url if self.image else '/images/hero-farm.jpg'


class StorefrontPostLike(models.Model):
    """One "like" on a storefront post.

    A row per (post, user) with a unique constraint is what makes the like
    idempotent: tapping twice cannot inflate the count, and the current user's
    own state is a cheap existence check rather than a stored flag that could
    drift from the tally.
    """

    post = models.ForeignKey(StorefrontPost, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='liked_storefront_posts'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'پسند پست غرفه'
        verbose_name_plural = 'پسندهای پست غرفه'
        constraints = [
            models.UniqueConstraint(fields=['post', 'user'], name='unique_storefront_post_like'),
        ]

    def __str__(self):
        return f'{self.user} ♥ {self.post_id}'


class StorefrontPostComment(models.Model):
    """A comment on a storefront post, optionally replying to another comment.

    Replies are one level deep by design: `parent` is normalised to the root
    comment in `save()`, so a thread stays a flat list of answers under a top
    comment instead of an unbounded nesting chain no phone screen can show.
    """

    post = models.ForeignKey(StorefrontPost, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='storefront_post_comments'
    )
    parent = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies'
    )
    body = models.TextField(max_length=1000)
    is_hidden = models.BooleanField(default=False, db_index=True, verbose_name='پنهان شده')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('created_at',)
        verbose_name = 'نظر پست غرفه'
        verbose_name_plural = 'نظرات پست غرفه'
        indexes = [models.Index(fields=['post', 'created_at'])]

    def save(self, *args, **kwargs):
        # Flatten deeper nesting: a reply to a reply belongs to the same root.
        if self.parent is not None and self.parent.parent_id is not None:
            self.parent = self.parent.parent
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user}: {self.body[:40]}'


class StorefrontStoryView(models.Model):
    """Records that a viewer has seen a story.

    This is what drives the Instagram-style ring: unseen stories get the
    coloured ring, seen ones the grey one. Keeping it server-side (rather than
    in localStorage) means the state follows the user across devices.
    """

    post = models.ForeignKey(StorefrontPost, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='seen_stories'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'بازدید استوری'
        verbose_name_plural = 'بازدیدهای استوری'
        constraints = [
            models.UniqueConstraint(fields=['post', 'user'], name='unique_story_view'),
        ]

    def __str__(self):
        return f'{self.user} 👁 {self.post_id}'


class StorefrontConversation(models.Model):
    """One thread in the unified inbox.

    Originally this was only "buyer ↔ storefront", and it still is for the
    ``storefront`` channel. It now also carries the other places the platform
    talks to a user — support, agricultural consulting and comment replies —
    because a person wants *one* inbox, not four places to check for a reply.

    ``channel`` is what the UI labels each thread with ("پشتیبانی", "غرفه",
    …) so the reader can always tell where a message came from. ``storefront``
    is therefore nullable: only storefront threads have one.
    """

    CHANNEL_STOREFRONT = 'storefront'
    CHANNEL_SUPPORT = 'support'
    CHANNEL_CONSULTING = 'consulting'
    CHANNEL_COMMENT = 'comment'

    CHANNEL_CHOICES = (
        (CHANNEL_STOREFRONT, 'غرفه'),
        (CHANNEL_SUPPORT, 'پشتیبانی'),
        (CHANNEL_CONSULTING, 'پشتیبانی کشاورزان'),
        (CHANNEL_COMMENT, 'پاسخ به دیدگاه'),
    )

    channel = models.CharField(
        max_length=20, choices=CHANNEL_CHOICES, default=CHANNEL_STOREFRONT, db_index=True,
        verbose_name='کانال',
    )
    storefront = models.ForeignKey(
        Storefront, null=True, blank=True, on_delete=models.CASCADE, related_name='conversations'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='storefront_conversations'
    )
    # Staff side of a support/consulting thread. Left null while unassigned so
    # any authorised operator can pick the thread up.
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='handled_conversations', verbose_name='کارشناس',
    )
    subject = models.CharField(max_length=150, blank=True, verbose_name='موضوع')
    # A thread can be ended by either side. It stays writable — closing is not
    # an archive, it is the signal that starts the satisfaction survey, and a
    # farmer who remembers one more question must be able to ask it.
    STATUS_OPEN = 'open'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = (
        (STATUS_OPEN, 'باز'),
        (STATUS_CLOSED, 'بسته شده'),
    )
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True,
        verbose_name='وضعیت گفتگو',
    )
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name='بسته شد در')
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='closed_conversations', verbose_name='بسته شده توسط',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'گفتگو'
        verbose_name_plural = 'گفتگوها'
        constraints = [
            # Still exactly one storefront thread per (storefront, customer).
            # Scoped to the storefront channel so the other channels — which
            # have no storefront — are not all collapsed into a single row.
            models.UniqueConstraint(
                fields=['storefront', 'customer'],
                condition=Q(channel='storefront'),
                name='unique_storefront_customer_conversation',
            ),
            models.UniqueConstraint(
                fields=['customer', 'channel'],
                condition=Q(channel__in=['support', 'consulting']),
                name='unique_customer_service_conversation',
            ),
            models.CheckConstraint(
                condition=Q(channel='storefront', storefront__isnull=False)
                | (~Q(channel='storefront') & Q(storefront__isnull=True)),
                name='storefront_channel_requires_storefront',
            ),
        ]

    def __str__(self):
        counterpart = self.storefront.name if self.storefront else self.get_channel_display()
        return f'{counterpart} ↔ {self.customer.username}'

    @property
    def channel_label(self) -> str:
        return self.get_channel_display()

    def is_participant(self, user) -> bool:
        """Whether `user` may read and write in this thread.

        Storefront threads are private to the two parties. Support and
        consulting threads are additionally open to staff, which is what lets
        any operator answer without a hand-off step.
        """
        if not user or not user.is_authenticated:
            return False
        if user.id == self.customer_id:
            return True
        if self.storefront_id and user.id == self.storefront.user_id:
            return True
        if self.channel in {self.CHANNEL_SUPPORT, self.CHANNEL_COMMENT}:
            return bool(user.is_superuser or user.has_perm('shop.view_platformfeedback'))
        if self.channel == self.CHANNEL_CONSULTING:
            return bool(user.is_superuser or user.has_perm('shop.view_farmconsultationrequest'))
        return False

    def unread_count_for(self, user) -> int:
        """Messages the given participant has not read yet.

        Notices the platform wrote for the desk side (an out-of-hours line after
        a farmer's message, for instance) are not counted against the farmer:
        they were not addressed to them.
        """
        if not user.is_authenticated:
            return 0
        return self.messages.filter(is_read=False, is_notice=False).exclude(sender=user).count()

    def last_message(self):
        return self.messages.order_by('-created_at').first()

    @property
    def is_closed(self) -> bool:
        return self.status == self.STATUS_CLOSED

    def close(self, *, by=None):
        """End the thread. Idempotent, so two operators tapping «اتمام» cannot fight."""
        if self.status == self.STATUS_CLOSED:
            return self
        self.status = self.STATUS_CLOSED
        self.closed_at = timezone.now()
        self.closed_by = by
        self.save(update_fields=['status', 'closed_at', 'closed_by', 'updated_at'])
        return self

    def reopen(self, *, by=None):
        if self.status == self.STATUS_OPEN:
            return self
        self.status = self.STATUS_OPEN
        self.closed_at = None
        self.closed_by = by
        self.save(update_fields=['status', 'closed_at', 'closed_by', 'updated_at'])
        return self

    def is_open_now(self, moment=None) -> bool:
        """Whether the desk behind this thread answers right now.

        A storefront negotiation or a comment reply is between two people, not a
        staffed queue, so it counts as open: the working hours belong to the two
        service desks only.
        """
        if self.channel not in {self.CHANNEL_SUPPORT, self.CHANNEL_CONSULTING}:
            return True
        # Imported lazily: desk.py imports StorefrontConversation from this
        # module, so a top-level import here would close a cycle.
        from .desk import DeskSettings

        return DeskSettings.load().is_open_at(self.channel, moment)

    def latest_agent_message(self):
        """The staff member who answered last, if any.

        The thread has one ``agent`` for assignment, but a queue is shared: when
        a second operator replies, the reader must see *that* person's name and
        photo in the header instead of the original assignee.
        """
        return (
            self.messages.exclude(sender=None)
            .exclude(sender_id=self.customer_id)
            .order_by('-created_at')
            .select_related('sender', 'sender__account')
            .first()
        )


def message_attachment_path(instance, filename):
    """Group attachments by kind and month so the media tree stays navigable."""
    return f'messages/{instance.attachment_type or "file"}/%Y/%m/{filename}'.replace(
        '%Y/%m', timezone.now().strftime('%Y/%m')
    )


class StorefrontMessage(models.Model):
    """One message in a conversation.

    ``listing`` attaches a marketplace product the buyer is asking about, so
    the owner sees exactly which offering the question refers to.

    ``attachment`` carries a voice note, photo or short video. The kind is
    stored explicitly rather than sniffed from the extension at render time,
    so the client always knows which player to mount.
    """

    ATTACHMENT_IMAGE = 'image'
    ATTACHMENT_VIDEO = 'video'
    ATTACHMENT_AUDIO = 'audio'
    ATTACHMENT_CHOICES = (
        (ATTACHMENT_IMAGE, 'تصویر'),
        (ATTACHMENT_VIDEO, 'ویدیو'),
        (ATTACHMENT_AUDIO, 'صدا'),
    )

    conversation = models.ForeignKey(
        StorefrontConversation, on_delete=models.CASCADE, related_name='messages'
    )
    # Nullable because the desk also writes its own notices («گفتگو بسته شد»،
    # «خارج از ساعت کاری»); those have no author, and pretending the farmer sent
    # them would put words in the wrong mouth.
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='sent_storefront_messages',
    )
    body = models.TextField(max_length=2000, blank=True)
    listing = models.ForeignKey(
        MarketplaceListing, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='direct_messages',
    )
    # A farmer sharing their land case file with a consultant: the real record,
    # not a screenshot, so the consultant reads the soil and calendar data that
    # the identification form holds.
    land = models.ForeignKey(
        'FarmLand', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='shared_in_messages', verbose_name='پرونده زمین',
    )
    # A deep link rendered as a button inside the bubble — «مشاهده پست» after a
    # comment reply, or «گفتگو با مشاور» when support hands a question over.
    link_kind = models.CharField(max_length=20, blank=True, verbose_name='نوع لینک')
    link_label = models.CharField(max_length=120, blank=True, verbose_name='متن لینک')
    link_url = models.CharField(max_length=300, blank=True, verbose_name='آدرس لینک')
    # A line the desk wrote for its own bookkeeping («گفتگو بسته شد», «خارج از
    # ساعت کاری»). It is shown, but it is not an unread message: a badge that
    # counts platform notices is a badge the user learns to ignore.
    is_notice = models.BooleanField(default=False, verbose_name='اعلان سیستمی')
    attachment = models.FileField(
        upload_to=message_attachment_path, blank=True, null=True, verbose_name='پیوست'
    )
    attachment_type = models.CharField(
        max_length=10, choices=ATTACHMENT_CHOICES, blank=True, verbose_name='نوع پیوست'
    )
    # Voice notes render a waveform of known length instead of a player that
    # only reveals its duration after the file has downloaded.
    attachment_duration = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='مدت (ثانیه)'
    )
    # Quoted reply, like Telegram/WhatsApp: the message this one answers. It
    # is SET_NULL so deleting the original never takes the reply with it.
    reply_to = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='replies', verbose_name='پاسخ به',
    )
    # Editing keeps the row and stamps it, so the other party can see that the
    # text changed after they may have read it.
    edited_at = models.DateTimeField(null=True, blank=True, verbose_name='ویرایش در')
    # Deletion is a soft delete: the bubble stays in place as "پیام حذف شد" so
    # replies that quote it still make sense, and the body/attachment go away.
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='حذف در')
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('created_at',)
        verbose_name = 'پیام'
        verbose_name_plural = 'پیام‌ها'
        indexes = [
            models.Index(fields=['conversation', '-created_at']),
        ]

    def __str__(self):
        author = getattr(self.sender, 'username', None)
        if author is None:
            return f'«اعلان»: {self.body[:40]}'
        return f'{author}: {self.body[:40]}'

    @property
    def attachment_url(self) -> str:
        return self.attachment.url if self.attachment else ''

    @property
    def is_system(self) -> bool:
        """A notice written by the platform itself."""
        return self.sender_id is None

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def is_edited(self) -> bool:
        return self.edited_at is not None

    def soft_delete(self):
        """Blank the content but keep the row so quoted replies stay coherent."""
        if self.attachment:
            self.attachment.delete(save=False)
        self.body = ''
        self.listing = None
        self.land = None
        self.link_kind = ''
        self.link_label = ''
        self.link_url = ''
        self.attachment = None
        self.attachment_type = ''
        self.attachment_duration = None
        self.deleted_at = timezone.now()
        self.save(update_fields=[
            'body', 'listing', 'land', 'link_kind', 'link_label', 'link_url',
            'attachment', 'attachment_type',
            'attachment_duration', 'deleted_at',
        ])


# --- Farm profile: lands, calendars and consultation ---

