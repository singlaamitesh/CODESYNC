/**
 * CollaborativeEditor - Monaco Editor with Y.js CRDT Integration
 * 
 * This component provides:
 * 1. Real-time collaborative editing via CRDTs
 * 2. Delta-based updates (only changes are sent)
 * 3. User awareness (cursors, presence)
 * 4. AI Ghost Agent integration
 * 5. Conflict-free editing
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { pb } from '@/shared/lib/pb';
import { Loader2 } from 'lucide-react';
import { EditorStatusBar } from './EditorStatusBar';
import {
  CODESYNC_THEME_NAME,
  codesyncDarkTheme,
  buildEditorOptions,
} from './monacoTheme';
import {
  type UserPresence,
  generateUserColor,
  getUserIdentity,
} from './userIdentity';

const devLog = import.meta.env.DEV ? console.log.bind(console) : () => {};

interface CollaborativeEditorProps {
  onCursorChange?: (line: number, column: number) => void;
}

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({ onCursorChange }) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<UserPresence[]>([]);
  const [deltaCount, setDeltaCount] = useState(0);
  const [editorReady, setEditorReady] = useState(false); // Track when Monaco is mounted
  
  const {
    currentDocument,
    updateDocumentContent,
    saveDocument,
    setIsConnected: setStoreConnected,
    setApplyFixToEditor,
    setReplaceEditorContent,
  } = useEditorStore();
  
  const { settings } = useSettingsStore();

  // WebSocket for AI analysis (separate from Y.js CRDT sync)
  const { sendEdit } = useWebSocket(currentDocument?.id?.toString() || null);
  
  // Function to apply a fix to a specific line via Y.js CRDT.
  // Supports multi-line fixes (AI returns "\n" in the replacement). Preserves
  // the original line's leading indentation only when the AI's fix is itself
  // un-indented — if the AI deliberately changed indentation, we honor it.
  const applyFixToLine = useCallback((lineNumber: number, newLineContent: string) => {
    const ytext = ytextRef.current;
    const editor = editorRef.current;

    if (!ytext || !editor) {
      console.error('[CRDT] Cannot apply fix: Y.Text or editor not initialized');
      return;
    }

    const content = ytext.toString();
    const lines = content.split('\n');

    if (lineNumber < 1 || lineNumber > lines.length) {
      console.error(`[CRDT] Invalid line number: ${lineNumber}`);
      return;
    }

    // Compute the byte offset of the start of the target line.
    let startPos = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
      startPos += lines[i].length + 1; // +1 for the newline
    }
    const oldLine = lines[lineNumber - 1];
    const oldIndent = oldLine.match(/^\s*/)?.[0] || '';

    // Treat the AI's fix as authoritative for indentation if it has any
    // leading whitespace itself; otherwise re-apply the original line's indent.
    const fixHasLeadingSpace = /^\s/.test(newLineContent);
    const replacement = fixHasLeadingSpace
      ? newLineContent.replace(/\n+$/, '')
      : oldIndent + newLineContent.trim();

    devLog(`[CRDT] Applying fix to line ${lineNumber}:`);
    devLog(`  Old: ${JSON.stringify(oldLine)}`);
    devLog(`  New: ${JSON.stringify(replacement)}`);

    ydocRef.current?.transact(() => {
      ytext.delete(startPos, oldLine.length);
      ytext.insert(startPos, replacement);
    });
  }, []);
  
  // Function to replace ALL content (for code optimization)
  const replaceAllContent = useCallback((newContent: string) => {
    const ytext = ytextRef.current;
    const editor = editorRef.current;
    
    if (!ytext || !editor) {
      console.error('[CRDT] Cannot replace content: Y.Text or editor not initialized');
      return;
    }
    
    const currentLength = ytext.length;
    
    devLog(`[CRDT] Replacing all content (${currentLength} chars → ${newContent.length} chars)`);
    
    // Use Y.js transaction to delete all and insert new content atomically
    ydocRef.current?.transact(() => {
      // Delete all current content
      if (currentLength > 0) {
        ytext.delete(0, currentLength);
      }
      // Insert new content
      ytext.insert(0, newContent);
    });
    
    devLog('[CRDT] All content replaced successfully');
  }, []);
  
  // Register editor functions in the store so AISuggestionsPanel can use them
  useEffect(() => {
    setApplyFixToEditor(applyFixToLine);
    setReplaceEditorContent(replaceAllContent);
    return () => {
      setApplyFixToEditor(null);
      setReplaceEditorContent(null);
    };
  }, [applyFixToLine, setApplyFixToEditor, replaceAllContent, setReplaceEditorContent]);
  
  // Reset editorReady when document changes (editor will re-mount due to key prop)
  useEffect(() => {
    setEditorReady(false);
  }, [currentDocument?.id]);

  // Set up Y.js when document changes AND editor is ready
  useEffect(() => {
    if (!currentDocument || !editorReady || !editorRef.current || !monacoRef.current) {
      devLog('[CRDT] Waiting for:', {
        document: !!currentDocument,
        editorReady,
        editorRef: !!editorRef.current,
        monacoRef: !!monacoRef.current
      });
      return;
    }

    const { userId, userName, userColor } = getUserIdentity();
    
    // Create Y.Doc - the CRDT document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    
    // Create Y.Text - CRDT text type for code
    const ytext = ydoc.getText('monaco');
    ytextRef.current = ytext; // Store reference for applyFix
    
    // Y.js WebSocket now lives on the FastAPI backend: /ws/yjs/{room}?token=...
    // In production the FastAPI service is behind Caddy at the same origin.
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace('/api', '');
    const wsUrl = (import.meta.env.VITE_YJS_WS_URL || apiBase).replace(/^http/, 'ws') + '/ws/yjs';
    const roomName = `codesync-${currentDocument.id}`;
    const token = pb.authStore.token;
    devLog('[CRDT] Y.js WebSocket URL:', wsUrl, 'Room:', roomName);

    const provider = new WebsocketProvider(wsUrl, roomName, ydoc, {
      connect: true,
      params: token ? { token } : {},
    });
    providerRef.current = provider;
    
    // Set user awareness with PERSISTENT user ID
    provider.awareness.setLocalStateField('user', {
      id: userId,
      name: userName,
      color: userColor,
      isAI: false,
    });
    
    // Listen for connection status
    provider.on('status', (event: { status: string }) => {
      const connected = event.status === 'connected';
      setIsConnected(connected);
      setStoreConnected(connected);
      devLog(`[CRDT] Connection status: ${event.status} (User: ${userName})`);
    });
    
    // Listen for sync status
    provider.on('sync', (synced: boolean) => {
      setIsSynced(synced);
      devLog(`[CRDT] Sync status: ${synced ? 'synced' : 'syncing'}`);
      
      // When synced, check if Y.Text needs initialization from database
      if (synced && ytext.length === 0 && currentDocument.content && currentDocument.content.length > 0) {
        ytext.insert(0, currentDocument.content);
        devLog(`[CRDT] Initialized Y.Text with ${currentDocument.content.length} chars from database`);
      } else if (synced && ytext.length > 0) {
        devLog(`[CRDT] Y.Text already populated: ${ytext.length} chars (from other users or previous session)`);
      }
    });
    
    // Listen for awareness changes
    provider.awareness.on('change', () => {
      const users: UserPresence[] = [];
      provider.awareness.getStates().forEach((state: any) => {
        if (state.user) {
          users.push(state.user);
        }
      });
      setConnectedUsers(users);
    });
    
    // Create Monaco binding - connects Y.Text to Monaco editor
    // MonacoBinding will sync the editor model with Y.Text
    // Editor already has defaultValue set, so content shows immediately
    const binding = new MonacoBinding(
      ytext,
      editorRef.current.getModel()!,
      new Set([editorRef.current]),
      provider.awareness
    );
    bindingRef.current = binding;
    
    // Track delta operations and trigger AI analysis
    ytext.observe((event: Y.YTextEvent) => {
      setDeltaCount(prev => prev + event.changes.delta.length);
      
      // Log delta operations for debugging
      event.changes.delta.forEach((delta, index) => {
        if (delta.insert) {
          devLog(`[CRDT Delta] Insert: "${String(delta.insert).substring(0, 20)}..."`);
        }
        if (delta.delete) {
          devLog(`[CRDT Delta] Delete: ${delta.delete} chars`);
        }
        if (delta.retain) {
          devLog(`[CRDT Delta] Retain: ${delta.retain} chars`);
        }
      });
      
      // Get current content
      const content = ytext.toString();
      
      // Update store with current content
      updateDocumentContent(content);
      
      // Auto-save to database after 3 seconds of no typing
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        const state = useEditorStore.getState();
        const doc = state.currentDocument;
        if (doc) {
          devLog('[CRDT] Auto-saving document to database...');
          state.saveDocument(doc);
        }
      }, 3000);
      
      // Debounced AI analysis - trigger after 1.5 seconds of no typing
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        devLog('[CRDT] Triggering AI analysis after debounce');
        sendEdit(content);
      }, 1500);
    });
    
    devLog(`[CRDT] Initialized Y.js for document ${currentDocument.id}`);
    
    // Cleanup on unmount or document change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      // Save before cleanup
      const state = useEditorStore.getState();
      const doc = state.currentDocument;
      if (doc) {
        state.saveDocument(doc);
      }
      ytextRef.current = null;
      binding?.destroy();
      provider?.destroy();
      ydoc?.destroy();
      devLog('[CRDT] Cleaned up Y.js');
    };
  }, [currentDocument?.id, editorReady, setStoreConnected, updateDocumentContent, sendEdit]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    devLog('[CRDT] Monaco editor mounted');

    // Apply the "Midnight Pro" theme (defined in ./monacoTheme).
    monaco.editor.defineTheme(CODESYNC_THEME_NAME, codesyncDarkTheme);
    monaco.editor.setTheme(CODESYNC_THEME_NAME);

    // Listen for cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      const position = e.position;
      onCursorChange?.(position.lineNumber, position.column);
      
      // Update awareness with cursor position
      if (providerRef.current) {
        const { userId, userName } = getUserIdentity();
        providerRef.current.awareness.setLocalStateField('user', {
          id: userId,
          name: userName,
          color: generateUserColor(),
          isAI: false,
          cursor: { line: position.lineNumber, column: position.column }
        });
      }
    });
    
    // Mark editor as ready - this triggers Y.js initialization
    setEditorReady(true);
  };

  if (!currentDocument) {
    return (
      <div className="flex h-full items-center justify-center bg-editor">
        <p className="text-muted-foreground">Select a document to start editing</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-editor relative">
      <EditorStatusBar
        isConnected={isConnected}
        isSynced={isSynced}
        connectedUsers={connectedUsers}
        deltaCount={deltaCount}
      />

      <Editor
        key={`editor-${currentDocument.id}`}
        height="100%"
        language={currentDocument.language}
        defaultValue={currentDocument.content}
        onMount={handleEditorMount}
        loading={
          <div className="flex h-full items-center justify-center bg-editor">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
        options={buildEditorOptions(settings)}
      />
    </div>
  );
};

export default CollaborativeEditor;
