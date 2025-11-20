import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Synchronous database URL for Celery workers
DATABASE_URL_SYNC = os.getenv(
    "DATABASE_URL_SYNC",
    "postgresql+psycopg2://postgres:postgres@localhost:5433/products_db"
)

# Create synchronous engine for Celery workers
engine_sync = create_engine(
    DATABASE_URL_SYNC,
    echo=False,  # Set to True for debugging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,  # Recycle connections after 1 hour
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine_sync
)

# Base for models (should match the async Base)
Base = declarative_base()


def get_sync_db():
    """Get a synchronous database session."""
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()
