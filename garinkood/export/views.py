"""Export trade-file API: staff run the file, the owner watches it.

Two locks, both deliberate:

1. Authentication first - a trade file names the buyer, the market and the
   money; none of that is anonymous data.
2. Row-level ownership in ``get_queryset`` - a non-staff caller only ever
   sees files backed by their own order; a foreign file id answers 404 so
   the endpoint does not even confirm it exists.

Mutations are staff-only: status moves, file creation, paper uploads and
verification are legal acts. The buyer's surface is strictly read-only.
"""

import mimetypes
from pathlib import Path

from django.db.models import Prefetch
from django.http import FileResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ExportDocument, ExportOrder
from .serializers import ExportDocumentSerializer, ExportOrderSerializer


class IsAuthenticatedReadOnlyOrStaffWrite(permissions.BasePermission):
    """Safe methods: any signed-in caller (row scoping in ``get_queryset``).
    Anything that mutates: staff only - trade files and customs papers are
    legal artifacts, never customer-editable."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user.is_staff)


class ExportOrderViewSet(viewsets.ModelViewSet):
    """Export case files; a buyer sees only files backed by their own order."""

    permission_classes = [IsAuthenticatedReadOnlyOrStaffWrite]
    serializer_class = ExportOrderSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = {
        "status": ["exact"],
        "destination_country": ["exact"],
        "currency": ["exact"],
        "order__code": ["exact"],
    }
    ordering_fields = ["created_at", "total_value_foreign"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # perf lockdown: the kernel order travels along for free, and papers
        # are prefetched in display order once per request - never one query
        # per document.
        queryset = ExportOrder.objects.select_related("order").prefetch_related(
            Prefetch(
                "documents",
                queryset=ExportDocument.objects.order_by("-created_at", "-id"),
            )
        )
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(order__user=self.request.user)


class ExportDocumentViewSet(viewsets.ModelViewSet):
    """Customs papers: the staff-only upload/verify desk.

    Buyers already receive their own papers read-only, nested inside the
    export file payload, so this viewset deliberately speaks to staff only;
    there is no separate buyer endpoint to keep in sync.
    """

    permission_classes = [permissions.IsAdminUser]
    serializer_class = ExportDocumentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = {
        "export_order": ["exact"],
        "document_type": ["exact"],
        "is_verified": ["exact"],
    }
    ordering_fields = ["created_at", "issue_date"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return ExportDocument.objects.select_related(
            "export_order", "export_order__order"
        )


class ExportDocumentDownloadView(APIView):
    """Stream one verified customs paper to its owning buyer only.

    Storage URLs are deliberately never exposed by the API.  Looking the row
    up without owner filtering lets us return the required 403 for a known but
    foreign document while still applying authentication before disclosure.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        try:
            document = ExportDocument.objects.select_related(
                "export_order__order"
            ).get(pk=pk)
        except ExportDocument.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if document.export_order.order.user_id != request.user.id:
            return Response(
                {"detail": "شما اجازه دریافت این سند را ندارید."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not document.is_verified:
            return Response(
                {"detail": "این سند هنوز توسط کارشناس تأیید نشده است."},
                status=status.HTTP_403_FORBIDDEN,
            )

        stored_file = document.file
        try:
            stream = stored_file.storage.open(stored_file.name, "rb")
        except FileNotFoundError:
            return Response(status=status.HTTP_404_NOT_FOUND)

        filename = Path(stored_file.name).name
        content_type, _encoding = mimetypes.guess_type(filename)
        return FileResponse(
            stream,
            as_attachment=True,
            filename=filename,
            content_type=content_type or "application/octet-stream",
        )
