# Database Detailed Reference

This page provides a deep, practical reference for the database schema of the Django Admin Dashboard (FloDo). It maps high‑level app features to the underlying tables, and then documents each first‑party table with columns, types, constraints, indexes, and current row counts. System tables (Django internals) are summarized at the end.

Last refresh: see live counts below (captured from the current local database at generation time).

- Total tables: 27
- Data inventory source: `db_inventory.json` (auto‑generated at project root) for full machine‑readable details.

---

## Feature → Tables Map

- Authentication (login, permissions)
  - `auth_user` (Django users)
  - `auth_group`, `auth_permission` and M2M join tables `auth_user_groups`, `auth_user_user_permissions`, `auth_group_permissions`
  - Profiles and super‑admin:
    - `authentication_adminprofile` (1:1 with `auth_user`)
    - `authentication_superadmin` (enforces single Super‑Admin informational row)

- Admin Dashboard (overview, logs, tables)
  - Overview counts and tables: `dashboard_admin` (Table1), `dashboard_user` (Table2), `dashboard_verified_artist` (Table3), `dashboard_payment` (Table4), `dashboard_artist_service` (Table5), `dashboard_artist_application` (Table6), `dashboard_artist_availability` (Table7), `dashboard_artist_calendar` (Table8), `dashboard_booking` (Table9), `dashboard_message` (Table10)
  - Audit trail: `dashboard_activitylog`
  - Artist application attachments: `dashboard_artist_application_certificate`

- Client Portal (end‑users separate from Django staff)
  - `dashboard_client`, `dashboard_client_log`

- Settings and Ops
  - `settings_app_appsettings` (global preferences)
  - `django_session`, `django_content_type`, `django_admin_log`, `django_migrations` (Django internals)

---

## First‑party Tables (Deep Details)

Below are key application tables with their columns, constraints, indexes, and current row counts.

> Note: Column types reflect the active DB backend (SQLite in dev). In Postgres, types will differ (e.g., `varchar`, `timestamp with time zone`, etc.).

### authentication_adminprofile
- Purpose: Admin profile data for a Django user.
- Row count: 1
- Columns:
  - `id` (INTEGER, PK)
  - `user_id` (INTEGER, FK → `auth_user.id`, UNIQUE)
  - `avatar` (varchar(100), nullable)
  - `display_name` (varchar(150))
  - `role` (varchar(100))
  - `bio` (TEXT)
  - `location` (varchar(120))
  - `birth_date` (date, nullable)
  - `phone` (varchar(32))
  - `status` (varchar(20))
  - `last_sign_in` (datetime, nullable)
  - `social_links` (TEXT JSON)
  - `created_at` (datetime)
  - `updated_at` (datetime)
- Constraints / Indexes:
  - PRIMARY KEY (`id`)
  - UNIQUE (`user_id`)

### authentication_superadmin
- Purpose: The single Super‑Admin informational record.
- Row count: 1
- Columns:
  - `id` (INTEGER, PK)
  - `user_id` (INTEGER, FK → `auth_user.id`, UNIQUE)
  - `is_super_admin` (bool) — uniqueness enforced to allow at most one TRUE row
  - `created_at` (datetime)
  - `last_login_ip` (char(39), nullable)
- Constraints / Indexes:
  - PRIMARY KEY (`id`)
  - UNIQUE (`user_id`)
  - UNIQUE (`is_super_admin`)

### dashboard_activitylog
- Purpose: Audit trail of CRUD actions across tables (signals + explicit logs).
- Row count: 6
- Columns:
  - `id` (INTEGER, PK)
  - `table_name` (varchar(50))
  - `action` (varchar(10))
  - `row_id` (INTEGER)
  - `row_details` (TEXT JSON)
  - `timestamp` (datetime)
  - `admin_user_id` (INTEGER, FK → `auth_user.id`)
- Indexes:
  - (`admin_user_id`)

