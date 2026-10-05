import { User, DocumentItem, SourceCitation } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('sop_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('sop_token', token);
      } else {
        localStorage.removeItem('sop_token');
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('sop_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorDetail = 'An error occurred';
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || JSON.stringify(errorData);
      } catch {
        errorDetail = response.statusText;
      }
      throw new Error(errorDetail);
    }

    return response.json();
  }

  // --- Auth Endpoints ---
  async login(email: string, password: string) {
    const data = await this.request<{
      access_token: string;
      token_type: string;
      user_id: string;
      email: string;
      full_name?: string;
      role: 'master_admin' | 'admin' | 'employee';
      is_master_admin: boolean;
      department?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setToken(data.access_token);
    return data;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // --- Document Endpoints ---
  async listDocuments(department?: string, status?: string): Promise<DocumentItem[]> {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (status) params.append('status', status);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request<DocumentItem[]>(`/documents${queryStr}`);
  }

  async uploadPdf(formData: FormData): Promise<{
    message: string;
    document_id: string;
    name: string;
    filename: string;
    version: string;
    department?: string;
    status: string;
    storage_path?: string;
    file_url: string;
    total_pages: number;
    total_chunks: number;
  }> {
    return this.request('/documents/upload-pdf', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteDocument(documentId: string): Promise<{ message: string }> {
    return this.request(`/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  // --- Chat & Search Endpoints ---
  async chatWithDocuments(payload: {
    message: string;
    history?: Array<{ role: string; content: string }>;
    department?: string;
    document_id?: string;
    user_id?: string;
    user_role?: string;
  }): Promise<{ answer: string; sources: SourceCitation[] }> {
    return this.request('/documents/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async searchDocuments(payload: {
    query: string;
    top_k?: number;
    department?: string;
    status?: string;
    document_id?: string;
    user_id?: string;
    user_role?: string;
  }): Promise<{ query: string; count: number; results: SourceCitation[] }> {
    return this.request('/documents/search', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Users Endpoints (Admin Only) ---
  async listUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async createUser(payload: {
    email: string;
    password: string;
    full_name?: string;
    role: string;
    department?: string;
    document_ids?: string[];
  }): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateUserAccess(userId: string, documentIds: string[]): Promise<{ message: string }> {
    return this.request(`/users/${userId}/access`, {
      method: 'PUT',
      body: JSON.stringify({ document_ids: documentIds }),
    });
  }

  async deleteUser(userId: string): Promise<{ message: string }> {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // --- Database-Backed Chat Conversations & Messages ---
  async listConversations(): Promise<Array<{
    conversation_id: string;
    user_id: string;
    title: string;
    department_filter?: string;
    document_id_filter?: string;
    created_at: string;
    updated_at: string;
  }>> {
    return this.request('/chat/conversations');
  }

  async createConversation(payload: {
    title?: string;
    department_filter?: string;
    document_id_filter?: string;
  }): Promise<{
    conversation_id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }> {
    return this.request('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getConversationMessages(conversationId: string): Promise<Array<{
    message_id: string;
    conversation_id: string;
    user_id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: SourceCitation[];
    created_at: string;
  }>> {
    return this.request(`/chat/conversations/${conversationId}/messages`);
  }

  async sendMessageToConversation(
    conversationId: string,
    payload: {
      content: string;
      department?: string;
      document_id?: string;
    }
  ): Promise<{
    user_message: {
      message_id: string;
      conversation_id: string;
      role: 'user';
      content: string;
      created_at: string;
    };
    assistant_message: {
      message_id: string;
      conversation_id: string;
      role: 'assistant';
      content: string;
      sources?: SourceCitation[];
      created_at: string;
    };
  }> {
    return this.request(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteConversation(conversationId: string): Promise<{ message: string }> {
    return this.request(`/chat/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async updateConversation(
    conversationId: string,
    payload: { title?: string; department_filter?: string; document_id_filter?: string }
  ): Promise<any> {
    return this.request(`/chat/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();
