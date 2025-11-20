import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL_ASYNC = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/products_db"
)

DATABASE_URL_SYNC = DATABASE_URL_ASYNC.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

# Create synchronous engine for Celery workers
engine_sync = create_engine(
    DATABASE_URL_SYNC,
    echo=False,  # Set to True for debugging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,  # Recycle connections after 1 hour
)

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
