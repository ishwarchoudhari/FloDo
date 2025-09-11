from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.forms.models import model_to_dict
from django.contrib.auth import get_user_model
from .models import ActivityLog
from . import models as mdl
from apps.dashboard.services.admin_service import safe_table1_details  # sanitize Table1 details

TABLE_MODELS = [getattr(mdl, f"Table{i}") for i in range(1, 11)]
User = get_user_model()


def _actor_user() -> User:
    # Signals do not have direct access to request; for demo we attribute to first superuser if available.
    # In views, CRUD actions are wrapped in @login_required; ideally use request user via custom middleware.
    try:
        return User.objects.filter(is_superuser=True).first() or User.objects.first()
    except Exception:
        return None


for Model in TABLE_MODELS:

    @receiver(post_save, sender=Model, weak=False)
    def on_save(sender, instance, created, **_kwargs):
        try:
            details = safe_table1_details(instance) if sender is mdl.Table1 else model_to_dict(instance)
            ActivityLog.objects.create(
                table_name=sender.__name__,
                action="CREATE" if created else "UPDATE",
                row_id=instance.pk,
                row_details=details,
                admin_user=_actor_user(),
            )
        except Exception:
            # Avoid breaking the main transaction due to logging failure
            pass

    @receiver(post_delete, sender=Model, weak=False)
    def on_delete(sender, instance, **_kwargs):
        try:
            details = safe_table1_details(instance) if sender is mdl.Table1 else model_to_dict(instance)
            ActivityLog.objects.create(
                table_name=sender.__name__,
                action="DELETE",
                row_id=instance.pk,
                row_details=details,
                admin_user=_actor_user(),
            )
        except Exception:
            pass
