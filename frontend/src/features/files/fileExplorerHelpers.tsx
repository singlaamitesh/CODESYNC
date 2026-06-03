/**
 * Pure helpers for the file explorer tree.
 *
 * Currently just the language → file-icon picker, kept out of the components
 * so the icon mapping is easy to find and extend without touching render code.
 */
import { FileCode, FileJson, FileType } from 'lucide-react';

/** Map a document's language to its sidebar file icon. */
export const getFileIcon = (language?: string) => {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'python':
      return <FileCode className="h-3.5 w-3.5 text-primary/70" />;
    case 'json':
      return <FileJson className="h-3.5 w-3.5 text-warning/70" />;
    case 'css':
      return <FileType className="h-3.5 w-3.5 text-ai/70" />;
    default:
      return <FileType className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};
