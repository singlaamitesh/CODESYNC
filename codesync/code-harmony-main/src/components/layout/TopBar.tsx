import React from 'react';
import { motion } from 'framer-motion';
import {
  Menu,
  Save,
  Settings,
  Cloud,
  CloudOff,
  Loader2,
  Sparkles,
  FileCode,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/editorStore';
import { formatDistanceToNow } from 'date-fns';

const TopBar: React.FC = () => {
  const {
    currentDocument,
    isConnected,
    isSaving,
    lastSaved,
    toggleSidebar,
    setIsSettingsOpen,
    isAIAnalyzing,
    saveDocument,
  } = useEditorStore();

  const formatLastSaved = () => {
    if (!lastSaved) return 'Not saved';
    return `Saved ${formatDistanceToNow(new Date(lastSaved), { addSuffix: true })}`;
  };

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-3">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">CodeSync</span>
          </div>
        </div>

        {currentDocument && (
          <div className="flex items-center gap-2 border-l border-border pl-3">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors">
                  {currentDocument.title}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem>Rename</DropdownMenuItem>
                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Center section - Status */}
      <div className="flex items-center gap-4">
        {isAIAnalyzing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2 rounded-full bg-ai/10 px-3 py-1"
          >
            <div className="relative">
              <Sparkles className="h-3.5 w-3.5 text-ai animate-pulse-subtle" />
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-ai/30" />
            </div>
            <span className="text-xs font-medium text-ai">AI analyzing...</span>
          </motion.div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isSaving ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Save className="h-3 w-3" />
              <span>{formatLastSaved()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div className="flex items-center gap-1.5 px-2">
          {isConnected ? (
            <Cloud className="h-4 w-4 text-success" />
          ) : (
            <CloudOff className="h-4 w-4 text-destructive" />
          )}
          <span className={`text-xs ${isConnected ? 'text-success' : 'text-destructive'}`}>
            {isConnected ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* Save Button */}
        {currentDocument && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveDocument(currentDocument)}
            disabled={isSaving}
            className="h-8 gap-1.5 border-border text-sm"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSettingsOpen(true)}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};

export default TopBar;
