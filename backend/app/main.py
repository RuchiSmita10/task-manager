"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .config import CORS_ORIGINS
from .database import Base, engine
from .routers import tasks

logger = logging.getLogger("task-manager")
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creates the table on first run if database/schema.sql was not applied.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Task Manager API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Error handlers: always answer with {"detail": ..., "errors": [...]} ----------
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path"))
        message = err["msg"].removeprefix("Value error, ")
        errors.append({"field": field, "message": message})
    return JSONResponse(status_code=422, content={"detail": "Validation failed.", "errors": errors})


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=503,
        content={"detail": "The database is unavailable or returned an error. Please try again."},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server."})


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}


app.include_router(tasks.router)

# Serve the HTML/CSS/JS frontend from the same origin (mounted last so /api wins).
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
