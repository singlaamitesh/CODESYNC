import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Command, FileCode, Sparkles, Settings, Users, History } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useEditorStore } from '@/stores/editorStore';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange }) => {
  const { documents, setCurrentDocument, setActivePanel, toggleSidebar, setIsSettingsOpen } = useEditorStore();

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Files">
          {documents.map((doc) => (
            <CommandItem
              key={doc.id}
              onSelect={() => runCommand(() => setCurrentDocument(doc))}
            >
              <FileCode className="mr-2 h-4 w-4" />
              {doc.title}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Panels">
          <CommandItem onSelect={() => runCommand(() => { setActivePanel('explorer'); toggleSidebar(); })}>
            <FileCode className="mr-2 h-4 w-4" />
            Open File Explorer
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => { setActivePanel('ai'); toggleSidebar(); })}>
            <Sparkles className="mr-2 h-4 w-4" />
            Open AI Suggestions
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => { setActivePanel('collaborators'); toggleSidebar(); })}>
            <Users className="mr-2 h-4 w-4" />
            Open Collaborators
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => setIsSettingsOpen(true))}>
            <Settings className="mr-2 h-4 w-4" />
            Open Settings
          </CommandItem>
          <CommandItem>
            <History className="mr-2 h-4 w-4" />
            View Version History
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
