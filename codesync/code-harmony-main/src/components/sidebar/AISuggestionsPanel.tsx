import React, { useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  AlertCircle,
  Lightbulb,
  RefreshCw,
  FileText,
  Shield,
  ChevronRight,
  Zap,
  TrendingUp,
  Check,
  X,
  Play,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useEditorStore, AISuggestion } from '@/stores/editorStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const getSuggestionIcon = (type: AISuggestion['type']) => {
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

const getSuggestionBadgeVariant = (type: AISuggestion['type']) => {
  switch (type) {
    case 'error':
    case 'security':
      return 'destructive';
    case 'best-practice':
      return 'secondary';
    case 'refactoring':
      return 'default';
    case 'documentation':
      return 'outline';
    default:
      return 'secondary';
  }
};

const SuggestionCard: React.FC<{ 
  suggestion: AISuggestion; 
  index: number;
  onApplyFix: (suggestion: AISuggestion) => void;
  onIgnore: (suggestion: AISuggestion) => void;
}> = ({
  suggestion,
  index,
  onApplyFix,
  onIgnore,
}) => {
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
        suggestion.type === 'security' && 'border-destructive/30 hover:border-destructive/50'
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
              {/* Show suggested fix code if available */}
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
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </div>
    </motion.div>
  );
};

