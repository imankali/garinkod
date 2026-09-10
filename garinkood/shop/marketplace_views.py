"""Public storefront pages, following, highlights and seller-facing helpers.

These endpoints back the "Instagram-like" side of the marketplace: a public
profile per storefront, its posts and stories, highlights that outlive the
24-hour story window, and the follow graph buyers use to build a feed.
"""

from datetime import timedelta
import json
import time

from .schema import documented_api
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    FarmLand, MarketplaceListing, Storefront, StorefrontConversation, StorefrontFollow,
    StorefrontHighlight, StorefrontHighlightItem, StorefrontMessage, StorefrontPost,
    StorefrontPostComment, StorefrontPostLike, StorefrontStoryView,
)
from .attachments import validate_message_attachment
from . import desk
from .levels import may_contact_desk
from .consultations import answer_open_consultation
from .notifications import get_or_create_service_thread
from .permissions import IsStorefrontOwnerOrReadOnly
from .serializers import (
    MarketplaceListingSerializer, StorefrontConversationSerializer,
    StorefrontHighlightSerializer, StorefrontMessageSerializer,
    StorefrontPostCommentSerializer, StorefrontPostSerializer, StorefrontSerializer,
)
from .slugs import slugify_fa
from .throttling import InboxRateThrottle, SearchRateThrottle

