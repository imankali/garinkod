from django.shortcuts import render,get_object_or_404
from django.http import HttpResponse
from .models import Item
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
# Create your views here.

def home(request):
    return render(request, 'shop/parent/base.html')
def ItemsList(request):
    Items = Item.objects.filter(status='published')
    paginator = Paginator(Items, 1)
    #page = request.GET['page']

    try:
        page = request.GET['page']
    except Exception as e:
        print(e)  # handle your errors
        page = 1
    try:
        Items = paginator.page(page)
    except PageNotAnInteger:
        Items = paginator.page(1)
    except EmptyPage:
        Items = paginator.page(paginator.num_pages)

    return render(request, 'shop/Items/list_items.html', {'Items': Items, 'page': page})
def post_detail (request, post, pk):
    post = get_object_or_404(Item, slug=post, id=pk)
    return render(request, 'shop/Items/detail_items.html', {'post': post})