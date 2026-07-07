from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponseRedirect

urlpatterns = [
    path('admin/', admin.site.urls),

    # API endpoints (همه از طریق api_urls.py مدیریت می‌شوند)
    path('api/', include('shop.api_urls')),

    # Root endpoint - Redirect به React
    path('', lambda request: HttpResponseRedirect('http://localhost:5173/'), name='home'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)