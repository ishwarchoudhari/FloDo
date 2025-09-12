import os
import json
import django
from io import StringIO
from django.conf import settings
from django.apps import apps
from django.db import connections
from django.core.management import call_command

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_admin_project.settings")
django.setup()

report = {"databases": {}}

for alias, db in settings.DATABASES.items():
    conn = connections[alias]
    cur = conn.cursor()
    intro = conn.introspection

    # table list
    table_list = intro.get_table_list(cur)
    table_names = [t.name for t in table_list]

    # model map
    model_tables = {m._meta.db_table: m for m in apps.get_models()}

    tables = []
    for t in table_names:
        tinfo = {
            "name": t,
            "type": getattr(next((x for x in table_list if x.name == t), None), "type", "t"),
            "columns": [],
            "constraints": {},
            "indexes": {},
            "row_count": None,
            "is_system": False,
        }
        # columns
        try:
            desc = intro.get_table_description(cur, t)
            for col in desc:
                tinfo["columns"].append({
                    "name": col.name,
                    "type_code": str(col.type_code),
                    "internal_size": getattr(col, "internal_size", None),
                    "null_ok": bool(getattr(col, "null_ok", False)),
                    "default": getattr(col, "default", None),
                })
        except Exception as e:
            tinfo["columns_error"] = str(e)
        # constraints
        try:
            tinfo["constraints"] = intro.get_constraints(cur, t)
        except Exception as e:
            tinfo["constraints_error"] = str(e)
        # indexes (legacy helper if available)
        try:
            if hasattr(intro, "get_indexes"):
                tinfo["indexes"] = intro.get_indexes(cur, t)
        except Exception as e:
            tinfo["indexes_error"] = str(e)
        # row count
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            tinfo["row_count"] = cur.fetchone()[0]
        except Exception as e:
            tinfo["row_count_error"] = str(e)
        # classify system tables
        sys_prefixes = ("django_", "auth_", "admin_", "sessions", "sqlite_", "authtoken_", "socialaccount_")
        tinfo["is_system"] = t.startswith(sys_prefixes)
        # model linkage
        if t in model_tables:
            m = model_tables[t]
            tinfo["model"] = {"app_label": m._meta.app_label, "model_name": m.__name__}
        tables.append(tinfo)

    empty_tables = [x["name"] for x in tables if x.get("row_count") == 0]

    models_without_tables = []
    for mt, m in model_tables.items():
        if mt not in table_names:
            models_without_tables.append({"table": mt, "app_label": m._meta.app_label, "model": m.__name__})

    report["databases"][alias] = {
        "engine": db.get("ENGINE"),
        "name": db.get("NAME"),
        "tables": tables,
        "empty_tables": empty_tables,
        "models_without_tables": models_without_tables,
    }

# migrations check (dry-run)
sio = StringIO()
try:
    call_command("makemigrations", "--check", "--dry-run", stdout=sio, stderr=sio)
    report["migrations_check"] = sio.getvalue()
except SystemExit:
    report["migrations_check"] = sio.getvalue()
except Exception as e:
    report["migrations_check_error"] = str(e)

print(json.dumps(report, indent=2))
