from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponseRedirect
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from shop import operational, seo_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/docs/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-swagger"),
    path("api/docs/redoc/", SpectacularRedocView.as_view(url_name="api-schema"), name="api-redoc"),
    path("health/live/", operational.liveness, name="health-live"),
    path("ops/health/ready/", operational.ProtectedReadinessView.as_view(), name="health-ready"),
    path("ops/metrics/", operational.metrics, name="prometheus-metrics"),
    path("api/", include("shop.api_urls")),
    path("robots.txt", seo_views.robots_txt, name="robots"),
    path("sitemap.xml", seo_views.sitemap_xml, name="sitemap"),
    path("llms.txt", seo_views.llms_txt, name="llms"),
    path("ai-facts.json", seo_views.ai_facts_json, name="ai_facts"),
    # The storefront is deployed separately from the API.  Its URL is
    # configurable so an API request never redirects visitors to localhost.
    path("", lambda request: HttpResponseRedirect(settings.FRONTEND_URL), name="home"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