### dashboard_admin (Table1)
- Purpose: Admin registry for Admin Management (separate from `auth_user`).
- Row count: 1
- Columns:
  - `unique_id` (INTEGER, PK)
  - `name` (varchar(100))
  - `city` (varchar(100))
  - `phone` (varchar(20))
  - `created_at` (datetime)
  - `updated_at` (datetime)
  - `is_active` (bool)
  - `password_hash` (varchar(128)) — Django‑hashed; never exposed in logs
  - `role` (varchar(20))
  - `role_approvedby_id` (INTEGER, FK → `auth_user.id`, nullable)
  - `user_name` (varchar(150), UNIQUE)
- Indexes:
  - (`name`), (`city`), (`role_approvedby_id`)

### dashboard_user (Table2)
- Purpose: Domain “users” (not Django login).
- Row count: 0
- Columns: `unique_id` (PK), `name`, `city`, `phone`, `created_at`, `updated_at`
- Indexes: (`name`), (`city`)

### dashboard_verified_artist (Table3)
- Row count: 0
- Columns: `unique_id` (PK), `name`, `city`, `phone`, `created_at`, `updated_at`
- Indexes: (`name`), (`city`)

### dashboard_payment (Table4)
- Row count: 0
- Columns: `unique_id` (PK), `name`, `city`, `phone`, `created_at`, `updated_at`

### dashboard_artist_service (Table5)
- Row count: 0
- Columns: `unique_id` (PK), `name`, `city`, `phone`, `created_at`, `updated_at`

### dashboard_artist_application (Table6)
- Purpose: Artist applications with workflow and metadata.
- Row count: 0
- Columns:
  - `unique_id` (INTEGER, PK)
  - `name`, `city`, `phone`, `created_at`, `updated_at`
  - `approved` (bool), `approved_at` (datetime, nullable)
  - `approval_admin_id` (INTEGER, FK → `auth_user.id`, nullable)
  - `application_status` (varchar(32))
  - `user_id` (INTEGER, FK → `auth_user.id`, nullable)
  - `email` (varchar(254), nullable)
  - `years_experience` (integer unsigned)
  - `artist_application_id` (char(32), UNIQUE)
- Constraints / Indexes:
  - UNIQUE (`artist_application_id`)
  - CHECK (`years_experience`) — generated by Django for positive ints
  - Indexes on FKs

### dashboard_artist_application_certificate
- Purpose: Uploaded attachments for artist applications.
- Row count: 0
- Columns:
  - `id` (INTEGER, PK)
  - `application_id` (INTEGER, FK → `dashboard_artist_application.unique_id`)
  - `file` (varchar(100))
  - `uploaded_at` (datetime)

### dashboard_artist_availability (Table7)
- Row count: 0
- Columns: `unique_id` (PK), `name`, `city`, `phone`, `created_at`, `updated_at`

### dashboard_artist_calendar (Table8)
- Row count: 0
- Columns: `unique_id` (PK), `name`, `city`, `phone`, `created_at`, `updated_at`

### dashboard_booking (Table9)
- Row count: 0
- Columns: `unique_id` (PK), `name`, `city`, `phone`, `created_at`, `updated_at`, `client_id` (FK → `dashboard_client.client_id`, nullable)

### dashboard_message (Table10)
- Row count: 0
- Columns: `unique_id` (PK), `name`, `city`, `phone`, `created_at`, `updated_at`, `client_id` (FK → `dashboard_client.client_id`, nullable)

### dashboard_client
- Purpose: End‑user accounts for the Client Portal (separate from Django staff).
- Row count: 0
- Columns:
  - `client_id` (UUID, PK)
  - `full_name` (varchar(255))
  - `phone` (varchar(32), UNIQUE)
  - `email` (varchar(255), UNIQUE, nullable)
  - `password` (varchar(128)) — Django‑style hash recommended
  - `location` (varchar(255), nullable)
  - `status` (enum text: Active/Inactive)
  - `created_at` (datetime), `updated_at` (datetime)
