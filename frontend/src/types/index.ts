export type UserRole = 'master_admin' | 'admin' | 'employee';

export interface User {
  user_id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  department?: string | null;
  is_master_admin: boolean;
  created_at?: string;
  accessible_documents?: Array<{
    document_id: string;
    name?: string;
    filename?: string;
    file_url?: string;
  }>;
}

export interface DocumentItem {
  document_id: string;
  name: string;
  filename: string;
  version?: string;
  department?: string | null;
  status?: string;
  is_public?: boolean;
  storage_path?: string | null;
  file_url?: string | null;
  created_at?: string;
  chunks_count?: number;
}

export interface SourceCitation {
  chunk_id?: string;
  document_id?: string;
  document_name?: string;
  filename?: string;
  version?: string;
  department?: string;
  status?: string;
  file_url?: string;
  storage_path?: string;
  content: string;
  page_number?: number;
  similarity?: number;
  hyperlink?: string;
  highlight_phrase?: string;
  search_query?: string;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: SourceCitation[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
  departmentFilter?: string;
  documentIdFilter?: string;
}
