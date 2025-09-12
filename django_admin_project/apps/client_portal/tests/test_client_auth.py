from __future__ import annotations
from django.test import TestCase, Client as HttpClient, override_settings
from django.contrib.auth.models import User
from django.urls import reverse
from django.contrib.auth.hashers import make_password
from apps.dashboard.models import Client as ClientModel


class ClientAuthTests(TestCase):
    def setUp(self):
        self.http = HttpClient()

    def test_portal_auth_404_when_flag_off(self):
        resp = self.http.get(reverse('client_portal:client_login'))
        self.assertEqual(resp.status_code, 404)

    @override_settings(FEATURE_CLIENT_AUTH=True)
    def test_signup_login_logout_flow(self):
        # Signup
        resp = self.http.post(reverse('client_portal:client_signup'), {
            'full_name': 'John Doe',
            'phone': '+1234567890',
            'email': 'john@example.com',
            'password': 'Secret123!'
        }, follow=True)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(ClientModel.objects.filter(phone='+1234567890').exists())

        # Login
        resp = self.http.post(reverse('client_portal:client_login'), {
            'identifier': '+1234567890',
            'password': 'Secret123!'
        })
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp['Location'], reverse('client_portal:customer_dashboard'))
        # Session contains client_id
        session = self.http.session
        self.assertIn('client_id', session)

        # Logout
        resp = self.http.post(reverse('client_portal:client_logout'), follow=True)
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('client_id', self.http.session)

    @override_settings(FEATURE_CLIENT_AUTH=True)
    def test_client_cannot_access_admin(self):
        # Create a portal client
        ClientModel.objects.create(
            full_name='Jane', phone='+111', email=None,
            password=make_password('x'), status='Active'
        )
        # Try to access admin index (should redirect to admin login since not auth_user)
        resp = self.http.get('/admin/', follow=False)
        self.assertIn(resp.status_code, (302, 301))

    def test_admin_can_access_admin(self):
        # Create superuser
        admin = User.objects.create_superuser('root', 'root@example.com', 'pass')
        self.http.login(username='root', password='pass')
        resp = self.http.get('/admin/')
        self.assertEqual(resp.status_code, 200)
