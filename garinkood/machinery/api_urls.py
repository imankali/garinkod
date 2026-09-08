"""Router for the machinery bounded context — standalone mount.

Registered at ``api/machinery/`` from garinkood/urls.py.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"tractors", views.TractorViewSet, basename="machinery-tractor")
router.register(r"implements", views.ImplementViewSet, basename="machinery-implement")

urlpatterns = [path("", include(router.urls))]
