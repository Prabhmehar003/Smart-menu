# smart-menu-project

A smart restaurant menu system with two implementation tracks.

- `backend/` + `frontend/`: original FastAPI + React/Vite application
- `v2/`: second version with an enhanced backend, SQLite persistence, and updated React admin dashboard

## Repository structure

- `backend/` - Python FastAPI service for menu processing, QR verification, and order placement.
- `frontend/` - React + Vite user interface for the original version.
- `v2/backend/` - Python FastAPI service with SQLite persistence and expanded settings.
- `v2/frontend/` - React + Vite admin/customer UI for the v2 version.

## Prerequisites

- Python 3.11+ (recommended)
- Node.js 18+ and npm
- Optional: `git` to clone the repository

## Environment variables

Copy or create a local `.env` file and set the values needed for your backend.

Common variables:

- `GROQ_API_KEY` - Groq API key for menu extraction
- `GROQ_MODEL` - Groq model name
- `UNSPLASH_ACCESS_KEY` - optional Unsplash key for dish image lookup
- `ACID_SECRET_KEY` - JWT secret for token issuance and verification

## Running the original version

### Backend

```bash
python3 -m pip install fastapi uvicorn httpx PyJWT python-dotenv groq
python3 -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Running version 2

### Backend

```bash
cd v2/backend
python3 -m pip install fastapi uvicorn httpx PyJWT python-dotenv groq
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd v2/frontend
npm install
npm run dev
```

## Notes

- The `frontend/README.md` and `v2/frontend/README.md` files are default Vite template READMEs.
- The `dist/` folders contain generated build artifacts and are not required for local development.
- `v2/backend/db.py` initializes the SQLite database on startup.
```