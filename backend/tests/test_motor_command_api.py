import asyncio

import httpx

from backend.app import config
from backend.app import main
from backend.app.services import mqtt_motor_command
from backend.app.services.mqtt_motor_command import MotorCommandPublishError
from backend.app.services.mqtt_motor_command import RobotMqttMotorCommandService


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


def test_mqtt_motor_command_service_drives_network_loop(monkeypatch):
    calls = []

    class FakePublishResult:
        rc = 0

        def wait_for_publish(self):
            calls.append("wait_for_publish")

    class FakeClient:
        def __init__(self, client_id=None, callback_api_version=None):
            calls.append(("client", client_id, callback_api_version))

        def connect(self, host, port, keepalive):
            calls.append(("connect", host, port, keepalive))

        def loop_start(self):
            calls.append("loop_start")

        def publish(self, topic, payload, qos, retain):
            calls.append(("publish", topic, payload, qos, retain))
            return FakePublishResult()

        def loop_stop(self):
            calls.append("loop_stop")

        def disconnect(self):
            calls.append("disconnect")

    class FakeMqtt:
        Client = FakeClient

    monkeypatch.setattr(mqtt_motor_command, "mqtt", FakeMqtt)
    monkeypatch.setattr(mqtt_motor_command.shutil, "which", lambda _name: None)

    service = RobotMqttMotorCommandService(
        broker_url="mqtt://127.0.0.1:1883",
        topic="robot/motor/cmd",
        keepalive_seconds=30,
    )

    result = service.publish_motor_command({"target_rpm": 0.0, "stop": True})

    assert result["topic"] == "robot/motor/cmd"
    assert ("connect", "127.0.0.1", 1883, 30) in calls
    assert "loop_start" in calls
    assert "wait_for_publish" in calls
    assert "loop_stop" in calls
    assert "disconnect" in calls


def test_mqtt_motor_command_service_prefers_mosquitto_pub_when_available(monkeypatch):
    calls = []

    def fake_run(command, check, capture_output, text, timeout):
        calls.append(
            {
                "command": command,
                "check": check,
                "capture_output": capture_output,
                "text": text,
                "timeout": timeout,
            }
        )

    monkeypatch.setattr(mqtt_motor_command.shutil, "which", lambda name: "/usr/bin/mosquitto_pub" if name == "mosquitto_pub" else None)
    monkeypatch.setattr(mqtt_motor_command.subprocess, "run", fake_run)

    service = RobotMqttMotorCommandService(
        broker_url="mqtt://127.0.0.1:1883",
        topic="robot/motor/cmd",
        keepalive_seconds=30,
    )

    result = service.publish_motor_command({"target_rpm": 0.0, "stop": True})

    assert result["topic"] == "robot/motor/cmd"
    assert len(calls) == 1
    command = calls[0]["command"]
    assert command[:6] == ["mosquitto_pub", "-h", "127.0.0.1", "-p", "1883", "-t"]
    assert "robot/motor/cmd" in command
    assert '{"target_rpm":0.0,"stop":true}' in command
    assert calls[0]["timeout"] == 5
