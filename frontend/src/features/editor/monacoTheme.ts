/**
 * "Midnight Pro" Monaco editor theme + editor options builder.
 *
 * Kept out of the component so the visual config is easy to find and tweak
 * without scrolling through the CRDT wiring.
 */
import type { editor } from 'monaco-editor';

export const CODESYNC_THEME_NAME = 'codesync-dark';

export const codesyncDarkTheme: editor.IStandaloneThemeData = {
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
    { token: 'tag', foreground: 'f472b6' },
    { token: 'attribute.name', foreground: '818cf8' },
    { token: 'attribute.value', foreground: '86efac' },
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
    'editorBracketMatch.background': '#6366f120',
    'editorBracketMatch.border': '#6366f150',
  },
};

/** Editor options derived from the user's settings store. */
export interface EditorSettings {
  fontSize: number;
  lineNumbers: boolean;
  minimap: boolean;
  tabSize: number;
  wordWrap: boolean;
}

export const buildEditorOptions = (
  settings: EditorSettings,
): editor.IStandaloneEditorConstructionOptions => ({
  fontSize: settings.fontSize,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontLigatures: true,
  lineNumbers: settings.lineNumbers ? 'on' : 'off',
  minimap: { enabled: settings.minimap, scale: 1 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  autoIndent: 'full',
  formatOnPaste: true,
  formatOnType: true,
  tabSize: settings.tabSize,
  wordWrap: settings.wordWrap ? 'on' : 'off',
  lineHeight: 1.7,
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
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
});
