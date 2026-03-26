"""
User Management Routes
Handles user profile updates and account deletion
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
import bcrypt
import re
from core.database.connection import get_connection
from routes.auth import get_current_user

user_router = APIRouter(prefix="/user", tags=["User Management"])

# Pydantic Models
class UserUpdateRequest(BaseModel):
    username: str = None
    email: str = None
    password: str  # Current password required for authentication
    new_password: str = None  # Optional new password

    @validator('email')
    def validate_email(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', v.strip()):
            raise ValueError("Invalid email address")
        return v.strip().lower() if v else None

    @validator('username')
    def validate_username(cls, v):
        if v:
            v = v.strip()
            if len(v) < 3:
                raise ValueError("Username must be at least 3 characters long")
            if not re.match(r'^[a-zA-Z0-9_]+$', v):
                raise ValueError("Username can only contain letters, numbers, and underscores")
        return v

    @validator('password')
    def strip_password(cls, v):
        return v.strip() if v else v

    @validator('new_password')
    def validate_new_password(cls, v):
        if v is not None:  # Only validate if new_password is provided
            v = v.strip() if v else v  # Strip spaces first
            if len(v) < 8:
                raise ValueError("New password must be at least 8 characters long")
            if not re.search(r'[A-Z]', v):
                raise ValueError("New password must contain uppercase letter")
            if not re.search(r'[a-z]', v):
                raise ValueError("New password must contain lowercase letter")
            if not re.search(r'\d', v):
                raise ValueError("New password must contain a number")
            if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>?]', v):
                raise ValueError("New password must contain a special character")
        return v

class DeleteAccountRequest(BaseModel):
    password: str = ""

    @validator('password')
    def strip_password(cls, v):
        return v.strip() if v else v

class MessageResponse(BaseModel):
    message: str
    success: bool = True

# Utility Functions
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    if isinstance(password, str):
        password = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password, salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hashed version."""
    if isinstance(password, str):
        password = password.encode('utf-8')
    if isinstance(hashed, str):
        hashed = hashed.encode('utf-8')
    return bcrypt.checkpw(password, hashed)


# ==================================================================================
# PUT /user - Update user data (including password change)
# ==================================================================================
@user_router.put("/", response_model=MessageResponse)
def update_user(request: UserUpdateRequest, current_user: dict = Depends(get_current_user)):
    """
    Update user data including password change.
    Password is required in the payload for authentication.
    Can update username, email, and/or password if provided.
    """
    user_id = current_user["user_id"]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Block Google users from modifying their profile
        cursor.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user["password_hash"] is None:
            raise HTTPException(status_code=403, detail="This account uses Google sign-in. Profile changes are not allowed.")

        # Verify current password first
        if not verify_password(request.password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid current password")
        
        # Prepare update fields
        update_fields = []
        update_values = []
        
        if request.username:
            # Check if username already exists for another user
            cursor.execute("SELECT id FROM users WHERE username = %s AND id != %s", (request.username, user_id))
            if cursor.fetchone():
                raise HTTPException(status_code=409, detail="Username already exists")
            update_fields.append("username = %s")
            update_values.append(request.username)
            
        if request.email:
            # Check if email already exists for another user
            cursor.execute("SELECT id FROM users WHERE user_email = %s AND id != %s", (request.email, user_id))
            if cursor.fetchone():
                raise HTTPException(status_code=409, detail="Email already exists")
            update_fields.append("user_email = %s")
            update_values.append(request.email)
        
        if request.new_password:
            # Check if new password is same as current
            if verify_password(request.new_password, user['password_hash']):
                raise HTTPException(status_code=400, detail="New password cannot be the same as current password")
            
            # Hash new password and add to update fields
            new_password_hash = hash_password(request.new_password)
            update_fields.append("password_hash = %s")
            update_values.append(new_password_hash)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update user
        update_values.append(user_id)
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
        
        try:
            cursor.execute(query, update_values)
            conn.commit()
            
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
                
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail="Update failed")
    
    # Return appropriate success message
    if request.new_password:
        if request.username or request.email:
            return MessageResponse(message="Profile and password updated successfully")
        else:
            return MessageResponse(message="Password updated successfully")
    else:
        return MessageResponse(message="Profile updated successfully")


# ==================================================================================
# DELETE /user - Delete the currently authenticated user account
# ==================================================================================
@user_router.delete("/", response_model=MessageResponse)
def delete_user(request: DeleteAccountRequest, current_user: dict = Depends(get_current_user)):
    """
    Delete the currently authenticated user account.
    Requires current password for authentication.
    This will cascade delete all related data due to foreign key constraints.
    """
    user_id = current_user["user_id"]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Fetch user
        cursor.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # For normal accounts, verify password. Google accounts have no password so skip.
        if user["password_hash"] is not None:
            if not verify_password(request.password, user['password_hash']):
                raise HTTPException(status_code=401, detail="Invalid password")
        
        try:
            # Delete user (cascade will handle related records)
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
            
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
            
            conn.commit()
            print(f"Successfully deleted user account {user_id}")
            
        except Exception as e:
            conn.rollback()
            print(f"Failed to delete user {user_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete user account")
    
    return MessageResponse(message="User account deleted successfully")