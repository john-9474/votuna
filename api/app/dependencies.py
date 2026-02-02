"""FastAPI dependencies"""
from app.auth.dependencies import get_current_user
from app.db.session import get_db


# This dependency can be injected into route handlers
# Usage: def my_route(db: Session = Depends(get_db)):
__all__ = ["get_db", "get_current_user"]
