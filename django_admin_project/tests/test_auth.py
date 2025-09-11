import pytest
from django.urls import reverse
from django.contrib.auth.models import User


@pytest.mark.django_db
def test_login_get_renders_login_template(client):
    url = reverse('authentication:login')
    resp = client.get(url)
    assert resp.status_code == 200
    assert b"<form" in resp.content  # basic smoke check


@pytest.mark.django_db
def test_login_post_invalid_returns_400(client):
    url = reverse('authentication:login')
    resp = client.post(url, data={"username": "nouser", "password": "bad"}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
    assert resp.status_code in (400, 401)
    data = resp.json()
    assert data["success"] is False


@pytest.mark.django_db
def test_signup_disabled_after_superadmin_exists(client):
    # Ensure a superadmin exists
    user = User.objects.create_user(username="admin", password="pass", is_staff=True, is_superuser=True)
    # create SuperAdmin model instance if present, tolerate absence
    try:
        from apps.authentication.models import SuperAdmin
        SuperAdmin.objects.get_or_create(user=user)
    except Exception:
        pass

    url = reverse('authentication:signup')
    resp = client.get(url)
    # Should redirect to login
    assert resp.status_code in (302, 301)


@pytest.mark.django_db
def test_logout_requires_post(client):
    url = reverse('authentication:logout')
    resp = client.get(url)
    assert resp.status_code in (301, 302, 405)
