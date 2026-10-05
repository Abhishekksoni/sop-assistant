import os
import uuid
from typing import List, Optional, Dict, Any
from supabase import create_client, Client
from app.core.config import settings


def is_valid_uuid(val: Any) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


class ChatHistoryService:
    def __init__(self):
        self._supabase_client: Optional[Client] = None

    def get_supabase_client(self) -> Client:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("Supabase credentials not configured in environment.")
        if self._supabase_client is None:
            self._supabase_client = create_client(
                supabase_url=settings.SUPABASE_URL,
                supabase_key=settings.SUPABASE_KEY,
            )
        return self._supabase_client

    def list_conversations(self, user_id: str) -> List[Dict[str, Any]]:
        """Lists all conversations for a specific user ordered by updated_at desc."""
        if not is_valid_uuid(user_id):
            return []
        supabase = self.get_supabase_client()
        res = (
            supabase.table("conversations")
            .select("*")
            .eq("user_id", str(user_id))
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []

    def create_conversation(
        self,
        user_id: str,
        title: str = "New Conversation",
        department_filter: Optional[str] = None,
        document_id_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a new conversation for a user."""
        if not is_valid_uuid(user_id):
            raise ValueError("A valid user_id is required to create a conversation.")
        supabase = self.get_supabase_client()
        payload = {
            "user_id": str(user_id),
            "title": title,
            "department_filter": department_filter,
            "document_id_filter": document_id_filter if is_valid_uuid(document_id_filter) else None,
        }
        res = supabase.table("conversations").insert(payload).execute()
        if not res.data:
            raise ValueError("Failed to create conversation in Supabase.")
        return res.data[0]

    def get_conversation(self, conversation_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single conversation."""
        if not is_valid_uuid(conversation_id) or not is_valid_uuid(user_id):
            return None
        supabase = self.get_supabase_client()
        res = (
            supabase.table("conversations")
            .select("*")
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def update_conversation(
        self,
        conversation_id: str,
        user_id: str,
        title: Optional[str] = None,
        department_filter: Optional[str] = None,
        document_id_filter: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Updates a conversation title or filters."""
        if not is_valid_uuid(conversation_id) or not is_valid_uuid(user_id):
            return None
        supabase = self.get_supabase_client()
        updates: Dict[str, Any] = {"updated_at": "now()"}
        if title is not None:
            updates["title"] = title
        if department_filter is not None:
            updates["department_filter"] = department_filter
        if document_id_filter is not None:
            updates["document_id_filter"] = document_id_filter if is_valid_uuid(document_id_filter) else None

        res = (
            supabase.table("conversations")
            .update(updates)
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        """Deletes a conversation and all its messages."""
        if not is_valid_uuid(conversation_id) or not is_valid_uuid(user_id):
            return False
        supabase = self.get_supabase_client()
        res = (
            supabase.table("conversations")
            .delete()
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)

    def get_conversation_messages(self, conversation_id: str, user_id: str) -> List[Dict[str, Any]]:
        """Gets all chronological messages for a conversation."""
        if not is_valid_uuid(conversation_id) or not is_valid_uuid(user_id):
            return []
        supabase = self.get_supabase_client()
        res = (
            supabase.table("chat_messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []

    def add_message(
        self,
        conversation_id: str,
        user_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Adds a message to the conversation and updates conversation timestamp."""
        supabase = self.get_supabase_client()
        payload = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "sources": sources or [],
        }
        res = supabase.table("chat_messages").insert(payload).execute()
        
        # Touch conversation updated_at
        try:
            supabase.table("conversations").update({"updated_at": "now()"}).eq("conversation_id", conversation_id).execute()
        except Exception:
            pass

        if not res.data:
            raise ValueError("Failed to persist message in Supabase.")
        return res.data[0]


chat_history_service = ChatHistoryService()
