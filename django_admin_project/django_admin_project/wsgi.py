"""
WSGI config for django_admin_project.
This exposes the WSGI callable as a module-level variable named ``application``.
"""
import os  # OS utilities for environment variables
from django.core.wsgi import get_wsgi_application  # Django WSGI application factory

# Set the default settings module for the 'wsgi' command
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_admin_project.settings")

# Create the WSGI application object used by WSGI servers
application = get_wsgi_application()
