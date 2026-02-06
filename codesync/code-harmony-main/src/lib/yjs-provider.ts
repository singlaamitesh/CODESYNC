/**
 * Y.js CRDT Provider for CodeSync AI
 * 
 * This module implements Conflict-free Replicated Data Types (CRDTs)
 * for real-time collaborative editing without conflicts.
 * 
 * Key Concepts:
 * - Y.Doc: The CRDT document that automatically merges changes
 * - Y.Text: A CRDT text type that handles character-by-character edits
 * - WebSocket Provider: Syncs Y.Doc across all connected clients
 * - Awareness: Tracks cursor positions and user presence
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Types for CRDT operations
export interface CRDTDelta {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: number;
}

export interface UserAwareness {
  id: string;
  name: string;
  color: string;
  cursor: {
    line: number;
    column: number;
  } | null;
  isAI: boolean;
}

export interface YjsDocumentState {
  content: string;
  version: number;
  users: UserAwareness[];
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

/**
 * YjsProvider - Manages CRDT document synchronization
 * 
 * This is the core class that enables:
 * 1. Conflict-free merging of concurrent edits
 * 2. Delta-based updates (only changes are sent)
 * 3. User awareness (cursors, presence)
 * 4. AI agent integration as a "ghost user"
 */
export class YjsProvider {
  private ydoc: Y.Doc;
  private ytext: Y.Text;
  private wsProvider: WebsocketProvider | null = null;
  private documentId: string;
  private userId: string;
  private userName: string;
  private isAI: boolean;
  private onContentChange: ((content: string, delta: CRDTDelta[]) => void) | null = null;
  private onAwarenessChange: ((users: UserAwareness[]) => void) | null = null;
  private onSyncStatusChange: ((synced: boolean) => void) | null = null;

  constructor(
    documentId: string,
    userId: string,
    userName: string,
    isAI: boolean = false
  ) {
    this.documentId = documentId;
    this.userId = userId;
    this.userName = userName;
    this.isAI = isAI;

    // Create Y.Doc - the CRDT document
    this.ydoc = new Y.Doc();
    
    // Create Y.Text - CRDT text type for the code editor
    this.ytext = this.ydoc.getText('code');
    
    console.log(`[CRDT] Created Y.Doc for document ${documentId}, user ${userName}`);
  }

  /**
   * Connect to the Y.js WebSocket server
   * This enables real-time sync across all clients
   */
  connect(wsUrl: string = 'ws://127.0.0.1:8000'): void {
    const roomName = `codesync-${this.documentId}`;
    
    // Create WebSocket provider for Y.js
    this.wsProvider = new WebsocketProvider(
      wsUrl,
      roomName,
      this.ydoc,
      { connect: true }
    );

    // Set up awareness (user presence & cursors)
    this.wsProvider.awareness.setLocalStateField('user', {
      id: this.userId,
      name: this.userName,
      color: this.isAI ? '#00FF00' : generateUserColor(),
      cursor: null,
      isAI: this.isAI
    });

    // Listen for sync status changes
    this.wsProvider.on('sync', (synced: boolean) => {
      console.log(`[CRDT] Sync status: ${synced ? 'synced' : 'syncing'}`);
      this.onSyncStatusChange?.(synced);
    });

    // Listen for connection status
    this.wsProvider.on('status', (event: { status: string }) => {
      console.log(`[CRDT] Connection status: ${event.status}`);
    });

    // Listen for awareness changes (other users' cursors)
    this.wsProvider.awareness.on('change', () => {
      const users = this.getConnectedUsers();
      this.onAwarenessChange?.(users);
    });

    // Listen for text changes (CRDT updates)
    this.ytext.observe((event: Y.YTextEvent) => {
      const deltas = this.convertYEventToDeltas(event);
      const content = this.ytext.toString();
      this.onContentChange?.(content, deltas);
    });

    console.log(`[CRDT] Connected to room: ${roomName}`);
  }

  /**
   * Convert Y.js event to our delta format
   * This shows what operations were performed
   */
  private convertYEventToDeltas(event: Y.YTextEvent): CRDTDelta[] {
    const deltas: CRDTDelta[] = [];
    let position = 0;

    for (const delta of event.changes.delta) {
      if (delta.retain !== undefined) {
        position += delta.retain;
        deltas.push({
          type: 'retain',
          position,
          length: delta.retain,
          userId: this.userId,
          timestamp: Date.now()
        });
      }
      if (delta.insert !== undefined) {
        const content = typeof delta.insert === 'string' ? delta.insert : '';
        deltas.push({
          type: 'insert',
          position,
          content,
          userId: this.userId,
          timestamp: Date.now()
        });
        position += content.length;
      }
      if (delta.delete !== undefined) {
        deltas.push({
          type: 'delete',
          position,
          length: delta.delete,
          userId: this.userId,
          timestamp: Date.now()
        });
      }
    }

    return deltas;
  }

  /**
   * Insert text at a specific position
   * This is the delta-based update - only the change is sent
   */
  insert(position: number, content: string): void {
    this.ydoc.transact(() => {
      this.ytext.insert(position, content);
    }, this.userId);
    
    console.log(`[CRDT] Insert "${content.substring(0, 20)}..." at position ${position}`);
  }

