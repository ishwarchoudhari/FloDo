# Getting Started

This guide helps you set up and run the Django Admin Dashboard locally.

## Prerequisites

- Python 3.12+
- Windows PowerShell (examples below)
- SQLite (default) or Postgres (optional)

## Setup (Windows PowerShell)

1) Change into the project folder that contains `manage.py`:

```powershell
Set-Location .\django_admin_project
```

2) Create and activate a virtual environment:

```powershell
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
```

3) Install dependencies:

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

4) Migrate DB and collect static files:

```powershell
python manage.py migrate
python manage.py collectstatic --noinput
```

5) Start the server (choose one):

- Simple dev server

```powershell
python manage.py runserver 127.0.0.1:8000
```

- Daphne (ASGI) for WebSockets

```powershell
daphne django_admin_project.asgi:application --port 8000
```

6) Create the first Super Admin

- Visit `/signup/` in your browser and register the initial super-admin (only if none exists yet).

## Real-time Notifications (Channels)

- In-memory (default for local):

```powershell
$env:USE_INMEMORY_CHANNEL_LAYER = "1"
daphne django_admin_project.asgi:application --port 8000
```

- Redis-backed:

1. Ensure Redis is running (docker-compose or local)
2. Set `REDIS_URL` as needed (default is fine for `127.0.0.1:6379/0`)
3. Start Daphne as above

## Environment Variables

```powershell
$env:DJANGO_DEBUG = "True"
$env:DJANGO_SECRET_KEY = "dev-secret"     # change in production
$env:DJANGO_ALLOWED_HOSTS = "127.0.0.1,localhost"
```

## Email/SMTP for OTP (Optional but Recommended)

Configure SMTP to receive OTP emails (HTML + plain text) in production. For Gmail, use an App Password (not your normal password).

```powershell
$env:EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
$env:DEFAULT_FROM_EMAIL = "no-reply@example.com"   # or your Gmail address
$env:EMAIL_HOST = "smtp.gmail.com"
$env:EMAIL_PORT = "587"
$env:EMAIL_USE_TLS = "True"
$env:EMAIL_USE_SSL = "False"
$env:EMAIL_HOST_USER = "you@gmail.com"
$env:EMAIL_HOST_PASSWORD = "<GMAIL_APP_PASSWORD>"
$env:EMAIL_TIMEOUT = "10"
```

Quick test (PowerShell):

```powershell
python manage.py shell -c "from django.template.loader import render_to_string; from django.conf import settings; from django.core.mail import EmailMultiAlternatives; to=getattr(settings,'DEFAULT_FROM_EMAIL','no-reply@localhost'); ctx={'code':'123456','expiry_minutes':10,'app_name':getattr(settings,'APP_NAME','FloDo'),'login_url':'http://127.0.0.1:8000/Super-Admin/auth/login/'}; html=render_to_string('emails/otp_email.html',ctx); txt=render_to_string('emails/otp_email.txt',ctx); msg=EmailMultiAlternatives('FloDo OTP Test',txt,getattr(settings,'DEFAULT_FROM_EMAIL','no-reply@localhost'),[to]); msg.attach_alternative(html,'text/html'); print('Sent:', msg.send(fail_silently=False))"
```

## OTP UX (Forgot Password)

- OTP request starts a 10‑minute countdown (animated).
- Enter code in 6 split boxes (auto‑advance, backspace to previous, paste supported).
- Auto‑submit triggered when 6 digits are entered; incorrect codes show red ring + subtle shake.
- After verification, set a new password with confirm; the Reset button enables only when both match.

---

[![Docs](https://img.shields.io/badge/Docs-Site-blue)](https://ishwarchoudhari.github.io/FloDo/)
