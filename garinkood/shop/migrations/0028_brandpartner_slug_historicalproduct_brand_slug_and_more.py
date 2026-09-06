"""Brand slugs.

``BrandPartner.slug`` is added non-unique on purpose: the table already has rows,
so a unique column would be born with duplicated empty values and fail before the
backfill in 0029 can name them. 0030 tightens the constraint once the data has
slugs.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0027_commentvote_historicaltag_productimage_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='brandpartner',
            name='slug',
            field=models.SlugField(blank=True, max_length=140, db_index=True, verbose_name='اسلاگ'),
        ),
        migrations.AddField(
            model_name='historicalproduct',
            name='brand_slug',
            field=models.SlugField(blank=True, max_length=140, verbose_name='اسلاگ برند'),
        ),
        migrations.AddField(
            model_name='product',
            name='brand_slug',
            field=models.SlugField(blank=True, max_length=140, verbose_name='اسلاگ برند'),
        ),
    ]
