import hashlib

from rest_framework.throttling import SimpleRateThrottle


class LoginEmailThrottle(SimpleRateThrottle):
    """Limits sign-in attempts per email address, so a botnet can't brute-force one account from many IPs."""

    scope = "login_email"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        return self.cache_format % {"scope": self.scope, "ident": hashlib.sha256(email.encode()).hexdigest()}
