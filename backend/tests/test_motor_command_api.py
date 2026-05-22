import asyncio

import httpx

from backend.app import config
from backend.app import main
from backend.app.services.mqtt_motor_command import MotorCommandPublishError


async def _post(path: str, payload: dict) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.post(path, json=payload)


def post(path: str, payload: dict) -> httpx.Response:
    return asyncio.run(_post(path, payload))


def test_motor_command_api_clamps_payload_and_publishes(monkeypatch):
    recorded = {}

    class FakePublisher:
        def publish_motor_command(self, payload):
            recorded.update(payload)
            return {
                "topic": config.MQTT_MOTOR_CMD_TOPIC,
                "published_at": "2026-05-20T12:00:00Z",
                "payload": payload,
            }

    monkeypatch.setattr(main, "mqtt_motor_command_service", FakePublisher())

    resp = post(
        "/api/robot/motor/cmd",
        {
            "target_rpm": 420.0,
            "enabled": True,
            "closed_loop": True,
            "max_pwm": 0.9,
            "timeout_ms": 50,
            "stop": False,
        },
    )
    body = resp.json()

    assert resp.status_code == 200
    assert recorded["robot_id"] == config.ROBOT_ID
    assert recorded["target_rpm"] == config.MOTOR_CMD_MAX_ABS_RPM
    assert recorded["max_pwm"] == config.MOTOR_CMD_MAX_PWM_LIMIT
    assert recorded["timeout_ms"] == config.MOTOR_CMD_MIN_TIMEOUT_MS
    assert recorded["enabled"] is True
    assert body["topic"] == config.MQTT_MOTOR_CMD_TOPIC
    assert body["payload"]["target_rpm"] == config.MOTOR_CMD_MAX_ABS_RPM


def test_motor_command_api_stop_forces_zero_target(monkeypatch):
    class FakePublisher:
        def publish_motor_command(self, payload):
            return {
                "topic": config.MQTT_MOTOR_CMD_TOPIC,
                "published_at": "2026-05-20T12:00:01Z",
                "payload": payload,
            }

    monkeypatch.setattr(main, "mqtt_motor_command_service", FakePublisher())

    resp = post(
        "/api/robot/motor/cmd",
        {
            "target_rpm": 120.0,
            "enabled": True,
            "closed_loop": True,
            "max_pwm": 0.25,
            "timeout_ms": 800,
            "stop": True,
        },
    )
    body = resp.json()

    assert resp.status_code == 200
    assert body["payload"]["target_rpm"] == 0.0
    assert body["payload"]["target_speed_mps"] == 0.0
    assert body["payload"]["direction"] == "stop"
    assert body["payload"]["stop"] is True


def test_motor_command_api_accepts_speed_and_clamps_to_bench_limit(monkeypatch):
    recorded = {}

    class FakePublisher:
        def publish_motor_command(self, payload):
            recorded.update(payload)
            return {
                "topic": config.MQTT_MOTOR_CMD_TOPIC,
                "published_at": "2026-05-20T12:00:02Z",
                "payload": payload,
            }

    monkeypatch.setattr(main, "mqtt_motor_command_service", FakePublisher())

    resp = post(
        "/api/robot/motor/cmd",
        {
            "target_speed_mps": 1.0,
            "target_rpm": 420.0,
            "enabled": True,
            "closed_loop": True,
            "max_pwm": 0.9,
            "timeout_ms": 800,
            "stop": False,
        },
    )
    body = resp.json()

    assert resp.status_code == 200
    assert recorded["target_speed_mps"] == config.MOTOR_CMD_MAX_TARGET_SPEED_MPS
    assert 0.0 <= recorded["target_rpm"] <= config.MOTOR_CMD_MAX_ABS_RPM
    assert recorded["max_pwm"] == config.MOTOR_CMD_MAX_PWM_LIMIT
    assert recorded["direction"] == "forward"
    assert body["payload"]["target_speed_mps"] == config.MOTOR_CMD_MAX_TARGET_SPEED_MPS


def test_motor_command_api_returns_publish_error(monkeypatch):
    class BrokenPublisher:
        def publish_motor_command(self, payload):
            raise MotorCommandPublishError(f"broker unavailable for {payload['robot_id']}")

    monkeypatch.setattr(main, "mqtt_motor_command_service", BrokenPublisher())

    resp = post(
        "/api/robot/motor/cmd",
        {
            "target_rpm": 80.0,
            "enabled": True,
            "closed_loop": True,
            "max_pwm": 0.2,
            "timeout_ms": 800,
            "stop": False,
        },
    )
    body = resp.json()

    assert resp.status_code == 502
    assert body["detail"]["error_type"] == "motor_command_publish_error"
    assert "broker unavailable" in body["detail"]["detail"]
