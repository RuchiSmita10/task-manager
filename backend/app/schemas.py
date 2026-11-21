"""Pydantic schemas: request validation and response serialisation."""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import TaskPriority, TaskStatus


def _clean_title(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Title cannot be empty or only spaces.")
    return value


class TaskCreate(BaseModel):
    title: str = Field(..., max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def _title(cls, v):
        return _clean_title(v)

    @field_validator("description")
    @classmethod
    def _blank_description_to_none(cls, v):
        return v.strip() or None if v is not None else None


class TaskUpdate(BaseModel):
    """Partial update: only the fields that are sent are changed."""

    title: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def _title(cls, v):
        return _clean_title(v) if v is not None else v


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime


class TaskStats(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    overdue: int


class TaskList(BaseModel):
    items: List[TaskOut]
    total: int
