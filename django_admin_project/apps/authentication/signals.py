from __future__ import annotations
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User

from .models import SuperAdmin


@receiver(post_save, sender=User)
def enforce_single_superuser(sender, instance: User, created: bool, **kwargs):
    """Ensure there is exactly one Django superuser and one SuperAdmin row.

    - If a user is saved with is_superuser=True, demote all other users to is_superuser=False.
    - Ensure there is exactly one SuperAdmin row pointing to that user; delete others.
    """
    try:
        if not instance.is_superuser:
            return
        with transaction.atomic():
            # Demote all other users
            (User.objects.exclude(pk=instance.pk)
                .filter(is_superuser=True)
                .update(is_superuser=False))
            # Ensure single SuperAdmin row for this user
            SuperAdmin.objects.get_or_create(user=instance, defaults={"is_super_admin": True})
            SuperAdmin.objects.exclude(user=instance).delete()
    except Exception:
        # Soft-fail to avoid breaking user save flows
        pass
