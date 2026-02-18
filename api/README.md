# Votuna API

FastAPI backend for Votuna's collaborative playlist workflows.

## Current Scope

- OAuth login/callback + session cookie auth (`apple`, `spotify`, `soundcloud`, `tidal`)
- Provider playlist listing and creation APIs
- Votuna playlist enablement and settings
- Suggestions and voting with collaborator/member support
- Recommendation endpoint with short-lived caching and dedupe/ranking
- Playlist management transfer endpoints (import/export with preview and execute)

Runtime provider client support includes **Spotify**, **SoundCloud**, **Apple Music**, and **TIDAL** (`get_music_provider`).
Frontend currently exposes login buttons for Spotify, SoundCloud, and TIDAL; Apple login is intentionally disabled in UI for now.

## Playlist Management (Implemented)

Owner-only transfer workflows are available under `/api/v1/votuna/playlists/{playlist_id}/management/*`:

- `POST /source-tracks`
  - Browse source tracks for song-level selection
  - Search by title/artist/genre
  - Offset/limit pagination
- `POST /preview`
  - Non-mutating transfer preview
  - Supports `all`, `genre`, `artist`, `songs` filters
  - Reports matched/to-add/duplicate counts
  - Enforces max 500 tracks per action
- `POST /execute`
  - Runs the transfer with duplicate skip behavior
  - Optional destination playlist creation on export
  - Best-effort add with per-track fallback on chunk failure
  - Returns added/skipped/failed summary

## Recommendations (Implemented)

Recommendation workflows are available under `/api/v1/votuna/playlists/{playlist_id}/tracks/recommendations*`:

- `GET /tracks/recommendations`
  - Pulls related tracks from provider APIs using playlist tracks as seeds
  - Applies dedupe, per-artist caps, declined-track filtering, and offset/limit paging
  - Uses in-memory cache + in-flight request coalescing to reduce repeated provider calls
- `POST /tracks/recommendations/decline`
  - Stores user-level declines so rejected recommendations stay filtered

Current provider behavior:
- Enabled: SoundCloud, TIDAL
- Returns empty list by design: Spotify, Apple Music

## Project Layout

```text
api/
  main.py
  requirements.txt
  app/
    api/v1/routes/
    auth/
    config/
    crud/
    db/
    models/
    schemas/
    services/
  alembic/
  tests/
```

## Local Setup

### 1. Install dependencies

```bash
cd api
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell
# .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure environment

Use the repository root `.env.example` and create `.env` at repo root.

Required values:

- `DATABASE_URL`
- `AUTH_SECRET_KEY`
- At least one provider OAuth set:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
  - `SPOTIFY_REDIRECT_URI`
  - `SOUNDCLOUD_CLIENT_ID`
  - `SOUNDCLOUD_CLIENT_SECRET`
  - `SOUNDCLOUD_REDIRECT_URI`
  - `TIDAL_CLIENT_ID`
  - `TIDAL_CLIENT_SECRET`
  - `TIDAL_REDIRECT_URI`
- Optional overrides/settings:
  - `SPOTIFY_API_BASE_URL`, `SPOTIFY_TOKEN_URL`
  - `SOUNDCLOUD_API_BASE_URL`, `SOUNDCLOUD_TOKEN_URL`
  - `TIDAL_API_BASE_URL`, `TIDAL_TOKEN_URL`, `TIDAL_COUNTRY_CODE`
  - `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_REDIRECT_URI`
  - `APPLE_MUSIC_TEAM_ID`, `APPLE_MUSIC_KEY_ID`, `APPLE_MUSIC_PRIVATE_KEY`
  - `APPLE_MUSIC_DEVELOPER_TOKEN`, `APPLE_MUSIC_STOREFRONT`

### 3. Run migrations

```bash
cd api
alembic upgrade head
```

### 4. Start API

```bash
cd api
python main.py
```

or

```bash
cd api
uvicorn main:app --reload
```

## Docs and Health

- API root: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health: `http://localhost:8000/health`

## Route Groups

- `/api/v1/auth/*` - login/callback/logout
- `/api/v1/users/*` - profile, settings, avatars
- `/api/v1/playlists/*` - provider playlist list/create
- `/api/v1/votuna/*` - Votuna playlists, settings, tracks, suggestions, votes, members, invites, management

## Tests

```bash
cd api
python -m ruff check main.py app tests
python -m black --check main.py app tests
pytest -q
```

## CI/CD automation

- Pull requests and pushes to `main` run backend and frontend quality checks in GitHub Actions.
- Release deploys run from published GitHub Releases (non-prerelease) and deploy to Railway using service-specific project/environment IDs from repository secrets.
- Railway push-triggered auto-deploy should be disabled for `api` and `frontend` so production deploys are release-driven.
