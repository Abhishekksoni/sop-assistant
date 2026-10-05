from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.core.security import get_current_user
from app.services.chat_history_service import chat_history_service
from app.services.vector_store_service import vector_store_service

router = APIRouter()


class CreateConversationRequest(BaseModel):
    title: Optional[str] = Field("New Conversation", description="Conversation title")
    department_filter: Optional[str] = Field(None, description="Department filter")
    document_id_filter: Optional[str] = Field(None, description="Specific document ID filter")


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = Field(None, description="New conversation title")
    department_filter: Optional[str] = Field(None, description="Department filter")
    document_id_filter: Optional[str] = Field(None, description="Specific document ID filter")


class SendMessageRequest(BaseModel):
    content: str = Field(..., description="User prompt message")
    department: Optional[str] = Field(None, description="Department filter")
    document_id: Optional[str] = Field(None, description="Specific document filter")


@router.get(
    "/conversations",
    summary="List all conversations for the authenticated user",
)
def list_conversations(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("user_id")
    try:
        return chat_history_service.list_conversations(user_id=user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list conversations: {str(exc)}",
        )


@router.post(
    "/conversations",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation for the authenticated user",
)
def create_conversation(
    req: CreateConversationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user.get("user_id")
    try:
        return chat_history_service.create_conversation(
            user_id=user_id,
            title=req.title or "New Conversation",
            department_filter=req.department_filter,
            document_id_filter=req.document_id_filter,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create conversation: {str(exc)}",
        )


@router.get(
    "/conversations/{conversation_id}/messages",
    summary="Get all messages in a conversation",
)
def get_conversation_messages(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user.get("user_id")
    try:
        messages = chat_history_service.get_conversation_messages(
            conversation_id=conversation_id,
            user_id=user_id,
        )
        return messages
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get messages: {str(exc)}",
        )


@router.post(
    "/conversations/{conversation_id}/messages",
    summary="Send a message in a conversation, run RAG, and store the assistant reply in Supabase",
)
def send_message(
    conversation_id: str,
    req: SendMessageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user.get("user_id")
    user_role = current_user.get("role", "employee")

    try:
        # 1. Save user message to database
        user_msg = chat_history_service.add_message(
            conversation_id=conversation_id,
            user_id=user_id,
            role="user",
            content=req.content,
        )

        # 2. Retrieve past messages for context
        past_messages = chat_history_service.get_conversation_messages(
            conversation_id=conversation_id,
            user_id=user_id,
        )
        history_tuples = [{"role": m["role"], "content": m["content"]} for m in past_messages[:-1]]

        # 3. Perform RAG search & answer generation
        rag_res = vector_store_service.ask_rag_question(
            query=req.content,
            conversation_history=history_tuples,
            department=req.department,
            document_id=req.document_id,
            for_user_id=user_id,
            user_role=user_role,
        )

        # 4. Save assistant answer with verified sources into database
        assistant_msg = chat_history_service.add_message(
            conversation_id=conversation_id,
            user_id=user_id,
            role="assistant",
            content=rag_res.get("answer", ""),
            sources=rag_res.get("sources", []),
        )

        # 5. Auto-update conversation title on first message
        if len(past_messages) <= 1:
            snippet = req.content[:32] + ("..." if len(req.content) > 32 else "")
            chat_history_service.update_conversation(
                conversation_id=conversation_id,
                user_id=user_id,
                title=snippet,
            )

        return {
            "user_message": user_msg,
            "assistant_message": assistant_msg,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process message: {str(exc)}",
        )


@router.delete(
    "/conversations/{conversation_id}",
    summary="Delete a conversation and all its messages",
)
def delete_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user.get("user_id")
    try:
        deleted = chat_history_service.delete_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
        )
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or already deleted.",
            )
        return {"message": "Conversation deleted successfully."}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete conversation: {str(exc)}",
        )


@router.patch(
    "/conversations/{conversation_id}",
    summary="Update conversation title or filters",
)
def update_conversation(
    conversation_id: str,
    req: UpdateConversationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user.get("user_id")
    try:
        updated = chat_history_service.update_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            title=req.title,
            department_filter=req.department_filter,
            document_id_filter=req.document_id_filter,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        return updated
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update conversation: {str(exc)}",
        )
