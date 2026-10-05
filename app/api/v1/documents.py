import os
import urllib.parse
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, Query, status, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.core.config import settings
from app.core.security import require_admin
from app.services.vector_store_service import vector_store_service

router = APIRouter()


class SearchQueryRequest(BaseModel):
    query: str = Field(..., description="Query text to search for similar document chunks", example="What is the calibration procedure?")
    top_k: int = Field(default=4, ge=1, le=20, description="Number of matching results to retrieve")
    department: Optional[str] = Field(None, description="Filter results by department (e.g. 'QC', 'QA')")
    status: Optional[str] = Field(None, description="Filter results by document status (e.g. 'active')")
    document_id: Optional[str] = Field(None, description="Filter results to a specific document ID")
    user_id: Optional[str] = Field(None, description="User UUID for role-based access filtering")
    user_role: Optional[str] = Field("admin", description="User role ('admin' or 'employee')")


class SearchResultItem(BaseModel):
    chunk_id: Optional[str] = None
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    filename: Optional[str] = None
    version: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    file_url: Optional[str] = None
    storage_path: Optional[str] = None
    content: str
    page_number: Optional[int] = None
    similarity: Optional[float] = None
    hyperlink: Optional[str] = Field(None, description="Direct clickable URL to the exact PDF page location")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    query: str
    count: int
    results: List[SearchResultItem]


class DocumentItem(BaseModel):
    document_id: str
    name: str
    filename: str
    version: Optional[str] = "1.0"
    department: Optional[str] = None
    status: Optional[str] = "active"
    storage_path: Optional[str] = None
    file_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    chunks_count: Optional[int] = None


class UploadPDFResponse(BaseModel):
    message: str
    document_id: str
    name: str
    filename: str
    version: str
    department: Optional[str]
    status: str
    storage_path: Optional[str] = None
    file_url: str
    total_pages: int
    total_chunks: int
    inserted_chunks_count: int


@router.post(
    "/upload-pdf",
    response_model=UploadPDFResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload, categorize, embed, and store a PDF document in Supabase Storage",
)
async def upload_pdf(
    request: Request,
    file: UploadFile = File(..., description="PDF document to parse, embed, and store"),
    name: Optional[str] = Form(None, description="Document title/name (defaults to filename without .pdf)"),
    version: str = Form(default="1.0", description="Document version (e.g. '1.0', '2.1')"),
    department: Optional[str] = Form(None, description="Department (e.g. 'QC', 'QA', 'Production')"),
    document_status: str = Form(default="active", description="Status (e.g. 'active', 'draft', 'archived')"),
    chunk_size: int = Form(default=600, description="Text chunk size for splitting"),
    chunk_overlap: int = Form(default=100, description="Overlap between consecutive chunks"),
    current_admin: Dict[str, Any] = Depends(require_admin),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a PDF document (.pdf extension).",
        )

    try:
        content = await file.read()
        result = vector_store_service.process_and_store_pdf_bytes(
            file_bytes=content,
            filename=file.filename,
            name=name,
            version=version,
            department=department,
            status=document_status,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

        file_url = result.get("file_url")
        if not file_url:
            base_url = str(request.base_url).rstrip("/")
            encoded_filename = urllib.parse.quote(file.filename)
            file_url = f"{base_url}/api/v1/documents/files/{encoded_filename}"

        return UploadPDFResponse(
            message="PDF successfully uploaded to Supabase Storage, embedded, and saved into Supabase.",
            document_id=result["document_id"],
            name=result["name"],
            filename=result["filename"],
            version=result["version"],
            department=result["department"],
            status=result["status"],
            storage_path=result.get("storage_path"),
            file_url=file_url,
            total_pages=result["total_pages"],
            total_chunks=result["total_chunks"],
            inserted_chunks_count=result["inserted_chunks_count"],
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and embed PDF: {str(exc)}",
        )


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class ChatQueryRequest(BaseModel):
    message: str = Field(..., description="User question or prompt", example="What is the calibration frequency for analytical balances?")
    history: Optional[List[ChatMessage]] = Field(default=[], description="Previous conversation messages for context")
    department: Optional[str] = Field(None, description="Filter by department")
    document_id: Optional[str] = Field(None, description="Filter by document ID")
    user_id: Optional[str] = Field(None, description="User UUID")
    user_role: Optional[str] = Field("master_admin", description="Role: 'master_admin', 'admin', 'employee'")


class ChatQueryResponse(BaseModel):
    answer: str
    sources: List[SearchResultItem]


@router.post(
    "/chat",
    response_model=ChatQueryResponse,
    summary="Ask an AI question grounded in SOP documents with page hyperlinks",
)
def chat_with_documents(payload: ChatQueryRequest, request: Request):
    try:
        base_url = str(request.base_url).rstrip("/")
        history_dicts = [{"role": m.role, "content": m.content} for m in payload.history] if payload.history else []
        rag_res = vector_store_service.ask_rag_question(
            query=payload.message,
            conversation_history=history_dicts,
            department=payload.department,
            document_id=payload.document_id,
            for_user_id=payload.user_id,
            user_role=payload.user_role or "master_admin",
            base_url=base_url,
        )
        return ChatQueryResponse(
            answer=rag_res["answer"],
            sources=[SearchResultItem(**s) for s in rag_res["sources"]],
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI response: {str(exc)}",
        )


@router.post(
    "/search",
    response_model=SearchResponse,
    summary="Search for document chunks with role-based access filtering and page hyperlinks",
)
def search_documents(payload: SearchQueryRequest, request: Request):
    try:
        base_url = str(request.base_url).rstrip("/")
        results = vector_store_service.similarity_search(
            query=payload.query,
            k=payload.top_k,
            department=payload.department,
            status=payload.status,
            document_id=payload.document_id,
            for_user_id=payload.user_id,
            user_role=payload.user_role or "master_admin",
            base_url=base_url,
        )
        return SearchResponse(
            query=payload.query,
            count=len(results),
            results=[SearchResultItem(**res) for res in results],
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform similarity search: {str(exc)}",
        )



@router.get(
    "/",
    response_model=List[DocumentItem],
    summary="List all registered documents",
)
def list_documents(
    department: Optional[str] = Query(None, description="Filter by department"),
    document_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
):
    try:
        docs = vector_store_service.list_documents(department=department, status=document_status)
        return [DocumentItem(**d) for d in docs]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list documents: {str(exc)}",
        )


@router.get(
    "/{document_id}",
    response_model=DocumentItem,
    summary="Get document details by ID",
)
def get_document(document_id: str):
    try:
        doc = vector_store_service.get_document(document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{document_id}' not found.",
            )
        return DocumentItem(**doc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve document: {str(exc)}",
        )


@router.delete(
    "/{document_id}",
    summary="Delete a document and all its embedded chunks",
)
def delete_document(
    document_id: str,
    current_admin: Dict[str, Any] = Depends(require_admin),
):
    try:
        deleted = vector_store_service.delete_document(document_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{document_id}' not found.",
            )
        return {"message": f"Document '{document_id}' and all its chunks were deleted successfully."}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(exc)}",
        )


@router.get(
    "/files/{filename:path}",
    summary="Serve PDF file for direct browser viewing with page anchor support",
)
def get_pdf_file(filename: str):
    decoded_filename = urllib.parse.unquote(filename)
    file_path = os.path.join(settings.UPLOAD_DIR, decoded_filename)
    if not os.path.exists(file_path):
        file_path = os.path.join(settings.UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{decoded_filename}' not found on server in '{settings.UPLOAD_DIR}/'.",
        )
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{os.path.basename(file_path)}"'},
    )
