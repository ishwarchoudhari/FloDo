# Deployment

This guide outlines production deployment considerations for the Django Admin Dashboard (FloDo).

## Prerequisites

- Python 3.12+
- A production WSGI/ASGI server and reverse proxy
  - WSGI: gunicorn/uwsgi
  - ASGI: daphne/uvicorn (required if using Channels/WebSockets)
- Persistent storage for static and media files
- A real database (PostgreSQL recommended)

## Environment configuration

Set environment variables securely (systemd, Docker secrets, or a managed secrets store):

```bash
DJANGO_DEBUG=False
DJANGO_SECRET_KEY="<strong-secret>"
DJANGO_ALLOWED_HOSTS="example.com,www.example.com"
APP_TIMEZONE="UTC"
```

For Channels/Redis (optional):

```bash
REDIS_URL="redis://127.0.0.1:6379/0"
```

## Static and media files

- Run `python manage.py collectstatic` on build/deploy.
- Serve static files via WhiteNoise (enabled in project) or via the reverse proxy.
- Serve uploads (media) from a bucket/CDN in production if possible.

## Database

- Use PostgreSQL for production.
- Configure `DATABASES` in `django_admin_project/settings.py` via environment variables or a `.env` file loaded with `python-dotenv`.

## WSGI (gunicorn) example

```bash
gunicorn django_admin_project.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

## ASGI (daphne) example (for Channels/WebSockets)

```bash
daphne django_admin_project.asgi:application --port 8000 --bind 0.0.0.0
```

Use a reverse proxy (Nginx/Apache) to terminate TLS and forward to the app server.

## Security hardening checklist

- Enforce HTTPS; set HSTS headers.
- Secure cookies: `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`.
- Optionally add CSP and SRI for CDN assets.
- Validate file uploads (type/size limits) — already implemented for avatars.
- Run `python manage.py check --deploy`.

## Health and observability

- Structured logging with request IDs.
- Error tracking (e.g., Sentry) and monitoring.

## Release process (suggested)

1. Build and test
2. Apply migrations
3. Collect static
4. Reload app server

## GitHub Pages for docs

- Settings → Pages → Deploy from a branch → `main` → `/docs`.
- Docs published at: `https://<username>.github.io/<repo>/`.
