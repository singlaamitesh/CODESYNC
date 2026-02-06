/**
 * useYjs Hook - React hook for Y.js CRDT integration
 * 
 * This hook manages the CRDT document lifecycle and provides:
 * - Automatic connection/disconnection
 * - Content synchronization
 * - User awareness (cursors, presence)
 * - AI agent integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { YjsProvider, AIGhostAgent, UserAwareness, CRDTDelta } from '@/lib/yjs-provider';
import { useEditorStore } from '@/stores/editorStore';

interface UseYjsOptions {
  documentId: string | null;
  userId?: string;
  userName?: string;
  wsUrl?: string;
}

interface UseYjsReturn {
  // State
  content: string;
  isConnected: boolean;
  isSynced: boolean;
  connectedUsers: UserAwareness[];
  deltas: CRDTDelta[];
  
  // Actions
  insert: (position: number, text: string) => void;
  delete: (position: number, length: number) => void;
  replace: (position: number, deleteLength: number, insertText: string) => void;
  setContent: (content: string) => void;
  updateCursor: (line: number, column: number) => void;
  
  // AI Agent
  aiApplyFix: (lineNumber: number, originalLine: string, fixedLine: string) => void;
  aiInsertLine: (afterLineNumber: number, newCode: string) => void;
  aiApplyMultipleFixes: (fixes: Array<{ line: number; original: string; fixed: string }>) => void;
  
  // Provider access
  provider: YjsProvider | null;
  aiAgent: AIGhostAgent | null;
}

// Generate unique user ID
const generateUserId = (): string => {
  const stored = localStorage.getItem('codesync-user-id');
  if (stored) return stored;
  
  const newId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('codesync-user-id', newId);
  return newId;
};

// Generate random username
const generateUserName = (): string => {
  const adjectives = ['Swift', 'Clever', 'Bright', 'Quick', 'Sharp'];
  const nouns = ['Coder', 'Dev', 'Hacker', 'Builder', 'Creator'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}${Math.floor(Math.random() * 100)}`;
};

export const useYjs = (options: UseYjsOptions): UseYjsReturn => {
  const { documentId, userId, userName, wsUrl = 'ws://127.0.0.1:8001' } = options;
  
  const [content, setContentState] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<UserAwareness[]>([]);
  const [deltas, setDeltas] = useState<CRDTDelta[]>([]);
  
  const providerRef = useRef<YjsProvider | null>(null);
  const aiAgentRef = useRef<AIGhostAgent | null>(null);
  
  const { setIsConnected: setStoreConnected } = useEditorStore();

  // Initialize providers when document changes
  useEffect(() => {
    if (!documentId) {
      // Cleanup if no document
      providerRef.current?.disconnect();
      aiAgentRef.current?.disconnect();
      providerRef.current = null;
      aiAgentRef.current = null;
      setIsConnected(false);
      setIsSynced(false);
      return;
    }

    const effectiveUserId = userId || generateUserId();
    const effectiveUserName = userName || generateUserName();

    // Create user provider
    const provider = new YjsProvider(
      documentId,
      effectiveUserId,
      effectiveUserName,
      false
    );

    // Create AI agent provider (joins as a separate "ghost" user)
    const aiAgent = new AIGhostAgent(documentId);

    // Set up callbacks
    provider.onContent((newContent, newDeltas) => {
      setContentState(newContent);
      setDeltas(prev => [...prev.slice(-50), ...newDeltas]); // Keep last 50 deltas
    });

    provider.onAwareness((users) => {
      setConnectedUsers(users);
    });

    provider.onSync((synced) => {
      setIsSynced(synced);
    });

    // Connect to WebSocket server
    try {
      provider.connect(wsUrl);
      aiAgent.connect(wsUrl);
      setIsConnected(true);
      setStoreConnected(true);
      console.log(`[useYjs] Connected to document ${documentId}`);
    } catch (error) {
      console.error('[useYjs] Connection failed:', error);
      setIsConnected(false);
      setStoreConnected(false);
    }

    providerRef.current = provider;
    aiAgentRef.current = aiAgent;

    // Cleanup on unmount or document change
    return () => {
      provider.disconnect();
      aiAgent.disconnect();
      setIsConnected(false);
      setStoreConnected(false);
    };
  }, [documentId, userId, userName, wsUrl, setStoreConnected]);

  // Insert text at position
  const insert = useCallback((position: number, text: string) => {
    providerRef.current?.insert(position, text);
  }, []);

  // Delete text at position
  const deleteText = useCallback((position: number, length: number) => {
    providerRef.current?.delete(position, length);
  }, []);

  // Replace text at position
  const replace = useCallback((position: number, deleteLength: number, insertText: string) => {
    providerRef.current?.replace(position, deleteLength, insertText);
  }, []);

  // Set entire content
  const setContent = useCallback((newContent: string) => {
    providerRef.current?.setContent(newContent);
  }, []);

  // Update cursor position
  const updateCursor = useCallback((line: number, column: number) => {
    providerRef.current?.updateCursor(line, column);
  }, []);

  // AI Agent: Apply fix at line
  const aiApplyFix = useCallback((lineNumber: number, originalLine: string, fixedLine: string) => {
    aiAgentRef.current?.applyFixAtLine(lineNumber, originalLine, fixedLine);
  }, []);

  // AI Agent: Insert new line
  const aiInsertLine = useCallback((afterLineNumber: number, newCode: string) => {
    aiAgentRef.current?.insertLine(afterLineNumber, newCode);
  }, []);

  // AI Agent: Apply multiple fixes
  const aiApplyMultipleFixes = useCallback((fixes: Array<{ line: number; original: string; fixed: string }>) => {
    aiAgentRef.current?.applyMultipleFixes(fixes);
  }, []);

  return {
    content,
    isConnected,
    isSynced,
    connectedUsers,
    deltas,
    insert,
    delete: deleteText,
    replace,
    setContent,
    updateCursor,
    aiApplyFix,
    aiInsertLine,
    aiApplyMultipleFixes,
    provider: providerRef.current,
    aiAgent: aiAgentRef.current
  };
};

export default useYjs;
