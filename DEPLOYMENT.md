# AI CEO Clone – Deployment Guide

This document describes how to deploy the full-stack application (FastAPI + React) to production or local environments.

---

## 1. Prerequisites

• **Python 3.9+** – backend runtime  
• **Node.js 16+** – frontend build  
• **Poetry** *or* `pip` – Python dependency management  
• **npm / yarn / pnpm** – JS dependency management  

> ℹ️ Docker Compose manifests will be added in a future version.

---

## 2. Environment Variables

### Backend (`backend/.env`)
```
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4          # (optional) override default model
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=Rachel        # (optional) ElevenLabs voice ID
DATABASE_URL=sqlite:///./ai_clone.db
UPLOAD_DIR=uploads                # (optional) where files are stored
FRONTEND_ORIGINS=http://localhost:5173  # comma-separated list for CORS
RATE_LIMIT=60                   # requests per minute per IP
RATE_LIMIT_WINDOW=60          # time window seconds for rate limit
```

# Frontend (`frontend/.env`)
```