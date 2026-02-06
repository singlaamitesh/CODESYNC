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
import { useEditorStore } from '@/stores/editorStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Loader2, Users, Wifi, WifiOff, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollaborativeEditorProps {
  onCursorChange?: (line: number, column: number) => void;
}

interface UserPresence {
  id: string;
  name: string;
  color: string;
  isAI: boolean;
  cursor?: { line: number; column: number };
}

// Generate random color for user
const generateUserColor = (): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Get or create user identity
const getUserIdentity = () => {
  let userId = localStorage.getItem('codesync-user-id');
  let userName = localStorage.getItem('codesync-user-name');
  let userColor = localStorage.getItem('codesync-user-color');
  
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('codesync-user-id', userId);
  }
  
  if (!userName) {
    const adjectives = ['Swift', 'Clever', 'Bright', 'Quick', 'Sharp'];
    const nouns = ['Coder', 'Dev', 'Hacker', 'Builder', 'Creator'];
    userName = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 100)}`;
    localStorage.setItem('codesync-user-name', userName);
  }
  
  if (!userColor) {
    userColor = generateUserColor();
    localStorage.setItem('codesync-user-color', userColor);
  }
  
  return { userId, userName, userColor };
};

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({ onCursorChange }) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<UserPresence[]>([]);
  const [deltaCount, setDeltaCount] = useState(0);
  const [editorReady, setEditorReady] = useState(false); // Track when Monaco is mounted
  
  const {
    currentDocument,
    updateDocumentContent,
    setIsConnected: setStoreConnected,
    setApplyFixToEditor,
  } = useEditorStore();
  
  // WebSocket for AI analysis (separate from Y.js CRDT sync)
  const { sendEdit } = useWebSocket(currentDocument?.id?.toString() || null);
  
  // Function to apply a fix to a specific line via Y.js CRDT
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
    
    // Calculate the start and end positions of the line
    let startPos = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
      startPos += lines[i].length + 1; // +1 for newline
    }
    const oldLine = lines[lineNumber - 1];
    
    // Preserve indentation from original line
    const indent = oldLine.match(/^\s*/)?.[0] || '';
    const fixedLine = indent + newLineContent.trim();
    
    console.log(`[CRDT] Applying fix to line ${lineNumber}:`);
    console.log(`  Old: "${oldLine}"`);
    console.log(`  New: "${fixedLine}"`);
    
    // Use Y.js transaction to delete and insert atomically
    ydocRef.current?.transact(() => {
      ytext.delete(startPos, oldLine.length);
      ytext.insert(startPos, fixedLine);
    });
    
    // Also update the Monaco editor model directly as a backup
    // (Y.js binding should do this automatically, but just in case)
    const model = editor.getModel();
    if (model) {
      const range = {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: oldLine.length + 1,
      };
      editor.executeEdits('ai-fix', [{
        range,
        text: fixedLine,
        forceMoveMarkers: true,
      }]);
    }
    
    console.log('[CRDT] Fix applied successfully');
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
    
    console.log(`[CRDT] Replacing all content (${currentLength} chars → ${newContent.length} chars)`);
    
    // Use Y.js transaction to delete all and insert new content atomically
    ydocRef.current?.transact(() => {
      // Delete all current content
      if (currentLength > 0) {
        ytext.delete(0, currentLength);
      }
      // Insert new content
      ytext.insert(0, newContent);
    });
    
    console.log('[CRDT] All content replaced successfully');
  }, []);
  
  // Register the applyFix function in the store so AISuggestionsPanel can use it
  useEffect(() => {
    setApplyFixToEditor(applyFixToLine);
    // Also store the replaceAllContent function (we'll add it to the store)
    (window as any).__replaceEditorContent = replaceAllContent;
    return () => {
      setApplyFixToEditor(null);
      (window as any).__replaceEditorContent = null;
    };
  }, [applyFixToLine, setApplyFixToEditor, replaceAllContent]);
  
  // Reset editorReady when document changes (editor will re-mount due to key prop)
  useEffect(() => {
    setEditorReady(false);
  }, [currentDocument?.id]);

  // Set up Y.js when document changes AND editor is ready
  useEffect(() => {
    if (!currentDocument || !editorReady || !editorRef.current || !monacoRef.current) {
      console.log('[CRDT] Waiting for:', {
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
    
    // Create WebSocket provider for Y.js sync
    const wsUrl = 'ws://127.0.0.1:8001'; // Y.js WebSocket server
    const roomName = `codesync-${currentDocument.id}`;
    
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc, {
      connect: true,
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
      console.log(`[CRDT] Connection status: ${event.status} (User: ${userName})`);
    });
    
    // Listen for sync status
    provider.on('sync', (synced: boolean) => {
      setIsSynced(synced);
      console.log(`[CRDT] Sync status: ${synced ? 'synced' : 'syncing'}`);
      
      // When synced, check if Y.Text needs initialization from database
      if (synced && ytext.length === 0 && currentDocument.content && currentDocument.content.length > 0) {
        ytext.insert(0, currentDocument.content);
        console.log(`[CRDT] Initialized Y.Text with ${currentDocument.content.length} chars from database`);
      } else if (synced && ytext.length > 0) {
        console.log(`[CRDT] Y.Text already populated: ${ytext.length} chars (from other users or previous session)`);
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
          console.log(`[CRDT Delta] Insert: "${String(delta.insert).substring(0, 20)}..."`);
        }
        if (delta.delete) {
          console.log(`[CRDT Delta] Delete: ${delta.delete} chars`);
        }
        if (delta.retain) {
          console.log(`[CRDT Delta] Retain: ${delta.retain} chars`);
        }
      });
      
      // Get current content
      const content = ytext.toString();
      
      // Update store with current content
      updateDocumentContent(content);
      
      // Debounced AI analysis - trigger after 1.5 seconds of no typing
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        console.log('[CRDT] Triggering AI analysis after debounce');
        sendEdit(content);
      }, 1500);
    });
    
    console.log(`[CRDT] Initialized Y.js for document ${currentDocument.id}`);
    
    // Cleanup on unmount or document change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      ytextRef.current = null;
      binding?.destroy();
      provider?.destroy();
      ydoc?.destroy();
      console.log('[CRDT] Cleaned up Y.js');
    };
  }, [currentDocument?.id, editorReady, setStoreConnected, updateDocumentContent, sendEdit]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    console.log('[CRDT] Monaco editor mounted');

    // Configure editor theme
    monaco.editor.defineTheme('codesync-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: '60a5fa' },
        { token: 'function', foreground: '38bdf8' },
        { token: 'variable', foreground: 'e2e8f0' },
      ],
      colors: {
        'editor.background': '#16161e',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#3b82f615',
        'editor.selectionBackground': '#3b82f640',
        'editorCursor.foreground': '#3b82f6',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#9ca3af',
        'editor.inactiveSelectionBackground': '#3b82f620',
        'editorIndentGuide.background': '#374151',
        'editorIndentGuide.activeBackground': '#4b5563',
        'editorWidget.background': '#1e1e2e',
        'editorWidget.border': '#374151',
        'editorSuggestWidget.background': '#1e1e2e',
        'editorSuggestWidget.border': '#374151',
        'editorSuggestWidget.selectedBackground': '#3b82f630',
        'editorHoverWidget.background': '#1e1e2e',
        'editorHoverWidget.border': '#374151',
      },
    });

    monaco.editor.setTheme('codesync-dark');

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
      {/* CRDT Status Bar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-md px-3 py-1.5 text-xs">
        {/* Connection Status */}
        <div className={cn(
          "flex items-center gap-1",
          isConnected ? "text-green-500" : "text-red-500"
        )}>
          {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        
        <div className="w-px h-4 bg-border" />
        
        {/* Sync Status */}
        <div className={cn(
          "flex items-center gap-1",
          isSynced ? "text-green-500" : "text-yellow-500"
        )}>
          <span>{isSynced ? '✓ Synced' : '⟳ Syncing'}</span>
        </div>
        
        <div className="w-px h-4 bg-border" />
        
        {/* Connected Users */}
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''}</span>
          {connectedUsers.some(u => u.isAI) && (
            <span title="AI Agent Connected">
              <Bot className="h-3 w-3 text-green-400 ml-1" />
            </span>
          )}
        </div>
        
        <div className="w-px h-4 bg-border" />
        
        {/* Delta Count */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <span>Δ {deltaCount}</span>
        </div>
      </div>
      
      {/* User Avatars */}
      {connectedUsers.length > 1 && (
        <div className="absolute top-2 left-2 z-10 flex -space-x-2">
          {connectedUsers.slice(0, 5).map((user, index) => (
            <div
              key={user.id}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 border-background",
                user.isAI && "ring-2 ring-green-400"
              )}
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.isAI ? '🤖' : user.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {connectedUsers.length > 5 && (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
              +{connectedUsers.length - 5}
            </div>
          )}
        </div>
      )}
      
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
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          minimap: { enabled: true, scale: 1 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          wordWrap: 'on',
          lineHeight: 1.6,
          padding: { top: 16, bottom: 16 },
          glyphMargin: true,
          folding: true,
          foldingHighlight: true,
          showFoldingControls: 'mouseover',
          matchBrackets: 'always',
          occurrencesHighlight: 'singleFile',
          renderLineHighlight: 'all',
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
};

export default CollaborativeEditor;
