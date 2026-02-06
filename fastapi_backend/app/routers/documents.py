"""
Document CRUD API endpoints
RESTful API for managing code documents
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db, Document as DBDocument, Embedding as DBEmbedding
from app.schemas import DocumentCreate, DocumentUpdate, DocumentResponse
from app.services.ai_service import AIService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get list of all documents"""
    documents = db.query(DBDocument).offset(skip).limit(limit).all()
    return documents


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    document: DocumentCreate,
    db: Session = Depends(get_db)
):
    """Create a new document"""
    # Create document
    db_document = DBDocument(
        title=document.title,
        content=document.content,
        language=document.language or "text"
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    # Generate embedding asynchronously
    try:
        ai_service = AIService()
        embedding_vector = await ai_service.generate_embedding(document.content)
        
        db_embedding = DBEmbedding(
            document_id=db_document.id,
            vector=embedding_vector
        )
        db.add(db_embedding)
        db.commit()
        logger.info(f"✅ Created document {db_document.id} with embedding")
    except Exception as e:
        logger.error(f"❌ Failed to generate embedding: {e}")
    
    return db_document


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific document by ID"""
    document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document: DocumentUpdate,
    db: Session = Depends(get_db)
):
    """Update a document"""
    db_document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update fields
    if document.title is not None:
        db_document.title = document.title
    if document.content is not None:
        db_document.content = document.content
    if document.language is not None:
        db_document.language = document.language
    
    db.commit()
    db.refresh(db_document)
    
    # Update embedding if content changed
    if document.content is not None:
        try:
            ai_service = AIService()
            embedding_vector = await ai_service.generate_embedding(document.content)
            
            # Update or create embedding
            db_embedding = db.query(DBEmbedding).filter(
                DBEmbedding.document_id == document_id
            ).first()
            
            if db_embedding:
                db_embedding.vector = embedding_vector
            else:
                db_embedding = DBEmbedding(
                    document_id=document_id,
                    vector=embedding_vector
                )
                db.add(db_embedding)
            
            db.commit()
            logger.info(f"✅ Updated document {document_id} with new embedding")
        except Exception as e:
            logger.error(f"❌ Failed to update embedding: {e}")
    
    return db_document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Delete a document"""
    db_document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.delete(db_document)
    db.commit()
    logger.info(f"🗑️ Deleted document {document_id}")
    return None
