# Security Audit Report for django_admin_project

Date: 2025-09-11
Scope: Full source under `django_admin_project/`

## Summary
Overall posture is good for a dev-oriented Django app: CSRF middleware enabled, auth-required for admin and dashboard, DRF endpoints enforce `IsAuthenticated`, passwords hashed via Django hashers, and uploads have validations. Production hardening is needed around cookie flags, ALLOWED_HOSTS fallback, and restricting some admin APIs to super-admins only.

## Findings

- Critical
  - None identified that constitute immediate remote code execution or auth bypass.

- High
  - Admin CRUD APIs accessible to any authenticated user, not just super-admin.
    - Files: `apps/dashboard/views.py` -> `table_crud_api()` (lines ~780-929), `get_table_data()` (lines ~185-228), `update_table_config()` (lines ~932-947)
    - Issue: Decorated with `@login_required` but no super-admin check like `_is_super_admin()`. Non-superuser authenticated accounts could mutate tables 2-10 or read data via these endpoints.
    - Repro: Create a non-superuser in Django shell; login and call `/dashboard/api/table/2/row/` POST.
    - Fix: Add `_is_super_admin` gate for these endpoints (see suggested patch below).

  - Production ALLOWED_HOSTS fallback to wildcard when `DEBUG=False` and env doesn’t define hosts.
    - File: `django_admin_project/settings.py` lines ~236-249
    - Issue: If `ALLOWED_HOSTS` env var absent in production, code sets `ALLOWED_HOSTS = ["*"]`.
    - Risk: Host header attacks in production.
    - Fix: Fail-fast or default to empty and require explicit env.

- Medium
  - Session and CSRF cookie attributes set only when `DEBUG` is False; not explicitly setting `HttpOnly`/`SameSite`.
    - File: `django_admin_project/settings.py`
    - Risk: Defaults are generally safe (HttpOnly True by default; SameSite=Lax), but making explicit is recommended.
    - Fix: Explicitly set `SESSION_COOKIE_HTTPONLY = True`, `CSRF_COOKIE_HTTPONLY = True`, `SESSION_COOKIE_SAMESITE = 'Lax'`, `CSRF_COOKIE_SAMESITE = 'Lax'`; consider `Secure` and `SameSite=Strict` where possible.

  - Export endpoint grants read of entire tables to any authenticated user.
    - File: `apps/settings_app/views.py` -> `export_table()`
    - Issue: Only `@login_required` is enforced; could be intended, but in many orgs exports are admin-only.
    - Fix: Consider `_is_super_admin` check or a distinct permission.

  - Client portal file upload for certificates lacks MIME/content validation and AV scanning.
    - Files: `apps/dashboard/models.py` -> `ArtistApplicationCertificate.file` has extension and size validators. Upload route: `apps/client_portal/views.py::artist_apply()` accepts uploaded files.
    - Risk: Malicious file with allowed extension. While Django stores paths safely, serving back could pose risk.
    - Fix: Add MIME sniffing and optional antivirus scan step before saving.

  - CSP is commented out/disabled.
    - File: `django_admin_project/settings.py` comment around context processors.
    - Risk: XSS defense-in-depth weaker than possible.
    - Fix: Integrate standard CSP headers and nonces where script tags exist.

- Low
  - `apps/security/` package exists but is not in `INSTALLED_APPS`, likely dead/unused.
    - Files: `apps/security/__init__.py`
    - Action: Remove or document; keeping unused code increases attack surface/confusion.

  - Minor: Login rate limiting is conditional on REDIS_URL; fallback session-based limiter exists but can be bypassed with new sessions.
    - Files: `apps/authentication/views.py` (rate limit helpers)
    - Fix: Prefer centralized cache-backed ratelimit in production.

## Endpoint Inventory and Auth

