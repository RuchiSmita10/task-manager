"""Application configuration loaded from environment variables (.env)."""
import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv()


def _build_database_url() -> str:
    """Use DATABASE_URL if provided, otherwise assemble it from DB_* parts."""
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit
    user = os.getenv("DB_USER", "root")
    password = quote_plus(os.getenv("DB_PASSWORD", ""))
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "3306")
    name = os.getenv("DB_NAME", "task_manager")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"


DATABASE_URL = _build_database_url()
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
