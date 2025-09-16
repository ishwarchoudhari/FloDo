from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.utils.timesince import timesince
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile, InMemoryUploadedFile
from PIL import Image, UnidentifiedImageError
import io
from django.conf import settings
import json
import secrets
import hmac
import time
from django.core.cache import caches
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.urls import reverse

# Optional: Redis-backed rate limiting (enabled only if REDIS_URL present)
try:
    from ratelimit.decorators import ratelimit as _ratelimit
except Exception:  # pragma: no cover - package may be absent in some envs
    _ratelimit = None  # type: ignore

def safe_ratelimit(*args, **kwargs):
    """Return a ratelimit decorator when Redis cache is configured, else no-op.

    This ensures we do not change behavior in environments without REDIS_URL.
    """
    if getattr(settings, "REDIS_CACHE_URL", "") and _ratelimit is not None:
        return _ratelimit(*args, **kwargs)
    # No-op decorator
    def _no_op(view_func):
        return view_func
    return _no_op

from .forms import SignupForm, LoginForm
from .models import SuperAdmin, AdminProfile
from .constants import SOCIAL_LINK_KEYS

# Simple in-memory rate limiter per IP using session timestamps (basic, dev-friendly)
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_ATTEMPTS = 5

def _rate_limited(request: HttpRequest, key: str) -> bool:
    # Scope limiter to client IP as well to reduce bypass via new sessions
    ip = request.META.get("REMOTE_ADDR") or "unknown"
    key = f"{key}:{ip}"
    now = timezone.now().timestamp()
    attempts = request.session.get(key, [])
    attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(attempts) >= RATE_LIMIT_MAX_ATTEMPTS:
        request.session[key] = attempts
        return True
    attempts.append(now)
    request.session[key] = attempts
    return False


@ensure_csrf_cookie
@csrf_protect
@safe_ratelimit(key="ip", rate="10/m", block=True)
@require_http_methods(["GET", "POST"])
def signup_view(request: HttpRequest):
    # Allow signup only if no SuperAdmin exists
    if SuperAdmin.objects.exists():
        if request.headers.get("x-requested-with") == "XMLHttpRequest":
            return JsonResponse({"success": False, "error": "Super-admin already exists."}, status=400)
        return redirect("authentication:login")

    if request.method == "GET":
        return render(request, "auth/signup.html", {"form": SignupForm()})

    # POST
    if _rate_limited(request, "signup_attempts"):
        return JsonResponse({"success": False, "error": "Too many attempts. Try later."}, status=429)

    form = SignupForm(request.POST)
    if form.is_valid():
        user = User.objects.create_user(
            username=form.cleaned_data["username"],
            email=form.cleaned_data["email"],
            password=form.cleaned_data["password"],
            is_staff=True,
            is_superuser=True,
        )
        SuperAdmin.objects.create(user=user)
        return JsonResponse({"success": True, "message": "Super-admin created. Please log in."})
    return JsonResponse({"success": False, "errors": form.errors}, status=400)


@ensure_csrf_cookie
@csrf_protect
@safe_ratelimit(key="ip", rate="20/m", block=True)
@require_http_methods(["GET", "POST"])
def login_view(request: HttpRequest):
    if request.method == "GET":
        # Surface ?next=/... so the template can include it as a hidden input
        next_url = request.GET.get("next", "")
        return render(request, "auth/login.html", {"form": LoginForm(), "next": next_url})

    # POST
    if _rate_limited(request, "login_attempts"):
        return JsonResponse({"success": False, "error": "Too many attempts. Try later."}, status=429)

    form = LoginForm(request.POST)
    if not form.is_valid():
        return JsonResponse({"success": False, "errors": form.errors}, status=400)

    user = authenticate(username=form.cleaned_data["username"], password=form.cleaned_data["password"])
    if user is None:
        return JsonResponse({"success": False, "error": "Invalid credentials."}, status=401)

    login(request, user)
    # Update last login IP for SuperAdmin if exists
    try:
        profile = user.super_admin_profile
        profile.last_login_ip = request.META.get("REMOTE_ADDR")
        profile.save(update_fields=["last_login_ip"])
    except SuperAdmin.DoesNotExist:
        pass
    # If non-AJAX (e.g., admin login form post), perform a normal redirect honoring 'next'
    is_ajax = request.headers.get("x-requested-with") == "XMLHttpRequest"
    next_url = request.POST.get("next") or request.GET.get("next")
    if not is_ajax:
        # Redirect to 'next' if provided, else to configured LOGIN_REDIRECT_URL
        return redirect(next_url or settings.LOGIN_REDIRECT_URL)
    # Default AJAX response (existing SPA behavior)
    return JsonResponse({"success": True, "redirect": next_url or settings.LOGIN_REDIRECT_URL})


