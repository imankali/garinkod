from django.shortcuts import render, get_object_or_404, redirect
from django.http import HttpResponse
from .models import *
from django.db.models import Q
from .forms import *
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models.functions import Greatest
from django.contrib.postgres.search import SearchRank, SearchQuery, SearchVector, TrigramSimilarity
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from .models import Item, Cart, CartItem  # ← اضافه شود

# --- تابع ارسال ایمیل ---
def send_email(to_address, subject, body):
    email_address = 'garinkood@gmail.com'
    email_password = 'udmkupzpjckxkvzf'
    smtp_server = 'smtp.gmail.com'

    msg = MIMEMultipart()
    msg['From'] = email_address
    msg['To'] = to_address
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP(smtp_server, 587) as server:
            server.starttls()
            server.login(email_address, email_password)
            server.sendmail(email_address, to_address, msg.as_string())
    except Exception as e:
        print("خطا در ارسال ایمیل:", str(e))


# --- صفحه اصلی ---
def home(request):
    # دریافت دسته‌ها
    try:
        category_fertilizer = Category.objects.get(slug="kod")
        category_pesticide = Category.objects.get(slug="sam")
        category_seed = Category.objects.get(slug="bazr")
        category_equipment = Category.objects.get(slug="adavat")
    except Category.DoesNotExist:
        category_fertilizer = category_pesticide = category_seed = category_equipment = None

    # دریافت محصولات هر دسته (حداکثر ۴ عدد)
    fertilizers = Item.objects.filter(category=category_fertilizer, status='published')[:4] if category_fertilizer else []
    pesticides = Item.objects.filter(category=category_pesticide, status='published')[:4] if category_pesticide else []
    seeds = Item.objects.filter(category=category_seed, status='published')[:4] if category_seed else []
    equipments = Item.objects.filter(category=category_equipment, status='published')[:4] if category_equipment else []

    context = {
        'fertilizers': fertilizers,
        'pesticides': pesticides,
        'seeds': seeds,
        'equipments': equipments,
    }

    return render(request, 'shop/parchers/home.html', context)


# --- لیست محصولات با فیلتر و جستجو ---
def ItemsList(request, category_slug=None):
    category = None
    categories = Category.objects.all()

    # تعیین دسته‌بندی فعلی
    if category_slug:
        category = get_object_or_404(Category, slug=category_slug)
        Items = Item.objects.filter(category=category, status='published')
    else:
        Items = Item.objects.filter(status='published')

    # فیلترهای قیمت و موجودی
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    in_stock = request.GET.get('in_stock') == 'on'

    if min_price:
        Items = Items.filter(price__gte=min_price)
    if max_price:
        Items = Items.filter(price__lte=max_price)
    if in_stock:
        Items = Items.filter(stock__gt=0)

    # صفحه‌بندی
    paginator = Paginator(Items, 5)
    page = request.GET.get('page', 1)

    try:
        Items = paginator.page(page)
    except PageNotAnInteger:
        Items = paginator.page(1)
    except EmptyPage:
        Items = paginator.page(paginator.num_pages)

    return render(request, 'shop/product/category_product.html', {
        'product': Items,
        'category_slug': category_slug,
        'categories': categories,
        'category': category,
        'min_price': min_price,
        'max_price': max_price,
        'in_stock': in_stock,
        'subcategories': SubCategory.objects.filter(category=category) if category else SubCategory.objects.all()
    })


