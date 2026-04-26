import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatSession } from '@/lib/aiChat';
import { cn } from '@/lib/utils';

interface Props {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export const ThreadList: React.FC<Props> = ({ sessions, activeId, onSelect, onNew, onDelete }) => (
  <div className="flex h-full w-44 flex-col border-r border-border bg-muted/20">
    <div className="p-2">
      <Button variant="outline" size="sm" className="w-full text-xs" onClick={onNew}>
        <Plus className="h-3 w-3 mr-1" /> New chat
      </Button>
    </div>
    <div className="flex-1 overflow-y-auto scrollbar-thin px-1">
      {sessions.map((s) => (
        <div
          key={s.id}
          className={cn(
            'group flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs',
            activeId === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
          )}
          onClick={() => onSelect(s.id)}
        >
          <span className="flex-1 truncate">{s.title || 'Untitled'}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  </div>
);
