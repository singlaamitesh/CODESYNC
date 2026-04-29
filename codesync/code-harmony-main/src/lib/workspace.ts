// Thin wrappers around PocketBase collections for workspaces, folders, and
// documents. Encapsulates the data shape the UI expects so callers don't
// need to know about PocketBase record fields.
import { pb } from './pb';
import type { Document, FolderTreeNode, WorkspaceResponse, WorkspaceTree } from './api';

type PbDocRecord = {
  id: string;
  title: string;
  content: string;
  language: string;
  workspace: string;
  folder: string | null;
  created: string;
  updated: string;
};

type PbFolderRecord = {
  id: string;
  workspace: string;
  parent: string | null;
  name: string;
  created: string;
};

type PbWorkspaceRecord = {
  id: string;
  name: string;
  owner: string;
  created: string;
};

function toDoc(r: PbDocRecord): Document {
  return {
    id: r.id,
    title: r.title,
    content: r.content ?? '',
    language: r.language || 'text',
    workspace: r.workspace,
    folder: r.folder ?? null,
    created: r.created,
    updated: r.updated,
  };
}

export async function listWorkspaces(): Promise<WorkspaceResponse[]> {
  const records = await pb.collection('workspaces').getFullList<PbWorkspaceRecord>({
    sort: 'created',
  });
  return records.map((r) => ({ id: r.id, name: r.name, created: r.created }));
}

export async function createWorkspace(name: string): Promise<WorkspaceResponse> {
  const uid = pb.authStore.record?.id;
  if (!uid) throw new Error('Not authenticated');
  console.log('[createWorkspace] uid:', uid, 'authStore valid:', pb.authStore.isValid);
  try {
    const r = await pb
      .collection('workspaces')
      .create<PbWorkspaceRecord>({ name, owner: uid }, { requestKey: `ws-create-${Date.now()}` });
    await pb
      .collection('workspace_members')
      .create(
        { workspace: r.id, user: uid, role: 'owner' },
        { requestKey: `wm-create-${Date.now()}` },
      );
    return { id: r.id, name: r.name, created: r.created };
  } catch (err: any) {
    console.error('[createWorkspace] FULL ERROR JSON:', JSON.stringify({
      status: err?.status,
      message: err?.message,
      data: err?.data,
      responseData: err?.response?.data,
      url: err?.url,
    }, null, 2));
    throw err;
  }
}

export async function deleteWorkspace(id: string): Promise<void> {
  await pb.collection('workspaces').delete(id);
}

export async function ensureDefaultWorkspace(name: string): Promise<WorkspaceResponse> {
  const existing = await listWorkspaces();
  if (existing.length > 0) return existing[0];
  return createWorkspace(name);
}

export async function listDocumentsForWorkspace(workspaceId: string): Promise<Document[]> {
  const records = await pb.collection('documents').getFullList<PbDocRecord>({
    filter: pb.filter('workspace = {:ws}', { ws: workspaceId }),
    sort: '-updated',
  });
  return records.map(toDoc);
}

export async function listAllDocuments(): Promise<Document[]> {
  const records = await pb.collection('documents').getFullList<PbDocRecord>({ sort: '-updated' });
  return records.map(toDoc);
}

export async function createDocument(
  workspaceId: string | null,
  title: string,
  content: string,
  language = 'text',
  folderId: string | null = null,
): Promise<Document> {
  let ws = workspaceId;
  if (!ws) {
    const w = await ensureDefaultWorkspace('My Workspace');
    ws = w.id;
  }
  const r = await pb.collection('documents').create<PbDocRecord>({
    title,
    content,
    language,
    workspace: ws,
    folder: folderId,
  });
  return toDoc(r);
}

export async function updateDocument(id: string, patch: Partial<Pick<Document, 'title' | 'content' | 'language' | 'folder'>>): Promise<Document> {
  const r = await pb.collection('documents').update<PbDocRecord>(id, patch as Record<string, unknown>);
  return toDoc(r);
}

export async function deleteDocument(id: string): Promise<void> {
  await pb.collection('documents').delete(id);
}

export async function moveDocument(id: string, folderId: string | null, workspaceId?: string): Promise<Document> {
  const patch: Record<string, unknown> = { folder: folderId };
  if (workspaceId) patch.workspace = workspaceId;
  const r = await pb.collection('documents').update<PbDocRecord>(id, patch);
  return toDoc(r);
}

export async function listFolders(workspaceId: string) {
  return pb.collection('folders').getFullList<PbFolderRecord>({
    filter: pb.filter('workspace = {:ws}', { ws: workspaceId }),
    sort: 'created',
  });
}

export async function createFolder(workspaceId: string, name: string, parentId: string | null = null) {
  return pb.collection('folders').create<PbFolderRecord>({
    workspace: workspaceId,
    parent: parentId,
    name,
  });
}

export async function updateFolder(id: string, patch: Partial<Pick<PbFolderRecord, 'name' | 'parent'>>) {
  return pb.collection('folders').update<PbFolderRecord>(id, patch);
}

export async function deleteFolder(id: string): Promise<void> {
  await pb.collection('folders').delete(id);
}

export async function getWorkspaceTree(workspaceId: string): Promise<WorkspaceTree> {
  const [ws, folders, documents] = await Promise.all([
    pb.collection('workspaces').getOne<PbWorkspaceRecord>(workspaceId),
    listFolders(workspaceId),
    listDocumentsForWorkspace(workspaceId),
  ]);

  const folderDocs = new Map<string, Document[]>();
  const rootDocs: Document[] = [];
  for (const d of documents) {
    if (d.folder) {
      const list = folderDocs.get(d.folder) || [];
      list.push(d);
      folderDocs.set(d.folder, list);
    } else {
      rootDocs.push(d);
    }
  }

  const buildNode = (folder: PbFolderRecord): FolderTreeNode => ({
    id: folder.id,
    name: folder.name,
    parent_folder_id: folder.parent,
    children: folders
      .filter((f) => f.parent === folder.id)
      .map(buildNode),
    documents: folderDocs.get(folder.id) || [],
  });

  return {
    id: ws.id,
    name: ws.name,
    folders: folders.filter((f) => !f.parent).map(buildNode),
    root_documents: rootDocs,
  };
}
