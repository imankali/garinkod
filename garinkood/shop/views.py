from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.db.models import Q
from .models import *
from .forms import *
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.core.mail import send_mail
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.cache import cache_page
import json


# --- تابع کمکی: دریافت مشخصات محصول ---
def get_product_details(product):
    """دریافت مشخصات اختصاصی محصول"""
    details = {
        'fertilizer': None,
        'pesticide': None,
        'seed': None,
        'equipment': None
    }

    try:
        details['fertilizer'] = product.fertilizerdetail
    except FertilizerDetail.DoesNotExist:
        pass

    try:
        details['pesticide'] = product.pesticidedetail
    except PesticideDetail.DoesNotExist:
        pass

    try:
        details['seed'] = product.seeddetail
    except SeedDetail.DoesNotExist:
        pass

    try:
        details['equipment'] = product.equipmentdetail
    except EquipmentDetail.DoesNotExist:
        pass

    return details


# --- تابع ارسال ایمیل ---
def send_email(to_address, subject, body):
    """ارسال ایمیل با استفاده از Django Email Backend"""
    from django.conf import settings

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_address],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print("خطا در ارسال ایمیل:", str(e))
        return False


# --- صفحه اصلی ---
@cache_page(60 * 15)  # کش 15 دقیقه
def home(request):
    try:
        category_fertilizer = Category.objects.get(slug="kod")
        category_pesticide = Category.objects.get(slug="sam")
        category_seed = Category.objects.get(slug="bazr")
        category_equipment = Category.objects.get(slug="adavat")
    except Category.DoesNotExist:
        category_fertilizer = category_pesticide = category_seed = category_equipment = None

    # نمایش 6 محصول به جای 4
    fertilizers = Product.objects.filter(category=category_fertilizer, status='published')[
                  :6] if category_fertilizer else []
    pesticides = Product.objects.filter(category=category_pesticide, status='published')[:6] if category_pesticide else []
    seeds = Product.objects.filter(category=category_seed, status='published')[:6] if category_seed else []
    equipments = Product.objects.filter(category=category_equipment, status='published')[:6] if category_equipment else []

    context = {
        'fertilizers': fertilizers,
        'pesticides': pesticides,
        'seeds': seeds,
        'equipments': equipments,
    }
    return render(request, 'Shop/partials/home.html', context)


# --- لیست محصولات ---
@ensure_csrf_cookie
def items_list(request, category_slug=None):
    category = None
    categories = Category.objects.all()

    if category_slug:
        category = get_object_or_404(Category, slug=category_slug)
        items = Product.objects.filter(category=category, status='published')
    else:
        items = Product.objects.filter(status='published')

    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    in_stock = request.GET.get('in_stock') == 'on'

    if min_price:
        items = items.filter(price__gte=min_price)
    if max_price:
        items = items.filter(price__lte=max_price)
    if in_stock:
        items = items.filter(stock__gt=0)

    paginator = Paginator(items, 9)  # تغییر به 9
    page = request.GET.get('page', 1)

    try:
        items = paginator.page(page)
    except PageNotAnInteger:
        items = paginator.page(1)
    except EmptyPage:
        items = paginator.page(paginator.num_pages)

    return render(request, 'Shop/product/category_product.html', {
        'product': items,
        'category_slug': category_slug,
        'categories': categories,
        'category': category,
        'min_price': min_price,
        'max_price': max_price,
        'in_stock': in_stock,
        'subcategories': SubCategory.objects.filter(category=category) if category else SubCategory.objects.all()
    })


# --- جزئیات محصول ---
def product_detail(request, slug):
    post = get_object_or_404(Product, status='published', slug=slug)
    comments = post.comments.filter(active=True)
    new_comment = None

    # استفاده از تابع کمکی
    details = get_product_details(post)

    if request.method == 'POST':
        form = CommentForm(request.POST)
        if form.is_valid():
            new_comment = form.save(commit=False)
            new_comment.post = post
            if not post.comments.filter(name=new_comment.name, body=new_comment.body).exists():
                new_comment.save()
                messages.success(request, "نظر شما با موفقیت ثبت شد و پس از تایید نمایش داده می‌شود.")
    else:
        form = CommentForm()

    context = {
        'post': post,
        'comments': comments,
        'form': form,
        'new_comment': new_comment,
        **details,
    }
    return render(request, 'Shop/product/detail_product.html', context)


# --- پشتیبانی ---
def support(request):
    sent = False
    if request.method == 'POST':
        form = SupportForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            full_message = f"""
نام: {cd['name']}
ایمیل: {cd['email']}
تلفن: {cd['phone']}
پیام:
{cd['massage']}
"""
            if send_email('garinkood@gmail.com', cd['subject'], full_message):
                messages.success(request, "پیام شما با موفقیت ارسال شد!")
                sent = True
            else:
                messages.error(request, "خطا در ارسال پیام. لطفاً دوباره تلاش کنید.")
    else:
        form = SupportForm()
    return render(request, 'Shop/forms/support_form.html', {'form': form, 'sent': sent})


