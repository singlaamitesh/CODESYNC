/**
 * Banner shown when the AI returns an optimized version of the current file.
 * Summarizes the changes and offers Apply / Dismiss. Presentation only.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Wand2, Check, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';

export interface OptimizationResult {
  optimized_code: string;
  changes: any[];
  summary: string;
}

interface Props {
  result: OptimizationResult;
  onApply: () => void;
  onDismiss: () => void;
}

export const OptimizationResultCard: React.FC<Props> = ({ result, onApply, onDismiss }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-lg border-2 border-primary bg-primary/5 p-3 mb-2"
  >
    <div className="flex items-center gap-2 mb-2">
      <Wand2 className="h-4 w-4 text-primary" />
      <h4 className="text-sm font-semibold text-primary">Optimized Code Ready!</h4>
    </div>
    <p className="text-xs text-muted-foreground mb-2">{result.summary}</p>
    {result.changes && result.changes.length > 0 && (
      <div className="mb-2">
        <p className="text-[10px] font-medium text-muted-foreground mb-1">Changes:</p>
        <ul className="text-[10px] text-muted-foreground space-y-0.5">
          {result.changes.slice(0, 3).map((change, i) => (
            <li key={i} className="flex items-start gap-1">
              <Check className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
              <span>{change.description}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
    <div className="flex gap-2">
      <Button size="sm" className="h-7 text-xs flex-1" onClick={onApply}>
        <Check className="mr-1 h-3 w-3" />
        Apply Changes
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDismiss}>
        <X className="mr-1 h-3 w-3" />
        Dismiss
      </Button>
    </div>
  </motion.div>
);
