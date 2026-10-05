#!/usr/bin/env python3
"""
CLI script to embed a local PDF into Supabase relational tables using Google Gemini Embeddings.
Usage:
    uv run python scripts/embed_pdf.py path/to/document.pdf --name "SOP-QC-014" --department "QC" --version "1.0"
"""
import sys
import os
import argparse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add root directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.vector_store_service import vector_store_service


def main():
    parser = argparse.ArgumentParser(description="Embed PDF document into Supabase relational vector store")
    parser.add_argument("pdf_path", help="Path to the PDF document")
    parser.add_argument("--name", default=None, help="Document title/name")
    parser.add_argument("--version", default="1.0", help="Document version (default: 1.0)")
    parser.add_argument("--department", default=None, help="Department (e.g. QC, QA)")
    parser.add_argument("--status", default="active", help="Document status (default: active)")
    parser.add_argument("--chunk-size", type=int, default=600, help="Chunk size (default: 600)")
    parser.add_argument("--chunk-overlap", type=int, default=100, help="Chunk overlap (default: 100)")

    args = parser.parse_args()

    if not os.path.exists(args.pdf_path):
        print(f"❌ Error: File not found at '{args.pdf_path}'")
        sys.exit(1)

    print(f"📄 Processing and embedding PDF: {args.pdf_path} ...")
    try:
        result = vector_store_service.process_and_store_pdf(
            file_path=args.pdf_path,
            name=args.name,
            version=args.version,
            department=args.department,
            status=args.status,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
        )
        print("✅ Successfully registered document and stored chunks in Supabase!")
        print(f"   • Document ID: {result['document_id']}")
        print(f"   • Name:        {result['name']}")
        print(f"   • Version:     {result['version']}")
        print(f"   • Department:  {result['department']}")
        print(f"   • Total Pages: {result['total_pages']}")
        print(f"   • Total Chunks:{result['total_chunks']}")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
