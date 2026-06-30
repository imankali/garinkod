from django.urls import path
from . import views

app_name = 'shop'

urlpatterns = [
    # ========== صفحات عمومی ==========
    path('', views.home, name='home'),
    path('products/', views.items_list, name='product_list'),
    path('search/', views.search, name='search'),
    path('search/<slug:category_slug>/', views.search, name='search_in_category'),

    # ========== احراز هویت ==========
    path('login/', views.user_login, name='user_login'),
    path('logout/', views.user_logout, name='user_logout'),
    path('signin/', views.sign_in, name='signin'),

    # ========== پروفایل کاربر ==========
    path('profile/', views.profile_user, name='profile'),
    path('change-password/', views.change_password, name='change_password'),
    path('account/', views.user_account, name='account'),

    # ========== سبد خرید ==========
    path('cart/', views.cart_detail, name='cart_detail'),
    path('cart/data/', views.get_cart_data, name='get_cart_data'),
    path('cart/add/<int:product_id>/', views.add_to_cart, name='add_to_cart'),
    path('cart/update/<int:item_id>/', views.update_cart, name='update_cart'),
    path('cart/remove/<int:item_id>/', views.remove_from_cart, name='remove_from_cart'),

    # ========== پشتیبانی و اشتراک‌گذاری ==========
    path('support/', views.support, name='support'),
    path('share/<int:post_id>/', views.share_item, name='share'),

    # ========== مسیرهای پویا (حتماً در انتها!) ==========
    path('<slug:category_slug>/', views.items_list, name='product_list_by_category'),
    path('product/<slug:slug>/', views.product_detail, name='product_detail'),
]