- Indexes: (`phone`), (`email`)

### dashboard_client_log
- Purpose: Portal audit logs (client actions and admin operations on clients).
- Row count: 0
- Columns:
  - `log_id` (UUID, PK)
  - `client_id` (FK → `dashboard_client.client_id`)
  - `action` (enum text)
  - `performed_by_id` (INTEGER, FK → `auth_user.id`, nullable)
  - `details` (JSON), `timestamp` (datetime)
- Indexes: (`action`), (`timestamp`)

### settings_app_appsettings
- Purpose: Global app settings and preferences.
- Row count: 1
- Columns:
  - `id` (INTEGER, PK)
  - `app_name` (varchar(100))
  - `timezone` (varchar(50))
  - `records_per_page` (INTEGER)
  - `enable_notifications` (bool)
  - `updated_by_id` (INTEGER, FK → `auth_user.id`)
  - `updated_at` (datetime)

---

## Django Internal Tables (Summary)

- `auth_user` — Django users (Row count: 2)
- `auth_group`, `auth_permission` — permission framework (Row counts: groups 0, permissions 92)
- `auth_user_groups`, `auth_user_user_permissions`, `auth_group_permissions` — M2M maps (Row counts: 0)
- `django_session` — session store (Row count: 4)
- `django_content_type` — content types (Row count: 23)
- `django_admin_log` — admin site action log (Row count: 0)
- `django_migrations` — applied migrations (Row count: 29)

---

## Operational Notes

- Exports:
  - Use `Super-Admin/settings/export/<fmt>/<table_id>/` to export CSV/JSON for tables 1..10.
- Activity Logging:
  - Signals write to `dashboard_activitylog` on create/update/delete across Tables 1..10.
  - Table1 (dashboard_admin) logs sanitize sensitive fields (no `password_hash`).
- Security:
  - File uploads (avatars and certificates) validated for type/size; images are auto‑resized to safe bounds on upload.
- Real‑time:
  - Admin management emits Channels events to group `notifications` for UI updates.

---

## Updating This Reference

- The machine‑readable snapshot is generated to `db_inventory.json`. Rebuild it after schema changes:

```powershell
# From: django_admin_project/
python manage.py shell -c "import json; from django.db import connection; cur=connection.cursor(); tables=connection.introspection.table_names(); out={'total_tables': len(tables), 'tables': []};
for t in tables:
    info={'name': t}
    try:
        cur.execute(f'SELECT COUNT(*) FROM {t}')
        info['row_count']=cur.fetchone()[0]
    except Exception as e:
        info['row_count']=None; info['row_count_error']=str(e)
    cols=[]
    try:
        cur.execute(f'PRAGMA table_info({t})')
        for cid,name,ctype,notnull,dflt_value,pk in cur.fetchall():
            cols.append({'name':name,'type':ctype,'notnull':bool(notnull),'default':dflt_value,'primary_key':bool(pk)})
    except Exception:
        desc = connection.introspection.get_table_description(cur, t)
        for c in desc:
            nm = getattr(c,'name',None) or (c[0] if isinstance(c,(list,tuple)) and c else None)
            cols.append({'name':nm,'type':str(getattr(c,'type_code',None)),'notnull':not getattr(c,'null_ok',True),'default':getattr(c,'default',None),'primary_key':False})
    info['columns']=cols
    try:
        info['constraints']=connection.introspection.get_constraints(cur, t)
    except Exception as e:
        info['constraints_error']=str(e)
    out['tables'].append(info)
open('db_inventory.json','w', encoding='utf-8').write(json.dumps(out, indent=2, ensure_ascii=False))
print('WROTE: db_inventory.json')"
```

---

[![Docs](https://img.shields.io/badge/Docs-Site-blue)](https://ishwarchoudhari.github.io/FloDo/)
