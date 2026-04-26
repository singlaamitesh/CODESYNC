import { pb } from './pb';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8003/api' : '/api');

export interface ChatSession {
  id: string;
  workspace: string;
  user: string;
  title: string;
  created: string;
  updated: string;
}

export interface ChatMessage {
  id: string;
  session: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: { document_id: string; chunk_idx: number; score: number }[];
  created: string;
}

export async function listSessions(workspaceId: string): Promise<ChatSession[]> {
  return pb.collection('ai_chat_sessions').getFullList<ChatSession>({
    filter: pb.filter('workspace = {:ws}', { ws: workspaceId }),
    sort: '-updated',
  });
}

export async function createSession(workspaceId: string, title = 'New chat'): Promise<ChatSession> {
  const uid = pb.authStore.record?.id;
  if (!uid) throw new Error('Not authenticated');
  return pb.collection('ai_chat_sessions').create<ChatSession>({
    workspace: workspaceId,
    user: uid,
    title,
  });
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  return pb.collection('ai_chat_messages').getFullList<ChatMessage>({
    filter: pb.filter('session = {:s}', { s: sessionId }),
    sort: 'created',
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await pb.collection('ai_chat_sessions').delete(sessionId);
}

export interface StreamEvent {
  type: 'citation' | 'token' | 'done' | 'error';
  data: any;
}

export async function* streamChat(payload: {
  session_id: string;
  content: string;
  current_file_id?: string;
  current_file_name?: string;
  current_file_content?: string;
}): AsyncGenerator<StreamEvent> {
  const resp = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`stream HTTP ${resp.status}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = 'token';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (!data) continue;
      let parsed: any = data;
      try { parsed = JSON.parse(data); } catch { /* keep string */ }
      yield { type: event as StreamEvent['type'], data: parsed };
    }
  }
}