const AISuggestionsPanel: React.FC = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    optimized_code: string;
    changes: any[];
    summary: string;
  } | null>(null);
  
  const { 
    aiSuggestions, 
    isAIAnalyzing, 
    codeStats, 
    currentDocument, 
    requestAIAnalysis,
    setAISuggestions,
    updateDocumentContent,
    optimizeCode,
    applyFixToEditor
  } = useEditorStore();

  // WebSocket for real-time AI updates
  const { 
    aiStatus, 
    requestAiAnalysis: wsRequestAnalysis, 
    requestOptimization: wsRequestOptimization,
    optimizationResult: wsOptimizationResult 
  } = useWebSocket(currentDocument?.id?.toString() || null);

  // Update optimization result from WebSocket
  useEffect(() => {
    if (wsOptimizationResult) {
      setOptimizationResult(wsOptimizationResult);
      setIsOptimizing(false);
      toast({
        title: "Optimization Complete!",
        description: wsOptimizationResult.summary || "AI has optimized your code.",
      });
    }
  }, [wsOptimizationResult]);

  const errorCount = aiSuggestions.filter((s) => s.type === 'error' || s.type === 'security').length;
  const improvementCount = aiSuggestions.filter((s) => s.type !== 'error' && s.type !== 'security').length;

  // Calculate a code health score
  const healthScore = Math.max(0, 100 - errorCount * 15 - improvementCount * 5);

  // Handle Apply Fix - applies the suggested code fix via Y.js CRDT
  const handleApplyFix = useCallback((suggestion: AISuggestion) => {
    if (!currentDocument) {
      toast({
        title: "No document selected",
        description: "Please select a document first to apply fixes.",
        variant: "destructive"
      });
      return;
    }
    
    // Get the applyFixToEditor function from the store (set by CollaborativeEditor)
    const applyFixToEditor = useEditorStore.getState().applyFixToEditor;

    // If we have a fix from the AI and the Y.js editor function is available
    if (suggestion.fix && suggestion.line) {
      if (applyFixToEditor) {
        // Use Y.js CRDT to apply the fix (for collaborative editing)
        applyFixToEditor(suggestion.line, suggestion.fix);
        
        // Remove the suggestion from the list
        setAISuggestions(aiSuggestions.filter(s => s.id !== suggestion.id));

        toast({
          title: "Fix Applied!",
          description: `Line ${suggestion.line}: ${suggestion.description}`,
        });
        return;
      } else {
        // Fallback: Update via store (for non-CRDT mode)
        const lines = currentDocument.content.split('\n');
        if (suggestion.line <= lines.length) {
          const lineIndex = suggestion.line - 1;
          const originalLine = lines[lineIndex];
          const indent = originalLine.match(/^\s*/)?.[0] || '';
          lines[lineIndex] = indent + suggestion.fix.trim();
          
          updateDocumentContent(lines.join('\n'));
          setAISuggestions(aiSuggestions.filter(s => s.id !== suggestion.id));

          toast({
            title: "Fix Applied!",
            description: `Line ${suggestion.line}: ${suggestion.description}`,
          });
          return;
        }
      }
    }

    // Fallback: If no fix provided, show message
    toast({
      title: "No automatic fix available",
      description: suggestion.description,
      variant: "destructive"
    });
  }, [currentDocument, aiSuggestions, setAISuggestions, updateDocumentContent]);

  // Handle Ignore - removes suggestion from list
  const handleIgnore = useCallback((suggestion: AISuggestion) => {
    setAISuggestions(aiSuggestions.filter(s => s.id !== suggestion.id));
    
    toast({
      title: "Suggestion Ignored",
      description: `Ignored: ${suggestion.title}`,
    });
  }, [aiSuggestions, setAISuggestions]);

  // Handle Re-analyze
  const handleReanalyze = useCallback(async () => {
    if (!currentDocument) {
      toast({
        title: "No document selected",
        description: "Please select a document first to analyze.",
        variant: "destructive"
      });
      return;
    }

    try {
      await requestAIAnalysis(Number(currentDocument.id));
      toast({
        title: "Analysis Complete",
        description: "AI has analyzed your code and found suggestions.",
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze code. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentDocument, requestAIAnalysis]);

  // Handle Optimize Code
  const handleOptimize = useCallback(async () => {
    if (!currentDocument) {
      toast({
        title: "No document selected",
        description: "Please select a document first to optimize.",
        variant: "destructive"
      });
      return;
    }

    setIsOptimizing(true);
    setOptimizationResult(null);

    try {
      const result = await optimizeCode(Number(currentDocument.id));
      
      if (result) {
        setOptimizationResult(result);
        toast({
          title: "Optimization Complete!",
          description: result.summary || "AI has optimized your code.",
        });
      } else {
        toast({
          title: "Optimization Failed",
          description: "Could not optimize code. Make sure Gemini API is configured.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Optimization Failed",
        description: "Failed to optimize code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsOptimizing(false);
    }
  }, [currentDocument, optimizeCode]);

  // Apply optimized code - Replace ALL content via Y.Text
  const applyOptimizedCode = useCallback(() => {
    if (!optimizationResult || !currentDocument) return;
    
    const optimizedCode = optimizationResult.optimized_code;
    
    // Get the replaceEditorContent function from window (set by CollaborativeEditor)
    const replaceEditorContent = (window as any).__replaceEditorContent;
    
    if (replaceEditorContent) {
      // Use Y.js CRDT to replace all content (for collaborative editing)
      replaceEditorContent(optimizedCode);
      console.log('[AI] Applied optimized code via Y.Text CRDT');
    } else {
      // Fallback: Update via store (less ideal as it doesn't use CRDT)
      updateDocumentContent(optimizedCode);
      console.log('[AI] Applied optimized code via store (fallback)');
    }
    
    setOptimizationResult(null);
    toast({
      title: "Optimized Code Applied!",
      description: "Your code has been updated with the optimized version.",
    });
  }, [optimizationResult, currentDocument, updateDocumentContent]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ai" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI Suggestions
          </h2>
        </div>
        {(isAIAnalyzing || aiStatus.isAnalyzing || aiStatus.isOptimizing) && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-ai animate-pulse" />
            <span className="text-[10px] text-ai">
              {aiStatus.message || (aiStatus.isOptimizing ? 'Optimizing...' : 'Analyzing...')}
            </span>
          </div>
        )}
      </div>

      {/* Code Health Score */}
      <div className="border-b border-border p-3">
        <div className="rounded-lg bg-gradient-to-br from-card to-background p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Code Health</span>
            <span className={cn(
              'text-lg font-bold',
              healthScore >= 80 ? 'text-success' : healthScore >= 50 ? 'text-warning' : 'text-destructive'
            )}>
              {healthScore}%
            </span>
          </div>
          <Progress 
            value={healthScore} 
            className="h-2"
          />
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{codeStats.lines} lines</span>
            <span>{codeStats.functions} functions</span>
            <span>Complexity: {codeStats.complexity}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-xs">{errorCount} issues</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-warning" />
          <span className="text-xs">{improvementCount} improvements</span>
        </div>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
        {/* Optimization Result */}
        {optimizationResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border-2 border-primary bg-primary/5 p-3 mb-2"
          >
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-primary">Optimized Code Ready!</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{optimizationResult.summary}</p>
            {optimizationResult.changes && optimizationResult.changes.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Changes:</p>
                <ul className="text-[10px] text-muted-foreground space-y-0.5">
                  {optimizationResult.changes.slice(0, 3).map((change, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <Check className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
                      <span>{change.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={applyOptimizedCode}>
                <Check className="mr-1 h-3 w-3" />
                Apply Changes
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOptimizationResult(null)}>
                <X className="mr-1 h-3 w-3" />
                Dismiss
              </Button>
            </div>
          </motion.div>
        )}

        {aiSuggestions.length === 0 && !optimizationResult ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="rounded-full bg-success/10 p-3 mb-3">
              <Sparkles className="h-6 w-6 text-success" />
            </div>
            <h3 className="text-sm font-medium mb-1">All clear!</h3>
            <p className="text-xs text-muted-foreground">
              No suggestions at the moment. Click "Analyze Code" to get AI insights!
            </p>
          </div>
        ) : (
          aiSuggestions.map((suggestion, index) => (
            <SuggestionCard 
              key={suggestion.id} 
              suggestion={suggestion} 
              index={index}
              onApplyFix={handleApplyFix}
              onIgnore={handleIgnore}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs"
          onClick={handleReanalyze}
          disabled={isAIAnalyzing || isOptimizing || !currentDocument}
        >
          {isAIAnalyzing ? (
            <>
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-3 w-3" />
              {aiSuggestions.length > 0 ? 'Re-analyze Code' : 'Analyze Code'}
            </>
          )}
        </Button>
        
        <Button 
          variant="default" 
          size="sm" 
          className="w-full text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          onClick={handleOptimize}
          disabled={isOptimizing || isAIAnalyzing || !currentDocument}
        >
          {isOptimizing ? (
            <>
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
              Optimizing with Gemini...
            </>
          ) : (
            <>
              <Wand2 className="mr-1.5 h-3 w-3" />
              ✨ Optimize Code
            </>
          )}
        </Button>
        
        {!currentDocument && (
          <p className="text-[10px] text-muted-foreground text-center">
            Select a document first
          </p>
        )}
      </div>
    </div>
  );
};

export default AISuggestionsPanel;
