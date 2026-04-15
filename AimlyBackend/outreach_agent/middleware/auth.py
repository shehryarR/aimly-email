"""
Authentication Middleware for AI Email Outreach Pro
Handles JWT token validation with optional authentication for public endpoints
"""

import jwt
import os
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timezone
from typing import Optional, Dict, Any

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Security scheme
security = HTTPBearer(auto_error=False)

class OptionalAuthMiddleware(BaseHTTPMiddleware):
    """
    Optional authentication middleware that allows both authenticated and public access.
    Sets user context when token is present and valid.
    """

    async def dispatch(self, request: Request, call_next):
        # List of public endpoints that don't require authentication
        public_endpoints = [
            "/",
            "/api/health",
            "/api/security/origins",
            "/api/confirm/",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/subscription/webhook",  # Paddle webhook — verified by signature not JWT
        ]

        is_public = any(request.url.path.startswith(endpoint) for endpoint in public_endpoints)

        user_context = None
        token = request.cookies.get("access_token")

        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

                exp = payload.get("exp")
                if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
                    if not is_public:
                        return HTTPException(status_code=401, detail="Token expired")
                else:
                    username = payload.get("sub")
                    if username:
                        from core.database.connection import get_connection
                        with get_connection() as conn:
                            with conn.cursor() as cursor:
                                cursor.execute(
                                    "SELECT id, username, user_email FROM users WHERE username = %s",
                                    (username,)
                                )
                                user_data = cursor.fetchone()

                        if user_data:
                            user_context = {
                                "user_id": user_data.get("id"),
                                "username": user_data.get("username"),
                                "email": user_data.get("user_email", ""),
                                "token_valid": True
                            }

            except jwt.InvalidTokenError as e:
                print(f"Invalid JWT token: {e}")
                if not is_public:
                    return HTTPException(status_code=401, detail="Invalid token")

        if not is_public and not user_context:
            return HTTPException(status_code=401, detail="Authentication required")

        request.state.user = user_context

        response = await call_next(request)
        return response


def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user (required).
    Raises 401 if user is not authenticated.
    """
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """
    Dependency to get current user if authenticated (optional).
    Returns None if user is not authenticated.
    """
    return getattr(request.state, 'user', None)


def require_subscription(request: Request) -> Dict[str, Any]:
    """
    Dependency that requires both authentication AND an active subscription.
    Raises 401 if not logged in, 403 if subscription is not active/trialing.

    Usage:
        @router.get("/some-route")
        def some_route(user=Depends(require_subscription)):
            ...
    """
    from core.database.connection import get_connection

    user = get_current_user(request)  # raises 401 if not authenticated
    user_id = user["user_id"]

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT status FROM subscriptions WHERE user_id = %s",
                (user_id,)
            )
            subscription = cursor.fetchone()

    if not subscription or subscription.get("status") not in ("trialing", "active"):
        raise HTTPException(
            status_code=403,
            detail="Active subscription required"
        )

    return user


def create_access_token(data: dict, expires_delta: Optional[int] = None) -> str:
    """Create JWT access token."""
    from datetime import timedelta
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_delta if expires_delta else 30
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[int] = None) -> str:
    """Create JWT refresh token."""
    from datetime import timedelta
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=expires_delta if expires_delta else 7
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_refresh_token(token: str) -> Dict[str, Any]:
    """Verify and decode refresh token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Refresh token expired")

        return payload

    except jwt.InvalidTokenError as e:
        print(f"Refresh token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid refresh token")