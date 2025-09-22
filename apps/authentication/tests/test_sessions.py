from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from django.conf import settings


class SessionAndLogoutIntegrationTests(TestCase):
    """
    Production-grade, minimal integration tests covering:
    - Session stability after initial login/navigation
    - GET logout clearing session and denying subsequent admin access
    """

    def setUp(self):
        # Create a Super-Admin user (Django superuser) required by admin views
        self.username = "adminuser"
        self.password = "StrongPass!234"
        self.user = User.objects.create_user(
            username=self.username,
            email="admin@example.com",
            password=self.password,
            is_staff=True,
            is_superuser=True,
        )
        self.client = Client()
        self.login_url = reverse("authentication:login")  # /Super-Admin/auth/
        self.logout_url = reverse("authentication:logout")  # /Super-Admin/auth/logout/
        self.protected_url = reverse("dashboard:clients")  # /Super-Admin/clients/

    def _login(self):
        """Helper: perform login via the same form the app uses."""
        resp = self.client.post(self.login_url, {"username": self.username, "password": self.password})
        # Non-AJAX login redirects to LOGIN_REDIRECT_URL or ?next
        self.assertIn(resp.status_code, (302, 303))
        return resp

    def test_login_survives_first_navigation(self):
        """
        After a fresh login, the first navigation to a protected view should NOT
        log the user out. This guards against premature invalidation from
        server-boot session middleware.
        """
        self._login()
        # First navigation to a protected, super-admin-only view
        resp = self.client.get(self.protected_url, follow=False)
        # Assert view is accessible and user is still authenticated
        self.assertEqual(resp.status_code, 200, msg="Expected 200 OK on protected page after login")
        self.assertTrue(getattr(resp.wsgi_request.user, "is_authenticated", False), msg="User should remain authenticated")

    def test_get_logout_clears_session_and_denies_admin(self):
        """
        GET logout should clear the session and accessing protected routes
        afterwards should redirect to login.
        """
        self._login()
        # Perform GET logout (allowed and supported by the app)
        resp = self.client.get(self.logout_url, follow=False)
        self.assertIn(resp.status_code, (302, 303))
        # Should redirect to configured LOGOUT_REDIRECT_URL
        expected_logout_redirect = getattr(settings, "LOGOUT_REDIRECT_URL", "/Super-Admin/auth/login/")
        self.assertTrue(str(resp.url).startswith(expected_logout_redirect), msg="Logout should redirect to LOGOUT_REDIRECT_URL")

        # Now try to access a protected page -> expect redirect to login
        resp2 = self.client.get(self.protected_url, follow=False)
        self.assertIn(resp2.status_code, (302, 303))
        login_url = self.login_url  # reverse('authentication:login')
        self.assertTrue(str(resp2.url).startswith(login_url), msg="Should be redirected to login after logout")