# shop/views.py
def product_detail(request, slug):
    post = get_object_or_404(Item, status='published', slug=slug)
    comments = post.comments.filter(active=True)
    new_comment = None

    fertilizer = pesticide = seed = equipment = None
    try:
        fertilizer = post.fertilizerdetail
    except FertilizerDetail.DoesNotExist:
        pass

    try:
        pesticide = post.pesticidedetail
    except PesticideDetail.DoesNotExist:
        pass

    try:
        seed = post.seeddetail
    except SeedDetail.DoesNotExist:
        pass

    try:
        equipment = post.equipmentdetail
    except EquipmentDetail.DoesNotExist:
        pass

    if request.method == 'POST':
        form = CommentForm(request.POST)
        if form.is_valid():
            new_comment = form.save(commit=False)
            new_comment.post = post
            comment_exists = post.comments.filter(
                name=new_comment.name,
                body=new_comment.body
            ).exists()
            if not comment_exists:
                new_comment.save()
    else:
        form = CommentForm()

    context = {
        'post': post,
        'comments': comments,
        'form': form,
        'new_comment': new_comment,
        'fertilizer': fertilizer,
        'pesticide': pesticide,
        'seed': seed,
        'equipment': equipment,
    }

    return render(request, 'shop/product/detail_product.html', context)
# --- فرم پشتیبانی ---
def Support(request):
    sent = False
    if request.method == 'POST':
        form = SupportForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            email = cd['email']
            subject = cd['subject']
            name = cd['name']
            phone = cd['phone']
            message = cd['massage']
            full_message = f"""
نام: {name}
ایمیل: {email}
تلفن: {phone}
پیام:
{message}
"""
            send_email('garinkood@gmail.com', subject, full_message)
            sent = True
    else:
        form = SupportForm()

    return render(request, 'shop/forms/support_form.html', {
        'form': form,
        'sent': sent
    })


# --- اشتراک‌گذاری محصول ---
def ShareItem(request, post_id):
    post = get_object_or_404(Item, status='published', id=post_id)

    fertilizer = pesticide = seed = equipment = None
    try:
        fertilizer = post.fertilizerdetail
    except FertilizerDetail.DoesNotExist:
        pass

    try:
        pesticide = post.pesticidedetail
    except PesticideDetail.DoesNotExist:
        pass

    try:
        seed = post.seeddetail
    except SeedDetail.DoesNotExist:
        pass

    try:
        equipment = post.equipmentdetail
    except EquipmentDetail.DoesNotExist:
        pass

    sent = False
    if request.method == 'POST':
        form = ShareForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            post_url = request.build_absolute_uri(post.get_absolute_url())
            to = cd['to']
            subject = f"{cd['name']} شما را به مطالعه '{post.title}' دعوت کرده است"
            message = f"""
{cd['name']} شما را به مطالعه '{post.title}' دعوت کرده است.

{cd['massage']}

لینک محصول:
{post_url}
"""
            send_email(to, subject, message)
            sent = True
    else:
        form = ShareForm()

    return render(request, 'shop/forms/share.html', {
        'form': form,
        'sent': sent,
        'post': post,
        'fertilizer': fertilizer,
        'pesticide': pesticide,
        'seed': seed,
        'equipment': equipment
    })


# --- جستجوی پیشرفته ---
def search(request, category_slug=None):
    query_search = request.GET.get('text_input', '')
    selected_category_slug = request.GET.get('category', '')
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    print(min_price)
    in_stock = request.GET.get('in_stock') == 'on'

    # تعیین دسته فعلی از URL یا فرم
    current_category = None
    if category_slug:
        current_category = get_object_or_404(Category, slug=category_slug)
    elif selected_category_slug:
        current_category = get_object_or_404(Category, slug=selected_category_slug)

    # شروع فیلتر محصولات
    Items = Item.objects.filter(status='published')

    if current_category:
        Items = Items.filter(category=current_category)

    if query_search:
        Items = Items.filter(Q(title__icontains=query_search) | Q(body__icontains=query_search))

    if min_price and min_price != 'None':
        try:
            min_price = int(min_price)
            Items = Items.filter(price__gte=min_price)
        except ValueError:
            pass  # یا خطای مناسب نمایش دهید

    if max_price and max_price != 'None':
        try:
            max_price = int(max_price)
            Items = Items.filter(price__lte=max_price)
        except ValueError:
            pass  # یا خطای مناسب نمایش دهید
    if in_stock:
        Items = Items.filter(stock__gt=0)

    # صفحه‌بندی
    paginator = Paginator(Items, 5)
    page = request.GET.get('page', 1)

    try:
        Items = paginator.page(page)
    except PageNotAnInteger:
        Items = paginator.page(1)
    except EmptyPage:
        Items = paginator.page(paginator.num_pages)

    return render(request, 'shop/product/category_product.html', {
        'product': Items,
        'search_value': query_search,
        'selected_category_slug': current_category.slug if current_category else '',
        'category_slug': category_slug,
        'min_price': min_price,
        'max_price': max_price,
        'in_stock': in_stock,
        'categories': Category.objects.all(),
        'subcategories': SubCategory.objects.filter(category=current_category) if current_category else SubCategory.objects.all()
    })

