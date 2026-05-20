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
    target_rpm = round(120 + math.sin(phase / 2) * 80, 3)
    actual_rpm = round(target_rpm + math.sin(phase) * 12 + random.uniform(-2, 2), 3)
    error_rpm = round(target_rpm - actual_rpm, 3)
    pwm_duty = round(min(1.0, max(0.0, abs(target_rpm) / 300.0)), 3)
    timestamp = utc_now_iso()
    motor_state = {
        "target_rpm": target_rpm,
        "actual_rpm": actual_rpm,
        "error_rpm": error_rpm,
        "pwm_duty": pwm_duty,
        "direction": 1 if target_rpm > 0 else -1 if target_rpm < 0 else 0,
        "control_enabled": True,
        "saturated": False,
        "timeout": False,
        "estop": False,
        "fault": False,
        "source": "target_rpm",
        "loop": seq * 20,
    }

    return {
        "schema_version": 1,
        "robot_id": robot_id,
        "status": "ok",
        "actual_rpm": actual_rpm,
        "motor_state": json.dumps(motor_state, separators=(",", ":")),
        "freshness": {
            "actual_rpm": {
                "topic": "/motor/actual_rpm",
                "status": "ok",
                "age_sec": 0.0,
                "last_received_time": timestamp,
                "last_header_stamp": None,
            },
            "motor_state": {
                "topic": "/motor/state",
                "status": "ok",
                "age_sec": 0.0,
                "last_received_time": timestamp,
                "last_header_stamp": None,
            },
        },
        "last_update_time": timestamp,
        "seq": seq,
        "timestamp": timestamp,
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
