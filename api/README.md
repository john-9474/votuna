# FastAPI Backend Template

A production-ready FastAPI backend template for the Votuna project.

## Project Structure

```
api/
+-- main.py                 # Application entry point
+-- requirements.txt        # Python dependencies
+-- .env.example            # Environment variables template
+-- alembic/                # Migrations
+-- app/
    +-- __init__.py
    +-- api/
    |   +-- __init__.py
    |   +-- v1/
    |       +-- __init__.py
    |       +-- router.py   # API router
    |       +-- routes/     # Route modules
    +-- config/
    |   +-- __init__.py
    |   +-- settings.py     # Configuration and settings
    +-- crud/               # CRUD helpers
    +-- db/
    |   +-- session.py      # DB session / Base
    +-- models/             # SQLAlchemy models
    +-- schemas/            # Pydantic schemas
```

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update values as needed:

```bash
cp .env.example .env
```

For Spotify auth, set:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `AUTH_SECRET_KEY`

### 3. Run the Application

```bash
python main.py
```

Or use uvicorn directly:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

## Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Auth (v1)
- `GET /api/v1/auth/login` - Start Spotify SSO login
- `GET /api/v1/auth/callback` - Spotify OAuth callback
- `POST /api/v1/auth/logout` - Clear auth cookie

### Users (v1)
- `GET /api/v1/users/me` - Current user profile
- `GET /api/v1/users/me/settings` - Current user settings
- `PUT /api/v1/users/me/settings` - Update settings

## Features

- [x] FastAPI framework with async support
- [x] CORS middleware for frontend integration
- [x] Pydantic models for data validation
- [x] Environment configuration management
- [x] Application lifecycle management
- [x] Organized modular structure
- [x] API versioning (v1)
- [x] Auto-generated API documentation

## Development

To add new endpoints:

1. Add route handlers in `app/api/v1/routes.py`
2. Create Pydantic models in `app/schemas` (if needed)
3. Import and include routers in `main.py`

## Testing

Run the unit tests with:

```bash
pytest
```

## Production Deployment

For production, use a production-grade ASGI server:

```bash
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```
