"""API tests using an in-memory SQLite DB (no MySQL needed).  Run:  pytest -v"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    # Not used as a context manager, so the MySQL startup hook is not run.
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


def make(client, **overrides):
    payload = {"title": "Write report", "priority": "High", "status": "Pending"}
    payload.update(overrides)
    return client.post("/api/tasks", json=payload)


def test_create_task_returns_201_with_defaults(client):
    r = client.post("/api/tasks", json={"title": "  Buy milk  "})
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Buy milk"
    assert body["status"] == "Pending" and body["priority"] == "Medium"
    assert body["created_at"] and body["updated_at"]


@pytest.mark.parametrize("payload", [{}, {"title": ""}, {"title": "   "}, {"title": "x" * 151},
                                      {"title": "ok", "status": "Done"}, {"title": "ok", "due_date": "not-a-date"}])
def test_create_invalid_returns_422(client, payload):
    r = client.post("/api/tasks", json=payload)
    assert r.status_code == 422
    assert r.json()["detail"] == "Validation failed." and r.json()["errors"]


def test_get_all_and_single(client):
    t = make(client).json()
    assert client.get("/api/tasks").json()["total"] == 1
    assert client.get(f"/api/tasks/{t['id']}").json()["title"] == "Write report"


def test_get_missing_returns_404(client):
    r = client.get("/api/tasks/999")
    assert r.status_code == 404 and "not found" in r.json()["detail"].lower()


def test_put_replaces_task(client):
    t = make(client).json()
    r = client.put(f"/api/tasks/{t['id']}", json={"title": "New", "status": "Completed", "priority": "Low", "due_date": "2030-01-01"})
    assert r.status_code == 200
    assert r.json()["status"] == "Completed" and r.json()["due_date"] == "2030-01-01"


def test_patch_updates_only_sent_fields(client):
    t = make(client).json()
    r = client.patch(f"/api/tasks/{t['id']}", json={"status": "In Progress"})
    assert r.status_code == 200
    assert r.json()["status"] == "In Progress" and r.json()["title"] == "Write report"


def test_patch_rejects_blank_title(client):
    t = make(client).json()
    assert client.patch(f"/api/tasks/{t['id']}", json={"title": " "}).status_code == 422


def test_update_missing_returns_404(client):
    assert client.patch("/api/tasks/999", json={"status": "Completed"}).status_code == 404


def test_delete_task(client):
    t = make(client).json()
    assert client.delete(f"/api/tasks/{t['id']}").status_code == 204
    assert client.get(f"/api/tasks/{t['id']}").status_code == 404
    assert client.delete(f"/api/tasks/{t['id']}").status_code == 404


def test_filter_search_and_sort(client):
    make(client, title="Alpha", priority="High", status="Pending")
    make(client, title="Beta", priority="Low", status="Completed", description="contains needle")
    make(client, title="Gamma", priority="High", status="Completed")

    assert client.get("/api/tasks?status=Completed").json()["total"] == 2
    assert client.get("/api/tasks?priority=High").json()["total"] == 2
    assert client.get("/api/tasks?status=Completed&priority=High").json()["total"] == 1
    assert client.get("/api/tasks?search=needle").json()["items"][0]["title"] == "Beta"
    titles = [t["title"] for t in client.get("/api/tasks?sort=title").json()["items"]]
    assert titles == ["Alpha", "Beta", "Gamma"]


def test_invalid_filter_value_returns_422(client):
    assert client.get("/api/tasks?status=Bogus").status_code == 422


def test_stats(client):
    make(client, status="Pending")
    make(client, status="In Progress")
    make(client, status="Completed")
    make(client, status="Pending", due_date="2000-01-01")  # overdue
    stats = client.get("/api/tasks/stats").json()
    assert stats == {"total": 4, "pending": 2, "in_progress": 1, "completed": 1, "overdue": 1}


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
