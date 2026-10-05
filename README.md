# SOP Intelligence — AI Assistant Platform

A full-stack ChatGPT-style platform for **Standard Operating Procedures (SOPs)** and operational compliance powered by:
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide icons, React Markdown.
- **Backend**: FastAPI, Uvicorn, LangChain, Google Gemini (`gemini-3.8-flash` LLM, `gemini-embedding-001` 768d).
- **Database & Storage**: Supabase pgvector (vector search with HNSW), Supabase Storage (`sop-bucket`), and PostgreSQL.
- **Security & Access**: JWT Auth, bcrypt password hashing, 3-tier Role-Based Access Control (`master_admin`, `admin`, `employee`).

---

## 🔑 Default Master Admin Account

- **Email**: `abhishekad152003@gmail.com`
- **Password**: `123456`
- **Role**: `master_admin` (`is_master_admin: true`)

---

## 👥 Three-Tier Role-Based Access Control (RBAC)

1. **`master_admin`** (`abhishekad152003@gmail.com`):
   - Unrestricted access to all documents.
   - Can create, view, update, and delete **all accounts** (including creating new `admin`s and `employee`s).
   - Can grant/revoke document access for any user.
   - Protected against deletion.

2. **`admin`**:
   - Access to search and view all documents.
   - Can upload new SOP documents (persisted to Supabase `sop-bucket`).
   - Can create and manage **`employee` accounts** and assign accessible SOP documents.

3. **`employee`**:
   - Can **only search and view** documents that are public or explicitly assigned to them in `document_access` by an admin.
   - Clean ChatGPT interface with source citations and page hyperlinks.

---

## 🚀 Quick Start Guide

### 1. Configure Supabase SQL Schema
Run the full SQL script from [`supabase_schema.sql`](supabase_schema.sql) in your **[Supabase SQL Editor](https://supabase.com/dashboard)**.

### 2. Start the FastAPI Backend (Port 8000)

```bash
# In project root (/Users/abhisheksoni/sop)
uv run main.py
```
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Start the Next.js Frontend (Port 3000)

```bash
cd frontend
npm run dev
```
- Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🌟 Frontend Features

1. **ChatGPT-like Chat Assistant**:
   - Sidebar with searchable conversation history, create new chat, and delete chats.
   - RAG Q&A with streaming indicator and rich markdown rendering.
   - **Interactive Verified Source Cards**: Displays exact document name, page number, and a direct button `Open PDF at Page X ↗` that opens the Supabase Storage PDF jumped to that exact page (`#page=N`).
   - Filters: Filter chat context by Department or specific SOP document.

2. **SOP Document Management** (Admin):
   - Drag & drop PDF upload to Supabase Storage `sop-bucket`.
   - Automatic chunking and Gemini vector embeddings.
   - Document catalog with live Supabase Storage URLs.

3. **Role & Permission Management** (Master Admin & Admin):
   - Create new Admins and Employees.
   - Checkbox document selector to grant selective document permissions.
   - Live modal to update and reassign document access.
