import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useAIChat } from '@/shared/hooks/useAIChat';
import { ThreadList } from './ThreadList';
import { MessageList } from './MessageList';
import { Composer } from './Composer';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const AIChatPanel: React.FC<Props> = ({ open, onClose }) => {
  const currentWorkspace = useEditorStore((s) => s.currentWorkspace);
  const currentDocument = useEditorStore((s) => s.currentDocument);
  const wsId = currentWorkspace?.id || null;
  const chat = useAIChat(wsId);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 460 }}
          animate={{ x: 0 }}
          exit={{ x: 460 }}
          transition={{ type: 'tween', duration: 0.18 }}
          className="fixed top-0 right-0 z-40 h-full w-[460px] border-l border-border bg-background shadow-xl flex"
        >
          <ThreadList
            sessions={chat.sessions}
            activeId={chat.activeSessionId}
            onSelect={chat.selectSession}
            onNew={chat.newSession}
            onDelete={chat.removeSession}
          />
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Chat
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <MessageList messages={chat.messages} />
            {chat.error && (
              <div className="px-3 py-1 text-[11px] text-destructive">{chat.error}</div>
            )}
            <Composer
              disabled={!chat.activeSessionId}
              streaming={chat.streaming}
              onSend={(text) => {
                chat.send(text, currentDocument ? {
                  id: String(currentDocument.id),
                  name: currentDocument.title,
                  content: currentDocument.content,
                } : undefined);
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
