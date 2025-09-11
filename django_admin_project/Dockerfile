# Minimal, safe Dockerfile for Django ASGI (Daphne) without changing project code
# Multi-stage for smaller final image

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system deps required by Pillow and psycopg (optional)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY django_admin_project/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ----- Runtime image -----
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

# Create a non-root user (optional but recommended)
RUN useradd -ms /bin/bash appuser

# Copy installed packages from base layer to avoid rebuilding
COPY --from=base /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=base /usr/local/bin /usr/local/bin

# Copy project files
COPY django_admin_project/ /app/

# Static collect can be performed at build-time or entrypoint; keep optional and safe
# Uncomment if you want assets baked into the image (requires DEBUG=False and correct STATIC_ROOT)
# RUN python manage.py collectstatic --noinput || true

# Expose default port
EXPOSE 8000

# Default command runs ASGI server (Daphne). Can be overridden by the platform.
# Using 0.0.0.0 to bind inside containers.
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "django_admin_project.asgi:application"]
