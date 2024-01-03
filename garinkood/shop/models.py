from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse

# Create your models here.

# new manager for model Item
class LinkSerch(models.Manager):
    def get_queryset(self):
        return super(LinkSerch, self).get_queryset()
    def link(self, link):
        return self.filter(slug=link)

# new method for manager objects
class PostManager(models.Manager):
    def dateyear(self,year):
        return self.filter(publish__year=year)
    def statusp(self):
        return self.filter(status='published')
    def statusd(self):
        return self.filter(status='draft')

class Item(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
    )

    title = models.CharField(max_length=250,)  #VARCHAR
    slug = models.SlugField(max_length=250, unique_for_date='publish',)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='item_posts',)
    body = models.TextField()  #TEXT
    publish = models.DateTimeField(default=timezone.now,)
    created = models.DateTimeField(auto_now_add=True,)
    update = models.DateTimeField(auto_now=True,)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='draft',)
    objects = PostManager()
    serch = LinkSerch()
    price = models.IntegerField(blank=True,null=True)


    class Meta:
        ordering = ('-publish',)
    def __str__(self):
        return self.title
    def get_absolute_utl(self):
        return reverse('shop:post_detail', args=[self.slug, self.id])

class UserAccount(models.Model):
    GENDER_CHOICESE=(
        ("خانم", "خانم"), ("اقا", "اقا"),
    )
    phone = models.CharField(max_length=11,)  # VARCHAR
    user = models.OneToOneField(User,on_delete=models.CASCADE, related_name='account',)
    gender = models.CharField(max_length=15, choices=GENDER_CHOICESE, default="اقا")
    address = models.TextField(max_length=250,blank=True,null=True,)
    crated = models.DateTimeField(auto_now_add=True,null=True)
    update = models.DateTimeField(auto_now_add=True,)
    # for create new fields in database (blank=True,null=True)
    def __str__(self):
        return self.user.first_name + " " + self.user.last_name
class Comment(models.Model) :
    post = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="comments",)
    name = models.CharField(max_length=100, null=False)
    body = models.TextField(null=False,)
    crated = models.DateTimeField(auto_now_add=True,)
    updated = models.DateTimeField(auto_now=True,)
    active = models.BooleanField(default=False,)
    class Meta:
        ordering = ('crated',)
    def __str__(self):
        return "کامنت توسط {0} رویه پست {1} گذاشته شد".format(self.name, self.post)
