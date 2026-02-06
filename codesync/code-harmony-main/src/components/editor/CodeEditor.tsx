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

    // Configure editor theme
    monaco.editor.defineTheme('codesync-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: '60a5fa' },
        { token: 'function', foreground: '38bdf8' },
        { token: 'variable', foreground: 'e2e8f0' },
      ],
      colors: {
        'editor.background': '#16161e',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#3b82f615',
        'editor.selectionBackground': '#3b82f640',
        'editorCursor.foreground': '#3b82f6',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#9ca3af',
        'editor.inactiveSelectionBackground': '#3b82f620',
        'editorIndentGuide.background': '#374151',
        'editorIndentGuide.activeBackground': '#4b5563',
        'editorWidget.background': '#1e1e2e',
        'editorWidget.border': '#374151',
        'editorSuggestWidget.background': '#1e1e2e',
        'editorSuggestWidget.border': '#374151',
        'editorSuggestWidget.selectedBackground': '#3b82f630',
        'editorHoverWidget.background': '#1e1e2e',
        'editorHoverWidget.border': '#374151',
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
