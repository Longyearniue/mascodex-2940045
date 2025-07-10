from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class CeoProfileBase(BaseModel):
    name: str
    description: Optional[str] = None


class CeoProfileCreate(CeoProfileBase):
    pass


class CeoProfileUpdate(CeoProfileBase):
    pass


class CeoProfileOut(CeoProfileBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class DocumentOut(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime

    class Config:
        orm_mode = True


class VoiceSampleOut(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime

    class Config:
        orm_mode = True


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str