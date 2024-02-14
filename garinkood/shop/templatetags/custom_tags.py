from django import template
from ..models import Item
register = template.Library()


@register.simple_tag()
def number_of_Item():
    Items = Item.objects.filter(status='published')
    return ""