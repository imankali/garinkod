"""Addressable catalogue pages and the two public trust read-outs.

A fertiliser shop is found by a question, not by a product id: «کود فسفره برای
زمستان»، «برند ایکس گرین»، «محلول‌پاشی». Each of those is a page with its own
address, its own intro text and its own product set, so this module assembles them
from the catalogue rather than from a template someone has to keep in sync.

Nothing here invents a number. A category with no products says so, a brand with no
represented-partner record still shows the products filed under it, and the
«تجربه خرید مشتریان» page is built from reviews that exist — with the editor's
picks first, and the most-voted ones as the fallback.
"""

from django.db.models import Avg, Count, Exists, Max, Min, OuterRef, Q
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from .models import (
    BrandPartner, Category, Comment, OrderItem, Product, ReturnPolicySettings,
    SiteArticle, SubCategory, Tag,
)
from .schema import documented_api
from .throttling import SearchRateThrottle

KINDS = ('category', 'subcategory', 'brand', 'tag')


def policy_payload() -> dict:
    """The return/exchange window and the express option, as configured.

    ``return_window_days`` is null until someone states it in the admin. The
    footer badge and the legal text both render this value, so the promise is made
    in one place and cannot drift; with nothing configured they fall back to
    wording that makes no numeric claim.
    """
    policy = ReturnPolicySettings.load()
    return {
        'return_window_days': policy.window_days,
        'return_window_label': policy.window_label,
        'return_conditions': policy.conditions,
        'express_shipping': {
            'enabled': policy.express_shipping_enabled,
            'fee': policy.express_shipping_fee,
        },
        'updated_at': policy.updated_at.isoformat() if policy.updated_at else '',
    }


def _crumbs(*items: tuple[str, str]) -> list[dict]:
    return [{'title': 'خانه', 'url': '/'}, *[{'title': t, 'url': u} for t, u in items if t]]


def _facet_block(products) -> dict:
    """Facet values, brand counts and the live price band of one product set."""
    brands = list(
        products.exclude(brand='')
        .values('brand', 'brand_slug')
        .annotate(total=Count('id'))
        .order_by('-total', 'brand')[:30]
    )
    packages = list(
        products.exclude(package_weight='')
        .values('package_weight')
        .annotate(total=Count('id'))
        .order_by('package_weight')[:20]
    )
    band = products.aggregate(low=Min('price'), high=Max('price'), avg=Avg('price'))
    return {
        'brands': [
            {'name': row['brand'], 'slug': row['brand_slug'], 'count': row['total']}
            for row in brands
        ],
        'packages': [{'label': row['package_weight'], 'count': row['total']} for row in packages],
        'price': {
            'min': band['low'] or 0,
            'max': band['high'] or 0,
            'average': int(band['avg'] or 0),
        },
        'has_expiring_soon': products.filter(expiry_date__isnull=False).exists(),
    }


def _related_articles(products) -> list[dict]:
    """Guides that mention a product of this set, so a category page can teach."""
    return [
        {
            'title': article.title,
            'slug': article.slug,
            'kind': article.kind,
            'excerpt': article.excerpt,
            'reading_minutes': article.reading_minutes,
        }
        for article in SiteArticle.objects.filter(is_published=True, products__in=products)
        .distinct()
        .order_by('-published_at')[:6]
    ]


URL_PREFIX = {'category': 'c', 'subcategory': 'sc', 'tag': 'tag', 'brand': 'brand'}

# Only rows with these columns are card-able, which is exactly what Category,
# SubCategory and Tag share.
def _article_cards(rows, kind: str) -> list[dict]:
    prefix = URL_PREFIX[kind]
    cards = []
    for row in rows:
        image = getattr(row, 'image', None) or getattr(row, 'logo', None)
        cards.append({
            'kind': kind,
            'title': row.name,
            'slug': row.slug,
            'image_url': image.url if image else '',
            'description': (getattr(row, 'description', '') or '')[:300],
            'count': getattr(row, 'product_count', None)
            if getattr(row, 'product_count', None) is not None
            else Product.objects.filter(**{f'{kind}': row}, status='published').count(),
            'url': f'/{prefix}/{row.slug}',
        })
    return cards


def _rating_of(products) -> float:
    """The same rating rule the product cards use: approved reviews only."""
    scored = Q(comments__active=True, comments__parent__isnull=True, comments__rating__isnull=False)
    return round(float(products.aggregate(value=Avg('comments__rating', filter=scored))['value'] or 0), 2)


