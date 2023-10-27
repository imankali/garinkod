from django.urls import path
from . import views

app_name = 'shop'

urlpatterns = [
    path('home/', views.home, name='home'),
    path('items/', views.ItemsList, name='Items'),
    path('detail/<slug:post>/<int:pk>/', views.post_detail, name='post_detail'),
    ]