from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
# this makes the email looks nice 
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape

from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.audit.services import log as audit_log
from apps.core.mixins import SchoolScopedQuerysetMixin
from apps.core.permissions import SCHOOL_ADMIN, role_required
from apps.core.throttles import LoginEmailThrottle

from .models import User
from .serializers import (
    ChangePasswordSerializer, LoginSerializer, PasswordResetConfirmSerializer, PasswordResetRequestSerializer,
    UserSerializer, UserSummarySerializer,
)

REFRESH_COOKIE = "refresh_token"
AUTH_PATH = "/api/v1/auth/"


def _set_refresh_cookie(response, token):
    # HttpOnly: JavaScript (and therefore any injected script) can never read the refresh token.
    response.set_cookie(
        REFRESH_COOKIE, token, max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True, secure=not settings.DEBUG, samesite="Strict", path=AUTH_PATH,
    )


def _require_xhr(request):
    """Defence in depth on top of SameSite=Strict: a cross-site form post cannot add this header."""
    if request.headers.get("X-Requested-With") != "XMLHttpRequest":
        raise PermissionDenied("Missing X-Requested-With header.")


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle, LoginEmailThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh = response.data.pop("refresh", None) if response.status_code == 200 else None
        if refresh:
            _set_refresh_cookie(response, refresh)
        return response


class RefreshView(APIView):
    """Exchange the refresh cookie for a new access token (and rotate the cookie)."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        _require_xhr(request)
        token = request.COOKIES.get(REFRESH_COOKIE)
        if not token:
            return Response({"detail": "Not signed in."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = TokenRefreshView.serializer_class(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc
        data = dict(serializer.validated_data)
        new_refresh = data.pop("refresh", None)
        response = Response(data)
        if new_refresh:
            _set_refresh_cookie(response, new_refresh)
        return response


class LogoutView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        _require_xhr(request)
        token = request.COOKIES.get(REFRESH_COOKIE)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(REFRESH_COOKIE, path=AUTH_PATH)
        return response


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSummarySerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if not request.user.check_password(ser.validated_data["old_password"]):
            return Response({"old_password": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(ser.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        audit_log(request.user, "user.password_changed", request.user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    """Always answers 200 so the endpoint can't be used to discover which emails have accounts."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle, LoginEmailThrottle]
    throttle_scope = "login"

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=ser.validated_data["email"], is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"
            school = escape(user.school.name) if user.school_id else "School"
            name = escape(user.first_name or "there")
            safe_link = escape(link)
            text = (
                f"Hello {user.first_name or ''},\n\nUse this link to choose a new password:\n{link}\n\n"
                "The link works once and expires in 3 days.\n"
                "If you didn't ask for this, you can ignore this email."
            )
            html = f"""
                    <div style="background:#F5F4EF;padding:32px 12px;font-family:Segoe UI,Arial,sans-serif;color:#16201D">
                    <table role="presentation" align="center" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #DAD8CF;border-radius:10px;overflow:hidden">
                        <tr><td style="background:#1E3A34;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:600">{school}<span style="color:#F2C230">.</span></td></tr>
                        <tr><td style="padding:28px">
                        <h1 style="margin:0 0 12px;font-size:22px;font-weight:600">Reset your password</h1>
                        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hello {name},</p>
                        <p style="margin:0 0 24px;font-size:15px;line-height:1.6">We received a request to reset the password for your account. Choose a new one with the button below.</p>
                        <p style="margin:0 0 24px"><a href="{safe_link}" style="display:inline-block;background:#1E3A34;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:6px">Choose a new password</a></p>
                        <p style="margin:0 0 8px;font-size:13px;color:#5E6D68">This link works once and expires in 3 days.</p>
                        <p style="margin:0 0 16px;font-size:13px;color:#5E6D68">If the button doesn't work, copy this address into your browser:<br><a href="{safe_link}" style="color:#1E3A34;word-break:break-all">{safe_link}</a></p>
                        <p style="margin:0;font-size:13px;color:#5E6D68">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
                        </td></tr>
                    </table>
                    </div>"""
            msg = EmailMultiAlternatives("Reset your password", text, settings.DEFAULT_FROM_EMAIL, [user.email])
            msg.attach_alternative(html, "text/html")
            msg.send()
            audit_log(user, "user.password_reset_requested", user, request=request)
        return Response({"detail": "If that email has an account, a reset link is on its way."})


class PasswordResetConfirmView(APIView):
    permission_classes = []
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(d["uid"])), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None
        if user is None or not default_token_generator.check_token(user, d["token"]):
            return Response({"detail": "This reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(d["new_password"])
        user.save(update_fields=["password"])  # also invalidates the token and all other reset links
        audit_log(user, "user.password_reset", user, request=request)
        return Response({"detail": "Password updated. You can sign in now."})


class UserViewSet(SchoolScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [role_required(SCHOOL_ADMIN)]
    filterset_fields = ["role", "is_active"]
    search_fields = ["email", "first_name", "last_name"]

    def perform_create(self, serializer):
        user = serializer.save(school=self.request.user.school)
        audit_log(self.request.user, "user.created", user, {"role": user.role}, request=self.request)

    def perform_update(self, serializer):
        before = serializer.instance.role
        user = serializer.save()
        if before != user.role:
            audit_log(self.request.user, "user.role_changed", user, {"from": before, "to": user.role}, request=self.request)
