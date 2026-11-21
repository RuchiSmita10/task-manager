"""Database operations (kept separate from HTTP concerns)."""
from datetime import date
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from . import models, schemas

SORT_OPTIONS = {
    "newest": models.Task.created_at.desc(),
    "oldest": models.Task.created_at.asc(),
    "due_date": models.Task.due_date.asc(),
    "title": models.Task.title.asc(),
}


def list_tasks(
    db: Session,
    status: Optional[models.TaskStatus] = None,
    priority: Optional[models.TaskPriority] = None,
    search: Optional[str] = None,
    sort: str = "newest",
    skip: int = 0,
    limit: int = 100,
):
    query = db.query(models.Task)
    if status:
        query = query.filter(models.Task.status == status)
    if priority:
        query = query.filter(models.Task.priority == priority)
    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.filter(or_(models.Task.title.like(like), models.Task.description.like(like)))

    total = query.count()
    order = SORT_OPTIONS.get(sort, SORT_OPTIONS["newest"])
    # id as tie-breaker keeps ordering stable.
    items = query.order_by(order, models.Task.id.desc()).offset(skip).limit(limit).all()
    return items, total


def get_task(db: Session, task_id: int) -> Optional[models.Task]:
    return db.get(models.Task, task_id)


def create_task(db: Session, data: schemas.TaskCreate) -> models.Task:
    task = models.Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: models.Task, data: schemas.BaseModel, partial: bool) -> models.Task:
    values = data.model_dump(exclude_unset=partial)
    for field, value in values.items():
        # A partial update may not null out required columns.
        if value is None and field in ("title", "status", "priority"):
            continue
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: models.Task) -> None:
    db.delete(task)
    db.commit()


def get_stats(db: Session) -> schemas.TaskStats:
    rows = dict(db.query(models.Task.status, func.count(models.Task.id)).group_by(models.Task.status).all())
    overdue = (
        db.query(func.count(models.Task.id))
        .filter(models.Task.due_date < date.today(), models.Task.status != models.TaskStatus.COMPLETED)
        .scalar()
    )
    pending = rows.get(models.TaskStatus.PENDING, 0)
    in_progress = rows.get(models.TaskStatus.IN_PROGRESS, 0)
    completed = rows.get(models.TaskStatus.COMPLETED, 0)
    return schemas.TaskStats(
        total=pending + in_progress + completed,
        pending=pending,
        in_progress=in_progress,
        completed=completed,
        overdue=overdue or 0,
    )
