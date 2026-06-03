/**
 * A collapsible folder row in the file explorer tree. Renders its own
 * expand/collapse state, then recursively renders child folders and the
 * documents it contains (via FileItem). Selection/deletion bubble up through
 * callbacks supplied by the explorer.
 */
import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
} from 'lucide-react';
import type { FolderTreeNode } from '@/shared/lib/api';
import { FileItem } from './FileItem';

export const FolderNode: React.FC<{
  folder: FolderTreeNode;
  depth: number;
  currentDocId?: string;
  onSelectFile: (doc: any) => void;
  onDeleteFile: (id: string) => Promise<void> | void;
}> = ({ folder, depth, currentDocId, onSelectFile, onDeleteFile }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasContent = folder.children.length > 0 || folder.documents.length > 0;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasContent ? (
          isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <span className="w-3" />
        )}
        {isOpen ? (
          <FolderOpen className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="truncate font-medium">{folder.name}</span>
      </button>

      {isOpen && (
        <div>
          {folder.children.map((child) => (
            <FolderNode
              key={`folder-${child.id}`}
              folder={child}
              depth={depth + 1}
              currentDocId={currentDocId}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
            />
          ))}
          {folder.documents.map((doc) => (
            <FileItem
              key={`doc-${doc.id}`}
              doc={doc}
              depth={depth + 1}
              isSelected={String(doc.id) === currentDocId}
              onSelect={onSelectFile}
              onDelete={onDeleteFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};
