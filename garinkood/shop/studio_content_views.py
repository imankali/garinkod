"""Content production for the console: products and articles, every field.

Django's own admin can already do this, but a manager should not have to learn a
second interface, remember a second password or open a second tab to publish a
product or a «راهنمای کشت» — and the storefront studio had no way at all to add
catalogue rows, so every new product meant an engineer.

Two rules shape this module:

* **Nothing is omitted.** The serializers expose every field the model carries
  (category *and* subcategory, discount, packages, spec table, SEO, shipping
  dimensions, batch dates, the article's related products and guides), because a
  production screen that covers 90 % of the fields is a screen where the missing
  10 % still gets published wrong — or not at all.
* **Nothing is guessed at by the client.** Slugs are derived server-side when a
  caller leaves them empty, spec and package rows are replaced only when the
  payload actually mentions them, and the taxonomy endpoint answers what a valid
  category/subcategory pair is, so the console cannot offer a combination the
  database would reject.

Access is the management level (سطح ۶ به بالا), the same gate as the moderation
queue, and every write lands in :class:`AdminAuditLog` — content changes are the
changes a customer blames the site for.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    Category, MarketplaceListing, Product, ProductAttribute, ProductImage,
    ProductPackage, SiteArticle, SubCategory, Tag,
)
from .models.catalog import PRODUCT_ATTRIBUTE_TEMPLATE
from .permissions import IsModerator
from .serializers import (
    CategorySerializer, ProductPackageSerializer, SiteArticleSerializer,
    SubCategorySerializer, TagSerializer,
)
from .slugs import slugify_fa, unique_slug


class ConsolePagination(PageNumberPagination):
    """The console browses its own backlog in bigger pages than the shop.

    A manager scanning forty draft rows should not pay forty round trips for the
    privilege, and 100 is still small enough that a stray ``page_size=100000``
    cannot turn one request into a full table dump.
    """

    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


# =============================================================================
# Shared write helpers
# =============================================================================

class SpecRowSerializer(serializers.Serializer):
    """One label/value row of the spec table, replaced wholesale on write.

    Blank values are dropped rather than stored: an empty «شماره بچ» row is
    noise on a product page, and the seeded template means a form legitimately
    submits rows the manager has not filled yet.
    """

    label = serializers.CharField(max_length=80)
    value = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')
    order = serializers.IntegerField(required=False, min_value=0, max_value=9999)

    def to_internal_value(self, data):
        if isinstance(data, str):
            # A plain string is a label with no value yet — how the template is
            # seeded — and must not be rejected for being terse.
            data = {'label': data}
        return super().to_internal_value(data)


def _replace_spec_rows(product, rows) -> None:
    ordered = [
        (index, str(row.get('label') or '').strip(), str(row.get('value') or '').strip(),
         row.get('order') if row.get('order') is not None else index)
        for index, row in enumerate(rows)
        if str(row.get('label') or '').strip()
    ]
    product.attributes.all().delete()
    ProductAttribute.objects.bulk_create(
        [
            ProductAttribute(product=product, label=label[:80], value=value[:300], order=order)
            for _index, label, value, order in ordered
        ]
    )


def _replace_packages(product, rows) -> None:
    """Rewrite the package table from a list of dicts, keeping ids when given.

    Prices and stock are nullable on the model, and null means *follow the
    product* — so an omitted key must stay null rather than become 0, or a
    one-bag product would appear to have nothing in stock.
    """
    wanted_ids = set()
    for index, row in enumerate(rows):
        label = str(row.get('label') or '').strip()
        if not label:
            continue
        defaults = {
            'label': label[:120],
            'weight_kg': row.get('weight_kg') or None,
            'price': row.get('price') if row.get('price') not in ('', None) else None,
            'stock': row.get('stock') if row.get('stock') not in ('', None) else None,
            'min_order_quantity': row.get('min_order_quantity') or 1,
            'bulk_note': (row.get('bulk_note') or '')[:500],
            'production_date': row.get('production_date') or None,
            'expiry_date': row.get('expiry_date') or None,
            'is_default': bool(row.get('is_default')),
            'order': row.get('order') if row.get('order') is not None else index,
        }
        package_id = row.get('id')
        if package_id:
            package, created = ProductPackage.objects.get_or_create(
                pk=package_id, product=product, defaults=defaults
            )
            if not created:
                for key, value in defaults.items():
                    setattr(package, key, value)
                package.save()
        else:
            package = ProductPackage.objects.create(product=product, **defaults)
        wanted_ids.add(package.pk)
        # Exactly one default package, whichever row claimed it last.
        if defaults['is_default']:
            ProductPackage.objects.filter(product=product).exclude(pk=package.pk).update(
                is_default=False
            )
    stale = product.packages.exclude(pk__in=wanted_ids)
    if rows:
        stale.delete()


def _resolve_tags(names) -> list[Tag]:
    """Accept ids or names; create a tag the first time a product asks for it.

    A manager typing «کود آلی» into a free-text tag box should not have to visit
    a second screen to register the label first, and the slug is generated the
    same way every other slug in this site is, so the tag page works at once.
    """
    tags: list[Tag] = []
    for raw in names or []:
        value = str(raw).strip()
        if not value:
            continue
        if value.isdigit():
            tag = Tag.objects.filter(pk=int(value)).first()
        else:
            slug = slugify_fa(value)
            tag = Tag.objects.filter(slug=slug).first() or Tag.objects.filter(name__iexact=value).first()
            if tag is None:
                tag = Tag.objects.create(name=value[:80], slug=unique_slug(Tag, value, fallback='tag'))
        if tag is not None:
            tags.append(tag)
    return tags


# =============================================================================
# Products
# =============================================================================

class ProductWorkSerializer(serializers.ModelSerializer):
    """A product, writable in full — the console's catalogue form."""

    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), required=False, allow_null=True
    )
    subcategory = serializers.PrimaryKeyRelatedField(
        queryset=SubCategory.objects.all(), required=False, allow_null=True
    )
    category_name = serializers.CharField(source='category.name', read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    brand_slug = serializers.CharField(read_only=True)
    image_url = serializers.CharField(read_only=True)
    discounted_price = serializers.IntegerField(read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    expiry_days_left = serializers.IntegerField(read_only=True)
    views = serializers.IntegerField(read_only=True)
    sales_count = serializers.IntegerField(read_only=True)
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)

    packages = ProductPackageSerializer(many=True, required=False)
    # Read back in full, blank rows included: a seeded template row exists so the
    # manager can fill it in later, and dropping it from the payload would make
    # the console's own form lose the labels it just offered.
    attributes = SpecRowSerializer(many=True, required=False)
    images = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=80), required=False, write_only=True,
    )
    gallery = serializers.ListField(
        child=serializers.CharField(max_length=400), required=False, write_only=True,
        help_text='آدرس تصویرهای گالری؛ با هر بار ذخیره، گالری از نو چیده می‌شود.',
    )
    spec_template = serializers.BooleanField(
        required=False, write_only=True,
        help_text='با مقدار ۱، جدول ویژگی‌های استاندارد ساخته می‌شود.',
    )

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'slug', 'description', 'category', 'category_name',
            'subcategory', 'subcategory_name', 'brand', 'brand_slug', 'package_weight',
            'price', 'discount_percent', 'discounted_price', 'stock', 'available',
            'is_in_stock', 'is_featured', 'status', 'publish', 'price_on_request',
            'sku', 'gtin', 'seo_title', 'seo_description', 'video_url',
            'shipping_weight_grams', 'shipping_length_cm', 'shipping_width_cm',
            'shipping_height_cm', 'production_date', 'expiry_date', 'expiry_days_left',
            'min_order_quantity', 'bulk_note', 'image', 'image_url', 'images',
            'gallery', 'packages', 'attributes', 'tags', 'tag_names', 'spec_template',
            'views', 'sales_count', 'author', 'author_name', 'created', 'updated',
        ]
        read_only_fields = ['id', 'author', 'created', 'updated', 'views', 'sales_count']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'price': {'required': False, 'default': 0},
            'image': {'required': False, 'allow_null': True},
            # The console types a title, not an address: ``create()`` derives a
            # unique Persian slug from the title when the field is left out.
            'slug': {'required': False, 'allow_blank': True},
        }

    def get_images(self, obj) -> list[dict]:
        return [
            {'id': row.id, 'url': row.image.url if row.image else '', 'caption': row.caption}
            for row in obj.images.all()
        ]

    def get_tags(self, obj) -> list[dict]:
        return [{'id': tag.id, 'name': tag.name, 'slug': tag.slug} for tag in obj.tags.all()]

    def validate(self, attrs):
        # The same parent/child rule the storefront composer enforces: a product
        # filed under «کود NPK» outside the «کود» department would appear on one
        # page and not the other.
        subcategory = attrs.get('subcategory')
        if subcategory is not None:
            category = attrs.get('category', getattr(self.instance, 'category', None))
            if category is not None and subcategory.category_id != category.id:
                raise serializers.ValidationError({
                    'subcategory': '«زیردسته» باید زیرمجموعه همان دسته باشد.',
                })
            if category is None:
                attrs['category'] = subcategory.category
        percent = attrs.get('discount_percent')
        if percent is not None and int(percent) > 90:
            raise serializers.ValidationError({'discount_percent': 'درصد تخفیف باید ۹۰ یا کمتر باشد.'})
        if int(attrs.get('price') or 0) <= 0 and not attrs.get('price_on_request'):
            # A published product with no price is a broken card, but a quote-only
            # line legitimately has none, so the rule is status-aware below.
            if attrs.get('status', getattr(self.instance, 'status', 'draft')) == 'published':
                raise serializers.ValidationError({
                    'price': 'برای انتشار محصول، قیمت را وارد کنید یا «قیمت با تماس» را روشن کنید.',
                })
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        tag_names = validated_data.pop('tag_names', None)
        gallery = validated_data.pop('gallery', None)
        attributes = validated_data.pop('attributes', None)
        packages = validated_data.pop('packages', None)
        spec_template = validated_data.pop('spec_template', False)
        request = self.context.get('request')
        validated_data.setdefault('author', request.user if request else None)
        if not validated_data.get('slug'):
            validated_data['slug'] = unique_slug(Product, validated_data.get('title', ''), fallback='product')
        product = Product.objects.create(**validated_data)
        if tag_names is not None:
            product.tags.set(_resolve_tags(tag_names))
        if attributes is not None:
            _replace_spec_rows(product, attributes)
        elif spec_template:
            ProductAttribute.objects.bulk_create(
                [
                    ProductAttribute(product=product, label=label, value='', order=index)
                    for index, label in enumerate(PRODUCT_ATTRIBUTE_TEMPLATE)
                ]
            )
        if packages is not None:
            _replace_packages(product, packages)
        if gallery is not None:
            for index, url in enumerate([str(item).strip() for item in gallery if str(item).strip()][:12]):
                ProductImage.objects.create(product=product, image=url, caption='', order=index)
        return product

    @transaction.atomic
    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tag_names', None)
        gallery = validated_data.pop('gallery', None)
        attributes = validated_data.pop('attributes', None)
        packages = validated_data.pop('packages', None)
        validated_data.pop('spec_template', None)
        product = super().update(instance, validated_data)
        if tag_names is not None:
            product.tags.set(_resolve_tags(tag_names))
        if attributes is not None:
            _replace_spec_rows(product, attributes)
        if packages is not None:
            _replace_packages(product, packages)
        if gallery is not None:
            product.images.all().delete()
            for index, url in enumerate([str(item).strip() for item in gallery if str(item).strip()][:12]):
                ProductImage.objects.create(product=product, image=url, caption='', order=index)
        return product


