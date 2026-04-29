import React from 'react';
import { X, FileCode, FileJson, FileType } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { cn } from '@/lib/utils';

const getTabIcon = (language: string) => {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'python':
      return <FileCode className="h-3.5 w-3.5 text-primary/70" />;
    case 'json':
      return <FileJson className="h-3.5 w-3.5 text-warning/70" />;
    default:
      return <FileType className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

const TabBar: React.FC = () => {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center h-9 bg-[#0b0b16] border-b border-border overflow-x-auto scrollbar-thin">
      {openTabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'group relative flex items-center gap-1.5 h-full px-3 text-xs border-r border-border/50 transition-colors min-w-[100px] max-w-[180px]',
              isActive
                ? 'bg-editor text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
            )}
            {getTabIcon(tab.language)}
            <span className="truncate flex-1 text-left">{tab.title}</span>
            {tab.isDirty && (
              <div className="w-2 h-2 rounded-full bg-primary/60 flex-shrink-0" />
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                'flex-shrink-0 rounded p-0.5 hover:bg-muted transition-colors',
                isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'
              )}
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default TabBar;
