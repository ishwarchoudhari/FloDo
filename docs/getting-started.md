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

---

[![Docs](https://img.shields.io/badge/Docs-Site-blue)](https://ishwarchoudhari.github.io/FloDo/)
