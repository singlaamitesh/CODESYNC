"""
Database configuration and models using SQLAlchemy
PostgreSQL for production, SQLite for development
"""
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database URL (PostgreSQL)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://amitesh@localhost:5432/codesync_db"
)

# Create engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)

# Session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# Database Models
class Document(Base):
    """Document model - stores code files"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    content = Column(Text, nullable=False, default="")
    language = Column(String(50), default="text")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship
    embeddings = relationship("Embedding", back_populates="document", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "language": self.language,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class Embedding(Base):
    """Embedding model - stores AI embeddings for semantic search"""
    __tablename__ = "embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    vector = Column(JSON, nullable=False)  # Store as JSON array
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationship
    document = relationship("Document", back_populates="embeddings")
    
    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "vector": self.vector,
            "created_at": self.created_at.isoformat()
        }


# Dependency for getting DB session
def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