  /**
   * Delete text at a specific position
   */
  delete(position: number, length: number): void {
    this.ydoc.transact(() => {
      this.ytext.delete(position, length);
    }, this.userId);
    
    console.log(`[CRDT] Delete ${length} chars at position ${position}`);
  }

  /**
   * Replace text at a specific position (delete + insert)
   * Used by AI agent to apply fixes
   */
  replace(position: number, deleteLength: number, insertContent: string): void {
    this.ydoc.transact(() => {
      this.ytext.delete(position, deleteLength);
      this.ytext.insert(position, insertContent);
    }, this.userId);
    
    console.log(`[CRDT] Replace ${deleteLength} chars with "${insertContent.substring(0, 20)}..." at position ${position}`);
  }

  /**
   * Set the entire document content
   * Used for initial load
   */
  setContent(content: string): void {
    this.ydoc.transact(() => {
      this.ytext.delete(0, this.ytext.length);
      this.ytext.insert(0, content);
    }, this.userId);
  }

  /**
   * Get current document content
   */
  getContent(): string {
    return this.ytext.toString();
  }

  /**
   * Update cursor position in awareness
   */
  updateCursor(line: number, column: number): void {
    this.wsProvider?.awareness.setLocalStateField('user', {
      id: this.userId,
      name: this.userName,
      color: this.isAI ? '#00FF00' : generateUserColor(),
      cursor: { line, column },
      isAI: this.isAI
    });
  }

  /**
   * Get all connected users
   */
  getConnectedUsers(): UserAwareness[] {
    if (!this.wsProvider) return [];
    
    const users: UserAwareness[] = [];
    this.wsProvider.awareness.getStates().forEach((state) => {
      if (state.user) {
        users.push(state.user as UserAwareness);
      }
    });
    
    return users;
  }

  /**
   * Get the Y.Text instance for Monaco binding
   */
  getYText(): Y.Text {
    return this.ytext;
  }

  /**
   * Get the Y.Doc instance
   */
  getYDoc(): Y.Doc {
    return this.ydoc;
  }

  /**
   * Get the awareness instance
   */
  getAwareness() {
    return this.wsProvider?.awareness;
  }

  /**
   * Register callback for content changes
   */
  onContent(callback: (content: string, deltas: CRDTDelta[]) => void): void {
    this.onContentChange = callback;
  }

  /**
   * Register callback for awareness changes
   */
  onAwareness(callback: (users: UserAwareness[]) => void): void {
    this.onAwarenessChange = callback;
  }

  /**
   * Register callback for sync status changes
   */
  onSync(callback: (synced: boolean) => void): void {
    this.onSyncStatusChange = callback;
  }

  /**
   * Get document state snapshot
   * Useful for debugging and persistence
   */
  getState(): YjsDocumentState {
    return {
      content: this.getContent(),
      version: this.ydoc.clientID,
      users: this.getConnectedUsers()
    };
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.wsProvider?.destroy();
    this.ydoc.destroy();
    console.log(`[CRDT] Disconnected from document ${this.documentId}`);
  }
}

/**
 * AI Ghost Agent Provider
 * 
 * This extends YjsProvider to act as an AI "user" that can
 * insert code suggestions directly into the document stream.
 */
export class AIGhostAgent extends YjsProvider {
  constructor(documentId: string) {
    super(
      documentId,
      `ai-agent-${Date.now()}`,
      '🤖 AI Assistant',
      true  // isAI = true
    );
  }

  /**
   * Apply a fix at a specific line
   * The AI agent directly modifies the document via CRDT
   */
  applyFixAtLine(lineNumber: number, originalLine: string, fixedLine: string): void {
    const content = this.getContent();
    const lines = content.split('\n');
    
    if (lineNumber <= 0 || lineNumber > lines.length) {
      console.error(`[AI Agent] Invalid line number: ${lineNumber}`);
      return;
    }

    // Calculate position of the line start
    let position = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
      position += lines[i].length + 1; // +1 for newline
    }

    // Replace the line using CRDT operations
    const currentLine = lines[lineNumber - 1];
    this.replace(position, currentLine.length, fixedLine);
    
    console.log(`[AI Agent] Applied fix at line ${lineNumber}: "${fixedLine.substring(0, 30)}..."`);
  }

  /**
   * Insert a new line of code
   */
  insertLine(afterLineNumber: number, newCode: string): void {
    const content = this.getContent();
    const lines = content.split('\n');
    
    // Calculate position after the specified line
    let position = 0;
    for (let i = 0; i <= afterLineNumber - 1 && i < lines.length; i++) {
      position += lines[i].length + 1;
    }

    // Insert new line with newline character
    this.insert(position, newCode + '\n');
    
    console.log(`[AI Agent] Inserted line after ${afterLineNumber}: "${newCode.substring(0, 30)}..."`);
  }

  /**
   * Apply multiple fixes in a batch
   * Handles the case where line numbers shift after each fix
   */
  applyMultipleFixes(fixes: Array<{ line: number; original: string; fixed: string }>): void {
    // Sort fixes by line number in descending order
    // This way, earlier fixes don't affect line numbers of later fixes
    const sortedFixes = [...fixes].sort((a, b) => b.line - a.line);
    
    for (const fix of sortedFixes) {
      this.applyFixAtLine(fix.line, fix.original, fix.fixed);
    }
    
    console.log(`[AI Agent] Applied ${fixes.length} fixes`);
  }
}

export default YjsProvider;
