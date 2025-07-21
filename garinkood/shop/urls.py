from django.urls import path
from . import views

app_name = 'shop'

urlpatterns = [
    # ۱. صفحه اصلی
    path('', views.home, name='home'),

    # ۲. جستجوی عمومی (بدون دسته)
    path('search/', views.search, name='search'),

    # ۳. جستجو در یک دسته خاص (مثلاً /search/kod/)
    path('search/<slug:category_slug>/', views.search, name='search_in_category'),

    # ۴. لیست تمام محصولات
    path('products/', views.ItemsList, name='product_list'),

    # ۵. لیست بر اساس دسته (مثلاً /kod/)
    path('<slug:category_slug>/', views.ItemsList, name='product_list_by_category'),

    # ۶. جزئیات محصول
    path('product/<str:post>/<int:pk>/', views.post_detail, name='product_detail'),

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
]