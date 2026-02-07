"""
CodeSync AI - FastAPI Backend
Real-time collaborative code editor with AI Ghost Agents
Using CRDTs (Y.js) for conflict-free collaboration
"""
from dotenv import load_dotenv
load_dotenv()  # Load .env before any other imports

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.routers import documents, ai, websocket
from app.database import engine, Base
from app.services.redis_manager import RedisManager
from app.services.yjs_manager import YjsDocumentManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("🚀 Starting CodeSync AI FastAPI Server...")
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created")
    
    # Initialize Redis
    redis_manager = await RedisManager.get_instance()
    logger.info("✅ Redis connected")
    
    # Initialize Y.js Document Manager
    yjs_manager = await YjsDocumentManager.get_instance()
    logger.info("✅ Y.js Document Manager initialized")
    
    logger.info("🎉 Server is ready!")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down server...")
    await redis_manager.close()
    logger.info("👋 Server stopped")


# Create FastAPI app
app = FastAPI(
    title="CodeSync AI",
    description="Real-time collaborative code editor with AI Ghost Agents using CRDTs",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://bucolic-beignet-577c50.netlify.app",  # Your Netlify domain
        "https://*.netlify.app",  # Allow all Netlify preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "CodeSync AI",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "Real-time collaboration with CRDTs",
            "AI Ghost Agents",
            "Conflict-free editing",
            "Redis Pub/Sub scaling"
        ]
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    redis_manager = await RedisManager.get_instance()
    redis_healthy = await redis_manager.ping()
    
    return {
        "status": "healthy" if redis_healthy else "degraded",
        "database": "connected",
        "redis": "connected" if redis_healthy else "disconnected",
        "yjs": "initialized"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
