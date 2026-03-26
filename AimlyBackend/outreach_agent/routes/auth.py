"""
Authentication Routes
Handles user login, registration, logout, password reset and JWT authentication
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, validator
import jwt
import httpx
from passlib.context import CryptContext
from datetime import datetime, timedelta
import re
import os
from typing import Optional
from core.database.connection import get_connection

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-here")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_HOURS = 24
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 7

# Internal API Key for scheduler/server-to-server calls
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "internal-secret-key")

# reCAPTCHA v3
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")
RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"
RECAPTCHA_MIN_SCORE = 0.5

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5173/auth/google/callback")
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# Password hashing — passlib handles bcrypt version differences cleanly
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Pydantic Models
class LoginRequest(BaseModel):
    identifier: str  # username or email
    password: str
    keep_me_logged_in: bool = False
    captcha_token: str

    @validator('identifier')
    def strip_identifier(cls, v):
        return v.strip() if v else v

    @validator('password')
    def strip_password(cls, v):
        return v.strip() if v else v

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    confirm_password: str
    captcha_token: str

    @validator('username')
    def validate_username(cls, v):
        v = v.strip() if v else v
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long")
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError("Username can only contain letters, numbers, and underscores")
        return v

    @validator('email')
    def validate_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', v.strip()):
            raise ValueError("Invalid email address")
        return v.strip().lower()

    @validator('password')
    def validate_password(cls, v):
        v = v.strip() if v else v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r'[A-Z]', v):
            raise ValueError("Password must contain uppercase letter")
        if not re.search(r'[a-z]', v):
            raise ValueError("Password must contain lowercase letter")
        if not re.search(r'\d', v):
            raise ValueError("Password must contain a number")
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>?]', v):
            raise ValueError("Password must contain a special character")
        return v

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        v = v.strip() if v else v
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

class ForgetPasswordRequest(BaseModel):
    email: str
    captcha_token: str

    @validator('email')
    def strip_email(cls, v):
        return v.strip().lower() if v else v

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    email: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    is_google: bool = False

class GoogleCallbackRequest(BaseModel):
    code: str

class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ==================================================================================
# Utility Functions
# ==================================================================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt via passlib."""
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hashed version."""
    return pwd_context.verify(password, hashed)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=JWT_ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token."""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, keep_me_logged_in: bool = False) -> None:
    """Set JWT tokens as HttpOnly cookies."""
    is_production = os.getenv("ENV", "development").lower() == "production"
    access_max_age  = 60 * 60 * 24 * 7  if keep_me_logged_in else 60 * 60 * 24      # 7d or 1d
    refresh_max_age = 60 * 60 * 24 * 30 if keep_me_logged_in else 60 * 60 * 24 * 7  # 30d or 7d

    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=is_production,
        samesite="strict", path="/",
        max_age=access_max_age,
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=is_production,
        samesite="strict", path="/",
        max_age=refresh_max_age,
    )


# ==================================================================================
# Authentication dependency
# ==================================================================================
def get_current_user(request: Request):
    """
    Extract user info from JWT access_token cookie.

    Also accepts internal server-to-server requests via:
      Header: X-Internal-Key: <INTERNAL_API_KEY>
      Header: X-User-Id: <user_id>
    """
    # ── Internal API key check ────────────────────────────────────────────────
    internal_key = request.headers.get("X-Internal-Key")
    if internal_key:
        if internal_key != INTERNAL_API_KEY:
            raise HTTPException(status_code=401, detail="Invalid internal API key")

        user_id = request.headers.get("X-User-Id")
        if not user_id:
            raise HTTPException(status_code=400, detail="X-User-Id header required for internal requests")

        try:
            user_id = int(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="X-User-Id must be an integer")

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return {"user_id": user_id, "username": user["username"]}

    # ── Cookie-based JWT check ────────────────────────────────────────────────
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = verify_token(token)

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id  = payload.get("user_id")
    username = payload.get("username")

    if user_id is None or username is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=401, detail="User no longer exists")

    return {"user_id": user_id, "username": username}


# ==================================================================================
# POST /auth/login - Authenticate user and return JWT tokens via cookies
# ==================================================================================
@auth_router.post("/login/")
async def login(request: LoginRequest, response: Response):
    """
    Authenticate user and set JWT tokens as HttpOnly cookies.
    identifier can be username or email.
    If keep_me_logged_in is true, longer-lived cookies are issued.
    Verifies reCAPTCHA v3 token before proceeding.
    """
    if not request.identifier or not request.password:
        raise HTTPException(status_code=400, detail="Username/email and password are required")

    # ── reCAPTCHA verification ────────────────────────────────────────────────
    if not RECAPTCHA_SECRET_KEY:
        raise HTTPException(status_code=500, detail="reCAPTCHA not configured on server")

    async with httpx.AsyncClient() as client:
        captcha_response = await client.post(
            RECAPTCHA_VERIFY_URL,
            data={
                "secret": RECAPTCHA_SECRET_KEY,
                "response": request.captcha_token,
            },
        )
        captcha_result = captcha_response.json()

    if not captcha_result.get("success") or captcha_result.get("score", 0) < RECAPTCHA_MIN_SCORE:
        raise HTTPException(status_code=400, detail="Captcha verification failed. Please try again.")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, password_hash, user_email 
            FROM users 
            WHERE username = %s OR user_email = %s
        """, (request.identifier, request.identifier))
        user = cursor.fetchone()

    if not user or not verify_password(request.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {"user_id": user["id"], "username": user["username"]}
    access_token_expires  = timedelta(days=7)  if request.keep_me_logged_in else timedelta(hours=JWT_ACCESS_TOKEN_EXPIRE_HOURS)
    refresh_token_expires = timedelta(days=30) if request.keep_me_logged_in else timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    access_token  = create_access_token(data=token_data, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data=token_data, expires_delta=refresh_token_expires)

    _set_auth_cookies(response, access_token, refresh_token, request.keep_me_logged_in)

    return {
        "user_id":  user["id"],
        "username": user["username"],
        "email":    user["user_email"],
    }


# ==================================================================================
# POST /auth/register - Register a new user account
# ==================================================================================
@auth_router.post("/register/", response_model=MessageResponse)
async def register(request: RegisterRequest):
    """
    Register a new user account.
    Creates entries for users, user_keys, and global_settings when the user is registered.
    Both username and email must be unique.
    Verifies reCAPTCHA v3 token before proceeding.
    """
    # ── reCAPTCHA verification ────────────────────────────────────────────────
    if not RECAPTCHA_SECRET_KEY:
        raise HTTPException(status_code=500, detail="reCAPTCHA not configured on server")

    async with httpx.AsyncClient() as client:
        captcha_response = await client.post(
            RECAPTCHA_VERIFY_URL,
            data={
                "secret": RECAPTCHA_SECRET_KEY,
                "response": request.captcha_token,
            },
        )
        captcha_result = captcha_response.json()

    if not captcha_result.get("success") or captcha_result.get("score", 0) < RECAPTCHA_MIN_SCORE:
        raise HTTPException(status_code=400, detail="Captcha verification failed. Please try again.")

    # ── Database operations ───────────────────────────────────────────────────
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE username = %s", (request.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username already exists")

        cursor.execute("SELECT id FROM users WHERE user_email = %s", (request.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")

        try:
            password_hash = hash_password(request.password)
            cursor.execute("""
                INSERT INTO users (username, password_hash, user_email)
                VALUES (%s, %s, %s)
            """, (request.username, password_hash, request.email))
            user_id = cursor.lastrowid
            cursor.execute("INSERT INTO user_keys (user_id) VALUES (%s)", (user_id,))
            cursor.execute("INSERT INTO global_settings (user_id) VALUES (%s)", (user_id,))
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail="Registration failed")

    return MessageResponse(message="Registration successful! Please login")


# ==================================================================================
# POST /auth/refresh - Refresh access token using refresh token cookie
# ==================================================================================
@auth_router.post("/refresh/")
def refresh_token(request: Request, response: Response):
    """
    Refresh access token using refresh_token cookie.
    If refresh token is missing or expired, clears all cookies so the browser
    doesn't keep stale tokens indefinitely.
    """
    token = request.cookies.get("refresh_token")
    if not token:
        # No cookie at all — clear everything just in case
        response.delete_cookie(key="access_token",  path="/")
        response.delete_cookie(key="refresh_token", path="/")
        raise HTTPException(status_code=401, detail="No refresh token found")

    try:
        payload = verify_token(token)
    except HTTPException:
        # Token expired or invalid — clear all cookies so browser is clean
        response.delete_cookie(key="access_token",      path="/")
        response.delete_cookie(key="refresh_token",     path="/")
        response.delete_cookie(key="llm_api_key_enc",   path="/")
        response.delete_cookie(key="tavily_api_key_enc",path="/")
        raise HTTPException(status_code=401, detail="Refresh token expired. Please log in again.")

    if payload.get("type") != "refresh":
        response.delete_cookie(key="access_token",  path="/")
        response.delete_cookie(key="refresh_token", path="/")
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id  = payload.get("user_id")
    username = payload.get("username")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, user_email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")

    token_data        = {"user_id": user_id, "username": username}
    new_access_token  = create_access_token(data=token_data)
    new_refresh_token = create_refresh_token(data=token_data)

    _set_auth_cookies(response, new_access_token, new_refresh_token)

    return {
        "user_id":  user_id,
        "username": username,
        "email":    user["user_email"],
    }


# ==================================================================================
# GET /auth/validate - Validate if token is still valid
# ==================================================================================
@auth_router.get("/validate/")
def validate_token(current_user: dict = Depends(get_current_user)):
    """Validate if token is still valid."""
    return {
        "valid": True,
        "user_id": current_user["user_id"],
        "username": current_user["username"]
    }


# ==================================================================================
# POST /auth/logout/ - Clear all cookies on logout
# ==================================================================================
@auth_router.post("/logout/")
def logout(response: Response):
    """
    Clears all HttpOnly cookies — JWT tokens and API key cookies.
    Must be called on logout so the next user on the same browser
    does not inherit the previous user's session or API keys.
    """
    response.delete_cookie(key="access_token",     path="/")
    response.delete_cookie(key="refresh_token",    path="/")
    response.delete_cookie(key="llm_api_key_enc",  path="/")
    response.delete_cookie(key="tavily_api_key_enc", path="/")
    return {"message": "Logged out successfully"}


# ==================================================================================
# GET /auth/me - Get details of the currently authenticated user
# ==================================================================================
@auth_router.get("/me/", response_model=UserResponse)
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user information."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, user_email, google_id
            FROM users WHERE id = %s
        """, (current_user["user_id"],))
        user = cursor.fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        user_id=user["id"],
        username=user["username"],
        email=user["user_email"],
        is_google=user["google_id"] is not None,
    )


# ==================================================================================
# POST /auth/forget_password - Generate a new random password and send via email
# ==================================================================================
@auth_router.post("/forget_password/", response_model=MessageResponse)
async def forget_password(request: ForgetPasswordRequest):
    """
    Generate a new random password for the user.
    Takes the user's email as payload and sends the new password via email.
    Verifies reCAPTCHA v3 token before proceeding.
    """
    import secrets
    import string
    from services.email_service import send_email

    # ── reCAPTCHA verification ────────────────────────────────────────────────
    if not RECAPTCHA_SECRET_KEY:
        raise HTTPException(status_code=500, detail="reCAPTCHA not configured on server")

    async with httpx.AsyncClient() as client:
        captcha_response = await client.post(
            RECAPTCHA_VERIFY_URL,
            data={
                "secret": RECAPTCHA_SECRET_KEY,
                "response": request.captcha_token,
            },
        )
        captcha_result = captcha_response.json()

    if not captcha_result.get("success") or captcha_result.get("score", 0) < RECAPTCHA_MIN_SCORE:
        raise HTTPException(status_code=400, detail="Captcha verification failed. Please try again.")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username FROM users WHERE user_email = %s", (request.email,))
        user = cursor.fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="Email address not found in our system")

    # Generate a truly random password that satisfies complexity requirements
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        new_password = ''.join(secrets.choice(chars) for _ in range(12))
        if (re.search(r'[A-Z]', new_password) and re.search(r'[a-z]', new_password)
                and re.search(r'\d', new_password) and re.search(r'[!@#$%^&*]', new_password)):
            break

    password_hash = hash_password(new_password)

    try:
        smtp_config = {
            "sender_email":    os.getenv("EMAIL_HOST_USER"),
            "sender_password": os.getenv("EMAIL_HOST_PASSWORD"),
            "smtp_host":       os.getenv("EMAIL_SMTP_SERVER", "smtp.gmail.com"),
            "smtp_port":       int(os.getenv("EMAIL_SMTP_PORT", "587")),
            "bcc":             None,
        }

        if not smtp_config["sender_email"] or not smtp_config["sender_password"]:
            raise HTTPException(status_code=500, detail="Email service not configured")

        email_body = f"""
        Hello {user['username']},

        A password reset was requested for your AI Email Outreach Pro account.

        Your new temporary password is:

        {new_password}

        Please log in using this password and change it immediately from your account settings.

        If you did not request this reset, please contact support immediately at support@aiemailoutreach.com.

        ---
        This is an automated message. Please do not reply.
        © 2026 AI Email Outreach Pro
        """

        result = await send_email(
            company_name=f"User {user['username']}",
            company_email=request.email,
            email_body=email_body,
            subject="Password Reset - AI Email Outreach Pro",
            smtp_config=smtp_config,
            email_id=None,
        )

        if not result.success:
            raise HTTPException(status_code=500, detail="Failed to send email. Please try again later")

        # Only update the password in DB after email is confirmed sent
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE users SET password_hash = %s WHERE user_email = %s
            """, (password_hash, request.email))
            conn.commit()

        return MessageResponse(message="A new password has been sent to your email address")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email. Please try again later")


# ==================================================================================
# GET /auth/google/ - Return Google OAuth URL for frontend to redirect to
# ==================================================================================
@auth_router.get("/google/")
def google_oauth_url():
    """
    Build and return the Google OAuth authorization URL.
    Frontend redirects the browser to this URL to start the OAuth flow.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured on server")

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{GOOGLE_AUTH_URL}?{query_string}"
    return {"url": url}


