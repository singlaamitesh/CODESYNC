/**
 * Visual metadata for AI suggestions: maps a suggestion type to its icon and
 * its badge variant. Kept separate so the card component stays presentational.
 */
import React from 'react';
import { AlertCircle, Lightbulb, RefreshCw, FileText, Shield } from 'lucide-react';
import type { AISuggestion } from '@/shared/stores/editorStore';

/** Icon shown next to a suggestion, chosen by its type. */
export const getSuggestionIcon = (type: AISuggestion['type']) => {
  switch (type) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'best-practice':
      return <Lightbulb className="h-4 w-4 text-warning" />;
    case 'refactoring':
      return <RefreshCw className="h-4 w-4 text-info" />;
    case 'documentation':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'security':
      return <Shield className="h-4 w-4 text-destructive" />;
    default:
      return <Lightbulb className="h-4 w-4" />;
  }
};

/** Badge color variant for a suggestion type. */
export const getSuggestionBadgeVariant = (type: AISuggestion['type']) => {
  switch (type) {
    case 'error':
    case 'security':
      return 'destructive' as const;
    case 'best-practice':
      return 'secondary' as const;
    case 'refactoring':
      return 'default' as const;
    case 'documentation':
      return 'outline' as const;
    default:
      return 'secondary' as const;
  }
};
