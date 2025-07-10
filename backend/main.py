from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from config import settings
from database import init_db
from routers import users, ceo_profiles, documents, interviews, chat

# Create FastAPI app
app = FastAPI(
    title="AI CEO Clone Interface",
    description="AI-powered CEO clone system with voice and personality replication",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directories
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(os.path.join(settings.upload_dir, "documents"), exist_ok=True)
os.makedirs(os.path.join(settings.upload_dir, "voice_samples"), exist_ok=True)
os.makedirs(os.path.join(settings.upload_dir, "voices"), exist_ok=True)

# Mount static files for uploaded content
app.mount("/api/files", StaticFiles(directory=settings.upload_dir), name="files")

# Include routers
app.include_router(users.router, prefix="/api")
app.include_router(ceo_profiles.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI CEO Clone Interface API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)