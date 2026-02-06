import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Code2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEditorStore } from '@/stores/editorStore';

interface StatusBarProps {
  cursorPosition: { line: number; column: number };
}

const StatusBar: React.FC<StatusBarProps> = ({ cursorPosition }) => {
  const { currentDocument, isConnected, codeStats, aiSuggestions } = useEditorStore();
  const [selectedLanguage, setSelectedLanguage] = useState(currentDocument?.language || 'typescript');

  const errorCount = aiSuggestions.filter((s) => s.type === 'error').length;
  const warningCount = aiSuggestions.filter((s) => s.type !== 'error').length;

  return (
    <footer className="flex h-6 items-center justify-between border-t border-border bg-card px-3 text-xs">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 text-success"
            >
              <Wifi className="h-3 w-3" />
              <span>Live</span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1 text-destructive">
              <WifiOff className="h-3 w-3" />
              <span>Disconnected</span>
            </div>
          )}
        </div>

        {/* Git branch */}
        <div className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer">
          <GitBranch className="h-3 w-3" />
          <span>main</span>
        </div>

        {/* Errors and warnings */}
        <div className="flex items-center gap-2">
          {errorCount > 0 ? (
            <button className="flex items-center gap-1 text-destructive hover:text-destructive/80">
              <AlertCircle className="h-3 w-3" />
              <span>{errorCount}</span>
            </button>
          ) : (
            <button className="flex items-center gap-1 text-success hover:text-success/80">
              <CheckCircle className="h-3 w-3" />
              <span>0</span>
            </button>
          )}
          <button className="flex items-center gap-1 text-warning hover:text-warning/80">
            <AlertTriangle className="h-3 w-3" />
            <span>{warningCount}</span>
          </button>
        </div>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>Lines: {codeStats.lines}</span>
        <span>Functions: {codeStats.functions}</span>
        <span>Complexity: {codeStats.complexity}</span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Cursor position */}
        <button className="text-muted-foreground hover:text-foreground">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </button>

        {/* Encoding */}
        <button className="text-muted-foreground hover:text-foreground">UTF-8</button>

        {/* Spaces */}
        <button className="text-muted-foreground hover:text-foreground">Spaces: 2</button>

        {/* Language selector */}
        <div className="flex items-center gap-1">
          <Code2 className="h-3 w-3 text-muted-foreground" />
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="h-5 w-auto border-0 bg-transparent p-0 text-xs hover:text-foreground focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="typescript">TypeScript</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </footer>
  );
};

export default StatusBar;
