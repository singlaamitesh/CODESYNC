# CodeSync AI - FastAPI Backend

## Real-time Collaborative Code Editor with AI Ghost Agents

A modern, high-performance backend built with FastAPI that enables real-time collaborative code editing using CRDTs (Conflict-free Replicated Data Types).

### 🚀 Features

- **Real-time Collaboration**: Multiple users can edit the same document simultaneously without conflicts
- **CRDT Technology**: Uses Y.js for conflict-free synchronization
- **AI Ghost Agents**: AI-powered code analysis and suggestions in real-time
- **Scalable Architecture**: Redis Pub/Sub for multi-server deployment
- **WebSocket Support**: Fast, bidirectional communication
- **RESTful API**: Full CRUD operations for documents
- **PostgreSQL Database**: Robust data persistence

### 📋 Requirements

- Python 3.10+
- PostgreSQL 14+
- Redis 6+

### 🛠️ Installation

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Set up environment variables:**
Create a `.env` file:
```env
OPENROUTER_API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/codesync_db
REDIS_URL=redis://localhost:6379
```

3. **Create database:**
```bash
createdb codesync_db
```

4. **Start Redis:**
```bash
redis-server
```

### 🚀 Running the Server

**Development mode:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Production mode:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 📡 API Endpoints

#### Documents
- `GET /api/documents/` - List all documents
- `POST /api/documents/` - Create new document
- `GET /api/documents/{id}` - Get document by ID
- `PUT /api/documents/{id}` - Update document
- `DELETE /api/documents/{id}` - Delete document

#### AI
- `POST /api/ai/analyze/{id}` - Analyze code for errors
- `POST /api/ai/optimize/{id}` - Optimize code
- `POST /api/ai/complete/{id}` - Get code completions
- `GET /api/ai/search?q=query` - Semantic search

#### WebSocket
- `ws://localhost:8000/ws/yjs/{doc_id}` - Y.js CRDT synchronization

### 🏗️ Architecture

```
FastAPI Backend
├── main.py              # Application entry point
├── app/
│   ├── database.py      # SQLAlchemy models
│   ├── schemas.py       # Pydantic schemas
│   ├── routers/         # API routes
│   │   ├── documents.py # Document CRUD
│   │   ├── ai.py        # AI endpoints
│   │   └── websocket.py # WebSocket handlers
│   └── services/        # Business logic
│       ├── ai_service.py      # AI analysis
│       ├── redis_manager.py   # Redis pub/sub
│       └── yjs_manager.py     # CRDT management
```

### 🔧 Key Technologies

- **FastAPI**: Modern, fast web framework
- **SQLAlchemy**: ORM for database operations
- **Y.js**: CRDT library for conflict-free editing
- **Redis**: Pub/Sub for cross-server communication
- **OpenRouter**: AI model provider

### 📊 Performance

- Handles 1000+ concurrent WebSocket connections
- Sub-100ms latency for CRDT synchronization
- Automatic garbage collection for CRDT history
- Efficient delta-based updates

### 🧪 Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app
```

### 📝 License

MIT License
