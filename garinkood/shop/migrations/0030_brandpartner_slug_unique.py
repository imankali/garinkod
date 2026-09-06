"""Make the brand slug unique, now that every row has a real one.

Split out of 0028 so the backfill can run between the two halves.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0029_backfill_brand_slugs'),
    ]

    operations = [
        migrations.AlterField(
            model_name='brandpartner',
            name='slug',
            field=models.SlugField(blank=True, max_length=140, unique=True, verbose_name='اسلاگ'),
        ),
    ]
