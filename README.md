# Votuna

Votuna is an open source collaborative playlist voting app.

Current provider status:
- Frontend login: Spotify, SoundCloud, Apple Music, and TIDAL
- Backend auth/provider clients: Spotify, SoundCloud, Apple Music, and TIDAL

## Current Feature Status

### Implemented
- Spotify, SoundCloud, Apple Music, and TIDAL OAuth login with cookie-based sessions
- Apple Music OAuth + provider client integration in backend
- Provider clients for Spotify, SoundCloud, Apple Music, and TIDAL (playlist + track APIs; TIDAL refresh token handling)
- Dashboard to:
  - List provider playlists
  - Create a new provider playlist (public/private)
  - Enable existing provider playlists for Votuna
- Playlist detail experience:
  - Search provider tracks from within the playlist page
  - Suggest tracks from search results or by pasting a track URL
  - Vote on suggestions with voter display names in tooltip
  - Play tracks in a persistent "Now Playing" dock
  - Configure playlist vote settings (required vote percent, auto-add toggle)
  - View collaborator roles and suggestion counts
  - Track recommendations for supported providers (currently SoundCloud and TIDAL)
  - Manage tab (owner-only):
    - Import another playlist into the current playlist
    - Export the current playlist into an existing playlist or a newly created playlist
    - Filter transfers by `all`, `genre`, `artist`, or selected `songs`
    - Preview transfer results before execute (matched, to-add, duplicates)
    - Execute with duplicate skip behavior and failure summary
    - Source-track picker with search and pagination for song selection
- Profile page:
  - Edit display name, first name, last name, and email
  - Upload avatar
  - Save theme and email preference settings
- API docs at `/docs` and `/redoc`

### Planned / In Progress
- Provider polish:
  - Continue hardening Apple Music login and callback UX
  - Broaden recommendation support where provider APIs are reliable
  - Cross-provider playlist links and metadata sync
- Playlist management tools:
  - Bulk remove selected tracks from a playlist
  - Duplicate cleanup utility inside a playlist
  - Reorder tools (manual drag/drop + auto-sort presets)
  - Operation history, undo checkpoints, and replay options
- Collaboration and automation:
  - Role-based moderation actions for collaborators
  - Duplicate detection and quality rules
  - Playlist activity feed and vote history export
  - Webhook events for bots and external workflows

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- Frontend: Next.js 15, React 18, TanStack Query, Tailwind, Tremor UI
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
- `AUTH_SECRET_KEY` (replace `change-me`)
- At least one provider OAuth set:
  - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
  - `SOUNDCLOUD_CLIENT_ID`, `SOUNDCLOUD_CLIENT_SECRET`, `SOUNDCLOUD_REDIRECT_URI`
  - `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_REDIRECT_URI`
  - `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`, `TIDAL_REDIRECT_URI`
- Optional provider settings:
  - `APPLE_MUSIC_TEAM_ID`, `APPLE_MUSIC_KEY_ID`, `APPLE_MUSIC_PRIVATE_KEY`
  - `APPLE_MUSIC_DEVELOPER_TOKEN` (or signing key settings above), `APPLE_MUSIC_STOREFRONT`
  - `TIDAL_COUNTRY_CODE`

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

### Apple local auth with fixed ngrok domain

Apple Sign In callbacks must be HTTPS and cannot use `localhost`. For low-friction local testing:

1. Reserve an ngrok domain and register it in Apple Developer as:
   - `https://<reserved-ngrok-domain>/api/v1/auth/callback/apple`
2. Set these values once in root `.env`:
   - `APPLE_REDIRECT_URI=https://<reserved-ngrok-domain>/api/v1/auth/callback/apple`
   - `NEXT_PUBLIC_API_URL=https://<reserved-ngrok-domain>`
   - `AUTH_COOKIE_SECURE=True`
   - `AUTH_COOKIE_SAMESITE=none`
   - Keep `FRONTEND_URL=http://localhost:3000`
   - Keep `ALLOWED_ORIGINS` including `http://localhost:3000`
3. Generate `APPLE_CLIENT_SECRET` once and store it in `.env` (rotate before expiry).
4. Start ngrok locally against the API port:

```bash
ngrok config add-authtoken <token>
ngrok http --domain=<reserved-ngrok-domain> 8000
```

Generate/update `APPLE_CLIENT_SECRET` with the helper script:

```bash
python scripts/generate_apple_tokens.py \
  --token-type client-secret \
  --team-id <apple-team-id> \
  --key-id <apple-signin-key-id> \
  --client-id <apple-client-id> \
  --private-key-path <path-to-AuthKey_XXXXXX.p8> \
  --write-env
```

Generate/update `APPLE_MUSIC_DEVELOPER_TOKEN` with the same helper script:

```bash
python scripts/generate_apple_tokens.py \
  --token-type music-developer \
  --team-id <apple-team-id> \
  --key-id <apple-musickit-key-id> \
  --private-key-path <path-to-AuthKey_XXXXXX.p8> \
  --write-env
```

Notes:
- `--client-id` is used as JWT `sub` and must match your Apple OAuth `client_id` (usually Services ID for web flows).
- `--app-id` can be supplied as an alias; if `--client-id` is omitted the script uses `--app-id`.
- The script enforces Apple's max client-secret lifetime and prints expiry in UTC.

## Deploy to Railway

### Architecture

- `postgres`: Railway PostgreSQL service
- `api`: public FastAPI service (root directory: `api`, config: `api/railway.toml`)
- `frontend`: public Next.js service (root directory: `frontend`, config: `frontend/railway.toml`)

