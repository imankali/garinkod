from django import forms
from django.contrib.auth.models import User
from .models import UserAccount, Comment

class AccountForm(forms.ModelForm):
    GENDER_CHOICES = UserAccount.GENDER_CHOICES

    first_name = forms.CharField(
        label="نام",
        max_length=100,
        widget=forms.TextInput(attrs={'placeholder': 'نام خود را وارد کنید'})
    )
    last_name = forms.CharField(
        label="نام خانوادگی",
        max_length=100,
        widget=forms.TextInput(attrs={'placeholder': 'نام خانوادگی خود را وارد کنید'})
    )
    gender = forms.ChoiceField(
        choices=GENDER_CHOICES,
        widget=forms.RadioSelect,
        label="جنسیت"
    )
    phone = forms.CharField(
        label="شماره همراه",
        max_length=11,
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': '09123456789',
            'readonly': 'readonly'
        })
    )
    address = forms.CharField(
        label="آدرس",
        widget=forms.Textarea(attrs={'placeholder': 'آدرس خود را وارد کنید'}),
        required=False
    )

    class Meta:
        model = UserAccount
        fields = ['gender', 'phone', 'address']

    def __init__(self, *args, **kwargs):
        super(AccountForm, self).__init__(*args, **kwargs)
        if self.instance and self.instance.user:
            self.fields['first_name'].initial = self.instance.user.first_name
            self.fields['last_name'].initial = self.instance.user.last_name

    def clean_first_name(self):
        first_name = self.cleaned_data.get('first_name')
        if first_name:
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzپچجحخهعغفقثصضشسیبلاتنمکگؤئدذرزژطظ '
            if not all(char in allowed_chars for char in first_name):
                raise forms.ValidationError("نام فقط باید شامل حروف فارسی یا انگلیسی و فاصله باشد.")
        return first_name

    def clean_last_name(self):
        last_name = self.cleaned_data.get('last_name')
        if last_name:
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzپچجحخهعغفقثصضشسیبلاتنمکگؤئدذرزژطظ '
            if not all(char in allowed_chars for char in last_name):
                raise forms.ValidationError("نام خانوادگی فقط باید شامل حروف فارسی یا انگلیسی و فاصله باشد.")
        return last_name

    def save(self, commit=True):
        account = super(AccountForm, self).save(commit=False)
        account.user.first_name = self.cleaned_data['first_name']
        account.user.last_name = self.cleaned_data['last_name']
        if commit:
            account.user.save()
            account.save()
        return account


class SupportForm(forms.Form):
    name = forms.CharField(
        max_length=30,
        label="نام",
        widget=forms.TextInput(attrs={'placeholder': 'نام کامل شما'})
    )
    email = forms.EmailField(
        label="ایمیل",
        widget=forms.EmailInput(attrs={'placeholder': 'example@email.com'})
    )
    subject = forms.CharField(
        max_length=50,
        label="موضوع",
        widget=forms.TextInput(attrs={'placeholder': 'موضوع پیام'})
    )
    phone = forms.CharField(
        max_length=11,
        required=False,
        label="تلفن",
        widget=forms.TextInput(attrs={'placeholder': '09123456789'})
    )
    massage = forms.CharField(
        max_length=250,
        widget=forms.Textarea(attrs={'placeholder': 'متن پیام شما...'}),
        label="متن پیام"
    )


class ShareForm(forms.Form):
    name = forms.CharField(
        max_length=30,
        label="نام و نام خانوادگی",
        widget=forms.TextInput(attrs={'placeholder': 'نام شما'})
    )
    massage = forms.CharField(
        max_length=250,
        widget=forms.Textarea(attrs={'placeholder': 'پیام شخصی شما...'}),
        label="پیام"
    )
    to = forms.EmailField(
        label="ایمیل گیرنده",
        widget=forms.EmailInput(attrs={'placeholder': 'friend@email.com'})
    )


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ('name', 'body')
        widgets = {
            'name': forms.TextInput(attrs={'placeholder': 'نام شما'}),
            'body': forms.Textarea(attrs={'placeholder': 'دیدگاه شما...'})
        }


