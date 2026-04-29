import { create } from 'zustand';
import { apiService } from '../lib/api';
import {
  createDocument as pbCreateDocument,
  deleteDocument as pbDeleteDocument,
  listAllDocuments,
  updateDocument as pbUpdateDocument,
} from '../lib/workspace';

// Debounce embedding calls per-document so rapid saves coalesce into one embed.
const _embedTimers = new Map<string, ReturnType<typeof setTimeout>>();
const EMBED_DEBOUNCE_MS = 10_000;

function scheduleEmbed(doc: {
  id: string; title: string; content: string; workspaceId?: string; updatedAt: string;
}) {
  const existing = _embedTimers.get(doc.id);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    _embedTimers.delete(doc.id);
    apiService
      .embedDocument({
        document_id: doc.id,
        workspace_id: doc.workspaceId || '',
        title: doc.title,
        content: doc.content,
        updated: doc.updatedAt,
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('Embedding failed (non-fatal):', err);
      });
  }, EMBED_DEBOUNCE_MS);
  _embedTimers.set(doc.id, t);
}

// Language detection function
function detectLanguage(content: string): string {
  const code = content.toLowerCase();

  if (/\bdef\s+\w+\s*\(/.test(content) || /\bimport\s+\w+/.test(content) || /\bprint\s*\(/.test(content)) {
    return 'python';
  }
  if (/\binterface\s+\w+/.test(content) || /:\s*(string|number|boolean)/.test(code) || /\btype\s+\w+\s*=/.test(content)) {
    return 'typescript';
  }
  if (/\bfunction\s+\w+/.test(content) || /\bconst\s+\w+/.test(content) || /\blet\s+\w+/.test(content) || /=>/.test(content) || /console\.log/.test(content)) {
    return 'javascript';
  }
  if (/\bpublic\s+class/.test(content) || /System\.out\.println/.test(content)) {
    return 'java';
  }
  if (/#include\s*</.test(content) || /\bint\s+main\s*\(/.test(content)) {
    return 'cpp';
  }
  if (/<html/i.test(content) || /<div/i.test(content) || /<!DOCTYPE/i.test(content)) {
    return 'html';
  }
  if (/[.#]\w+\s*\{/.test(content) && /:\s*\w+;/.test(content)) {
    return 'css';
  }
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(content)) {
    return 'sql';
  }
  if (/^\s*[\[{]/.test(content) && /[\]}]\s*$/.test(content)) {
    try {
      JSON.parse(content);
      return 'json';
    } catch {
      /* not json */
    }
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
  fix?: string;
  confidence: number;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  folderId?: string | null;
}

export interface CodeStats {
  lines: number;
  functions: number;
  classes: number;
  complexity: number;
}

export interface Tab {
  id: string;
  documentId: string;
  title: string;
  language: string;
  isDirty: boolean;
}

export interface Workspace {
  id: string;
  name: string;
}

interface EditorState {
  currentDocument: Document | null;
  documents: Document[];

  openTabs: Tab[];
  activeTabId: string | null;

  currentWorkspace: Workspace | null;

  aiSuggestions: AISuggestion[];
  isAIAnalyzing: boolean;
  codeStats: CodeStats;

  isSidebarOpen: boolean;
  activePanel: 'explorer' | 'ai' | 'chat';
  isSettingsOpen: boolean;

  isConnected: boolean;
  isSaving: boolean;
  lastSaved: string | null;

  applyFixToEditor: ((line: number, newContent: string) => void) | null;
  replaceEditorContent: ((newContent: string) => void) | null;

  setCurrentDocument: (doc: Document | null) => void;
  updateDocumentContent: (content: string) => void;
  setAISuggestions: (suggestions: AISuggestion[]) => void;
  setIsAIAnalyzing: (analyzing: boolean) => void;
  setCodeStats: (stats: CodeStats) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: 'explorer' | 'ai' | 'chat') => void;
  setIsConnected: (connected: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setLastSaved: (time: string | null) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setApplyFixToEditor: (fn: ((line: number, newContent: string) => void) | null) => void;
  setReplaceEditorContent: (fn: ((newContent: string) => void) | null) => void;

  openTab: (doc: Document) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (tabs: Tab[]) => void;
  markTabDirty: (tabId: string, dirty: boolean) => void;

  setCurrentWorkspace: (ws: Workspace | null) => void;

  loadDocuments: () => Promise<void>;
  createDocument: (title: string, content: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  saveDocument: (doc: Document) => Promise<void>;
  requestAIAnalysis: (documentId: string, content: string, filename: string) => Promise<void>;
  optimizeCode: (documentId: string, content: string, filename: string) => Promise<{ optimized_code: string; changes: any[]; summary: string } | null>;
  searchSimilarDocuments: (query: string) => Promise<Array<{ id: string; title: string; workspace: string; score: number }>>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentDocument: null,
  documents: [],

  openTabs: [],
  activeTabId: null,

  currentWorkspace: null,

  aiSuggestions: [],
  isAIAnalyzing: false,
  codeStats: { lines: 0, functions: 0, classes: 0, complexity: 0 },

  isSidebarOpen: true,
  activePanel: 'explorer',
  isSettingsOpen: false,

  isConnected: false,
  isSaving: false,
  lastSaved: null,

  applyFixToEditor: null,
  replaceEditorContent: null,

  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  updateDocumentContent: (content) =>
    set((state) => ({
      currentDocument: state.currentDocument
        ? {
            ...state.currentDocument,
            content,
            language: detectLanguage(content),
            updatedAt: new Date().toISOString(),
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
  setReplaceEditorContent: (fn) => set({ replaceEditorContent: fn }),

  openTab: (doc) => {
    const state = get();
    const docId = doc.id;
    const existingTab = state.openTabs.find((t) => t.documentId === docId);
    if (existingTab) {
      set({ activeTabId: existingTab.id, currentDocument: doc });
      return;
    }
    const newTab: Tab = {
      id: `tab-${docId}-${Date.now()}`,
      documentId: docId,
      title: doc.title,
      language: doc.language,
      isDirty: false,
    };
    set({
      openTabs: [...state.openTabs, newTab],
      activeTabId: newTab.id,
      currentDocument: doc,
    });
  },

  closeTab: (tabId) => {
    const state = get();
    const remaining = state.openTabs.filter((t) => t.id !== tabId);
    if (state.activeTabId === tabId) {
      const idx = state.openTabs.findIndex((t) => t.id === tabId);
      const nextTab = remaining[Math.min(idx, remaining.length - 1)];
      if (nextTab) {
        const nextDoc = state.documents.find((d) => d.id === nextTab.documentId);
        set({ openTabs: remaining, activeTabId: nextTab.id, currentDocument: nextDoc || null });
      } else {
        set({ openTabs: [], activeTabId: null, currentDocument: null });
      }
    } else {
      set({ openTabs: remaining });
    }
  },

  setActiveTab: (tabId) => {
    const state = get();
    const tab = state.openTabs.find((t) => t.id === tabId);
    if (tab) {
      const doc = state.documents.find((d) => d.id === tab.documentId);
      set({ activeTabId: tabId, currentDocument: doc || null });
    }
  },

  reorderTabs: (tabs) => set({ openTabs: tabs }),

  markTabDirty: (tabId, dirty) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.id === tabId ? { ...t, isDirty: dirty } : t)),
    })),

  setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),

  loadDocuments: async () => {
    try {
      const docs = await listAllDocuments();
      set({
        documents: docs.map((d) => ({
          id: d.id,
          title: d.title,
          content: d.content,
          language: d.language || detectLanguage(d.content),
          createdAt: d.created,
          updatedAt: d.updated,
          workspaceId: d.workspace,
          folderId: d.folder ?? null,
        })),
      });
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  },

  createDocument: async (title, content) => {
    set({ isSaving: true });
    try {
      const ws = get().currentWorkspace;
      const lang = detectLanguage(content);
      const created = await pbCreateDocument(ws?.id || null, title, content, lang);
      const doc: Document = {
        id: created.id,
        title: created.title,
        content: created.content,
        language: created.language || lang,
        createdAt: created.created,
        updatedAt: created.updated,
        workspaceId: created.workspace,
        folderId: created.folder ?? null,
      };
      set((state) => ({
        documents: [...state.documents, doc],
        currentDocument: doc,
        isSaving: false,
        lastSaved: new Date().toISOString(),
      }));
      scheduleEmbed(doc);
    } catch (err) {
      set({ isSaving: false });
      console.error('Failed to create document:', err);
      throw err;  // surface the real reason to the caller's toast
    }
  },

  deleteDocument: async (id) => {
    try {
      await pbDeleteDocument(id);
      apiService.deleteEmbedding(id).catch(() => { /* non-fatal */ });
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
        openTabs: state.openTabs.filter((t) => t.documentId !== id),
      }));
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  },

  saveDocument: async (doc) => {
    try {
      set({ isSaving: true });
      const updated = await pbUpdateDocument(doc.id, {
        title: doc.title,
        content: doc.content,
        language: doc.language,
      });
      const converted: Document = {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        language: updated.language,
        createdAt: updated.created,
        updatedAt: updated.updated,
        workspaceId: updated.workspace,
        folderId: updated.folder ?? null,
      };
      set((state) => ({
        documents: state.documents.map((d) => (d.id === doc.id ? converted : d)),
        currentDocument: state.currentDocument?.id === doc.id ? converted : state.currentDocument,
        isSaving: false,
        lastSaved: new Date().toISOString(),
      }));
      scheduleEmbed(converted);
    } catch (err) {
      console.error('Failed to save document:', err);
      set({ isSaving: false });
    }
  },

  requestAIAnalysis: async (documentId, content, filename) => {
    try {
      set({ isAIAnalyzing: true });
      const result = await apiService.analyzeCode(documentId, content, filename);

      if (result.status === 'success' && result.suggestion_data) {
        const suggestions: AISuggestion[] = result.suggestion_data.suggestions.map((s, index) => ({
          id: `ai-${documentId}-${index}`,
          type: s.type as AISuggestion['type'],
          title: s.type.toUpperCase(),
          description: s.message,
          line: s.line,
          fix: s.fix,
          confidence: s.severity === 'error' ? 0.9 : s.severity === 'warning' ? 0.7 : 0.5,
        }));

        const stats: CodeStats = {
          lines: result.suggestion_data.analysis.lines,
          functions: result.suggestion_data.analysis.functions,
          classes: result.suggestion_data.analysis.classes,
          complexity: result.suggestion_data.analysis.complexity_score,
        };

        set({ aiSuggestions: suggestions, codeStats: stats, isAIAnalyzing: false });
      } else {
        set({ isAIAnalyzing: false });
      }
    } catch (err) {
      console.error('Failed to get AI analysis:', err);
      set({ isAIAnalyzing: false });
    }
  },

  optimizeCode: async (documentId, content, filename) => {
    try {
      set({ isAIAnalyzing: true });
      const result = await apiService.optimizeCode(documentId, content, filename);
      set({ isAIAnalyzing: false });
      if (result.status === 'success' && result.optimization) {
        return {
          optimized_code: result.optimization.optimized_code,
          changes: result.optimization.changes,
          summary: result.optimization.summary,
        };
      }
      return null;
    } catch (err) {
      console.error('Failed to optimize:', err);
      set({ isAIAnalyzing: false });
      return null;
    }
  },

  searchSimilarDocuments: async (query) => {
    try {
      const ws = get().currentWorkspace;
      const result = await apiService.searchSimilar(query, {
        workspace: ws?.id,
        limit: 5,
      });
      return result.results;
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  },
}));