### Release-only deployment policy

Production deploys are handled by GitHub Actions from published GitHub Releases (non-prerelease).

1. Disable automatic deploys from GitHub pushes in Railway for both `api` and `frontend`.
2. Keep Railway connected to the repo for build context, but do not allow push-triggered deploys.
3. Deploy production by publishing a GitHub Release.

Required GitHub repository secrets for release deploys:

- `RAILWAY_TOKEN`
- `RAILWAY_API_PROJECT_ID`
- `RAILWAY_API_ENVIRONMENT_ID`
- `RAILWAY_API_SERVICE_ID`
- `RAILWAY_FRONTEND_PROJECT_ID`
- `RAILWAY_FRONTEND_ENVIRONMENT_ID`
- `RAILWAY_FRONTEND_SERVICE_ID`

If API and frontend share the same Railway project/environment, set both API and frontend project/environment secrets to the same values.

### 1. Create services

1. Create a Railway project.
2. Add `Postgres` from Railway templates.
3. Add `api` service from this repo with root directory `api`.
4. Add `frontend` service from this repo with root directory `frontend`.
   - Do not prefix these with `/` in Railway. Use `api` and `frontend`, not `/api` or `/frontend`.

### 2. Configure API variables

Set these in Railway for the `api` service:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `AUTH_SECRET_KEY=<strong-random-value>`
- `AUTH_COOKIE_SECURE=True`
- `AUTH_COOKIE_SAMESITE=lax` (or `none` for true cross-site deployments)
- `FRONTEND_URL=https://<frontend-domain>.up.railway.app`
- `ALLOWED_ORIGINS=["https://<frontend-domain>.up.railway.app"]`
- `SPOTIFY_CLIENT_ID=<spotify-client-id>`
- `SPOTIFY_CLIENT_SECRET=<spotify-client-secret>`
- `SPOTIFY_REDIRECT_URI=https://<api-domain>.up.railway.app/api/v1/auth/callback/spotify`
- `SOUNDCLOUD_CLIENT_ID=<soundcloud-client-id>`
- `SOUNDCLOUD_CLIENT_SECRET=<soundcloud-client-secret>`
- `SOUNDCLOUD_REDIRECT_URI=https://<api-domain>.up.railway.app/api/v1/auth/callback/soundcloud`
- `APPLE_CLIENT_ID=<apple-client-id>`
- `APPLE_CLIENT_SECRET=<apple-client-secret>`
- `APPLE_REDIRECT_URI=https://<api-domain>.up.railway.app/api/v1/auth/callback/apple`
- `APPLE_MUSIC_TEAM_ID=<apple-team-id>`
- `APPLE_MUSIC_KEY_ID=<apple-key-id>`
- `APPLE_MUSIC_PRIVATE_KEY=<apple-private-key>`
- `TIDAL_CLIENT_ID=<tidal-client-id>`
- `TIDAL_CLIENT_SECRET=<tidal-client-secret>`
- `TIDAL_REDIRECT_URI=https://<api-domain>.up.railway.app/api/v1/auth/callback/tidal`
- `USER_FILES_DIR=/app/user_files`
- `RAILWAY_RUN_UID=0`

### 3. Configure frontend variables

Set these in Railway for the `frontend` service:

- `NEXT_PUBLIC_API_URL=https://<api-domain>.up.railway.app`

`NEXT_PUBLIC_API_URL` is required at build time in production image builds.

### 4. Attach persistent volume for avatars

Attach a volume to the `api` service and mount it at:

- `/app/user_files`

This keeps uploaded avatar files across deploys.

### 5. Deploy sequence

1. Deploy `api` and generate its public domain.
2. Set `NEXT_PUBLIC_API_URL` in `frontend` to the API domain.
3. Deploy `frontend` and generate its public domain.
4. Update API `FRONTEND_URL` and `ALLOWED_ORIGINS` with the frontend domain and redeploy `api`.
5. In Spotify developer settings, set callback URL to:
   - `<url>/api/v1/auth/callback/spotify`
6. In SoundCloud developer settings, set callback URL to:
   - `<url>/api/v1/auth/callback/soundcloud`
7. In Apple developer settings, set callback URL to:
   - `<url>/api/v1/auth/callback/apple`
8. In TIDAL developer settings, set callback URL to:
   - `<url>/api/v1/auth/callback/tidal`
9. Ensure provider redirect URIs match exactly, then redeploy `api`.
10. After bootstrap, use GitHub Releases for production deploys:
   - Publish a non-prerelease GitHub Release.
   - GitHub Actions runs quality checks, then deploys both Railway services.

### 6. Smoke test checklist

- API health: `GET /health` returns healthy.
- Frontend loads and can fetch authenticated user state.
- Spotify/SoundCloud/Apple Music/TIDAL login redirects back to app and sets auth cookie.
- Playlist listing/details load.
- Suggest/add/vote flows work.
- Upload avatar, redeploy API, verify avatar still exists.

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
python -m ruff check main.py app tests
python -m black --check main.py app tests
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
- `/api/v1/votuna/*` - Votuna playlists, settings, suggestions, votes, members, invites, management transfer endpoints

## Notes

- Root `.env` is used by both Docker Compose and backend settings loading.
- In local development, ensure `ALLOWED_ORIGINS` includes your frontend host.
- Frontend login buttons expose Spotify, SoundCloud, Apple Music, and TIDAL.
