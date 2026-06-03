"""
Pydantic schemas for the AI + WebSocket API surface.
Workspace/folder/document CRUD lives in PocketBase now, so those
schemas have been removed.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class AISuggestion(BaseModel):
    type: str = Field(..., description="error, warning, info, etc.")
    message: str
    line: Optional[int] = None
    severity: str = "info"
    fix: Optional[str] = None


class AIAnalysisData(BaseModel):
    suggestions: List[AISuggestion] = []
    analysis: Dict[str, Any] = {}
    embedding: List[float] = []


class AnalyzeRequest(BaseModel):
    document_id: str = ""
    content: str
    filename: Optional[str] = None


class AIAnalysisResponse(BaseModel):
    document_id: str
    suggestion_data: AIAnalysisData
    status: str = "success"


class OptimizeRequest(BaseModel):
    document_id: str = ""
    content: str
    filename: Optional[str] = None


class OptimizationData(BaseModel):
    optimized_code: str
    changes: List[Dict[str, str]] = []
    performance_improvement: str = ""
    summary: str = ""
    language: str = "text"
    llm_used: Optional[str] = None


class OptimizationResponse(BaseModel):
    document_id: str
    optimization: OptimizationData
    status: str = "success"


class CompletionRequest(BaseModel):
    document_id: str = ""
    content: str
    line: int
    column: int
    filename: Optional[str] = None


class CompletionResponse(BaseModel):
    document_id: str
    completions: List[Dict[str, str]]
    status: str = "success"
