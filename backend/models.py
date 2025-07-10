from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from .database import Base


class CeoProfile(Base):
    __tablename__ = "ceo_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="ceo", cascade="all, delete-orphan")
    voice_samples = relationship("VoiceSample", back_populates="ceo", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="ceo", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    ceo_id = Column(Integer, ForeignKey("ceo_profiles.id"))
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    ceo = relationship("CeoProfile", back_populates="documents")


class VoiceSample(Base):
    __tablename__ = "voice_samples"

    id = Column(Integer, primary_key=True, index=True)
    ceo_id = Column(Integer, ForeignKey("ceo_profiles.id"))
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    ceo = relationship("CeoProfile", back_populates="voice_samples")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    ceo_id = Column(Integer, ForeignKey("ceo_profiles.id"))
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    ceo = relationship("CeoProfile", back_populates="messages")