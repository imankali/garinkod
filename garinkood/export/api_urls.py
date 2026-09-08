"""Router for the export bounded context - standalone mount.

Registered at ``api/export/`` from garinkood/urls.py, beside the other
holding modules (api/inputs/, api/machinery/, api/logistics/).
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"orders", views.ExportOrderViewSet, basename="export-order")
router.register(r"documents", views.ExportDocumentViewSet, basename="export-document")

urlpatterns = [path("", include(router.urls))]
