import React, { useEffect, useRef } from 'react';
import { Message } from './Message';
import { ChatMessage } from '@/shared/lib/api';

interface Props { messages: ChatMessage[]; }

export const MessageList: React.FC<Props> = ({ messages }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6 text-xs text-muted-foreground">
        Ask anything about your code. I'll search your indexed files for context.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {messages.map((m) => <Message key={m.id} msg={m} />)}
      <div ref={endRef} />
    </div>
  );
};
