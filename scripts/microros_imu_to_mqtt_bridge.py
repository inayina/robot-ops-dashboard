#!/usr/bin/env python3
"""Mirror a low-rate ROS 2 sensor topic into the Dashboard MQTT telemetry topic.

This script runs only on the PC side. It does not read serial devices, does not
connect to ESP32 MQTT, and does not publish any robot control commands.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Any
from urllib.parse import urlparse


def load_ros_modules(message_type: str) -> tuple[Any, Any, Any]:
    try:
        import rclpy
        from rclpy.node import Node
        from rclpy.qos import qos_profile_sensor_data
    except ImportError as exc:
        raise SystemExit(
            "缺少 ROS 2 Python 模块 rclpy。请先 source ROS 2 和 micro-ROS 工作空间。"
        ) from exc

    if message_type == "sensor_msgs/msg/Imu":
        try:
            from sensor_msgs.msg import Imu
        except ImportError as exc:
            raise SystemExit("缺少 sensor_msgs/msg/Imu，请确认 ROS 2 环境完整。") from exc
        msg_class = Imu
    elif message_type == "std_msgs/msg/String":
        try:
            from std_msgs.msg import String
        except ImportError as exc:
            raise SystemExit("缺少 std_msgs/msg/String，请确认 ROS 2 环境完整。") from exc
        msg_class = String
    elif message_type == "std_msgs/msg/Int32":
        try:
            from std_msgs.msg import Int32
        except ImportError as exc:
            raise SystemExit("缺少 std_msgs/msg/Int32，请确认 ROS 2 环境完整。") from exc
        msg_class = Int32
    else:
        raise SystemExit(f"暂不支持的 ROS 2 消息类型：{message_type}")

    return rclpy, Node, (qos_profile_sensor_data, msg_class)


def load_mqtt_module() -> Any:
    try:
        import paho.mqtt.client as mqtt
    except ImportError as exc:
        raise SystemExit(
            "缺少 paho-mqtt。请先安装 backend 依赖，或通过一键脚本自动加载 .venv。"
        ) from exc
    return mqtt


def parse_mqtt_broker(broker_url: str) -> tuple[str, int]:
    normalized_url = broker_url if "://" in broker_url else f"mqtt://{broker_url}"
    parsed = urlparse(normalized_url)
    if parsed.scheme not in {"mqtt", "tcp"}:
        raise SystemExit(f"不支持的 MQTT broker scheme：{parsed.scheme}")
    return parsed.hostname or "127.0.0.1", parsed.port or 1883


def create_mqtt_client(mqtt: Any, client_id: str) -> Any:
    callback_api_version = getattr(mqtt, "CallbackAPIVersion", None)
    if callback_api_version is not None:
        try:
            return mqtt.Client(
                callback_api_version=callback_api_version.VERSION2,
                client_id=client_id,
            )
        except (AttributeError, TypeError):
            pass
    return mqtt.Client(client_id=client_id)


def stamp_to_iso(stamp: Any) -> str | None:
    sec = getattr(stamp, "sec", 0)
    nanosec = getattr(stamp, "nanosec", 0)
    if not sec and not nanosec:
        return None
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(sec)) + f".{nanosec:09d}Z"


def imu_to_payload(msg: Any, *, robot_id: str, ros_topic: str) -> dict[str, Any]:
    payload = {
        "robot_id": robot_id,
        "state": "online",
        "source": "micro_ros",
        "ros_topic": ros_topic,
        "frame_id": getattr(getattr(msg, "header", None), "frame_id", ""),
        "stamp": stamp_to_iso(getattr(getattr(msg, "header", None), "stamp", None)),
        "accel_x": float(msg.linear_acceleration.x),
        "accel_y": float(msg.linear_acceleration.y),
        "accel_z": float(msg.linear_acceleration.z),
        "gyro_x": float(msg.angular_velocity.x),
        "gyro_y": float(msg.angular_velocity.y),
        "gyro_z": float(msg.angular_velocity.z),
        "orientation_x": float(msg.orientation.x),
        "orientation_y": float(msg.orientation.y),
        "orientation_z": float(msg.orientation.z),
        "orientation_w": float(msg.orientation.w),
    }
    return {key: value for key, value in payload.items() if value is not None}


def string_to_payload(msg: Any, *, robot_id: str, ros_topic: str) -> dict[str, Any]:
    raw = str(msg.data)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"data": raw}

    if not isinstance(parsed, dict):
        parsed = {"data": parsed}

    parsed.setdefault("robot_id", robot_id)
    parsed.setdefault("state", "online")
    parsed.setdefault("source", "micro_ros")
    parsed.setdefault("ros_topic", ros_topic)
    return parsed


def state_value_to_label(value: int) -> str:
    return {
        0: "normal",
        1: "warning",
        2: "alarm",
        3: "critical",
    }.get(value, "unknown")


def int32_to_payload(msg: Any, *, robot_id: str, ros_topic: str) -> dict[str, Any]:
    value = int(msg.data)
    return {
        "robot_id": robot_id,
        "state": value,
        "state_label": state_value_to_label(value),
        "source": "micro_ros",
        "ros_topic": ros_topic,
    }


class ImuToMqttBridge:
    def __init__(
        self,
        *,
        node_base: Any,
        mqtt_client: Any,
        ros_topic: str,
        mqtt_topic: str,
        robot_id: str,
        message_type: str,
        rate_limit_hz: float,
        qos_profile: Any,
        msg_class: Any,
    ) -> None:
        self.node = node_base("robot_ops_microros_imu_to_mqtt")
        self.mqtt_client = mqtt_client
        self.ros_topic = ros_topic
        self.mqtt_topic = mqtt_topic
        self.robot_id = robot_id
        self.message_type = message_type
        self.min_interval = 0.0 if rate_limit_hz <= 0 else 1.0 / rate_limit_hz
        self.last_publish_time = 0.0
        self.count = 0
        self.node.create_subscription(msg_class, ros_topic, self.on_message, qos_profile)
        self.node.get_logger().info(
            f"Bridging {ros_topic} ({message_type}) -> MQTT {mqtt_topic}"
        )

    def on_message(self, msg: Any) -> None:
        now = time.monotonic()
        if self.min_interval and now - self.last_publish_time < self.min_interval:
            return
        self.last_publish_time = now

        if self.message_type == "sensor_msgs/msg/Imu":
            payload = imu_to_payload(msg, robot_id=self.robot_id, ros_topic=self.ros_topic)
        elif self.message_type == "std_msgs/msg/Int32":
            payload = int32_to_payload(msg, robot_id=self.robot_id, ros_topic=self.ros_topic)
        else:
            payload = string_to_payload(msg, robot_id=self.robot_id, ros_topic=self.ros_topic)

        payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        result = self.mqtt_client.publish(self.mqtt_topic, payload_json, qos=0, retain=False)
        status = getattr(result, "rc", 0)
        if status != 0:
            self.node.get_logger().warning(f"MQTT publish failed with rc={status}")
            return

        self.count += 1
        if self.count == 1 or self.count % 50 == 0:
            self.node.get_logger().info(
                f"Published {self.count} sensor messages to MQTT {self.mqtt_topic}"
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only bridge from a micro-ROS/ROS 2 sensor topic to Dashboard MQTT."
    )
    parser.add_argument("--ros-topic", default="/imu/data", help="ROS 2 IMU topic to subscribe.")
    parser.add_argument(
        "--message-type",
        default="sensor_msgs/msg/Imu",
        choices=("sensor_msgs/msg/Imu", "std_msgs/msg/String", "std_msgs/msg/Int32"),
        help="ROS 2 message type on --ros-topic.",
    )
    parser.add_argument("--mqtt-broker", default="mqtt://127.0.0.1:1883", help="MQTT broker URL.")
    parser.add_argument("--mqtt-topic", default="robot/imu", help="Dashboard MQTT topic.")
    parser.add_argument("--robot-id", default="amr-001", help="Robot id included in MQTT payload.")
    parser.add_argument(
        "--rate-limit-hz",
        type=float,
        default=5.0,
        help="Maximum MQTT mirror rate. Use 0 to disable throttling.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rclpy, Node, ros_parts = load_ros_modules(args.message_type)
    qos_profile, msg_class = ros_parts
    mqtt = load_mqtt_module()
    mqtt_host, mqtt_port = parse_mqtt_broker(args.mqtt_broker)
    client = create_mqtt_client(mqtt, "robot-ops-microros-imu-bridge")
    client.connect(mqtt_host, mqtt_port, keepalive=60)
    client.loop_start()

    rclpy.init()
    bridge = ImuToMqttBridge(
        node_base=Node,
        mqtt_client=client,
        ros_topic=args.ros_topic,
        mqtt_topic=args.mqtt_topic,
        robot_id=args.robot_id,
        message_type=args.message_type,
        rate_limit_hz=args.rate_limit_hz,
        qos_profile=qos_profile,
        msg_class=msg_class,
    )
    try:
        rclpy.spin(bridge.node)
    except KeyboardInterrupt:
        pass
    finally:
        bridge.node.destroy_node()
        rclpy.shutdown()
        client.loop_stop()
        client.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
