from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db, User, CEOProfile, Document
from auth import get_current_active_user
from schemas import Document as DocumentSchema
from ai_service import ai_service
import os
import aiofiles
from config import settings

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/{profile_id}", response_model=DocumentSchema)
async def upload_document(
    profile_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload a document for CEO profile"""
    # Check if profile exists and belongs to user
    profile = db.query(CEOProfile).filter(
        CEOProfile.id == profile_id,
        CEOProfile.user_id == current_user.id,
        CEOProfile.is_active == True
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEO profile not found"
        )
    
    # Validate file type
    allowed_types = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "text/plain": "txt"
    }
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF, DOCX, and TXT files are allowed."
        )
    
    # Create upload directory
    upload_dir = os.path.join(settings.upload_dir, "documents")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save file
    file_type = allowed_types[file.content_type]
    filename = f"doc_{profile_id}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Process document and generate summary
    content_summary = await ai_service.process_document(file_path, file_type)
    
    # Create document record
    db_document = Document(
        ceo_profile_id=profile_id,
        filename=file.filename,
        file_path=file_path,
        file_type=file_type,
        content_summary=content_summary
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    return db_document


@router.get("/{profile_id}", response_model=List[DocumentSchema])
async def get_documents(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all documents for a CEO profile"""
    # Check if profile exists and belongs to user
    profile = db.query(CEOProfile).filter(
        CEOProfile.id == profile_id,
        CEOProfile.user_id == current_user.id,
        CEOProfile.is_active == True
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEO profile not found"
        )
    
    documents = db.query(Document).filter(
        Document.ceo_profile_id == profile_id,
        Document.is_active == True
    ).all()
    
    return documents


@router.get("/{profile_id}/{document_id}", response_model=DocumentSchema)
async def get_document(
    profile_id: int,
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific document"""
    # Check if profile exists and belongs to user
    profile = db.query(CEOProfile).filter(
        CEOProfile.id == profile_id,
        CEOProfile.user_id == current_user.id,
        CEOProfile.is_active == True
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEO profile not found"
        )
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.ceo_profile_id == profile_id,
        Document.is_active == True
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return document


@router.delete("/{profile_id}/{document_id}")
async def delete_document(
    profile_id: int,
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a document (soft delete)"""
    # Check if profile exists and belongs to user
    profile = db.query(CEOProfile).filter(
        CEOProfile.id == profile_id,
        CEOProfile.user_id == current_user.id,
        CEOProfile.is_active == True
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEO profile not found"
        )
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.ceo_profile_id == profile_id,
        Document.is_active == True
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Soft delete
    document.is_active = False
    db.commit()
    
    return {"message": "Document deleted successfully"}