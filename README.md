# CAREERAI-API

Standalone Vercel serverless Gemini API gateway and controller UI for the CareerAI Django backend. Host this folder separately on Vercel so your Gemini API key stays on Vercel instead of inside the Django codebase.

## Endpoints & Frontend

- `GET /`: **CAREERAI-API CONTROLLER** dashboard (`public/index.html`) showing live gateway status (`GET /api/gemini`), endpoint URL copy helper, and an interactive `POST /api/gemini` request console.
- `GET /api/gemini`: Health/configuration check (`200` when active, `503` when paused or `GEMINI_API_KEY` is missing/`null`).
- `POST /api/gemini`: Expects JSON `{"prompt": "..."}` and returns `{"ok": true, "status": "ok", "response": "..."}`.

## Environment Variables (set in Vercel Dashboard)

- `GEMINI_API_KEY` (required): Your Gemini API key.
- `GEMINI_MODEL` (optional): Defaults to `gemini-3.5-flash`.
- `SERVICE_PAUSED` (optional): Set to `true` to pause AI responses (`503` with `{"ok": false, "api": null, "status": "paused"}`).

## Deploy Separately to Vercel

### Option A — Vercel CLI (from this folder only)
```bash
cd careerai-api
npx vercel
```
After adding `GEMINI_API_KEY` in **Project Settings -> Environment Variables** on Vercel, deploy to production:
```bash
npx vercel --prod
```

### Option B — GitHub + Vercel Dashboard
1. Push only the `careerai-api` folder to its own GitHub repository (or, if pushing the whole workspace, set **Root Directory** to `careerai-api` in Vercel Project Settings).
2. Add `GEMINI_API_KEY` under **Environment Variables**.
3. Deploy.

## Connect to Django (`careerai`)

In `project/settings.py`, set:
```python
VERCEL_GEMINI_API_URL = "https://<your-vercel-domain>.vercel.app/api/gemini"
```
