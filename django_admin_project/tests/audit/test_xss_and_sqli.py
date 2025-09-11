import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_browse_artists_ignores_sqli_and_renders_safely(client):
    url = reverse("client_portal:browse_artists")
    dangerous = "Robert'); DROP TABLE Students;--"
    payload = {"q": dangerous, "city": "", "service": ""}
    resp = client.get(url, data=payload)
    assert resp.status_code == 200
    # Ensure the raw payload is not reflected back unescaped in the HTML
    body = resp.content.decode("utf-8")
    assert dangerous not in body


@pytest.mark.django_db
def test_browse_artists_escapes_script_in_query(client):
    url = reverse("client_portal:browse_artists")
    payload = {"q": "<script>alert('x')</script>"}
    resp = client.get(url, data=payload)
    assert resp.status_code == 200
    body = resp.content.decode("utf-8")
    # Raw <script> should not appear (Django autoescape)
    assert "<script>alert('x')</script>" not in body
    # Escaped variant likely present
    assert "&lt;script&gt;" in body or "&lt;/script&gt;" in body