# --- لاگین کاربر ---
def user_login(request):
    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            user = authenticate(request, username=cd['username'], password=cd['password'])
            if user is not None:
                if user.is_active:
                    login(request, user)
                    return redirect('shop:home')
                else:
                    error = "حساب شما غیرفعال است."
                    return render(request, 'shop/forms/Login/login.html', {'form': form, 'error': error})
            else:
                error = "نام کاربری یا رمز عبور اشتباه است."
                return render(request, 'shop/forms/Login/login.html', {'form': form, 'error': error})
    else:
        form = LoginForm()
    return render(request, 'shop/forms/Login/login.html', {'form': form})


# --- پروفایل کاربر ---
@login_required(login_url='shop:home')
def profile_user(request):
    account = UserAccount.objects.get(user=request.user)
    return render(request, 'shop/profile/profile.html', {
        'account': account
    })


# --- لاگ‌اوت کاربر ---
def user_logout(request):
    logout(request)
    return redirect('shop:home')


# --- تغییر رمز عبور ---
@login_required(login_url='shop:home')
def change_password(request):
    if request.method == "POST":
        user = request.user
        form = ChangePasswordForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            old_password = cd["old_password"]
            new_password1 = cd["new_password1"]
            new_password2 = cd["new_password2"]

            if not user.check_password(old_password):
                error_massage = "رمز قدیمی نادرست است."
                return render(request, "shop/profile/change_password.html",
                              {'form': form, 'error_massage': error_massage})

            if new_password1 != new_password2:
                error_massage = "رمز جدید مطابقت ندارد."
                return render(request, "shop/profile/change_password.html",
                              {'form': form, 'error_massage': error_massage})

            user.set_password(new_password1)
            user.save()
            login(request, user)
            return redirect("shop:home")
    else:
        form = ChangePasswordForm()
    return render(request, "shop/profile/change_password.html", {'form': form})


# --- ثبت‌نام کاربر ---
def SignInView(request):
    if request.method == "POST":
        form = SignInForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            if User.objects.filter(username=username).exists():
                error_massage = "این نام کاربری از قبل وجود دارد."
                return render(request, "shop/forms/Login/sign_in.html", {'form': form, 'error_massage': error_massage})
            else:
                first_name = form.cleaned_data['first_name']
                last_name = form.cleaned_data['last_name']
                email = form.cleaned_data['email']
                password1 = form.cleaned_data['password']
                password2 = form.cleaned_data['password2']

                if password1 != password2:
                    error_massage = "رمز عبور مطابقت ندارد."
                    return render(request, "shop/forms/Login/sign_in.html", {'form': form, 'error_massage': error_massage})

                try:
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password=password1,
                        first_name=first_name,
                        last_name=last_name
                    )
                    user.save()

                    account = UserAccount.objects.create(user=user)
                    account.gender = form.cleaned_data['gender']
                    account.address = form.cleaned_data['address']
                    account.phone = form.cleaned_data['phone']
                    account.save()

                    user = authenticate(request, username=username, password=password1)
                    login(request, user)
                    return redirect("shop:profile")

                except Exception as e:
                    error_massage = f"خطا در ثبت‌نام: {str(e)}"
                    return render(request, "shop/forms/Login/sign_in.html", {'form': form, 'error_massage': error_massage})
        else:
            return render(request, 'shop/forms/Login/sign_in.html', {'form': form})
    else:
        if request.user.is_authenticated:
            return redirect('shop:home')
        else:
            form = SignInForm()
            return render(request, "shop/forms/Login/sign_in.html", {'form': form})


