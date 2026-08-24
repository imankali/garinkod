"""Reference-data endpoints: geography and agricultural input doses.

Both are read-only lookups the frontend uses to fill selects and to compute a
dose. Neither invents data: a province, a city or a dose exists in the database
or the API says so plainly.
"""

from decimal import Decimal, InvalidOperation

from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from .models import AgriInput, AgriInputDose, Location
from .serializers import AgriInputSerializer, LocationSerializer
from .throttling import SearchRateThrottle

# Area units the calculator accepts, expressed in hectares.
AREA_UNITS = {
    'hectare': Decimal('1'),
    'jarib': Decimal('0.1'),       # 1 جریب ≈ 1000 m² in common Iranian usage
    'square_meter': Decimal('0.0001'),
    'acre': Decimal('0.404686'),
}

AREA_UNIT_LABELS = {
    'hectare': 'هکتار',
    'jarib': 'جریب',
    'square_meter': 'مترمربع',
    'acre': 'ایکر',
}


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([SearchRateThrottle])
def locations(request):
    """Provinces and cities.

    * no parameters — all provinces
    * ``?province=<id|slug>`` — the cities of that province
    * ``?search=`` — matching provinces and cities, each labelled with its parent
    """
    search = request.query_params.get('search', '').strip()
    province = request.query_params.get('province', '').strip()
    kind = request.query_params.get('kind', '').strip()

    queryset = Location.objects.filter(is_active=True)

    if province:
        parent = Location.objects.filter(kind='province').filter(
            Q(slug=province) | Q(name=province) |
            (Q(id=province) if province.isdigit() else Q(pk__in=[]))
        ).first()
        if not parent:
            return Response(
                {'error': 'استان مورد نظر پیدا نشد.'}, status=status.HTTP_404_NOT_FOUND
            )
        queryset = queryset.filter(parent=parent, kind='city')
    elif kind in {'province', 'city'}:
        queryset = queryset.filter(kind=kind)
    elif not search:
        queryset = queryset.filter(kind='province')

    if search:
        queryset = queryset.filter(name__icontains=search)

    # The cap is a safety net for the unconstrained `?search=` query, not for
    # the standard province/city lookups: a full province list is 31 rows and
    # the largest province has ~45 cities, all far below the limit.
    queryset = queryset.select_related('parent').order_by('kind', 'name')[:1000]
    return Response({
        'count': len(queryset),
        'results': LocationSerializer(queryset, many=True).data,
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([SearchRateThrottle])
def agri_inputs(request):
    """Search the fertiliser/pesticide catalogue used by the dose calculator."""
    search = request.query_params.get('search', '').strip()
    kind = request.query_params.get('kind', '').strip()
    crop = request.query_params.get('crop', '').strip()

    queryset = AgriInput.objects.filter(is_active=True).prefetch_related('doses').select_related('product')
    if kind in {'fertilizer', 'pesticide'}:
        queryset = queryset.filter(kind=kind)
    if search:
        queryset = queryset.filter(
            Q(name__icontains=search) |
            Q(active_ingredient__icontains=search) |
            Q(formulation__icontains=search)
        )
    if crop:
        queryset = queryset.filter(doses__crop_name__icontains=crop).distinct()

    queryset = queryset[:100]
    return Response({
        'count': len(queryset),
        'results': AgriInputSerializer(queryset, many=True).data,
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def agri_crops(request):
    """The distinct crops that actually have a registered dose."""
    crops = (
        AgriInputDose.objects
        .filter(agri_input__is_active=True)
        .values_list('crop_name', flat=True)
        .distinct()
        .order_by('crop_name')
    )
    return Response({'results': list(crops)})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([SearchRateThrottle])
def calculate_dose(request):
    """Compute a total quantity from a *registered* dose rate.

    A result is returned only when the requested input/crop pair has a stored
    dose. There is no interpolation and no fallback rate: an unknown
    combination is an explicit 404 telling the user to consult an adviser,
    because guessing a pesticide rate is a safety hazard, not a UX problem.
    """
    input_id = request.data.get('input_id')
    crop = str(request.data.get('crop', '')).strip()
    area_raw = request.data.get('area')
    area_unit = str(request.data.get('area_unit', 'hectare')).strip()

    errors = {}
    if not input_id:
        errors['input_id'] = ['انتخاب کود یا سم الزامی است.']
    if not crop:
        errors['crop'] = ['انتخاب محصول کشاورزی الزامی است.']
    if area_raw in (None, ''):
        errors['area'] = ['سطح زمین را وارد کنید.']
    if area_unit not in AREA_UNITS:
        errors['area_unit'] = ['واحد سطح انتخاب‌شده پشتیبانی نمی‌شود.']

    area = Decimal('0')
    if area_raw not in (None, ''):
        try:
            area = Decimal(str(area_raw))
        except (InvalidOperation, ValueError):
            errors['area'] = ['سطح زمین باید عدد باشد.']
    if area <= 0 and 'area' not in errors:
        errors['area'] = ['سطح زمین باید بزرگ‌تر از صفر باشد.']

    if errors:
        return Response(
            {'error': 'اطلاعات واردشده کامل نیست.', 'fields': errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    agri_input = AgriInput.objects.filter(id=input_id, is_active=True).first()
    if not agri_input:
        return Response({'error': 'نهاده انتخاب‌شده پیدا نشد.'}, status=status.HTTP_404_NOT_FOUND)

    dose = AgriInputDose.objects.filter(agri_input=agri_input, crop_name__iexact=crop).first()
    if not dose:
        return Response(
            {
                'error': (
                    f'برای «{agri_input.name}» روی محصول «{crop}» دوز ثبت‌شده‌ای موجود نیست. '
                    'لطفاً با کارشناس گیاه‌پزشکی مشورت کنید.'
                ),
                'code': 'dose_not_registered',
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    hectares = (area * AREA_UNITS[area_unit]).quantize(Decimal('0.0001'))
    min_total = (dose.min_rate * hectares).quantize(Decimal('0.001'))
    max_total = (dose.max_rate * hectares).quantize(Decimal('0.001'))

    warnings = []
    if agri_input.kind == 'pesticide':
        warnings.append('هنگام سم‌پاشی از ماسک، دستکش و لباس محافظ استفاده کنید.')
        if agri_input.preharvest_interval_days:
            warnings.append(
                f'دوره کارنس این سم {agri_input.preharvest_interval_days} روز است؛ '
                'پیش از پایان آن برداشت نکنید.'
            )
    if agri_input.safety_notes:
        warnings.append(agri_input.safety_notes)
    warnings.append('این محاسبه راهنماست و جایگزین توصیه کارشناس گیاه‌پزشکی یا آزمون خاک نیست.')

    return Response({
        'input': {'id': agri_input.id, 'name': agri_input.name, 'kind': agri_input.kind},
        'crop': dose.crop_name,
        'target': dose.target,
        'area': {
            'value': str(area),
            'unit': area_unit,
            'unit_label': AREA_UNIT_LABELS[area_unit],
            'hectares': str(hectares),
        },
        'rate': {
            'min': str(dose.min_rate),
            'max': str(dose.max_rate),
            'unit': dose.rate_unit,
            'basis': dose.basis,
            'basis_label': dose.get_basis_display(),
        },
        'total': {
            'min': str(min_total),
            'max': str(max_total),
            'unit': dose.rate_unit,
        },
        'notes': dose.notes,
        'warnings': warnings,
    })
