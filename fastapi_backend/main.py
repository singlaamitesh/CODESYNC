"""
CodeSync AI — FastAPI backend.

Slim version: only AI routes + Y.js WebSocket. Auth, users, workspaces,
folders, documents, and chat are handled by PocketBase.
"""
from dotenv import load_dotenv
load_dotenv()

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ai, websocket, chat
from app.services.yjs_manager import YjsDocumentManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8080")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("🚀 Starting CodeSync AI FastAPI…")
    await YjsDocumentManager.get_instance()
    logger.info("✅ Y.js manager ready")
    yield
    logger.info("🛑 Shutting down")


app = FastAPI(title="CodeSync AI", version="3.0.0", lifespan=lifespan)

# Single-origin deployment: Caddy serves the frontend at the same domain
# as this API, so CORS only needs to allow localhost for dev + the configured
# FRONTEND_URL. Everything lives behind one origin in production.
allow_origins = {
    FRONTEND_URL,
    "http://localhost:8080",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allow_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(chat.router, prefix="/api/ai", tags=["AI Chat"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])


@app.get("/")
async def root():
    return {"service": "CodeSync AI", "version": "3.0.0", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
