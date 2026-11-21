"""REST endpoints for tasks."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..models import Task, TaskPriority, TaskStatus

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_or_404(db: Session, task_id: int) -> Task:
    task = crud.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")
    return task


@router.get("", response_model=schemas.TaskList)
def list_tasks(
    status: Optional[TaskStatus] = Query(None, description="Pending | In Progress | Completed"),
    priority: Optional[TaskPriority] = Query(None, description="Low | Medium | High"),
    search: Optional[str] = Query(None, max_length=100, description="Matches title or description"),
    sort: str = Query("newest", pattern="^(newest|oldest|due_date|title)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    items, total = crud.list_tasks(db, status, priority, search, sort, skip, limit)
    return {"items": items, "total": total}


# Declared before "/{task_id}" so "stats" is not parsed as an id.
@router.get("/stats", response_model=schemas.TaskStats)
def task_stats(db: Session = Depends(get_db)):
    return crud.get_stats(db)


@router.post("", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db, payload)


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, task_id)


@router.put("/{task_id}", response_model=schemas.TaskOut)
def replace_task(task_id: int, payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    """Full update: every field is replaced."""
    return crud.update_task(db, _get_or_404(db, task_id), payload, partial=False)


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def patch_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db)):
    """Partial update (e.g. just the status)."""
    return crud.update_task(db, _get_or_404(db, task_id), payload, partial=True)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    crud.delete_task(db, _get_or_404(db, task_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
