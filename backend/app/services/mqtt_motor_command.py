from __future__ import annotations

from datetime import datetime, timezone
import json
import shutil
import subprocess
from typing import Any
from urllib.parse import urlparse

try:
    import paho.mqtt.client as mqtt
except ImportError:  # pragma: no cover - exercised only when optional dependency is absent
    mqtt = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class MotorCommandPublishError(RuntimeError):
    """Raised when the backend cannot publish a motor command to MQTT."""


class RobotMqttMotorCommandService:
    """Low-frequency MQTT publisher for dashboard motor commands."""

    def __init__(
        self,
        broker_url: str,
        topic: str,
        keepalive_seconds: int = 60,
    ) -> None:
        self.broker_url = broker_url
        self.topic = topic
        self.keepalive_seconds = keepalive_seconds

    def publish_motor_command(self, payload: dict[str, Any]) -> dict[str, Any]:
        if mqtt is None:
            raise MotorCommandPublishError(
                "paho-mqtt is not installed. Install backend requirements to enable motor commands."
            )

        host, port = self._parse_broker_url(self.broker_url)
        payload_json = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))

        if shutil.which("mosquitto_pub"):
            self._publish_with_mosquitto_pub(host, port, payload_json)
        else:
            self._publish_with_paho(host, port, payload_json)

        return {
            "topic": self.topic,
            "published_at": utc_now_iso(),
            "payload": payload,
        }

    def _publish_with_mosquitto_pub(self, host: str, port: int, payload_json: str) -> None:
        command = [
            "mosquitto_pub",
            "-h",
            host,
            "-p",
            str(port),
            "-t",
            self.topic,
            "-m",
            payload_json,
        ]

        try:
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                timeout=5,
            )
        except Exception as exc:  # pragma: no cover - network/runtime dependent
            raise MotorCommandPublishError(f"Failed to publish motor command with mosquitto_pub: {exc}") from exc

    def _publish_with_paho(self, host: str, port: int, payload_json: str) -> None:
        client = self._create_client()

        try:
            client.connect(host, port, keepalive=self.keepalive_seconds)
            client.loop_start()
            result = client.publish(self.topic, payload_json, qos=0, retain=False)
            if hasattr(result, "wait_for_publish"):
                result.wait_for_publish()
            status = getattr(result, "rc", 0)
        except Exception as exc:  # pragma: no cover - network/runtime dependent
            raise MotorCommandPublishError(f"Failed to publish motor command: {exc}") from exc
        finally:
            try:
                client.loop_stop()
            except Exception:
                pass
            try:
                client.disconnect()
            except Exception:
                pass

        if status != 0:
            raise MotorCommandPublishError(
                f"Failed to publish motor command to {self.topic}: rc={status}"
            )

    @staticmethod
    def _parse_broker_url(broker_url: str) -> tuple[str, int]:
        normalized_url = broker_url if "://" in broker_url else f"mqtt://{broker_url}"
        parsed = urlparse(normalized_url)

        if parsed.scheme not in {"mqtt", "tcp"}:
            raise MotorCommandPublishError(
                f"Unsupported MQTT broker URL scheme: {parsed.scheme}"
            )

        host = parsed.hostname
        if not host:
            raise MotorCommandPublishError(f"Invalid MQTT broker URL: {broker_url}")

        return host, parsed.port or 1883

    @staticmethod
    def _create_client() -> Any:
        callback_api_version = getattr(mqtt, "CallbackAPIVersion", None)
        if callback_api_version is not None:
            try:
                return mqtt.Client(
                    callback_api_version=callback_api_version.VERSION1,
                    client_id="robot-ops-dashboard-motor-command",
                )
            except TypeError:
                pass

        return mqtt.Client(client_id="robot-ops-dashboard-motor-command")