User = get_user_model()


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
        live_stories = StorefrontPost.objects.filter(
            storefront=OuterRef('pk'),
            post_type='story',
            status='published',
            expires_at__gt=timezone.now(),
        )
        unseen_stories = live_stories
        if self.request.user.is_authenticated:
            unseen_stories = unseen_stories.exclude(views__user=self.request.user)

        queryset = (
            Storefront.objects
            .filter(is_active=True)
            # ``account`` because the serializer reports whether the owner has
            # declared the identity a storefront requires; joined rather than
            # read per row, or the directory pays one query per card.
            .select_related('user', 'user__account')
            .annotate(
                followers_total=Count('followers', distinct=True),
                listings_total=Count(
                    'listings', filter=Q(listings__status='published'), distinct=True
                ),
                active_stories_available=Exists(live_stories),
                unseen_stories_available=Exists(unseen_stories),
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
        # A hand-typed address must not raise: junk is the same as not asking,
        # and the count is clamped so nobody can turn this into a full dump.
        try:
            limit = int(request.query_params.get('limit', 5) or 5)
        except (TypeError, ValueError):
            limit = 5
        limit = max(1, min(limit, 12))
        storefronts = self.get_queryset()[:limit]
        return Response(self.get_serializer(storefronts, many=True).data)

    @action(detail=True, methods=['get'])
    def profile(self, request, slug=None):
        """Everything the public storefront page renders in one round trip."""
        storefront = get_object_or_404(
            Storefront.objects.select_related('user'), slug=slug, is_active=True
        )
        # The owner manages their آگهی‌ها, پست‌ها and استوری‌ها from this very
        # page, so they must see the pending and rejected ones too — filtering
        # those out would leave a rejected listing invisible and uneditable.
        is_owner = request.user.is_authenticated and storefront.user_id == request.user.id

        listings = MarketplaceListing.objects.filter(storefront=storefront)
        if not is_owner:
            listings = listings.filter(status='published')
        listings = listings.order_by('-created_at')

        posts = StorefrontPost.objects.filter(storefront=storefront, post_type='post')
        if not is_owner:
            posts = posts.filter(status='published')
        posts = posts.order_by('-created_at')

        stories = StorefrontPost.objects.filter(
            storefront=storefront, post_type='story', expires_at__gt=timezone.now(),
        )
        if not is_owner:
            stories = stories.filter(status='published')
        stories = stories.order_by('created_at')
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

    @action(detail=True, methods=['get'], url_path='search-content')
    def search_content(self, request, slug=None):
        """Search inside one storefront's published posts and live stories.

        Buyers search the page (e.g. «اصلاح درخت») and find the matching
        post/story article or video regardless of how old it is.
        """
        storefront = get_object_or_404(Storefront, slug=slug, is_active=True)
        query = request.query_params.get('q', '').strip()

        posts = StorefrontPost.objects.filter(
            storefront=storefront, status='published', post_type='post'
        )
        stories = StorefrontPost.objects.filter(
            storefront=storefront, status='published', post_type='story',
            expires_at__gt=timezone.now(),
        )
        if query:
            posts = posts.filter(Q(caption__icontains=query) | Q(listing__title__icontains=query))
            stories = stories.filter(Q(caption__icontains=query))

        context = {'request': request}
        return Response({
            'query': query,
            'posts': StorefrontPostSerializer(posts.order_by('-created_at')[:24], many=True, context=context).data,
            'stories': StorefrontPostSerializer(stories.order_by('created_at')[:24], many=True, context=context).data,
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


@documented_api
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


@documented_api
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


# The relations a thread row reads, joined once instead of per message. Keeping
# it in one place is the point: the tail query and the plain query below must not
# drift into two lists where one forgot ``post__storefront``.
_THREAD_RELATIONS = (
    'sender', 'sender__account', 'listing', 'listing__storefront',
    'conversation', 'conversation__storefront',
    'reply_to', 'reply_to__sender', 'reply_to__listing',
    'land', 'land__owner', 'post', 'post__storefront', 'post__listing',
)


def _thread_messages(conversation):
    """One thread, oldest first, with every relation the serializer reads joined."""
    return (
        conversation.messages.select_related(*_THREAD_RELATIONS)
        .prefetch_related('sender__desk_profiles')
        .order_by('created_at', 'id')
    )


def _thread_window(request):
    """The tail window: how many newest rows to take, and before which message.

    ``?page_size=N`` with no ``?page`` asks for the *tail* of the thread, because
    plain pagination counts from the front — a long conversation would open on
    its first weeks, with the part the reader actually wants unreachable.

    ``?before_id=<message id>`` walks further back from there, one window at a
    time, which is how a chat loads history without a page number for something
    that keeps growing at the other end.

    Returns ``(size, before_id)``; ``size`` is ``None`` for plain pagination.
    """
    raw = request.query_params.get('page_size')
    before_raw = request.query_params.get('before_id')
    try:
        before_id = int(before_raw) if before_raw not in (None, '') else None
    except (TypeError, ValueError):
        before_id = None

    if request.query_params.get('page'):
        # An explicit page number is plain pagination; the two modes do not mix.
        return None, before_id

    try:
        size = int(raw) if raw not in (None, '') else None
    except (TypeError, ValueError):
        size = None  # Junk is the same as not asking: keep the default behaviour.
    if size is None and before_id is None:
        return None, before_id
    if size is None:
        size = MessagePagination.page_size
    return max(1, min(size, MessagePagination.max_page_size)), before_id


def _tail_window(conversation, size, before_id):
    """``(rows, older_available)`` for the newest ``size`` messages of a thread.

    ``rows`` come back oldest-first, which is what a chat window renders; the
    window itself is chosen from the newest end.
    """
    from django.db.models import Q

    base = _thread_messages(conversation)
    if before_id is not None:
        anchor = base.filter(pk=before_id).first()
        if anchor is not None:
            # Same-timestamp ties are broken on the id, or two messages written
            # in the same instant would either repeat or vanish at the boundary.
            base = base.filter(Q(created_at__lt=anchor.created_at) | Q(
                created_at=anchor.created_at, id__lt=anchor.id
            ))
        else:
            # The anchor itself was deleted; ids only ever grow, so walking back
            # from it still lands on the right slice.
            base = base.filter(pk__lt=before_id)

    total = base.count()
    if total <= size:
        return list(base), False
    newest = list(
        base.order_by('-created_at', '-id').values_list('id', flat=True)[:size]
    )
    rows = list(_thread_messages(conversation).filter(pk__in=newest))
    return rows, True


def _participant_conversations(user):
    """Every conversation the user can see, newest activity first.

    This is the unified inbox: their storefront threads (as buyer or owner),
    their support and consulting threads, comment-reply notifications — and,
    for staff, the service threads they are authorised to answer.
    """
    visible = Q(customer=user) | Q(storefront__user=user)

    # Staff see the queues they are permitted to work, which is what lets any
    # operator pick up a thread instead of it being stuck on one assignee.
    if user.is_superuser or user.has_perm('shop.view_platformfeedback'):
        visible |= Q(channel__in=[
            StorefrontConversation.CHANNEL_SUPPORT,
            StorefrontConversation.CHANNEL_COMMENT,
        ])
    if user.is_superuser or user.has_perm('shop.view_farmconsultationrequest'):
        visible |= Q(channel=StorefrontConversation.CHANNEL_CONSULTING)

    return (
        StorefrontConversation.objects
        .filter(visible)
        .select_related('storefront', 'storefront__user', 'customer', 'customer__account')
        .prefetch_related(Prefetch(
            'messages',
            queryset=StorefrontMessage.objects.order_by('-created_at').select_related(
                'sender', 'sender__account', 'listing', 'listing__storefront',
                'conversation', 'conversation__storefront', 'reply_to', 'reply_to__sender',
                'land',
            ).prefetch_related('sender__desk_profiles'),
        ))
        .order_by('-updated_at')
        .distinct()
    )


@documented_api
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([InboxRateThrottle])
def my_conversations(request):
    """The caller's whole inbox, across every channel.

    An optional ``channel`` query parameter narrows it to one source, which is
    what the inbox filter chips ("پشتیبانی", "غرفه‌ها", …) use.
    """
    context = {'request': request}
    # Opening the inbox is also how the desk learns that an operator is at their
    # desk right now; the page polls it, so no extra heartbeat is needed.
    desk.touch_presence(request.user)
    conversations = _participant_conversations(request.user).annotate(rating_total=Count('ratings'))

    channel = (request.query_params.get('channel') or '').strip()
    valid_channels = {value for value, _label in StorefrontConversation.CHANNEL_CHOICES}
    filtered = (
        conversations.filter(channel=channel) if channel in valid_channels else conversations
    )

    data = StorefrontConversationSerializer(filtered, many=True, context=context).data

    # Unread is reported per channel as well, so the UI can badge each filter
    # chip without issuing one request per channel.
    unread_by_channel: dict[str, int] = {}
    unread_total = 0
    for conversation in conversations:
        count = conversation.unread_count_for(request.user)
        if not count:
            continue
        unread_total += count
        unread_by_channel[conversation.channel] = (
            unread_by_channel.get(conversation.channel, 0) + count
        )

    return Response({
        'count': len(data),
        'results': data,
        'unread_total': unread_total,
        'unread_by_channel': unread_by_channel,
        'channels': [
            {'value': value, 'label': label}
            for value, label in StorefrontConversation.CHANNEL_CHOICES
        ],
    })


def _staff_exits(channel: str) -> list[dict[str, str]]:
    """The doors a staff member should use instead of the customer queue.

    A refusal that only says "no" sends a person hunting. These are the places
    where the same thing actually gets handled: the queue they already staff,
    and the internal feedback line that the support group reads.
    """
    exits = [{'label': 'بازخورد و انتقاد داخلی', 'url': '/support'}]
    if desk.desk_channel(channel):
        exits.insert(0, {'label': 'صف میز خدمات', 'url': '/messages'})
    return exits


@documented_api
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def service_conversation(request, channel):
    """Open (or fetch) the caller's thread with a service desk.

    This is what turns the floating "مشاوره رایگان" button into a real
    messenger: it resolves to the user's single support/consulting thread
    instead of a form that goes nowhere the user can follow up on.
    """
    allowed = {
        StorefrontConversation.CHANNEL_SUPPORT,
        StorefrontConversation.CHANNEL_CONSULTING,
        StorefrontConversation.CHANNEL_COMMENT,
    }
    if channel not in allowed:
        return Response({'error': 'کانال پیام نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)

    staff_of_desk = desk.is_operator_for(request.user, channel)
    contact_allowed, contact_reason = may_contact_desk(
        request.user, channel, staff_of_desk=staff_of_desk,
    )
    if not contact_allowed:
        return Response(
            {
                'error': contact_reason,
                'code': 'staff_not_a_desk_customer',
                'channel': channel,
                'alt': _staff_exits(channel),
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    conversation = get_or_create_service_thread(request.user, channel)
    if request.method == 'POST':
        # The thread is placed with whoever has the least work right now; every
        # operator of the desk can still see and answer it.
        desk.assign_thread(conversation)
    else:
        desk.touch_presence(request.user)
    payload = StorefrontConversationSerializer(conversation, context={'request': request}).data
    payload['desk'] = desk.desk_state(channel, user=request.user)
    return Response(
        payload,
        status=status.HTTP_201_CREATED if request.method == 'POST' else status.HTTP_200_OK,
    )


@documented_api
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_farmer_conversation(request, user_id):
    """A consultant opens the consulting thread with one farmer.

    Consultants work from the farmer dossier screen, so they need to start the
    conversation rather than wait for the farmer to write first.
    """
    if not (request.user.is_superuser or request.user.has_perm('shop.view_farmconsultationrequest')):
        return Response(
            {'error': 'دسترسی گفتگو با کشاورزان را ندارید.'}, status=status.HTTP_403_FORBIDDEN
        )
    farmer = get_object_or_404(User, pk=user_id)
    conversation = get_or_create_service_thread(
        farmer, StorefrontConversation.CHANNEL_CONSULTING, agent=request.user
    )
    # Opening a thread from the farmer dossier proves the consultant is at their
    # desk, which is what the farmer's «آنلاین است» indicator is built from.
    desk.touch_presence(request.user)
    return Response(
        StorefrontConversationSerializer(conversation, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@documented_api
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


@documented_api
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def conversation_messages(request, conversation_id):
    """Read a thread (GET) or send a message into it (POST).

    Only the two participants — the storefront owner and the buyer — can
    access a thread. Reading marks the other party's messages as read, so the
    unread badge clears as soon as the owner opens the conversation.
    """
    conversation = get_object_or_404(
        StorefrontConversation.objects.select_related(
            'storefront', 'storefront__user', 'customer', 'customer__account'
        ),
        pk=conversation_id,
    )
    if not conversation.is_participant(request.user):
        return Response({'error': 'شما عضو این گفتگو نیستید.'}, status=status.HTTP_403_FORBIDDEN)

    # Answering other people's tickets is the job; writing into a service thread
    # *as its customer* is not, and a promoted account keeps its old thread.
    if (
        request.method == 'POST'
        and desk.desk_channel(conversation.channel)
        and conversation.customer_id == request.user.id
    ):
        contact_allowed, contact_reason = may_contact_desk(
            request.user,
            conversation.channel,
            staff_of_desk=desk.is_operator_for(request.user, conversation.channel),
        )
        if not contact_allowed:
            return Response(
                {
                    'error': contact_reason,
                    'code': 'staff_not_a_desk_customer',
                    'channel': conversation.channel,
                    'alt': _staff_exits(conversation.channel),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

    if request.method == 'GET':
        # Fetching a thread means the viewer has seen it: this is also what turns
        # the sender's green «sendane» tick into a read one.
        StorefrontMessage.objects.filter(conversation=conversation, is_read=False).exclude(
            sender=request.user
        ).update(is_read=True)
        # For an operator, opening a thread is proof they are at their desk.
        desk.touch_presence(request.user)
        context = {'request': request}
        size, before_id = _thread_window(request)
        if size is None:
            paginator = MessagePagination()
            page = paginator.paginate_queryset(_thread_messages(conversation), request)
            response = paginator.get_paginated_response(
                StorefrontMessageSerializer(page, many=True, context=context).data
            )
        else:
            rows, older = _tail_window(conversation, size, before_id)
            response = Response({
                # The thread's whole size, not the window's: the client shows
                # «چند پیام قدیمی‌تر مانده» from the difference.
                'count': conversation.messages.count(),
                'next': None,
                'previous': None,
                'older_available': older,
                'results': StorefrontMessageSerializer(rows, many=True, context=context).data,
            })
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

    # An «answer this question with a post» action sends the seller's answer
    # itself, not only a sentence about it: the card travels with the message so
    # the consultation stays auditable inside the thread. Validated against the
    # thread's storefront for the same reason the listing above is — a caller
    # must not be able to attach somebody else's post by guessing an id.
    post = None
    raw_post = request.data.get('post') or request.data.get('post_id')
    if raw_post not in (None, ''):
        post = StorefrontPost.objects.filter(pk=raw_post).select_related('storefront').first()
        if post is None or post.storefront_id != conversation.storefront_id:
            return Response(
                {'error': 'پست انتخابی متعلق به این غرفه نیست.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    attachment = request.FILES.get('attachment')
    attachment_type = ''
    attachment_duration = None
    if attachment is not None:
        try:
            attachment_type = validate_message_attachment(attachment)
        except ValidationError as error:
            return Response({'error': error.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        raw_duration = request.data.get('attachment_duration')
        if raw_duration not in (None, ''):
            try:
                attachment_duration = max(0, min(int(float(raw_duration)), 60 * 60))
            except (TypeError, ValueError):
                attachment_duration = None

    # A land case file travels with the message that shares it. It is validated
    # against the thread's owner rather than trusted from the client, otherwise a
    # caller could enumerate other farmers' fields through the message endpoint.
    land = None
    raw_land = request.data.get('land') or request.data.get('land_id')
    if raw_land not in (None, ''):
        if conversation.channel not in desk.DESK_CHANNELS:
            return Response(
                {'error': 'پرونده زمین فقط در گفتگوی میز خدمت ارسال می‌شود.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        land = FarmLand.objects.filter(pk=raw_land, owner_id=conversation.customer_id).first()
        if land is None:
            return Response(
                {'error': 'این پرونده زمین به این گفتگو مربوط نیست.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if not body and listing is None and attachment is None and land is None and post is None:
        return Response(
            {'error': 'متن پیام، پیوست، محصول یا پرونده زمین الزامی است.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # A quoted reply must point at a message in *this* thread; anything else
    # would let a caller probe message ids across conversations.
    reply_to = None
    raw_reply_to = request.data.get('reply_to')
    if raw_reply_to not in (None, ''):
        try:
            reply_to_id = int(raw_reply_to)
        except (TypeError, ValueError):
            return Response({'error': 'پیام مرجع نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
        reply_to = StorefrontMessage.objects.filter(
            pk=reply_to_id, conversation=conversation
        ).first()
        if reply_to is None:
            return Response(
                {'error': 'پیام مرجع در این گفتگو پیدا نشد.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    is_customer = request.user.id == conversation.customer_id
    message = StorefrontMessage.objects.create(
        conversation=conversation, sender=request.user,
        body=body[:2000], listing=listing, land=land, post=post,
        attachment=attachment, attachment_type=attachment_type,
        attachment_duration=attachment_duration,
        reply_to=reply_to,
    )
    # Only an operator puts a button inside a bubble. Those links are the
    # platform's own sentences — «ادامه گفتگو در میز مشاوره», «پاسخ را در پست
    # ببینید» — and letting either side inject an arbitrary URL into a chat that
    # a farmer trusts as support would be a phishing field waiting to be used.
    if not is_customer:
        link_url = str(request.data.get('link_url') or '').strip()
        if link_url.startswith('/') or link_url.startswith(('http://', 'https://')):
            message.link_url = link_url[:500]
            message.link_label = (str(request.data.get('link_label') or '').strip() or 'مشاهده')[:80]
            message.link_kind = (str(request.data.get('link_kind') or '').strip() or 'link')[:20]
            message.save(update_fields=['link_url', 'link_label', 'link_kind'])

    if is_customer and conversation.channel in desk.DESK_CHANNELS:
        # A new question on a finished thread is an open thread again, and the
        # first unassigned message is placed with whoever has the least work.
        if conversation.is_closed:
            conversation.reopen(by=request.user)
        if conversation.agent_id is None:
            desk.assign_thread(conversation)
        if not conversation.is_open_now():
            desk.announce_out_of_hours(conversation)
        conversation.save(update_fields=['updated_at'])
    elif (
        conversation.channel != StorefrontConversation.CHANNEL_STOREFRONT
        and conversation.agent_id is None
        and not is_customer
    ):
        # A staff reply claims an unassigned service thread, so the farmer sees a
        # consistent counterpart and other operators know it is being handled.
        conversation.agent = request.user
        conversation.save(update_fields=['agent', 'updated_at'])
    else:
        conversation.save(update_fields=['updated_at'])
    # A consultant answering inside the chat answers the ticket too — the farmer
    # must not have to wait for someone to notice the queue, and the panel must
    # not show «در انتظار پاسخ» under a question that has an answer above it.
    answered_consultations = answer_open_consultation(message)

    context = {'request': request}
    response = Response(
        StorefrontMessageSerializer(message, context=context).data,
        status=status.HTTP_201_CREATED,
    )
    if answered_consultations:
        response.data['answered_consultations'] = answered_consultations
    return response


@documented_api
@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def conversation_message_detail(request, conversation_id, message_id):
    """Edit (PATCH) or delete (DELETE) one of the caller's own messages.

    Only the author may change a message. Editing is limited to the text of
    text-only messages; media and voice notes can be deleted but not edited.
    Deletion is soft — the bubble stays as a "پیام حذف شد" placeholder so any
    reply quoting it still reads correctly for the other side.
    """
    conversation = get_object_or_404(
        StorefrontConversation.objects.select_related('storefront', 'customer'),
        pk=conversation_id,
    )
    if not conversation.is_participant(request.user):
        return Response({'error': 'شما عضو این گفتگو نیستید.'}, status=status.HTTP_403_FORBIDDEN)

    message = get_object_or_404(
        StorefrontMessage.objects.select_related(
            'sender', 'sender__account', 'listing', 'listing__storefront',
            'conversation', 'conversation__storefront', 'reply_to', 'reply_to__sender',
        ),
        pk=message_id, conversation=conversation,
    )
    if message.sender_id != request.user.id:
        return Response(
            {'error': 'فقط فرستنده می‌تواند پیام خود را تغییر دهد.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if message.is_deleted:
        return Response({'error': 'این پیام قبلاً حذف شده است.'}, status=status.HTTP_400_BAD_REQUEST)

    context = {'request': request}

    if request.method == 'DELETE':
        message.soft_delete()
        conversation.save(update_fields=['updated_at'])
        return Response(StorefrontMessageSerializer(message, context=context).data)

    if message.attachment:
        return Response(
            {'error': 'پیام‌های دارای پیوست قابل ویرایش نیستند؛ آن را حذف و دوباره ارسال کنید.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    body = (request.data.get('body') or '').strip()
    if not body and message.listing_id is None:
        return Response({'error': 'متن پیام نمی‌تواند خالی باشد.'}, status=status.HTTP_400_BAD_REQUEST)

    body = body[:2000]
    if body != message.body:
        message.body = body
        message.edited_at = timezone.now()
        message.save(update_fields=['body', 'edited_at'])
        conversation.save(update_fields=['updated_at'])
    return Response(StorefrontMessageSerializer(message, context=context).data)


@documented_api
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def conversation_events(request, conversation_id):
    """Server-Sent Events (SSE) stream for live conversation updates."""
    conversation = get_object_or_404(
        _participant_conversations(request.user), pk=conversation_id
    )
    raw_last = request.query_params.get('last_id', '0')
    last_id = int(raw_last) if raw_last and raw_last.isdigit() else 0

    def event_stream():
        nonlocal last_id
        yield f"event: connected\ndata: {json.dumps({'status': 'connected', 'conversation_id': conversation.id})}\n\n"
        start_time = time.time()
        timeout = 25
        # Edits and deletions change existing rows, which an id watermark
        # cannot see; a timestamp watermark over edited_at/deleted_at does.
        since = timezone.now()

        while time.time() - start_time < timeout:
            new_msgs = StorefrontMessage.objects.filter(
                conversation=conversation, id__gt=last_id
            ).select_related(
                'sender', 'sender__account', 'listing', 'listing__storefront',
                'conversation', 'conversation__storefront', 'reply_to', 'reply_to__sender',
            ).order_by('id')

            if new_msgs.exists():
                serializer = StorefrontMessageSerializer(
                    new_msgs, many=True, context={'request': request}
                )
                last_id = max(m.id for m in new_msgs)
                yield f"event: message\ndata: {json.dumps({'results': serializer.data, 'last_id': last_id})}\n\n"

            changed = StorefrontMessage.objects.filter(
                Q(edited_at__gt=since) | Q(deleted_at__gt=since),
                conversation=conversation,
            ).select_related(
                'sender', 'sender__account', 'listing', 'listing__storefront',
                'conversation', 'conversation__storefront', 'reply_to', 'reply_to__sender',
            ).order_by('id')
            if changed.exists():
                since = timezone.now()
                serializer = StorefrontMessageSerializer(
                    changed, many=True, context={'request': request}
                )
                yield f"event: update\ndata: {json.dumps({'results': serializer.data})}\n\n"

            yield f": ping {int(time.time())}\n\n"
            time.sleep(1.5)

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response

