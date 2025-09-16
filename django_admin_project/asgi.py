"""
ASGI config for django_admin_project.
Exposes the ASGI callable as a module-level variable named ``application``.
Adds Channels routing for WebSockets while preserving the HTTP ASGI app.
"""
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_admin_project.settings")

# Base Django ASGI application for traditional HTTP
django_asgi_app = get_asgi_application()

# Channels: route WebSocket connections to dashboard.routing
try:
    from channels.routing import ProtocolTypeRouter, URLRouter
    from channels.auth import AuthMiddlewareStack
    import apps.dashboard.routing as dashboard_routing

    application = ProtocolTypeRouter({
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(
            URLRouter(getattr(dashboard_routing, "websocket_urlpatterns", []))
        ),
    })
except Exception:
    # Fallback: if Channels isn't available, serve only HTTP
    application = django_asgi_app
