import asyncio
import json

import httpx

from backend.app import main
from backend.app.services.mqtt_robot_status import RobotMqttStatusService


async def _get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


def get(path: str) -> httpx.Response:
    return asyncio.run(_get(path))


def test_mqtt_status_service_caches_json_payload_and_builds_device_status():
    service = RobotMqttStatusService("mqtt://127.0.0.1:1883")
    payload = {
        "robot_id": "amr-001",
        "status": "online",
        "left_rpm": 1200,
        "right_rpm": 1190,
        "temperature_c": 42.5,
    }

    service.record_message("robot/motor/status", json.dumps(payload).encode("utf-8"))
    status = service.build_status()
    devices = service.build_device_statuses()

    assert status["source"] == "mqtt:mqtt://127.0.0.1:1883"
    assert status["topics"]["robot/motor/status"]["payload"]["left_rpm"] == 1200
    assert status["robot"]["motor_status"]["robot_id"] == "amr-001"
    assert devices[0]["device_id"] == "mqtt_motor_status"
    assert devices[0]["transport"] == "mqtt"
    assert devices[0]["comm_status"] == "online"
    assert devices[0]["health_status"] == "healthy"


def test_robot_status_api_returns_latest_cached_mqtt_message():
    main.mqtt_status_service.clear()
    main.mqtt_status_service.record_message(
        "robot/imu",
        b'{"robot_id":"amr-001","status":"online","yaw_deg":12.5}',
    )

    resp = get("/api/robot/status")
    body = resp.json()

    assert resp.status_code == 200
    assert body["source"].startswith("mqtt:")
    assert body["topics"]["robot/imu"]["payload"]["yaw_deg"] == 12.5
    assert body["robot"]["imu"]["robot_id"] == "amr-001"
    assert body["robot"]["devices"][0]["subsystem"] == "imu"

    main.mqtt_status_service.clear()
