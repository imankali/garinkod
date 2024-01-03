from django.contrib import admin
from.models import *
# Register your models here.
#admin.site.register(Item)

@admin.register(Item)
class AdminItem(admin.ModelAdmin):
    list_filter = ('status', 'publish', 'created', 'author',)
    list_display = ('title', 'author', 'slug', 'status', 'publish',)
    search_fields = ('title', 'body',)
    prepopulated_fields = {'slug': ('title',)}
    raw_id_fields = ('author',)
    date_hierarchy = 'publish'
    ordering = ('-status', '-publish',)
    list_display_links = ('slug',)
    list_editable = ('status',)


@admin.register(UserAccount)
class AdminUserAccount(admin.ModelAdmin):

    list_display = ('user', 'phone', 'gender')

@admin.register(Comment)
class AdminComment(admin.ModelAdmin):
    list_display = ('name', 'post', 'crated', 'active',)
    list_filter = ('active', 'crated')
    list_editable = ('active',)