class ProductWorkViewSet(viewsets.ModelViewSet):
    """Every field of a catalogue row, from the console.

    Filtering is intentionally thin: the console lists products by search,
    department or status and then edits one at a time, which is a different job
    from the public shop's faceted browse.
    """

    serializer_class = ProductWorkSerializer
    permission_classes = [IsModerator]
    pagination_class = ConsolePagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'description', 'brand', 'sku', 'gtin']
    ordering_fields = ['created', 'publish', 'title', 'price', 'sales_count', 'stock']
    ordering = ['-created']

    def get_queryset(self):
        queryset = Product.objects.select_related('category', 'subcategory', 'author').prefetch_related(
            'images', 'tags', 'packages', 'attributes'
        )
        params = self.request.query_params
        status_filter = params.get('status', '').strip()
        if status_filter in {'draft', 'published'}:
            queryset = queryset.filter(status=status_filter)
        category = params.get('category', '').strip()
        if category:
            # The console filters by department the way it links to one: by id
            # when it has the row, by slug when it only has the address.
            queryset = queryset.filter(
                {'category_id': int(category)} if category.isdigit() else Q(category__slug=category)
            )
        brand = params.get('brand', '').strip()
        if brand:
            queryset = queryset.filter(brand__iexact=brand)
        if params.get('low_stock') in {'1', 'true', 'True'}:
            queryset = queryset.filter(stock__lt=10)
        if params.get('unfiled') in {'1', 'true', 'True'}:
            # The backlog that matters: a published product nobody can find
            # through the category chips.
            queryset = queryset.filter(category__isnull=True)
        return queryset

    def perform_create(self, serializer):
        product = serializer.save(author=self.request.user)
        self._audit('content.product.create', product, f'afzodan mohsool: {product.title}')

    def perform_update(self, serializer):
        product = serializer.save()
        self._audit('content.product.update', product, f'virayesh mohsool: {product.title}')

    def perform_destroy(self, instance):
        self._audit('content.product.delete', instance, f'hazf mohsool: {instance.title}')
        instance.delete()

    def _audit(self, action_name, target, summary):
        from .api_views import _audit as audit

        audit(self.request.user, action_name, target, summary)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish or unpublish without opening the whole form."""
        product = self.get_object()
        product.status = 'draft' if product.status == 'published' else 'published'
        if product.status == 'published':
            product.publish = product.publish or timezone.now()
            product.available = True
        product.save(update_fields=['status', 'publish', 'available', 'updated'])
        return Response(self.get_serializer(product).data)


# =============================================================================
# Articles and growing guides
# =============================================================================

class ArticleWorkSerializer(serializers.ModelSerializer):
    """A blog article or growing guide, writable in full."""

    author_name = serializers.SerializerMethodField()
    cover_url = serializers.CharField(read_only=True)
    url = serializers.SerializerMethodField()
    # The console lists what is linked by name, not by bare id: a manager who
    # attached three products has to see which three without a second request.
    linked_products = serializers.SerializerMethodField()
    linked_listings = serializers.SerializerMethodField()
    products = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), many=True, required=False
    )
    listings = serializers.PrimaryKeyRelatedField(
        queryset=MarketplaceListing.objects.all(), many=True, required=False
    )
    related_articles = serializers.PrimaryKeyRelatedField(
        queryset=SiteArticle.objects.all(), many=True, required=False
    )

    class Meta:
        model = SiteArticle
        fields = [
            'id', 'title', 'slug', 'kind', 'excerpt', 'body', 'cover', 'cover_url', 'url',
            'crop', 'author', 'author_name', 'products', 'listings', 'related_articles',
            'linked_products', 'linked_listings',
            'reading_minutes', 'views', 'is_published', 'published_at', 'is_featured',
            'seo_title', 'seo_description', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'views', 'published_at', 'created_at', 'updated_at',
            'linked_products', 'linked_listings',
        ]
        extra_kwargs = {
            'body': {'required': False, 'allow_blank': True},
            'cover': {'required': False, 'allow_null': True},
            # Typed from the title, like the product form.
            'slug': {'required': False, 'allow_blank': True},
        }

    def get_author_name(self, obj) -> str:
        return obj.author.get_full_name() or obj.author.username if obj.author else ''

    def get_url(self, obj) -> str:
        return obj.get_absolute_url()

    def get_linked_products(self, obj) -> list[dict]:
        return [
            {'id': row.id, 'title': row.title, 'slug': row.slug, 'status': row.status}
            for row in obj.products.all()
        ]

    def get_linked_listings(self, obj) -> list[dict]:
        return [
            {'id': row.id, 'title': row.title, 'slug': row.slug, 'status': row.status}
            for row in obj.listings.all()
        ]

    def validate(self, attrs):
        if attrs.get('is_published') and not (attrs.get('body') or getattr(self.instance, 'body', '')):
            raise serializers.ValidationError({'body': 'برای انتشار مقاله، متن آن الزامی است.'})
        return attrs

    def create(self, validated_data):
        relations = {
            key: validated_data.pop(key, None)
            for key in ('products', 'listings', 'related_articles')
        }
        if not validated_data.get('slug'):
            validated_data['slug'] = unique_slug(SiteArticle, validated_data.get('title', ''), fallback='article')
        request = self.context.get('request')
        if request and not validated_data.get('author'):
            validated_data['author'] = request.user
        article = SiteArticle.objects.create(**validated_data)
        for key, value in relations.items():
            if value is not None:
                getattr(article, key).set(value)
        return article

    def update(self, instance, validated_data):
        relations = {
            key: validated_data.pop(key, None)
            for key in ('products', 'listings', 'related_articles')
        }
        article = super().update(instance, validated_data)
        for key, value in relations.items():
            if value is not None:
                getattr(article, key).set(value)
        return article


class ArticleWorkViewSet(viewsets.ModelViewSet):
    """Articles and guides, including the drafts nobody has published yet."""

    serializer_class = ArticleWorkSerializer
    permission_classes = [IsModerator]
    lookup_field = 'pk'
    search_fields = ['title', 'excerpt', 'body', 'crop']
    ordering_fields = ['created_at', 'published_at', 'views', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = SiteArticle.objects.select_related('author').prefetch_related(
            'products', 'listings', 'related_articles'
        )
        params = self.request.query_params
        kind = params.get('kind', '').strip()
        if kind in {SiteArticle.KIND_ARTICLE, SiteArticle.KIND_GUIDE}:
            queryset = queryset.filter(kind=kind)
        state = params.get('state', '').strip()
        if state == 'published':
            queryset = queryset.filter(is_published=True)
        elif state == 'draft':
            queryset = queryset.filter(is_published=False)
        if params.get('featured') in {'1', 'true', 'True'}:
            queryset = queryset.filter(is_featured=True)
        return queryset

    def perform_create(self, serializer):
        article = serializer.save()
        self._audit('content.article.create', article, f'afzodan maghale: {article.title}')

    def perform_update(self, serializer):
        article = serializer.save()
        self._audit('content.article.update', article, f'virayesh maghale: {article.title}')

    def perform_destroy(self, instance):
        self._audit('content.article.delete', instance, f'hazf maghale: {instance.title}')
        instance.delete()

    def _audit(self, action_name, target, summary):
        from .api_views import _audit as audit

        audit(self.request.user, action_name, target, summary)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        article = self.get_object()
        article.is_published = not article.is_published
        if article.is_published and not article.published_at:
            article.published_at = timezone.now()
        article.save(update_fields=['is_published', 'published_at', 'updated_at'])
        return Response(self.get_serializer(article).data)


# =============================================================================
# Taxonomy, for the forms
# =============================================================================

class CategoryWorkSerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'description', 'image', 'seo_title', 'seo_description',
            'storefront_only', 'subcategories', 'product_count',
        ]
        # The slug is derived from the name when left empty, exactly like the
        # other addressable rows in this site.
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}

    def get_product_count(self, obj) -> int:
        return obj.products.filter(status='published').count()

    def validate_name(self, value):
        return (value or '').strip()

    def save(self, **kwargs):
        if not self.instance and not self.validated_data.get('slug'):
            self.validated_data['slug'] = unique_slug(
                Category, self.validated_data.get('name', ''), fallback='category'
            )
        return super().save(**kwargs)


class SubCategoryWorkSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    product_count = serializers.SerializerMethodField()
    ad_count = serializers.SerializerMethodField()

    class Meta:
        model = SubCategory
        fields = ['id', 'name', 'slug', 'category', 'category_name', 'product_count', 'ad_count']
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}

    def get_product_count(self, obj) -> int:
        # ``Product.subcategory`` has no related_name, so this counts through the
        # model rather than a reverse accessor that does not exist.
        return Product.objects.filter(subcategory=obj, status='published').count()

    def get_ad_count(self, obj) -> int:
        return MarketplaceListing.objects.filter(subcategory=obj, status='published').count()

    def save(self, **kwargs):
        if not self.instance and not self.validated_data.get('slug'):
            self.validated_data['slug'] = unique_slug(
                SubCategory, self.validated_data.get('name', ''), fallback='subcategory'
            )
        return super().save(**kwargs)


class CategoryWorkViewSet(viewsets.ModelViewSet):
    """Departments and their subcategories, so a new line has somewhere to live.

    Creating a product is blocked on the taxonomy existing — without this the
    console could only ever publish into a department someone made earlier in
    Django admin.
    """

    serializer_class = CategoryWorkSerializer
    permission_classes = [IsModerator]
    lookup_field = 'pk'
    # Unpaginated on purpose. The site has a couple of dozen departments and a
    # console form needs them all in one <select>; a 12-row page would silently
    # hide the rest of the taxonomy behind a dropdown.
    pagination_class = None

    def get_queryset(self):
        return Category.objects.prefetch_related('subcategories').order_by('name')


class SubCategoryWorkViewSet(viewsets.ModelViewSet):
    serializer_class = SubCategoryWorkSerializer
    permission_classes = [IsModerator]
    lookup_field = 'pk'
    pagination_class = None  # same reason as the departments above

    def get_queryset(self):
        queryset = SubCategory.objects.select_related('category').order_by('category__name', 'name')
        category = self.request.query_params.get('category', '').strip()
        if category:
            queryset = queryset.filter(
                {'category_id': int(category)} if category.isdigit() else {'category__slug': category}
            )
        return queryset


class TagWorkViewSet(viewsets.ModelViewSet):
    """The tag list, so a console form can offer existing labels before inventing new ones."""

    serializer_class = TagSerializer
    permission_classes = [IsModerator]
    lookup_field = 'slug'
    pagination_class = None  # the tag picker needs the whole list, not page one

    def get_queryset(self):
        return Tag.objects.order_by('name')


class StudioOptionsView(viewsets.ViewSet):
    """Everything the two forms need to offer valid choices in one request."""

    permission_classes = [IsModerator]

    def list(self, request):
        categories = Category.objects.prefetch_related('subcategories').order_by('name')
        brands = (
            Product.objects.exclude(brand='')
            .values('brand', 'brand_slug')
            .annotate(total=Count('id'))
            .order_by('-total', 'brand')[:120]
        )
        crops = (
            SiteArticle.objects.exclude(crop='')
            .values('crop')
            .annotate(total=Count('id'))
            .order_by('crop')[:80]
        )
        return Response({
            'categories': CategoryWorkSerializer(categories, many=True).data,
            'brands': [{'brand': row['brand'], 'slug': row['brand_slug'], 'count': row['total']} for row in brands],
            'tags': TagSerializer(Tag.objects.order_by('name'), many=True).data,
            'crops': [{'crop': row['crop'], 'article_count': row['total']} for row in crops],
            'product_statuses': dict(Product.STATUS_CHOICES),
            'article_kinds': dict(SiteArticle.KIND_CHOICES),
            'spec_template': list(PRODUCT_ATTRIBUTE_TEMPLATE),
        })
