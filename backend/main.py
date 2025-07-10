from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
import shutil
from typing import List
from dotenv import load_dotenv
import openai

from .database import get_db, Base, engine
from . import models, schemas

load_dotenv()

# Ensure tables exist if not using init_db separately
Base.metadata.create_all(bind=engine)

openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="AI CEO Clone API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
DOC_DIR = os.path.join(UPLOAD_DIR, "documents")
VOICE_DIR = os.path.join(UPLOAD_DIR, "voices")

os.makedirs(DOC_DIR, exist_ok=True)
os.makedirs(VOICE_DIR, exist_ok=True)

# ---------------------------------------------
# CEO Profiles
# ---------------------------------------------


@app.post("/api/ceos", response_model=schemas.CeoProfileOut, status_code=status.HTTP_201_CREATED)
def create_ceo(ceo: schemas.CeoProfileCreate, db: Session = Depends(get_db)):
    db_ceo = models.CeoProfile(**ceo.dict())
    db.add(db_ceo)
    db.commit()
    db.refresh(db_ceo)
    return db_ceo


@app.get("/api/ceos", response_model=List[schemas.CeoProfileOut])
def list_ceos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.CeoProfile).offset(skip).limit(limit).all()


@app.get("/api/ceos/{ceo_id}", response_model=schemas.CeoProfileOut)
def get_ceo(ceo_id: int, db: Session = Depends(get_db)):
    ceo = db.query(models.CeoProfile).filter(models.CeoProfile.id == ceo_id).first()
    if not ceo:
        raise HTTPException(status_code=404, detail="CEO not found")
    return ceo


@app.put("/api/ceos/{ceo_id}", response_model=schemas.CeoProfileOut)
def update_ceo(ceo_id: int, payload: schemas.CeoProfileUpdate, db: Session = Depends(get_db)):
    ceo = db.query(models.CeoProfile).filter(models.CeoProfile.id == ceo_id).first()
    if not ceo:
        raise HTTPException(status_code=404, detail="CEO not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(ceo, k, v)
    db.commit()
    db.refresh(ceo)
    return ceo


@app.delete("/api/ceos/{ceo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ceo(ceo_id: int, db: Session = Depends(get_db)):
    ceo = db.query(models.CeoProfile).filter(models.CeoProfile.id == ceo_id).first()
    if not ceo:
        raise HTTPException(status_code=404, detail="CEO not found")
    db.delete(ceo)
    db.commit()
    return None


# ---------------------------------------------
# File Uploads
# ---------------------------------------------


def _save_upload(ceo_id: int, upload_file: UploadFile, base_dir: str):
    ceo_dir = os.path.join(base_dir, f"ceo_{ceo_id}")
    os.makedirs(ceo_dir, exist_ok=True)
    file_path = os.path.join(ceo_dir, upload_file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return file_path


@app.post("/api/ceos/{ceo_id}/documents", response_model=schemas.DocumentOut)
def upload_document(
    ceo_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Verify CEO exists
    ceo = db.query(models.CeoProfile).filter(models.CeoProfile.id == ceo_id).first()
    if not ceo:
        raise HTTPException(status_code=404, detail="CEO not found")

    path = _save_upload(ceo_id, file, DOC_DIR)
    doc = models.Document(ceo_id=ceo_id, filename=file.filename, filepath=path)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@app.post("/api/ceos/{ceo_id}/voice_samples", response_model=schemas.VoiceSampleOut)
def upload_voice(
    ceo_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ceo = db.query(models.CeoProfile).filter(models.CeoProfile.id == ceo_id).first()
    if not ceo:
        raise HTTPException(status_code=404, detail="CEO not found")

    path = _save_upload(ceo_id, file, VOICE_DIR)
    voice = models.VoiceSample(ceo_id=ceo_id, filename=file.filename, filepath=path)
    db.add(voice)
    db.commit()
    db.refresh(voice)
    return voice


# ---------------------------------------------
# Chat Endpoint
# ---------------------------------------------


@app.post("/api/chat/{ceo_id}", response_model=schemas.ChatResponse)
def chat(ceo_id: int, payload: schemas.ChatRequest, db: Session = Depends(get_db)):
    ceo = db.query(models.CeoProfile).filter(models.CeoProfile.id == ceo_id).first()
    if not ceo:
        raise HTTPException(status_code=404, detail="CEO not found")

    user_message = models.Message(ceo_id=ceo_id, role="user", content=payload.message)
    db.add(user_message)
    db.commit()

    # Basic prompt that includes CEO description
    system_prompt = (
        f"You are impersonating {ceo.name}, the CEO. Here is their description: {ceo.description or ''}"
    )

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",  # adjust model as needed
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": payload.message},
            ],
        )
        reply_content = response.choices[0].message["content"].strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {e}")

    assistant_message = models.Message(ceo_id=ceo_id, role="assistant", content=reply_content)
    db.add(assistant_message)
    db.commit()

    return {"reply": reply_content}