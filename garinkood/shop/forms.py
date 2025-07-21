from django import forms
from django.contrib.auth.models import User
from .models import UserAccount, Comment

class AccountForm(forms.ModelForm):
    GENDER_CHOICES = (
        ("خانم", "خانم"),
        ("اقا", "اقا"),
    )

    # فیلدهایی که از مدل User هستن
    first_name = forms.CharField(label="نام", max_length=100)
    last_name = forms.CharField(label="نام خانوادگی", max_length=100)
    gender = forms.ChoiceField(choices=GENDER_CHOICES, widget=forms.RadioSelect, label="جنسیت")
    phone = forms.CharField(label="تلفن", max_length=11)
    address = forms.CharField(label="آدرس", widget=forms.Textarea, required=False)

    class Meta:
        model = UserAccount
        fields = ['gender', 'phone', 'address']

    def __init__(self, *args, **kwargs):
        super(AccountForm, self).__init__(*args, **kwargs)
        # پر کردن فیلدهای نام و نام خانوادگی از User
        if self.instance and self.instance.user:
            self.fields['first_name'].initial = self.instance.user.first_name
            self.fields['last_name'].initial = self.instance.user.last_name

    def clean_first_name(self):
        first_name = self.cleaned_data.get('first_name')
        if first_name:
            def validate_string(string):
                allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzپچجحخهعغفقثصضشسیبلاتنمکگؤئدذرزژطظ '
                for char in string:
                    if char not in allowed_chars:
                        return False
                return True

            if not validate_string(first_name):
                raise forms.ValidationError("نام فقط باید شامل حروف فارسی یا انگلیسی و فاصله باشد.")
        return first_name

    def clean_last_name(self):
        last_name = self.cleaned_data.get('last_name')
        if last_name:
            def validate_string(string):
                allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzپچجحخهعغفقثصضشسیبلاتنمکگؤئدذرزژطظ '
                for char in string:
                    if char not in allowed_chars:
                        return False
                return True

            if not validate_string(last_name):
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
    name = forms.CharField(max_length=30, label="نام")
    email = forms.EmailField(label="ایمیل")
    subject = forms.CharField(max_length=50, label="موضوع")
    phone = forms.CharField(max_length=11, required=False, label="تلفن")
    massage = forms.CharField(max_length=250, widget=forms.Textarea, label="متن پیام")


class ShareForm(forms.Form):
    name = forms.CharField(max_length=30, label="نام و نام خانوادگی")
    massage = forms.CharField(max_length=250, widget=forms.Textarea, label="پیام")
    to = forms.EmailField(label="ایمیل گیرنده")


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ('name', 'body')


class LoginForm(forms.Form):
    username = forms.CharField(label="نام کاربری")
    password = forms.CharField(widget=forms.PasswordInput(), label="رمز عبور")


class ChangePasswordForm(forms.Form):
    old_password = forms.CharField(widget=forms.PasswordInput(), label="رمز عبور فعلی")
    new_password1 = forms.CharField(widget=forms.PasswordInput(), label="رمز جدید")
    new_password2 = forms.CharField(widget=forms.PasswordInput(), label="تکرار رمز جدید")


class SignInForm(forms.Form):
    GENDER_CHOICES = (
        ("خانم", "خانم"),
        ("اقا", "اقا"),
    )

    username = forms.CharField(max_length=70, label="نام کاربری")
    first_name = forms.CharField(max_length=30, label="نام")
    last_name = forms.CharField(max_length=30, label="نام خانوادگی")
    email = forms.EmailField(label="ایمیل")
    gender = forms.ChoiceField(choices=GENDER_CHOICES, widget=forms.RadioSelect, label="جنسیت")
    address = forms.CharField(max_length=250, widget=forms.Textarea, required=False, label="آدرس")
    phone = forms.CharField(max_length=11, label="شماره تلفن")
    password = forms.CharField(widget=forms.PasswordInput(), label="رمز عبور")
    password2 = forms.CharField(widget=forms.PasswordInput(), label="تکرار رمز عبور")

    def clean_username(self):
        username = self.cleaned_data['username']
        def validate_string(string):
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890'
            for char in string:
                if char not in allowed_chars:
                    return False
            return True

        def first_string(string):
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            check = string[0]
            return check in allowed_chars

        if username:
            if first_string(username):
                if validate_string(username):
                    if len(username) >= 4:
                        return username
                    else:
                        raise forms.ValidationError("نام کاربری باید حداقل 4 کاراکتر باشد.")
                else:
                    raise forms.ValidationError("نام کاربری فقط می‌تواند شامل حروف و اعداد باشد.")
            else:
                raise forms.ValidationError("کاراکتر اول نام کاربری باید حرف باشد.")
        return username

    def clean_first_name(self):
        first_name = self.cleaned_data.get('first_name')
        if first_name:
            def validate_string(string):
                allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzپچجحخهعغفقثصضشسیبلاتنمکگؤئدذرزژطظ '
                for char in string:
                    if char not in allowed_chars:
                        return False
                return True

            if not validate_string(first_name):
                raise forms.ValidationError("نام فقط باید شامل حروف فارسی یا انگلیسی باشد.")
        return first_name

    def clean_last_name(self):
        last_name = self.cleaned_data.get('last_name')
        if last_name:
            def validate_string(string):
                allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzپچجحخهعغفقثصضشسیبلاتنمکگؤئدذرزژطظ '
                for char in string:
                    if char not in allowed_chars:
                        return False
                return True

            if not validate_string(last_name):
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