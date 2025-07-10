from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db, User, CEOProfile
from auth import get_current_active_user
from schemas import CEOProfileCreate, CEOProfile as CEOProfileSchema, CEOProfileUpdate
import os
import aiofiles
from config import settings

router = APIRouter(prefix="/ceo-profiles", tags=["ceo-profiles"])


@router.post("/", response_model=CEOProfileSchema)
async def create_ceo_profile(
    profile: CEOProfileCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new CEO profile"""
    db_profile = CEOProfile(
        user_id=current_user.id,
        name=profile.name,
        company=profile.company,
        position=profile.position,
        bio=profile.bio
    )
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    return db_profile


@router.get("/", response_model=List[CEOProfileSchema])
async def get_ceo_profiles(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all CEO profiles for the current user"""
    profiles = db.query(CEOProfile).filter(
        CEOProfile.user_id == current_user.id,
        CEOProfile.is_active == True
    ).all()
    return profiles


@router.get("/{profile_id}", response_model=CEOProfileSchema)
async def get_ceo_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific CEO profile"""
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
    
    return profile


@router.put("/{profile_id}", response_model=CEOProfileSchema)
async def update_ceo_profile(
    profile_id: int,
    profile_update: CEOProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a CEO profile"""
    db_profile = db.query(CEOProfile).filter(
        CEOProfile.id == profile_id,
        CEOProfile.user_id == current_user.id,
        CEOProfile.is_active == True
    ).first()
    
    if not db_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEO profile not found"
        )
    
    # Update fields
    update_data = profile_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_profile, field, value)
    
    db.commit()
    db.refresh(db_profile)
    return db_profile


@router.delete("/{profile_id}")
async def delete_ceo_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a CEO profile (soft delete)"""
    db_profile = db.query(CEOProfile).filter(
        CEOProfile.id == profile_id,
        CEOProfile.user_id == current_user.id,
        CEOProfile.is_active == True
    ).first()
    
    if not db_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEO profile not found"
        )
    
    db_profile.is_active = False
    db.commit()
    
    return {"message": "CEO profile deleted successfully"}


@router.post("/{profile_id}/voice-sample")
async def upload_voice_sample(
    profile_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload voice sample for CEO profile"""
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
    allowed_types = ["audio/mpeg", "audio/wav", "audio/mp3"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only MP3 and WAV files are allowed."
        )
    
    # Create upload directory
    upload_dir = os.path.join(settings.upload_dir, "voice_samples")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save file
    filename = f"voice_sample_{profile_id}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Update profile with voice sample path
    profile.voice_sample_path = file_path
    db.commit()
    
    return {
        "message": "Voice sample uploaded successfully",
        "file_path": file_path
    }