import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileCode,
  FileJson,
  FileType,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Search,
  RefreshCw,
  Trash2,
  FolderPlus,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { useEditorStore } from '../../stores/editorStore';
import { cn } from '../../lib/utils';
import { toast } from '../../hooks/use-toast';
import type { FolderTreeNode, WorkspaceTree } from '../../lib/api';
import {
  listWorkspaces,
  ensureDefaultWorkspace,
  getWorkspaceTree,
  createFolder as pbCreateFolder,
} from '../../lib/workspace';

const getFileIcon = (language?: string) => {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'python':
      return <FileCode className="h-3.5 w-3.5 text-primary/70" />;
    case 'json':
      return <FileJson className="h-3.5 w-3.5 text-warning/70" />;
    case 'css':
      return <FileType className="h-3.5 w-3.5 text-ai/70" />;
    default:
      return <FileType className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

// Folder tree node component
const FolderNode: React.FC<{
  folder: FolderTreeNode;
  depth: number;
  currentDocId?: string;
  onSelectFile: (doc: any) => void;
  onDeleteFile: (id: string) => Promise<void> | void;
}> = ({ folder, depth, currentDocId, onSelectFile, onDeleteFile }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasContent = folder.children.length > 0 || folder.documents.length > 0;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasContent ? (
          isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <span className="w-3" />
        )}
        {isOpen ? (
          <FolderOpen className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="truncate font-medium">{folder.name}</span>
      </button>

      {isOpen && (
        <div>
          {folder.children.map((child) => (
            <FolderNode
              key={`folder-${child.id}`}
              folder={child}
              depth={depth + 1}
              currentDocId={currentDocId}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
            />
          ))}
          {folder.documents.map((doc) => (
            <FileItem
              key={`doc-${doc.id}`}
              doc={doc}
              depth={depth + 1}
              isSelected={String(doc.id) === currentDocId}
              onSelect={onSelectFile}
              onDelete={onDeleteFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// File item component
const FileItem: React.FC<{
  doc: any;
  depth: number;
  isSelected: boolean;
  onSelect: (doc: any) => void;
  onDelete: (id: string) => Promise<void> | void;
}> = ({ doc, depth, isSelected, onSelect, onDelete }) => {
  return (
    <motion.button
      whileHover={{ backgroundColor: 'hsl(var(--sidebar-accent))' }}
      onClick={() => onSelect(doc)}
      className={cn(
        'group flex w-full items-center gap-1.5 rounded-md py-1 text-xs transition-colors',
        isSelected && 'bg-primary/10 text-primary',
        !isSelected && 'text-sidebar-foreground'
      )}
      style={{ paddingLeft: `${20 + depth * 12}px`, paddingRight: '8px' }}
    >
      {getFileIcon(doc.language)}
      <span className="flex-1 truncate text-left">{doc.title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 flex-shrink-0"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(String(doc.id));
            }}
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.button>
  );
};

const FileExplorer: React.FC = () => {
  const {
    currentDocument, documents, setCurrentDocument, loadDocuments,
    createDocument, currentWorkspace, setCurrentWorkspace, openTab,
    deleteDocument,
  } = useEditorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceTree | null>(null);

  // Load workspace tree or flat documents
  const loadTree = useCallback(async () => {
    setIsLoading(true);
    try {
      if (currentWorkspace) {
        console.log('[FileExplorer] loadTree for workspace', currentWorkspace.id);
        const tree = await getWorkspaceTree(currentWorkspace.id);
        console.log('[FileExplorer] tree:', tree.folders.length, 'folders,', tree.root_documents.length, 'root docs');
        setWorkspaceTree(tree);
      }
      await loadDocuments();
    } catch (err: any) {
      console.error('[FileExplorer] loadTree failed:', err?.status, err?.message, err?.data);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, loadDocuments]);

  // Initialize: ensure a workspace exists for this user, then load documents.
  useEffect(() => {
    const init = async () => {
      console.log('[FileExplorer] init starting');
      setIsLoading(true);
      try {
        const list = await listWorkspaces();
        console.log('[FileExplorer] listWorkspaces returned', list.length, 'items');
        let workspaces = list;
        if (workspaces.length === 0) {
          console.log('[FileExplorer] no workspaces — creating default');
          const w = await ensureDefaultWorkspace('My Workspace');
          workspaces = [w];
        }
        console.log('[FileExplorer] setting currentWorkspace =', workspaces[0]);
        setCurrentWorkspace({ id: workspaces[0].id, name: workspaces[0].name });
      } catch (err: any) {
        console.error('[FileExplorer] Workspace init failed:', err?.status, err?.message, err?.data);
        toast({
          title: 'Could not load workspace',
          description: err?.data?.message || err?.message || 'Unknown error',
          variant: 'destructive',
        });
      }
      await loadDocuments();
      setIsLoading(false);
      console.log('[FileExplorer] init complete');
    };
    init();
  }, [loadDocuments, setCurrentWorkspace]);

  // Reload tree when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      loadTree();
    }
  }, [currentWorkspace, loadTree]);

  const handleFileSelect = (doc: any) => {
    const fullDoc = documents.find(d => String(d.id) === String(doc.id)) || {
      id: String(doc.id),
      title: doc.title,
      content: doc.content || '',
      language: doc.language || 'text',
      createdAt: doc.created_at || new Date().toISOString(),
      updatedAt: doc.updated_at || new Date().toISOString(),
    };
    setCurrentDocument(fullDoc);
    openTab(fullDoc);
  };

  const handleRefresh = () => loadTree();

  const handleCreateFile = async () => {
    if (!newItemName.trim()) return;
    try {
      setIsLoading(true);
      await createDocument(newItemName, '// Start coding here...\n');
      await loadTree();
      setShowNewFileDialog(false);
      setNewItemName('');
      toast({ title: 'Created', description: `Created "${newItemName}"` });
    } catch (err: any) {
      const detail =
        err?.data?.message || err?.originalError?.data?.message || err?.message || 'Failed to create file';
      console.error('Create failed:', err);
      toast({ title: 'Error', description: detail, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newItemName.trim() || !currentWorkspace) return;
    try {
      setIsLoading(true);
      await pbCreateFolder(currentWorkspace.id, newItemName);
      await loadTree();
      setShowNewFolderDialog(false);
      setNewItemName('');
      toast({ title: 'Created', description: `Created folder "${newItemName}"` });
    } catch {
      toast({ title: 'Error', description: 'Failed to create folder', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      await deleteDocument(id);
      await loadTree();
      toast({ title: 'Deleted', description: 'Document deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  // Filter documents for search
  const filteredDocs = documents.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {currentWorkspace ? currentWorkspace.name : 'Explorer'}
        </h2>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
          </Button>
          {currentWorkspace && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setNewItemName(''); setShowNewFolderDialog(true); }}>
              <FolderPlus className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setNewItemName(''); setShowNewFileDialog(true); }}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 bg-background/50 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto px-1 py-1 scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : searchQuery ? (
          // Search results (flat list)
          filteredDocs.length > 0 ? (
            filteredDocs.map((doc) => (
              <FileItem
                key={String(doc.id)}
                doc={doc}
                depth={0}
                isSelected={currentDocument?.id?.toString() === doc.id.toString()}
                onSelect={handleFileSelect}
                onDelete={handleDeleteFile}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No matches</p>
          )
        ) : workspaceTree ? (
          // Workspace tree view
          <>
            {workspaceTree.folders.map((folder) => (
              <FolderNode
                key={`folder-${folder.id}`}
                folder={folder}
                depth={0}
                currentDocId={currentDocument?.id?.toString()}
                onSelectFile={handleFileSelect}
                onDeleteFile={handleDeleteFile}
              />
            ))}
            {workspaceTree.root_documents.map((doc) => (
              <FileItem
                key={`doc-${doc.id}`}
                doc={doc}
                depth={0}
                isSelected={String(doc.id) === currentDocument?.id?.toString()}
                onSelect={handleFileSelect}
                onDelete={handleDeleteFile}
              />
            ))}
          </>
        ) : (
          // Flat document list (no workspace)
          documents.length > 0 ? (
            documents.map((doc) => (
              <FileItem
                key={String(doc.id)}
                doc={doc}
                depth={0}
                isSelected={currentDocument?.id?.toString() === doc.id.toString()}
                onSelect={handleFileSelect}
                onDelete={handleDeleteFile}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <FileCode className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">No documents yet</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => setShowNewFileDialog(true)}>
                <Plus className="h-3 w-3 mr-1" /> Create File
              </Button>
            </div>
          )
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New File</DialogTitle></DialogHeader>
          <div className="py-4">
            <Input
              placeholder="filename.py"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
          <div className="py-4">
            <Input
              placeholder="folder name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileExplorer;
