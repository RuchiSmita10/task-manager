"""SQLAlchemy engine, session factory and the FastAPI DB dependency."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL

# pool_pre_ping reconnects transparently if MySQL dropped an idle connection.
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    """Yield one DB session per request and always close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
