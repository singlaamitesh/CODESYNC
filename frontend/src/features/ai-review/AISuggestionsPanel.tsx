/**
 * AI Suggestions sidebar panel: shows the code-health score, the list of AI
 * suggestions, and the optimize/analyze actions. Owns the analyze/optimize/
 * apply-fix logic; the individual cards live in SuggestionCard /
 * OptimizationResultCard and the icon/badge mapping in suggestionMeta.
 */
import React, { useCallback, useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Play, Wand2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Progress } from '@/shared/ui/progress';
import { useEditorStore, AISuggestion } from '@/shared/stores/editorStore';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { cn } from '@/shared/lib/utils';
import { toast } from '@/shared/hooks/use-toast';
import { SuggestionCard } from './SuggestionCard';
import { OptimizationResultCard, type OptimizationResult } from './OptimizationResultCard';

const AISuggestionsPanel: React.FC = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  
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
      await requestAIAnalysis(
        String(currentDocument.id),
        currentDocument.content || '',
        currentDocument.title || '',
      );
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
      const result = await optimizeCode(
        String(currentDocument.id),
        currentDocument.content || '',
        currentDocument.title || '',
      );

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
    const replaceEditorContent = useEditorStore.getState().replaceEditorContent;

    if (replaceEditorContent) {
      replaceEditorContent(optimizedCode);
    } else {
      updateDocumentContent(optimizedCode);
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
          <OptimizationResultCard
            result={optimizationResult}
            onApply={applyOptimizedCode}
            onDismiss={() => setOptimizationResult(null)}
          />
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
              Optimizing...
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
