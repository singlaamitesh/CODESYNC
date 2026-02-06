import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import type { AISuggestion, CodeStats } from '@/stores/editorStore';

interface WebSocketMessage {
  type: string;
  payload?: any;
  message?: string;
  suggestion?: any;
  suggestion_data?: any;
  data?: any;
  user_type?: string;
  content?: string;
  timestamp?: number;
  delta?: any;
  status?: string;
  document?: any;
}

interface AIStatus {
  isAnalyzing: boolean;
  isOptimizing: boolean;
  message: string;
}

export const useWebSocket = (documentId: string | null) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus>({
    isAnalyzing: false,
    isOptimizing: false,
    message: ''
  });
  
  const { 
    setIsConnected, 
    setAISuggestions,
    setIsAIAnalyzing,
    setCodeStats,
  } = useEditorStore();

  const connect = useCallback(() => {
    if (!documentId) return;

    const wsUrl = `ws://127.0.0.1:8000/ws/editor/${documentId}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected to document', documentId);
        setIsConnected(true);
        setIsReconnecting(false);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        setIsReconnecting(true);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  }, [documentId, setIsConnected]);

  const handleMessage = (message: WebSocketMessage) => {
    console.log('WebSocket message:', message.type, message);
    
    switch (message.type) {
      case 'connection':
        console.log('Connected:', message.message);
        break;
        
      case 'ai_status':
        // AI processing status updates
        setAiStatus({
          isAnalyzing: message.status === 'analyzing',
          isOptimizing: message.status === 'optimizing',
          message: message.message || ''
        });
        if (message.status === 'analyzing' || message.status === 'optimizing') {
          setIsAIAnalyzing(true);
        }
        break;
        
      case 'ai_suggestion':
        // AI suggestion received (from Celery or direct)
        const suggestionData = message.suggestion_data || message.suggestion || message.data;
        if (suggestionData) {
          // Convert API suggestions to AISuggestion format
          const suggestions: AISuggestion[] = (suggestionData.suggestions || []).map((s: any, index: number) => ({
            id: `ws-${Date.now()}-${index}`,
            type: (s.type || 'best-practice') as AISuggestion['type'],
            title: (s.type || 'suggestion').toUpperCase(),
            description: s.message || s.description || '',
            line: s.line,
            fix: s.fix || '',  // Include the fix code from AI
            confidence: s.severity === 'error' ? 0.9 : s.severity === 'warning' ? 0.7 : 0.5,
          }));
          
          // Update code stats if available
          if (suggestionData.analysis) {
            const stats: CodeStats = {
              lines: suggestionData.analysis.lines || 0,
              functions: suggestionData.analysis.functions || 0,
              classes: suggestionData.analysis.classes || 0,
              complexity: suggestionData.analysis.complexity_score || 0,
            };
            setCodeStats(stats);
          }
          
          setAISuggestions(suggestions);
          setIsAIAnalyzing(false);
          setAiStatus({ isAnalyzing: false, isOptimizing: false, message: '' });
          console.log('AI suggestions updated:', suggestions);
        }
        break;
        
      case 'ai_analysis_started':
        setIsAIAnalyzing(true);
        setAiStatus({ isAnalyzing: true, isOptimizing: false, message: 'Analyzing code...' });
        break;
        
      case 'optimization_started':
        setIsAIAnalyzing(true);
        setAiStatus({ isAnalyzing: false, isOptimizing: true, message: 'Optimizing code...' });
        break;
        
      case 'optimization_complete':
        // Code optimization completed
        const optimizationData = message.data;
        if (optimizationData?.optimization) {
          setOptimizationResult(optimizationData.optimization);
        }
        setIsAIAnalyzing(false);
        setAiStatus({ isAnalyzing: false, isOptimizing: false, message: '' });
        break;
        
      case 'ai_error':
      case 'optimization_error':
        console.error('AI Error:', message.message || message.data?.error);
        setIsAIAnalyzing(false);
        setAiStatus({ isAnalyzing: false, isOptimizing: false, message: '' });
        break;
        
      case 'embedding_complete':
        console.log('Embedding generated:', message.data);
        break;
        
      case 'edit':
      case 'document_edit':
        // Handle collaborative edits from other users
        if (message.user_type === 'human') {
          // Update editor content (collaborative editing)
          console.log('Collaborative edit received');
        }
        break;
        
      case 'cursor_update':
        // Other user's cursor position
        console.log('Cursor update:', message);
        break;
        
      case 'pong':
        // Health check response
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  // Send message via WebSocket
  const sendMessage = useCallback((type: string, data: any = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
      return true;
    }
    return false;
  }, []);

  // Send document edit (triggers debounced AI analysis)
  const sendEdit = useCallback((content: string, cursor?: { line: number; column: number }) => {
    return sendMessage('edit', { content, cursor });
  }, [sendMessage]);

  // Request AI analysis explicitly
  const requestAiAnalysis = useCallback((content: string, useCelery = true) => {
    setIsAIAnalyzing(true);
    setAiStatus({ isAnalyzing: true, isOptimizing: false, message: 'Analyzing...' });
    return sendMessage('request_ai_analysis', { content, use_celery: useCelery });
  }, [sendMessage, setIsAIAnalyzing]);

  // Request code optimization
  const requestOptimization = useCallback(() => {
    setIsAIAnalyzing(true);
    setAiStatus({ isAnalyzing: false, isOptimizing: true, message: 'Optimizing...' });
    return sendMessage('request_optimization', {});
  }, [sendMessage, setIsAIAnalyzing]);

  // Send cursor position for collaboration
  const sendCursorPosition = useCallback((line: number, column: number) => {
    return sendMessage('cursor_move', { cursor: { line, column } });
  }, [sendMessage]);

  // Ping for connection health
  const ping = useCallback(() => {
    return sendMessage('ping', {});
  }, [sendMessage]);

  useEffect(() => {
    connect();

    // Periodic ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        ping();
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, ping]);

  return {
    isReconnecting,
    aiStatus,
    optimizationResult,
    sendEdit,
    sendCursorPosition,
    requestAiAnalysis,
    requestOptimization,
    sendMessage,
    ping,
  };
};
