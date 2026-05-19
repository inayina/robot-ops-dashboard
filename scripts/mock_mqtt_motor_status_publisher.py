#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import random
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_broker_url(broker_url: str) -> tuple[str, int]:
    normalized_url = broker_url if "://" in broker_url else f"mqtt://{broker_url}"
    parsed = urlparse(normalized_url)

    if parsed.scheme not in {"mqtt", "tcp"}:
        raise ValueError(f"unsupported MQTT broker URL scheme: {parsed.scheme}")
    if not parsed.hostname:
        raise ValueError(f"invalid MQTT broker URL: {broker_url}")

    return parsed.hostname, parsed.port or 1883


def build_motor_status(robot_id: str, seq: int) -> dict[str, object]:
    phase = seq / 6
    left_rpm = round(1180 + math.sin(phase) * 80 + random.uniform(-8, 8), 1)
    right_rpm = round(1170 + math.cos(phase) * 70 + random.uniform(-8, 8), 1)
    current_a = round(3.2 + abs(math.sin(phase)) * 0.7 + random.uniform(-0.08, 0.08), 2)
    temperature_c = round(41.5 + abs(math.sin(phase / 2)) * 3.5 + random.uniform(-0.2, 0.2), 1)

    return {
        "robot_id": robot_id,
        "status": "online",
        "motor_id": "drive_base",
        "left_rpm": left_rpm,
        "right_rpm": right_rpm,
        "voltage_v": 24.2,
        "current_a": current_a,
        "temperature_c": temperature_c,
        "fault": None,
        "seq": seq,
        "timestamp": utc_now_iso(),
    }


def load_mqtt_module() -> Any:
    try:
        import paho.mqtt.client as mqtt
    except ImportError as exc:
        raise SystemExit(
            "paho-mqtt is required. Install it with: pip install -r backend/requirements.txt"
        ) from exc

    return mqtt


def create_client(mqtt: Any) -> Any:
    callback_api_version = getattr(mqtt, "CallbackAPIVersion", None)
    if callback_api_version is not None:
        try:
            return mqtt.Client(
                callback_api_version=callback_api_version.VERSION1,
                client_id=f"robot-ops-mock-motor-{int(time.time())}",
            )
        except TypeError:
            pass

    return mqtt.Client(client_id=f"robot-ops-mock-motor-{int(time.time())}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish mock motor/status messages for robot-ops-dashboard.")
    parser.add_argument("--broker", default="mqtt://127.0.0.1:1883", help="MQTT broker URL.")
    parser.add_argument("--topic", default="robot/motor/status", help="MQTT topic to publish.")
    parser.add_argument("--robot-id", default="amr-001", help="Robot ID in the mock payload.")
    parser.add_argument("--interval", type=float, default=1.0, help="Publish interval in seconds.")
    parser.add_argument("--count", type=int, default=0, help="Message count. 0 means publish until interrupted.")
    parser.add_argument("--once", action="store_true", help="Publish one message and exit.")
    args = parser.parse_args()

    host, port = parse_broker_url(args.broker)
    count = 1 if args.once else args.count

    mqtt = load_mqtt_module()
    client = create_client(mqtt)
    client.connect(host, port, keepalive=60)
    client.loop_start()

    seq = 1
    try:
        while count == 0 or seq <= count:
            payload = build_motor_status(args.robot_id, seq)
            client.publish(args.topic, json.dumps(payload, ensure_ascii=False), qos=0, retain=False)
            print(f"published {args.topic}: {json.dumps(payload, ensure_ascii=False)}", flush=True)
            seq += 1

            if count != 0 and seq > count:
                break
            time.sleep(max(args.interval, 0.1))
    except KeyboardInterrupt:
        print("stopped", flush=True)
    finally:
        client.loop_stop()
        client.disconnect()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
