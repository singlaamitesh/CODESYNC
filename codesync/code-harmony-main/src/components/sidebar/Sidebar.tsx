import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Files,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEditorStore } from '@/stores/editorStore';
import FileExplorer from './FileExplorer';
import AISuggestionsPanel from './AISuggestionsPanel';
import { cn } from '@/lib/utils';

const sidebarVariants = {
  open: { width: 320, opacity: 1 },
  closed: { width: 0, opacity: 0 },
};

const iconButtonVariants = {
  active: { backgroundColor: 'hsl(var(--primary) / 0.15)' },
  inactive: { backgroundColor: 'transparent' },
};

const Sidebar: React.FC = () => {
  const { isSidebarOpen, activePanel, setActivePanel, toggleSidebar, aiSuggestions } = useEditorStore();

  const navItems = [
    { id: 'explorer' as const, icon: Files, label: 'Explorer', badge: 0 },
    { id: 'ai' as const, icon: Sparkles, label: 'AI Suggestions', badge: aiSuggestions.length },
  ];

  const renderPanel = () => {
    switch (activePanel) {
      case 'explorer':
        return <FileExplorer />;
      case 'ai':
        return <AISuggestionsPanel />;
      default:
        return <FileExplorer />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Icon bar */}
      <div className="flex w-12 flex-col items-center border-r border-border bg-sidebar py-2">
        {navItems.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <motion.button
                variants={iconButtonVariants}
                animate={activePanel === item.id && isSidebarOpen ? 'active' : 'inactive'}
                onClick={() => {
                  if (activePanel === item.id && isSidebarOpen) {
                    toggleSidebar();
                  } else {
                    setActivePanel(item.id);
                    if (!isSidebarOpen) toggleSidebar();
                  }
                }}
                className={cn(
                  'relative mb-1 flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  activePanel === item.id && isSidebarOpen
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {item.badge}
                  </span>
                )}
                {activePanel === item.id && isSidebarOpen && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 h-6 w-0.5 rounded-r-full bg-primary"
                  />
                )}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ))}

        <div className="mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-10 w-10 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    !isSidebarOpen && 'rotate-180'
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Panel content */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div
            variants={sidebarVariants}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="h-full overflow-hidden border-r border-border bg-sidebar"
          >
            <div className="h-full w-[320px]">{renderPanel()}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Sidebar;
