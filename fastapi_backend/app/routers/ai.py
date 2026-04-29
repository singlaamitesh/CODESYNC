"""
AI Analysis API endpoints.

These routes no longer read documents from a database; the frontend passes
content directly in the request body. This keeps FastAPI free of the
PocketBase schema.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.schemas import (
    AnalyzeRequest, AIAnalysisResponse, AIAnalysisData,
    OptimizeRequest, OptimizationResponse, OptimizationData,
    CompletionRequest, CompletionResponse,
)
from app.services.ai_service import AIService
from app.services import embeddings as emb
from app.services.pb_auth import require_pb_auth, PbUser
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze", response_model=AIAnalysisResponse)
async def analyze_code(req: AnalyzeRequest, _user: PbUser = Depends(require_pb_auth)):
    """Analyze code passed in the request body."""
    ai = AIService()
    result = await ai.analyze_code(code=req.content, filename=req.filename)

    data = AIAnalysisData(
        suggestions=result.get("suggestions", []),
        analysis=result.get("analysis", {}),
        embedding=[],
    )
    data.analysis["language"] = result.get("language", "text")
    data.analysis["llm_used"] = result.get("llm_used")

    return AIAnalysisResponse(document_id=req.document_id, suggestion_data=data)


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_code(req: OptimizeRequest, _user: PbUser = Depends(require_pb_auth)):
    ai = AIService()
    result = await ai.optimize_code(code=req.content, filename=req.filename)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return OptimizationResponse(
        document_id=req.document_id,
        optimization=OptimizationData(
            optimized_code=result.get("optimized_code", ""),
            changes=result.get("changes", []),
            performance_improvement=result.get("performance_improvement", ""),
            summary=result.get("summary", ""),
            language=result.get("language", "text"),
            llm_used=result.get("llm_used"),
        ),
    )


@router.post("/complete", response_model=CompletionResponse)
async def get_completions(req: CompletionRequest, _user: PbUser = Depends(require_pb_auth)):
    ai = AIService()
    result = await ai.get_completions(
        code=req.content, line=req.line, column=req.column, filename=req.filename,
    )
    return CompletionResponse(
        document_id=req.document_id,
        completions=result.get("completions", []),
    )


class EmbedRequest(BaseModel):
    document_id: str
    workspace_id: str = ""
    title: str = ""
    content: str
    updated: str = ""


@router.post("/embed")
async def embed_document(req: EmbedRequest, _user: PbUser = Depends(require_pb_auth)):
    ok = await emb.upsert_document(
        document_id=req.document_id,
        workspace_id=req.workspace_id,
        title=req.title,
        content=req.content,
        updated=req.updated,
    )
    return {"indexed": ok}


@router.delete("/embed/{document_id}")
async def delete_embedding(document_id: str, _user: PbUser = Depends(require_pb_auth)):
    await emb.delete_document(document_id)
    return {"deleted": True}


@router.get("/search")
async def semantic_search(
    q: str,
    workspace: str = "",
    limit: int = 5,
    _user: PbUser = Depends(require_pb_auth),
):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query is required")
    results = await emb.search(q, workspace_id=workspace or None, limit=limit)
    return {"query": q, "results": results}


@router.get("/config")
async def get_ai_config(_user: PbUser = Depends(require_pb_auth)):
    ai = AIService()
    return {"model": ai.model, "ready": ai.ready, "provider": "OpenRouter"}
