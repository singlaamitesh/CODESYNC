"""
AI Analysis API endpoints
Real-time code analysis, optimization, and completions
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, Document as DBDocument
from app.schemas import (
    AIAnalysisResponse, AIAnalysisData,
    OptimizationResponse, OptimizationData,
    CompletionRequest, CompletionResponse
)
from app.services.ai_service import AIService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze/{document_id}", response_model=AIAnalysisResponse)
async def analyze_code(
    document_id: int,
    db: Session = Depends(get_db)
):
    """
    Analyze code for errors, warnings, and suggestions
    Uses AI to provide real-time feedback
    """
    document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    ai_service = AIService()
    result = await ai_service.analyze_code(
        code=document.content,
        filename=document.title
    )
    
    # Build response matching frontend's AISuggestionResponse interface
    suggestion_data = AIAnalysisData(
        suggestions=result.get("suggestions", []),
        analysis=result.get("analysis", {}),
        embedding=[]
    )
    # Inject language and llm info into analysis
    suggestion_data.analysis["language"] = result.get("language", "text")
    suggestion_data.analysis["llm_used"] = result.get("llm_used")
    
    return AIAnalysisResponse(
        document_id=document_id,
        suggestion_data=suggestion_data,
        status="success"
    )


@router.post("/optimize/{document_id}", response_model=OptimizationResponse)
async def optimize_code(
    document_id: int,
    db: Session = Depends(get_db)
):
    """
    Optimize code for better performance and readability
    Returns optimized version with explanation
    """
    document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    ai_service = AIService()
    result = await ai_service.optimize_code(
        code=document.content,
        filename=document.title
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    optimization = OptimizationData(
        optimized_code=result.get("optimized_code", ""),
        changes=result.get("changes", []),
        performance_improvement=result.get("performance_improvement", ""),
        summary=result.get("summary", ""),
        language=result.get("language", "text"),
        llm_used=result.get("llm_used")
    )
    
    return OptimizationResponse(
        document_id=document_id,
        optimization=optimization,
        status="success"
    )


@router.post("/complete/{document_id}", response_model=CompletionResponse)
async def get_completions(
    document_id: int,
    request: CompletionRequest,
    db: Session = Depends(get_db)
):
    """
    Get AI-powered code completions at cursor position
    """
    document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    ai_service = AIService()
    result = await ai_service.get_completions(
        code=document.content,
        line=request.line,
        column=request.column,
        filename=document.title
    )
    
    return CompletionResponse(
        document_id=document_id,
        completions=result.get("completions", []),
        status="success"
    )


@router.get("/search")
async def search_similar(
    q: str,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """
    Semantic search for similar documents using embeddings
    """
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    
    ai_service = AIService()
    results = await ai_service.search_similar(q, db, limit)
    
    return {
        "query": q,
        "results": results
    }
