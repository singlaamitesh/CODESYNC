import { useCallback, useEffect, useState } from 'react';
import {
  ChatMessage,
  ChatSession,
  createSession,
  deleteSession,
  listMessages,
  listSessions,
  streamChat,
} from '@/shared/lib/api';

interface UseAIChat {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  selectSession: (id: string) => Promise<void>;
  newSession: () => Promise<void>;
  send: (content: string, fileCtx?: { id: string; name: string; content: string }) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

export function useAIChat(workspaceId: string | null): UseAIChat {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    if (!workspaceId) return;
    const list = await listSessions(workspaceId);
    setSessions(list);
    if (!activeSessionId && list[0]) setActiveSessionId(list[0].id);
  }, [workspaceId, activeSessionId]);

  useEffect(() => {
    if (workspaceId) refreshSessions().catch(() => {});
  }, [workspaceId, refreshSessions]);

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    listMessages(activeSessionId).then(setMessages).catch(() => {});
  }, [activeSessionId]);

  const selectSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
  }, []);

  const newSession = useCallback(async () => {
    if (!workspaceId) return;
    const s = await createSession(workspaceId);
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setMessages([]);
  }, [workspaceId]);

  const removeSession = useCallback(async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  }, [activeSessionId]);

  const send = useCallback(async (
    content: string,
    fileCtx?: { id: string; name: string; content: string },
  ) => {
    if (!activeSessionId || !content.trim() || streaming) return;
    setStreaming(true);
    setError(null);

    const userMsg: ChatMessage = {
      id: `tmp-u-${Date.now()}`,
      session: activeSessionId,
      role: 'user',
      content,
      created: new Date().toISOString(),
    };
    const placeholder: ChatMessage = {
      id: `tmp-a-${Date.now()}`,
      session: activeSessionId,
      role: 'assistant',
      content: '',
      created: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, placeholder]);

    try {
      let buf = '';
      for await (const ev of streamChat({
        session_id: activeSessionId,
        content,
        current_file_id: fileCtx?.id,
        current_file_name: fileCtx?.name,
        current_file_content: fileCtx?.content,
      })) {
        if (ev.type === 'token') {
          buf += typeof ev.data === 'string' ? ev.data : '';
          setMessages((prev) => {
            const out = [...prev];
            out[out.length - 1] = { ...out[out.length - 1], content: buf };
            return out;
          });
        } else if (ev.type === 'error') {
          setError(typeof ev.data === 'string' ? ev.data : ev.data?.message || 'Stream error');
        }
      }
      // Hydrate from server to replace tmp ids with persisted ones.
      const fresh = await listMessages(activeSessionId);
      setMessages(fresh);
    } catch (e: any) {
      setError(e?.message || 'Stream failed');
    } finally {
      setStreaming(false);
    }
  }, [activeSessionId, streaming]);

  return { sessions, activeSessionId, messages, streaming, error, selectSession, newSession, send, removeSession, refreshSessions };
}
