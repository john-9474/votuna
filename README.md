# Votuna

Votuna is an open source collaborative playlist voting app.

It currently supports SoundCloud-based playlist workflows end-to-end (auth, playlist enablement, suggestions, voting, and profile management) with a FastAPI backend and Next.js frontend.

## Current Feature Status

### Implemented
- SoundCloud OAuth login with cookie-based sessions
- Dashboard to:
  - List provider playlists
  - Create a new SoundCloud playlist (public/private)
  - Enable existing SoundCloud playlists for Votuna
- Playlist detail experience:
  - Search SoundCloud tracks from within the playlist page
  - Suggest tracks from search results or by pasting a track URL
  - Vote on suggestions with voter display names in tooltip
  - Play tracks in a persistent "Now Playing" dock
  - Configure playlist vote settings (required vote percent, auto-add toggle)
  - View collaborator roles and suggestion counts
- Profile page:
  - Edit display name, first name, last name, and email
  - Upload avatar
  - Save theme and email preference settings
- API docs at `/docs` and `/redoc`

### Planned / In Progress
- More music providers:
  - Spotify login and playlist import
  - Apple Music login and playlist import
  - TIDAL login and playlist import
  - Cross-provider playlist links and metadata sync
- Playlist management tools:
  - Bulk edit track ordering and suggestion status
  - Merge playlists with duplicate and conflict handling
  - Bulk archive, restore, or remove suggestions
  - Tagging and filters for large suggestion queues
- Collaboration and automation:
  - Role-based moderation actions for collaborators
  - Duplicate detection and quality rules
  - Playlist activity feed and vote history export
  - Webhook events for bots and external workflows

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- Frontend: Next.js 14, React 18, TanStack Query, Tailwind, Tremor UI
- Dev infra: Docker Compose

## Repository Layout

```text
votuna/
  api/                FastAPI app, models, migrations, tests
  frontend/           Next.js app
  docker-compose.yml  Local multi-service orchestration
  .env.example        Root environment template
```

## Quick Start (Docker)

### 1. Create env file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 2. Configure required values in `.env`

At minimum set:
- `SOUNDCLOUD_CLIENT_ID`
- `SOUNDCLOUD_CLIENT_SECRET`
- `SOUNDCLOUD_REDIRECT_URI` (default is fine for local)
- `AUTH_SECRET_KEY` (replace `change-me`)

Optional but common:
- `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)
- `FRONTEND_URL` (default `http://localhost:3000`)

### 3. Start the stack

```bash
docker compose up --build
```

### 4. Open the apps

- Frontend: http://localhost:3000
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/health

## Local Development (without full Docker stack)

### Option A: Run DB in Docker, run API + frontend locally

Start PostgreSQL only:

```bash
docker compose up -d postgres
```

Run API:

```bash
cd api
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell
# .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python main.py
```

Run frontend in another shell:

```bash
cd frontend
npm install
npm run dev
```

If needed, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Migrations

From `api/`:

```bash
alembic revision --autogenerate -m "describe_change"
alembic upgrade head
alembic history
```

## Quality Checks

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend:

```bash
cd api
pytest -q
```

Docker test profile:

```bash
docker compose --profile test up --build api_tests
```

## Core API Route Groups

- `/api/v1/auth/*` - OAuth login/callback/logout
- `/api/v1/users/*` - current user profile, settings, avatar
- `/api/v1/playlists/*` - provider playlist listing/creation
- `/api/v1/votuna/*` - Votuna playlists, settings, suggestions, votes, members, invites

## Notes

- Root `.env` is used by both Docker Compose and backend settings loading.
- In local development, ensure `ALLOWED_ORIGINS` includes your frontend host.
- SoundCloud is the active provider today; Spotify, Apple Music, and TIDAL are planned.
