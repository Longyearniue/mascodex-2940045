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
```

# Frontend (`frontend/.env`)
```
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## 3. Local Development

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt  # or: poetry install
cp .env.example .env && nano .env  # set your keys
python init_db.py                 # create tables
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 4. Production Build

### 4.1 Build Frontend Assets
```bash
cd frontend
npm install --frozen-lockfile
npm run build   # output in dist/
```
The `dist/` directory can be served by any static file server or copied to an S3 bucket / CDN.

### 4.2 Run Backend With Gunicorn / Uvicorn Workers
```bash
cd backend
poetry install --no-root --no-dev  # or pip install -r requirements.txt
gunicorn -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000 main:app
```

> Consider using **systemd**, **supervisord** or **Docker** for process management.

---

## 5. Docker (optional)

```bash
# TO-DO: Add docker-compose.yml with Nginx reverse proxy and Certbot SSL.
```

---

## 6. Security Checklist

1. Keep `.env` files outside of version control.  
2. Validate file uploads (implemented in `backend/main.py`).  
3. Enable HTTPS in production.  
4. Restrict CORS origins via `FRONTEND_ORIGINS`.  
5. Configure database backups and periodic rotations.

---

## 7. Maintenance

• Run `poetry update` / `npm update` monthly.  
• Review OpenAI / ElevenLabs quota usage and costs.  
• Rotate API keys at least every 90 days.

---

## 8. Scaling & Performance

| Layer | Strategy |
|-------|----------|
| Backend | • Use **Gunicorn** with `uvicorn.workers.UvicornWorker`, e.g. `gunicorn -k uvicorn.workers.UvicornWorker -w 8 -b 0.0.0.0:8000 backend.main:app`  
• Enable HTTP/2 and keep-alive with a front Nginx / Traefik proxy  
• Add a Redis cache for conversation history if DB load grows |
| Database | • Migrate from SQLite → PostgreSQL for concurrency  
• Use connection pooling (e.g. `asyncpg`)  |
| AI API | • Batch requests when possible  
• Use streaming responses from OpenAI to reduce latency |
| Frontend | • Enable gzip / brotli compression  
• Serve static assets from a CDN |

## 9. Advanced Security Hardening

1. **Secrets management** – store API keys in AWS Secrets Manager / Vault rather than `.env` in prod.  
2. **CSP headers** – add a strict Content-Security-Policy via the reverse proxy.  
3. **Rate limiting** – protect the `/api/chat` and synthesis endpoints (e.g. Traefik plugin or FastAPI middleware).  
4. **Audit logging** – record all admin actions & file uploads.  
5. **Supply-chain scanning** – run `pip-audit` & `npm audit` in CI.  
6. **Automatic DB migrations** – introduce Alembic for schema management.
