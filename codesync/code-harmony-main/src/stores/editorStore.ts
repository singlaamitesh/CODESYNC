import { create } from 'zustand';
import { apiService } from '@/lib/api';
import type { Document as ApiDocument, AISuggestionResponse } from '@/lib/api';

// Language detection function
function detectLanguage(content: string): string {
  const code = content.toLowerCase();
  
  // Python
  if (/\bdef\s+\w+\s*\(/.test(content) || /\bimport\s+\w+/.test(content) || /\bprint\s*\(/.test(content)) {
    return 'python';
  }
  
  // TypeScript
  if (/\binterface\s+\w+/.test(content) || /:\s*(string|number|boolean)/.test(code) || /\btype\s+\w+\s*=/.test(content)) {
    return 'typescript';
  }
  
  // JavaScript
  if (/\bfunction\s+\w+/.test(content) || /\bconst\s+\w+/.test(content) || /\blet\s+\w+/.test(content) || /=>/.test(content) || /console\.log/.test(content)) {
    return 'javascript';
  }
  
  // Java
  if (/\bpublic\s+class/.test(content) || /System\.out\.println/.test(content)) {
    return 'java';
  }
  
  // C/C++
  if (/#include\s*</.test(content) || /\bint\s+main\s*\(/.test(content)) {
    return 'cpp';
  }
  
  // HTML
  if (/<html/i.test(content) || /<div/i.test(content) || /<!DOCTYPE/i.test(content)) {
    return 'html';
  }
  
  // CSS
  if (/[.#]\w+\s*\{/.test(content) && /:\s*\w+;/.test(content)) {
    return 'css';
  }
  
  // SQL
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(content)) {
    return 'sql';
  }
  
  // JSON
  if (/^\s*[\[{]/.test(content) && /[\]}]\s*$/.test(content)) {
    try {
      JSON.parse(content);
      return 'json';
    } catch {}
  }
  
  return 'text';
}

export interface AISuggestion {
  id: string;
  type: 'error' | 'best-practice' | 'refactoring' | 'documentation' | 'security';
  title: string;
  description: string;
  line?: number;
  code?: string;
  fix?: string;  // The corrected code to replace the problematic line
  confidence: number;
}

export interface Document {
  id: string | number;
  title: string;
  content: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeStats {
  lines: number;
  functions: number;
  classes: number;
  complexity: number;
}

interface EditorState {
  // Document state
  currentDocument: Document | null;
  documents: Document[];
  
  // AI
  aiSuggestions: AISuggestion[];
  isAIAnalyzing: boolean;
  codeStats: CodeStats;
  
  // UI state
  isSidebarOpen: boolean;
  activePanel: 'explorer' | 'ai';
  isSettingsOpen: boolean;
  
  // Connection
  isConnected: boolean;
  isSaving: boolean;
  lastSaved: string | null;
  
  // Y.js editor reference for applying fixes
  applyFixToEditor: ((line: number, newContent: string) => void) | null;
  
  // Actions
  setCurrentDocument: (doc: Document | null) => void;
  updateDocumentContent: (content: string) => void;
  setAISuggestions: (suggestions: AISuggestion[]) => void;
  setIsAIAnalyzing: (analyzing: boolean) => void;
  setCodeStats: (stats: CodeStats) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: 'explorer' | 'ai') => void;
  setIsConnected: (connected: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setLastSaved: (time: string | null) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setApplyFixToEditor: (fn: ((line: number, newContent: string) => void) | null) => void;
  
  // API Actions
  loadDocuments: () => Promise<void>;
  createDocument: (title: string, content: string) => Promise<void>;
  saveDocument: (doc: Document) => Promise<void>;
  requestAIAnalysis: (documentId: number) => Promise<void>;
  optimizeCode: (documentId: number) => Promise<{ optimized_code: string; changes: any[]; summary: string } | null>;
  searchSimilarDocuments: (query: string) => Promise<any>;
}

export const useEditorStore = create<EditorState>((set) => ({
  // Document state - start empty, will load from API
  currentDocument: null,
  documents: [],
  
  // AI - start with no suggestions
  aiSuggestions: [],
  isAIAnalyzing: false,
  codeStats: { lines: 0, functions: 0, classes: 0, complexity: 0 },
  
  // UI state
  isSidebarOpen: true,
  activePanel: 'explorer',
  isSettingsOpen: false,
  
  // Connection
  isConnected: true,
  isSaving: false,
  lastSaved: null,
  
  // Y.js editor reference for applying fixes
  applyFixToEditor: null,
  
  // Actions
  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  updateDocumentContent: (content) =>
    set((state) => ({
      currentDocument: state.currentDocument
        ? { 
            ...state.currentDocument, 
            content, 
            language: detectLanguage(content),
            updatedAt: new Date().toISOString() 
          }
        : null,
    })),
  setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),
  setIsAIAnalyzing: (analyzing) => set({ isAIAnalyzing: analyzing }),
  setCodeStats: (stats) => set({ codeStats: stats }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setLastSaved: (time) => set({ lastSaved: time }),
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setApplyFixToEditor: (fn) => set({ applyFixToEditor: fn }),

  // API Actions Implementation
  loadDocuments: async () => {
    try {
      const docs = await apiService.getDocuments();
      const convertedDocs: Document[] = docs.map(doc => ({
        id: doc.id.toString(),
        title: doc.title,
        content: doc.content,
        language: detectLanguage(doc.content), // Auto-detect language
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }));
      set({ documents: convertedDocs });
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  },

  createDocument: async (title: string, content: string) => {
    try {
      set({ isSaving: true });
      const newDoc = await apiService.createDocument(title, content);
      const convertedDoc: Document = {
        id: newDoc.id.toString(),
        title: newDoc.title,
        content: newDoc.content,
        language: detectLanguage(newDoc.content),
        createdAt: newDoc.created_at,
        updatedAt: newDoc.updated_at,
      };
      
      set((state) => ({
        documents: [...state.documents, convertedDoc],
        currentDocument: convertedDoc,
        isSaving: false,
        lastSaved: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Failed to create document:', error);
      set({ isSaving: false });
    }
  },

  saveDocument: async (doc: Document) => {
    try {
      set({ isSaving: true });
      const docId = typeof doc.id === 'string' ? parseInt(doc.id) : doc.id;
      const updatedDoc = await apiService.updateDocument(docId, doc.title, doc.content);
      
      const convertedDoc: Document = {
        id: updatedDoc.id.toString(),
        title: updatedDoc.title,
        content: updatedDoc.content,
        language: doc.language,
        createdAt: updatedDoc.created_at,
        updatedAt: updatedDoc.updated_at,
      };

      set((state) => ({
        documents: state.documents.map(d => d.id === doc.id ? convertedDoc : d),
        currentDocument: state.currentDocument?.id === doc.id ? convertedDoc : state.currentDocument,
        isSaving: false,
        lastSaved: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Failed to save document:', error);
      set({ isSaving: false });
    }
  },

  requestAIAnalysis: async (documentId: number) => {
    try {
      set({ isAIAnalyzing: true });
      const result = await apiService.getAISuggestions(documentId);
      
      if (result.status === 'success' && result.suggestion_data) {
        const suggestions: AISuggestion[] = result.suggestion_data.suggestions.map((s, index) => ({
          id: `ai-${documentId}-${index}`,
          type: s.type as 'error' | 'best-practice' | 'refactoring' | 'documentation' | 'security',
          title: s.type.toUpperCase(),
          description: s.message,
          line: s.line,
          confidence: s.severity === 'error' ? 0.9 : s.severity === 'warning' ? 0.7 : 0.5,
        }));

        const stats: CodeStats = {
          lines: result.suggestion_data.analysis.lines,
          functions: result.suggestion_data.analysis.functions,
          classes: result.suggestion_data.analysis.classes,
          complexity: result.suggestion_data.analysis.complexity_score,
        };

        set({ 
          aiSuggestions: suggestions,
          codeStats: stats,
          isAIAnalyzing: false 
        });
      }
    } catch (error) {
      console.error('Failed to get AI analysis:', error);
      set({ isAIAnalyzing: false });
    }
  },

  optimizeCode: async (documentId: number) => {
    try {
      set({ isAIAnalyzing: true });
      const result = await apiService.optimizeCode(documentId);
      set({ isAIAnalyzing: false });
      
      if (result.status === 'success' && result.optimization) {
        return {
          optimized_code: result.optimization.optimized_code,
          changes: result.optimization.changes,
          summary: result.optimization.summary,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to optimize code:', error);
      set({ isAIAnalyzing: false });
      return null;
    }
  },

  searchSimilarDocuments: async (query: string) => {
    try {
      const results = await apiService.searchSimilar(query);
      console.log('Similar documents:', results);
      return results;
    } catch (error) {
      console.error('Failed to search similar documents:', error);
      return null;
    }
  },
}));
