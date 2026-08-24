"""Farm profile endpoints: lands, their calendars and consultation requests.

Two audiences share these endpoints:

* **Farmers** manage their own lands (orchards / croplands / greenhouses),
  each with its own identification record and spraying/fertilizing/irrigation
  calendar, and send consultation requests about a specific land.
* **Consultants** (staff level 3+) see every farmer's full dossier — profile,
  lands and calendars — answer requests, and write calendar entries into any
  land. The farmer sees those entries flagged as the consultant's notes.
"""

from django.contrib.auth.models import User
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from .models import (
    FarmCalendarEvent, FarmConsultationRequest, FarmLand, UserAccount,
    account_level,
)
from .serializers import (
    FarmCalendarEventSerializer, FarmConsultationRequestSerializer, FarmLandSerializer,
)
from .throttling import SearchRateThrottle


def _own_land(user, land_id):
    return get_object_or_404(FarmLand, pk=land_id, owner=user, is_active=True)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def my_lands(request):
    """The caller's lands, or create a new one (any mix of types, any number)."""
    if request.method == 'GET':
        lands = (
            FarmLand.objects.filter(owner=request.user, is_active=True)
            .select_related('owner')
            .prefetch_related('calendar_events')
        )
        return Response(FarmLandSerializer(lands, many=True, context={'request': request}).data)

    serializer = FarmLandSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    land = serializer.save(owner=request.user)
    return Response(
        FarmLandSerializer(land, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def land_detail(request, land_id):
    """One of the caller's lands: the identification record plus its calendar."""
    land = _own_land(request.user, land_id)

    if request.method == 'GET':
        events = FarmCalendarEvent.objects.filter(land=land).select_related('created_by')
        return Response({
            'land': FarmLandSerializer(land, context={'request': request}).data,
            'events': FarmCalendarEventSerializer(events, many=True, context={'request': request}).data,
        })

    if request.method == 'DELETE':
        land.is_active = False
        land.save(update_fields=['is_active', 'updated_at'])
        return Response({'message': 'زمین از پروفایل شما حذف شد.'}, status=status.HTTP_200_OK)

    serializer = FarmLandSerializer(land, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def land_events(request, land_id):
    """Add an entry to one of the caller's own land calendars."""
    land = _own_land(request.user, land_id)
    serializer = FarmCalendarEventSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    event = serializer.save(land=land, created_by=request.user)
    return Response(
        FarmCalendarEventSerializer(event, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def event_detail(request, event_id):
    """Update (e.g. mark done) or remove an event on the caller's own land."""
    event = get_object_or_404(
        FarmCalendarEvent.objects.select_related('land', 'created_by'), pk=event_id
    )
    if event.land.owner_id != request.user.id and account_level(request.user) < UserAccount.LEVEL_MODERATOR:
        return Response({'error': 'این رویداد متعلق به زمین شما نیست.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        event.delete()
        return Response({'message': 'رویداد حذف شد.'}, status=status.HTTP_200_OK)

    serializer = FarmCalendarEventSerializer(event, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_calendar(request):
    """The caller's whole calendar across all lands, newest first.

    ``?kind=spraying|fertilizing|irrigation`` narrows by operation and
    ``?from=YYYY-MM-DD&to=YYYY-MM-DD`` by date range.
    """
    events = (
        FarmCalendarEvent.objects.filter(land__owner=request.user, land__is_active=True)
        .select_related('land', 'created_by')
    )
    kind = request.query_params.get('kind', '').strip()
    if kind in {'spraying', 'fertilizing', 'irrigation'}:
        events = events.filter(kind=kind)
    date_from = request.query_params.get('from', '').strip()
    date_to = request.query_params.get('to', '').strip()
    if date_from:
        events = events.filter(date__gte=date_from)
    if date_to:
        events = events.filter(date__lte=date_to)
    return Response(FarmCalendarEventSerializer(events, many=True, context={'request': request}).data)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def my_consultations(request):
    """The caller's consultation requests, or file a new one.

    A request is always about one land — the case file the consultant will
    open — so the expert sees the right identification record and calendar.
    """
    if request.method == 'GET':
        requests = FarmConsultationRequest.objects.filter(farmer=request.user).select_related(
            'land', 'land__owner', 'replied_by'
        ).prefetch_related('land__calendar_events')
        return Response(
            FarmConsultationRequestSerializer(requests, many=True, context={'request': request}).data
        )

    serializer = FarmConsultationRequestSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    consultation = serializer.save(farmer=request.user)
    return Response(
        FarmConsultationRequestSerializer(consultation, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


# ============================================================
# Consultant side (level 3+)
# ============================================================

def _consultant_queryset():
    return FarmConsultationRequest.objects.select_related(
        'farmer', 'land', 'land__owner', 'replied_by'
    ).prefetch_related('land__calendar_events')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def consulting_requests(request):
    """All consultation requests, newest first, filterable by status.

    Only consultants (level 3+) may read the queue.
    """
    if account_level(request.user) < UserAccount.LEVEL_MODERATOR:
        return Response({'error': 'دسترسی به این بخش نیازمند سطح مشاور است.'}, status=status.HTTP_403_FORBIDDEN)

    queryset = _consultant_queryset()
    status_filter = request.query_params.get('status', '').strip()
    if status_filter in {'pending', 'answered', 'closed'}:
        queryset = queryset.filter(status=status_filter)
    search = request.query_params.get('search', '').strip()
    if search:
        queryset = queryset.filter(
            Q(farmer__username__icontains=search) |
            Q(farmer__first_name__icontains=search) |
            Q(farmer__last_name__icontains=search) |
            Q(land__name__icontains=search)
        )
    return Response(
        FarmConsultationRequestSerializer(queryset, many=True, context={'request': request}).data
    )


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def consulting_reply(request, consultation_id):
    """Answer a request (and optionally close it). The farmer sees the reply."""
    if account_level(request.user) < UserAccount.LEVEL_MODERATOR:
        return Response({'error': 'دسترسی به این بخش نیازمند سطح مشاور است.'}, status=status.HTTP_403_FORBIDDEN)

    consultation = get_object_or_404(_consultant_queryset(), pk=consultation_id)
    reply = (request.data.get('reply') or '').strip()
    if not reply:
        return Response({'error': 'متن پاسخ مشاور الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)

    consultation.reply = reply
    consultation.status = request.data.get('status') or 'answered'
    if consultation.status not in {'answered', 'closed', 'pending'}:
        consultation.status = 'answered'
    consultation.replied_by = request.user
    consultation.save(update_fields=['reply', 'status', 'replied_by', 'updated_at'])
    return Response(
        FarmConsultationRequestSerializer(consultation, context={'request': request}).data
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([SearchRateThrottle])
def consulting_farmers(request):
    """Every farmer with lands, for the consultant's directory."""
    if account_level(request.user) < UserAccount.LEVEL_MODERATOR:
        return Response({'error': 'دسترسی به این بخش نیازمند سطح مشاور است.'}, status=status.HTTP_403_FORBIDDEN)

    farmers = User.objects.filter(farm_lands__is_active=True).distinct().select_related('account')
    search = request.query_params.get('search', '').strip()
    if search:
        farmers = farmers.filter(
            Q(username__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(farm_lands__name__icontains=search)
        ).distinct()

    results = []
    for farmer in farmers.order_by('username')[:100]:
        lands = (
            FarmLand.objects.filter(owner=farmer, is_active=True)
            .prefetch_related('calendar_events')
        )
        results.append({
            'id': farmer.id,
            'username': farmer.username,
            'full_name': farmer.get_full_name() or farmer.username,
            'phone': getattr(farmer.account, 'phone', ''),
            'lands': FarmLandSerializer(lands, many=True, context={'request': request}).data,
            'land_count': lands.count(),
            'pending_requests': FarmConsultationRequest.objects.filter(
                farmer=farmer, status='pending'
            ).count(),
        })
    return Response({'count': len(results), 'results': results})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def consulting_farmer_dossier(request, user_id):
    """The full dossier of one farmer: profile, every land and every calendar.

    This is what the consultant opens when a request arrives.
    """
    if account_level(request.user) < UserAccount.LEVEL_MODERATOR:
        return Response({'error': 'دسترسی به این بخش نیازمند سطح مشاور است.'}, status=status.HTTP_403_FORBIDDEN)

    farmer = get_object_or_404(User.objects.select_related('account'), pk=user_id)
    lands = FarmLand.objects.filter(owner=farmer, is_active=True).prefetch_related(
        Prefetch(
            'calendar_events',
            queryset=FarmCalendarEvent.objects.select_related('created_by').order_by('date'),
        )
    )
    context = {'request': request}
    return Response({
        'farmer': {
            'id': farmer.id,
            'username': farmer.username,
            'full_name': farmer.get_full_name() or farmer.username,
            'email': farmer.email,
            'phone': getattr(farmer.account, 'phone', ''),
            'address': getattr(farmer.account, 'address', ''),
            'level_label': getattr(getattr(farmer, 'account', None), 'level_label', ''),
        },
        'lands': [
            {
                **FarmLandSerializer(land, context=context).data,
                'events': FarmCalendarEventSerializer(land.calendar_events.all(), many=True, context=context).data,
            }
            for land in lands
        ],
        'requests': FarmConsultationRequestSerializer(
            FarmConsultationRequest.objects.filter(farmer=farmer).select_related('land', 'replied_by'),
            many=True, context=context,
        ).data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def consulting_land_event(request, land_id):
    """A consultant writes an entry (spraying/fertilizing/irrigation) into any
    land's calendar. The farmer sees it flagged as the consultant's note."""
    if account_level(request.user) < UserAccount.LEVEL_MODERATOR:
        return Response({'error': 'دسترسی به این بخش نیازمند سطح مشاور است.'}, status=status.HTTP_403_FORBIDDEN)

    land = get_object_or_404(FarmLand.objects.select_related('owner'), pk=land_id, is_active=True)
    serializer = FarmCalendarEventSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    event = serializer.save(land=land, created_by=request.user)
    return Response(
        FarmCalendarEventSerializer(event, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )
