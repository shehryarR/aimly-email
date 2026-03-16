"""
Authentication Routes
Handles user login, registration, logout, password reset and JWT authentication
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, validator
import jwt
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

# Password hashing — passlib handles bcrypt version differences cleanly
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Pydantic Models
class LoginRequest(BaseModel):
    identifier: str  # username or email
    password: str
    keep_me_logged_in: bool = False

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


# ==================================================================================
# Authentication dependency
# ==================================================================================
def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Extract user info from JWT token.

    Also accepts internal server-to-server requests via:
      Header: X-Internal-Key: <INTERNAL_API_KEY>
      Header: X-User-Id: <user_id>

    This allows the scheduler to call endpoints directly without a JWT token.
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

        # Verify user exists
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
            user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return {"user_id": user_id, "username": user["username"]}

    # ── Normal JWT check ──────────────────────────────────────────────────────
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    payload = verify_token(token)

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("user_id")
    username = payload.get("username")

    if user_id is None or username is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Verify user still exists
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=401, detail="User no longer exists")

    return {"user_id": user_id, "username": username, "token": token}


# ==================================================================================
# POST /auth/login - Authenticate user and return JWT tokens
# ==================================================================================
@auth_router.post("/login/", response_model=TokenResponse)
def login(request: LoginRequest):
    """
    Authenticate user and return JWT tokens.
    identifier can be username or email.
    If keep_me_logged_in is true, longer access token is issued.
    """
    if not request.identifier or not request.password:
        raise HTTPException(status_code=400, detail="Username/email and password are required")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, password_hash, user_email 
            FROM users 
            WHERE username = ? OR user_email = ?
        """, (request.identifier, request.identifier))
        user = cursor.fetchone()

    if not user or not verify_password(request.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {"user_id": user["id"], "username": user["username"]}
    access_token_expires = timedelta(days=7) if request.keep_me_logged_in else timedelta(hours=JWT_ACCESS_TOKEN_EXPIRE_HOURS)
    refresh_token_expires = timedelta(days=30) if request.keep_me_logged_in else timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    access_token = create_access_token(data=token_data, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data=token_data, expires_delta=refresh_token_expires)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user["id"],
        username=user["username"],
        email=user["user_email"]
    )


# ==================================================================================
# POST /auth/register - Register a new user account
# ==================================================================================
@auth_router.post("/register/", response_model=MessageResponse)
def register(request: RegisterRequest):
    """
    Register a new user account.
    Creates entries for users, user_keys, and global_settings when the user is registered.
    Both username and email must be unique.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE username = ?", (request.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username already exists")

        cursor.execute("SELECT id FROM users WHERE user_email = ?", (request.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")

        try:
            password_hash = hash_password(request.password)
            cursor.execute("""
                INSERT INTO users (username, password_hash, user_email)
                VALUES (?, ?, ?)
            """, (request.username, password_hash, request.email))
            user_id = cursor.lastrowid
            cursor.execute("INSERT INTO user_keys (user_id) VALUES (?)", (user_id,))
            cursor.execute("INSERT INTO global_settings (user_id) VALUES (?)", (user_id,))
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail="Registration failed")

    return MessageResponse(message="Registration successful! Please login")


# ==================================================================================
# POST /auth/refresh - Refresh access token using refresh token
# ==================================================================================
@auth_router.post("/refresh/", response_model=TokenResponse)
def refresh_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    payload = verify_token(request.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("user_id")
    username = payload.get("username")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, user_email FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")

    token_data = {"user_id": user_id, "username": username}
    new_access_token = create_access_token(data=token_data)
    new_refresh_token = create_refresh_token(data=token_data)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user_id=user_id,
        username=username,
        email=user["user_email"]
    )


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
# GET /auth/me - Get details of the currently authenticated user
# ==================================================================================
@auth_router.get("/me/", response_model=UserResponse)
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user information."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, user_email
            FROM users WHERE id = ?
        """, (current_user["user_id"],))
        user = cursor.fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        user_id=user["id"],
        username=user["username"],
        email=user["user_email"],
    )


# ==================================================================================
# POST /auth/forget_password - Generate a new random password and send via email
# ==================================================================================
@auth_router.post("/forget_password/", response_model=MessageResponse)
async def forget_password(request: ForgetPasswordRequest):
    """
    Generate a new random password for the user.
    Takes the user's email as payload and sends the new password via email.
    """
    import secrets
    import string
    from services.email_service import send_email

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username FROM users WHERE user_email = ?", (request.email,))
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
                UPDATE users SET password_hash = ? WHERE user_email = ?
            """, (password_hash, request.email))
            conn.commit()

        return MessageResponse(message="A new password has been sent to your email address")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email. Please try again later")