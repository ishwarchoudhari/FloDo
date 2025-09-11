"""
Django settings for django_admin_project.
This configuration targets development by default, but includes production-ready
settings toggled via environment variables. Each line is commented for clarity.
"""
from pathlib import Path  # Path utility for filesystem paths
import os  # OS utilities for environment variables
import uuid  # For generating a unique server boot identifier
from dotenv import load_dotenv  # Load .env files for environment configuration

# Load environment variables from a .env file if present in project root.
load_dotenv()

# Base directory of the project (one level above the 'django_admin_project' package).
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY: Read secret key from environment; fallback for dev; override in production.
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-secret-key-change-me")

# DEBUG flag: default True for development; set to False in production.
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ("1", "true", "yes")

# Allowed hosts: read from env or default to localhost for development.
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")

# Installed Django apps and our project apps.
INSTALLED_APPS = [
    # UI/Theme must precede Django admin
    "unfold",
    # Django core apps
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Our apps
    "apps.authentication",
    "apps.dashboard",
    "apps.settings_app",
    "apps.client_portal",  # Public Client Portal (renamed namespace)
    # WebSockets / Channels (progressive enhancement; safe to keep installed)
    "channels",
    # Django REST framework (read-only APIs; no impact on existing routes)
    "rest_framework",
]

# ---------------------------------------------------------------------------
# Sentry (error tracking) — enabled only when SENTRY_DSN is provided
# ---------------------------------------------------------------------------
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration()],
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
            profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0")),
            send_default_pii=False,
        )
    except Exception:
        # Fail-safe: never break app startup due to Sentry
        pass

# Middleware stack including WhiteNoise for static files in production.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Serve static files efficiently
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    # Ensure Django admin login redirects to admin index when 'next' is absent
    "apps.authentication.middleware.AdminLoginNextParamMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Custom middleware to invalidate sessions after server restarts
    "apps.authentication.middleware.ServerRestartSessionInvalidateMiddleware",
]

# Root URL configuration module.
ROOT_URLCONF = "django_admin_project.urls"

# Templates configuration: look into 'templates/' directory and enable app directories.
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],  # Global templates directory
        "APP_DIRS": True,  # Also look into each app's 'templates' subdir
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.settings_app.context_processors.app_settings",  # Custom context processor
                # Removed: apps.security.context_processors.csp_nonce (CSP disabled)
            ],
        },
    },
]

# WSGI application path for deployment.
WSGI_APPLICATION = "django_admin_project.wsgi.application"

# ASGI application for Channels/WebSockets
ASGI_APPLICATION = "django_admin_project.asgi.application"

# Database configuration: default to SQLite; can be overridden via env.
DATABASES = {
    "default": {
        "ENGINE": os.getenv("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.getenv("DB_NAME", str(BASE_DIR / "db.sqlite3")),
    }
}

# ---------------------------------------------------------------------------
# Channels / Channel Layer configuration
# ---------------------------------------------------------------------------
# In development you may not have Redis running. To avoid WebSocket failures,
# set USE_INMEMORY_CHANNEL_LAYER=1 (or true/yes) to use the in-memory layer.
USE_INMEMORY_CHANNEL_LAYER = os.getenv("USE_INMEMORY_CHANNEL_LAYER", "").lower() in ("1", "true", "yes")
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

if USE_INMEMORY_CHANNEL_LAYER:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        }
    }

# ---------------------------------------------------------------------------
# Django REST framework minimal configuration (safe defaults)
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    # Keep defaults minimal; only enable pagination to avoid large payloads
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    # Safe throttling defaults (light); can be tuned via env later
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        # Conservative defaults; applies to DRF endpoints only
        "user": os.getenv("DRF_THROTTLE_RATE_USER", "100/min"),
        "anon": os.getenv("DRF_THROTTLE_RATE_ANON", "20/min"),
    },
}

