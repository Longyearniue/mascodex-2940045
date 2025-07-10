import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db, User, CEOProfile, ChatSession, ChatMessage
from auth import get_current_active_user
from schemas import ChatRequest, ChatResponse, ChatMessage as ChatMessageSchema
from ai_service import ai_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/start", response_model=ChatResponse)
async def start_chat_session(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Start a new chat session with a CEO profile"""
    # Check if profile exists and belongs to user
    profile = db.query(CEOProfile).filter(
        CEOProfile.id == request.ceo_profile_id,
        CEOProfile.user_id == current_user.id,
        CEOProfile.is_active == True
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEO profile not found"
        )
    
    # Create new session
    session_id = str(uuid.uuid4())
    db_session = ChatSession(
        ceo_profile_id=request.ceo_profile_id,
        user_id=current_user.id,
        session_id=session_id
    )
    db.add(db_session)
    db.commit()
    
    # Generate AI response
    ceo_context = {
        "name": profile.name,
        "company": profile.company,
        "position": profile.position,
        "bio": profile.bio,
        "documents": [],  # Will be populated if needed
        "interviews": []   # Will be populated if needed
    }
    
    ai_response = await ai_service.generate_ceo_response(
        request.message, 
        ceo_context
    )
    
    # Save messages
    user_message = ChatMessage(
        session_id=session_id,
        message_type="user",
        content=request.message
    )
    ai_message = ChatMessage(
        session_id=session_id,
        message_type="assistant",
        content=ai_response
    )
    
    db.add(user_message)
    db.add(ai_message)
    db.commit()
    
    # Generate voice if voice sample exists
    audio_url = None
    if profile.voice_sample_path:
        audio_path = ai_service.generate_voice(ai_response)
        if audio_path:
            audio_url = f"/api/files/voices/{audio_path.split('/')[-1]}"
    
    return ChatResponse(
        message=ai_response,
        session_id=session_id,
        audio_url=audio_url
    )


@router.post("/continue", response_model=ChatResponse)
async def continue_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Continue an existing chat session"""
    if not request.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID is required"
        )
    
    # Check if session exists and belongs to user
    session = db.query(ChatSession).filter(
        ChatSession.session_id == request.session_id,
        ChatSession.user_id == current_user.id,
        ChatSession.is_active == True
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )
    
    # Get CEO profile
    profile = db.query(CEOProfile).filter(
        CEOProfile.id == session.ceo_profile_id,
        CEOProfile.is_active == True
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEO profile not found"
        )
    
    # Get conversation history
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == request.session_id
    ).order_by(ChatMessage.created_at).all()
    
    conversation_history = [
        {
            "message_type": msg.message_type,
            "content": msg.content
        }
        for msg in messages
    ]
    
    # Build CEO context
    ceo_context = {
        "name": profile.name,
        "company": profile.company,
        "position": profile.position,
        "bio": profile.bio,
        "documents": [],  # Could be enhanced to include documents
        "interviews": []   # Could be enhanced to include interviews
    }
    
    # Generate AI response
    ai_response = await ai_service.generate_ceo_response(
        request.message,
        ceo_context,
        conversation_history
    )
    
    # Save messages
    user_message = ChatMessage(
        session_id=request.session_id,
        message_type="user",
        content=request.message
    )
    ai_message = ChatMessage(
        session_id=request.session_id,
        message_type="assistant",
        content=ai_response
    )
    
    db.add(user_message)
    db.add(ai_message)
    db.commit()
    
    # Generate voice if voice sample exists
    audio_url = None
    if profile.voice_sample_path:
        audio_path = ai_service.generate_voice(ai_response)
        if audio_path:
            audio_url = f"/api/files/voices/{audio_path.split('/')[-1]}"
    
    return ChatResponse(
        message=ai_response,
        session_id=request.session_id,
        audio_url=audio_url
    )


@router.get("/sessions", response_model=List[dict])
async def get_chat_sessions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all chat sessions for the current user"""
    sessions = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id,
        ChatSession.is_active == True
    ).all()
    
    return [
        {
            "session_id": session.session_id,
            "ceo_profile_id": session.ceo_profile_id,
            "created_at": session.created_at
        }
        for session in sessions
    ]


@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageSchema])
async def get_chat_messages(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all messages for a chat session"""
    # Check if session belongs to user
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.user_id == current_user.id,
        ChatSession.is_active == True
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at).all()
    
    return messages


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a chat session (soft delete)"""
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.user_id == current_user.id,
        ChatSession.is_active == True
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )
    
    session.is_active = False
    db.commit()
    
    return {"message": "Chat session deleted successfully"}