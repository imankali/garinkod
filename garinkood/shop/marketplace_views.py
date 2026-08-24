"""Public storefront pages, following, highlights and seller-facing helpers.

These endpoints back the "Instagram-like" side of the marketplace: a public
profile per storefront, its posts and stories, highlights that outlive the
24-hour story window, and the follow graph buyers use to build a feed.
"""

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    MarketplaceListing, Storefront, StorefrontConversation, StorefrontFollow,
    StorefrontHighlight, StorefrontHighlightItem, StorefrontMessage, StorefrontPost,
)
from .permissions import IsStorefrontOwnerOrReadOnly
from .serializers import (
    MarketplaceListingSerializer, StorefrontConversationSerializer,
    StorefrontHighlightSerializer, StorefrontMessageSerializer,
    StorefrontPostSerializer, StorefrontSerializer,
)
from .slugs import slugify_fa
from .throttling import SearchRateThrottle


class StorefrontPagination(PageNumberPagination):
    """Client-tunable page size, capped so a crawler cannot request everything."""

    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 48


def _live_story_filter():
    """Stories are only 'live' while unexpired; posts never expire."""
    return Q(post_type='post') | Q(post_type='story', expires_at__gt=timezone.now())


class StorefrontDirectoryViewSet(viewsets.ReadOnlyModelViewSet):
    """The public storefront directory: browse, filter and open a storefront.

    Storefronts with no listings are included on purpose — a newly registered
    seller should still be discoverable — but ordering surfaces active ones
    first by default.
    """

    serializer_class = StorefrontSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = StorefrontPagination
    lookup_field = 'slug'

    ORDERING_MAP = {
        'newest': ['-created_at'],
        'oldest': ['created_at'],
        'name': ['name'],
        'popular': ['-followers_total', '-sales_count'],
        'sales': ['-sales_count'],
        'rating': ['-rating', '-sales_count'],
        'listings': ['-listings_total', '-created_at'],
    }

    def get_queryset(self):
        params = self.request.query_params
        queryset = (
            Storefront.objects
            .filter(is_active=True)
            .select_related('user')
            .annotate(
                followers_total=Count('followers', distinct=True),
                listings_total=Count(
                    'listings', filter=Q(listings__status='published'), distinct=True
                ),
            )
        )

        search = params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(bio__icontains=search) |
                Q(city__icontains=search) |
                Q(province__icontains=search)
            )
        province = params.get('province', '').strip()
        if province:
            queryset = queryset.filter(province__iexact=province)
        city = params.get('city', '').strip()
        if city:
            queryset = queryset.filter(city__iexact=city)
        seller_type = params.get('seller_type', '').strip()
        if seller_type:
            queryset = queryset.filter(seller_type=seller_type)
        if params.get('verified') in {'1', 'true', 'True'}:
            queryset = queryset.filter(is_verified=True)
        if params.get('has_listings') in {'1', 'true', 'True'}:
            queryset = queryset.filter(listings_total__gt=0)

        ordering = self.ORDERING_MAP.get(params.get('ordering', 'popular'), self.ORDERING_MAP['popular'])
        return queryset.order_by(*ordering)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'request': self.request}

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """The handful of storefronts promoted on the home page."""
        limit = min(int(request.query_params.get('limit', 5) or 5), 12)
        storefronts = self.get_queryset()[:limit]
        return Response(self.get_serializer(storefronts, many=True).data)

    @action(detail=True, methods=['get'])
    def profile(self, request, slug=None):
        """Everything the public storefront page renders in one round trip."""
        storefront = get_object_or_404(
            Storefront.objects.select_related('user'), slug=slug, is_active=True
        )
        listings = MarketplaceListing.objects.filter(
            storefront=storefront, status='published'
        ).order_by('-created_at')
        posts = StorefrontPost.objects.filter(
            storefront=storefront, status='published', post_type='post'
        ).order_by('-created_at')
        stories = StorefrontPost.objects.filter(
            storefront=storefront, status='published', post_type='story',
            expires_at__gt=timezone.now(),
        ).order_by('created_at')
        highlights = StorefrontHighlight.objects.filter(
            storefront=storefront
        ).prefetch_related(Prefetch('items', queryset=StorefrontHighlightItem.objects.select_related('post')))

        context = {'request': request}
        return Response({
            'storefront': StorefrontSerializer(storefront, context=context).data,
            'listings': MarketplaceListingSerializer(listings, many=True, context=context).data,
            'posts': StorefrontPostSerializer(posts, many=True, context=context).data,
            'stories': StorefrontPostSerializer(stories, many=True, context=context).data,
            'highlights': StorefrontHighlightSerializer(highlights, many=True, context=context).data,
            'counts': {
                'listings': listings.count(),
                'posts': posts.count(),
                'stories': stories.count(),
                'followers': storefront.followers_count,
            },
        })

    @action(
        detail=True, methods=['post', 'delete'],
        permission_classes=[permissions.IsAuthenticated], url_path='follow',
    )
    def follow(self, request, slug=None):
        """Follow (POST) or unfollow (DELETE) a storefront."""
        storefront = get_object_or_404(Storefront, slug=slug, is_active=True)
        if storefront.user_id == request.user.id:
            return Response(
                {'error': 'نمی‌توانید غرفه خودتان را دنبال کنید.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.method == 'POST':
            try:
                StorefrontFollow.objects.get_or_create(storefront=storefront, user=request.user)
            except IntegrityError:
                pass  # A concurrent duplicate is already the desired state.
            following = True
        else:
            StorefrontFollow.objects.filter(storefront=storefront, user=request.user).delete()
            following = False
        return Response({
            'is_following': following,
            'followers_count': storefront.followers_count,
        })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_following(request):
    """Storefronts the caller follows, plus their currently live stories."""
    storefronts = (
        Storefront.objects
        .filter(followers__user=request.user, is_active=True)
        .select_related('user')
        .order_by('name')
    )
    context = {'request': request}
    feed = []
    for storefront in storefronts:
        stories = StorefrontPost.objects.filter(
            storefront=storefront, status='published', post_type='story',
            expires_at__gt=timezone.now(),
        ).order_by('created_at')
        feed.append({
            'storefront': StorefrontSerializer(storefront, context=context).data,
            'stories': StorefrontPostSerializer(stories, many=True, context=context).data,
        })
    return Response({'count': len(feed), 'results': feed})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([SearchRateThrottle])
def storefront_name_available(request):
    """Live availability check used while typing a storefront name.

    Returns the normalised name and the address that would be generated, so the
    form can show both before anything is submitted. This is advisory only: the
    database's unique constraints remain the source of truth at save time.
    """
    name = request.query_params.get('name', '').strip()
    slug_param = request.query_params.get('slug', '').strip()

    if not name and not slug_param:
        return Response(
            {'error': 'نام یا آدرس غرفه را وارد کنید.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = {}
    exclude_id = None
    if request.user.is_authenticated:
        own = Storefront.objects.filter(user=request.user).values_list('id', flat=True).first()
        exclude_id = own

    if name:
        cleaned = ' '.join(name.split())
        taken = Storefront.objects.filter(name__iexact=cleaned)
        if exclude_id:
            taken = taken.exclude(id=exclude_id)
        too_short = len(cleaned) < 3
        payload['name'] = {
            'value': cleaned,
            'available': not too_short and not taken.exists(),
            'reason': (
                'نام غرفه باید حداقل ۳ کاراکتر باشد.' if too_short
                else 'این نام قبلاً ثبت شده است.' if taken.exists()
                else ''
            ),
        }

    candidate = slugify_fa(slug_param or name)
    if candidate:
        taken_slug = Storefront.objects.filter(slug=candidate)
        if exclude_id:
            taken_slug = taken_slug.exclude(id=exclude_id)
        is_taken = taken_slug.exists()
        suggestion = candidate
        if is_taken:
            index = 2
            while Storefront.objects.filter(slug=f'{candidate}-{index}').exists():
                index += 1
            suggestion = f'{candidate}-{index}'
        payload['slug'] = {
            'value': candidate,
            'available': not is_taken,
            'suggestion': suggestion,
            'reason': 'این آدرس قبلاً استفاده شده است.' if is_taken else '',
        }
    elif slug_param:
        payload['slug'] = {
            'value': '',
            'available': False,
            'suggestion': '',
            'reason': 'آدرس وارد‌شده معتبر نیست.',
        }

    return Response(payload)


class StorefrontHighlightViewSet(viewsets.ModelViewSet):
    """Seller-managed story highlights.

    Read access is public so a visitor can open a storefront's highlights;
    every write is restricted to the storefront's own owner.
    """

    serializer_class = StorefrontHighlightSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsStorefrontOwnerOrReadOnly]

    def get_queryset(self):
        queryset = StorefrontHighlight.objects.select_related('storefront').prefetch_related(
            Prefetch('items', queryset=StorefrontHighlightItem.objects.select_related('post'))
        )
        storefront_slug = self.request.query_params.get('storefront')
        if storefront_slug:
            return queryset.filter(storefront__slug=storefront_slug)
        if self.action in {'list'} and self.request.user.is_authenticated:
            return queryset.filter(storefront__user=self.request.user)
        return queryset

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'request': self.request}

    def _sync_items(self, highlight, post_ids):
        """Replace a highlight's contents, preserving the given order."""
        StorefrontHighlightItem.objects.filter(highlight=highlight).delete()
        StorefrontHighlightItem.objects.bulk_create([
            StorefrontHighlightItem(highlight=highlight, post_id=post_id, position=index)
            for index, post_id in enumerate(post_ids)
        ])

    def perform_create(self, serializer):
        storefront = get_object_or_404(Storefront, user=self.request.user)
        post_ids = serializer.validated_data.pop('post_ids', [])
        with transaction.atomic():
            highlight = serializer.save(storefront=storefront)
            self._sync_items(highlight, post_ids)

    def perform_update(self, serializer):
        post_ids = serializer.validated_data.pop('post_ids', None)
        with transaction.atomic():
            highlight = serializer.save()
            if post_ids is not None:
                self._sync_items(highlight, post_ids)


# ============================================================
# Direct messages (DM) between buyers and storefronts
# ============================================================

class MessagePagination(PageNumberPagination):
    page_size = 40
    page_size_query_param = 'page_size'
    max_page_size = 100


def _participant_conversations(user):
    """Every conversation the user can see, newest activity first."""
    return (
        StorefrontConversation.objects
        .filter(Q(storefront__user=user) | Q(customer=user))
        .select_related('storefront', 'storefront__user', 'customer')
        .prefetch_related(Prefetch(
            'messages',
            queryset=StorefrontMessage.objects.order_by('-created_at').select_related('sender', 'listing', 'listing__storefront'),
        ))
        .order_by('-updated_at')
        .distinct()
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_conversations(request):
    """All direct conversations the caller participates in — as a buyer or as a
    storefront owner — with unread counts for the messages section."""
    context = {'request': request}
    conversations = _participant_conversations(request.user)
    data = StorefrontConversationSerializer(conversations, many=True, context=context).data
    unread_total = sum(conv.unread_count_for(request.user) for conv in conversations)
    return Response({'count': len(data), 'results': data, 'unread_total': unread_total})


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def storefront_conversation(request, slug):
    """Get or create the caller's private conversation with a storefront.

    GET returns the existing conversation (or ``null`` when there is none).
    POST opens one if needed and returns it, so a buyer's first message and
    the thread it belongs to are created in one round trip.
    """
    storefront = get_object_or_404(Storefront, slug=slug, is_active=True)
    if storefront.user_id == request.user.id:
        return Response(
            {'error': 'این غرفه متعلق به خود شماست؛ برای پاسخ به مشتریان از بخش پیام‌ها استفاده کنید.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    conversation = StorefrontConversation.objects.filter(
        storefront=storefront, customer=request.user
    ).first()

    if request.method == 'GET':
        context = {'request': request}
        data = (
            StorefrontConversationSerializer(conversation, context=context).data
            if conversation else None
        )
        return Response(data)

    if conversation is None:
        conversation, _created = StorefrontConversation.objects.get_or_create(
            storefront=storefront, customer=request.user
        )

    context = {'request': request}
    return Response(
        StorefrontConversationSerializer(conversation, context=context).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def conversation_messages(request, conversation_id):
    """Read a thread (GET) or send a message into it (POST).

    Only the two participants — the storefront owner and the buyer — can
    access a thread. Reading marks the other party's messages as read, so the
    unread badge clears as soon as the owner opens the conversation.
    """
    conversation = get_object_or_404(
        StorefrontConversation.objects.select_related('storefront', 'customer'),
        pk=conversation_id,
    )
    if request.user.id != conversation.customer_id and request.user.id != conversation.storefront.user_id:
        return Response({'error': 'شما عضو این گفتگو نیستید.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        messages = conversation.messages.select_related(
            'sender', 'listing', 'listing__storefront'
        ).order_by('created_at')
        # Fetching a thread means the viewer has seen it.
        StorefrontMessage.objects.filter(conversation=conversation, is_read=False).exclude(
            sender=request.user
        ).update(is_read=True)
        paginator = MessagePagination()
        page = paginator.paginate_queryset(messages, request)
        context = {'request': request}
        response = paginator.get_paginated_response(
            StorefrontMessageSerializer(page, many=True, context=context).data
        )
        response.data['conversation'] = StorefrontConversationSerializer(
            conversation, context=context
        ).data
        return response

    body = (request.data.get('body') or '').strip()
    listing_id = request.data.get('listing') or request.data.get('listing_id')
    listing = None
    if listing_id:
        listing = get_object_or_404(MarketplaceListing, pk=listing_id)
        if listing.storefront_id != conversation.storefront_id:
            return Response(
                {'error': 'محصول انتخابی متعلق به این غرفه نیست.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
    if not body and listing is None:
        return Response(
            {'error': 'متن پیام یا محصول پیوست الزامی است.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    message = StorefrontMessage.objects.create(
        conversation=conversation, sender=request.user,
        body=body[:2000], listing=listing,
    )
    conversation.save(update_fields=['updated_at'])
    context = {'request': request}
    return Response(
        StorefrontMessageSerializer(message, context=context).data,
        status=status.HTTP_201_CREATED,
    )
