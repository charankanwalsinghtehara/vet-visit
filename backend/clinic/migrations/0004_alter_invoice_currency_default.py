from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clinic", "0003_alter_invoice_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invoice",
            name="currency",
            field=models.CharField(default="inr", max_length=3),
        ),
    ]
