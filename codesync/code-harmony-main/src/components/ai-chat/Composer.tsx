import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  disabled: boolean;
  streaming: boolean;
  onSend: (text: string) => void;
}

export const Composer: React.FC<Props> = ({ disabled, streaming, onSend }) => {
  const [value, setValue] = useState('');
  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue('');
  };
  return (
    <div className="border-t border-border p-2 flex gap-2 items-end">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={disabled ? 'Open a workspace to chat' : 'Ask about your code… (Cmd+Enter)'}
        rows={2}
        disabled={disabled}
        className="text-xs resize-none"
      />
      <Button size="icon" onClick={submit} disabled={disabled || !value.trim()}>
        {streaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
      </Button>
    </div>
  );
};
