# CodeSync AI - Collaborative Code Editor with Ghost AI Agents

A Google Docs-style real-time code editor where human users and AI Agents collaborate simultaneously using **CRDTs (Conflict-free Replicated Data Types)**.

## 🎯 Key Features (Interview-Ready)

### 1. **CRDT-Based Collaboration (Y.js)**
- Uses Y.js for conflict-free real-time editing
- **Delta updates** - Only changes are sent, not entire documents
- Automatic conflict resolution when users edit the same line
- No data loss, no overwriting

### 2. **AI Ghost Agent**
- AI joins as a "user" in the document
- Inserts code fixes directly into the CRDT stream
- Shows its cursor position to human users
- Non-intrusive - users see AI typing in real-time

### 3. **Distributed State Consistency**
- Redis Pub/Sub for multi-server scaling
- Users on different servers can collaborate seamlessly
- Eventual consistency guaranteed by CRDTs

### 4. **Memory Management**
- Garbage collection for CRDT history
- Snapshots to keep documents lightweight
- Configurable update retention

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Monaco    │  │    Y.js     │  │   AI Suggestions Panel  │ │
│  │   Editor    │◄─┤   (CRDT)    │  │   (Ghost Agent UI)      │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────────┘ │
└──────────────────────────┼──────────────────────────────────────┘
                           │ WebSocket (Delta Updates)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Y.js WebSocket Server (:8001)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Document  │  │  Awareness  │  │   Redis Pub/Sub         │ │
│  │    State    │  │  (Cursors)  │  │   (Multi-Server)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                   Django Backend (:8000)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  REST API   │  │  WebSocket  │  │   AI Analysis           │ │
│  │  (CRUD)     │  │  (Legacy)   │  │   (OpenRouter)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    Data Layer                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ PostgreSQL  │  │    Redis    │  │   Celery Worker         │ │
│  │  (Storage)  │  │  (Pub/Sub)  │  │   (Background Tasks)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🔑 Interview Talking Points

### Conflict Resolution
```
Scenario: User A types "hello" at position 5, User B types "world" at position 5

Traditional: Last write wins → Data loss
CRDT (Y.js): Both operations merge → "helloworld" or "worldhello"
             No conflict, no data loss, deterministic result
```

### Delta Updates vs Full Content
```
Traditional:
  → Send: "function hello() { console.log('hi'); }"  (42 bytes every keystroke)

CRDT:
  → Send: { insert: 'x', position: 15 }  (25 bytes, only the change)
  
Savings: 99% bandwidth reduction on active editing
```

### Multi-Server Scaling
```
Server 1 (US)           Server 2 (EU)
    │                       │
    └───── Redis Pub/Sub ───┘
    
User A → Server 1 → Redis → Server 2 → User B
         (instant sync across regions)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL
- Redis

### Quick Start

```bash
# Terminal 1: Y.js WebSocket Server (CRDT)
cd codesync
source ../venv/bin/activate
python yjs_server.py

# Terminal 2: Django Backend (API + AI)
daphne -b 127.0.0.1 -p 8000 codesync.asgi:application

# Terminal 3: Frontend
cd code-harmony-main
npm run dev
```

### URLs
- **Frontend**: http://localhost:8080
- **Y.js Server**: ws://localhost:8001
- **Django API**: http://localhost:8000

## 📁 Key Files

| File | Purpose |
|------|---------|
| `yjs_server.py` | Y.js WebSocket server for CRDT sync |
| `src/lib/yjs-provider.ts` | Y.js client provider |
| `src/hooks/useYjs.ts` | React hook for Y.js |
| `src/components/editor/CollaborativeEditor.tsx` | Monaco + Y.js binding |
| `editor/yjs_consumer.py` | Django Channels Y.js consumer |

## 🧪 Testing CRDT

1. Open http://localhost:8080 in two browser windows
2. Select the same document in both
3. Type simultaneously in both windows
4. Watch the CRDT status bar: `Δ` counter shows delta operations
5. Observe that no text is lost, even when typing at the same position

## Tech Stack

### Frontend
- React + TypeScript
- Vite (build tool)
- Monaco Editor + **Y.js + y-monaco**
- Tailwind CSS + shadcn/ui
- Zustand (state management)

### Backend
- Django + Django REST Framework
- Django Channels (WebSockets)
- Daphne (ASGI server)
- **Custom Y.js WebSocket Server**
- Celery (background tasks)
- PostgreSQL + Redis

### AI
- OpenRouter API (Mistral Devstral model)
- **AI Ghost Agent** (joins as CRDT user)

## License

MIT
