"""Authentication: Microsoft Entra ID (OIDC bearer tokens) with a dev/demo
auto-login bypass controlled by the AUTO_LOGIN_USER environment variable.

Token flow (production): the SPA acquires an access token via Authorization
Code Flow with PKCE (MSAL) and sends it as a Bearer token. We validate the
signature against the tenant JWKS and map the `roles` claim (app roles
Admin/User) to the local user record.

Bypass flow (dev/demo): when AUTO_LOGIN_USER is set and no Bearer token is
sent, that user is signed in automatically and granted the Admin role.
"""
import time

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import User

_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL = 3600


def _get_jwks(tenant_id: str) -> dict:
    now = time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWKS_TTL:
        return _jwks_cache["keys"]
    url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    _jwks_cache.update(keys=resp.json(), fetched_at=now)
    return _jwks_cache["keys"]


def _validate_entra_token(token: str) -> dict:
    settings = get_settings()
    if not settings.entra_tenant_id:
        raise HTTPException(status_code=401, detail="Entra ID is not configured")
    jwks = _get_jwks(settings.entra_tenant_id)
    header = jwt.get_unverified_header(token)
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None)
    if key is None:
        raise HTTPException(status_code=401, detail="Unknown signing key")
    audience = settings.entra_audience or f"api://{settings.entra_client_id}"
    try:
        return jwt.decode(
            token,
            jwt.PyJWK(key).key,
            algorithms=["RS256"],
            audience=audience,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc


def _get_or_create_user(db: Session, email: str, name: str, is_admin: bool) -> User:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user is None:
        user = User(email=email.lower(), name=name, is_admin=is_admin)
        db.add(user)
        db.commit()
    elif is_admin and not user.is_admin:
        user.is_admin = True
        db.commit()
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    auth_header = request.headers.get("authorization", "")

    if auth_header.lower().startswith("bearer "):
        claims = _validate_entra_token(auth_header[7:])
        email = claims.get("preferred_username") or claims.get("upn") or claims.get("email") or ""
        if not email:
            raise HTTPException(status_code=401, detail="Token contains no user identity")
        roles = claims.get("roles", []) or []
        is_admin = "Admin" in roles or (
            settings.auto_login_user and email.lower() == settings.auto_login_user.lower()
        )
        return _get_or_create_user(db, email, claims.get("name", email), bool(is_admin))

    # Dev/demo bypass — disabled by setting AUTO_LOGIN_USER to an empty string.
    if settings.auto_login_user:
        return _get_or_create_user(
            db, settings.auto_login_user, settings.auto_login_name, is_admin=True
        )

    raise HTTPException(status_code=401, detail="Not authenticated")


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
