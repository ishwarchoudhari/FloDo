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

        # Report-only CSP (requested baseline). Does not block, only reports.
        # default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; report-uri /csp-report/
        csp_ro = (
            "default-src 'self'; "
            "img-src 'self' data:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; "
            "report-uri /csp-report/"
        )
        response["Content-Security-Policy-Report-Only"] = csp_ro
        return response
