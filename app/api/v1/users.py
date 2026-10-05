from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any

from app.core.security import require_admin, get_current_user
from app.services.user_service import user_service

router = APIRouter()


class CreateUserRequest(BaseModel):
    email: EmailStr = Field(..., example="operator@company.com")
    password: str = Field(..., min_length=6, example="password123")
    full_name: Optional[str] = Field(None, example="John Doe")
    role: str = Field(default="employee", description="Role: 'master_admin', 'admin', or 'employee'")
    department: Optional[str] = Field(None, example="QC")
    document_ids: Optional[List[str]] = Field(default=[], description="List of document UUIDs this employee is granted access to")


class UserAccessUpdateRequest(BaseModel):
    document_ids: List[str] = Field(..., description="List of document UUIDs to grant access to")


class UserDetailResponse(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str] = None
    role: str
    department: Optional[str] = None
    is_master_admin: bool = False
    created_at: Optional[str] = None
    accessible_documents: List[Dict[str, Any]] = Field(default_factory=list)


@router.get(
    "/",
    response_model=List[UserDetailResponse],
    summary="List all users and their assigned document access (Admin only)",
)
def list_users(current_admin: Dict[str, Any] = Depends(require_admin)):
    try:
        users = user_service.list_users()
        return [UserDetailResponse(**u) for u in users]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list users: {str(exc)}",
        )


@router.post(
    "/",
    response_model=UserDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Admin or Employee with document access (Admin only)",
)
def create_user(payload: CreateUserRequest, current_admin: Dict[str, Any] = Depends(require_admin)):
    if payload.role not in ["master_admin", "admin", "employee"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'master_admin', 'admin', or 'employee'.",
        )

    try:
        user = user_service.create_user(
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            role=payload.role,
            department=payload.department,
            document_ids=payload.document_ids,
            created_by=current_admin.get("sub"),
            creator_role=current_admin.get("role", "admin"),
        )
        full_user = user_service.get_user_by_id(user["user_id"])
        return UserDetailResponse(**full_user)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(exc)}",
        )


@router.put(
    "/{user_id}/access",
    summary="Update or assign documents an employee can access (Admin only)",
)
def update_user_access(
    user_id: str,
    payload: UserAccessUpdateRequest,
    current_admin: Dict[str, Any] = Depends(require_admin),
):
    try:
        user = user_service.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        updated_ids = user_service.set_user_document_access(
            user_id=user_id,
            document_ids=payload.document_ids,
            granted_by=current_admin.get("sub"),
        )
        return {
            "message": f"Successfully updated document access for user '{user['email']}'.",
            "user_id": user_id,
            "accessible_document_ids": updated_ids,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update document access: {str(exc)}",
        )


@router.delete(
    "/{user_id}",
    summary="Delete a user (Admin only)",
)
def delete_user(user_id: str, current_admin: Dict[str, Any] = Depends(require_admin)):
    try:
        deleted = user_service.delete_user(
            user_id=user_id,
            requester_role=current_admin.get("role", "admin"),
        )
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return {"message": f"User '{user_id}' deleted successfully."}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(exc)}",
        )
