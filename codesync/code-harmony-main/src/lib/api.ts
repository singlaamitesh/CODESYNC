// API service for connecting to FastAPI backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface Document {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface AISuggestionResponse {
  document_id: number;
  suggestion_data: {
    suggestions: Array<{
      type: string;
      message: string;
      line: number;
      severity: string;
    }>;
    analysis: {
      lines: number;
      functions: number;
      classes: number;
      complexity_score: number;
      language?: string;
      llm_used?: string | null;
      summary?: string;
      next_suggestion?: string;
    };
    embedding: number[];
  };
  status: string;
}

interface OptimizationResponse {
  document_id: number;
  optimization: {
    optimized_code: string;
    changes: Array<{
      description: string;
      impact: string;
    }>;
    performance_improvement: string;
    summary: string;
    language?: string;
    llm_used?: string;
  };
  status: string;
}

interface CompletionResponse {
  document_id: number;
  completions: Array<{
    text: string;
    description: string;
  }>;
  status: string;
}

interface EmbeddingResponse {
  id: number;
  vector: number[];
  created_at: string;
  document: number;
}

class ApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      headers: { ...defaultHeaders, ...options.headers },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Handle empty responses (like DELETE)
      const text = await response.text();
      if (!text) {
        return {} as T;
      }
      
      return JSON.parse(text);
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Document operations
  async getDocuments(): Promise<Document[]> {
    return this.makeRequest<Document[]>('/documents/');
  }

  async getDocument(id: number): Promise<Document> {
    return this.makeRequest<Document>(`/documents/${id}/`);
  }

  async createDocument(title: string, content: string): Promise<Document> {
    return this.makeRequest<Document>('/documents/', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    });
  }

  async updateDocument(id: number, title: string, content: string): Promise<Document> {
    return this.makeRequest<Document>(`/documents/${id}/`, {
      method: 'PUT',
      body: JSON.stringify({ title, content }),
    });
  }

  async deleteDocument(id: number): Promise<void> {
    return this.makeRequest<void>(`/documents/${id}/`, {
      method: 'DELETE',
    });
  }

  // AI operations  
  async getAISuggestions(documentId: number): Promise<AISuggestionResponse> {
    return this.makeRequest<AISuggestionResponse>(`/ai/analyze/${documentId}`, {
      method: 'POST',
    });
  }

  async optimizeCode(documentId: number): Promise<OptimizationResponse> {
    return this.makeRequest<OptimizationResponse>(`/ai/optimize/${documentId}`, {
      method: 'POST',
    });
  }

  async getCompletions(documentId: number, line: number, column: number): Promise<CompletionResponse> {
    return this.makeRequest<CompletionResponse>(`/ai/complete/${documentId}`, {
      method: 'POST',
      body: JSON.stringify({ line, column }),
    });
  }

  async searchSimilar(query: string): Promise<any> {
    return this.makeRequest<any>(`/ai/search?q=${encodeURIComponent(query)}`);
  }

  // Embedding operations
  async getEmbeddings(): Promise<EmbeddingResponse[]> {
    return this.makeRequest<EmbeddingResponse[]>('/embeddings/');
  }

  async getDocumentEmbedding(documentId: number): Promise<EmbeddingResponse[]> {
    const embeddings = await this.getEmbeddings();
    return embeddings.filter(embedding => embedding.document === documentId);
  }
}

export const apiService = new ApiService();
export type { Document, AISuggestionResponse, OptimizationResponse, CompletionResponse, EmbeddingResponse };
