/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const workspaces = app.findCollectionByNameOrId("workspaces");

  const ownRule = '@request.auth.id != "" && user = @request.auth.id';
  const sessionOwnRule = '@request.auth.id != "" && session.user = @request.auth.id';

  const sessions = new Collection({
    type: "base",
    name: "ai_chat_sessions",
    listRule: ownRule,
    viewRule: ownRule,
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: ownRule,
    deleteRule: ownRule,
    fields: [
      {
        name: "workspace",
        type: "relation",
        required: true,
        collectionId: workspaces.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      { name: "title", type: "text", required: true, max: 255 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(sessions);

  const messages = new Collection({
    type: "base",
    name: "ai_chat_messages",
    listRule: sessionOwnRule,
    viewRule: sessionOwnRule,
    createRule: sessionOwnRule,
    updateRule: null,
    deleteRule: sessionOwnRule,
    fields: [
      {
        name: "session",
        type: "relation",
        required: true,
        collectionId: sessions.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: "role",
        type: "select",
        required: true,
        values: ["user", "assistant"],
        maxSelect: 1,
      },
      { name: "content", type: "text", required: true },
      { name: "citations", type: "json" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
  });
  app.save(messages);
}, (app) => {
  for (const name of ["ai_chat_messages", "ai_chat_sessions"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) { /* already gone */ }
  }
});
