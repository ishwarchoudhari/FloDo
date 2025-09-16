# Security

This project enables Django’s built-in security features and recommends the following hardening steps for production.

## Defaults in this repo

- CSRF enabled globally; JS sets `X-CSRFToken` or includes `csrfmiddlewaretoken`.
- Auth decorators for protected views.
- Password validators enabled.
- WhiteNoise for static file serving with immutable caching.

## Recommended production settings

- Set `DJANGO_DEBUG=False` and configure `DJANGO_ALLOWED_HOSTS`.
- Use strong `DJANGO_SECRET_KEY` and keep it out of version control.
- Secure cookies: `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`.
- HSTS when on HTTPS: `SECURE_HSTS_SECONDS`, `SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`.
- Optional: Content Security Policy (CSP) when using CDN assets.

## Uploads

- Avatar upload validates size/type and auto-resizes large images to within 1024×1024.
- Store media on a dedicated bucket in production and serve via a CDN.

## Dependencies

- Pin packages in `requirements.txt`.
- Periodically run `pip-audit` or `pip check`.

## Secrets

- Use environment variables or a secrets manager (e.g., Azure Key Vault, AWS Secrets Manager).

---

[![Docs](https://img.shields.io/badge/Docs-Site-blue)](https://ishwarchoudhari.github.io/FloDo/)
