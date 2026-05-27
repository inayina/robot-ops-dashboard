import asyncio

import httpx
from backend.app import main
from backend.app import config
from backend.app.services.amr_http_service import AmrNetworkError


async def _get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


async def _post(path: str, payload: dict) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.post(path, json=payload)


def get(path: str) -> httpx.Response:
    return asyncio.run(_get(path))


def post(path: str, payload: dict) -> httpx.Response:
    return asyncio.run(_post(path, payload))


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


def test_status_websocket_message_keeps_mqtt_telemetry_when_amr_http_fails(monkeypatch):
    config.ROBOT_OPS_TASK_SOURCE = "amr_http"
    main.mqtt_status_service.clear()
    main.mqtt_status_service.record_message(
        "robot/imu",
        b'{"robot_id":"amr-001","status":"online","yaw_deg":12.5}',
    )

    class BrokenAmrService:
        def fetch_amr_tasks(self):
            raise AmrNetworkError("upstream unavailable")

    monkeypatch.setattr(main, "get_amr_service", lambda: BrokenAmrService())

    payload = main.build_dashboard_status_message().model_dump()

    assert payload["tasks"] == []
    assert payload["imu"]["yaw_deg"] == 12.5
    assert payload["robot"]["mqtt"]["robot"]["imu"]["yaw_deg"] == 12.5
    assert "upstream unavailable" in payload["robot"]["error"]

    config.ROBOT_OPS_TASK_SOURCE = "mock_json"
    main.mqtt_status_service.clear()


def test_status_websocket_route_and_message_contract():
    config.ROBOT_OPS_TASK_SOURCE = "mock_json"
    main.mqtt_status_service.clear()
    websocket_routes = [route for route in main.app.routes if getattr(route, "path", None) == "/ws/status"]

    payload = main.build_dashboard_status_message().model_dump()

    assert websocket_routes
    assert payload["type"] == "dashboard_status"
    assert isinstance(payload["timestamp"], str)
    assert isinstance(payload["tasks"], list)
    assert payload["robot"]["status"] in {"healthy", "warning", "critical", "unknown"}
    assert isinstance(payload["robot"]["devices"], list)
    assert "mqtt" in payload["robot"]
    assert payload["motor"] is None
    assert payload["imu"] is None


def test_sim_preview_returns_mock_disconnected_status(monkeypatch):
    monkeypatch.setattr(config, "GAZEBO_CAMERA_MJPEG_URL", "")
    monkeypatch.setattr(config, "SIM_CAMERA_PUBLIC_STREAM_URL", "")
    monkeypatch.setattr(config, "GAZEBO_CAMERA_LABEL", "Gazebo Path View")

    resp = get("/api/sim/preview")
    body = resp.json()

    assert resp.status_code == 200
    assert body["source"] == "mock"
    assert body["connection"] == "disconnected"
    assert body["stream_url"] is None
    assert isinstance(body["last_update_at"], str)
    assert body["label"] == "Gazebo Path View"


def test_sim_preview_returns_stream_url_when_camera_is_configured(monkeypatch):
    monkeypatch.setattr(config, "GAZEBO_CAMERA_MJPEG_URL", "http://127.0.0.1:8080/stream")
    monkeypatch.setattr(config, "SIM_CAMERA_PUBLIC_STREAM_URL", "")
    monkeypatch.setattr(config, "GAZEBO_CAMERA_SOURCE", "gazebo_preview")
    monkeypatch.setattr(config, "GAZEBO_CAMERA_LABEL", "Path Monitor")

    resp = get("/api/sim/preview")
    body = resp.json()

    assert resp.status_code == 200
    assert body["source"] == "gazebo_preview"
    assert body["connection"] == "connected"
    assert body["stream_url"] == "http://testserver/api/sim/stream"
    assert body["label"] == "Path Monitor"


def test_sim_preview_rejects_invalid_camera_url(monkeypatch):
    monkeypatch.setattr(config, "GAZEBO_CAMERA_MJPEG_URL", "file:///tmp/camera.mjpeg")
    monkeypatch.setattr(config, "GAZEBO_CAMERA_LABEL", "Path Monitor")

    resp = get("/api/sim/preview")
    body = resp.json()

    assert resp.status_code == 200
    assert body["connection"] == "disconnected"
    assert body["stream_url"] is None
    assert body["label"] == "Path Monitor"


def test_sim_stream_requires_camera_url(monkeypatch):
    monkeypatch.setattr(config, "GAZEBO_CAMERA_MJPEG_URL", "")

    resp = get("/api/sim/stream")
    body = resp.json()

    assert resp.status_code == 503
    assert body["detail"]["error_type"] == "sim_stream_proxy_error"
    assert "SIM_PREVIEW_MJPEG_URL" in body["detail"]["detail"]


def test_sim_stream_proxies_mjpeg_chunks(monkeypatch):
    class FakeResponse:
        headers = {"content-type": "multipart/x-mixed-replace; boundary=frame"}

    class FakeProxy:
        async def open_stream(self):
            return None, None, FakeResponse()

        async def iter_chunks(self, _client, _stream_context, _response):
            yield b"--frame\r\n"
            yield b"Content-Type: image/jpeg\r\n\r\n"

    monkeypatch.setattr(main, "get_mjpeg_stream_proxy", lambda: FakeProxy())

    resp = get("/api/sim/stream")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("multipart/x-mixed-replace")
    assert resp.content == b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"


def test_wms_tasks_proxy_list_with_fake_amr_response(monkeypatch):
    class FakeAmrService:
        def fetch_wms_tasks_payload(self):
            return {
                "count": 1,
                "tasks": [
                    {
                        "id": 7,
                        "task_name": "dashboard_transport_start_zone_to_station_a_20260519T120000Z",
                        "target_name": "station_a",
                        "status": "pending",
                    }
                ],
            }

    monkeypatch.setattr(main, "get_amr_service", lambda: FakeAmrService())

    resp = get("/api/wms/tasks")
    body = resp.json()

    assert resp.status_code == 200
    assert body["count"] == 1
    assert body["tasks"][0]["target_name"] == "station_a"


def test_wms_tasks_proxy_create_maps_dashboard_payload_to_amr(monkeypatch):
    recorded_payload = {}

    class FakeAmrService:
        def create_wms_task(self, payload):
            recorded_payload.update(payload)
            return 201, {
                "id": 8,
                "task_name": payload["task_name"],
                "target_name": payload["target_name"],
                "status": "pending",
            }

    monkeypatch.setattr(main, "get_amr_service", lambda: FakeAmrService())

    resp = post(
        "/api/wms/tasks",
        {
            "task_type": "transport",
            "pickup": "start_zone",
            "dropoff": "station_a",
        },
    )
    body = resp.json()

    assert resp.status_code == 201
    assert recorded_payload["target_name"] == "station_a"
    assert recorded_payload["task_name"].startswith("dashboard_transport_start_zone_to_station_a_")
    assert body["target_name"] == "station_a"
    assert body["status"] == "pending"
