import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import TopBar from '@/components/layout/TopBar';
import StatusBar from '@/components/layout/StatusBar';
import Sidebar from '@/components/sidebar/Sidebar';
import CodeEditor from '@/components/editor/CodeEditor';
import CollaborativeEditor from '@/components/editor/CollaborativeEditor';
import SettingsModal from '@/components/modals/SettingsModal';
import CommandPalette from '@/components/CommandPalette';
import { useEditorStore } from '@/stores/editorStore';

// Feature flag for CRDT mode
const USE_CRDT = true; // Set to true to enable Y.js collaborative editing

const EditorLayout: React.FC = () => {
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { isSidebarOpen } = useEditorStore();

  const handleCursorChange = useCallback((line: number, column: number) => {
    setCursorPosition({ line, column });
  }, []);

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <TopBar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Editor area with resize support */}
        <div className="flex-1 overflow-hidden">
          <motion.div
            className="h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Use CollaborativeEditor (Y.js CRDT) or regular CodeEditor */}
            {USE_CRDT ? (
              <CollaborativeEditor onCursorChange={handleCursorChange} />
            ) : (
              <CodeEditor onCursorChange={handleCursorChange} />
            )}
          </motion.div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar cursorPosition={cursorPosition} />

      {/* Modals */}
      <SettingsModal />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  );
};

export default EditorLayout;
