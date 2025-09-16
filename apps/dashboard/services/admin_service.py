from __future__ import annotations
from typing import Tuple, Optional
import re
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.db import transaction

from apps.dashboard import models


# -------- Validation & Helpers --------

def validate_payload(name: str, city: str, phone: str) -> Tuple[bool, str]:
    name = (name or "").strip()
    city = (city or "").strip()
    phone = (phone or "").strip()
    if not name or not city or not phone:
        return False, "All fields (Name, City, Phone) are required."
    if not re.fullmatch(r"[A-Za-z ]+", name):
        return False, "Name must contain only letters and spaces."
    if not re.fullmatch(r"[A-Za-z ]+", city):
        return False, "City must contain only letters and spaces."
    if not re.fullmatch(r"\d{10}", phone):
        return False, "Phone must be exactly 10 digits."
    return True, ""


def _first4alpha_lower(name: str) -> str:
    letters = "".join(re.findall(r"[A-Za-z]", name or ""))[:4].lower()
    return letters or "user"


def _last3digits(phone: str) -> str:
    digits = "".join(re.findall(r"\d", phone or ""))
    return (digits[-3:] if len(digits) >= 3 else digits.rjust(3, "0"))


def build_base_username(name: str, phone: str) -> str:
    return f"{_first4alpha_lower(name)}{_last3digits(phone)}@flodo.com"


def generate_unique_username(name: str, phone: str) -> str:
    base = build_base_username(name, phone)
    candidate = base
    suffix = 1
    while models.Table1.objects.filter(user_name=candidate).exists():
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def safe_table1_details(obj: models.Table1, password_changed: Optional[bool] = None) -> dict:
    d = {
        "id": getattr(obj, "unique_id", None) or getattr(obj, "pk", None),
        "name": getattr(obj, "name", None),
        "city": getattr(obj, "city", None),
        "phone": getattr(obj, "phone", None),
        "user_name": getattr(obj, "user_name", None),
        "role": getattr(obj, "role", None),
        "is_active": getattr(obj, "is_active", None),
    }
    if password_changed is not None:
        d["password_changed"] = bool(password_changed)
    return d


# -------- Core operations (no I/O side effects like logging/WS) --------

@transaction.atomic
def create_admin(*, name: str, city: str, phone: str, role: str, password: str, actor) -> tuple[models.Table1, dict, bool]:
    ok, err = validate_payload(name, city, phone)
    if not ok:
        raise ValueError(err)

    role = (role or "admin").strip().lower()
    valid_roles = {c[0] for c in models.Table1.ROLE_CHOICES}
    if role not in valid_roles:
        role = "admin"

    # Soft uniqueness: prevent exact duplicate triad
    if models.Table1.objects.filter(name=name, phone=phone, city=city).exists():
        raise ValueError("An admin with the same details already exists.")

    user_name = generate_unique_username(name, phone)
    password_hash = make_password(password) if password else ""

    obj = models.Table1.objects.create(
        name=name,
        city=city,
        phone=phone,
        user_name=user_name,
        password_hash=password_hash,
        role=role,
        is_active=True,
        role_approvedby=actor if role in ("admin", "super") else None,
    )
    safe = safe_table1_details(obj, password_changed=bool(password))
    return obj, safe, bool(password)


@transaction.atomic
def update_admin(*, obj: models.Table1, name: str, city: str, phone: str, role: str, password: str) -> tuple[models.Table1, dict, bool]:
    ok, err = validate_payload(name or obj.name, city or obj.city, phone or obj.phone)
    if not ok:
        raise ValueError(err)

    new_role = (role or obj.role or "admin").strip().lower()
    valid_roles = {c[0] for c in models.Table1.ROLE_CHOICES}
    if new_role not in valid_roles:
        new_role = obj.role

    # Prevent display name collision if changed
    if name and name != obj.name and models.Table1.objects.filter(name=name).exists():
        raise ValueError("Username already exists.")

    obj.name = name or obj.name
    obj.city = city or obj.city
    obj.phone = phone or obj.phone
    obj.role = new_role

    password_changed = False
    if password:
        obj.password_hash = make_password(password)
        password_changed = True

    obj.save()
    safe = safe_table1_details(obj, password_changed=password_changed)
    return obj, safe, password_changed


@transaction.atomic
def pause_admin(*, obj: models.Table1) -> dict:
    obj.is_active = False
    obj.save(update_fields=["is_active", "updated_at"])
    return safe_table1_details(obj)
