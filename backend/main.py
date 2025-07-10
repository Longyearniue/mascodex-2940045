from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import os
import shutil
from typing import List
from dotenv import load_dotenv
import openai
import time
from starlette.requests import Request
from starlette.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

from .database import get_db, Base, engine
from . import models, schemas

load_dotenv()

# Ensure tables exist if not using init_db separately
Base.metadata.create_all(bind=engine)

openai.api_key = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")

# ElevenLabs
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "Rachel")

app = FastAPI(title="AI CEO Clone API", version="0.1.0")

# ---------------------------------------------
# CORS configuration
# ---------------------------------------------
frontend_origins_env = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173")
allow_origins = [origin.strip() for origin in frontend_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
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
# Security headers middleware
# ---------------------------------------------


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Basic CSP allowing APIs and self static. Adjust for production as needed.
        response.headers["Content-Security-Policy"] = "default-src 'self'; connect-src *; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        # HSTS – enabled only if HTTPS is used. Comment out during local dev without TLS
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response


# ---------------------------------------------
# Simple in-memory IP rate limiting
# ---------------------------------------------


RATE_LIMIT = int(os.getenv("RATE_LIMIT", "60"))  # requests per window per IP
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # seconds
_ip_buckets: dict[str, list[float]] = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "anonymous"
        now = time.time()
        window_start = now - RATE_LIMIT_WINDOW

        bucket = _ip_buckets.setdefault(client_ip, [])
        # prune old timestamps
        while bucket and bucket[0] < window_start:
            bucket.pop(0)

        if len(bucket) >= RATE_LIMIT:
            return Response(
                content="Rate limit exceeded",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        bucket.append(now)
        return await call_next(request)


# Register middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

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
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
    except Exception as e:
        # Cleanup partial file if exists
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
    return file_path


# Allowed file extensions
DOC_ALLOWED_EXTS = {".pdf", ".docx", ".txt"}
VOICE_ALLOWED_EXTS = {".mp3", ".wav"}
DOC_ALLOWED_MIMES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
VOICE_ALLOWED_MIMES = {"audio/mpeg", "audio/wav"}


def _validate_upload(file: UploadFile, allowed_exts: set[str], allowed_mimes: set[str]):
    # extension check
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext}")

    # mime check
    if file.content_type not in allowed_mimes:
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")

    # optional: size limit via header
    size_header = file.headers.get("content-length")
    max_size_mb = 10
    if size_header and int(size_header) > max_size_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (limit 10 MB)")


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

    _validate_upload(file, DOC_ALLOWED_EXTS, DOC_ALLOWED_MIMES)

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

    _validate_upload(file, VOICE_ALLOWED_EXTS, VOICE_ALLOWED_MIMES)

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
            model=OPENAI_MODEL,
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


# ---------------------------------------------
# ElevenLabs Voice Synthesis
# ---------------------------------------------


@app.post("/api/ceos/{ceo_id}/synthesize_voice")
def synthesize_voice(ceo_id: int, payload: schemas.ChatRequest):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    data = {
        "text": payload.message,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    import requests
    try:
        resp = requests.post(url, headers=headers, json=data, stream=True, timeout=60)
    except requests.RequestException as exc:
        raise HTTPException(status_code=500, detail=f"ElevenLabs network error: {exc}")

    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"ElevenLabs error: {resp.text}")

    def iter_audio():
        try:
            for chunk in resp.iter_content(chunk_size=1024):
                if chunk:
                    yield chunk
        finally:
            resp.close()

    return StreamingResponse(
        iter_audio(),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=voice.mp3"},
    )