"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class DocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(default="")
    language: Optional[str] = "text"


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    language: Optional[str] = None


class DocumentResponse(DocumentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AISuggestion(BaseModel):
    type: str = Field(..., description="error, warning, info, etc.")
    message: str
    line: Optional[int] = None
    severity: str = "info"
    fix: Optional[str] = None


class AIAnalysisData(BaseModel):
    """Inner analysis data matching frontend's suggestion_data shape"""
    suggestions: List[AISuggestion] = []
    analysis: Dict[str, Any] = {}
    embedding: List[float] = []


class AIAnalysisResponse(BaseModel):
    """Response matching frontend's AISuggestionResponse interface"""
    document_id: int
    suggestion_data: AIAnalysisData
    status: str = "success"


class OptimizationData(BaseModel):
    """Inner optimization data matching frontend's optimization shape"""
    optimized_code: str
    changes: List[Dict[str, str]] = []
    performance_improvement: str = ""
    summary: str = ""
    language: str = "text"
    llm_used: Optional[str] = None


class OptimizationResponse(BaseModel):
    """Response matching frontend's OptimizationResponse interface"""
    document_id: int
    optimization: OptimizationData
    status: str = "success"


class CompletionRequest(BaseModel):
    line: int
    column: int


class CompletionResponse(BaseModel):
    document_id: int
    completions: List[Dict[str, str]]
    status: str = "success"


class SimilarDocumentResponse(BaseModel):
    document: DocumentResponse
    similarity_score: float
