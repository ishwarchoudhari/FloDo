from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.dashboard import models
from apps.dashboard.services import admin_service


class AdminServiceTests(TestCase):
    def setUp(self):
        User = get_user_model()
        # actor used for role approvals in service
        self.actor = User.objects.create_user(username="actor", password="pass1234", is_superuser=True)

    def test_validate_payload(self):
        ok, err = admin_service.validate_payload("John Doe", "Pune", "9876543210")
        self.assertTrue(ok)
        self.assertEqual(err, "")

        ok, err = admin_service.validate_payload("", "Pune", "9876543210")
        self.assertFalse(ok)
        self.assertIn("required", err)

        ok, err = admin_service.validate_payload("John1", "Pune", "9876543210")
        self.assertFalse(ok)
        self.assertIn("Name", err)

        ok, err = admin_service.validate_payload("John", "Pune2", "9876543210")
        self.assertFalse(ok)
        self.assertIn("City", err)

        ok, err = admin_service.validate_payload("John", "Pune", "12345")
        self.assertFalse(ok)
        self.assertIn("Phone", err)

    def test_generate_unique_username_collision(self):
        # First create an admin that would consume the base username
        a1, _, _ = admin_service.create_admin(
            name="Jonathan", city="Pune", phone="9876543210", role="admin", password="p@ss", actor=self.actor
        )
        base = admin_service.build_base_username("Jonathan", "9876543210")
        self.assertEqual(a1.user_name, base)
        # Second should get a suffix appended
        a2, _, _ = admin_service.create_admin(
            name="Jonathan", city="Mumbai", phone="9876543210", role="admin", password="p@ss", actor=self.actor
        )
        self.assertTrue(a2.user_name.startswith(base))
        self.assertNotEqual(a1.user_name, a2.user_name)

    def test_role_enforcement_defaults(self):
        # Invalid role should fall back to 'admin'
        a, safe, _ = admin_service.create_admin(
            name="Alice", city="Delhi", phone="1112223333", role="invalid_role", password="", actor=self.actor
        )
        self.assertEqual(a.role, "admin")
        self.assertEqual(safe.get("role"), "admin")

    def test_password_hashing_and_flag(self):
        a, safe, changed = admin_service.create_admin(
            name="Bob", city="Pune", phone="2223334444", role="admin", password="secret", actor=self.actor
        )
        self.assertTrue(changed)
        self.assertTrue(a.password_hash)
        self.assertTrue(safe.get("password_changed"))
        # Update with new password sets flag
        a, safe, changed = admin_service.update_admin(
            obj=a, name=a.name, city=a.city, phone=a.phone, role=a.role, password="newsecret"
        )
        self.assertTrue(changed)
        self.assertTrue(safe.get("password_changed"))

    def test_safe_logging_details_no_password_hash(self):
        a, _, _ = admin_service.create_admin(
            name="Carol", city="Goa", phone="3334445555", role="admin", password="topsecret", actor=self.actor
        )
        safe = admin_service.safe_table1_details(a, password_changed=True)
        self.assertIn("id", safe)
        self.assertIn("name", safe)
        self.assertIn("user_name", safe)
        self.assertNotIn("password_hash", safe)

    def test_pause_admin(self):
        a, _, _ = admin_service.create_admin(
            name="Dave", city="Nashik", phone="4445556666", role="admin", password="", actor=self.actor
        )
        self.assertTrue(a.is_active)
        safe = admin_service.pause_admin(obj=a)
        a.refresh_from_db()
        self.assertFalse(a.is_active)
        self.assertEqual(safe.get("is_active"), False)
