from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


# CEO Profile schemas
class CEOProfileBase(BaseModel):
    name: str
    company: str
    position: str
    bio: Optional[str] = None


class CEOProfileCreate(CEOProfileBase):
    pass


class CEOProfileUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    bio: Optional[str] = None
    voice_sample_path: Optional[str] = None


class CEOProfile(CEOProfileBase):
    id: int
    user_id: int
    voice_sample_path: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Document schemas
class DocumentBase(BaseModel):
    filename: str
    file_type: str


class DocumentCreate(DocumentBase):
    pass


class Document(DocumentBase):
    id: int
    ceo_profile_id: int
    file_path: str
    content_summary: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Interview schemas
class InterviewBase(BaseModel):
    title: str
    content: str


class InterviewCreate(InterviewBase):
    pass


class InterviewUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class Interview(InterviewBase):
    id: int
    ceo_profile_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Chat schemas
class ChatMessageBase(BaseModel):
    content: str
    message_type: str


class ChatMessageCreate(ChatMessageBase):
    session_id: str


class ChatMessage(ChatMessageBase):
    id: int
    session_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatSessionCreate(BaseModel):
    ceo_profile_id: int


class ChatSession(BaseModel):
    id: int
    ceo_profile_id: int
    user_id: int
    session_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# AI Chat schemas
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    ceo_profile_id: int


class ChatResponse(BaseModel):
    message: str
    session_id: str
    audio_url: Optional[str] = None


# File upload schemas
class FileUploadResponse(BaseModel):
    filename: str
    file_path: str
    file_type: str
    message: str