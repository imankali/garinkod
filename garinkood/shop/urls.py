from django.urls import path
from . import views

app_name = 'shop'

urlpatterns = [
    # ۱. صفحه اصلی
    path('', views.home, name='home'),

    # ۷. پشتیبانی و اشتراک‌گذاری
    path('support/', views.Support, name='support'),
    path('share/<int:post_id>/', views.ShareItem, name='share'),

    # ۸. کاربران
    path('login/', views.user_login, name='user_login'),
    path('logout/', views.user_logout, name='user_logout'),
    path('signin/', views.SignInView, name='signin'),
    path('profile/', views.profile_user, name='profile'),
    path('change-password/', views.change_password, name='change_password'),
    path('account/', views.UserAccountView, name='account'),


    # سبد خرید
    path('cart/', views.cart_detail, name='cart_detail'),
    path('cart/add/<int:product_id>/', views.add_to_cart, name='add_to_cart'),
    path('cart/update/<int:item_id>/', views.update_cart, name='update_cart'),
    path('cart/remove/<int:item_id>/', views.remove_from_cart, name='remove_from_cart'),

    # ۲. جستجوی عمومی (بدون دسته)
    path('search/', views.search, name='search'),

    # ۳. جستجو در یک دسته خاص (مثلاً /search/kod/)
    path('search/<slug:category_slug>/', views.search, name='search_in_category'),

    # ۴. لیست تمام محصولات
    path('products/', views.ItemsList, name='product_list'),

    # ۵. لیست بر اساس دسته (مثلاً /kod/)
    path('<slug:category_slug>/', views.ItemsList, name='product_list_by_category'),

    # ۶. جزئیات محصول
    path('product/<slug:slug>/', views.product_detail, name='product_detail'),


]