import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "microros_imu_to_mqtt_bridge.py"
SPEC = importlib.util.spec_from_file_location("microros_imu_to_mqtt_bridge", SCRIPT_PATH)
bridge = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(bridge)


def ns(**kwargs):
    return SimpleNamespace(**kwargs)


def test_imu_to_payload_maps_sensor_msgs_imu_shape():
    msg = ns(
        header=ns(frame_id="imu_link", stamp=ns(sec=1779198000, nanosec=123456789)),
        linear_acceleration=ns(x=0.1, y=-0.2, z=9.81),
        angular_velocity=ns(x=0.01, y=0.02, z=0.03),
        orientation=ns(x=0.0, y=0.0, z=0.707, w=0.707),
    )

    payload = bridge.imu_to_payload(msg, robot_id="amr-test", ros_topic="/imu/data")

    assert payload == {
        "robot_id": "amr-test",
        "state": "online",
        "source": "micro_ros",
        "ros_topic": "/imu/data",
        "frame_id": "imu_link",
        "stamp": "2026-05-19T13:40:00.123456789Z",
        "accel_x": 0.1,
        "accel_y": -0.2,
        "accel_z": 9.81,
        "gyro_x": 0.01,
        "gyro_y": 0.02,
        "gyro_z": 0.03,
        "orientation_x": 0.0,
        "orientation_y": 0.0,
        "orientation_z": 0.707,
        "orientation_w": 0.707,
    }


def test_string_to_payload_preserves_json_object_and_defaults():
    msg = ns(data='{"accel_x":1.0,"temperature":26.5}')

    payload = bridge.string_to_payload(msg, robot_id="amr-001", ros_topic="/imu_json")

    assert payload["accel_x"] == 1.0
    assert payload["temperature"] == 26.5
    assert payload["robot_id"] == "amr-001"
    assert payload["state"] == "online"
    assert payload["source"] == "micro_ros"
    assert payload["ros_topic"] == "/imu_json"


def test_string_to_payload_wraps_non_json_text():
    payload = bridge.string_to_payload(ns(data="not-json"), robot_id="amr-001", ros_topic="/imu_text")

    assert payload["data"] == "not-json"
    assert payload["robot_id"] == "amr-001"
    assert payload["ros_topic"] == "/imu_text"


def test_int32_to_payload_maps_robot_state_code():
    payload = bridge.int32_to_payload(ns(data=2), robot_id="amr-001", ros_topic="/robot/state")

    assert payload == {
        "robot_id": "amr-001",
        "state": 2,
        "state_label": "alarm",
        "source": "micro_ros",
        "ros_topic": "/robot/state",
    }


def test_parse_mqtt_broker_accepts_host_port_without_scheme():
    assert bridge.parse_mqtt_broker("127.0.0.1:1884") == ("127.0.0.1", 1884)
    assert bridge.parse_mqtt_broker("mqtt://broker.local") == ("broker.local", 1883)


def test_bridge_defaults_are_low_rate_ros_to_dashboard_mqtt(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["microros_imu_to_mqtt_bridge.py"])

    args = bridge.parse_args()

    assert args.ros_topic == "/imu/data"
    assert args.mqtt_topic == "robot/imu"
    assert args.rate_limit_hz == 5.0


def test_bridge_parser_accepts_int32_state_bridge(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "microros_imu_to_mqtt_bridge.py",
            "--ros-topic",
            "/robot/state",
            "--message-type",
            "std_msgs/msg/Int32",
            "--mqtt-topic",
            "robot/state",
        ],
    )

    args = bridge.parse_args()

    assert args.ros_topic == "/robot/state"
    assert args.message_type == "std_msgs/msg/Int32"
    assert args.mqtt_topic == "robot/state"


def test_bridge_source_has_no_serial_or_control_path():
    source = SCRIPT_PATH.read_text(encoding="utf-8")

    assert "/dev/tty" not in source
    assert "serial.Serial" not in source
    assert "pyserial" not in source
    assert "/cmd_vel" not in source
    assert "/motor/target_rpm" not in source
