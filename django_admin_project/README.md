
# [Project Name] - Django Web Application

## 📖 Project Overview

[Comprehensive project description]

## 🚀 Quick Start Guide

### Prerequisites

- Python 3.12 (recommended)
- Windows PowerShell (for examples below)
- SQLite (default) or Postgres (optional)

### Installation Steps (Windows PowerShell)

1. Navigate to the project directory that contains `manage.py`:

   ```powershell
   Set-Location .\django_admin_project
   ```

2. Create and activate a virtual environment:

   ```powershell
   python -m venv .venv
   . .\.venv\Scripts\Activate.ps1
   ```

3. Install dependencies:

   ```powershell
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Apply database migrations and collect static files:

   ```powershell
   python manage.py migrate
   python manage.py collectstatic --noinput
   ```

5. (Optional) Create sample data or a super-admin via the UI:

   - Visit `/signup/` in the browser to create the initial super-admin if none exists.

6. Run the application (choose one):

   - Simple dev server:

     ```powershell
     python manage.py runserver 127.0.0.1:8000
     ```

   - Daphne (ASGI) for WebSockets support:

     ```powershell
     daphne django_admin_project.asgi:application --port 8000
     ```

### Real-time Notifications (WebSocket Channel Layer)

This project uses Django Channels for real-time notifications. You can run it in either mode:

- In-memory (single process, local dev):

  ```powershell
  $env:USE_INMEMORY_CHANNEL_LAYER = "1"
  daphne django_admin_project.asgi:application --port 8000
  ```

- Redis-backed (multi-process or containers):

  1) Ensure Redis is running (e.g., `docker-compose up redis`).
  2) Set `REDIS_URL` if needed (default is fine for local): `redis://127.0.0.1:6379/0`.
  3) Start Daphne as above.

### Environment Configuration

You can set the following environment variables (e.g., in PowerShell before starting the server):

```powershell
$env:DJANGO_DEBUG = "True"              # set to "False" for production
$env:DJANGO_SECRET_KEY = "dev-secret"   # set a strong secret in production
$env:DJANGO_ALLOWED_HOSTS = "127.0.0.1,localhost"
```

## 🏗️ Project Architecture

### Directory Structure

[Detailed explanation of folder organization]

### Key Components

- Models and database schema
- Views and URL routing
- Templates and static files
- Frontend components and styling

## 🔧 Development Workflow

### Running Tests

[Test execution instructions]

### Database Operations

[Migration and database management]

### Static Files Management

[CSS/JS compilation and optimization]

## 📱 Features & Functionality

[Comprehensive feature list with screenshots if needed]

## 🛡️ Security Considerations

[Security features and best practices implemented]

## 🚀 Deployment Guide

### Development Deployment

[Local development setup]

### Production Deployment

[Production deployment checklist and configuration]

## 🤝 Contributing Guidelines

[Code style, PR process, issue reporting]

## 📞 Support & Documentation

[Contact information and additional resources]

2.2 Updated requirements.txt

# Production Dependencies

Django==4.2.7
djangorestframework==3.14.0
Pillow==10.0.1
python-decouple==3.8
psycopg2-binary==2.9.7

# Development Dependencies (requirements-dev.txt)

pytest==7.4.3
pytest-django==4.5.2
black==23.9.1
flake8==6.1.0
coverage==7.3.2

# Optional Dependencies

redis==5.0.1
celery==5.3.4
django-cors-headers==4.3.1

Report 3: Issue Tracking & Resolution Guide

# Project Issues & Resolution Guide

## 🚨 Critical Issues Identified

### Issue #1: [Specific Problem]

- **Severity**: High/Medium/Low
- **Impact**: [Business/Technical impact description]
- **Root Cause**: [Technical explanation]
- **Recommended Solution**: [Step-by-step resolution]
- **Prevention**: [How to avoid in future]

## 🎯 UI/UX Improvements Identified

### Issue #1: [Layout/Design Problem]

