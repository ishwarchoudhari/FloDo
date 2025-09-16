# API Reference

This document describes the public HTTP APIs exposed by the Django Admin Dashboard.

All endpoints are same-origin and CSRF-protected. For non-GET requests, include `X-CSRFToken` header or a `csrfmiddlewaretoken` field in the form body.

- Authentication base: `/Super-Admin/auth/`
- Dashboard base: `/dashboard/` (public legacy and API paths retained)
- Settings base: `/Super-Admin/settings/`

## Authentication

### POST /signup/
Create the sole super-admin account (only allowed when none exists).

Request (form-encoded or JSON):
```
username, email, password
```

Response:
```
200 { "success": true, "message": "Super-admin created. Please log in." }
400 { "success": false, "errors": { ... } }
```

### POST /login/
Login with username/password. Returns JSON for AJAX clients; follows redirects for plain form submissions.

Request:
```
username, password[, next]
```

Response (AJAX):
```
200 { "success": true, "redirect": "/Super-Admin/" }
401 { "success": false, "error": "Invalid credentials." }
```

### POST /logout/
Logout current session.

Response:
```
200 { "success": true, "redirect": "/login/" }
```

### GET /auth-status/
Lightweight poll to check if the user is authenticated.

Response:
```
200 { "authenticated": true|false }
```

## Profile (Super Admin)
Base: `/Super-Admin/auth/`

### GET /profile/
Returns the profile card HTML partial (AJAX-rendered). Also includes inline Super-Admin status for superusers.

Response: `text/html`

### POST /profile/update/
Update profile fields and email (form-encoded or `multipart/form-data`).

Fields (any subset):
```
display_name, role, bio, location, birth_date (YYYY-MM-DD), phone, email,
# social links (whitelisted keys only): twitter, github, linkedin, website
```

Response:
```
200 { "success": true }
400 { "success": false, "error": "Invalid email address." }
```

### POST /profile/avatar/
Upload/replace avatar. Accepts `multipart/form-data` with `avatar` file.
- Max size: 5 MB
- Types: JPEG/PNG/WebP/GIF
- Large images are auto-resized to fit within 1024×1024 while preserving aspect ratio.

Response:
```
200 { "success": true }
400 { "success": false, "error": "Invalid image file." }
```

### POST /profile/avatar/delete/
Remove the current avatar.

Response:
```
200 { "success": true }
```

## Dashboard Tables
Base: `/dashboard/`

### GET /dashboard/api/table/<table_id>/?page=1&per_page=10&q=
Paginated list of rows for a demo table.

Response:
```
200 {
  "success": true,
  "results": [ { ... }, ... ],
  "page": 1,
  "num_pages": 5,
  "total": 47
}
```

### POST /dashboard/api/table/<table_id>/row/
Create a row (form fields depend on the demo table schema).

Response:
```
201 { "success": true, "row": { ... } }
400 { "success": false, "error": "..." }
```

### POST /dashboard/api/table/<table_id>/row/<row_id>/?_method=PUT
Update a row (method override via POST). True PUT is also supported.

Response:
```
200 { "success": true, "row": { ... } }
404 { "success": false, "error": "Not found." }
```

### POST /dashboard/api/table/<table_id>/row/<row_id>/?_method=DELETE
Delete a row (method override via POST). True DELETE is also supported.

Response:
```
200 { "success": true }
404 { "success": false, "error": "Not found." }
```

### GET /dashboard/api/logs/?page=1&per_page=10
Paginated CRUD activity logs.

Response:
```
200 {
  "success": true,
  "results": [ { "table_name": "...", "action": "CREATE", ... } ],
  "page": 1,
  "num_pages": 12,
  "total": 117
}
```

## Settings
Base: `/Super-Admin/settings/`

### POST /settings/profile/
Update username/email/password in the settings area.

### POST /settings/app/
Update application settings (`timezone`, `records_per_page`, etc.).

### GET /settings/export/<fmt>/<table_id>/
Export a table as CSV or JSON.

### GET /settings/system-info/
System diagnostics (Django version, DB size, record counts).

## CSRF & Auth Notes

- CSRF is enabled globally. For non-GET requests:
  - Send header `X-CSRFToken: <token>` OR
  - Include `csrfmiddlewaretoken=<token>` in the body.
- Tokens are available as a cookie and also injected into pages via:
  - `<meta name="csrf-token" content="...">`
  - `<div id="csrf-holder">{% csrf_token %}</div>`
- JS helper `fetchWithCSRF` automatically injects headers for same-origin POST/PUT/DELETE.

## Error Format

All APIs use JSON error messages with HTTP error codes when applicable:
```
400 { "success": false, "error": "Invalid ..." }
401 { "success": false, "error": "Unauthorized" }
403 { "success": false, "error": "Forbidden" }
404 { "success": false, "error": "Not found" }
```
