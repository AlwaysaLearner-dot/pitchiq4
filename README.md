# PitchIQ v4 — AI Presentation Coach

## Why v4 is different
- **Zero CORS issues** — Vercel proxies `/api/*` to Railway internally
- **API key in Railway env only** — never in frontend, never in browser
- **No VITE_API_URL needed** — Vercel handles routing automatically

---

## Deploy Steps

### Step 1 — Deploy Backend on Railway

1. Push this repo to GitHub
2. Railway → New Project → Deploy from GitHub → select repo
3. Set **Root Directory = `backend`**
4. Go to **Variables** → Add:
   ```
   GEMINI_API_KEY = AIzaSy_your_key_here
   ```
5. Settings → Networking → **Generate Domain**
6. Copy your Railway URL: `https://pitchiq4-production.up.railway.app`
7. **Test it:** Open `https://pitchiq4-production.up.railway.app/health` in browser
   - Should show: `{"status":"ok"}`

### Step 2 — Update vercel.json with your Railway URL

Open `frontend/vercel.json` and replace the Railway URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-RAILWAY-URL.up.railway.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Commit and push this change.

### Step 3 — Deploy Frontend on Vercel

1. Vercel → New Project → Import repo
2. Set **Root Directory = `frontend`**
3. Framework: **Vite**
4. **No environment variables needed** ✅
5. Deploy!

### Step 4 — Done!

Open your Vercel URL in **Chrome** and start presenting.

---

## Local Development

```bash
# Terminal 1 — Backend
cd backend
npm install
# Create .env:  GEMINI_API_KEY=your_key_here
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## How the proxy works (no CORS explanation)

```
Browser (Vercel) → POST /api/upload
       ↓
Vercel sees /api/* → rewrites to Railway URL
       ↓
Railway receives request (same-origin from browser's perspective)
       ↓
No CORS header needed — ever
```

---

## Environment Variables

| Where | Variable | Value |
|-------|----------|-------|
| Railway | `GEMINI_API_KEY` | Your Gemini API key |
| Vercel | *(none needed)* | — |
