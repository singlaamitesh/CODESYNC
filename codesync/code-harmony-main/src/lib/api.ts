// API service for connecting to FastAPI backend.
// All business data (workspaces, folders, documents, chat) lives in PocketBase
// and is accessed directly via the SDK in src/lib/pb.ts. This module is now
// only responsible for AI endpoints and exposes thin PocketBase-backed types
// used by the frontend.
import { pb } from './pb';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api');

if (import.meta.env.DEV) {
  console.log('API Configuration:', { API_BASE_URL });
}

export interface Document {
  id: string;
  title: string;
  content: string;
  language: string;
  workspace?: string;
  folder?: string | null;
  created: string;
  updated: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  created: string;
}

export interface FolderResponse {
  id: string;
  workspace: string;
  parent: string | null;
  name: string;
  created: string;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  parent_folder_id: string | null;
  children: FolderTreeNode[];
  documents: Document[];
}

export interface WorkspaceTree {
  id: string;
  name: string;
  folders: FolderTreeNode[];
  root_documents: Document[];
}

export interface AISuggestionResponse {
  document_id: string;
  suggestion_data: {
    suggestions: Array<{
      type: string;
      message: string;
      line: number;
      severity: string;
      fix?: string;
    }>;
    analysis: {
      lines: number;
      functions: number;
      classes: number;
      complexity_score: number;
      language?: string;
      llm_used?: string | null;
    };
    embedding: number[];
  };
  status: string;
}

export interface OptimizationResponse {
  document_id: string;
  optimization: {
    optimized_code: string;
    changes: Array<{ description: string; impact: string }>;
    performance_improvement: string;
    summary: string;
    language?: string;
    llm_used?: string;
  };
  status: string;
}

export interface CompletionResponse {
  document_id: string;
  completions: Array<{ text?: string; label?: string; description?: string }>;
  status: string;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (pb.authStore.isValid && pb.authStore.token) {
      headers.Authorization = `Bearer ${pb.authStore.token}`;
    }
    const resp = await fetch(url, { ...options, headers });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text().catch(() => '')}`);
    }
    const text = await resp.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async makePublicRequest<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async analyzeCode(documentId: string, content: string, filename: string): Promise<AISuggestionResponse> {
    return this.request('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, content, filename }),
    });
  }

  async optimizeCode(documentId: string, content: string, filename: string): Promise<OptimizationResponse> {
    return this.request('/ai/optimize', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, content, filename }),
    });
  }

  async getCompletions(documentId: string, content: string, line: number, column: number, filename: string): Promise<CompletionResponse> {
    return this.request('/ai/complete', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, content, line, column, filename }),
    });
  }

  async embedDocument(params: { document_id: string; workspace_id?: string; title?: string; content: string; updated?: string }): Promise<{ indexed: boolean }> {
    return this.request('/ai/embed', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async deleteEmbedding(documentId: string): Promise<{ deleted: boolean }> {
    return this.request(`/ai/embed/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
  }

  async searchSimilar(query: string, opts: { workspace?: string; limit?: number } = {}): Promise<{
    query: string;
    results: Array<{ id: string; title: string; workspace: string; score: number }>;
  }> {
    const p = new URLSearchParams({ q: query });
    if (opts.workspace) p.set('workspace', opts.workspace);
    if (opts.limit) p.set('limit', String(opts.limit));
    return this.request(`/ai/search?${p.toString()}`);
  }
}

export const apiService = new ApiService();