# --- اشتراک‌گذاری ---
def share_item(request, post_id):
    post = get_object_or_404(Product, status='published', id=post_id)

    # استفاده از تابع کمکی
    details = get_product_details(post)

    sent = False
    if request.method == 'POST':
        form = ShareForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            post_url = request.build_absolute_uri(post.get_absolute_url())
            message = f"""
{cd['name']} شما را به مطالعه '{post.title}' دعوت کرده است.

{cd['massage']}

لینک محصول:
{post_url}
"""
            if send_email(cd['to'], f"{cd['name']} شما را به مطالعه '{post.title}' دعوت کرده است", message):
                messages.success(request, "لینک محصول با موفقیت ارسال شد!")
                sent = True
            else:
                messages.error(request, "خطا در ارسال ایمیل. لطفاً دوباره تلاش کنید.")
    else:
        form = ShareForm()
    return render(request, 'Shop/forms/share.html', {
        'form': form, 'sent': sent, 'post': post, **details
    })


# --- جستجو ---
def search(request, category_slug=None):
    query_search = request.GET.get('text_input', '')
    selected_category_slug = request.GET.get('category', '')
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    in_stock = request.GET.get('in_stock') == 'on'

    current_category = None
    if category_slug:
        current_category = get_object_or_404(Category, slug=category_slug)
    elif selected_category_slug:
        current_category = get_object_or_404(Category, slug=selected_category_slug)

    items = Product.objects.filter(status='published')
    if current_category:
        items = items.filter(category=current_category)
    if query_search:
        items = items.filter(Q(title__icontains=query_search) | Q(body__icontains=query_search))
    if min_price and min_price.isdigit():
        items = items.filter(price__gte=int(min_price))
    if max_price and max_price.isdigit():
        items = items.filter(price__lte=int(max_price))
    if in_stock:
        items = items.filter(stock__gt=0)

    paginator = Paginator(items, 9)  # تغییر به 9
    page = request.GET.get('page', 1)
    try:
        items = paginator.page(page)
    except PageNotAnInteger:
        items = paginator.page(1)
    except EmptyPage:
        items = paginator.page(paginator.num_pages)

    return render(request, 'Shop/product/category_product.html', {
        'product': items,
        'search_value': query_search,
        'selected_category_slug': current_category.slug if current_category else '',
        'category_slug': category_slug,
        'min_price': min_price,
        'max_price': max_price,
        'in_stock': in_stock,
        'categories': Category.objects.all(),
        'subcategories': SubCategory.objects.filter(
            category=current_category) if current_category else SubCategory.objects.all()
    })


# --- لاگین/ثبت‌نام/پروفایل ---
def user_login(request):
    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            user = authenticate(request, username=cd['username'], password=cd['password'])
            if user and user.is_active:
                login(request, user)
                messages.success(request, "با موفقیت وارد شدید!")
                return redirect('shop:home')
            messages.error(request, "نام کاربری یا رمز عبور اشتباه است.")
    else:
        form = LoginForm()
    return render(request, 'Shop/forms/Login/login.html', {'form': form})


def user_logout(request):
    logout(request)
    messages.success(request, "با موفقیت خارج شدید!")
    return redirect('shop:home')


@login_required(login_url='shop:home')
def profile_user(request):
    account = UserAccount.objects.get(user=request.user)
    return render(request, 'Shop/profile/profile.html', {'account': account})


@login_required(login_url='shop:home')
def change_password(request):
    if request.method == "POST":
        form = ChangePasswordForm(request.POST)
        if form.is_valid():
            user = request.user
            cd = form.cleaned_data
            if not user.check_password(cd["old_password"]):
                messages.error(request, "رمز قدیمی نادرست است.")
                return render(request, "Shop/profile/change_password.html", {'form': form})
            if cd["new_password1"] != cd["new_password2"]:
                messages.error(request, "رمز جدید مطابقت ندارد.")
                return render(request, "Shop/profile/change_password.html", {'form': form})
            user.set_password(cd["new_password1"])
            user.save()
            login(request, user)
            messages.success(request, "رمز عبور با موفقیت تغییر کرد!")
            return redirect("shop:home")
    else:
        form = ChangePasswordForm()
    return render(request, "Shop/profile/change_password.html", {'form': form})


def sign_in(request):
    if request.user.is_authenticated:
        return redirect('shop:home')
    if request.method == "POST":
        form = SignInForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            if User.objects.filter(username=cd['username']).exists():
                messages.error(request, "این نام کاربری از قبل وجود دارد.")
                return render(request, "Shop/forms/Login/sign_in.html", {'form': form})
            if cd['password'] != cd['password2']:
                messages.error(request, "رمز عبور مطابقت ندارد.")
                return render(request, "Shop/forms/Login/sign_in.html", {'form': form})
            try:
                user = User.objects.create_user(
                    username=cd['username'],
                    email=cd['email'],
                    password=cd['password'],
                    first_name=cd['first_name'],
                    last_name=cd['last_name']
                )
                account = UserAccount.objects.create(
                    user=user,
                    gender=cd['gender'],
                    address=cd['address'],
                    phone=cd['phone']
                )
                login(request, user)
                messages.success(request, "ثبت‌نام با موفقیت انجام شد!")
                return redirect("shop:profile")
            except Exception as e:
                messages.error(request, f"خطا در ثبت‌نام: {str(e)}")
        else:
            messages.error(request, "لطفاً فرم را به درستی پر کنید.")
    else:
        form = SignInForm()
    return render(request, "Shop/forms/Login/sign_in.html", {'form': form})


