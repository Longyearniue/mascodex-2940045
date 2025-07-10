from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db, User, CEOProfile, Interview
from auth import get_current_active_user
from schemas import InterviewCreate, Interview as InterviewSchema, InterviewUpdate

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.post("/{profile_id}", response_model=InterviewSchema)
async def create_interview(
    profile_id: int,
    interview: InterviewCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new interview for CEO profile"""
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
    
    db_interview = Interview(
        ceo_profile_id=profile_id,
        title=interview.title,
        content=interview.content
    )
    db.add(db_interview)
    db.commit()
    db.refresh(db_interview)
    return db_interview


@router.get("/{profile_id}", response_model=List[InterviewSchema])
async def get_interviews(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all interviews for a CEO profile"""
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
    
    interviews = db.query(Interview).filter(
        Interview.ceo_profile_id == profile_id,
        Interview.is_active == True
    ).all()
    
    return interviews


@router.get("/{profile_id}/{interview_id}", response_model=InterviewSchema)
async def get_interview(
    profile_id: int,
    interview_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific interview"""
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
    
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.ceo_profile_id == profile_id,
        Interview.is_active == True
    ).first()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    return interview


@router.put("/{profile_id}/{interview_id}", response_model=InterviewSchema)
async def update_interview(
    profile_id: int,
    interview_id: int,
    interview_update: InterviewUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an interview"""
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
    
    db_interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.ceo_profile_id == profile_id,
        Interview.is_active == True
    ).first()
    
    if not db_interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    # Update fields
    update_data = interview_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_interview, field, value)
    
    db.commit()
    db.refresh(db_interview)
    return db_interview


@router.delete("/{profile_id}/{interview_id}")
async def delete_interview(
    profile_id: int,
    interview_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an interview (soft delete)"""
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
    
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.ceo_profile_id == profile_id,
        Interview.is_active == True
    ).first()
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found"
        )
    
    # Soft delete
    interview.is_active = False
    db.commit()
    
    return {"message": "Interview deleted successfully"}