/**
 * A single document row in the file explorer tree: language icon, title, and a
 * hover-revealed "..." menu with a Delete action. Pure presentation — selection
 * and deletion are delegated to the parent via callbacks.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { getFileIcon } from './fileExplorerHelpers';

export const FileItem: React.FC<{
  doc: any;
  depth: number;
  isSelected: boolean;
  onSelect: (doc: any) => void;
  onDelete: (id: string) => Promise<void> | void;
}> = ({ doc, depth, isSelected, onSelect, onDelete }) => {
  return (
    <motion.button
      whileHover={{ backgroundColor: 'hsl(var(--sidebar-accent))' }}
      onClick={() => onSelect(doc)}
      className={cn(
        'group flex w-full items-center gap-1.5 rounded-md py-1 text-xs transition-colors',
        isSelected && 'bg-primary/10 text-primary',
        !isSelected && 'text-sidebar-foreground'
      )}
      style={{ paddingLeft: `${20 + depth * 12}px`, paddingRight: '8px' }}
    >
      {getFileIcon(doc.language)}
      <span className="flex-1 truncate text-left">{doc.title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 flex-shrink-0"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(String(doc.id));
            }}
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.button>
  );
};
