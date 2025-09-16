# Architecture

This project is a Django 4.x application with a clean separation of concerns:

- Apps live under `apps/`
  - `apps/authentication/` — login, signup, profile, avatar upload
  - `apps/dashboard/` — main dashboard, CRUD data tables, logs
  - `apps/settings_app/` — settings UI and endpoints
- Project config under `django_admin_project/`
  - `settings.py`, `urls.py`, `asgi.py`, `wsgi.py`
- Templates under `templates/`
- Static assets under `static/`
- Optional media uploads under `media/`

## High-level Flow

- Super Admin flows are namespaced under `Super-Admin/` in `django_admin_project/urls.py`.
- The UI is server-rendered via Django templates with progressive enhancement using Vanilla JS (Fetch API).
- WebSockets (Daphne/Channels) support real-time notifications when enabled.

## Key Modules

- `apps/authentication/views.py`
  - `signup_view`, `login_view`, `logout_view`
  - `profile_view` (AJAX-loaded profile card)
  - `profile_update`, `profile_avatar_upload`, `profile_avatar_delete`
- `apps/dashboard/views.py`
  - `dashboard_view`, `tables_view`, table CRUD APIs, logs API
- `apps/settings_app/views.py`
  - Settings pages and export endpoints

## Templates

- `templates/base.html` — global layout, header, sidebars, scripts
- `templates/profile/admin_profile.html` — profile card & Super Admin status

## Static JS

- `static/js/common.js` — CSRF helpers, notifications, logout, fetchWithCSRF
- `static/js/base.js` — profile edit/upload, dashboard helpers
- `static/js/dashboard.js`, `static/js/notifications.js`

## Data Model (selected)

- `authentication.SuperAdmin` — single-super-admin informational row
- `authentication.AdminProfile` — profile for admin users (avatar, bio, social links)
- `dashboard.ActivityLog` — CRUD activity

See `README.md` for an ER diagram and complete table inventory.
