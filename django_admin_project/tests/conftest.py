import pytest
from django.contrib.auth.models import User
from django.test import Client
from django.conf import settings


@pytest.fixture
def client_csrf(db):
    # Enforce CSRF checks to validate forms properly
    return Client(enforce_csrf_checks=True)


@pytest.fixture
def user(db):
    return User.objects.create_user(username="user", password="userpass")


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="admin", email="admin@example.com", password="adminpass")


@pytest.fixture
def authed_client(db, user):
    c = Client()
    c.force_login(user)
    # Stamp server boot id to avoid middleware invalidation on first request
    session = c.session
    session["server_boot_id"] = getattr(settings, "SERVER_BOOT_ID", None)
    session.save()
    return c


@pytest.fixture
def super_client(db, superuser):
    c = Client()
    c.force_login(superuser)
    # Stamp server boot id to avoid middleware invalidation on first request
    session = c.session
    session["server_boot_id"] = getattr(settings, "SERVER_BOOT_ID", None)
    session.save()
    return c
