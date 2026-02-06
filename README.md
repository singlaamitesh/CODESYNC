# CodeSync AI - Real-time Collaborative Code Editor

A powerful real-time collaborative code editor with AI-powered assistance, built with FastAPI, React, and Y.js CRDT technology.

## 🚀 Features

- **Real-time Collaboration**: Multiple users can edit code simultaneously with conflict-free merging
- **AI Code Analysis**: Intelligent code suggestions, error detection, and optimization
- **Monaco Editor**: Professional code editing experience with syntax highlighting
- **Y.js CRDT**: Conflict-free replicated data types for seamless synchronization
- **WebSocket Communication**: Real-time updates and AI analysis
- **PostgreSQL Database**: Persistent document storage with embeddings
- **Redis Integration**: High-performance pub/sub messaging

## 🏗️ Architecture

### Backend (FastAPI - Port 8000)
- RESTful API for document management
- AI analysis endpoints with OpenRouter integration
- Dual WebSocket system (JSON for AI, Binary for CRDT)
- PostgreSQL with SQLAlchemy ORM
- Redis for cross-server synchronization

### Real-time Sync (Y.js Server - Port 8001)
- CRDT-based document synchronization
- User awareness and presence indicators
- Redis pub/sub for horizontal scaling

### Frontend (React + TypeScript - Port 8080)
- Monaco Editor with Y.js binding
- Real-time collaborative editing
- AI suggestions panel
- File explorer and management
- Modern UI with TailwindCSS

## 📋 Prerequisites

- Python 3.14+
- Node.js 18+
- PostgreSQL 14+
- Redis Server
- Git

## 🛠️ Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/singlaamitesh/CODESYNC.git
cd CODESYNC
```

### 2. Backend Setup
```bash
cd fastapi_backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your API keys and database credentials
```

### 4. Database Setup
```bash
# Create PostgreSQL database
createdb codesync_db

# Run database migrations (if any)
# Tables are created automatically on startup
```

### 5. Frontend Setup
```bash
cd ../codesync/code-harmony-main
npm install
```

### 6. Start Services
```bash
# From project root
./start.sh
```

### 7. Access the Application
- **Frontend**: http://localhost:8080
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## 🔧 Environment Variables

Create a `.env` file in the `fastapi_backend` directory:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
DATABASE_URL=postgresql://username:password@localhost:5432/codesync_db
REDIS_URL=redis://localhost:6379
```

## 🚀 Deployment

### Render Deployment (Recommended)

1. **Connect GitHub Repository**
   - Go to Render Dashboard
   - Connect your GitHub repository

2. **Create Services** (in order):
   - **PostgreSQL Database** → Render PostgreSQL
   - **Redis Instance** → Render Redis
   - **FastAPI Backend** → Render Web Service
   - **React Frontend** → Render Static Site

3. **Environment Variables**
   - Set production API keys and database URLs in each service

4. **Build Commands**
   - **Backend**: `pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Frontend**: `npm run build`

## 📁 Project Structure

```
CodeSync_AI/
├── fastapi_backend/          # FastAPI backend
│   ├── main.py              # Application entry point
│   ├── .env                 # Environment variables
│   ├── requirements.txt     # Python dependencies
│   └── app/
│       ├── database.py      # Database models
│       ├── schemas.py       # Pydantic schemas
│       ├── routers/         # API endpoints
│       └── services/        # Business logic
├── codesync/
│   ├── yjs_server.py       # Y.js WebSocket server
│   └── code-harmony-main/   # React frontend
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── components/  # React components
│           ├── hooks/       # Custom hooks
│           ├── stores/      # State management
│           └── lib/         # Utilities
├── start.sh                 # Start all services
├── stop.sh                  # Stop all services
└── verify.sh               # Health verification
```

## 🤖 AI Integration

- **Model**: `arcee-ai/trinity-large-preview:free`
- **Provider**: OpenRouter API
- **Features**:
  - Code analysis and error detection
  - Intelligent code completion
  - Code optimization suggestions
  - Real-time AI assistance

## 🔒 Security

- API keys stored securely in environment variables
- CORS properly configured
- Input validation with Pydantic
- No hardcoded secrets in codebase

## 🧪 Testing Multi-User Collaboration

```bash
# Run multi-user test script
./test_multiuser.sh
```

This opens multiple browser tabs for testing real-time collaboration.

## 📊 Performance

- **WebSocket Latency**: < 50ms
- **AI Response Time**: 2-5 seconds
- **Concurrent Users**: Tested up to 10 users
- **Database Queries**: Optimized with proper indexing

## 🐛 Troubleshooting

### Common Issues

**FastAPI won't start:**
```bash
# Check port availability
lsof -i:8000
# Kill conflicting process
pkill -f uvicorn
```

**Y.js server issues:**
```bash
# Check Redis connection
redis-cli ping
# Restart Y.js server
pkill -f yjs_server.py
```

**AI not working:**
```bash
# Verify API key
cat fastapi_backend/.env | grep OPENROUTER_API_KEY
# Test API endpoint
curl http://localhost:8000/api/ai/analyze/1
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 👤 Author

**Amitesh Gupta**

Built with ❤️ using FastAPI, React, and Y.js

---

**Last Updated**: February 6, 2026