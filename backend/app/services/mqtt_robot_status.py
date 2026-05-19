from __future__ import annotations

import copy
import json
import threading
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.parse import urlparse

try:
    import paho.mqtt.client as mqtt
except ImportError:  # pragma: no cover - exercised only when optional dependency is absent
    mqtt = None


ROBOT_MQTT_TOPICS = (
    "robot/state",
    "robot/imu",
    "robot/motor/status",
    "robot/alarm",
)

TOPIC_KEYS = {
    "robot/state": "state",
    "robot/imu": "imu",
    "robot/motor/status": "motor_status",
    "robot/alarm": "alarm",
}

TOPIC_DEVICE_META = {
    "robot/state": ("robot_state", "state_feed"),
    "robot/imu": ("imu", "imu_sensor"),
    "robot/motor/status": ("motor_driver", "motor_controller"),
    "robot/alarm": ("alarm", "alarm_feed"),
}

MessageCallback = Callable[[dict[str, Any]], None]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RobotMqttStatusService:
    """Read-only MQTT status cache for robot telemetry topics."""

    def __init__(
        self,
        broker_url: str,
        topics: tuple[str, ...] = ROBOT_MQTT_TOPICS,
        keepalive_seconds: int = 60,
    ) -> None:
        self.broker_url = broker_url
        self.topics = tuple(topics)
        self.keepalive_seconds = keepalive_seconds
        self._lock = threading.RLock()
        self._messages: dict[str, dict[str, Any] | None] = {topic: None for topic in self.topics}
        self._client: Any | None = None
        self._message_callback: MessageCallback | None = None
        self._connection: dict[str, Any] = {
            "status": "disconnected",
            "broker_url": broker_url,
            "error": "MQTT service has not started.",
            "last_connected_at": None,
            "last_disconnected_at": None,
            "last_message_at": None,
        }

    def start(self, on_message: MessageCallback | None = None) -> None:
        with self._lock:
            if self._client is not None:
                self._message_callback = on_message
                return

            self._message_callback = on_message

            if mqtt is None:
                self._set_connection(
                    status="disconnected",
                    error="paho-mqtt is not installed. Install backend requirements to enable MQTT.",
                )
                return

            try:
                host, port = self._parse_broker_url(self.broker_url)
            except ValueError as exc:
                self._set_connection(status="disconnected", error=str(exc))
                return

            self._client = self._create_client()
            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message
            self._set_connection(status="connecting", error=None)

        try:
            self._client.connect_async(host, port, keepalive=self.keepalive_seconds)
            self._client.loop_start()
        except Exception as exc:
            with self._lock:
                self._client = None
                self._set_connection(status="disconnected", error=f"Failed to start MQTT client: {exc}")

    def stop(self) -> None:
        with self._lock:
            client = self._client
            self._client = None
            self._message_callback = None

        if client is None:
            return

        try:
            client.loop_stop()
            client.disconnect()
        except Exception:
            pass

        self._set_connection(status="disconnected", error="MQTT service stopped.")

    def record_message(self, topic: str, payload: bytes | str) -> dict[str, Any]:
        raw_payload = self._decode_payload(payload)
        parsed_payload = self._parse_payload(raw_payload)
        message = {
            "topic": topic,
            "received_at": utc_now_iso(),
            "payload": parsed_payload,
            "payload_raw": raw_payload,
        }

        with self._lock:
            if topic not in self._messages:
                self._messages[topic] = None
            self._messages[topic] = message
            self._connection["last_message_at"] = message["received_at"]
            callback = self._message_callback

        if callback is not None:
            callback(copy.deepcopy(message))

        return message

    def clear(self) -> None:
        with self._lock:
            self._messages = {topic: None for topic in self.topics}
            self._connection["last_message_at"] = None

    def build_status(self) -> dict[str, Any]:
        with self._lock:
            topics = {topic: copy.deepcopy(self._messages.get(topic)) for topic in self.topics}
            connection = copy.deepcopy(self._connection)

        return {
            "generated_at": utc_now_iso(),
            "source": f"mqtt:{self.broker_url}",
            "connection": connection,
            "topics": topics,
            "robot": {
                "state": self._payload_for(topics, "robot/state"),
                "imu": self._payload_for(topics, "robot/imu"),
                "motor_status": self._payload_for(topics, "robot/motor/status"),
                "alarm": self._payload_for(topics, "robot/alarm"),
                "devices": self._device_statuses_from_topics(topics),
            },
        }

    def build_device_statuses(self) -> list[dict[str, Any]]:
        with self._lock:
            topics = {topic: copy.deepcopy(self._messages.get(topic)) for topic in self.topics}

        return self._device_statuses_from_topics(topics)

    def _on_connect(self, client: Any, _userdata: Any, _flags: Any, reason_code: Any, _properties: Any = None) -> None:
        rc = self._reason_code_value(reason_code)
        if rc == 0:
            self._set_connection(
                status="connected",
                error=None,
                last_connected_at=utc_now_iso(),
            )
            for topic in self.topics:
                client.subscribe(topic)
            return

        self._set_connection(status="disconnected", error=f"MQTT connect failed with reason code {reason_code}.")

    def _on_disconnect(self, _client: Any, _userdata: Any, *args: Any) -> None:
        reason_code = args[0] if args else None
        self._set_connection(
            status="disconnected",
            error=f"MQTT disconnected with reason code {reason_code}.",
            last_disconnected_at=utc_now_iso(),
        )

    def _on_message(self, _client: Any, _userdata: Any, message: Any) -> None:
        self.record_message(message.topic, message.payload)

    def _set_connection(self, status: str, error: str | None, **extra: Any) -> None:
        with self._lock:
            self._connection.update(
                {
                    "status": status,
                    "broker_url": self.broker_url,
                    "error": error,
                }
            )
            self._connection.update(extra)

    def _create_client(self) -> Any:
        if mqtt is None:
            raise RuntimeError("paho-mqtt is not installed")

        callback_api_version = getattr(mqtt, "CallbackAPIVersion", None)
        if callback_api_version is not None:
            try:
                return mqtt.Client(
                    callback_api_version=callback_api_version.VERSION1,
                    client_id="robot-ops-dashboard-monitor",
                )
            except TypeError:
                pass

        return mqtt.Client(client_id="robot-ops-dashboard-monitor")

    @staticmethod
    def _parse_broker_url(broker_url: str) -> tuple[str, int]:
        normalized_url = broker_url if "://" in broker_url else f"mqtt://{broker_url}"
        parsed = urlparse(normalized_url)

        if parsed.scheme not in {"mqtt", "tcp"}:
            raise ValueError(f"Unsupported MQTT broker URL scheme: {parsed.scheme}")

        host = parsed.hostname
        if not host:
            raise ValueError(f"Invalid MQTT broker URL: {broker_url}")

        return host, parsed.port or 1883

    @staticmethod
    def _reason_code_value(reason_code: Any) -> int:
        try:
            return int(reason_code)
        except Exception:
            value = getattr(reason_code, "value", None)
            if isinstance(value, int):
                return value
            if str(reason_code).lower() in {"success", "0"}:
                return 0
            return -1

    @staticmethod
    def _decode_payload(payload: bytes | str) -> str:
        if isinstance(payload, bytes):
            return payload.decode("utf-8", errors="replace")
        return str(payload)

    @staticmethod
    def _parse_payload(raw_payload: str) -> Any:
        try:
            return json.loads(raw_payload)
        except json.JSONDecodeError:
            return raw_payload

    @staticmethod
    def _payload_for(topics: dict[str, dict[str, Any] | None], topic: str) -> Any:
        message = topics.get(topic)
        if message is None:
            return None
        return copy.deepcopy(message.get("payload"))

    def _device_statuses_from_topics(self, topics: dict[str, dict[str, Any] | None]) -> list[dict[str, Any]]:
        devices: list[dict[str, Any]] = []

        for topic in self.topics:
            message = topics.get(topic)
            if message is None:
                continue

            payload = message.get("payload")
            topic_key = TOPIC_KEYS.get(topic, topic.replace("/", "_"))
            subsystem, device_type = TOPIC_DEVICE_META.get(topic, (topic_key, "mqtt_topic"))
            devices.append(
                {
                    "device_id": f"mqtt_{topic_key}",
                    "robot_id": self._robot_id_from_payload(payload),
                    "subsystem": subsystem,
                    "device_type": device_type,
                    "transport": "mqtt",
                    "comm_status": "online",
                    "health_status": self._health_from_payload(topic, payload),
                    "firmware_version": self._firmware_from_payload(payload),
                    "last_seen_at": message["received_at"],
                    "metrics": self._metrics_from_payload(payload),
                    "alarms": self._alarms_from_payload(topic, payload),
                    "labels": ["mqtt", topic],
                }
            )

        return devices

    @staticmethod
    def _robot_id_from_payload(payload: Any) -> str | None:
        if isinstance(payload, dict):
            value = payload.get("robot_id") or payload.get("robot")
            return str(value) if value is not None else None
        return None

    @staticmethod
    def _firmware_from_payload(payload: Any) -> str | None:
        if isinstance(payload, dict):
            value = payload.get("firmware_version") or payload.get("firmware")
            return str(value) if value is not None else None
        return None

    @staticmethod
    def _metrics_from_payload(payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {"value": payload}

        metrics: dict[str, Any] = {}
        for key, value in payload.items():
            if key in {"robot_id", "robot", "firmware", "firmware_version", "alarms", "labels"}:
                continue
            if isinstance(value, (str, int, float, bool)) or value is None:
                metrics[key] = value
            elif isinstance(value, list) and len(value) <= 8:
                metrics[key] = value
            elif isinstance(value, dict) and len(value) <= 8:
                metrics[key] = value

        return metrics

    @staticmethod
    def _health_from_payload(topic: str, payload: Any) -> str:
        if not isinstance(payload, dict):
            return "healthy"

        if topic == "robot/alarm":
            level = str(payload.get("level") or payload.get("severity") or payload.get("status") or "").lower()
            if level in {"critical", "fatal", "error"}:
                return "critical"
            if level in {"warning", "warn", "alarm"}:
                return "warning"
            if payload.get("active") is True:
                return "warning"
            return "healthy"

        status = str(
            payload.get("health_status") or payload.get("status") or payload.get("state") or ""
        ).lower()
        if status in {"critical", "fault", "failed", "error", "offline"}:
            return "critical"
        if status in {"warning", "warn", "degraded", "alarm"}:
            return "warning"
        if payload.get("fault") or payload.get("fault_code"):
            return "warning"
        return "healthy"

    @staticmethod
    def _alarms_from_payload(topic: str, payload: Any) -> list[str]:
        if not isinstance(payload, dict):
            return []

        alarms = payload.get("alarms")
        if isinstance(alarms, list):
            return [str(alarm) for alarm in alarms]

        if topic == "robot/alarm":
            message = payload.get("message") or payload.get("title") or payload.get("code")
            return [str(message)] if message else []

        fault = payload.get("fault") or payload.get("fault_code")
        return [str(fault)] if fault else []
