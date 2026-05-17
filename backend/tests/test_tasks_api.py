import asyncio

import httpx
from backend.app import main
from backend.app import config
from backend.app.services.amr_http_service import AmrNetworkError


async def _get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


def get(path: str) -> httpx.Response:
    return asyncio.run(_get(path))


def test_health_route_available():
    resp = get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "robot-ops-dashboard-backend"


def test_mock_json_mode_unchanged():
    # Ensure default mock_json returns the sample source
    config.ROBOT_OPS_TASK_SOURCE = "mock_json"
    resp = get("/api/tasks")
    assert resp.status_code == 200
    body = resp.json()
    assert "source" in body
    assert body["source"].startswith("mock_")


def test_amr_http_mode_with_fake_response(monkeypatch):
    # Switch to amr_http at runtime
    config.ROBOT_OPS_TASK_SOURCE = "amr_http"

    fake_raw = [
        {
            "id": 1,
            "task_name": "EXT-1",
            "target_name": "station_a",
            "status": "succeeded",
            "status_reason": "NavigateToPose result: SUCCEEDED.",
        }
    ]

    class FakeAmrService:
        def fetch_amr_tasks(self):
            return fake_raw

    monkeypatch.setattr(main, "get_amr_service", lambda: FakeAmrService())

    resp = get("/api/tasks")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"].startswith("amr_http")
    assert len(body["data"]) == 1
    item = body["data"][0]
    assert item["task_id"] == "EXT-1"
    assert item["status"] == "completed"
    assert item["dropoff_station"] == "station_a"
    assert item["last_event"] == "NavigateToPose result: SUCCEEDED."


def test_amr_http_mode_failure_returns_http_exception(monkeypatch):
    config.ROBOT_OPS_TASK_SOURCE = "amr_http"

    class BrokenAmrService:
        def fetch_amr_tasks(self):
            raise AmrNetworkError("upstream unavailable")

    monkeypatch.setattr(main, "get_amr_service", lambda: BrokenAmrService())

    resp = get("/api/tasks")
    assert resp.status_code == 502
    body = resp.json()
    assert body["detail"]["error_type"] == "amr_http_error"
    assert "upstream unavailable" in body["detail"]["detail"]


def test_status_websocket_route_and_message_contract():
    config.ROBOT_OPS_TASK_SOURCE = "mock_json"
    websocket_routes = [route for route in main.app.routes if getattr(route, "path", None) == "/ws/status"]

    payload = main.build_dashboard_status_message().model_dump()

    assert websocket_routes
    assert payload["type"] == "dashboard_status"
    assert isinstance(payload["timestamp"], str)
    assert isinstance(payload["tasks"], list)
    assert payload["robot"]["status"] in {"healthy", "warning", "critical", "unknown"}
    assert isinstance(payload["robot"]["devices"], list)
    assert payload["motor"] is None
    assert payload["imu"] is None
