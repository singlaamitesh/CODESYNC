import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import TopBar from '@/components/layout/TopBar';
import TabBar from '@/components/layout/TabBar';
import StatusBar from '@/components/layout/StatusBar';
import Sidebar from '@/components/sidebar/Sidebar';
import CollaborativeEditor from '@/components/editor/CollaborativeEditor';
import SettingsModal from '@/components/modals/SettingsModal';
import CommandPalette from '@/components/CommandPalette';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AIChatPanel } from '@/components/ai-chat/AIChatPanel';
import { useEditorStore } from '@/stores/editorStore';

const EditorLayout: React.FC = () => {
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { isSidebarOpen, currentDocument, openTabs } = useEditorStore();

  const handleCursorChange = useCallback((line: number, column: number) => {
    setCursorPosition({ line, column });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+Shift+P — Command palette
      if (mod && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Cmd+S — Save current document
      if (mod && e.key === 's') {
        e.preventDefault();
        const state = useEditorStore.getState();
        if (state.currentDocument) {
          state.saveDocument(state.currentDocument);
        }
      }
      // Cmd+W — Close tab
      if (mod && e.key === 'w') {
        e.preventDefault();
        const state = useEditorStore.getState();
        if (state.activeTabId) {
          state.closeTab(state.activeTabId);
        }
      }
      // Cmd+B — Toggle sidebar
      if (mod && e.key === 'b') {
        e.preventDefault();
        useEditorStore.getState().toggleSidebar();
      }
      // Cmd+I — Toggle AI panel
      if (mod && e.key === 'i') {
        e.preventDefault();
        const state = useEditorStore.getState();
        if (state.activePanel === 'ai' && state.isSidebarOpen) {
          state.toggleSidebar();
        } else {
          state.setActivePanel('ai');
          if (!state.isSidebarOpen) state.toggleSidebar();
        }
      }
      // Cmd+N — New file (opens command palette)
      if (mod && e.key === 'n') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Cmd+L — Toggle AI chat panel
      if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setChatOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <TopBar />

      {/* Tab bar */}
      {openTabs.length > 0 && <TabBar />}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ErrorBoundary fallbackMessage="Sidebar encountered an error.">
          <Sidebar />
        </ErrorBoundary>

        {/* Editor area */}
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary fallbackMessage="Editor encountered an error.">
            <motion.div
              className="h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <CollaborativeEditor onCursorChange={handleCursorChange} />
            </motion.div>
          </ErrorBoundary>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar cursorPosition={cursorPosition} />

      {/* Modals */}
      <SettingsModal />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default EditorLayout;
