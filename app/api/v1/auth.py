from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List

from app.core.security import create_access_token, get_current_user
from app.services.user_service import user_service

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., example="abhishekad152003@gmail.com")
    password: str = Field(..., example="123456")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_master_admin: bool
    department: Optional[str] = None


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_master_admin: bool
    department: Optional[str] = None
    accessible_documents: List[Dict[str, Any]] = Field(default_factory=list)


@router.post("/login", response_model=LoginResponse, summary="Log in with email & password")
def login(payload: LoginRequest):
    # Ensure master admin exists in DB
    try:
        user_service.ensure_master_admin_exists()
    except Exception:
        pass

    user = user_service.authenticate_user(email=payload.email, password=payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT access token
    token_payload = {
        "sub": user["user_id"],
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "is_master_admin": user.get("is_master_admin", False),
        "department": user.get("department"),
    }
    access_token = create_access_token(data=token_payload)

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user["user_id"],
        email=user["email"],
        full_name=user.get("full_name"),
        role=user["role"],
        is_master_admin=user.get("is_master_admin", False),
        department=user.get("department"),
    )


@router.get("/me", response_model=UserProfileResponse, summary="Get current logged-in user profile")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user["sub"]
    user = user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return UserProfileResponse(**user)