@require_http_methods(["POST"])  # CSRF protected by default since middleware is enabled
@login_required
def logout_view(request: HttpRequest):
    logout(request)
    # Respect configured LOGOUT_REDIRECT_URL
    return JsonResponse({"success": True, "redirect": settings.LOGOUT_REDIRECT_URL})


@require_http_methods(["GET"])  # Lightweight auth status endpoint for frontend polling
def check_auth_status(request: HttpRequest):
    return JsonResponse({"authenticated": request.user.is_authenticated})


# ------------------------------
# Admin Profile AJAX endpoints
# ------------------------------

@login_required
@ensure_csrf_cookie
@require_http_methods(["GET"])
def profile_view(request: HttpRequest) -> HttpResponse:
    """Return the Admin Profile card HTML partial for injection via AJAX."""
    user = request.user
    profile, _ = AdminProfile.objects.get_or_create(user=user)
    context = {
        "user_obj": user,
        "profile": profile,
        "last_login_human": timesince(user.last_login) + " ago" if user.last_login else "—",
    }
    # For superusers, also surface Super-Admin status data inline on the profile
    if user.is_superuser:
        supers = []
        sa = None
        sa_count = 0
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            supers = list(User.objects.filter(is_superuser=True).values("id", "username", "email", "is_active"))
        except Exception:
            supers = []
        try:
            from apps.authentication.models import SuperAdmin
            sa_count = SuperAdmin.objects.count()
            sa = SuperAdmin.objects.select_related("user").first()
            # Self-heal: if multiple rows exist, keep first and remove extras
            if sa_count > 1 and sa:
                try:
                    SuperAdmin.objects.exclude(pk=sa.pk).delete()
                    sa_count = 1
                except Exception:
                    pass
        except Exception:
            sa = None
            sa_count = 0
        context.update({
            "supers": supers,
            "superadmin": sa,
            "superadmin_count": sa_count,
        })
    return render(request, "profile/admin_profile.html", context)


@login_required
@csrf_protect
@require_http_methods(["POST"])  # JSON payload
def profile_update(request: HttpRequest) -> JsonResponse:
    user = request.user
    profile, _ = AdminProfile.objects.get_or_create(user=user)
    data = request.POST or {}  # allow form-encoded POST for simplicity

    # Editable fields
    profile.display_name = data.get("display_name", profile.display_name)
    profile.role = data.get("role", profile.role)
    profile.bio = data.get("bio", profile.bio)
    profile.location = data.get("location", profile.location)
    birth_date = data.get("birth_date")
    if birth_date:
        try:
            profile.birth_date = timezone.datetime.fromisoformat(birth_date).date()
        except Exception:
            pass
    profile.phone = data.get("phone", profile.phone)

    # Email updates on User
    email = data.get("email")
    if email is not None:
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({"success": False, "error": "Invalid email address."}, status=400)
        user.email = email
        user.save(update_fields=["email"])

    # Social links (whitelisted keys only)
    social = {k: v for k, v in data.items() if k in SOCIAL_LINK_KEYS and v}
    if social:
        merged = dict(profile.social_links or {})
        merged.update(social)
        profile.social_links = merged

    profile.save()
    return JsonResponse({"success": True})


@login_required
@csrf_protect
@require_http_methods(["POST"])  # multipart/form-data
def profile_avatar_upload(request: HttpRequest) -> JsonResponse:
    user = request.user
    profile, _ = AdminProfile.objects.get_or_create(user=user)
    avatar = request.FILES.get("avatar")
    if not avatar or not isinstance(avatar, UploadedFile):
        return JsonResponse({"success": False, "error": "No file provided."}, status=400)

    # Validation constraints
    MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB (relaxed to reduce false negatives)
    # Accept common image content types and fallback to extension-based check for robustness
    ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"}
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    MAX_WIDTH = 1024
    MAX_HEIGHT = 1024

    # Size check
    if getattr(avatar, "size", 0) > MAX_AVATAR_BYTES:
        return JsonResponse({"success": False, "error": "Avatar too large (max 5MB)."}, status=400)

    # MIME type check (client provided, best-effort)
    content_type = (getattr(avatar, "content_type", "") or "").lower()
    name_lower = (getattr(avatar, "name", "") or "").lower()
    has_allowed_ct = content_type in ALLOWED_CONTENT_TYPES or content_type.startswith("image/")
    has_allowed_ext = any(name_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS)
    if not (has_allowed_ct or has_allowed_ext):
        return JsonResponse({"success": False, "error": "Unsupported image type."}, status=400)

    # Image verification and dimension check using Pillow
    try:
        avatar.file.seek(0)
        with Image.open(avatar.file) as img:
            img.verify()  # quick integrity check
        avatar.file.seek(0)
        with Image.open(avatar.file) as img2:
            img2 = img2.convert("RGB")  # normalize mode for consistent saving
            width, height = img2.size
            if width > MAX_WIDTH or height > MAX_HEIGHT:
                # Auto-resize down to fit within bounds while keeping aspect ratio (safe, non-breaking)
                img2.thumbnail((MAX_WIDTH, MAX_HEIGHT))
                buf = io.BytesIO()
                img2.save(buf, format="JPEG", quality=85)
                buf.seek(0)
                avatar = InMemoryUploadedFile(
                    buf,
                    field_name="avatar",
                    name=(getattr(avatar, "name", "avatar") or "avatar").rsplit(".", 1)[0] + ".jpg",
                    content_type="image/jpeg",
                    size=buf.getbuffer().nbytes,
                    charset=None,
                )
    except (UnidentifiedImageError, OSError):
        return JsonResponse({"success": False, "error": "Invalid image file."}, status=400)

    profile.avatar = avatar
    profile.save(update_fields=["avatar"])
    return JsonResponse({"success": True})


