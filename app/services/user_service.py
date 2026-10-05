from typing import List, Dict, Any, Optional
from supabase import create_client, Client

from app.core.config import settings
from app.core.security import hash_password, verify_password


class UserService:
    def __init__(self):
        self._supabase_client: Optional[Client] = None

    def get_supabase_client(self) -> Client:
        """Initializes and returns Supabase Client."""
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("SUPABASE_URL or SUPABASE_KEY is not configured in environment variables or .env file.")
        
        if self._supabase_client is None:
            self._supabase_client = create_client(
                supabase_url=settings.SUPABASE_URL,
                supabase_key=settings.SUPABASE_KEY,
            )
        return self._supabase_client

    def ensure_master_admin_exists(self) -> Dict[str, Any]:
        """Ensures the master admin account exists in Supabase users table."""
        supabase = self.get_supabase_client()
        res = supabase.table("users").select("*").eq("email", settings.MASTER_ADMIN_EMAIL).execute()

        if res.data and len(res.data) > 0:
            user = res.data[0]
            # Ensure marked as master admin & role master_admin
            if not user.get("is_master_admin") or user.get("role") != "master_admin":
                supabase.table("users").update({"is_master_admin": True, "role": "master_admin"}).eq("user_id", user["user_id"]).execute()
            return user

        # Create master admin
        hashed = hash_password(settings.MASTER_ADMIN_PASSWORD)
        new_admin = {
            "email": settings.MASTER_ADMIN_EMAIL,
            "password_hash": hashed,
            "full_name": "Master Administrator",
            "role": "master_admin",
            "department": "Management",
            "is_master_admin": True,
        }
        create_res = supabase.table("users").insert(new_admin).execute()
        if not create_res.data:
            raise ValueError("Failed to seed Master Admin in Supabase.")
        return create_res.data[0]

    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Verifies credentials and returns user record if valid."""
        supabase = self.get_supabase_client()
        res = supabase.table("users").select("*").eq("email", email.strip().lower()).execute()
        if not res.data:
            return None
        user = res.data[0]
        if not verify_password(password, user.get("password_hash", "")):
            return None
        return user

    def create_user(
        self,
        email: str,
        password: str,
        full_name: Optional[str] = None,
        role: str = "employee",
        department: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        created_by: Optional[str] = None,
        creator_role: str = "master_admin",
    ) -> Dict[str, Any]:
        """Creates a new user (master_admin, admin, employee) with role permissions."""
        supabase = self.get_supabase_client()
        clean_email = email.strip().lower()

        if role not in ["master_admin", "admin", "employee"]:
            raise ValueError("Role must be 'master_admin', 'admin', or 'employee'.")

        # Regular admins can only create employees
        if creator_role == "admin" and role in ["admin", "master_admin"]:
            raise ValueError("Admins can only create 'employee' accounts. Master Admin privileges required to create admins.")

        # Check existing
        existing = supabase.table("users").select("user_id").eq("email", clean_email).execute()
        if existing.data and len(existing.data) > 0:
            raise ValueError(f"User with email '{clean_email}' already exists.")

        is_master = (role == "master_admin")
        user_row = {
            "email": clean_email,
            "password_hash": hash_password(password),
            "full_name": full_name,
            "role": role,
            "department": department,
            "is_master_admin": is_master,
        }
        res = supabase.table("users").insert(user_row).execute()
        if not res.data:
            raise ValueError("Failed to create user record in Supabase.")
        created_user = res.data[0]
        user_id = created_user["user_id"]

        # Assign document access if employee and document_ids provided
        if document_ids and role == "employee":
            self.grant_document_access(user_id=user_id, document_ids=document_ids, granted_by=created_by)

        created_user["accessible_document_ids"] = document_ids or []
        return created_user

    def grant_document_access(
        self,
        user_id: str,
        document_ids: List[str],
        granted_by: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Grants access to a list of documents for a user."""
        supabase = self.get_supabase_client()
        if not document_ids:
            return []

        access_rows = [
            {
                "user_id": user_id,
                "document_id": doc_id,
                "granted_by": granted_by,
            }
            for doc_id in document_ids
        ]
        res = supabase.table("document_access").upsert(access_rows, on_conflict="document_id,user_id").execute()
        return res.data or []

    def set_user_document_access(
        self,
        user_id: str,
        document_ids: List[str],
        granted_by: Optional[str] = None,
    ) -> List[str]:
        """Replaces a user's assigned documents with a new list of document_ids."""
        supabase = self.get_supabase_client()
        # Remove existing access
        supabase.table("document_access").delete().eq("user_id", user_id).execute()
        # Add new access
        if document_ids:
            self.grant_document_access(user_id=user_id, document_ids=document_ids, granted_by=granted_by)
        return document_ids

    def get_user_accessible_documents(self, user_id: str) -> List[Dict[str, Any]]:
        """Returns all documents accessible by an employee."""
        supabase = self.get_supabase_client()
        access_res = supabase.table("document_access").select("document_id").eq("user_id", user_id).execute()
        granted_doc_ids = [row["document_id"] for row in (access_res.data or [])]

        if not granted_doc_ids:
            # Return public documents only
            pub_res = supabase.table("documents").select("document_id, name, filename, version, department, status, is_public, file_url").eq("is_public", True).execute()
            return pub_res.data or []

        # Return public + granted documents
        docs_res = supabase.table("documents").select("document_id, name, filename, version, department, status, is_public, file_url").in_("document_id", granted_doc_ids).execute()
        return docs_res.data or []

    def list_users(self) -> List[Dict[str, Any]]:
        """Lists all users with their roles and assigned document access."""
        supabase = self.get_supabase_client()
        users_res = supabase.table("users").select("user_id, email, full_name, role, department, is_master_admin, created_at").order("created_at", desc=False).execute()
        users = users_res.data or []

        # Fetch all document_access mappings
        access_res = supabase.table("document_access").select("user_id, document_id, documents(name, filename, file_url)").execute()
        access_map: Dict[str, List[Any]] = {}
        for row in (access_res.data or []):
            uid = row["user_id"]
            if uid not in access_map:
                access_map[uid] = []
            access_map[uid].append({
                "document_id": row["document_id"],
                "name": row.get("documents", {}).get("name") if row.get("documents") else None,
                "filename": row.get("documents", {}).get("filename") if row.get("documents") else None,
                "file_url": row.get("documents", {}).get("file_url") if row.get("documents") else None,
            })

        for u in users:
            u["accessible_documents"] = access_map.get(u["user_id"], [])

        return users

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Gets a user by user_id."""
        supabase = self.get_supabase_client()
        res = supabase.table("users").select("user_id, email, full_name, role, department, is_master_admin, created_at").eq("user_id", user_id).execute()
        if not res.data:
            return None
        user = res.data[0]
        user["accessible_documents"] = self.get_user_accessible_documents(user_id)
        return user

    def delete_user(self, user_id: str, requester_role: str = "master_admin") -> bool:
        """Deletes a user (respecting master_admin & admin hierarchy)."""
        supabase = self.get_supabase_client()
        user_res = supabase.table("users").select("role, is_master_admin").eq("user_id", user_id).execute()
        if not user_res.data:
            return False

        target_user = user_res.data[0]
        if target_user.get("is_master_admin") or target_user.get("role") == "master_admin":
            raise ValueError("Cannot delete the Master Admin account.")

        if requester_role == "admin" and target_user.get("role") in ["admin", "master_admin"]:
            raise ValueError("Admins cannot delete other Admin accounts. Master Admin privileges required.")

        res = supabase.table("users").delete().eq("user_id", user_id).execute()
        return bool(res.data)


user_service = UserService()