def _landing_for_category(category: Category) -> dict:
    products = category.get_products()
    # A subcategory is reached from the default ``product`` reverse name, unlike a
    # category, whose FK declares ``related_name='products'``.
    subs = category.subcategories.annotate(
        product_count=Count('product', filter=Q(product__status='published'))
    ).order_by('name')
    return {
        'kind': 'category',
        'title': category.name,
        'slug': category.slug,
        'description': category.description,
        'image_url': category.image.url if category.image else '',
        'seo_title': category.seo_title or f'خرید {category.name} | قیمت و مشخصات',
        'seo_description': category.seo_description or (category.description[:160] if category.description else ''),
        'breadcrumb': _crumbs(('راهنمای خرید', '/products'), (category.name, f'/c/{category.slug}')),
        'filters': {'category': category.slug},
        'children': _article_cards(subs, 'subcategory'),
        'siblings': _article_cards(
            Category.objects.exclude(pk=category.pk).annotate(
                product_count=Count('products', filter=Q(products__status='published'))
            ).order_by('name')[:12],
            'category',
        ),
        'count': products.count(),
        'avg_rating': _rating_of(products),
        'facets': _facet_block(products),
        'articles': _related_articles(products),
    }


def _landing_for_subcategory(sub: SubCategory) -> dict:
    products = Product.objects.filter(subcategory=sub, status='published')
    parent = sub.category
    parent_name = parent.name if parent else ''
    siblings = parent.subcategories.exclude(pk=sub.pk).annotate(
        product_count=Count('product', filter=Q(product__status='published'))
    ).order_by('name')[:12]
    return {
        'kind': 'subcategory',
        'title': sub.name,
        'slug': sub.slug,
        'description': '',
        'image_url': parent.image.url if parent and parent.image else '',
        'seo_title': f'{sub.name} | {parent_name}'.strip(' |'),
        'seo_description': f'{sub.name} در دسته {parent_name}: قیمت، مشخصات و نحوه مصرف.' if parent_name else '',
        'breadcrumb': _crumbs(
            ('راهنمای خرید', '/products'),
            (parent_name, f'/c/{parent.slug}') if parent else ('', ''),
            (sub.name, f'/sc/{sub.slug}'),
        ),
        'filters': {'subcategory': sub.slug},
        'children': [],
        'siblings': _article_cards(siblings, 'subcategory'),
        'count': products.count(),
        'avg_rating': _rating_of(products),
        'facets': _facet_block(products),
        'articles': _related_articles(products),
    }


def _landing_for_brand(slug: str) -> dict | None:
    """A represented brand if the admin has one, otherwise the catalogue's own value.

    Suppliers get listed by the products that carry their name first; a
    ``BrandPartner`` row only adds the logo and the editorial description. That
    order matters — a brand page must exist for anything the catalogue can filter
    on, not only for the brands someone remembered to create a record for.
    """
    partner = BrandPartner.objects.filter(slug=slug).first()
    products = Product.objects.filter(status='published', brand_slug=slug)
    if partner is None and not products.exists():
        return None
    name = partner.name if partner else (products.first().brand if products.exists() else slug)
    return {
        'kind': 'brand',
        'title': name,
        'slug': slug,
        'description': partner.description if partner else '',
        'image_url': partner.logo_url if partner else '',
        'seo_title': f'محصولات {name} | قیمت و موجودی',
        'seo_description': f'فهرست محصولات {name} در گرین کود، با قیمت، موجودی و مشخصات فنی.',
        'breadcrumb': _crumbs(('برندها', '/brands'), (name, f'/brand/{slug}')),
        'filters': {'brand_slug': slug},
        'children': [],
        'siblings': [],
        'count': products.count(),
        'avg_rating': _rating_of(products),
        'facets': _facet_block(products),
        'articles': _related_articles(products),
        'partner': {
            'website': partner.website if partner else '',
            'since_year': partner.since_year if partner else None,
        } if partner else None,
    }


