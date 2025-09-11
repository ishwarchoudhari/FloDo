import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_settings_app_requires_login(client):
    url = reverse("settings_app:index")
    resp = client.get(url)
    assert resp.status_code in (302, 401)


@pytest.mark.django_db
def test_app_update_requires_csrf(client_csrf, superuser):
    url = reverse("settings_app:app")
    # unauthenticated will redirect
    resp = client_csrf.post(url, {})
    assert resp.status_code in (302, 401, 403)
    # authenticated with CSRF
    client_csrf.force_login(superuser)
    # Obtain CSRF cookie from a view that sets it explicitly
    token = client_csrf.get(reverse("authentication:login")).cookies.get("csrftoken").value
    resp2 = client_csrf.post(url, {"app_name": "X", "timezone": "UTC", "records_per_page": 10}, HTTP_X_CSRFTOKEN=token)
    assert resp2.status_code in (302, 200)


@pytest.mark.django_db
def test_export_table_is_accessible_to_authenticated_users(authed_client):
    url = reverse("settings_app:export_table", kwargs={"fmt": "json", "table_id": 2})
    resp = authed_client.get(url)
    assert resp.status_code == 200
