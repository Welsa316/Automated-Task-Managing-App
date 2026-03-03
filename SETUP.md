# Canvas Flow — Setup Guide

> A personal academic task manager with Canvas LMS integration, workload heatmaps, energy-based task surfacing, and behavioral analytics.

## Architecture

**Option B — Private backend with local deployment**

- **Backend:** Node.js + Express + SQLite (zero-config, single file DB)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Mac App:** Electron wrapper
- **iPhone:** Safari PWA (Add to Home Screen)
- **Sync:** Both devices talk to the same backend on your Mac

## Prerequisites

```bash
node --version   # Need v18+
npm --version    # Comes with Node
```

If not installed: `brew install node`

## Day 1 Setup

### 1. Install Dependencies

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
| Variable | Value |
|----------|-------|
| `CANVAS_BASE_URL` | `https://your-school.instructure.com` |
| `CANVAS_TOKEN` | Your Canvas personal access token |
| `API_SECRET` | Run `openssl rand -hex 32` |
| `PORT` | `3001` |

### 3. Get Your Canvas Token

1. Log into Canvas → click profile → **Settings**
2. Scroll to **"Approved Integrations"** → **"+ New Access Token"**
3. Purpose: `Canvas Flow` → **Generate Token**
4. Copy immediately (can't see it again!) → paste into `.env`

### 4. Run (Development)

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**

### 5. First Use

1. Go to **Settings** → enter your API_SECRET under "API Key" → Save
2. Enter Canvas URL + token → **Connect**
3. Click **Sync Now**
4. Go to **Today** — your tasks appear!

### 6. iPhone Access

```bash
# Find your Mac's IP
ipconfig getifaddr en0
```

On iPhone (same WiFi): open Safari → `http://YOUR_MAC_IP:5173` → Share → **Add to Home Screen**

## Production Build

```bash
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
cd backend && npm start
```

Access from any device at `http://YOUR_MAC_IP:3001`

## Mac Desktop App (Electron)

```bash
cd electron && npm install
cd .. && cd backend && npm run build && cd .. && cd frontend && npm run build && cd ..
cd electron && npm start
```

## Data Model

```
courses → assignments → tasks → sessions
                          ↓
                   energy_profiles
                   behavior_patterns
                   weekly_metrics
```

- **Tasks** have priority, energy level, estimated/actual minutes
- **Sessions** track work time with energy before/after and focus rating
- **Energy profiles** learn your patterns (168 hourly slots per week)
- **Behavior patterns** detect procrastination by course/type
- **Reality Score** = how realistic your plans are
- **Smooth Week** = probability of completing everything this week
- **Momentum** = 7-day rolling productivity score

## Token Storage

Canvas tokens stored in SQLite `app_settings` table. API protected by `API_SECRET` bearer token. For single-user local deployment, this is secure.

## Canvas OAuth2 (Advanced)

For full OAuth2 instead of personal tokens:
1. Canvas Admin → Developer Keys → + API Key
2. Set redirect URI: `http://localhost:3001/api/auth/canvas/callback`
3. Add `CANVAS_CLIENT_ID` and `CANVAS_CLIENT_SECRET` to `.env`

Personal access tokens are recommended for single-user apps.
