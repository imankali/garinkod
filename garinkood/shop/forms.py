
from django import forms
from .models import *
#add method from

# auto add (class AccountForm(forms.ModelForm):)
class AccountForm(forms.Form):
    GENDER_CHOICESE=(
        ("خانم", "خانم"),
        ("اقا", "اقا"),
    )
    name = forms.CharField(max_length=30, label="نام")
    last_name = forms.CharField(max_length=40)
    gender = forms.ChoiceField(choices=GENDER_CHOICESE, widget=forms.RadioSelect)
    address = forms.CharField(max_length=250, widget=forms.Textarea, required=False)
    #phone = forms.CharField(max_length=11)



    def clean_name(self):
        name = self.cleaned_data['name']
        def validate_string(string):
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@'
            for char in string:
                if char not in allowed_chars:
                    return False
            return True
        def first_string(string):
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            check = string[0]
            if check in allowed_chars:
                return True
            else:
                return False
        if name:
            if first_string(name):
                if validate_string(name):
                   return name
                else:
                    raise forms.ValidationError("از کاراکتر هایه مجاز استفاده شود مانند (A-Z,a-z,_,@,0-9) ")
            else:
                raise forms.ValidationError("کاراکتر اول باید حروف باشد")

    def clean_last_name(self):

        last_name = self.cleaned_data['last_name']
        def validate_string(string):
            allowed_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@.'
            for char in string:
                if char not in allowed_chars:
                    return False
            return True

        if last_name:
            if validate_string(last_name):
                return last_name
            else:
                raise forms.ValidationError("از کاراکتر هایه مجاز استفاده شود مانند (A-Z,a-z,_,@,0-9,.)")





   #class Meta:
    #    model=UserAccount
    #    fields=('phone', )

class SupportForm(forms.Form):

    name = forms.CharField(max_length=30, label="نام")
    massage = forms.CharField(max_length=250)
    subject = forms.CharField(max_length=50)
    phone = forms.CharField(max_length=11, required=False)
    email = forms.CharField(max_length=50)

class ShareForm(forms.Form):

    name = forms.CharField(max_length=30, label="نام و نام خانوادگی")
    massage = forms.CharField(max_length=250, label="پیام")
    #subject = forms.CharField(max_length=50, label="موضوع")
    to = forms.CharField(max_length=50, label="آدرس ایمیل")

class CommentForm(forms.ModelForm):
   class Meta:
        model = Comment
        fields = ('name', 'body',)


class LoginForm(forms.Form):
    username = forms.CharField()
    password = forms.CharField()

class ChangePasswordForm(forms.Form):
    old_password = forms.CharField(widget=forms.PasswordInput())
    new_password1 = forms.CharField(widget=forms.PasswordInput())
    new_password2 = forms.CharField(widget=forms.PasswordInput())



