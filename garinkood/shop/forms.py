
from django import forms
from .models import UserAccount
#add method from

# auto add (class AccountForm(forms.ModelForm):)
class AccountForm(forms.Form):
    GENDER_CHOICESE=(
        ("خانم", "خانم"),
        ("اقا", "اقا"),
    )
    name = forms.CharField(max_length=30)
    last_name = forms.CharField(max_length=40)
    gender = forms.ChoiceField(choices=GENDER_CHOICESE, widget=forms.RadioSelect)
    address = forms.CharField(max_length=250, widget=forms.Textarea)
    phone = forms.CharField(max_length=11)


   #class Meta:
    #    model=UserAccount
    #    fields=('phone', )