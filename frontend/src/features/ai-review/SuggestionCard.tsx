/**
 * A single expandable AI-suggestion card: shows title/type/description, and on
 * click reveals the suggested fix plus Apply/Ignore actions. Pure presentation;
 * the parent panel owns the apply/ignore logic and passes it via props.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Zap, X, TrendingUp } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { AISuggestion } from '@/shared/stores/editorStore';
import { getSuggestionIcon, getSuggestionBadgeVariant } from './suggestionMeta';

interface Props {
  suggestion: AISuggestion;
  index: number;
  onApplyFix: (suggestion: AISuggestion) => void;
  onIgnore: (suggestion: AISuggestion) => void;
}

export const SuggestionCard: React.FC<Props> = ({ suggestion, index, onApplyFix, onIgnore }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleApplyFix = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApplyFix(suggestion);
  };

  const handleIgnore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIgnore(suggestion);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'group cursor-pointer rounded-lg border border-border bg-card/50 p-3 transition-all hover:border-primary/50 hover:bg-card',
        suggestion.type === 'error' && 'border-destructive/30 hover:border-destructive/50',
        suggestion.type === 'security' && 'border-destructive/30 hover:border-destructive/50',
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getSuggestionIcon(suggestion.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium truncate">{suggestion.title}</h4>
            <Badge variant={getSuggestionBadgeVariant(suggestion.type)} className="text-[10px] px-1.5 py-0">
              {suggestion.type.replace('-', ' ')}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{suggestion.description}</p>

          {suggestion.line && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded">Line {suggestion.line}</span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {Math.round(suggestion.confidence * 100)}% confidence
              </span>
            </div>
          )}

          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pt-3 border-t border-border"
            >
              {/* Suggested fix code (when the AI provided one) */}
              {suggestion.fix && (
                <div className="mb-3 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                  <div className="text-muted-foreground mb-1">Suggested fix:</div>
                  <pre className="text-green-500 whitespace-pre-wrap">{suggestion.fix}</pre>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleApplyFix} disabled={!suggestion.fix}>
                  <Zap className="mr-1 h-3 w-3" />
                  {suggestion.fix ? 'Apply Fix' : 'No Fix'}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleIgnore}>
                  <X className="mr-1 h-3 w-3" />
                  Ignore
                </Button>
              </div>
            </motion.div>
          )}
        </div>
        <ChevronRight
          className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')}
        />
      </div>
    </motion.div>
  );
};
