"""Router for the logistics bounded context - standalone mount.

Registered at ``api/logistics/`` from garinkood/urls.py, beside the other
holding modules (api/inputs/, api/machinery/).
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"shipments", views.ShipmentViewSet, basename="logistics-shipment")

urlpatterns = [path("", include(router.urls))]
