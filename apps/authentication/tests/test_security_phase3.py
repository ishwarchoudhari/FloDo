import re
from django.test import TestCase, Client, override_settings
from django.contrib.auth.models import User
from django.urls import reverse

AUTH_PREFIX = "/Super-Admin/auth"

LOGIN_URL = f"{AUTH_PREFIX}/login/"
PROFILE_UPDATE_URL = f"{AUTH_PREFIX}/profile/update/"
PROFILE_AVATAR_URL = f"{AUTH_PREFIX}/profile/avatar/"
PROFILE_AVATAR_DELETE_URL = f"{AUTH_PREFIX}/profile/avatar/delete/"
PROFILE_PASSWORD_URL = f"{AUTH_PREFIX}/profile/password/"


@override_settings(DEBUG=False)
class CSRFSecurityTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username="admin", password="secret", is_staff=True, is_superuser=True)

    def _get_csrf(self):
        # Hitting login view ensures CSRF cookie is set due to @ensure_csrf_cookie
        self.client.get(LOGIN_URL)
        return self.client.cookies.get("csrftoken").value

    def _login_with_csrf(self):
        token = self._get_csrf()
        res = self.client.post(
            LOGIN_URL,
            {"username": "admin", "password": "secret", "next": f"{AUTH_PREFIX}/profile/"},
            HTTP_X_CSRFTOKEN=token,
        )
        # In AJAX mode login returns JSON; non-AJAX might redirect.
        self.assertIn(res.status_code, (200, 302))

    def test_profile_endpoints_require_csrf_in_prod(self):
        # Not logged in attempts should redirect to login (302). Use login first.
        self._login_with_csrf()
        # Missing CSRF -> 403
        resp = self.client.post(PROFILE_UPDATE_URL, {"display_name": "X"})
        self.assertEqual(resp.status_code, 403)
        resp = self.client.post(PROFILE_PASSWORD_URL, {"current_password": "secret", "new_password": "secret2"})
        self.assertEqual(resp.status_code, 403)
        resp = self.client.post(PROFILE_AVATAR_DELETE_URL, {})
        self.assertEqual(resp.status_code, 403)

    def test_profile_endpoints_succeed_with_csrf_in_prod(self):
        self._login_with_csrf()
        token = self._get_csrf()
        resp = self.client.post(PROFILE_UPDATE_URL, {"display_name": "X"}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.post(PROFILE_PASSWORD_URL, {"current_password": "secret", "new_password": "secret2"}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(resp.status_code, 200)
        # Swap back password so subsequent tests can reuse login if needed
        token2 = self._get_csrf()
        self.client.post(PROFILE_PASSWORD_URL, {"current_password": "secret2", "new_password": "secret"}, HTTP_X_CSRFTOKEN=token2)


@override_settings(DEBUG=False, FEATURE_SECURITY_HEADERS=True)
class SecurityHeadersTests(TestCase):
    def test_security_headers_present_when_flag_enabled(self):
        c = Client()
        res = c.get(LOGIN_URL)
        # Report-only CSP and core headers present
        self.assertIn("Content-Security-Policy-Report-Only", res.headers)
        self.assertEqual(res.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(res.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")


@override_settings(DEBUG=False, CSRF_COOKIE_HTTPONLY=True)
class AjaxWithHttpOnlyCookieTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username="admin", password="secret", is_staff=True, is_superuser=True)

    def test_ajax_flow_with_meta_and_header_csrf(self):
        # Login with CSRF header
        self.client.get(LOGIN_URL)
        token = self.client.cookies.get("csrftoken").value
        res = self.client.post(LOGIN_URL, {"username": "admin", "password": "secret"}, HTTP_X_CSRFTOKEN=token)
        self.assertIn(res.status_code, (200, 302))
        # Authenticated update with CSRF header works even when cookie is HttpOnly
        self.client.get(LOGIN_URL)  # refresh token to be safe
        token = self.client.cookies.get("csrftoken").value
        resp = self.client.post(PROFILE_UPDATE_URL, {"display_name": "Ajax"}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(resp.status_code, 200)