# --- ویرایش پروفایل ---
@login_required(login_url='shop:home')
def UserAccountView(request):
    user = request.user
    try:
        account = UserAccount.objects.get(user=user)
    except UserAccount.DoesNotExist:
        account = UserAccount.objects.create(user=user)

    if request.method == "POST":
        form = AccountForm(request.POST, instance=account)
        if form.is_valid():
            user.first_name = form.cleaned_data['first_name']
            user.last_name = form.cleaned_data['last_name']
            account.gender = form.cleaned_data['gender']
            account.address = form.cleaned_data['address']
            account.phone = form.cleaned_data['phone']
            user.save()
            account.save()
            return redirect('shop:profile')
        else:
            return render(request, 'shop/forms/account_form.html', {'form': form, 'account': account})
    else:
        form = AccountForm(instance=account, initial={
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': account.phone,
            'gender': account.gender,
            'address': account.address
        })
    return render(request, 'shop/forms/account_form.html', {'form': form, 'account': account})



# shop/views.py — انتهای فایل

def get_or_create_cart(request):
    """سبد فعلی کاربر یا مهمان را برمی‌گرداند."""
    if request.user.is_authenticated:
        cart, created = Cart.objects.get_or_create(user=request.user)
        # ادغام سبد مهمان (اختیاری)
        session_id = request.session.session_key
        if session_id:
            guest_cart = Cart.objects.filter(session_id=session_id).first()
            if guest_cart:
                for guest_item in guest_cart.items.all():
                    cart_item, created = CartItem.objects.get_or_create(
                        cart=cart,
                        product=guest_item.product,
                        defaults={'quantity': guest_item.quantity}
                    )
                    if not created:
                        cart_item.quantity += guest_item.quantity
                        if cart_item.quantity > guest_item.product.stock:
                            cart_item.quantity = guest_item.product.stock
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
    product = get_object_or_404(Item, id=product_id, status='published')
    cart = get_or_create_cart(request)
    try:
        quantity = int(request.POST.get('quantity', 1))
    except (ValueError, TypeError):
        quantity = 1

    if quantity < 1:
        quantity = 1
    if quantity > product.stock:
        quantity = product.stock

    cart_item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        defaults={'quantity': quantity}
    )
    if not created:
        cart_item.quantity += quantity
        if cart_item.quantity > product.stock:
            cart_item.quantity = product.stock
        cart_item.save()

    # برگرداندن به AJAX یا redirect
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({
            'success': True,
            'total_items': cart.total_items,
            'message': f"«{product.title}» به سبد خرید اضافه شد."
        })
    return redirect('shop:cart_detail')


def cart_detail(request):
    cart = get_or_create_cart(request)
    return render(request, 'shop/cart/cart_detail.html', {'cart': cart})


@require_POST
def update_cart(request, item_id):
    cart = get_or_create_cart(request)
    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    original_quantity = cart_item.quantity
    try:
        quantity = int(request.POST.get('quantity', 1))
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': 'تعداد نامعتبر است.'})

    if quantity < 1:
        return JsonResponse({'success': False, 'error': 'تعداد نمی‌تواند کمتر از ۱ باشد.'})

    if quantity > cart_item.product.stock:
        cart_item.quantity = cart_item.product.stock
        cart_item.save()
        return JsonResponse({
            'success': False,
            'error': f'موجودی محصول فقط {cart_item.product.stock} عدد است.',
            'item_total_price': cart_item.total_price,
            'cart_total_price': cart.total_price,
            'original_quantity': cart_item.quantity
        })

    cart_item.quantity = quantity
    cart_item.save()

    return JsonResponse({
        'success': True,
        'item_total_price': cart_item.total_price,
        'cart_total_price': cart.total_price
    })


@require_POST
def remove_from_cart(request, item_id):
    cart = get_or_create_cart(request)
    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    cart_item.delete()

    return JsonResponse({
        'success': True,
        'cart_total_price': cart.total_price,
        'cart_item_count': cart.items.count()
    })