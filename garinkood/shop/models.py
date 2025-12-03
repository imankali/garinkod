from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse
from django.conf import settings

# --- Managers ---
class LinkSerch(models.Manager):
    def get_queryset(self):
        return super(LinkSerch, self).get_queryset()

    def link(self, link):
        return self.filter(slug=link)


class PostManager(models.Manager):
    def dateyear(self, year):
        return self.filter(publish__year=year)

    def statusp(self):
        return self.filter(status='published')

    def statusd(self):
        return self.filter(status='draft')


# --- Category ---
class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name="نام دسته")
    slug = models.SlugField(unique=True, verbose_name="اسلاگ")

    class Meta:
        verbose_name = "دسته"
        verbose_name_plural = "دسته‌ها"

    def __str__(self):
        return self.name


# --- Item / Product ---
class Item(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('published', 'Published'),
    )

    title = models.CharField(max_length=250)
    slug = models.SlugField(max_length=250, unique_for_date='publish')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='item_posts')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="دسته")
    body = models.TextField()
    publish = models.DateTimeField(default=timezone.now)
    created = models.DateTimeField(auto_now_add=True)
    update = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='draft')
    price = models.IntegerField(blank=True, null=True)
    stock = models.PositiveIntegerField(default=0)
    image = models.ImageField(upload_to='products/', blank=True, null=True)

    objects = PostManager()
    serch = LinkSerch()

    class Meta:
        ordering = ('-publish',)

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse('shop:product_detail', args=[self.slug, self.id])



    @property
    def image_url(self):
        """
        URL ایمن تصویر محصول.
        اگر تصویر وجود داشت → URL آن
        اگر نبود → URL یک تصویر پیش‌فرض از static
        """
        if self.image and hasattr(self.image, 'url') and self.image.name:
            return self.image.url
        return f"{settings.STATIC_URL}images/default-product.png"


# --- مشخصات اختصاصی برای هر دسته ---
class FertilizerDetail(models.Model):
    product = models.OneToOneField(Item, on_delete=models.CASCADE, verbose_name="محصول")
    fertilizer_type = models.CharField(max_length=100, verbose_name="نوع کود")
    nitrogen = models.CharField(max_length=20, verbose_name="نیتروژن (%)")
    phosphorus = models.CharField(max_length=20, verbose_name="فسفر (%)")
    potassium = models.CharField(max_length=20, verbose_name="پتاسیم (%)")

    class Meta:
        verbose_name = "مشخصات کود"
        verbose_name_plural = "مشخصات کود"

    def __str__(self):
        return f"کود {self.product.title}"


class PesticideDetail(models.Model):
    product = models.OneToOneField(Item, on_delete=models.CASCADE, verbose_name="محصول")
    pesticide_type = models.CharField(max_length=100, verbose_name="نوع سم")
    active_ingredient = models.CharField(max_length=100, verbose_name="مواد فعال")
    concentration = models.CharField(max_length=20, verbose_name="غلظت (%)")

    class Meta:
        verbose_name = "مشخصات سم"
        verbose_name_plural = "مشخصات سم"

    def __str__(self):
        return f"سم {self.product.title}"


class SeedDetail(models.Model):
    product = models.OneToOneField(Item, on_delete=models.CASCADE, verbose_name="محصول")
    crop_type = models.CharField(max_length=100, verbose_name="نوع گیاه")
    variety = models.CharField(max_length=100, verbose_name="رقم")
    weight_per_kg = models.CharField(max_length=20, verbose_name="وزن در کیلوگرم")

    class Meta:
        verbose_name = "مشخصات بذر"
        verbose_name_plural = "مشخصات بذر"

    def __str__(self):
        return f"بذر {self.product.title}"


class EquipmentDetail(models.Model):
    product = models.OneToOneField(Item, on_delete=models.CASCADE, verbose_name="محصول")
    tool_type = models.CharField(max_length=100, verbose_name="نوع ابزار")
    material = models.CharField(max_length=100, verbose_name="جنس")
    weight = models.CharField(max_length=20, verbose_name="وزن")

    class Meta:
        verbose_name = "مشخصات ابزار"
        verbose_name_plural = "مشخصات ابزار"

    def __str__(self):
        return f"ابزار {self.product.title}"


# --- User Account ---
class UserAccount(models.Model):
    GENDER_CHOICESE = (
        ("خانم", "خانم"),
        ("اقا", "اقا"),
    )
    phone = models.CharField(max_length=11)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='account')
    gender = models.CharField(max_length=15, choices=GENDER_CHOICESE, default="اقا")
    address = models.TextField(max_length=250, blank=True, null=True)
    crated = models.DateTimeField(auto_now_add=True, null=True)
    update = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.first_name + " " + self.user.last_name


# --- Comment ---
class Comment(models.Model):
    post = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="comments")
    name = models.CharField(max_length=100, null=False)
    email = models.EmailField(blank=True, null=True)
    body = models.TextField(null=False)
    crated = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=False)

    class Meta:
        ordering = ('crated',)

    def __str__(self):
        return f"کامنت توسط {self.name} رویه پست {self.post}"

class SubCategory(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='subcategories')
    name = models.CharField(max_length=100, verbose_name="نام زیردسته")
    slug = models.SlugField(unique=True)

    def __str__(self):
        return f"{self.category.name} - {self.name}"