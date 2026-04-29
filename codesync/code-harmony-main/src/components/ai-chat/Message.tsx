import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, User } from 'lucide-react';
import { ChatMessage } from '@/lib/aiChat';
import { CodeBlock } from './CodeBlock';
import { cn } from '@/lib/utils';

interface Props { msg: ChatMessage; }

export const Message: React.FC<Props> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-2 px-3 py-2', isUser ? 'bg-background' : 'bg-muted/20')}>
      <div className="mt-0.5 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center bg-primary/10">
        {isUser ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3 text-primary" />}
      </div>
      <div className="flex-1 min-w-0 text-sm leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code(props) {
              const { children, className, ...rest } = props as any;
              const isInline = !(className && /language-/.test(className));
              if (isInline) {
                return <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono" {...rest}>{children}</code>;
              }
              const lang = (className || '').replace('language-', '');
              return <CodeBlock language={lang} code={String(children).replace(/\n$/, '')} />;
            },
          }}
        >
          {msg.content || (isUser ? '' : '…')}
        </ReactMarkdown>
        {!isUser && msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {msg.citations.map((c, i) => (
              <span key={i} className="text-[10px] rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                [{i + 1}] {c.document_id.slice(0, 6)}…
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
