import pytest

@pytest.mark.django_db
def test_activitylog_signals_create_update_delete(settings):
    # Ensure signals are registered by importing the module explicitly
    import apps.dashboard.signals  # noqa: F401

    from django.contrib.auth.models import User
    from apps.dashboard.models import Table1, ActivityLog

    # Create an admin user so _actor_user() can resolve
    User.objects.create_user(username="admin", password="pass", is_staff=True, is_superuser=True)

    # CREATE
    obj = Table1.objects.create(name="A", city="X", phone="123")
    assert ActivityLog.objects.filter(table_name="Table1", action="CREATE", row_id=obj.pk).exists()

    # UPDATE
    obj.name = "B"
    obj.save()
    assert ActivityLog.objects.filter(table_name="Table1", action="UPDATE", row_id=obj.pk).exists()

    # DELETE
    rid = obj.pk
    obj.delete()
    assert ActivityLog.objects.filter(table_name="Table1", action="DELETE", row_id=rid).exists()
