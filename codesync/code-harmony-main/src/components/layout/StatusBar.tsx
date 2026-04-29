import React from 'react';
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
  const selectedLanguage = currentDocument?.language || 'text';

  const errorCount = aiSuggestions.filter((s) => s.type === 'error').length;
  const warningCount = aiSuggestions.filter((s) => s.type !== 'error').length;

  return (
    <footer className="flex h-6 items-center justify-between bg-primary px-3 text-xs text-primary-foreground">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 text-white/90"
            >
              <Wifi className="h-3 w-3" />
              <span>Live</span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1 text-white/60">
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </div>
          )}
        </div>

        {/* Git branch */}
        <div className="flex items-center gap-1 text-white/70 hover:text-white cursor-pointer">
          <GitBranch className="h-3 w-3" />
          <span>main</span>
        </div>

        {/* Errors and warnings */}
        <div className="flex items-center gap-2">
          {errorCount > 0 ? (
            <button className="flex items-center gap-1 text-white/90 hover:text-white">
              <AlertCircle className="h-3 w-3" />
              <span>{errorCount}</span>
            </button>
          ) : (
            <button className="flex items-center gap-1 text-white/70 hover:text-white">
              <CheckCircle className="h-3 w-3" />
              <span>0</span>
            </button>
          )}
          <button className="flex items-center gap-1 text-white/70 hover:text-white">
            <AlertTriangle className="h-3 w-3" />
            <span>{warningCount}</span>
          </button>
        </div>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4 text-white/60">
        <span>Lines: {codeStats.lines}</span>
        <span>Functions: {codeStats.functions}</span>
        <span>Complexity: {codeStats.complexity}</span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Cursor position */}
        <button className="text-white/70 hover:text-white">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </button>

        {/* Encoding */}
        <button className="text-white/70 hover:text-white">UTF-8</button>

        {/* Spaces */}
        <button className="text-white/70 hover:text-white">Spaces: 2</button>

        {/* Language selector */}
        <div className="flex items-center gap-1">
          <Code2 className="h-3 w-3 text-white/70" />
          <Select value={selectedLanguage} onValueChange={() => {}}>
            <SelectTrigger className="h-5 w-auto border-0 bg-transparent p-0 text-xs text-white/70 hover:text-white focus:ring-0">
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
