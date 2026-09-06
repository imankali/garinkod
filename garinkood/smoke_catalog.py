"""Smoke-check the new catalogue endpoints against the dev database."""

import json

from django.test import Client
from django.test.utils import override_settings

from shop.models import Comment, Product

client = Client()


def show(url, keys=None, raw=False):
    response = client.get(url, follow=True)
    print(f'--- {url} → {response.status_code}')
    if response.status_code != 200:
        print(response.content[:200])
        return None
    try:
        data = response.json()
    except json.JSONDecodeError:
        print(response.content[:200])
        return None
    if raw:
        print(json.dumps(data, ensure_ascii=False)[:600])
        return data
    if keys:
        print({k: data.get(k) for k in keys})
    else:
        text = json.dumps(data, ensure_ascii=False)
        print(text[:420] + ('…' if len(text) > 420 else ''))
    return data


print('products:', Product.objects.filter(status='published').count())
show('/api/catalog/index/')
show('/api/catalog/landing/category/fertilizer/', keys=['title', 'count', 'children', 'facets', 'avg_rating'])
show('/api/catalog/landing/brand/اگرین/', keys=['kind', 'title', 'count', 'filters', 'partner'])
show('/api/catalog/landing/category/nope/', keys=['detail'])
show('/api/testimonials/', keys=['mode', 'total'])
show('/api/site/policies/', keys=['return_window_days', 'express_shipping'])
data = show('/api/products/?min_rating=4&has_reviews=true&ordering=-views&expiring_soon=0')
if isinstance(data, dict):
    print('  filtered results:', data.get('count'), [r['title'] for r in (data.get('results') or [])[:3]])
    print('  card keys:', {k: v for k, v in (data['results'][0] if data.get('results') else {}).items() if k in ('is_expiring_soon', 'image_alt_url', 'views')})

show('/api/pages/faq/', keys=['title', 'slug', 'kind'])
page = show('/api/pages/faq/')
if page and page.get('blocks'):
    first = page['blocks'][0]
    print('  block[0] type:', first.get('block_type'), 'rows:', len(first.get('rows') or []), '→', (first.get('rows') or [['', '']])[0])

product = Product.objects.filter(status='published').first()
if product:
    detail = show(f'/api/products/{product.slug}/')
    if detail:
        print('  packages:', json.dumps(detail.get('packages'), ensure_ascii=False)[:300])
        print('  fields:', {k: detail.get(k) for k in (
            'views', 'production_date', 'expiry_date', 'min_order_quantity', 'bulk_note',
            'video_url', 'tags', 'gallery',
        )})
    views_before = Product.objects.get(pk=product.pk).views
    print('views stored after fetch:', views_before)

review = Comment.objects.filter(active=True, rating__isnull=False).first()
if review:
    vote = client.post(f'/api/comments/{review.pk}/helpful/', {}, content_type='application/json')
    print('--- POST helpful →', vote.status_code, vote.content[:120])
    vote2 = client.post(f'/api/comments/{review.pk}/helpful/', {}, content_type='application/json')
    print('--- POST helpful again →', vote2.status_code, vote2.content[:120])
    rep = client.post(f'/api/comments/{review.pk}/report/', json.dumps({'reason': 'تست'}), content_type='application/json')
    print('--- POST report →', rep.status_code, rep.content[:120])

quotes = client.post('/api/shipping/quote/', json.dumps({'province': 'تهران', 'city': 'تهران'}), content_type='application/json')
print('--- shipping quote →', quotes.status_code, quotes.content[:300])

with override_settings(SITE_URL='http://testserver'):
    from shop import catalog_views  # noqa: F401  (module import side effect check)
    from django.urls import reverse
    print('sitemap route ok:', reverse('sitemap'))
    xml = client.get(reverse('sitemap'), follow=True).content.decode()
    for needle in ('/c/fertilizer', '/faq', '/customers', '/brand/'):
        print('  sitemap has', needle, ':', needle in xml)
