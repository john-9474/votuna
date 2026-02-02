import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://user:pass@localhost:5432/test_db",
)

from app.db.session import Base, get_db
from main import app

TEST_DATABASE_URL = "sqlite+pysqlite:///:memory:"


def _create_test_engine():
    """Create an in-memory SQLite engine for tests."""
    return create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )


@pytest.fixture(scope="session")
def test_engine():
    """Provide a session-scoped SQLAlchemy engine with tables created."""
    engine = _create_test_engine()
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture()
def db_session(test_engine):
    """Provide a database session bound to the test engine."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    """Provide a TestClient with the DB dependency overridden."""
    def _override_get_db():
        """Yield the test session for dependency overrides."""
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
