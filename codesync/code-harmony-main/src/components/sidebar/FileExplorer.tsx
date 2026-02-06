import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileCode,
  FileJson,
  FileType,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Search,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useEditorStore } from '@/stores/editorStore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { apiService } from '@/lib/api';

interface FileItem {
  id: string;
  name: string;
  type: 'file';
  language?: string;
}

const getFileIcon = (language?: string) => {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'python':
      return <FileCode className="h-4 w-4 text-info" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-warning" />;
    case 'css':
      return <FileType className="h-4 w-4 text-ai" />;
    default:
      return <FileType className="h-4 w-4 text-muted-foreground" />;
  }
};

const FileTreeItem: React.FC<{
  item: FileItem;
  currentDocId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ item, currentDocId, onSelect, onDelete }) => {
  const isSelected = item.id === currentDocId;

  return (
    <motion.button
      whileHover={{ backgroundColor: 'hsl(var(--accent))' }}
      onClick={() => onSelect(item.id)}
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
        isSelected && 'bg-primary/15 text-primary',
        !isSelected && 'text-sidebar-foreground'
      )}
    >
      {getFileIcon(item.language)}
      <span className="flex-1 truncate text-left">{item.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 hover:bg-accent rounded p-0.5"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem 
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.button>
  );
};

const FileExplorer: React.FC = () => {
  const { currentDocument, documents, setCurrentDocument, loadDocuments, createDocument } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Load documents from API on mount
  useEffect(() => {
    const fetchDocs = async () => {
      setIsLoading(true);
      await loadDocuments();
      setIsLoading(false);
    };
    fetchDocs();
  }, [loadDocuments]);

  const handleFileSelect = (id: string) => {
    const doc = documents.find((d) => d.id === id || d.id.toString() === id);
    if (doc) {
      setCurrentDocument(doc);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadDocuments();
    setIsLoading(false);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a file name",
        variant: "destructive"
      });
      return;
    }

    try {
      await createDocument(newFileName, '# New document\n\n// Start coding here...');
      await loadDocuments(); // Refresh the documents list
      setShowNewFileDialog(false);
      setNewFileName('');
      toast({
        title: "Success",
        description: `Created "${newFileName}"`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create document",
        variant: "destructive"
      });
    }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      await apiService.deleteDocument(Number(id));
      await loadDocuments();
      if (currentDocument?.id?.toString() === id) {
        setCurrentDocument(null);
      }
      toast({
        title: "Deleted",
        description: "Document deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive"
      });
    }
  };

  // Convert documents to file tree structure
  const documentsAsFiles: FileItem[] = documents.map(doc => ({
    id: doc.id.toString(),
    name: doc.title,
    type: 'file' as const,
    language: doc.language,
  }));

  // Filter by search query
  const filteredFiles = documentsAsFiles.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Documents
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewFileDialog(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 bg-background/50 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto px-1 py-1 scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredFiles.length > 0 ? (
          filteredFiles.map((item) => (
            <FileTreeItem
              key={item.id}
              item={item}
              currentDocId={currentDocument?.id?.toString()}
              onSelect={handleFileSelect}
              onDelete={handleDeleteFile}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <FileCode className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              {searchQuery ? 'No matching documents' : 'No documents yet'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 text-xs"
              onClick={() => setShowNewFileDialog(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Document
            </Button>
          </div>
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter document name..."
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFile}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileExplorer;
