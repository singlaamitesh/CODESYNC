import React, { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { useEditorStore } from '@/stores/editorStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Loader2 } from 'lucide-react';

interface CodeEditorProps {
  onCursorChange?: (line: number, column: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ onCursorChange }) => {
  const editorRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  const {
    currentDocument,
    updateDocumentContent,
    setIsSaving,
    setLastSaved,
  } = useEditorStore();

  // WebSocket hook - handles real-time sync and AI analysis
  const { sendCursorPosition, sendEdit, aiStatus } = useWebSocket(currentDocument?.id?.toString() || null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Midnight Pro editor theme
    monaco.editor.defineTheme('codesync-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '475569', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: '67e8f9' },
        { token: 'function', foreground: '818cf8' },
        { token: 'variable', foreground: 'e2e8f0' },
        { token: 'delimiter', foreground: '94a3b8' },
        { token: 'operator', foreground: '94a3b8' },
      ],
      colors: {
        'editor.background': '#131325',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#6366f108',
        'editor.selectionBackground': '#6366f130',
        'editorCursor.foreground': '#6366f1',
        'editorLineNumber.foreground': '#2e2e4a',
        'editorLineNumber.activeForeground': '#6366f1',
        'editor.inactiveSelectionBackground': '#6366f115',
        'editorIndentGuide.background': '#1e1e3a',
        'editorIndentGuide.activeBackground': '#2e2e5a',
        'editorWidget.background': '#0f0f20',
        'editorWidget.border': '#1e1e3a',
        'editorSuggestWidget.background': '#0f0f20',
        'editorSuggestWidget.border': '#1e1e3a',
        'editorSuggestWidget.selectedBackground': '#6366f125',
        'editorHoverWidget.background': '#0f0f20',
        'editorHoverWidget.border': '#1e1e3a',
      },
    });

    monaco.editor.setTheme('codesync-dark');

    // Listen for cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      const position = e.position;
      onCursorChange?.(position.lineNumber, position.column);
      sendCursorPosition(position.lineNumber, position.column);
    });
  };

  const handleEditorChange: OnChange = useCallback(
    (value) => {
      if (value !== undefined) {
        // Update local state immediately
        updateDocumentContent(value);
        
        // Send edit via WebSocket - this triggers backend debounced AI analysis
        const position = editorRef.current?.getPosition();
        sendEdit(value, position ? { line: position.lineNumber, column: position.column } : undefined);

        // Debounced save to API (separate from AI analysis)
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
          if (currentDocument) {
            setIsSaving(true);
            try {
              // Save to API
              await useEditorStore.getState().saveDocument({
                ...currentDocument,
                content: value,
              });
              setLastSaved(new Date().toISOString());
            } catch (error) {
              console.error('Failed to save document:', error);
            } finally {
              setIsSaving(false);
            }
          }
        }, 2000);
      }
    },
    [updateDocumentContent, setIsSaving, setLastSaved, sendEdit, currentDocument]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!currentDocument) {
    return (
      <div className="flex h-full items-center justify-center bg-editor">
        <p className="text-muted-foreground">Select a document to start editing</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-editor">
      <Editor
        height="100%"
        language={currentDocument.language}
        value={currentDocument.content}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        loading={
          <div className="flex h-full items-center justify-center bg-editor">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          minimap: { enabled: true, scale: 1 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          wordWrap: 'on',
          lineHeight: 1.6,
          padding: { top: 16, bottom: 16 },
          glyphMargin: true,
          folding: true,
          foldingHighlight: true,
          showFoldingControls: 'mouseover',
          matchBrackets: 'always',
          occurrencesHighlight: 'singleFile',
          renderLineHighlight: 'all',
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
};

export default CodeEditor;
