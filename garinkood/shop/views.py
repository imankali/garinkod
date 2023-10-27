from django.shortcuts import render,get_object_or_404
from django.http import HttpResponse
from .models import Item
# Create your views here.

def home(request):
    return HttpResponse("بخش خرید")
def ItemsList(request):
    Items = Item.objects.filter(status='published')
    return render(request, 'shop/Items/list_items.html', {'Items': Items})
def post_detail (request, post, pk):
    post = get_object_or_404(Item, slug=post, id=pk)
    return render(request, 'shop/Items/detail_items.html', {'post': post},)