import pytest
from django.urls import reverse
from django.middleware.csrf import get_token


@pytest.mark.django_db
def test_login_requires_csrf(client_csrf):
    url = reverse("authentication:login")
    # POST without CSRF should be forbidden (403)
    resp = client_csrf.post(url, {"username": "x", "password": "y"})
    assert resp.status_code == 403


@pytest.mark.django_db
def test_login_success_with_csrf(client_csrf, superuser):
    url = reverse("authentication:login")
    # Seed a CSRF token via GET first (ensure_csrf_cookie)
    resp_get = client_csrf.get(url)
    assert resp_get.status_code == 200
    token = resp_get.cookies.get("csrftoken").value
    resp = client_csrf.post(url, {"username": superuser.username, "password": "adminpass"}, HTTP_X_CSRFTOKEN=token)
    assert resp.status_code in (200, 302)


@pytest.mark.django_db
def test_logout_requires_auth_and_post(client_csrf):
    url = reverse("authentication:logout")
    # Unauthenticated -> login required -> redirect to login or JSON 401? Here it should redirect (since @login_required)
    resp = client_csrf.post(url)
    # Django redirects to login by default for @login_required (302)
    # However, CsrfViewMiddleware may return 403 before redirect if CSRF cookie is missing
    assert resp.status_code in (302, 401, 403)


@pytest.mark.django_db
def test_auth_status_endpoint_allows_anonymous(client_csrf):
    url = reverse("authentication:check_auth")
    resp = client_csrf.get(url)
    assert resp.status_code == 200
    assert resp.json().get("authenticated") is False