# ==================================================================================
# POST /auth/google/callback/ - Exchange code, verify user, issue JWT via cookies
# ==================================================================================
@auth_router.post("/google/callback/")
async def google_callback(request: GoogleCallbackRequest, response: Response):
    """
    Receives the authorization code from the frontend after Google redirects.
    Exchanges the code for tokens, verifies the user's identity, and:
      - Existing Google user  → login
      - Email already exists  → reject (tell user to use password login)
      - New user              → auto-register then login
    Returns the same TokenResponse as normal login.
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured on server")

    # ── Step 1: Exchange code for Google tokens ───────────────────────────────
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": request.code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

    token_data = token_response.json()

    if "error" in token_data:
        raise HTTPException(status_code=400, detail=f"Google token exchange failed: {token_data.get('error_description', token_data['error'])}")

    google_access_token = token_data.get("access_token")
    if not google_access_token:
        raise HTTPException(status_code=400, detail="Failed to obtain Google access token")

    # ── Step 2: Get user info from Google ─────────────────────────────────────
    async with httpx.AsyncClient() as client:
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )

    if userinfo_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")

    userinfo = userinfo_response.json()

    google_id = userinfo.get("sub")
    email = userinfo.get("email", "").strip().lower()
    name = userinfo.get("name", "")
    email_verified = userinfo.get("email_verified", False)

    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Google account missing required information")

    if not email_verified:
        raise HTTPException(status_code=400, detail="Google account email is not verified")

    # ── Step 3: DB lookup / register ──────────────────────────────────────────
    with get_connection() as conn:
        cursor = conn.cursor()

        # Check if google_id already exists → returning Google user
        cursor.execute("SELECT id, username, user_email FROM users WHERE google_id = %s", (google_id,))
        existing_google_user = cursor.fetchone()

        if existing_google_user:
            # Known Google user → just log them in
            user_id = existing_google_user["id"]
            username = existing_google_user["username"]

        else:
            # Check if email exists with a password account
            cursor.execute("SELECT id, google_id FROM users WHERE user_email = %s", (email,))
            existing_email_user = cursor.fetchone()

            if existing_email_user:
                # Email registered manually → reject
                raise HTTPException(
                    status_code=409,
                    detail="This email is already registered. Please log in with your password."
                )

            # Brand new user → auto-register
            # Generate a clean username from their Google display name
            base_username = re.sub(r'[^a-zA-Z0-9_]', '', name.replace(' ', '_'))[:20] or "user"
            username = base_username

            # If username taken, append numbers until unique
            counter = 1
            while True:
                cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
                if not cursor.fetchone():
                    break
                username = f"{base_username}{counter}"
                counter += 1

            try:
                cursor.execute("""
                    INSERT INTO users (username, password_hash, user_email, google_id)
                    VALUES (%s, NULL, %s, %s)
                """, (username, email, google_id))
                user_id = cursor.lastrowid
                cursor.execute("INSERT INTO user_keys (user_id) VALUES (%s)", (user_id,))
                cursor.execute("INSERT INTO global_settings (user_id) VALUES (%s)", (user_id,))
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"Google auto-registration failed: {e}")
                raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

    # ── Step 4: Set cookies and return user info ──────────────────────────────
    token_data    = {"user_id": user_id, "username": username}
    access_token  = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    _set_auth_cookies(response, access_token, refresh_token)

    return {
        "user_id":  user_id,
        "username": username,
        "email":    email,
    }