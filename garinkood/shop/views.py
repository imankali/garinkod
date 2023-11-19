from django.shortcuts import render,get_object_or_404,redirect
from django.http import HttpResponse
from .models import Item, UserAccount
from .forms import AccountForm
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

def UserAccountView(request):
    user = request.user
    try:
        account = UserAccount.objects.get(user=user)
    except:
        account = UserAccount.objects.create(user=user)
    if request.method == "POST":
        form=AccountForm(data=request.POST)
        if form.is_valid():
            user.first_name = form.cleaned_data['name']
            user.last_name = form.cleaned_data['last_name']
            account.gender = form.cleaned_data['gender']
            account.address = form.cleaned_data['address']
            user.save()
            account.save()
            return redirect('shop:home')
        else:
            return render(request, 'shop/forms/account_form.html', {'form':form, 'account':account})
    form = AccountForm()
    return render(request, 'shop/forms/account_form.html', {'form':form, 'account':account})