"""Router for the agri-inputs bounded context.

Mounted at ``api/inputs/`` from garinkood/urls.py — a standalone router so
this module can be unplugged from the platform with a single line change.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"fertilizers", views.FertilizerViewSet, basename="agri-input-fertilizer")
router.register(r"pesticides", views.PesticideViewSet, basename="agri-input-pesticide")
router.register(r"seeds", views.SeedViewSet, basename="agri-input-seed")
router.register(r"seedlings", views.SeedlingViewSet, basename="agri-input-seedling")

urlpatterns = [path("", include(router.urls))]
