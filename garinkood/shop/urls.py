from django.urls import path
from . import views

app_name = 'shop'

urlpatterns = [
    path('home/', views.home, name='home'),
    path('item', views.ItemsList, name='Item'),
    path('detail/<slug:post>/<int:pk>/', views.post_detail, name='post_detail'),
    path('account-forms/', views.UserAccountView, name='account_forms'),
    path('support/', views.Support, name='support'),
    path('share_post/<int:post_id>/', views.ShareItem, name='Share_post'),
    path('search/', views.search, name='search'),
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),
    path('profile/', views.profile_user, name='profile'),
    path('change_password/', views.change_password, name='change_password'),
    ]