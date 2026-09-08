"""Marketplace domain models for the shop app (split from models.py)."""

from django.db import models
from django.conf import settings
from django.db.models.functions import Lower
from django.utils import timezone

from .mixins import ImageVariantsMixin



# --- Marketplace storefront foundation ---
class Storefront(models.Model):
    SELLER_TYPE_CHOICES = (
        ('farmer', 'کشاورز'),
        ('cooperative', 'تعاونی'),
        ('merchant', 'تاجر'),
        ('company', 'شرکت'),
    )

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='storefront')
    name = models.CharField(max_length=150)
    # Case-insensitive uniqueness is enforced by a functional constraint below so
    # two sellers cannot register visually identical storefront names.
    slug = models.SlugField(max_length=180, unique=True)
    seller_type = models.CharField(max_length=20, choices=SELLER_TYPE_CHOICES, default='farmer')
    bio = models.TextField(max_length=1000, blank=True)
    avatar = models.ImageField(upload_to='storefronts/%Y/%m/', blank=True, null=True, verbose_name='تصویر غرفه')
    cover = models.ImageField(upload_to='storefronts/covers/%Y/%m/', blank=True, null=True, verbose_name='کاور غرفه')
    province = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    location = models.ForeignKey(
        'Location', null=True, blank=True, on_delete=models.SET_NULL, related_name='storefronts'
    )
    is_verified = models.BooleanField(default=False, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=8)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    sales_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'غرفه'
        verbose_name_plural = 'غرفه‌ها'
        constraints = [
            models.UniqueConstraint(
                Lower('name'), name='unique_storefront_name_ci'
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def avatar_url(self):
        return self.avatar.url if self.avatar else ''

    @property
    def cover_url(self):
        return self.cover.url if self.cover else ''

    @property
    def followers_count(self) -> int:
        return self.followers.count()

    @property
    def published_listing_count(self) -> int:
        return self.listings.filter(status='published').count()

    @property
    def has_active_stories(self) -> bool:
        """Whether this storefront currently has at least one live story.

        Directory querysets annotate this value to avoid an existence query per
        card; the fallback keeps standalone Storefront instances correct.
        """
        annotated = getattr(self, 'active_stories_available', None)
        if annotated is not None:
            return bool(annotated)
        prefetched = getattr(self, 'active_story_rows', None)
        if prefetched is not None:
            return bool(prefetched)
        return self.posts.filter(
            post_type='story', status='published', expires_at__gt=timezone.now()
        ).exists()


class StorefrontFollow(models.Model):
    """A buyer following a storefront, used for the feed and follower counts."""

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='followers')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='followed_storefronts')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'دنبال‌کننده غرفه'
        verbose_name_plural = 'دنبال‌کنندگان غرفه'
        constraints = [
            models.UniqueConstraint(fields=['storefront', 'user'], name='unique_storefront_follow'),
        ]

    def __str__(self):
        return f'{self.user} → {self.storefront}'


class StorefrontHighlight(models.Model):
    """A named, ordered collection of stories kept beyond their expiry."""

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='highlights')
    title = models.CharField(max_length=60)
    cover = models.ImageField(upload_to='storefront-highlights/%Y/%m/', blank=True, null=True)
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('position', 'created_at')
        verbose_name = 'هایلایت غرفه'
        verbose_name_plural = 'هایلایت‌های غرفه'

    def __str__(self):
        return f'{self.storefront.name} — {self.title}'

    @property
    def cover_url(self):
        if self.cover:
            return self.cover.url
        first = self.items.select_related('post').first()
        return first.post.image_url if first else '/images/hero-farm.jpg'


class StorefrontHighlightItem(models.Model):
    highlight = models.ForeignKey(StorefrontHighlight, on_delete=models.CASCADE, related_name='items')
    post = models.ForeignKey('StorefrontPost', on_delete=models.CASCADE, related_name='highlight_items')
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ('position', 'id')
        constraints = [
            models.UniqueConstraint(fields=['highlight', 'post'], name='unique_highlight_post'),
        ]

    def __str__(self):
        return f'{self.highlight.title} #{self.position}'


class MarketplaceListing(ImageVariantsMixin):
    STATUS_CHOICES = (
        ('draft', 'پیش‌نویس'),
        ('pending_review', 'در انتظار تأیید'),
        ('published', 'منتشر شده'),
        ('rejected', 'رد شده'),
        ('sold_out', 'اتمام موجودی'),
        ('archived', 'بایگانی'),
    )

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='listings')
    title = models.CharField(max_length=250)
    slug = models.SlugField(max_length=280, unique=True)
    crop_name = models.CharField(max_length=150)
    description = models.TextField(max_length=3000)
    price = models.PositiveBigIntegerField()
    unit = models.CharField(max_length=30, default='کیلوگرم')
    quantity_available = models.DecimalField(max_digits=14, decimal_places=2)
    min_order_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=1)
    harvest_date = models.DateField(null=True, blank=True)
    image = models.ImageField(upload_to='marketplace/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    discount_percent = models.PositiveSmallIntegerField(default=0, verbose_name='درصد تخفیف')
    sales_count = models.PositiveIntegerField(default=0, verbose_name='تعداد فروش')
    rejection_reason = models.TextField(max_length=1000, blank=True, verbose_name='دلیل رد آگهی')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_listings'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'آگهی بازار کشاورزان'
        verbose_name_plural = 'آگهی‌های بازار کشاورزان'
        indexes = [
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return self.title

    @property
    def image_url(self):
        return self.image.url if self.image else '/images/hero-farm.jpg'

    def save(self, *args, **kwargs):
        image_changed = self._image_has_changed()
        super().save(*args, **kwargs)
        if image_changed:
            self._refresh_image_variants()

    @property
    def is_purchasable(self) -> bool:
        return self.status == 'published' and self.quantity_available > 0

    @property
    def discounted_price(self) -> int:
        """The price after the storefront's discount, rounded down."""
        if self.discount_percent and self.discount_percent > 0:
            return max(int(self.price * (100 - self.discount_percent) / 100), 0)
        return self.price

    @property
    def minimum_order(self) -> int:
        """The listing's minimum order, never below one whole unit."""
        return max(int(self.min_order_quantity or 1), 1)

    def commission_for(self, amount: int) -> int:
        rate = self.storefront.commission_rate or 0
        return int(amount * rate / 100)


# --- Payments, finance and growth ---

