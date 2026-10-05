import os
import shutil
import urllib.parse
from typing import List, Dict, Any, Optional
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from supabase import create_client, Client

from app.core.config import settings


class VectorStoreService:
    def __init__(self):
        self._embeddings: Optional[GoogleGenerativeAIEmbeddings] = None
        self._supabase_client: Optional[Client] = None
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    def get_embeddings(self) -> GoogleGenerativeAIEmbeddings:
        """Initializes and returns Google Gemini Embeddings."""
        if not settings.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is not configured in environment variables or .env file.")
        
        if self._embeddings is None:
            self._embeddings = GoogleGenerativeAIEmbeddings(
                model=settings.EMBEDDING_MODEL,
                google_api_key=settings.GOOGLE_API_KEY,
                output_dimensionality=settings.EMBEDDING_DIMENSION,
            )
        return self._embeddings

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

    def upload_to_supabase_storage(self, file_bytes: bytes, filename: str) -> Dict[str, str]:
        """Uploads a PDF to Supabase Storage bucket 'sop-bucket' and gets its public URL."""
        supabase = self.get_supabase_client()
        bucket_name = settings.SUPABASE_STORAGE_BUCKET
        storage_path = filename

        try:
            # Upload with upsert enabled
            supabase.storage.from_(bucket_name).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": "application/pdf", "upsert": "true"},
            )
        except Exception as e:
            # Log and proceed in case file already exists or policy allows read
            print(f"Notice: Supabase storage upload response/status: {e}")

        # Retrieve public URL from Supabase Storage
        file_url = supabase.storage.from_(bucket_name).get_public_url(storage_path)
        return {
            "storage_path": storage_path,
            "file_url": file_url,
        }

    def create_document_record(
        self,
        name: str,
        filename: str,
        version: str = "1.0",
        department: Optional[str] = None,
        status: str = "active",
        storage_path: Optional[str] = None,
        file_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a parent entry in the documents table."""
        supabase = self.get_supabase_client()
        row = {
            "name": name,
            "filename": filename,
            "version": version,
            "department": department,
            "status": status,
            "storage_path": storage_path,
            "file_url": file_url,
        }
        res = supabase.table("documents").insert(row).execute()
        if not res.data:
            raise ValueError("Failed to create document record in Supabase.")
        return res.data[0]

    def process_and_store_pdf(
        self,
        file_path: str,
        name: Optional[str] = None,
        filename: Optional[str] = None,
        version: str = "1.0",
        department: Optional[str] = None,
        status: str = "active",
        chunk_size: int = 600,
        chunk_overlap: int = 100,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Processes a PDF, uploads to Supabase Storage, embeds chunks, and saves to document_chunks."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found at: {file_path}")

        resolved_filename = filename or os.path.basename(file_path)
        doc_name = name or os.path.splitext(resolved_filename)[0]
        dest_path = os.path.join(settings.UPLOAD_DIR, resolved_filename)

        # Read file bytes for Supabase Storage upload
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        # Copy to local uploads directory if not already there
        if os.path.abspath(file_path) != os.path.abspath(dest_path):
            shutil.copyfile(file_path, dest_path)

        # 1. Upload to Supabase Storage ('sop-bucket')
        storage_info = self.upload_to_supabase_storage(file_bytes=file_bytes, filename=resolved_filename)
        storage_path = storage_info["storage_path"]
        file_url = storage_info["file_url"]

        # 2. Load and parse PDF
        loader = PyPDFLoader(dest_path)
        raw_documents = loader.load()

        if not raw_documents:
            raise ValueError("No text could be extracted from the provided PDF file.")

        # 3. Create parent document in Supabase
        doc_record = self.create_document_record(
            name=doc_name,
            filename=resolved_filename,
            version=version,
            department=department,
            status=status,
            storage_path=storage_path,
            file_url=file_url,
        )
        document_id = doc_record["document_id"]

        # 4. Enrich raw documents with page_number and metadata
        for doc in raw_documents:
            page_index = doc.metadata.get("page", 0)
            doc.metadata["document_id"] = document_id
            doc.metadata["filename"] = resolved_filename
            doc.metadata["document_name"] = doc_name
            doc.metadata["page_number"] = page_index + 1
            doc.metadata["file_url"] = file_url
            if department:
                doc.metadata["department"] = department
            if extra_metadata:
                doc.metadata.update(extra_metadata)

        # 5. Split into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        split_docs = text_splitter.split_documents(raw_documents)
        texts = [doc.page_content for doc in split_docs]

        # 6. Generate embeddings via Google Gemini
        embeddings = self.get_embeddings()
        vectors = embeddings.embed_documents(texts)

        # 7. Prepare rows for document_chunks table
        supabase = self.get_supabase_client()
        chunk_rows = []
        for doc, vec in zip(split_docs, vectors):
            chunk_rows.append({
                "document_id": document_id,
                "content": doc.page_content,
                "embedding": vec,
                "page_number": doc.metadata.get("page_number", 1),
                "metadata": doc.metadata,
            })

        # Batch insert chunks
        batch_size = 50
        inserted_count = 0
        for i in range(0, len(chunk_rows), batch_size):
            batch = chunk_rows[i : i + batch_size]
            res = supabase.table("document_chunks").insert(batch).execute()
            if res.data:
                inserted_count += len(res.data)

        return {
            "document_id": document_id,
            "name": doc_name,
            "filename": resolved_filename,
            "version": version,
            "department": department,
            "status": status,
            "storage_path": storage_path,
            "file_url": file_url,
            "total_pages": len(raw_documents),
            "total_chunks": len(split_docs),
            "inserted_chunks_count": inserted_count or len(split_docs),
        }

    def process_and_store_pdf_bytes(
        self,
        file_bytes: bytes,
        filename: str,
        name: Optional[str] = None,
        version: str = "1.0",
        department: Optional[str] = None,
        status: str = "active",
        chunk_size: int = 600,
        chunk_overlap: int = 100,
    ) -> Dict[str, Any]:
        """Saves uploaded PDF bytes locally, parses, uploads to Supabase Storage, and stores chunks."""
        saved_file_path = os.path.join(settings.UPLOAD_DIR, filename)
        with open(saved_file_path, "wb") as f:
            f.write(file_bytes)

        return self.process_and_store_pdf(
            file_path=saved_file_path,
            name=name,
            filename=filename,
            version=version,
            department=department,
            status=status,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    def similarity_search(
        self,
        query: str,
        k: int = 4,
        department: Optional[str] = None,
        status: Optional[str] = None,
        document_id: Optional[str] = None,
        for_user_id: Optional[str] = None,
        user_role: str = "admin",
        base_url: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Performs vector similarity search joined with documents using match_document_chunks RPC."""
        embeddings = self.get_embeddings()
        query_vector = embeddings.embed_query(query)

        supabase = self.get_supabase_client()
        rpc_params = {
            "query_embedding": query_vector,
            "match_count": k,
            "filter_department": department,
            "filter_status": status,
            "filter_document_id": document_id,
            "for_user_id": for_user_id,
            "user_role": user_role,
        }

        response = supabase.rpc("match_document_chunks", rpc_params).execute()
        raw_results = response.data or []

        search_items = []
        for row in raw_results:
            filename = row.get("filename")
            page_number = row.get("page_number", 1)
            file_url = row.get("file_url")

            # Generate direct hyperlink to exact PDF page (#page=N)
            # Prioritize Supabase Storage public URL if available, else local server URL
            if file_url:
                hyperlink = f"{file_url}#page={page_number}"
            elif filename:
                encoded_filename = urllib.parse.quote(filename)
                if base_url:
                    clean_base_url = str(base_url).rstrip("/")
                    hyperlink = f"{clean_base_url}/api/v1/documents/files/{encoded_filename}#page={page_number}"
                else:
                    hyperlink = f"/api/v1/documents/files/{encoded_filename}#page={page_number}"
            else:
                hyperlink = None

            search_items.append({
                "chunk_id": row.get("chunk_id"),
                "document_id": row.get("document_id"),
                "document_name": row.get("document_name"),
                "filename": filename,
                "version": row.get("version"),
                "department": row.get("department"),
                "status": row.get("status"),
                "file_url": file_url,
                "storage_path": row.get("storage_path"),
                "content": row.get("content"),
                "page_number": page_number,
                "similarity": row.get("similarity"),
                "hyperlink": hyperlink,
                "metadata": row.get("metadata", {}),
            })

        return search_items

    def list_documents(
        self,
        department: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Lists all registered documents from the documents table."""
        supabase = self.get_supabase_client()
        query = supabase.table("documents").select("*")
        if department:
            query = query.eq("department", department)
        if status:
            query = query.eq("status", status)
        res = query.order("created_at", desc=True).execute()
        return res.data or []

    def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Gets a document and its chunk count by document_id."""
        supabase = self.get_supabase_client()
        res = supabase.table("documents").select("*").eq("document_id", document_id).execute()
        if not res.data:
            return None
        doc = res.data[0]
        chunks_res = supabase.table("document_chunks").select("chunk_id", count="exact").eq("document_id", document_id).execute()
        doc["chunks_count"] = chunks_res.count if hasattr(chunks_res, "count") else len(chunks_res.data or [])
        return doc

    def delete_document(self, document_id: str) -> bool:
        """Deletes a document from Supabase and removes its file from Supabase Storage."""
        supabase = self.get_supabase_client()
        doc = self.get_document(document_id)
        if doc and doc.get("storage_path"):
            try:
                supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove([doc["storage_path"]])
            except Exception as e:
                print(f"Notice: Supabase storage file remove: {e}")

        res = supabase.table("documents").delete().eq("document_id", document_id).execute()
        return bool(res.data)


vector_store_service = VectorStoreService()