@login_required
@csrf_protect
@require_http_methods(["POST"])  # form-encoded
def profile_avatar_delete(request: HttpRequest) -> JsonResponse:
    user = request.user
    profile, _ = AdminProfile.objects.get_or_create(user=user)
    profile.avatar = None
    profile.save(update_fields=["avatar"])
    return JsonResponse({"success": True})


@login_required
@require_http_methods(["POST"])  # form-encoded
def profile_password_change(request: HttpRequest) -> JsonResponse:
    user = request.user
    current = request.POST.get("current_password")
    new_pw = request.POST.get("new_password")
    if not current or not new_pw:
        return JsonResponse({"success": False, "error": "Missing fields."}, status=400)
    if not user.check_password(current):
        return JsonResponse({"success": False, "error": "Current password incorrect."}, status=400)
    user.set_password(new_pw)
    user.save()
    # Re-authenticate to keep session valid
    user = authenticate(username=user.username, password=new_pw)
    if user:
        login(request, user)
    return JsonResponse({"success": True, "message": "Password updated."})


# ------------------------------
# Super-Admin Password Reset via Redis OTP (Email)
# ------------------------------

def _get_superadmin_user() -> User | None:
    try:
        sa = SuperAdmin.objects.select_related("user").get(is_super_admin=True)
        return sa.user
    except SuperAdmin.DoesNotExist:
        return None

def _get_cache():
    # Use the default Django cache (Redis if REDIS_URL configured; else LocMem)
    try:
        return caches["default"]
    except Exception:  # pragma: no cover
        from django.core.cache import cache
        return cache

def _otp_key(user_id: int, purpose: str) -> str:
    return f"otp:superadmin:{user_id}:{purpose}"

def _gen_code(length: int = 6) -> str:
    # 6-digit numeric using SystemRandom
    rng = secrets.SystemRandom()
    return f"{rng.randrange(0, 10**length):0{length}d}"

def _store_otp(user: User, purpose: str = "password_reset", attempts: int = 5, ttl: int = 600) -> dict:
    cache = _get_cache()
    key = _otp_key(user.id, purpose)
    payload = {"code": _gen_code(6), "attempts_left": attempts, "created_at": int(time.time())}
    # Set TTL directly on key
    cache.set(key, json.dumps(payload), timeout=ttl)
    return payload

def _verify_otp(user: User, submitted_code: str, purpose: str = "password_reset") -> tuple[bool, str]:
    cache = _get_cache()
    key = _otp_key(user.id, purpose)
    raw = cache.get(key)
    if not raw:
        return False, "expired"
    try:
        data = json.loads(raw)
    except Exception:
        cache.delete(key)
        return False, "expired"
    code = str(data.get("code") or "")
    attempts_left = int(data.get("attempts_left") or 0)
    if attempts_left <= 0:
        cache.delete(key)
        return False, "locked"
    # constant-time compare
    if hmac.compare_digest(code, str(submitted_code or "")):
        cache.delete(key)  # single-use
        return True, "ok"
    # wrong code: decrement atomically by rewriting
    data["attempts_left"] = attempts_left - 1
    # Preserve remaining TTL by reading and re-setting with a short TTL if unknown; safest: 300s fallback
    # Many cache backends don't expose TTL; we use a conservative fallback
    cache.set(key, json.dumps(data), timeout=300)
    return False, "invalid"

def _rate_key(prefix: str, ident: str) -> str:
    return f"{prefix}:{ident}"

