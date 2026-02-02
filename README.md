# Docker Setup Guide

This project uses Docker and Docker Compose for containerization and orchestration.

## Prerequisites

- Docker (v20.10+)
- Docker Compose (v2.0+)

## Project Structure

```
votuna/
├── docker-compose.yml      # Docker Compose configuration
├── .env                    # Environment variables
├── api/
│   ├── Dockerfile          # API service Dockerfile
│   └── .dockerignore       # Files to exclude from Docker build
└── ...
```

## Services

### PostgreSQL Database
- **Image**: postgres:16-alpine
- **Container**: votuna_postgres
- **Port**: 5432 (default, configurable via `DB_PORT`)
- **Credentials**: 
  - User: `votuna_user` (configurable via `DB_USER`)
  - Password: `votuna_password` (configurable via `DB_PASSWORD`)
  - Database: `votuna` (configurable via `DB_NAME`)
- **Volume**: `postgres_data` (persistent storage)

### API Service
- **Container**: votuna_api
- **Port**: 8000 (configurable via `API_PORT`)
- **Framework**: FastAPI + Uvicorn
- **Depends on**: PostgreSQL (waits for health check)

## Getting Started

### 1. Setup Environment

Copy the environment template and configure:

```bash
cd votuna
cp api/.env.example .env
```

The `.env` file in the root will be used by Docker Compose.

### 2. Build and Run Services

```bash
# Build images and start services
docker-compose up -d

# View logs
docker-compose logs -f

# View API logs only
docker-compose logs -f api
```

### 3. Access the Application

- **API**: http://localhost:8000
- **API Documentation (Swagger)**: http://localhost:8000/docs
- **API Documentation (ReDoc)**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## Common Commands

### Development

```bash
# Start services in foreground (see logs)
docker-compose up

# Start services in background
docker-compose up -d

# Rebuild images
docker-compose build

# Rebuild without cache
docker-compose build --no-cache

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove everything including volumes
docker-compose down -v
```

### Database

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U votuna_user -d votuna

# Create migrations
docker-compose exec api alembic revision --autogenerate -m "Description"

# Apply migrations
docker-compose exec api alembic upgrade head

# View migration history
docker-compose exec api alembic history
```

### Debugging

```bash
# View container logs
docker-compose logs api
docker-compose logs postgres

# Follow logs in real-time
docker-compose logs -f api

# Execute commands in running container
docker-compose exec api bash
docker-compose exec api python -c "import sys; print(sys.version)"

# View container status
docker-compose ps

# Inspect container
docker-compose exec api python -m pip list
```

## Environment Variables

The following variables can be configured in `.env`:

### API Configuration
- `PROJECT_NAME` - Application name (default: Votuna API)
- `DEBUG` - Debug mode (default: False)
- `API_PORT` - Port to expose API (default: 8000)

### Database Configuration
- `DB_USER` - PostgreSQL username (default: votuna_user)
- `DB_PASSWORD` - PostgreSQL password (default: votuna_password)
- `DB_NAME` - PostgreSQL database name (default: votuna)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DATABASE_URL` - Full connection string (set automatically by Docker Compose)

### SQLAlchemy
- `SQLALCHEMY_ECHO` - Enable SQL query logging (default: False)

## Troubleshooting

### PostgreSQL Connection Failed
- Ensure PostgreSQL service is healthy: `docker-compose ps`
- Wait for health check to pass (first startup takes ~10 seconds)
- Check logs: `docker-compose logs postgres`

### Port Already in Use
- Change port in `.env`: `API_PORT=8001` or `DB_PORT=5433`
- Or kill existing process: `lsof -ti:8000 | xargs kill -9`

### Database Not Persisting
- Check volume exists: `docker volume ls | grep votuna`
- Volume data is stored in Docker's data directory (platform-dependent)

### Building Takes Long
- Use `docker-compose build --no-cache` to rebuild without cache
- Ensure sufficient disk space available

## Production Considerations

Before deploying to production:

1. **Change Default Credentials**
   - Set `DB_USER` and `DB_PASSWORD` in `.env`
   - Use strong, random passwords

2. **Security**
   - Set `DEBUG=False`
   - Configure `ALLOWED_ORIGINS` for CORS
   - Use environment-specific `.env` files

3. **Database**
   - Set up automated backups for `postgres_data` volume
   - Consider managed database services (AWS RDS, etc.)

4. **Updates**
   - Keep base images updated (Python, PostgreSQL)
   - Regularly update dependencies in `requirements.txt`

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [FastAPI Docker Guide](https://fastapi.tiangolo.com/deployment/docker/)
