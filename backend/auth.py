"""
Server-side session auth — a single shared site password, not per-user
accounts. Session state is a signed, stateless token (HMAC-SHA256 + expiry)
stored in an httpOnly cookie, so there's no session store/database needed
and it survives serverless cold starts.

Required environment variables (set in Vercel Project Settings, not in code):
  SITE_PASSWORD   — the shared password visitors must enter
  SESSION_SECRET  — random secret used to sign session tokens

Fails closed: if either env var is missing, every protected request is
rejected rather than silently allowed through.
"""
import base64
import hashlib
import hmac
import os
import time

from fastapi import Depends, HTTPException, Request

SESSION_COOKIE_NAME = "hc_session"
SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60  # 14 days


def _secret() -> bytes:
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="Server auth is not configured (SESSION_SECRET missing).")
    return secret.encode("utf-8")


def check_password(candidate: str) -> bool:
    expected = os.environ.get("SITE_PASSWORD")
    if not expected:
        raise HTTPException(status_code=503, detail="Server auth is not configured (SITE_PASSWORD missing).")
    return hmac.compare_digest(candidate, expected)


def create_session_token() -> str:
    # No "=" padding in the encoded payload — an unpadded value never needs
    # quoting in a Set-Cookie header, avoiding a whole class of quote/escaping
    # bugs on the round trip through the browser's cookie jar.
    expiry = int(time.time()) + SESSION_MAX_AGE_SECONDS
    payload = str(expiry).encode("utf-8")
    encoded_payload = base64.urlsafe_b64encode(payload).decode("utf-8").rstrip("=")
    sig = hmac.new(_secret(), payload, hashlib.sha256).hexdigest()
    return encoded_payload + "." + sig


def verify_session_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    encoded_payload, sig = token.rsplit(".", 1)
    try:
        padded = encoded_payload + "=" * (-len(encoded_payload) % 4)
        payload = base64.urlsafe_b64decode(padded.encode("utf-8"))
        expiry = int(payload.decode("utf-8"))
    except Exception:
        return False
    expected_sig = hmac.new(_secret(), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return False
    return time.time() < expiry


def require_session(request: Request) -> None:
    """FastAPI dependency — attach to any router that needs a logged-in session."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not verify_session_token(token):
        raise HTTPException(status_code=401, detail="Not authenticated.")


RequireSession = Depends(require_session)
