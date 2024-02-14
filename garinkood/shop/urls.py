from django.urls import path
from . import views

app_name = 'shop'

urlpatterns = [
    path('home/', views.home, name='home'),
    path('items/', views.ItemsList, name='Items'),
    path('detail/<slug:post>/<int:pk>/', views.post_detail, name='post_detail'),
    path('account-forms/', views.UserAccountView, name='account_forms'),
    path('support/', views.Support, name='support'),
    path('share_post/<int:post_id>/', views.ShareItem, name='Share_post'),
    path('search/', views.search, name='search'),
    ]