def _landing_for_tag(tag: Tag) -> dict:
    products = tag.products.filter(status='published')
    return {
        'kind': 'tag',
        'title': tag.name,
        'slug': tag.slug,
        'description': tag.description,
        'image_url': tag.image.url if tag.image else '',
        'seo_title': tag.seo_title or f'{tag.name} | خرید از گرین کود',
        'seo_description': tag.seo_description or (tag.description[:160] if tag.description else ''),
        'breadcrumb': _crumbs(('راهنمای خرید', '/products'), (tag.name, f'/tag/{tag.slug}')),
        'filters': {'tag': tag.slug},
        'children': [],
        'siblings': [
            {
                'title': other.name,
                'slug': other.slug,
                'image_url': '',
                'description': (other.description or '')[:300],
                'count': other.products.filter(status='published').count(),
                'url': f'/tag/{other.slug}',
            }
            for other in Tag.objects.exclude(pk=tag.pk)[:12]
        ],
        'count': products.count(),
        'avg_rating': _rating_of(products),
        'facets': _facet_block(products),
        'articles': _related_articles(products),
    }


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([SearchRateThrottle])
def catalog_landing(request, kind: str, slug: str):
    """One page per category, subcategory, brand or tag.

    The payload carries the exact ``filters`` object the product list expects, so
    the grid on this page and the page's own promise cannot disagree: the count,
    the facets and the products all come from the same queryset.
    """
    builders = {
        'category': lambda: (
            _landing_for_category(Category.objects.get(slug=slug))
            if Category.objects.filter(slug=slug).exists() else None
        ),
        'subcategory': lambda: (
            _landing_for_subcategory(SubCategory.objects.get(slug=slug))
            if SubCategory.objects.filter(slug=slug).exists() else None
        ),
        'brand': lambda: _landing_for_brand(slug),
        'tag': lambda: (
            _landing_for_tag(Tag.objects.get(slug=slug))
            if Tag.objects.filter(slug=slug).exists() else None
        ),
    }
    builder = builders.get(kind)
    if builder is None:
        return Response({'detail': 'چنین صفحه‌ای در فهرست نداریم.'}, status=404)
    try:
        data = builder()
    except (Category.DoesNotExist, SubCategory.DoesNotExist, Tag.DoesNotExist):
        data = None
    if data is None:
        return Response({'detail': 'چنین صفحه‌ای در فهرست نداریم.'}, status=404)
    return Response(data)


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([SearchRateThrottle])
def catalog_index(request):
    """Every addressable landing page, grouped — the catalogue's index.

    Kept as one request because the footer, the sitemap builder and the shop's
    «همه دسته‌ها» panel all need the same list, and none of them should have to
    know how many brands or tags exist.
    """
    categories = Category.objects.annotate(
        product_count=Count('products', filter=Q(products__status='published'))
    ).order_by('name')
    brands = list(
        Product.objects.filter(status='published')
        .exclude(brand_slug='')
        .values('brand', 'brand_slug')
        .annotate(total=Count('id'))
        .order_by('-total', 'brand')[:60]
    )
    return Response({
        'categories': [
            {
                'title': row.name,
                'slug': row.slug,
                'image_url': row.image.url if row.image else '',
                'count': row.product_count,
                'url': f'/c/{row.slug}',
            }
            for row in categories
        ],
        'tags': [
            {
                'title': row.name,
                'slug': row.slug,
                'count': row.products.filter(status='published').count(),
                'url': f'/tag/{row.slug}',
            }
            for row in Tag.objects.all()[:60]
        ],
        'brands': [
            {'title': row['brand'], 'slug': row['brand_slug'], 'count': row['total'],
             'url': f'/brand/{row["brand_slug"]}'}
            for row in brands
        ],
    })


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([SearchRateThrottle])
def buyer_experiences(request):
    """What buyers said, curated — the «تجربه خرید مشتریان» page.

    Editors pin the reviews that represent the shop (``is_featured``); until
    anyone pins something the page shows the most-voted four- and five-star
    reviews of paid orders, which are real but nobody has vouched for. The
    response says which of the two the reader is looking at.
    """
    reviews = (
        Comment.objects.filter(active=True, parent__isnull=True, rating__gte=4)
        .select_related('product', 'user')
        .annotate(
            bought=Exists(
                OrderItem.objects.filter(
                    order__user=OuterRef('user'),
                    product=OuterRef('product'),
                    order__payment_status='paid',
                )
            )
        )
    )
    # Three tiers, in the order a reader would want them: what an editor pinned,
    # then what a paid buyer wrote, then everything else that was rated well. The
    # response says which one this is, so an unverified review is never dressed up
    # as a purchase.
    featured = list(reviews.filter(is_featured=True).order_by('-created')[:24])
    bought_rows = list(reviews.filter(bought=True).order_by('-helpful_count', '-created')[:24])
    if featured:
        mode, rows = 'curated', featured
    elif bought_rows:
        mode, rows = 'verified', bought_rows
    else:
        mode, rows = 'open', list(reviews.order_by('-helpful_count', '-created')[:24])
    return Response({
        'mode': mode,
        'total': reviews.count(),
        'items': [
            {
                'id': row.id,
                'name': row.name or (row.user.get_full_name() or 'خریدار گرین کود' if row.user else 'خریدار'),
                'body': row.body,
                'rating': row.rating,
                'sticker': row.sticker,
                'image_url': row.image.url if row.image else '',
                'created': row.created.date().isoformat(),
                'helpful_count': row.helpful_count,
                'verified_purchase': bool(row.bought),
                'product': {
                    'title': row.product.title,
                    'slug': row.product.slug,
                    'brand': row.product.brand,
                    'image_url': row.product.image_url,
                    'url': f"/products/{row.product.slug}",
                },
            }
            for row in rows
        ],
    })


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def site_policies(request):
    """The shop's own return and express-delivery settings, as configured."""
    return Response(policy_payload())
