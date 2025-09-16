from django.conf import settings
from django.contrib.auth import logout
from django.http import HttpResponseRedirect

class ServerRestartSessionInvalidateMiddleware:
    """
    Middleware that invalidates authenticated sessions created before the current
    server (process) start. This forces users (including admin) to re-login after
    a server restart/reload.

    How it works:
    - A unique settings.SERVER_BOOT_ID is generated on each server process start.
    - For every request:
      * If user is authenticated and request.session['server_boot_id'] does not
        match the current SERVER_BOOT_ID, we log the user out.
      * After processing the request, if the user is authenticated, we stamp the
        current SERVER_BOOT_ID into the session.

    Notes:
    - Only touches authentication/session behavior. No templates or routing changes.
    - Works with the default Django auth system and DB-backed sessions.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        # Boot identifier set in settings on import (server start)
        self.current_boot_id = getattr(settings, "SERVER_BOOT_ID", None)

    def __call__(self, request):
        # If the session was issued before this process started, invalidate it
        if request.user.is_authenticated:
            session_boot_id = request.session.get("server_boot_id")
            if session_boot_id != self.current_boot_id:
                # Flush auth state to force re-login
                logout(request)
                # Do not redirect here; allow normal flow. Protected views will
                # redirect to LOGIN_URL via @login_required as usual.

        response = self.get_response(request)

        # After response, stamp boot id for fresh authenticated sessions
        if request.user.is_authenticated:
            if request.session.get("server_boot_id") != self.current_boot_id:
                request.session["server_boot_id"] = self.current_boot_id

        return response


class AdminLoginNextParamMiddleware:
    """
    Ensure Django Admin login redirects back to the admin index after success.

    If a user visits '/admin/login/' (Unfold/Django admin login) without a 'next'
    parameter, Django will fall back to the project LOGIN_REDIRECT_URL after login,
    which points to the site's dashboard. To keep admin isolated and non-intrusive,
    we append '?next=/admin/' automatically.

    This middleware is non-invasive: it only touches GET requests to '/admin/login/'
    when 'next' is missing. All other routes and flows remain unchanged.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            # Normalize path with trailing slash as Django admin uses it
            if request.method == "GET":
                path = request.path.rstrip("/") + "/"
                if path == "/admin/login/" and "next" not in request.GET:
                    return HttpResponseRedirect("/admin/login/?next=/admin/")
        except Exception:
            # Be defensive: never break the request flow due to this safety net
            pass

        return self.get_response(request)
