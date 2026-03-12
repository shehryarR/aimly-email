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
from core.database import get_user_by_username

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    from core.database import load_env_json
    load_env_json()
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Security scheme
security = HTTPBearer(auto_error=False)

class OptionalAuthMiddleware(BaseHTTPMiddleware):
    """
    Optional authentication middleware that allows both authenticated and public access
    Sets user context when token is present and valid
    """
    
    async def dispatch(self, request: Request, call_next):
        # List of public endpoints that don't require authentication
        public_endpoints = [
            "/",
            "/api/health", 
            "/api/security/origins",
            "/api/confirm/",  # Email confirmation API (optional auth)
            "/docs",
            "/openapi.json",
            "/redoc"
        ]
        
        # Check if this is a public endpoint
        is_public = any(request.url.path.startswith(endpoint) for endpoint in public_endpoints)
        
        # Extract and validate JWT token if present
        user_context = None
        auth_header = request.headers.get("authorization")
        
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
                
                # Check token expiration
                exp = payload.get("exp")
                if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
                    if not is_public:
                        return HTTPException(status_code=401, detail="Token expired")
                else:
                    # Token is valid, get user context
                    username = payload.get("sub")
                    if username:
                        user_data = get_user_by_username(username)
                        if user_data:
                            user_context = {
                                "user_id": user_data.get("id"),
                                "username": user_data.get("username"),
                                "email": user_data.get("email_address", ""),
                                "token_valid": True
                            }
                        
            except jwt.InvalidTokenError as e:
                print(f"Invalid JWT token: {e}")
                if not is_public:
                    return HTTPException(status_code=401, detail="Invalid token")
        
        # For protected endpoints, require authentication
        if not is_public and not user_context:
            return HTTPException(status_code=401, detail="Authentication required")
        
        # Add user context to request state
        request.state.user = user_context
        
        # Continue with the request
        response = await call_next(request)
        return response

def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user (required)
    Raises 401 if user is not authenticated
    """
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """
    Dependency to get current user if authenticated (optional)
    Returns None if user is not authenticated
    """
    return getattr(request.state, 'user', None)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[Dict[str, Any]]:
    """
    Verify JWT token and return user data
    Used for endpoints that need explicit token verification
    """
    if not credentials:
        return None
        
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        # Check token expiration
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Token expired")
        
        # Get user data
        username = payload.get("sub")
        if username:
            user_data = get_user_by_username(username)
            if user_data:
                return {
                    "user_id": user_data.get("id"),
                    "username": user_data.get("username"),
                    "email": user_data.get("email_address", ""),
                    "token_valid": True
                }
        
        raise HTTPException(status_code=401, detail="User not found")
        
    except jwt.InvalidTokenError as e:
        print(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def create_access_token(data: dict, expires_delta: Optional[int] = None) -> str:
    """Create JWT access token"""
    from datetime import timedelta
    
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + timedelta(minutes=expires_delta)
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=30)  # Default 30 minutes
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[int] = None) -> str:
    """Create JWT refresh token"""
    from datetime import timedelta
    
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + timedelta(days=expires_delta)
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)  # Default 7 days
    
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_refresh_token(token: str) -> Dict[str, Any]:
    """Verify and decode refresh token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        # Check if it's a refresh token
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        # Check token expiration
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Refresh token expired")
        
        return payload
        
    except jwt.InvalidTokenError as e:
        print(f"Refresh token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid refresh token")