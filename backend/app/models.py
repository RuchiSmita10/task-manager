"""ORM models."""
import enum

from sqlalchemy import Column, Date, DateTime, Enum, Index, Integer, String, Text, func

from .database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"


class TaskPriority(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


def _enum(enum_cls, name):
    # Store the human-readable values ("In Progress") instead of member names.
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(_enum(TaskStatus, "task_status"), nullable=False, default=TaskStatus.PENDING)
    priority = Column(_enum(TaskPriority, "task_priority"), nullable=False, default=TaskPriority.MEDIUM)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_tasks_status", "status"),
        Index("idx_tasks_priority", "priority"),
        Index("idx_tasks_due_date", "due_date"),
    )