class LoginForm(forms.Form):
    username = forms.CharField(
        label="نام کاربری",
        widget=forms.TextInput(attrs={'placeholder': 'نام کاربری خود را وارد کنید'})
    )
    password = forms.CharField(
        label="رمز عبور",
        widget=forms.PasswordInput(attrs={'placeholder': '••••••••••••'})
    )


class ChangePasswordForm(forms.Form):
    old_password = forms.CharField(
        widget=forms.PasswordInput(attrs={'placeholder': 'رمز عبور فعلی'}),
        label="رمز عبور فعلی"
    )
    new_password1 = forms.CharField(
        widget=forms.PasswordInput(attrs={'placeholder': 'رمز عبور جدید'}),
        label="رمز جدید"
    )
    new_password2 = forms.CharField(
        widget=forms.PasswordInput(attrs={'placeholder': 'تکرار رمز عبور جدید'}),
        label="تکرار رمز جدید"
    )


class SignInForm(forms.Form):
    # ✅ تغییر اصلی: هماهنگی با مدل
    GENDER_CHOICES = UserAccount.GENDER_CHOICES

    username = forms.CharField(
        max_length=70,
        label="نام کاربری",
        widget=forms.TextInput(attrs={'placeholder': 'نام کاربری'})
    )
    first_name = forms.CharField(
        max_length=30,
        label="نام",
        widget=forms.TextInput(attrs={'placeholder': 'نام'})
    )
    last_name = forms.CharField(
        max_length=30,
        label="نام خانوادگی",
        widget=forms.TextInput(attrs={'placeholder': 'نام خانوادگی'})
    )
    email = forms.EmailField(
        label="ایمیل",
        widget=forms.EmailInput(attrs={'placeholder': 'example@email.com'})
    )
    gender = forms.ChoiceField(
        choices=GENDER_CHOICES,
        widget=forms.RadioSelect,
        label="جنسیت"
    )
    address = forms.CharField(
        max_length=250,
        widget=forms.Textarea(attrs={'placeholder': 'آدرس کامل'}),
        required=False,
        label="آدرس"
    )
    phone = forms.CharField(
        max_length=11,
        label="شماره تلفن",
        widget=forms.TextInput(attrs={'placeholder': '09123456789'})
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'placeholder': '••••••••••••','class': 'password-input'}),
        label="رمز عبور"
    )
    password2 = forms.CharField(
        widget=forms.PasswordInput(attrs={'placeholder': '••••••••••••','class': 'password-input'}),
        label="تکرار رمز عبور"
    )

    def clean_username(self):
        username = self.cleaned_data['username']
        if username:
            if not username[0].isalpha():
                raise forms.ValidationError("کاراکتر اول نام کاربری باید حرف باشد.")
            if not username.isalnum():
                raise forms.ValidationError("نام کاربری فقط می‌تواند شامل حروف و اعداد باشد.")
            if len(username) < 4:
                raise forms.ValidationError("نام کاربری باید حداقل 4 کاراکتر باشد.")
        return username

    def clean_first_name(self):
        first_name = self.cleaned_data.get('first_name')
        if first_name:
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzپچجحخهعغفقثصضشسیبلاتنمکگؤئدذرزژطظ '
            if not all(char in allowed_chars for char in first_name):
                raise forms.ValidationError("نام فقط باید شامل حروف فارسی یا انگلیسی باشد.")
        return first_name

    def clean_last_name(self):
        last_name = self.cleaned_data.get('last_name')
        if last_name:
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzپچجحخهعغفقثصضشسیبلاتنمکگؤئدذرزژطظ '
            if not all(char in allowed_chars for char in last_name):
                raise forms.ValidationError("نام خانوادگی فقط باید شامل حروف فارسی یا انگلیسی باشد.")
        return last_name

    def clean_password2(self):
        password1 = self.cleaned_data.get("password")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("رمز عبور مطابقت ندارد.")
        return password2

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if email and User.objects.filter(email=email).exists():
            raise forms.ValidationError("این ایمیل قبلاً ثبت شده است.")
        return email

    def clean_phone(self):
        phone = self.cleaned_data.get("phone")
        if phone:
            if not phone.isdigit():
                raise forms.ValidationError("شماره تلفن فقط باید شامل اعداد باشد.")
            if len(phone) != 11:
                raise forms.ValidationError("شماره تلفن باید 11 رقم باشد.")
        return phone