- Project URLs: `django_admin_project/urls.py`
  - `/admin/` Django admin (uses Unfold UI). Auth required.
  - `/` redirects to `auth:login`
  - `/auth/` (authentication)
    - `login/` GET/POST (CSRF protected), `signup/` guarded to first super-admin only. `logout/` POST login required.
    - Profile endpoints: `profile/`, `profile/update/`, `profile/avatar/`, `profile/avatar/delete/`, `profile/password/` — all `@login_required`.
    - `api/check-auth/` returns JSON auth status; no login required, returns boolean only.
  - `/dashboard/`
    - `""` dashboard_view: login + super-admin enforced.
    - `tables/` UI: login + super-admin enforced.
    - `artist-applications/` and approve/reject: login + super-admin enforced.
    - `api/table/<table_id>/` GET data: login required (not super-admin; recommend restrict)
    - `api/table/<table_id>/row/` POST create; `row/<row_id>/` PUT/DELETE update/delete: login required (recommend super-admin)
    - `api/table/config/` POST: login required (recommend super-admin)
    - `api/logs/` GET: returns 401 if not authenticated; authenticated users can read.
    - Admin management endpoints `/dashboard/Admin_management/`, `/api/admins/`, `/api/admins/<id>/` — login + super-admin enforced.
  - `/settings/`
    - `""` settings home, profile update, app update (all require login). Consider super-admin for app update.
    - `export/<fmt>/<table_id>/` export table (auth only) — consider super-admin.
    - `system-info/` returns system stats (auth only).
  - `/portal/` (public client portal)
    - `""`, `customer/`, `artists/`, `artist/apply/`, `artist/application-status/`, `artist/` (dashboard) — public, anonymous session-based identity.
  - `/api/v1/logs/` (DRF router) `ActivityLogViewSet` — `IsAuthenticated` enforced.
  - `/healthz`, `/readinessz` — unauthenticated probes; JSON-only.

## CSRF
- CSRF middleware is enabled (`CsrfViewMiddleware`), and all mutating views either use `@csrf_protect` or rely on middleware; templates include `{% csrf_token %}` where needed (login, signup, artist apply).

## Authentication and Session Cookies
- Only set `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` when `DEBUG=False`. Explicitly set `HttpOnly`/`SameSite` is recommended.
- Custom middleware `ServerRestartSessionInvalidateMiddleware` invalidates sessions on server restart — acceptable.

## Passwords
- Django auth uses default PBKDF2; additional Table1 password hashes stored using `make_password` (PBKDF2) — OK.

## SQL Injection
- No raw SQL usage detected; ORM used throughout. Inputs validated; where clause uses ORM fields (`icontains` etc.).

## XSS
- Templates generally escape variables; JSON data for charts uses `|escapejs`. No `|safe` or `autoescape off` found in project.
- Recommend CSP for defense-in-depth.

## File Uploads
- Avatar upload validates size, content type, and uses Pillow to verify images and dimensions.
- Certificate uploads validate extension and size; consider MIME validation and AV scanning.

## Performance
- `select_related` used where appropriate. Pagination used for logs and lists.
- Caching configured to Redis when available; otherwise locmem. DRF pagination and throttling configured.

## Suggested Fixes (snippets)

- Restrict dashboard CRUD endpoints to super-admins:
  - In `apps/dashboard/views.py` add at the start of `get_table_data`, `table_crud_api`, and `update_table_config`:
```python
if not _is_super_admin(request.user):
    return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
```

- Harden ALLOWED_HOSTS behavior in production:
  - In `settings.py`, inside `if not DEBUG:` block, replace the wildcard fallback with error or safe default:
```python
hosts_env = os.getenv("DJANGO_ALLOWED_HOSTS", "").strip()
ALLOWED_HOSTS = [h for h in hosts_env.split(",") if h]  # require explicit config
if not ALLOWED_HOSTS:
    raise RuntimeError("DJANGO_ALLOWED_HOSTS must be set in production")
```

- Explicit cookie hardening in all environments:
  - In `settings.py`:
```python
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
# In production
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
```

- Optional: add CSP headers via middleware or Django-CSP, and set `SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"`.

- Optional: make `settings_app.export_table` and `settings_app.app_update` super-admin only:
```python
from apps.dashboard.views import _is_super_admin
if not _is_super_admin(request.user):
    return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
```

## Unused/Dead Code
- `apps/security/` is present but unused (not in `INSTALLED_APPS`). Either integrate or remove.

## Rollback Instructions
- All suggested changes are additive checks and settings tweaks. To rollback:
  - Remove the added super-admin checks in `dashboard/views.py`.
  - Restore the previous `ALLOWED_HOSTS` logic.
  - Remove the explicit cookie settings.

## Tests Added
A pytest suite under `tests/security/` and `tests/audit/` validates:
- Auth bypass attempts on dashboard CRUD endpoints.
- DRF ActivityLog auth requirement.
- CSRF enforcement on login/signup/profile/app updates.
- File upload restrictions for avatars and certificates (size/type).
- SQLi and XSS attempts (ensuring no server error and outputs are escaped).

Run:
```
pytest -q
```