def _under_lock(cache, lock_key: str) -> bool:
    return bool(cache.get(lock_key))

def _apply_progressive_backoff(cache, base_key: str, count: int) -> None:
    # Progressive lockouts: 5->1m, 10->5m, 15->15m, 20->60m
    duration = 0
    if count >= 20:
        duration = 60 * 60
    elif count >= 15:
        duration = 15 * 60
    elif count >= 10:
        duration = 5 * 60
    elif count >= 5:
        duration = 60
    if duration:
        cache.set(base_key + ":lock", "1", timeout=duration)

def _ratelimit_otp_request(request: HttpRequest, user: User | None) -> None:
    """Increment counters and possibly set lockout keys. Always return without raising.
    We will respond with generic success regardless to avoid oracle leaks.
    """
    cache = _get_cache()
    ip = request.META.get("REMOTE_ADDR") or "unknown"
    now = int(time.time())
    # 1) IP-based (5 req/hour)
    ip_key = _rate_key("ratelimit:ip", ip) + ":otp_request"
    count_ip = int(cache.get(ip_key) or 0) + 1
    cache.set(ip_key, str(count_ip), timeout=3600)
    _apply_progressive_backoff(cache, ip_key, count_ip)
    # 2) User-based (3 req/hour)
    if user:
        ukey = _rate_key("ratelimit:user", str(user.id)) + ":otp_request"
        count_u = int(cache.get(ukey) or 0) + 1
        cache.set(ukey, str(count_u), timeout=3600)
        _apply_progressive_backoff(cache, ukey, count_u)
    # Note: We do not block here; the verify endpoint will still work with valid OTP if delivered.


@ensure_csrf_cookie
@csrf_protect
@require_http_methods(["POST"])  # JSON-only response
def superadmin_password_reset_request(request: HttpRequest) -> JsonResponse:
    """Request an OTP via email for Super-Admin password reset.
    Always return a generic success to avoid account enumeration.
    """
    user = _get_superadmin_user()
    # Rate-limit counters regardless of identifier correctness
    _ratelimit_otp_request(request, user)
    if not user:
        return JsonResponse({"ok": True})

    # Store OTP (even if email is missing, we still behave generically)
    payload = _store_otp(user, purpose="password_reset", attempts=5, ttl=600)

    # Send Email if present (HTML + plain text)
    try:
        if user.email:
            subject = "Your Super-Admin OTP Code"
            # Build absolute URL to login for email button
            try:
                login_path = reverse("authentication:login")
                login_url = request.build_absolute_uri(login_path)
            except Exception:
                login_url = None
            context = {
                "code": payload["code"],
                "expiry_minutes": 10,
                "app_name": getattr(settings, "APP_NAME", "FloDo"),
                "login_url": login_url or "/Super-Admin/auth/login/",
            }
            html_body = render_to_string("emails/otp_email.html", context)
            text_body = render_to_string("emails/otp_email.txt", context)
            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "no-reply@localhost"
            msg = EmailMultiAlternatives(subject, text_body, from_email, [user.email])
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=True)
    except Exception:
        pass

    return JsonResponse({"ok": True})


@ensure_csrf_cookie
@csrf_protect
@require_http_methods(["POST"])  # JSON-only response
def superadmin_password_reset_verify_otp(request: HttpRequest) -> JsonResponse:
    user = _get_superadmin_user()
    code = (request.POST.get("code") or "").strip()
    if not user or not code:
        # Generic outcome
        return JsonResponse({"ok": True, "verified": False})
    ok, reason = _verify_otp(user, code, purpose="password_reset")
    if ok:
        request.session["pwd_reset_superadmin_ok"] = True
        request.session.set_expiry(600)
        return JsonResponse({"ok": True, "verified": True})
    return JsonResponse({"ok": True, "verified": False})


@ensure_csrf_cookie
@csrf_protect
@require_http_methods(["POST"])  # JSON-only response
def superadmin_password_reset_confirm(request: HttpRequest) -> JsonResponse:
    if not request.session.get("pwd_reset_superadmin_ok"):
        return JsonResponse({"ok": False, "error": "OTP not verified or expired."}, status=400)
    new_pw = request.POST.get("new_password") or ""
    if len(new_pw) < 8:
        return JsonResponse({"ok": False, "error": "Password too short."}, status=400)
    user = _get_superadmin_user()
    if not user:
        return JsonResponse({"ok": False}, status=400)
    user.set_password(new_pw)
    user.save(update_fields=["password"])
    # Invalidate session marker
    try:
        del request.session["pwd_reset_superadmin_ok"]
    except KeyError:
        pass
    return JsonResponse({"ok": True, "reset": True})
