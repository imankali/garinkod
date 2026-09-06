"""Public site-content endpoints: articles, growing guides, services,
admin-editable pages, contact/about information and the newsletter.

Royal Kesh earns trust by publishing depth: a spec sheet per product, a growing
guide per crop, a page per service, a team and a channel list. Those are
database-backed here so a manager can change any of them from the admin without a
deploy, and every endpoint returns only what is actually stored — an empty list
is a valid answer and is never padded with placeholder claims.
"""

from django.db.models import Count, F, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from .models import (
    BrandPartner, MarketplaceListing, Product, Service, SiteArticle, SiteContact,
    SitePage, Storefront, TeamMember, NewsletterSubscriber, Order,
)
from . import legal
from .catalog_views import policy_payload
from .schema import documented_api
from .serializers import (
    BrandPartnerSerializer, NewsletterSubscribeSerializer, ServiceSerializer,
    SiteArticleListSerializer, SiteArticleSerializer, SiteContactSerializer,
    SitePageSerializer, TeamMemberSerializer,
)
from .throttling import FeedbackRateThrottle, SearchRateThrottle


class SiteArticleViewSet(viewsets.ReadOnlyModelViewSet):
    """Site-wide blog: editorial articles and per-crop growing guides."""

    lookup_field = 'slug'
    filter_backends = []
    pagination_class = None
    permission_classes = [permissions.AllowAny]
    throttle_classes = [SearchRateThrottle]
    ordering_fields = ['published_at', 'views', 'reading_minutes']

    def get_queryset(self):
        """Published articles narrowed by the params the content UI sends.

        Nothing is sliced here on purpose: the actions below keep filtering this
        queryset, and a sliced queryset can neither be filtered nor made
        distinct again — which used to turn ``?limit=`` into a 500.
        """
        queryset = (
            SiteArticle.objects.filter(is_published=True)
            .select_related('author')
            .order_by('-published_at', '-id')
        )
        params = self.request.query_params
        kind = params.get('kind', '').strip()
        if kind in {SiteArticle.KIND_ARTICLE, SiteArticle.KIND_GUIDE}:
            queryset = queryset.filter(kind=kind)
        crop = params.get('crop', '').strip()
        if crop:
            queryset = queryset.filter(Q(crop__icontains=crop) | Q(title__icontains=crop))
        search = params.get('search', '').strip()
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(body__icontains=search))
        if params.get('featured') in {'1', 'true', 'True'}:
            queryset = queryset.filter(is_featured=True)
        product = params.get('product', '').strip()
        if product:
            lookup = Q(pk=product) if product.isdigit() else Q(slug=product)
            queryset = queryset.filter(products__in=Product.objects.filter(lookup))
        # The product filter joins an M2M, so an article attached to two
        # matching products would otherwise be listed twice.
        queryset = queryset.distinct()
        return queryset

    def _apply_limit(self, queryset):
        """``?limit=N`` for the unpaginated card lists (home rails, product page)."""
        raw = self.request.query_params.get('limit', '').strip()
        if raw.isdigit():
            return queryset[: min(int(raw), 24)]
        return queryset

    def get_serializer_class(self):
        return SiteArticleSerializer if self.action == 'retrieve' else SiteArticleListSerializer

    def list(self, request, *args, **kwargs):
        queryset = self._apply_limit(self.filter_queryset(self.get_queryset()))
        return Response(self.get_serializer(queryset, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # A view counter that cannot be inflated by the API client's own
        # prefetches: only a real article page read bumps it.
        SiteArticle.objects.filter(pk=instance.pk).update(views=F('views') + 1)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='guides')
    def guides(self, request):
        queryset = self._apply_limit(self.get_queryset().filter(kind=SiteArticle.KIND_GUIDE))
        serializer = SiteArticleListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='crops')
    def crops(self, request):
        """Distinct crops that already have a growing guide (guide index)."""
        rows = (
            SiteArticle.objects.filter(is_published=True, kind=SiteArticle.KIND_GUIDE)
            .exclude(crop='')
            .values('crop')
            .annotate(total=Count('id'))
            .order_by('crop')
        )
        return Response([{'crop': row['crop'], 'article_count': row['total']} for row in rows])

    @action(detail=True, methods=['get'], url_path='related')
    def related(self, request, slug=None):
        article = self.get_object()
        related = list(article.related_articles.filter(is_published=True))
        filler = (
            SiteArticle.objects.filter(is_published=True, kind=article.kind)
            .exclude(pk=article.pk)
            .exclude(pk__in=[item.pk for item in related])
        )
        if article.crop:
            filler = filler.filter(crop__iexact=article.crop)
        combined = (related + list(filler[:4]))[:4]
        return Response(SiteArticleListSerializer(combined, many=True).data)


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """The services catalogue, each with its own detail page."""

    queryset = Service.objects.filter(is_active=True).order_by('order', 'title')
    serializer_class = ServiceSerializer
    lookup_field = 'slug'
    pagination_class = None
    permission_classes = [permissions.AllowAny]
    filter_backends = []


class SitePageViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-editable info pages and product landing pages."""

    queryset = SitePage.objects.filter(published=True).prefetch_related('blocks').order_by('title')
    serializer_class = SitePageSerializer
    lookup_field = 'slug'
    pagination_class = None
    permission_classes = [permissions.AllowAny]
    filter_backends = []

    def get_queryset(self):
        queryset = super().get_queryset()
        kind = self.request.query_params.get('kind', '').strip()
        if kind in {'page', 'landing'}:
            queryset = queryset.filter(kind=kind)
        return queryset


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def site_contact(request):
    """Company contact channels, straight from the admin-managed record."""
    return Response(SiteContactSerializer(SiteContact.load()).data)


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def site_about(request):
    """Team, represented brands and counters derived from real rows."""
    stats = {
        'products': Product.objects.filter(status='published').count(),
        'storefronts': Storefront.objects.filter(is_active=True).count(),
        'listings': MarketplaceListing.objects.filter(status='published').count(),
        'articles': SiteArticle.objects.filter(is_published=True).count(),
        'orders': Order.objects.exclude(status='cancelled').count(),
        'provinces': (
            Storefront.objects.filter(is_active=True)
            .exclude(province='')
            .values('province')
            .distinct()
            .count()
        ),
    }
    return Response({
        'team': TeamMemberSerializer(TeamMember.objects.filter(is_active=True), many=True).data,
        'brands': BrandPartnerSerializer(BrandPartner.objects.filter(is_active=True), many=True).data,
        'stats': stats,
        'contact': SiteContactSerializer(SiteContact.load()).data,
    })


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def growing_index(request):
    """Every crop the site can already advise on, with its products and guides.

    This is the data behind «راهنمای کشت» — it is assembled from the catalogue,
    so a crop with no published content is simply absent.
    """
    guides = (
        SiteArticle.objects.filter(is_published=True, kind=SiteArticle.KIND_GUIDE)
        .exclude(crop='')
        .values('crop')
        .annotate(total=Count('id'))
    )
    by_crop = {row['crop'].strip(): row['total'] for row in guides}
    catalogue = (
        Product.objects.filter(status='published')
        .exclude(category__isnull=True)
        .values('category__name', 'category__slug')
        .annotate(total=Count('id'))
        .order_by('-total')[:20]
    )
    payload = []
    for row in catalogue:
        name = (row['category__name'] or '').strip()
        if not name:
            continue
        payload.append({
            'name': name,
            'slug': row['category__slug'],
            'product_count': row['total'],
            # A guide is written per crop, not per catalogue category; the
            # count is zero until such an article is published.
            'guide_count': by_crop.get(name, 0),
        })
    return Response({
        'categories': payload,
        'crops': [{'crop': crop, 'guide_count': total} for crop, total in sorted(by_crop.items())],
    })


@documented_api
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([FeedbackRateThrottle])
def newsletter_subscribe(request):
    """Opt-in to offers and new growing guides by e-mail or SMS."""
    serializer = NewsletterSubscribeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    subscriber = serializer.save(source=(request.data.get('source') or 'site')[:60])
    return Response(
        {
            'subscribed': True,
            'email': subscriber.email,
            'mobile': subscriber.mobile,
            'message': 'عضویت شما در خبرنامه گرین کود ثبت شد.',
        },
        status=status.HTTP_201_CREATED,
    )


@documented_api
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([FeedbackRateThrottle])
def newsletter_unsubscribe(request):
    """Leave the list. The row is kept (and marked inactive) for auditability."""
    email = (request.data.get('email') or '').strip()
    mobile = (request.data.get('mobile') or '').strip()
    if not email and not mobile:
        return Response(
            {'detail': 'برای لغو عضویت ایمیل یا موبایل را بفرستید.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    lookup = Q()
    if email:
        lookup |= Q(email=email)
    if mobile:
        lookup |= Q(mobile=mobile)
    updated = NewsletterSubscriber.objects.filter(lookup, is_active=True).update(
        is_active=False, unsubscribed_at=timezone.now()
    )
    return Response({'unsubscribed': updated > 0, 'count': updated})


# ========================================
# Legal documents
# ========================================
@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def legal_index(request):
    """The legal hub: every document, its summary and the current text version.

    Public on purpose. A policy a buyer has to log in to read is not a policy,
    and the checkout page links to these documents before anyone has an account.

    ``policy`` carries what the operator has configured for returns and express
    delivery, so the hub can quote a live number instead of the text guessing one.
    """
    data = legal.index_payload()
    data['policy'] = policy_payload()
    return Response(data)


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def legal_document(request, slug: str):
    """One legal document, in full.

    ``source`` distinguishes the text that ships with the code from a published
    admin page, so the renderer can say which one the reader is looking at
    instead of presenting an unreviewable block of prose as final.
    """
    doc = legal.get(slug)
    if doc is None:
        return Response({'detail': 'سند حقوقی پیدا نشد.'}, status=status.HTTP_404_NOT_FOUND)
    data = legal.payload(doc)
    if doc.slug == 'returns':
        # The window itself is a business decision, so it is injected from the
        # admin record and the shipped wording never claims a number.
        data['policy'] = policy_payload()
    return Response(data)
