from django.shortcuts import render,get_object_or_404,redirect
from django.http import HttpResponse
from .models import *
from .forms import *
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
#from ..garinkood.settings import send_email
# Create your views here.


import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email(to_address, subject, body):
    # اطلاعات اتصال به سرور ایمیل
    email_address = 'garinkood@gmail.com'  # ایمیل شما
    email_password = 'udmkupzpjckxkvzf'  # رمز عبور ایمیل شما
    smtp_server = 'smtp.gmail.com'  # سرور SMTP مورد استفاده (برای گوگل ایمیل)

    # تنظیمات پیام ایمیل
    msg = MIMEMultipart()
    msg['From'] = email_address
    msg['To'] = to_address
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    # ارسال ایمیل
    try:
        with smtplib.SMTP(smtp_server, 587) as server:
            server.starttls()
            server.login(email_address, email_password)
            server.sendmail(email_address, to_address, msg.as_string())
        print("ایمیل با موفقیت ارسال شد!")
    except Exception as e:
        print("خطا در ارسال ایمیل:", str(e))


def home(request):
    return render(request, 'shop/parent/base.html')
def ItemsList(request):
    Items = Item.objects.filter(status='published')
    paginator = Paginator(Items, 3)
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
    #slug = post
    post = get_object_or_404(Item, status='published', slug=post, id=pk)
    comments = post.comments.filter(active=True)
    new_comment = None
    if request.method == 'POST':
        form = CommentForm(request.POST)
        if form.is_valid():
            new_comment = form.save(commit=False)
            new_comment.post = post
            try:
                comment_save = len(list(post.comments.filter(name=new_comment.name, body=new_comment.body)))
                #print(comment_save)
                if comment_save == 0:
                    new_comment.save()
            except:
                return redirect('shop:home')
    else:
        form = CommentForm()
    context = {
        'post': post,
        'comments': comments,
        'form': form,
        'new_comment': new_comment,

    }

    return render(request, 'shop/Items/detail_items.html', context)

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
def Support(request):
    sent = False
    if request.method=='POST':
        form = SupportForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            email = cd['email']
            subject = cd['subject']
            name = cd['name']
            phone = cd['phone']
            massage = cd['massage']
            msg ="name:{0}\nphone:{1}\nemail:{2}\nmassage:\n{3}".format(name, phone, email, massage,)
            send_email(email,subject,msg)
            sent = True
    else:
        
        form = SupportForm()
    return render(request,'shop/forms/support_form.html', {'form':form, 'sent':sent})

def ShareItem(request, post_id):
    post = get_object_or_404(Item, status='published', id=post_id)
    sent = False
    if request.method == 'POST':
        form = ShareForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            post_url = request.build_absolute_uri(post.get_absolute_utl())
            to = cd['to']
            #name = cd['name']
            subject = "{0} شمارا به خواندن {1} دعوت  کرده است".format(cd['name'], post.title)
            massage = cd['massage']
            msg = '{0} شمارا به خواندن پست {1} در آدرس زیر دعوت کرده است {2}{3}{4}{5}'\
                .format(cd['name'], post.title, "\n", massage, "\n", post_url)
            send_email(to, subject, msg)
            sent = True
    else:
        form = ShareForm
    return render(request, 'shop/forms/share.html', {'form': form, 'sent': sent, 'post': post})