@login_required(login_url='shop:home')
def user_account(request):
    user = request.user
    account, created = UserAccount.objects.get_or_create(user=user)
    if request.method == "POST":
        form = AccountForm(request.POST, instance=account)
        if form.is_valid():
            user.first_name = form.cleaned_data['first_name']
            user.last_name = form.cleaned_data['last_name']
            user.save()
            form.save()
            messages.success(request, "اطلاعات با موفقیت به‌روزرسانی شد!")
            return redirect('shop:profile')
    else:
        form = AccountForm(instance=account)
        form.fields['first_name'].initial = user.first_name
        form.fields['last_name'].initial = user.last_name
        form.fields['phone'].initial = account.phone
    return render(request, 'Shop/forms/account_form.html', {'form': form, 'account': account})


# ====================================
# سبد خرید — نسخه اصلاح‌شده و ایمن
# ====================================

def get_or_create_cart(request):
    if request.user.is_authenticated:
        cart, created = Cart.objects.get_or_create(user=request.user)
        # ادغام سبد مهمان فقط اگر session معتبر باشد و متفاوت باشد
        session_id = request.session.session_key
        if session_id:
            guest_cart = Cart.objects.filter(session_id=session_id).exclude(user__isnull=False).first()
            if guest_cart and guest_cart.id != cart.id:
                for guest_item in guest_cart.items.all():
                    cart_item, created = CartItem.objects.get_or_create(
                        cart=cart,
                        product=guest_item.product,
                        defaults={'quantity': guest_item.quantity}
                    )
                    if not created:
                        new_qty = cart_item.quantity + guest_item.quantity
                        cart_item.quantity = min(new_qty, guest_item.product.stock)
                        cart_item.save()
                guest_cart.delete()
        return cart
    else:
        if not request.session.session_key:
            request.session.create()
        session_id = request.session.session_key
        cart, created = Cart.objects.get_or_create(session_id=session_id)
        return cart


@require_POST
def add_to_cart(request, product_id):
    product = get_object_or_404(Product, id=product_id, status='published')
    MAX_QUANTITY_PER_ITEM = min(10, product.stock)

    try:
        data = json.loads(request.body)
        quantity = int(data.get('quantity', 1))
    except (json.JSONDecodeError, ValueError, TypeError):
        quantity = 1

    quantity = max(1, min(quantity, MAX_QUANTITY_PER_ITEM))

    cart = get_or_create_cart(request)
    cart_item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        defaults={'quantity': quantity}
    )
    if not created:
        new_qty = cart_item.quantity + quantity
        cart_item.quantity = min(new_qty, MAX_QUANTITY_PER_ITEM)
        cart_item.save()

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({
            'success': True,
            'total_items': cart.total_items,
            'message': f"«{product.title}» به سبد خرید اضافه شد."
        })
    return redirect('shop:cart_detail')


def get_cart_data(request):
    cart = get_or_create_cart(request)
    total_price = 0
    items = []

    for item in cart.items.all():
        price = float(item.product.price) if item.product.price else 0
        total_price += price * item.quantity

        image_url = ''
        if item.product.image:
            image_url = item.product.image.url
        elif hasattr(item.product, 'image_url') and callable(getattr(item.product, 'image_url')):
            image_url = item.product.image_url()

        items.append({
            'id': item.product.id,
            'name': item.product.title,
            'price': price,
            'quantity': item.quantity,
            'image_url': image_url
        })

    return JsonResponse({
        'total_items': cart.total_items,
        'total_price': total_price,
        'items': items
    })


def cart_detail(request):
    cart = get_or_create_cart(request)
    return render(request, 'Shop/cart/cart_detail.html', {'cart': cart})


@require_POST
def update_cart(request, item_id):
    cart = get_or_create_cart(request)
    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    try:
        quantity = int(request.POST.get('quantity', 1))
    except (ValueError, TypeError):
        quantity = 1

    if quantity < 1:
        cart_item.delete()
        messages.success(request, "محصول از سبد خرید حذف شد.")
    else:
        quantity = min(quantity, cart_item.product.stock, 10)
        cart_item.quantity = quantity
        cart_item.save()
        messages.success(request, "سبد خرید به‌روزرسانی شد.")
    return redirect('shop:cart_detail')


@require_POST
def remove_from_cart(request, item_id):
    cart = get_or_create_cart(request)
    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    product_name = cart_item.product.title
    cart_item.delete()
    messages.success(request, f"«{product_name}» از سبد خرید حذف شد.")
    return redirect('shop:cart_detail')