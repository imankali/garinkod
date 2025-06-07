
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



class SignInForm(forms.Form):
    GENDER_CHOICESE=(
        ("خانم", "خانم"),
        ("اقا", "اقا"),
    )
    username = forms.CharField(max_length=70)
    first_name = forms.CharField(max_length=30, label="نام")
    last_name = forms.CharField(max_length=30, label="نام خانوادگی")
    email = forms.CharField(max_length=50)
    gender = forms.ChoiceField(choices=GENDER_CHOICESE, widget=forms.RadioSelect)
    address = forms.CharField(max_length=250, widget=forms.Textarea, required=False)
    phone = forms.CharField(max_length=11)
    password = forms.CharField(widget=forms.PasswordInput())
    password2 = forms.CharField(widget=forms.PasswordInput())



    def clean_username(self):
        username = self.cleaned_data['username']
        def validate_string(string):
            allowed_chars = '''ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890'''
            for char in string:
                if char not in allowed_chars:
                    return False
            return True
        def first_string(string):
            allowed_chars = '''ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'''
            check = string[0]
            if check in allowed_chars:
                return True
            else:
                return False

        if username:
            if first_string(username):
                if validate_string(username):
                   if len(username) >= 4:
                       return username
                   else:
                       raise forms.ValidationError("باید 4 یا بیشتر از 4 کارکتر باشد")
                else:
                    raise forms.ValidationError("از کاراکتر هایه مجاز استفاده شود مانند (A-Z,a-z,0-9) ")
            else:
                raise forms.ValidationError("کاراکتر اول باید حروف باشد")

    def clean_first_name(self):
        first_name = self.cleaned_data['first_name']
        def validate_string(string):
            allowed_chars = '''پ چ ج ح خ ه ع غ ف ق ث ص ض ش س ی ب ل ا ت ن م ک گ و ئ د ذ ر ز ژ ط ظ
            ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890'''
            for char in string:
                if char not in allowed_chars:
                    return False
            return True
        def first_string(string):
            allowed_chars = '''پ چ ج ح خ ه ع غ ف ق ث ص ض ش س ی ب ل ا ت ن م ک گ و ئ د ذ ر ز ژ ط ظ
            ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'''
            check = string[0]
            if check in allowed_chars:
                return True
            else:
                return False
        if first_name:
            if first_string(first_name):
                if validate_string(first_name):
                   return first_name
                else:
                    raise forms.ValidationError("از کاراکتر هایه مجاز استفاده شود مانند (A-Z,a-z,الف-ی,0-9) ")
            else:
                raise forms.ValidationError("کاراکتر اول باید حروف باشد")

    def clean_last_name(self):

        last_name = self.cleaned_data['last_name']
        def validate_string(string):
            allowed_chars ='''ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq
            rstuvwxyz0123456789_@.پ چ ج ح خ ه ع غ ف ق ث ص ض ش س ی ب ل  ا ت ن م ک گ و ئ د ذ ر زژط ظ'''
            for char in string:
                if char not in allowed_chars:
                    return False
            return True

        if last_name:
            if validate_string(last_name):
                return last_name
            else:
                raise forms.ValidationError("از کاراکتر هایه مجاز استفاده شود مانند (A-Z,a-z,_,@,0-9,الف-پ,.)",)