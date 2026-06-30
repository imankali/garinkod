from django import template
from ..models import Product
register = template.Library()


@register.simple_tag()
def number_of_Item():
    Items = Product.objects.filter(status='published')
    return ""

#@register.inclusion_tag()
#def