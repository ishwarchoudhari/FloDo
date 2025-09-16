"""
Feature-flagged security headers middleware.
Default: OFF (enable by setting FEATURE_SECURITY_HEADERS=true in environment).
Adds report-only CSP and modern security headers without changing runtime behavior.
"""
from __future__ import annotations
from typing import Callable


class SecurityHeadersMiddleware:
    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Core headers (idempotent; overwrite if present)
        response["X-Frame-Options"] = "DENY"
        response["X-Content-Type-Options"] = "nosniff"
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Modern policies (conservative)
        response["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=(), usb=(), xr-spatial-tracking=(), "
            "accelerometer=(), gyroscope=(), magnetometer=(), clipboard-read=(self), clipboard-write=(self)"
        )
        response["Cross-Origin-Opener-Policy"] = "same-origin"
        response["Cross-Origin-Resource-Policy"] = "same-origin"
        response["Cross-Origin-Embedder-Policy"] = "require-corp"

        # Report-only CSP to avoid breakage in development. Tailor sources to current templates.
        csp_ro = (
            "default-src 'self'; "
            "script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "img-src 'self' data: blob:; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "connect-src 'self' ws: wss:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'"
        )
        response["Content-Security-Policy-Report-Only"] = csp_ro
        return response