# ---------------------------------------------------------------------------
# Caching configuration (safe Redis if REDIS_URL set; otherwise in-memory)
# ---------------------------------------------------------------------------
REDIS_CACHE_URL = os.getenv("REDIS_URL", "").strip()
if REDIS_CACHE_URL:
    CACHES = {
        "default": {
            # Django 4.2 built-in Redis cache backend (no extra package required)
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_CACHE_URL,
        }
    }
else:
    # Local memory cache as a safe default for development
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "default-locmem",
        }
    }

# Password validation: use Django's recommended validators.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("APP_TIMEZONE", "UTC")  # Read default timezone from env or AppSettings
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]  # Where we store our source static files
STATIC_ROOT = BASE_DIR / "staticfiles"  # Where collectstatic will gather files for production

# Static files storage
# In development on Windows, Manifest storage can fail when files are locked by other processes (e.g., OneDrive/Explorer).
# Use the simple StaticFilesStorage when DEBUG=True, and keep WhiteNoise Manifest storage for production.
if DEBUG:
    STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
else:
    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media files configuration
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Login/Logout redirects and URLs (use namespaced URL names)
LOGIN_URL = "authentication:login"
LOGIN_REDIRECT_URL = "dashboard:index"
LOGOUT_REDIRECT_URL = "authentication:login"

# ---------------------------------------------------------------------------
# Session configuration
# ---------------------------------------------------------------------------
# Use database-backed sessions explicitly (Django default, but set for clarity)
SESSION_ENGINE = "django.contrib.sessions.backends.db"

# Expire session cookie when browser closes (defense-in-depth for shared machines)
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# Unique ID that changes on every server process start; used to invalidate old sessions
# NOTE: This is evaluated at import time (i.e., on each server start/reload)
SERVER_BOOT_ID = os.getenv("SERVER_BOOT_ID") or str(uuid.uuid4())

# ---------------------------------------------------------------------------
# Phase 1: Zero-impact cookie security flags and headers (transparent defaults)
# ---------------------------------------------------------------------------
# HttpOnly cookies prevent client-side JS access (defense-in-depth); Django defaults
# are generally secure, but we make them explicit for clarity and compliance.
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True

# SameSite=Lax is broadly compatible and does not affect standard navigation flows.
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# Send X-Content-Type-Options: nosniff (safe header; no functional impact)
SECURE_CONTENT_TYPE_NOSNIFF = True

# Safer referrer policy without breaking referer-dependent flows.
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# Security hardening when DEBUG is False
if not DEBUG:
    # Use secure cookies in production
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # HTTP Strict Transport Security
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True").lower() in ("1", "true", "yes")

# ---------------------------------------------------------------------------
# Feature flags (default OFF to preserve current behavior; enable via env)
# ---------------------------------------------------------------------------
FEATURE_ENFORCE_ADMIN_API_PERMS = os.getenv("FEATURE_ENFORCE_ADMIN_API_PERMS", "False").lower() in ("1", "true", "yes")
FEATURE_EXPORT_SUPERADMIN_ONLY = os.getenv("FEATURE_EXPORT_SUPERADMIN_ONLY", "False").lower() in ("1", "true", "yes")

# Simple console logging in development; console + rotating file logging in production
if DEBUG:
    LOGGING = {
        "version": 1,
        "disable_existing_loggers": False,
        "handlers": {
            "console": {"class": "logging.StreamHandler"},
        },
        "root": {
            "handlers": ["console"],
            "level": "DEBUG",
        },
    }
else:
    LOGGING = {
        "version": 1,
        "disable_existing_loggers": False,
        "handlers": {
            "console": {"class": "logging.StreamHandler"},
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": os.getenv("DJANGO_LOG_FILE", str(BASE_DIR / "django.log")),
                "maxBytes": int(os.getenv("DJANGO_LOG_MAX_BYTES", 1_000_000)),  # ~1MB
                "backupCount": int(os.getenv("DJANGO_LOG_BACKUP_COUNT", 5)),
            },
        },
        "root": {
            "handlers": ["console", "file"],
            "level": "INFO",
        },
    }
