import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useEditorStore } from '@/stores/editorStore';
import { cn } from '@/lib/utils';
import { pb } from '@/lib/pb';

type PbChatRecord = {
  id: string;
  workspace: string;
  user: string;
  content: string;
  created: string;
  expand?: {
    user?: { id: string; name: string; avatar?: string };
  };
};

interface ChatMsg {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  created: string;
}

function toChatMsg(r: PbChatRecord): ChatMsg {
  return {
    id: r.id,
    userId: r.user,
    userName: r.expand?.user?.name || 'User',
    userAvatar: r.expand?.user?.avatar || null,
    content: r.content,
    created: r.created,
  };
}

const ChatPanel: React.FC = () => {
  const { user } = useAuthStore();
  const { currentWorkspace } = useEditorStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Load history + subscribe to realtime events for this workspace.
  const setup = useCallback(async () => {
    if (!currentWorkspace) return undefined;

    let cancelled = false;
    const filter = pb.filter('workspace = {:ws}', { ws: currentWorkspace.id });

    try {
      const page = await pb.collection('chat_messages').getList<PbChatRecord>(1, 50, {
        filter,
        sort: '-created',
        expand: 'user',
      });
      if (cancelled) return;
      setMessages(page.items.map(toChatMsg).reverse());
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }

    setIsConnected(true);
    const unsubPromise = pb
      .collection('chat_messages')
      .subscribe<PbChatRecord>('*', (e) => {
        if (e.record.workspace !== currentWorkspace.id) return;
        if (e.action === 'create') {
          setMessages((prev) => [...prev, toChatMsg(e.record)]);
        } else if (e.action === 'delete') {
          setMessages((prev) => prev.filter((m) => m.id !== e.record.id));
        }
      }, { expand: 'user' });

    return async () => {
      cancelled = true;
      setIsConnected(false);
      try {
        const unsub = await unsubPromise;
        unsub();
      } catch {
        /* already torn down */
      }
    };
  }, [currentWorkspace]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    setup().then((fn) => { cleanup = fn; }).catch(() => {});
    return () => {
      cleanup?.();
    };
  }, [setup]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !currentWorkspace || !user) return;
    try {
      await pb.collection('chat_messages').create({
        workspace: currentWorkspace.id,
        user: user.id,
        content,
      });
      setInput('');
    } catch (err) {
      console.error('Failed to send:', err);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <MessageCircle className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">Open a workspace to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Chat
          </h2>
        </div>
        <div className={cn(
          'flex items-center gap-1 text-[10px]',
          isConnected ? 'text-success' : 'text-muted-foreground'
        )}>
          <div className={cn('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-success' : 'bg-muted-foreground')} />
          {isConnected ? 'Live' : 'Connecting'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-5 w-5 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No messages yet. Say hi!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.userId === user?.id;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2"
            >
              {msg.userAvatar ? (
                <img src={msg.userAvatar} alt="" className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-semibold text-primary flex-shrink-0 mt-0.5">
                  {msg.userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={cn('text-xs font-medium', isMe ? 'text-primary' : 'text-foreground')}>
                    {isMe ? 'You' : msg.userName}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.created)}</span>
                </div>
                <p className="text-xs text-sidebar-foreground leading-relaxed break-words">{msg.content}</p>
              </div>
            </motion.div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-2">
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Message..."
            className="h-8 text-xs bg-background/50"
            disabled={!isConnected}
          />
          <Button
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={sendMessage}
            disabled={!input.trim() || !isConnected}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
