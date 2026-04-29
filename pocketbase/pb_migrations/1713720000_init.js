/// <reference path="../pb_data/types.d.ts" />

// Initial schema for CodeSync. Creates workspaces, workspace_members,
// folders, documents, chat_messages, and embeddings collections.
//
// Targets PocketBase v0.23+ migration API (app.save / collection.fields).

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // Make sure email/password auth is enabled on the built-in users collection.
  users.passwordAuth = Object.assign({}, users.passwordAuth, { enabled: true });
  app.save(users);

  const authedRule = '@request.auth.id != ""';
  // memberRule references workspace_members which doesn't exist yet, so we
  // start with the owner-only check and tighten it after both collections
  // are saved (see "Tighten cross-collection rules" block at the end).
  const ownerOnlyRule = '@request.auth.id != "" && owner = @request.auth.id';
  const memberRule = ownerOnlyRule;

  // PB v0.23+ no longer auto-injects `created`/`updated`; declare them per
  // collection. The factory below is reused everywhere.
  const timestampFields = () => [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ];

  // --- workspaces
  const workspaces = new Collection({
    type: 'base',
    name: 'workspaces',
    listRule: memberRule,
    viewRule: memberRule,
    createRule: authedRule,
    updateRule: '@request.auth.id != "" && owner = @request.auth.id',
    deleteRule: '@request.auth.id != "" && owner = @request.auth.id',
    fields: [
      { name: 'name', type: 'text', required: true, max: 255 },
      {
        name: 'owner',
        type: 'relation',
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      ...timestampFields(),
    ],
  });
  app.save(workspaces);

  // --- workspace_members (join)
  const members = new Collection({
    type: 'base',
    name: 'workspace_members',
    listRule: authedRule,
    viewRule: authedRule,
    createRule: '@request.auth.id != "" && workspace.owner = @request.auth.id',
    updateRule: '@request.auth.id != "" && workspace.owner = @request.auth.id',
    deleteRule: '@request.auth.id != "" && workspace.owner = @request.auth.id',
    fields: [
      {
        name: 'workspace',
        type: 'relation',
        required: true,
        collectionId: workspaces.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: 'user',
        type: 'relation',
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: 'role',
        type: 'select',
        required: true,
        values: ['owner', 'editor', 'viewer'],
        maxSelect: 1,
      },
      ...timestampFields(),
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_members_unique ON workspace_members (workspace, user)',
    ],
  });
  app.save(members);

  // Same temporary tightening — workspace_members exists by this point so the
  // cross-collection lookup IS valid here.
  const workspaceMemberRule =
    '@request.auth.id != "" && (workspace.owner = @request.auth.id ' +
    '|| (@collection.workspace_members.workspace = workspace ' +
    '&& @collection.workspace_members.user = @request.auth.id))';

  // --- folders. Saved first WITHOUT the self-relation, then the `parent`
  // field is added in a second save once `folders.id` exists.
  const folders = new Collection({
    type: 'base',
    name: 'folders',
    listRule: workspaceMemberRule,
    viewRule: workspaceMemberRule,
    createRule: workspaceMemberRule,
    updateRule: workspaceMemberRule,
    deleteRule: workspaceMemberRule,
    fields: [
      {
        name: 'workspace',
        type: 'relation',
        required: true,
        collectionId: workspaces.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      { name: 'name', type: 'text', required: true, max: 255 },
      ...timestampFields(),
    ],
  });
  app.save(folders);

  folders.fields.add(new Field({
    name: 'parent',
    type: 'relation',
    required: false,
    collectionId: folders.id,
    maxSelect: 1,
  }));
  app.save(folders);

  // --- documents
  const documents = new Collection({
    type: 'base',
    name: 'documents',
    listRule: workspaceMemberRule,
    viewRule: workspaceMemberRule,
    createRule: workspaceMemberRule,
    updateRule: workspaceMemberRule,
    deleteRule: workspaceMemberRule,
    fields: [
      { name: 'title', type: 'text', required: true, max: 255 },
      { name: 'content', type: 'text', required: false },
      { name: 'language', type: 'text', required: false, max: 50 },
      {
        name: 'workspace',
        type: 'relation',
        required: true,
        collectionId: workspaces.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: 'folder',
        type: 'relation',
        required: false,
        collectionId: folders.id,
        maxSelect: 1,
      },
      ...timestampFields(),
    ],
  });
  app.save(documents);

  // --- chat_messages
  const chat = new Collection({
    type: 'base',
    name: 'chat_messages',
    listRule: workspaceMemberRule,
    viewRule: workspaceMemberRule,
    createRule: workspaceMemberRule + ' && user = @request.auth.id',
    updateRule: null,
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      {
        name: 'workspace',
        type: 'relation',
        required: true,
        collectionId: workspaces.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: 'user',
        type: 'relation',
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      { name: 'content', type: 'text', required: true },
      ...timestampFields(),
    ],
  });
  app.save(chat);

  // --- embeddings (admin-only writes)
  const embeddings = new Collection({
    type: 'base',
    name: 'embeddings',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: 'document',
        type: 'relation',
        required: true,
        collectionId: documents.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      { name: 'vector', type: 'json', required: true },
      ...timestampFields(),
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_embeddings_document ON embeddings (document)',
    ],
  });
  app.save(embeddings);

  // Tighten cross-collection rules now that workspace_members exists.
  const fullMemberRule =
    '@request.auth.id != "" && (owner = @request.auth.id ' +
    '|| (@collection.workspace_members.workspace = id ' +
    '&& @collection.workspace_members.user = @request.auth.id))';
  workspaces.listRule = fullMemberRule;
  workspaces.viewRule = fullMemberRule;
  app.save(workspaces);
}, (app) => {
  for (const name of [
    'embeddings',
    'chat_messages',
    'documents',
    'folders',
    'workspace_members',
    'workspaces',
  ]) {
    try {
      const c = app.findCollectionByNameOrId(name);
      app.delete(c);
    } catch (_) {
      /* already gone */
    }
  }
});
