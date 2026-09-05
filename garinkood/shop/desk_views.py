"""API for the two service desks: who is on duty, closing, and the survey.

Everything here is about the *human* half of the inbox — the parts a farmer and
an operator need that a plain message list does not answer:

* «آیا الان کسی هست؟» (:func:`desk_state`) — duty windows, real recent activity,
  the roster with their published names, and the tap-to-send lines for whichever
  side of the thread the caller sits on.
* «این گفتگو تمام شد» (:func:`close_conversation`) — either party can end it,
  which is also what unlocks the survey.
* «چقدر راضی بودید؟» (:func:`rate_conversation`) — stored per thread and averaged
  per operator; visible to the management panel, not printed on a public page.
* «این را باید مشاور جواب بدهد» (:func:`handoff_thread`) — support passes a
  question to the consulting desk with the context already attached, instead of
  telling the farmer to explain everything again.
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Avg, Count, Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from . import desk
from .schema import documented_api
from .models import (
    ConversationRating, DeskAgent, DeskSettings, StorefrontConversation, StorefrontMessage,
)
from .notifications import get_or_create_service_thread, post_system_message
from .serializers import (
    ConversationRatingSerializer, StorefrontConversationSerializer, StorefrontMessageSerializer,
)


def _conversation_or_none(conversation_id: int):
    return StorefrontConversation.objects.select_related(
        'storefront', 'storefront__user', 'customer', 'agent',
    ).filter(pk=conversation_id).first()


@documented_api
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def desk_state(request):
    """Presence, hours and quick replies for one desk.

    A signed-out caller still gets the desk's published hours — that is the first
    thing a farmer checks before writing — but the roster of names and the
    canned lines are for the people actually in a thread.
    """
    channel = (request.query_params.get('channel') or StorefrontConversation.CHANNEL_SUPPORT).strip()
    if desk.desk_channel(channel) is None:
        return Response(
            {'error': 'میز خدمت نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST,
        )
    if getattr(request.user, 'is_authenticated', False):
        desk.touch_presence(request.user)
    state = desk.desk_state(channel, user=request.user)
    if not getattr(request.user, 'is_authenticated', False):
        state['agents'] = []
        state['quick_replies'] = []
    return Response(state)


class CloseSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
    reopen = serializers.BooleanField(required=False, default=False)


@documented_api
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def close_conversation(request, conversation_id: int):
    """End a thread (or reopen it) and tell the other side what just happened.

    Closing is not a lock. It marks the thread as finished so the survey can be
    offered; if the farmer remembers one more question, their next message
    reopens it, so nobody has to ask support to "please reopen".
    """
    serializer = CloseSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    conversation = _conversation_or_none(conversation_id)
    if conversation is None:
        return Response({'error': 'گفتگو پیدا نشد.'}, status=status.HTTP_404_NOT_FOUND)
    if not conversation.is_participant(request.user):
        return Response({'error': 'دسترسی به این گفتگو ندارید.'}, status=status.HTTP_403_FORBIDDEN)

    if serializer.validated_data['reopen']:
        conversation.reopen(by=request.user)
    else:
        was_open = conversation.status == StorefrontConversation.STATUS_OPEN
        conversation.close(by=request.user)
        if was_open:
            note = (serializer.validated_data.get('note') or '').strip()
            if request.user.id == conversation.customer_id:
                body = 'کاربر گفتگو را پایان داد و نظرسنجی برایش باز شد.'
            else:
                body = 'گفتگو پایان یافت. اگر سؤال دیگری دارید همین‌جا بنویسید؛ باز می‌شود.'
            desk.post_notice(conversation, f'{body}\n{note[:400]}' if note else body)

    return Response(StorefrontConversationSerializer(
        conversation, context={'request': request},
    ).data)


class RatingSerializer(serializers.Serializer):
    """Write side of the survey.

    The read-side serializer (``ConversationRatingSerializer``) refuses to let a
    caller choose ``conversation``/``rater``, but it derives ``agent`` from the
    thread; writing through it would mean duplicating that logic in the view.
    """

    score = serializers.IntegerField(min_value=1, max_value=5)
    # `None` means the user skipped the question, which is different from a
    # deliberate "no, it is not fixed" and must stay distinguishable.
    solved = serializers.BooleanField(required=False, allow_null=True, default=None)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)


@documented_api
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def rate_conversation(request, conversation_id: int):
    """The satisfaction survey: 1-5 stars, was it solved, and a free-text line."""
    conversation = _conversation_or_none(conversation_id)
    if conversation is None:
        return Response({'error': 'گفتگو پیدا نشد.'}, status=status.HTTP_404_NOT_FOUND)
    if request.user.id != conversation.customer_id:
        return Response(
            {'error': 'فقط کاربری که گفتگو با او انجام شده می‌تواند امتیاز بدهد.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if conversation.status != StorefrontConversation.STATUS_CLOSED:
        return Response(
            {'error': 'نظرسنجی پس از بسته شدن گفتگو باز می‌شود.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if ConversationRating.objects.filter(conversation=conversation, rater=request.user).exists():
        return Response(
            {'error': 'شما پیش‌تر به این گفتگو امتیاز داده‌اید.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = RatingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    agent = (
        DeskAgent.for_user(conversation.agent, desk.desk_channel(conversation.channel))
        if conversation.agent_id else None
    )
    rating = ConversationRating.objects.create(
        conversation=conversation,
        rater=request.user,
        agent=agent,
        score=serializer.validated_data['score'],
        solved=serializer.validated_data.get('solved'),
        comment=(serializer.validated_data.get('comment') or '').strip()[:1000],
    )

    label = {1: 'خیلی کم', 2: 'کم', 3: 'متوسط', 4: 'خوب', 5: 'عالی'}.get(rating.score, '')
    solved = {True: 'مشکل حل شد', False: 'مشکل حل نشد', None: 'وضعیت حل شدن ثبت نشد'}[rating.solved]
    desk.post_notice(
        conversation,
        f'کاربر به این گفتگو امتیاز {rating.score} از ۵ ({label}) داد — {solved}.',
    )
    return Response(
        ConversationRatingSerializer(rating, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


class HandoffSerializer(serializers.Serializer):
    target = serializers.ChoiceField(
        choices=[
            (StorefrontConversation.CHANNEL_CONSULTING, 'consulting'),
            (StorefrontConversation.CHANNEL_SUPPORT, 'support'),
        ],
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=600)
    include_context = serializers.BooleanField(required=False, default=True)


@documented_api
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def handoff_thread(request, conversation_id: int):
    """Move a question from one desk to the other, with the context attached.

    The link posted into the current thread is what the farmer taps; the summary
    posted into the destination thread is what stops the consultant asking «خب
    مشکل چیست؟» after ten messages had already established it.
    """
    serializer = HandoffSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    conversation = _conversation_or_none(conversation_id)
    if conversation is None:
        return Response({'error': 'گفتگو پیدا نشد.'}, status=status.HTTP_404_NOT_FOUND)
    if not desk.is_operator_for(request.user, conversation.channel):
        return Response(
            {'error': 'فقط کارشناس میز می‌تواند گفتگو را ارجاع دهد.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    target = serializer.validated_data['target']
    if target == conversation.channel:
        return Response(
            {'error': 'این گفتگو همین حالا در همان میز است.'}, status=status.HTTP_400_BAD_REQUEST,
        )

    note = (serializer.validated_data.get('note') or '').strip()
    target_thread = get_or_create_service_thread(
        conversation.customer, target,
        subject=note[:150] or desk.CHANNEL_LABELS.get(target, ''),
    )
    desk.assign_thread(target_thread)

    if serializer.validated_data['include_context']:
        recent = list(conversation.messages.exclude(body='').order_by('-created_at')[:4][::-1])
        lines = [
            f'{"کشاورز" if message.sender_id == conversation.customer_id else "میز"}: {message.body[:180]}'
            for message in recent
        ]
        body = (
            f'ارجاع از {conversation.get_channel_display()}:\n'
            f'{note or "پاسخ تخصصی لازم دارد."}'
        )
        if lines:
            body = f'{body}\n— آخرین پیام‌های آن گفتگو —\n' + '\n'.join(lines)
        post_system_message(target_thread, request.user, body[:2000])

    label = desk.CHANNEL_LABELS.get(target, 'میز مربوطه')
    message = StorefrontMessage.objects.create(
        conversation=conversation,
        sender=request.user,
        body=(note or f'این مورد را برای {label} فرستادم؛ از همان‌جا پاسخ می‌گیرید.')[:2000],
        link_kind='handoff',
        link_label=f'ادامه گفتگو در {label}',
        link_url=f'/messages?channel={target}',
    )
    conversation.save(update_fields=['updated_at'])
    target_thread.save(update_fields=['updated_at'])

    return Response({
        'message': StorefrontMessageSerializer(
            message, context={'request': request},
        ).data,
        'target_conversation_id': target_thread.id,
    }, status=status.HTTP_201_CREATED)


@documented_api
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def desk_ratings(request):
    """Satisfaction numbers for the management panel: average, volume, per operator.

    Query parameters: ``channel`` (support/consulting), ``agent`` (id) and
    ``days`` (window, default 30).
    """
    if not (request.user.is_superuser or desk.is_operator_for(request.user, StorefrontConversation.CHANNEL_SUPPORT)
            or desk.is_operator_for(request.user, StorefrontConversation.CHANNEL_CONSULTING)):
        return Response(
            {'error': 'دسترسی به گزارش رضایت ندارید.'}, status=status.HTTP_403_FORBIDDEN,
        )

    channel = (request.query_params.get('channel') or '').strip()
    agent_id = (request.query_params.get('agent') or '').strip()
    try:
        days = max(1, min(int(request.query_params.get('days') or 30), 365))
    except ValueError:
        days = 30
    since = timezone.now() - timedelta(days=days)

    rows = (
        ConversationRating.objects
        .filter(created_at__gte=since)
        .select_related('conversation', 'rater', 'agent', 'agent__user')
        .order_by('-created_at')
    )
    if channel in desk.DESK_CHANNELS:
        rows = rows.filter(conversation__channel=channel)
    if agent_id.isdigit():
        rows = rows.filter(agent_id=int(agent_id))

    settings_row = DeskSettings.load()
    moment = timezone.localtime()
    aggregates = []
    for agent in DeskAgent.objects.select_related('user').filter(is_active=True).order_by('order', 'id'):
        if channel and agent.role != desk.desk_channel(channel):
            continue
        stats = ConversationRating.objects.filter(agent=agent, created_at__gte=since).aggregate(
            total=Count('id'), average=Avg('score'),
        )
        aggregates.append({
            'agent': desk.agent_payload(agent, settings_row, moment),
            'window_ratings': stats['total'],
            'window_average': round(stats['average'], 2) if stats['average'] else 0,
            'open_threads': agent.open_threads().count(),
        })

    totals = rows.aggregate(total=Count('id'), average=Avg('score'))
    solved = rows.filter(solved=True).count()
    return Response({
        'days': days,
        'window': {
            'ratings': totals['total'],
            'average': round(totals['average'], 2) if totals['average'] else 0,
            'solved_rate': round(solved / totals['total'], 3) if totals['total'] else 0,
        },
        'agents': sorted(aggregates, key=lambda row: -row['window_average']),
        'results': ConversationRatingSerializer(rows[:100], many=True, context={'request': request}).data,
    })


@documented_api
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def desk_queue(request):
    """The staff view of the desk: what is open, what is unassigned, whose it is.

    The farmer's inbox endpoint returns every thread they own; this is the
    mirror image for the people working the queue, so «به من واگذار شده» and
    «بی‌سرپرست» are one call instead of a client-side scan of every page.
    """
    channel = (request.query_params.get('channel') or '').strip()
    assigned_to = (request.query_params.get('assigned_to') or '').strip()

    conversations = _desk_queryset(request.user, channel)
    if assigned_to == 'me':
        conversations = conversations.filter(agent=request.user)
    elif assigned_to == 'unassigned':
        conversations = conversations.filter(agent__isnull=True)
    conversations = conversations.annotate(rating_total=Count('ratings'))

    payload = StorefrontConversationSerializer(
        conversations, many=True, context={'request': request},
    ).data
    unassigned = sum(1 for row in payload if not row['assigned_to_me'] and row['agent'] is None)
    return Response({
        'count': len(payload),
        'results': payload,
        'unassigned': unassigned,
        'open': sum(1 for row in payload if row['status'] == StorefrontConversation.STATUS_OPEN),
    })


def _desk_queryset(user, channel: str):
    """Every desk thread this operator is allowed to work, newest activity first."""
    queryset = (
        StorefrontConversation.objects
        .filter(channel__in=list(desk.DESK_CHANNELS))
        .select_related('storefront', 'storefront__user', 'customer', 'customer__account', 'agent')
        .prefetch_related(Prefetch(
            'messages',
            queryset=StorefrontMessage.objects.order_by('-created_at').select_related(
                'sender', 'sender__account', 'listing', 'conversation',
            ).prefetch_related('sender__desk_profiles'),
        ))
        .order_by('-updated_at')
    )
    if not user.is_superuser:
        allowed = [
            value for value, permission in desk.OPERATOR_PERMISSIONS.items()
            if user.has_perm(permission)
        ]
        if channel in allowed:
            allowed = [channel]
        if not allowed:
            return StorefrontConversation.objects.none()
        queryset = queryset.filter(Q(channel__in=allowed))
    elif channel in desk.DESK_CHANNELS:
        queryset = queryset.filter(channel=channel)
    return queryset
