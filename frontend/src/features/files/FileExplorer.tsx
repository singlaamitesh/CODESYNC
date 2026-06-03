/**
 * Workspace file explorer sidebar: loads/initializes the user's workspace,
 * renders either the folder tree, flat search results, or an empty-state, and
 * hosts the new-file / new-folder dialogs. Owns all state, data loading, and
 * CRUD handlers; the recursive tree rows live in FolderNode / FileItem.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode,
  Plus,
  Search,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog';
import { useEditorStore } from '@/shared/stores/editorStore';
import { cn } from '@/shared/lib/utils';
import { toast } from '@/shared/hooks/use-toast';
import type { WorkspaceTree } from '@/shared/lib/api';
import {
  listWorkspaces,
  ensureDefaultWorkspace,
  getWorkspaceTree,
  createFolder as pbCreateFolder,
} from '@/shared/lib/pb';
import { FileItem } from './FileItem';
import { FolderNode } from './FolderNode';

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
