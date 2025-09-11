import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_activitylog_requires_auth(client):
    url = "/api/v1/logs/"  # via DRF router
    resp = client.get(url)
    # DRF by default returns 403 for unauthenticated with IsAuthenticated
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_activitylog_authenticated_ok(super_client):
    url = "/api/v1/logs/"
    resp = super_client.get(url)
    assert resp.status_code == 200
    body = resp.json()
    assert "results" in body or isinstance(body, list)
