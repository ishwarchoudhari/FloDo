# ERD & Data Model

This page provides an entity–relationship overview of the FloDo data model, with options to render diagrams locally (Graphviz) and a lightweight Mermaid diagram for docs.

## Mermaid Diagram (Quick View)

Paste this into a Mermaid-enabled viewer (or GitHub markdown) to visualize:

```mermaid
erDiagram
  AUTH_USER ||--o{ AUTH_USER_GROUPS : has
  AUTH_GROUP ||--o{ AUTH_USER_GROUPS : has
  AUTH_USER ||--o{ AUTH_USER_PERMS : has
  AUTH_PERMISSION ||--o{ AUTH_USER_PERMS : grants
  AUTH_GROUP ||--o{ AUTH_GROUP_PERMS : grants
  AUTH_PERMISSION ||--o{ AUTH_GROUP_PERMS : grants

  AUTH_USER ||--|| AUTHENTICATION_SUPERADMIN : "1 to 1"
  AUTH_USER ||--|| AUTHENTICATION_ADMINPROFILE : "1 to 1"
  AUTH_USER ||--o{ SETTINGS_APP_APPSETTINGS : "updated_by"
  AUTH_USER ||--o{ DASHBOARD_ACTIVITYLOG : "admin_user"

  %% Dashboard domain tables
  DASHBOARD_ADMIN {
    int unique_id PK
    string name
    string city
    string phone
    string user_name UNIQUE
    string password_hash
    string role
    bool is_active
    int role_approvedby_id FK
  }

  DASHBOARD_USER {
    int unique_id PK
    string name
    string city
    string phone
  }

  DASHBOARD_VERIFIED_ARTIST {
    int unique_id PK
    string name
    string city
    string phone
  }

  DASHBOARD_PAYMENT {
    int unique_id PK
    string name
    string city
    string phone
  }

  DASHBOARD_ARTIST_SERVICE {
    int unique_id PK
    string name
    string city
    string phone
  }

  DASHBOARD_ARTIST_APPLICATION {
    int unique_id PK
    string name
    string city
    string phone
    string application_status
    bool approved
    datetime approved_at
    int approval_admin_id FK
    int user_id FK
    string email
    int years_experience
    string artist_application_id UNIQUE
  }

  DASHBOARD_ARTIST_APPLICATION_CERTIFICATE {
    int id PK
    int application_id FK
    string file
    datetime uploaded_at
  }

  DASHBOARD_ARTIST_AVAILABILITY {
    int unique_id PK
    string name
    string city
    string phone
  }

  DASHBOARD_ARTIST_CALENDAR {
    int unique_id PK
    string name
    string city
    string phone
  }

  DASHBOARD_CLIENT {
    uuid client_id PK
    string full_name
    string phone UNIQUE
    string email UNIQUE
    string password
    string location
    string status
    datetime created_at
    datetime updated_at
  }

  DASHBOARD_BOOKING {
    int unique_id PK
    string name
    string city
    string phone
    uuid client_id FK
  }

  DASHBOARD_MESSAGE {
    int unique_id PK
    string name
    string city
    string phone
    uuid client_id FK
  }

  DASHBOARD_CLIENT_LOG {
    uuid log_id PK
    uuid client_id FK
    string action
    int performed_by_id FK
    json details
    datetime timestamp
  }

  AUTH_USER ||--o{ DASHBOARD_ADMIN : "role_approvedby"
  AUTH_USER ||--o{ DASHBOARD_ARTIST_APPLICATION : "approval_admin"
  AUTH_USER ||--o{ DASHBOARD_ARTIST_APPLICATION : "user"
  DASHBOARD_ARTIST_APPLICATION ||--o{ DASHBOARD_ARTIST_APPLICATION_CERTIFICATE : has
  DASHBOARD_CLIENT ||--o{ DASHBOARD_BOOKING : has
  DASHBOARD_CLIENT ||--o{ DASHBOARD_MESSAGE : has
  DASHBOARD_CLIENT ||--o{ DASHBOARD_CLIENT_LOG : has
```

## Generate ERD Locally (Graphviz)

You can render a full ERD from live models using `django-extensions` and Graphviz.

### 1) Install tools

```bash
pip install django-extensions pygraphviz  # pygraphviz needs Graphviz installed on system
# or: pip install django-extensions
# and install Graphviz from https://graphviz.org/download/
```

On Windows, ensure Graphviz bin directory (e.g., `C:\\Program Files\\Graphviz\\bin`) is on your PATH.

### 2) Enable django-extensions (local only)

In `django_admin_project/settings.py` (development only), add to `INSTALLED_APPS`:

```python
INSTALLED_APPS += [
    "django_extensions",
]
```

### 3) Render ERD

From `django_admin_project/`:

```bash
# All apps to a PNG
python manage.py graph_models -a -g -o erd.png

# Specific apps only (authentication, dashboard, settings_app)
python manage.py graph_models authentication dashboard settings_app -g -o erd_core.png
```

Options:
- `-a` all apps, `-g` group models by app.
- Use `-X` to exclude third-party or Django contrib apps.

### 4) Commit or view

- Add the generated PNG to `docs/images/` and link from docs.
- Or keep artifacts only locally.

---

[![Docs](https://img.shields.io/badge/Docs-Site-blue)](https://ishwarchoudhari.github.io/FloDo/)