- **Current Behavior**: [What's wrong now]
- **Expected Behavior**: [What should happen]
- **Files Affected**: [List of template/CSS files]
- **Solution Approach**: [Implementation strategy]

## 🔧 Performance Optimization Opportunities

### Optimization #1: [Performance Issue]

- **Current Performance**: [Metrics/measurements]
- **Target Performance**: [Goal metrics]
- **Implementation Strategy**: [Technical approach]
- **Expected Impact**: [Performance improvement estimate]

## 📋 Maintenance Checklist

- [ ] Update dependencies to latest stable versions
- [ ] Implement missing security headers
- [ ] Optimize database queries
- [ ] Add comprehensive error handling
- [ ] Improve test coverage
- [ ] Update documentation

🎯 SUCCESS CRITERIA & QUALITY STANDARDS
Analysis Depth Requirements
Comprehensive Coverage: Every major component must be analyzed
Actionable Insights: All findings must include specific resolution steps
Risk Prioritization: Issues must be categorized by severity and business impact
Best Practices Alignment: Recommendations must follow industry standards
Documentation Quality Standards
Professional Formatting: Use proper markdown, headers, and structure
Technical Accuracy: All technical information must be precise and current
User-Friendly Language: Balance technical depth with accessibility
Visual Organization: Use tables, lists, and diagrams where appropriate
Deliverable Completeness Checklist
[ ] Executive summary with overall project health score
[ ] Detailed analysis of all 7 major areas
[ ] Prioritized recommendation list with implementation timelines
[ ] Updated README.md with comprehensive project documentation
[ ] Current requirements.txt reflecting actual dependencies
[ ] Issue tracking document with specific resolution steps
[ ] Security assessment with vulnerability mitigation strategies
[ ] Performance optimization roadmap

⚡ EXECUTION METHODOLOGY
Discovery Phase (25% of effort)
Explore project structure and understand architecture
Identify all components, dependencies, and integrations
Map user workflows and functionality

Analysis Phase (50% of effort)
Deep dive into each component area
Test functionality and identify issues
Assess security, performance, and maintainability

Documentation Phase (25% of effort)
Compile findings into professional reports
Create actionable recommendations
Update project documentation and requirements

Expected Timeline: Thorough analysis suitable for enterprise-grade assessment standards, focusing on delivering maximum value through strategic insights and practical implementation guidance.
Remember: Your analysis will be used for critical project decisions, funding discussions, and technical roadmap planning. Maintain the highest standards of professionalism and technical accuracy.

---

# Django Admin Dashboard Project

A production-ready Django 5.x application featuring:

- Single super-admin authentication (AJAX-based login/signup)
- 10 dynamic CRUD tables with real-time updates via Fetch/AJAX
- Activity logs for all CRUD operations via signals
- Settings page (profile, app settings, system info, export CSV/JSON)
- TailwindCSS responsive UI, WhiteNoise static serving

## Technology Stack Report (2025-09-01)

This section documents the concrete technology stack detected across the codebase with file-level citations and version pins from `requirements.txt`. It also confirms usage of AJAX, Vanilla JS, jQuery, HTMX, and highlights redundancies and improvement opportunities.

### Backend (Django + Libraries)

- **Django 4.2.7** — core framework

  - File: `django_admin_project/settings.py`
  - Installed apps: `django.contrib.*`, `apps.authentication`, `apps.dashboard`, `apps.settings_app` (settings.py lines 27–39)
  - Views: function-based views returning HTML and JSON (`apps/authentication/views.py`, `apps/settings_app/views.py`, dashboard views)
  - Templates: Django Templates with app dirs and a custom context processor `apps.settings_app.context_processors.app_settings` (settings.py lines 58–74, esp. line 70)
  - ORM: used throughout; e.g., `settings_app/views.py:81–101` for export queries; no raw SQL detected
  - Forms: `apps.authentication.forms` (SignupForm, LoginForm) and `apps.settings_app.forms` (ProfileForm, AppSettingsForm)
  - Middleware:
    - Core Django middleware
    - **WhiteNoise 6.7.0** for static files (`whitenoise.middleware.WhiteNoiseMiddleware`, settings.py line 44)
    - Custom: `apps.authentication.middleware.ServerRestartSessionInvalidateMiddleware` (settings.py line 52) leveraging `SERVER_BOOT_ID` (settings.py lines 130–133)
  - Security: CSRF enabled; auth decorators; password validators (settings.py lines 87–93); production hardening when `DEBUG=False` (settings.py lines 134–147)
  - Static/Media: `STATICFILES_DIRS`, `STATIC_ROOT`, `MEDIA_ROOT`; WhiteNoise Compressed Manifest storage (settings.py lines 101–111, 106–108)

- **python-dotenv 1.0.1** — env loading (settings.py line 9, 11–13)
- **Pillow 10.0.1** — image handling for avatars (used by profile avatar upload in `apps/authentication/views.py:168–176`)

Optional in requirements (not actively configured/used in code at audit time):

- **djangorestframework 3.14.0** — present in `requirements.txt` but not in `INSTALLED_APPS` or imports
- **celery 5.3.4**, **redis 5.0.1**, **django-cors-headers 4.3.1** — listed but not configured

### Frontend (JS/CSS/Rendering)

- **Vanilla JavaScript** — primary client layer
  - `static/js/common.js`: CSRF helpers, dropdowns, notifications, logout handler
  - `static/js/auth.js`: AJAX login/signup flows with UI states
  - `static/js/dashboard.js`: table CRUD, debounce search, auto-refresh, logs
  - `static/js/notifications.js`: toast/notification utilities
- **AJAX via Fetch API** — confirmed
  - Detected in `templates/base.html`, `static/js/auth.js`, `static/js/dashboard.js`, `templates/settings/index.html` (e.g., `fetch('/login/')`, `fetch('/dashboard/api/...')`, `fetch("{% url 'settings_app:system_info' %}")`)
- **jQuery** — not used by the project UI; only present within Django admin’s collected static under `staticfiles/admin/js/vendor/jquery/*`
  {{ ... }}

1. **Database: SQLite**

- Version: SQLite via Python stdlib
- Files: `django_admin_project/settings.py` (`ENGINE='django.db.backends.sqlite3'`), `db.sqlite3`

1. **jQuery**

- Version: present only in Django admin vendor assets; not used by app
- Files: `staticfiles/admin/js/vendor/jquery/*` (collected static)

1. **HTMX**

- Usage: Not detected
- Files: N/A

## List of Technologies Used (versions + file references)

1. **Python**

- Version: use local Python 3.x (not pinned in repo)
- Files: `manage.py`, `django_admin_project/`, `apps/*`

1. **Django**

- Version: 4.2.7 (`requirements.txt`)
- Files: `django_admin_project/settings.py`, `django_admin_project/urls.py`, `apps/*/views.py`, `templates/*`

1. **Django ORM**

- Version: bundled with Django 4.2.7
- Files: `apps/dashboard/views.py` (CRUD), `apps/settings_app/views.py` (exports), `apps/*/models.py`

1. **Django Templates**

- Version: bundled with Django 4.2.7
- Files: `templates/base.html`, `templates/auth/*`, `templates/dashboard/*`, `templates/settings/*`, `templates/partials/*`

1. **Django Forms**

- Version: bundled with Django 4.2.7
- Files: `apps/authentication/forms.py`, `apps/settings_app/forms.py`

1. **Middleware**

- Version: Django core; WhiteNoise 6.7.0
- Files: `django_admin_project/settings.py` (MIDDLEWARE), `apps/authentication/middleware.py`

1. **Signals**

- Version: Django signals (core)
- Files: `apps/dashboard/signals.py`

1. **WhiteNoise**

- Version: 6.7.0 (`requirements.txt`)
- Files: `django_admin_project/settings.py` (middleware + storage)

1. **python-dotenv**

- Version: 1.0.1 (`requirements.txt`)
- Files: `django_admin_project/settings.py` (`load_dotenv()`)

1. **Pillow**

- Version: 10.0.1 (`requirements.txt`)
- Files: avatar processing in `apps/authentication/views.py`

1. **psycopg2-binary** (optional)

- Version: 2.9.9
- Files: `requirements.txt` only (driver for Postgres if enabled)

1. **Django REST Framework** (optional)

- Version: 3.14.0
- Files: `requirements.txt` only (not in `INSTALLED_APPS`)

1. **Celery** (optional)

- Version: 5.3.4
- Files: `requirements.txt` only (not configured)

1. **redis (client)** (optional)

- Version: 5.0.1
- Files: `requirements.txt` only (not configured)

1. **django-cors-headers** (optional)

- Version: 4.3.1
- Files: `requirements.txt` only (not configured)

1. **Vanilla JavaScript**

- Version: N/A (browser-native)
- Files: `static/js/common.js`, `static/js/auth.js`, `static/js/dashboard.js`, `static/js/notifications.js`, inline scripts in `templates/*`

1. **AJAX (Fetch API)**

- Version: N/A (browser-native)
- Files: `static/js/auth.js`, `static/js/dashboard.js`, `templates/base.html`, `templates/settings/index.html`

1. **Tailwind CSS**

- Version: via CDN (no local build observed)
  - Files: `templates/base.html` include; utility classes across `templates/*`

1. **Custom CSS**

- Version: N/A
- Files: `static/css/login.css`

1. **Database: SQLite**

- Version: SQLite via Python stdlib
- Files: `django_admin_project/settings.py` (`ENGINE='django.db.backends.sqlite3'`), `db.sqlite3`

1. **jQuery**

- Version: present only in Django admin vendor assets; not used by app UI
- Files: `staticfiles/admin/js/vendor/jquery/*` (collected static)

1. **HTMX**

- Usage: Not detected
- Files: N/A

## Project Structure

```text
django_admin_project/
├── manage.py
├── requirements.txt
├── bootstrap.ps1
├── fixtures/
│   └── sample_data.json
├── django_admin_project/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
├── apps/
│   ├── authentication/
│   ├── dashboard/
│   └── settings_app/
├── static/
│   ├── css/
│   ├── js/
│   └── images/
├── templates/
│   ├── base.html
│   ├── auth/
│   ├── dashboard/
│   └── settings/
└── media/
```

## Database Tables

The following database tables are created by Django for this project’s first‑party apps (default Django table naming: `<app_label>_<model>`). Only table names are listed below.

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

Note: Built‑in Django auth tables (e.g., auth_user) are not included here. This list reflects the project's app models and includes the ActivityLog table.

## One‑Command Setup (Windows PowerShell)

From `django_admin_project/` run:

```bash
./bootstrap.ps1
```

This will:

- Create a `.venv`
- Install dependencies
- Apply migrations
- Collect static files
- Start the dev server on <http://127.0.0.1:8000>

Then:

- Visit <http://127.0.0.1:8000/signup/> to register the ONLY super-admin account
- Log in and go to <http://127.0.0.1:8000/dashboard/>

## Manual Setup

```bash
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py makemigrations
python manage.py runserver
```

## Environments

- `.env` (optional) in project root supports:
  - `DJANGO_SECRET_KEY`
  - `DJANGO_DEBUG` (True/False)
  - `DJANGO_ALLOWED_HOSTS` (comma-separated)
  - `APP_TIMEZONE` (e.g., UTC)

## API Endpoints

Authentication (`apps/authentication/urls.py`):

- `POST /signup/` — create super-admin (only if none exists)
- `POST /login/` — login with username/password
- `POST /logout/` — logout (AJAX)
- `GET  /auth-status/` — `{ authenticated: boolean }`

Dashboard (`apps/dashboard/urls.py`):

- `GET  /dashboard/` — dashboard page
- `GET  /dashboard/api/table/<table_id>/` — list with `page`, `per_page`, `q`
- `POST /dashboard/api/table/<table_id>/row/` — create row
- `PUT  /dashboard/api/table/<table_id>/row/<row_id>/` — update row
- `DELETE /dashboard/api/table/<table_id>/row/<row_id>/` — delete row
- `POST /dashboard/api/table/config/` — update labels (session-based demo)
- `GET  /dashboard/api/logs/` — paginated activity logs

### Method override (PUT/DELETE via POST)

For compatibility with browsers and CSRF/form parsing, the frontend uses POST requests with a `_method` override for updates and deletes. The server accepts both true `PUT`/`DELETE` and `POST` with `_method=PUT|DELETE`.

Example using form data (recommended for CSRF):

```bash
POST /dashboard/api/table/1/row/123/
X-CSRFToken: <token>

_method=PUT
name=New Name
city=New City
phone=1234567890
```

To delete:

```bash
POST /dashboard/api/table/1/row/123/
X-CSRFToken: <token>

_method=DELETE
```

Settings (`apps/settings_app/urls.py`):

- `GET  /settings/` — settings home
- `POST /settings/profile/` — update username/email/password
- `POST /settings/app/` — update app settings
- `GET  /settings/export/<fmt>/<table_id>/` — export table as CSV/JSON
- `GET  /settings/system-info/` — Django version, DB size, total records

## Security

- CSRF protection enabled globally; Fetch includes `X-CSRFToken`
- Session-based rate limiting on signup/login (basic, per-session)
- Django auth validators enabled (min length 8, etc.)
- Production hardening active when `DJANGO_DEBUG=False` (secure cookies, HSTS, SSL redirect opt-in)

## Notes

- Activity logging is implemented via signals in `apps/dashboard/signals.py`. Lacking request context, the logger attributes actions to the first superuser when available (demo-friendly). For full attribution, wire a custom middleware to pass `request.user` into signals.
- TailwindCSS is included via CDN for simplicity.

## Testing (suggested commands)

```bash
python manage.py test
```

Add tests covering:

- Authentication flows (signup/login/logout)
- CRUD endpoints for a couple of tables
- Settings updates and exports

## Sample Data

A `fixtures/sample_data.json` is provided with placeholder data across the 10 tables. Load after migrations if desired:

```bash
python manage.py loaddata fixtures/sample_data.json
```

You should still create the actual super-admin via `/signup/` to enforce the single-account rule.

## Deployment

- Set `DJANGO_DEBUG=False` and define `DJANGO_ALLOWED_HOSTS`
- Run `collectstatic`
- Serve via WSGI (e.g., gunicorn/uwsgi + reverse proxy)
- WhiteNoise configured for static file serving
- Configure `DJANGO_LOG_FILE` for file logging if desired

---

## Addendum: Glassmorphism Login UI (CSS-only)

- The login page has a glassmorphism style implemented with pure CSS.
- Stylesheet: `django_admin_project/static/css/login.css`
- Template: `django_admin_project/templates/auth/login.html`
- Minimal markup additions only:
  - Wrapper with classes: `gradient-border login-card`
  - Inner container class: `glass-card`
- Effects:
  - Translucent blurred panel (backdrop-filter)
  - Animated gradient border
  - Subtle animated background blobs
  - Gradient pill button, refined inputs, responsive layout

Accessibility and responsiveness were considered; hover/focus states and contrast were tuned. No backend or JS changes are required.

## Production Configuration Checklist

- **Security**
  - DEBUG=False; set `ALLOWED_HOSTS`
  - Secure cookies, HSTS, SSL redirect behind proxy
  - Add CSP and SRI for CDN assets (Tailwind)
  - Validate uploads (type/size) for profile avatars
- **Performance**
  - Configure `CACHES` (e.g., Redis) and enable per-view caching for read-heavy APIs
  - Use Postgres with `CONN_MAX_AGE` for pooling
  - Minify and hash static assets (WhiteNoise already configured)
- **Observability**
  - Structured logging, request IDs, error tracking (e.g., Sentry)
- **Data**
  - Backups and restore runbooks; `loaddata` for fixtures

## Diagrams (Mermaid)

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

## Notes on Dependencies

- A plain-text, installable requirements block has been appended to `requirements.txt` without removing any existing content.
- For development, consider a separate `requirements-dev.txt` with pytest/black/flake8.

## Quick Validation Commands

```bash
python -m pip check
python manage.py check --deploy
python manage.py collectstatic --noinput
```

---

# Auditor's Report (2025-09-01)

This section consolidates a precise, code-verified view of the repository: structure, technologies, dependencies, setup, and observations. It complements existing README content and can be used as a handoff for developers and reviewers.

## Project Structure (full tree)

```text
django_admin_project/
├── README.md
├── requirements.txt
├── manage.py
├── bootstrap.ps1
├── db.sqlite3
├── django.log
├── server.out
├── server.out.log
├── server.err
├── server.err.log
├── optionA.log
├── backups/
│   └── db-backup-20250831-1638.sqlite3
├── fixtures/
│   └── sample_data.json
├── media/
│   └── avatars/
├── static/
│   ├── css/
│   ├── js/
│   └── images/
├── staticfiles/               # collectstatic output
│   ├── admin/                  # Django admin assets (includes jQuery)
│   ├── css/
│   ├── js/
│   └── staticfiles.json
├── templates/
│   ├── base.html
│   ├── 404.html
│   ├── 500.html
│   ├── auth/
│   ├── dashboard/
│   ├── partials/
│   ├── profile/
│   └── settings/
├── apps/
│   ├── __init__.py
│   ├── authentication/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── constants.py
│   │   ├── forms.py
│   │   ├── middleware.py
│   │   ├── models.py
│   │   ├── urls.py
│   │   ├── views.py
│   │   └── migrations/
│   │       ├── 0001_initial.py
│   │       ├── 0002_adminprofile.py
│   │       └── __init__.py
│   ├── dashboard/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── signals.py
│   │   ├── urls.py
│   │   ├── views.py
│   │   └── migrations/
│   │       ├── 0001_initial.py
│   │       └── __init__.py
│   └── settings_app/
│       ├── __init__.py
│       ├── admin.py
│       ├── apps.py
│       ├── context_processors.py
│       ├── forms.py
│       ├── models.py
│       ├── urls.py
│       ├── views.py
│       └── migrations/
│           └── __init__.py
└── django_admin_project/
    ├── __init__.py
    ├── asgi.py
    ├── settings.py
    ├── urls.py
    └── wsgi.py
```

## Tech Stack

- **Backend**: Django 4.2.7 (`django_admin_project/settings.py`)
  - ORM, templates, forms, middleware (incl. custom `ServerRestartSessionInvalidateMiddleware`)
  - Static serving via WhiteNoise (`whitenoise.middleware.WhiteNoiseMiddleware`)
- **Frontend**: HTML (Django Templates), Tailwind utility classes, Vanilla JS (`static/js/*`)
- **AJAX**: Fetch API calls detected in `templates/base.html`, `static/js/auth.js`, `static/js/dashboard.js`, `templates/settings/index.html`
- **jQuery**: Only in Django admin vendor assets under `staticfiles/admin/`; keep separation to avoid confusion.
- **HTMX**: Not detected across templates or JS
- **Media/Static**: `STATICFILES_DIRS`, `STATIC_ROOT`, `MEDIA_ROOT`; WhiteNoise Compressed Manifest storage (settings.py lines 101–111, 106–108)

## Dependencies

From `requirements.txt`:

```text
Django==4.2.7
python-dotenv==1.0.1
whitenoise==6.7.0
Pillow==10.0.1
psycopg2-binary==2.9.9
djangorestframework==3.14.0
celery==5.3.4
redis==5.0.1
django-cors-headers==4.3.1
pytest==7.4.3
pytest-django==4.5.2
black==23.9.1
flake8==6.1.0
coverage==7.3.2
```

- **Detected but not enabled**: DRF (not in `INSTALLED_APPS`), Celery/Redis (no config present)
- **Unlisted runtime deps**: None detected beyond stdlib

## Setup Recap

Development quick start (PowerShell):

```powershell
./bootstrap.ps1
```

Manual steps:

```bash
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py makemigrations
python manage.py runserver
```

## Observations & Suggestions

- **DRF present, not enabled**: Either remove from production requirements or enable with serializers/viewsets if planning API expansion.
- **Admin jQuery vs. App UI**: jQuery appears only under `staticfiles/admin/`; keep separation to avoid confusion.
- **Security headers**: Consider CSP and SRI for CDN assets (Tailwind) in production.
- **Static asset completeness**: Favicon referenced in templates may be missing under `static/images/`.
- **JS DOM safety**: Prefer `textContent` over `innerHTML` for dynamic content to reduce XSS risk.
- **Documentation lint**: Ensure code fences specify a language (MD040) and lists have blank lines around them (MD032). The above sections adhere to this.

---

## 📦 Applications in this Django Project

This section documents the first‑party Django applications located under `apps/`. For each app, you’ll find the purpose, core files, interconnections, and supported operations.

### 1) authentication (`apps/authentication/`)

- **Purpose**

  - Handles initial super‑admin creation, login/logout, lightweight auth status check, and Admin profile management (including avatar and password change).

- **Core Files**

  - `models.py` → `SuperAdmin` (1:1 `User`), `AdminProfile` (avatar, profile info, social links)
  - `views.py` → `signup_view`, `login_view`, `logout_view`, `check_auth_status`, `profile_view`, `profile_update`, `profile_avatar_upload`, `profile_avatar_delete`, `profile_password_change`
  - `urls.py` → routes for login/signup/logout, auth status, and profile AJAX endpoints
  - `forms.py` → `SignupForm`, `LoginForm`
  - `admin.py` → Admin config for `AdminProfile` (thumbnail, JSON field editing)
  - `middleware.py` → `ServerRestartSessionInvalidateMiddleware` (session invalidation on server restart)

- **Interconnections**

  - Project URLs route `"/"` to `authentication:login` (`django_admin_project/urls.py`).
  - Profile and auth status endpoints are consumed by templates and JS across the site (`templates/auth/*`, `static/js/auth.js`, `templates/base.html`).
  - Middleware is registered in `django_admin_project/settings.py` to harden sessions across restarts.

- **Features & Operations**
  - Account flows: super‑admin bootstrap (`signup_view` only when none exists), login/logout, auth status JSON.
  - Profile: view partial, update fields and social links, upload/delete avatar, change password (keeps session alive on success).
  - Security: basic per‑IP/session rate‑limiting for signup/login.

---

### 2) dashboard (`apps/dashboard/`)

- **Purpose**

  - Provides the admin dashboard UI and CRUD APIs for 10 demo tables (`Table1`–`Table10`) plus an `ActivityLog` of changes.

- **Core Files**

  - `models.py` → `BaseTable` mixin; `Table1`–`Table10` with concrete `db_table` names; `ActivityLog`
  - `views.py` → `dashboard_view` (overview), `tables_view` (full/partial), `get_table_data` (pagination + search), `table_crud_api` (create/update/delete with `_method` support), `update_table_config`, `get_logs`
  - `urls.py` → routes for index, tables page, table APIs, logs, and config
  - `signals.py` → post‑save/delete signals to append to `ActivityLog`
  - `admin.py` → registers all 10 tables and `ActivityLog`

- **Interconnections**

  - Imports `AppSettings` from `apps.settings_app.models` to apply per‑page pagination preferences.
  - CRUD actions log to `ActivityLog`; signals also capture model changes not going through the API.
  - Templates (`templates/dashboard/*`) and JS (`static/js/dashboard.js`) power the UI with Fetch‑based AJAX.

- **Features & Operations**
  - Dashboard overview with recent logs and per‑table counts; humanized table labels derived from DB table names.
  - CRUD over AJAX for all demo tables with validation and pagination; method override via `_method`.
  - Config updates stored in session to rename labels (demo scope).
  - Logs API to fetch paginated activity entries.

---

### 3) settings_app (`apps/settings_app/`)

- **Purpose**

  - Manages application‑level preferences and user profile updates from the settings area; provides exports and system information.

- **Core Files**

  - `models.py` → `AppSettings` (app name, timezone, records per page, notifications, updated_by)
  - `views.py` → `settings_home`, `profile_update`, `app_update`, `export_table` (CSV/JSON), `system_info`
  - `urls.py` → routes for index, profile/app updates, export, and system info
  - `forms.py` → `ProfileForm` (username/email + optional password), `AppSettingsForm`
  - `context_processors.py` → exposes `APP_NAME` and `APP_RECORDS_PER_PAGE` to templates

- **Interconnections**

  - Uses `apps.dashboard.models` for table exports and total record counts.
  - `settings_home` shows database config (redacts absolute SQLite path) and latest `AppSettings`.
  - Context processor integrated via Django settings to surface app settings globally.

- **Features & Operations**
  - Update user profile (and password) with session‑preserving re‑authentication.
  - Update app‑level settings (name, timezone, pagination, notifications).
  - Export any demo table as CSV/JSON; system information endpoint with Django version, DB size, total records, and logs count.

---

# Comprehensive Project Analysis & Documentation (2025-09-03)

This section consolidates a full, analysis-only documentation of the Django project, following the specified methodology. No source files were modified; only this README was updated.

## Project Overview

Single-super-admin Django application with AJAX-driven dashboard, 10 demo CRUD tables, activity logging, and a settings area (profile/app settings/exports/system info). Static served by WhiteNoise, Tailwind via CDN, strict CSP with nonce.

## Technology Stack

- Django Version: 4.2.7
- Python Version: 3.x (not pinned in repo)
- Database: SQLite (default). Optional Postgres via env (driver present but not configured)
- Frontend Technologies: Django Templates, TailwindCSS via CDN, Vanilla JS (Fetch API)
- Additional Dependencies: python-dotenv, WhiteNoise, Pillow. Optional: DRF, Celery, redis, django-cors-headers

## Project Structure

Note: Sizes shown where available from workspace listing. Last modified timestamps were not available in this environment.

```text
django_admin_project/  [project root]
├── .coverage (53 KB)
├── .env.example (710 B)
├── .git/
├── .pytest_cache/
├── .venv/
├── README.md (≈37 KB)
├── backups/
│   └── db-backup-20250831-1638.sqlite3 (420 KB)
├── bootstrap.ps1 (1.5 KB)
├── db.sqlite3 (420 KB)
├── django.log (17.6 KB)
├── django_admin_project/
│   ├── __init__.py (94 B)
│   ├── asgi.py (302 B)
│   ├── settings.py (6.4 KB)
│   ├── urls.py (1.4 KB)
│   └── wsgi.py (499 B)
├── fixtures/
│   └── sample_data.json (10.4 KB)
├── htmlcov/
├── manage.py (1.2 KB)
├── media/
│   └── avatars/
├── node_modules/
├── package-lock.json (8.5 KB)
├── package.json (117 B)
├── pytest.ini (92 B)
├── requirements.txt (856 B)
├── static/
│   ├── css/
│   │   ├── .gitkeep (0 B)
│   │   └── login.css (4.1 KB)
│   ├── images/
│   │   └── .gitkeep (0 B)
│   └── js/
│       ├── auth.js (4.8 KB)
│       ├── common.js (6.1 KB)
│       ├── dashboard.js (29.2 KB)
│       └── notifications.js (18.3 KB)
├── staticfiles/  [collectstatic output]
│   ├── admin/ (Django admin vendor assets)
│   ├── css/ (...)
│   ├── js/ (...)
│   └── staticfiles.json (10.4 KB)
├── templates/
│   ├── 404.html (694 B)
│   ├── 500.html (681 B)
│   ├── auth/
│   │   ├── login.html (2.7 KB)
│   │   └── signup.html (3.5 KB)
│   ├── base.html (34.2 KB)
│   ├── dashboard/
│   │   ├── index.html (4.8 KB)
│   │   ├── tables_full.html (391 B)
│   │   └── tables_partial.html (6.5 KB)
│   ├── partials/
│   │   ├── _footer.html (238 B)
│   │   ├── _header.html (4.4 KB)
│   │   └── sidebar.html (8.2 KB)
│   ├── profile/
│   │   └── admin_profile.html (9.1 KB)
│   └── settings/
│       └── index.html (6.3 KB)
├── tests/
│   ├── __pycache__/
│   ├── test_auth.py (1.4 KB)
│   └── test_dashboard.py (0.9 KB)
└── apps/
    ├── __init__.py (22 B)
    ├── authentication/
    │   ├── __init__.py (29 B)
    │   ├── admin.py (2.4 KB)
    │   ├── apps.py (201 B)
    │   ├── constants.py (359 B)
    │   ├── forms.py (701 B)
    │   ├── middleware.py (1.9 KB)
    │   ├── migrations/ (6 items)
    │   ├── models.py (1.7 KB)
    │   ├── urls.py (1.0 KB)
    │   └── views.py (9.0 KB)
    ├── dashboard/
    │   ├── __init__.py (24 B)
    │   ├── admin.py (433 B)
    │   ├── apps.py (503 B)
    │   ├── migrations/ (6 items)
    │   ├── models.py (2.4 KB)
    │   ├── signals.py (1.6 KB)
    │   ├── urls.py (601 B)
    │   └── views.py (13.7 KB)
    ├── security/
    │   └── __init__.py (61 B)
    └── settings_app/
        ├── __init__.py (23 B)
        ├── apps.py (190 B)
        ├── context_processors.py (465 B)
        ├── forms.py (463 B)
        ├── migrations/ (4 items)
        ├── models.py (557 B)
        ├── urls.py (404 B)
        └── views.py (4.4 KB)
```

## Database Schema

### Models Overview

| Model Name   | App            | Table Name                     | Purpose                                   | Key Relationships |
|--------------|----------------|--------------------------------|-------------------------------------------|-------------------|
| SuperAdmin   | authentication | authentication_superadmin      | Marks the single super-admin profile      | 1:1 User          |
| AdminProfile | authentication | authentication_adminprofile    | Admin profile incl. avatar/social links   | 1:1 User          |
| AppSettings  | settings_app   | settings_app_appsettings       | App-level settings                        | FK User(updated_by)|
| Table1       | dashboard      | dashboard_admin                | Demo CRUD table                           | —                 |
| Table2       | dashboard      | dashboard_user                 | Demo CRUD table                           | —                 |
| Table3       | dashboard      | dashboard_verified_artist      | Demo CRUD table                           | —                 |
| Table4       | dashboard      | dashboard_payment              | Demo CRUD table                           | —                 |
| Table5       | dashboard      | dashboard_artist_service       | Demo CRUD table                           | —                 |
| Table6       | dashboard      | dashboard_artist_application   | Demo CRUD table                           | —                 |
| Table7       | dashboard      | dashboard_artist_availability  | Demo CRUD table                           | —                 |
| Table8       | dashboard      | dashboard_artist_calendar      | Demo CRUD table                           | —                 |
| Table9       | dashboard      | dashboard_booking              | Demo CRUD table                           | —                 |
| Table10      | dashboard      | dashboard_message              | Demo CRUD table                           | —                 |
| ActivityLog  | dashboard      | dashboard_activitylog          | Audit log of CRUD operations              | FK User(admin_user)|

### Detailed Model Documentation

#### SuperAdmin
**File:** `apps/authentication/models.py`
**Database Table:** `authentication_superadmin`
**Purpose:** 1:1 marker of the single super-admin user and metadata.

**Fields:**
| Field Name     | Type                   | Constraints                 | Description |
|----------------|------------------------|-----------------------------|-------------|
| user           | OneToOneField(User)    | on_delete=CASCADE, unique   | Link to `auth_user` |
| is_super_admin | BooleanField           | default=True                | Marker flag |
| created_at     | DateTimeField          | auto_now_add=True           | Created timestamp |
| last_login_ip  | GenericIPAddressField  | null=True, blank=True       | Last login IP |

**Relationships:**
- Foreign Keys: to `auth.User` (1:1)
- Reverse relationships: `user.super_admin_profile`

#### AdminProfile
**File:** `apps/authentication/models.py`
**Database Table:** `authentication_adminprofile`
**Purpose:** Profile info and avatar for admin user.

**Fields:**
| Field Name   | Type            | Constraints                 | Description |
|--------------|-----------------|-----------------------------|-------------|
| user         | OneToOneField   | on_delete=CASCADE, unique   | Link to `auth_user` |
| avatar       | ImageField      | upload_to="avatars/"        | Optional avatar |
| display_name | CharField(150)  | blank=True, default=""      | Display name |
| role         | CharField(100)  | blank=True, default="Admin" | Role |
| bio          | TextField       | blank=True, default=""      | Bio |
| location     | CharField(120)  | blank=True, default=""      | Location |
| birth_date   | DateField       | null=True, blank=True        | DOB |
| phone        | CharField(32)   | blank=True, default=""      | Phone with country code |
| status       | CharField(20)   | blank=True, default="online"| Presence |
| last_sign_in | DateTimeField   | null=True, blank=True        | Last sign-in |
| social_links | JSONField       | default=dict, blank=True     | Social links map |
| created_at   | DateTimeField   | auto_now_add=True            | Created |
| updated_at   | DateTimeField   | auto_now=True                | Updated |

**Relationships:** 1:1 `auth.User` (reverse: `user.admin_profile`)

#### AppSettings
**File:** `apps/settings_app/models.py`
**Database Table:** `settings_app_appsettings`
**Purpose:** Application-wide settings and preferences.

**Fields:**
| Field Name           | Type            | Constraints        | Description |
|----------------------|-----------------|--------------------|-------------|
| app_name             | CharField(100)  | default="Admin Dashboard" | App name |
| timezone             | CharField(50)   | default="UTC"     | Timezone |
| records_per_page     | IntegerField    | default=10         | Pagination size |
| enable_notifications | BooleanField    | default=True       | Toggle |
| updated_by           | ForeignKey(User)| on_delete=CASCADE  | Last editor |
| updated_at           | DateTimeField   | auto_now=True      | Updated |

#### BaseTable and Table1–Table10
**File:** `apps/dashboard/models.py`
**Database Table:** concrete per class (see below)
**Purpose:** 10 demo tables inheriting common fields for CRUD.

Base fields (in `BaseTable`, abstract):
- `unique_id` (AutoField, PK)
- `name` (CharField, db_index=True)
- `city` (CharField, db_index=True)
- `phone` (CharField)
- `created_at` (DateTimeField, auto_now_add=True)
- `updated_at` (DateTimeField, auto_now=True)
- Indexes: on `name`, `city`

Concrete models set `db_table`:
- Table1 → `dashboard_admin`
- Table2 → `dashboard_user`
- Table3 → `dashboard_verified_artist`
- Table4 → `dashboard_payment`
- Table5 → `dashboard_artist_service`
- Table6 → `dashboard_artist_application`
- Table7 → `dashboard_artist_availability`
- Table8 → `dashboard_artist_calendar`
- Table9 → `dashboard_booking`
- Table10 → `dashboard_message`

#### ActivityLog
**File:** `apps/dashboard/models.py`
**Database Table:** `dashboard_activitylog`
**Purpose:** Append-only log of create/update/delete actions.

Fields: `table_name` (str), `action` (str), `row_id` (int), `row_details` (JSON), `timestamp` (auto), `admin_user` (FK User). Ordering by `-timestamp`.

## URL Structure & Views

### URL Patterns

| URL Pattern | View | Type | Methods | Template | Purpose |
|-------------|------|------|---------|----------|---------|
| `/` and `/login/` | `authentication.views.login_view` | FBV | GET (page), POST (login) | `templates/auth/login.html` | Super-admin login |
| `/signup/` | `authentication.views.signup_view` | FBV | GET (page), POST (create) | `templates/auth/signup.html` | First-time admin creation |
| `/logout/` | `authentication.views.logout_view` | FBV | POST | n/a (JSON) | Logout via AJAX |
| `/auth-status/`, `/api/check-auth/` | `authentication.views.check_auth_status` | FBV | GET | n/a (JSON) | Auth status JSON |
| `/profile/` | `authentication.views.profile_view` | FBV | GET | `templates/profile/admin_profile.html` (partial) | Profile partial HTML |
| `/profile/update/` | `authentication.views.profile_update` | FBV | POST | n/a (JSON) | Update profile fields |
| `/profile/avatar/` | `authentication.views.profile_avatar_upload` | FBV | POST | n/a (JSON) | Upload avatar |
| `/profile/avatar/delete/` | `authentication.views.profile_avatar_delete` | FBV | POST | n/a (JSON) | Delete avatar |
| `/profile/password/` | `authentication.views.profile_password_change` | FBV | POST | n/a (JSON) | Change password |
| `/dashboard/` | `dashboard.views.dashboard_view` | FBV | GET | `templates/dashboard/index.html` | Dashboard overview |
| `/dashboard/tables/` | `dashboard.views.tables_view` | FBV | GET | full/partial templates | Tables UI page/partial |
| `/dashboard/api/table/<int:table_id>/` | `dashboard.views.get_table_data` | FBV | GET (query params) | n/a (JSON) | Paginated list with q,page,per_page |
| `/dashboard/api/table/<int:table_id>/row/` | `dashboard.views.table_crud_api` | FBV | POST (create) | n/a (JSON) | Create row |
| `/dashboard/api/table/<int:table_id>/row/<int:row_id>/` | `dashboard.views.table_crud_api` | FBV | PUT/DELETE or POST with `_method` | n/a (JSON) | Update/Delete row |
| `/dashboard/api/table/config/` | `dashboard.views.update_table_config` | FBV | POST | n/a (JSON) | Update labels (session) |
| `/dashboard/api/logs/` | `dashboard.views.get_logs` | FBV | GET | n/a (JSON) | Paginated logs |
| `/settings/` | `settings_app.views.settings_home` | FBV | GET | `templates/settings/index.html` | Settings landing |
| `/settings/profile/` | `settings_app.views.profile_update` | FBV | POST | n/a (JSON) | Update username/email/password |
| `/settings/app/` | `settings_app.views.app_update` | FBV | POST | n/a (JSON) | Update app settings |
| `/settings/export/<str:fmt>/<int:table_id>/` | `settings_app.views.export_table` | FBV | GET | CSV/JSON | Export data |
| `/settings/system-info/` | `settings_app.views.system_info` | FBV | GET | JSON | System info |

### View Documentation

- Authentication views: function-based, CSRF-protected, some with simple rate limiting. Profile endpoints require authentication.
- Dashboard views: function-based, CSRF on mutation endpoints, `transaction.atomic` on CRUD. Pagination via `Paginator`, search with `Q` objects. ActivityLog updated via API and signals.
- Settings views: function-based, profile update supports password change with re-authentication; export outputs CSV/JSON; system-info aggregates counts and DB size.

## Applications

### authentication
**Purpose:** Super-admin account bootstrap, login/logout, profile management.
**Files Structure:** See tree above (models/forms/views/urls/middleware/admin/migrations).
**Key Features:** Single-account signup, AJAX login/logout, profile CRUD, avatar upload with Pillow validation, basic rate limiting.
**Dependencies:** Django auth, Pillow.

### dashboard
**Purpose:** Dashboard UI, 10 CRUD tables, activity logging.
**Files Structure:** models/views/urls/signals/admin/migrations.
**Key Features:** Search/paginate, method override for PUT/DELETE, session-based label config, logs API, signals for auditing.
**Dependencies:** Django ORM, `apps.settings_app` for page size.

### settings_app
**Purpose:** App/user settings, exports, system info.
**Files Structure:** models/views/urls/forms/context_processors/migrations.
**Key Features:** Update profile/app settings, CSV/JSON export, system info report, context processor for template globals.
**Dependencies:** Django auth, `apps.dashboard` models.

## Templates Structure

### Template Hierarchy

```text
templates/
├── base.html  (root layout; blocks: title, content, scripts)
├── partials/
│   ├── _header.html
│   ├── sidebar.html
│   └── _footer.html
├── auth/
│   ├── login.html    (extends base)
│   └── signup.html   (extends base)
├── dashboard/
│   ├── index.html    (extends base)
│   ├── tables_full.html    (extends base)
│   └── tables_partial.html (AJAX fragment)
├── settings/index.html     (extends base)
└── profile/admin_profile.html (partial)
```

### Template Documentation

| Template | Extends | Blocks | Context Variables | Purpose |
|----------|---------|--------|-------------------|---------|
| base.html | n/a | title, content, scripts | `csp_nonce`, app settings globals | Global layout, nonce/CSP, script loader |
| auth/login.html | base.html | title, content, scripts | CSRF token | Super-admin login UI + auth.js |
| auth/signup.html | base.html | title, content, scripts | CSRF token | One-time super-admin signup |
| dashboard/index.html | base.html | content | counts/logs | Dashboard overview |
| dashboard/tables_full.html | base.html | content | table labels/config | Tables page (full) |
| dashboard/tables_partial.html | base.html | content | table data, pagination | Partial replacement via AJAX |
| settings/index.html | base.html | content, scripts | app/user settings, system info | Settings landing |
| profile/admin_profile.html | base.html or partial | content | profile data | Profile section partial |

## Static Files

### CSS Files

| File | Purpose | Components Styled |
|------|---------|-------------------|
| static/css/login.css | Glassmorphism auth UI | Login/Signup cards, inputs, buttons |

### JavaScript Files

| File | Purpose | Functions | Dependencies |
|------|---------|-----------|--------------|
| static/js/common.js | Global helpers and UI | CSRF cookie/getters, sidebar toggles, logout, utility DOM helpers | None |
| static/js/notifications.js | Toast notifications | showToast/info/warn/error helpers | None |
| static/js/auth.js | Auth flows | login/signup handlers, button states, error rendering | common.js (CSRF) |
| static/js/dashboard.js | Dashboard tables + logs | fetchTable, renderRows, create/update/delete row, debounce search, logs fetch | common.js (CSRF) |

### Images & Media

| Directory | Contents | Purpose |
|-----------|----------|---------|
| media/avatars/ | uploaded images | Admin avatars |

## Forms & User Input

### Forms Documentation

| Form Class | File | Model | Purpose | Fields |
|------------|------|-------|---------|--------|
| SignupForm | apps/authentication/forms.py | User | Create super-admin (one-time) | username, email, password (+confirm) |
| LoginForm  | apps/authentication/forms.py | n/a  | Login | username, password |
| ProfileForm | apps/settings_app/forms.py | User | Update username/email (+optional password) | username, email, password? |
| AppSettingsForm | apps/settings_app/forms.py | AppSettings | Update app settings | app_name, timezone, records_per_page, enable_notifications |

## API Endpoints

| Endpoint | Method | Purpose | Authentication | Response Format |
|----------|--------|---------|----------------|-----------------|
| /login/ | POST | Login | Anonymous (rate-limited) | JSON |
| /signup/ | POST | Create super-admin if none | Anonymous (rate-limited) | JSON |
| /logout/ | POST | Logout current user | Authenticated | JSON |
| /auth-status/ | GET | Auth state | Any | JSON |
| /dashboard/api/table/<id>/ | GET | Paginated list with q,page,per_page | Authenticated | JSON |
| /dashboard/api/table/<id>/row/ | POST | Create row | Authenticated | JSON |
| /dashboard/api/table/<id>/row/<row_id>/ | PUT/DELETE or POST with `_method` | Update/Delete row | Authenticated | JSON |
| /dashboard/api/table/config/ | POST | Update labels (session) | Authenticated | JSON |
| /dashboard/api/logs/ | GET | Paginated logs | Authenticated | JSON |
| /settings/profile/ | POST | Update username/email/password | Authenticated | JSON |
| /settings/app/ | POST | Update app settings | Authenticated | JSON |
| /settings/export/<fmt>/<table_id>/ | GET | Export data as CSV/JSON | Authenticated | file/JSON |
| /settings/system-info/ | GET | System info | Authenticated | JSON |

## Configuration Files

### settings.py Analysis

**Database Configuration:**
- Engine: `django.db.backends.sqlite3` by default (env overrides supported)
- Connection details: SQLite DB file at project root (`db.sqlite3`)

**Installed Apps:**
- Django contrib apps
- `apps.authentication`, `apps.dashboard`, `apps.settings_app`

**Middleware:**
- Django core middleware stack
- `whitenoise.middleware.WhiteNoiseMiddleware` (static files)
- Custom security/CSP middleware and per-request nonce exposure
- Session invalidation middleware on server restart

**Static Files Configuration:**
- STATIC_URL/STATICFILES_DIRS with WhiteNoise `CompressedManifestStaticFilesStorage`
- MEDIA_URL/MEDIA_ROOT for uploads (avatars)

**Environment Variables and Secrets:**
- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `APP_TIMEZONE`, `SERVER_BOOT_ID`, `DJANGO_LOG_FILE`

**Third-party Integrations:**
- WhiteNoise for static
- Pillow for image validation

**Debug and Deployment Settings:**
- Production hardening when `DEBUG=False`: secure cookies, HSTS, optional SSL redirect

## Custom Management Commands

No `management/commands/` directories detected in the project apps.

## Testing Structure

| Test File | Coverage Area | Test Count | Purpose |
|-----------|---------------|------------|---------|
| tests/test_auth.py | Authentication flows | — | Validate login/signup/logout and profile endpoints |
| tests/test_dashboard.py | Dashboard CRUD and APIs | — | Validate CRUD and list endpoints |

## Dependencies

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Django | 4.2.7 | Web framework |
| python-dotenv | 1.0.1 | Env var loading |
| whitenoise | 6.7.0 | Static serving |
| Pillow | 10.0.1 | Image handling |
| psycopg2-binary | 2.9.9 | Postgres driver (optional) |
| djangorestframework | 3.14.0 | API (optional; not enabled) |
| celery | 5.3.4 | Task queue (optional) |
| redis | 5.0.1 | Cache/broker (optional) |
| django-cors-headers | 4.3.1 | CORS (optional) |
| pytest/pytest-django/black/flake8/coverage | various | Dev tooling |

## Installation & Setup

See Quick Start and Manual Setup sections above. Ensure `.env` contains `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` for production.

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| DJANGO_SECRET_KEY | Django cryptographic key | django-in-prod-... |
| DJANGO_DEBUG | Enable/disable debug | False |
| DJANGO_ALLOWED_HOSTS | Hostnames, comma-separated | example.com,www.example.com |
| APP_TIMEZONE | Default timezone | UTC |
| SERVER_BOOT_ID | Session invalidation token | random-uuid |
| DJANGO_LOG_FILE | File path for logs | django.log |

## Database Relationships Diagram (text)

```text
auth.User 1—1 SuperAdmin
auth.User 1—1 AdminProfile
auth.User 1—* AppSettings (updated_by)
auth.User 1—* ActivityLog (admin_user)

BaseTable (abstract): unique_id PK, name, city, phone, created_at, updated_at (indexes: name, city)
Table1..10: concrete tables with db_table names as listed
ActivityLog: (table_name, action, row_id, row_details, timestamp, admin_user)
```

## Feature Summary

### Core Features
- Authentication: `apps/authentication/*`, `templates/auth/*`, `static/js/auth.js` — single-account signup, login/logout, profile management.
- Dashboard: `apps/dashboard/*`, `templates/dashboard/*`, `static/js/dashboard.js` — 10-table CRUD with search/pagination, activity logs.
- Settings: `apps/settings_app/*`, `templates/settings/index.html` — profile/app settings, exports, system info, context processor.

### File Responsibilities

| File | Primary Responsibility | Key Functions | Connected Components |
|------|------------------------|---------------|---------------------|
| django_admin_project/settings.py | Global config | INSTALLED_APPS, MIDDLEWARE, DB, static | All apps/templates |
| django_admin_project/urls.py | URL router | include app urls | Apps/views |
| apps/authentication/views.py | Auth/profile endpoints | signup/login/logout/profile | templates/auth/*, profile partial, auth.js |
| apps/dashboard/views.py | Dashboard + APIs | tables, CRUD, logs | templates/dashboard/*, dashboard.js |
| apps/settings_app/views.py | Settings UI/APIs | profile/app updates, export, system info | settings/index.html |
| templates/base.html | Layout + nonce scripts | script loading, CSRF helpers | all templates, static/js/* |

## Development Notes

- CSP with per-request nonce enforced by custom middleware; templates honor `nonce="{{ csp_nonce }}"`.
- WhiteNoise manifest storage configured; `staticfiles/` is a build artifact (keep in prod, regenerate in dev).
- Rate limiting in auth endpoints is basic and session/IP-based; consider robust throttling for production.
