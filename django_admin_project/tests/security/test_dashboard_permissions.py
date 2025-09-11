import pytest
from django.urls import reverse
from apps.dashboard.models import Table2


@pytest.mark.django_db
def test_get_table_data_access_requires_login(client):
    url = reverse("dashboard:get_table_data", kwargs={"table_id": 2})
    resp = client.get(url)
    # @login_required redirects anonymous users
    assert resp.status_code in (302, 401)


@pytest.mark.django_db
def test_get_table_data_accessible_to_non_superuser(authed_client, user):
    # Ensure there is at least one row
    Table2.objects.create(name="Alice", city="Pune", phone="1234567890")
    url = reverse("dashboard:get_table_data", kwargs={"table_id": 2})
    resp = authed_client.get(url)
    # Vulnerability: non-superuser can read table data
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("success") is True
    assert data.get("total") >= 1


@pytest.mark.django_db
def test_table_crud_create_accessible_to_non_superuser(authed_client):
    url = reverse("dashboard:create_row", kwargs={"table_id": 2})
    payload = {"name": "Bob", "city": "Delhi", "phone": "0123456789"}
    resp = authed_client.post(url, data=payload)
    # Vulnerability: non-superuser can mutate data
    assert resp.status_code == 200
    assert resp.json().get("success") is True


@pytest.mark.django_db
def test_table_crud_update_delete_require_login(client, authed_client):
    # create first
    create_url = reverse("dashboard:create_row", kwargs={"table_id": 2})
    obj = authed_client.post(create_url, data={"name": "Carl", "city": "Goa", "phone": "1112223333"}).json()["data"]
    row_id = obj["unique_id"] if "unique_id" in obj else obj.get("id")
    # anonymous cannot update
    upd_url = reverse("dashboard:row_ops", kwargs={"table_id": 2, "row_id": row_id})
    resp = client.post(upd_url, data={"_method": "PUT", "name": "Carl", "city": "Goa", "phone": "1112223333"})
    assert resp.status_code in (302, 401)
    # authenticated can update (non-superuser)
    resp2 = authed_client.post(upd_url, data={"_method": "PUT", "name": "Carl", "city": "Goa", "phone": "1112223333"})
    assert resp2.status_code == 200
