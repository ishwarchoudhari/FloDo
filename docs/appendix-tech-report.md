# Appendix — Technical Report, Inventory, and ERD

This appendix consolidates the deep technical information moved out of the top‑level README to keep the README concise and product‑focused.

- Project structure (tree, inventories)
- Database tables and sample data
- ER diagrams (Mermaid)
- Technology stack details and dependencies
- Setup recap and validation commands
- Observations and suggestions

For quick start, API, architecture, and security topics, refer to:
- Getting Started: ./getting-started.md
- Architecture: ./architecture.md
- API Reference: ./api.md
- Security: ./security.md

---

## Technology Stack (Summary)

- Backend: Django 4.2.x, Pillow, python‑dotenv, WhiteNoise
- Frontend: Django Templates, Tailwind Utility CSS, Vanilla JS (Fetch)
- Realtime: ASGI/Daphne + Django Channels
- Data: SQLite (dev) / PostgreSQL‑ready
- Optional: Django REST Framework (present), Celery/Redis (listed, not configured)

See README and docs for details and commands.

---

## Project Structure (Abbreviated)

```text
django_admin_project/
├── manage.py
├── requirements.txt
├── django_admin_project/
│   ├── settings.py
│   ├── urls.py
│   └── asgi.py
├── apps/
│   ├── authentication/
│   ├── dashboard/
│   └── settings_app/
├── templates/
├── static/
└── media/
```

---

## Database Tables (List)

Default Django naming: `<app_label>_<model>`

1. authentication_superadmin  
2. authentication_adminprofile  
3. settings_app_appsettings  
4. dashboard_admin  
5. dashboard_user  
6. dashboard_verified_artist  
7. dashboard_payment  
8. dashboard_artist_service  
9. dashboard_artist_application  
10. dashboard_artist_availability  
11. dashboard_artist_calendar  
12. dashboard_booking  
13. dashboard_message  
14. dashboard_activitylog  

Note: Built‑in Django `auth_*` tables not listed here.

---

## ERD (Mermaid)

```mermaid
flowchart TD
  A[Client] -->|GET /login| B[Templates]
  A -->|POST /login (AJAX)| C[Auth Views]
  A -->|GET /dashboard| B
  A -->|/dashboard/api/*| D[Dashboard Views]
  A -->|/settings/*| E[Settings Views]
  D -->|JSON| A
  E -->|JSON/HTML| A
```

```mermaid
erDiagram
  User ||--|| SuperAdmin : one
  User ||--|| AdminProfile : one
  User ||--o{ ActivityLog : many
  User ||--o{ AppSettings : many
  BaseTable {
    int unique_id PK
    varchar name
    varchar city
    varchar phone
    datetime created_at
    datetime updated_at
  }
  Table1 }o--|| BaseTable : inherits
  Table2 }o--|| BaseTable : inherits
  ActivityLog {
    varchar table_name
    varchar action
    int row_id
    json row_details
    datetime timestamp
  }
```

---

## Setup Recap

- One‑command (Windows PowerShell):

```powershell
./bootstrap.ps1
```

- Manual:

```bash
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py makemigrations
python manage.py runserver
```

---

## API Endpoints (Summary)

- Authentication: `/signup/`, `/login/`, `/logout/`, `/auth-status/`
- Dashboard: `/dashboard/`, `/dashboard/api/table/<id>/`, `/dashboard/api/logs/`
- Settings: `/settings/`, profile/app POSTs, export, system info

See `docs/api.md` for full reference.

---

## Validation Commands

```bash
python -m pip check
python manage.py check --deploy
python manage.py collectstatic --noinput
```

---

## Notes

- Use CSRF tokens for all non‑GET requests (header or `csrfmiddlewaretoken` in body).
- For production, enable HTTPS, secure cookies, HSTS, and consider CSP.
- Static assets are served via WhiteNoise; ensure `collectstatic` on deploy.

---

[![Docs](https://img.shields.io/badge/Docs-Site-blue)](https://ishwarchoudhari.github.io/FloDo/)
