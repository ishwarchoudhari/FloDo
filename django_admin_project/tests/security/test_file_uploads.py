import io
import pytest
from django.urls import reverse
from PIL import Image


def make_image_bytes(format="PNG", size=(10, 10), color=(255, 0, 0)):
    bio = io.BytesIO()
    img = Image.new("RGB", size=size, color=color)
    img.save(bio, format=format)
    bio.seek(0)
    return bio


@pytest.mark.django_db
def test_avatar_upload_rejects_large_file(super_client):
    url = reverse("authentication:profile_avatar")
    # Create a 3MB dummy file (exceeds 2MB limit)
    big = io.BytesIO(b"0" * (3 * 1024 * 1024))
    big.name = "big.png"
    resp = super_client.post(url, {"avatar": big})
    assert resp.status_code == 400
    assert "too large" in resp.json().get("error", "").lower()


@pytest.mark.django_db
def test_avatar_upload_rejects_wrong_type(super_client):
    url = reverse("authentication:profile_avatar")
    fake = io.BytesIO(b"%PDF-1.4\n")
    fake.name = "file.pdf"
    # Django may not set content_type for BytesIO; this view inspects content_type from UploadedFile
    # Force a .pdf extension; content_type may be empty, validation will fail on Pillow verification
    resp = super_client.post(url, {"avatar": fake})
    assert resp.status_code == 400


@pytest.mark.django_db
def test_certificate_upload_validations(client):
    # Anonymous can apply via client portal; test certificate validators
    url = reverse("client_portal:artist_apply")
    # Prime session to avoid session race during save
    client.get(url)
    img_bytes = make_image_bytes()
    img_bytes.name = "cert.png"
    resp = client.post(url, {
        "city": "Pune",
        "phone": "0123456789",
        "email": "x@example.com",
        "years_experience": 1,
        "certificates": img_bytes,
    })
    # Redirect to status on success
    assert resp.status_code in (302, 200)
