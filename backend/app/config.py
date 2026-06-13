from pathlib import Path
import os

APP_NAME = "robot-ops-dashboard-backend"
APP_VERSION = "0.1.0"
APP_DESCRIPTION = "Minimal FastAPI backend for serving local mock robot operations data."

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MOCK_DIR = PROJECT_ROOT / "mock"
BACKEND_DATA_DIR = PROJECT_ROOT / "backend" / "data"
EVAL_RUNS_DIR = BACKEND_DATA_DIR / "eval_runs"

TASKS_FILE = MOCK_DIR / "sample_amr_tasks.json"
DEVICE_STATUS_FILE = MOCK_DIR / "sample_device_status.json"
ALERTS_FILE = MOCK_DIR / "sample_alerts.json"
EVALUATION_RUNS_FILE = MOCK_DIR / "sample_evaluation_runs.json"
DATASET_VERSIONS_FILE = MOCK_DIR / "sample_dataset_versions.json"
MODEL_VERSIONS_FILE = MOCK_DIR / "sample_model_versions.json"
FAILURE_CASES_FILE = MOCK_DIR / "sample_failure_cases.json"
COMPUTE_USAGE_FILE = MOCK_DIR / "sample_compute_usage.json"
SAMPLE_EVAL_RUN_FILE = EVAL_RUNS_DIR / "sample_eval_run.json"

MOCK_DATA_FILES = {
    "tasks": TASKS_FILE,
    "device_status": DEVICE_STATUS_FILE,
    "alerts": ALERTS_FILE,
    "evaluation_runs": EVALUATION_RUNS_FILE,
    "dataset_versions": DATASET_VERSIONS_FILE,
    "model_versions": MODEL_VERSIONS_FILE,
    "failure_cases": FAILURE_CASES_FILE,
    "compute_usage": COMPUTE_USAGE_FILE,
}

CORS_ALLOW_ORIGINS = ["*"]
CORS_ALLOW_METHODS = ["GET", "POST", "OPTIONS"]
CORS_ALLOW_HEADERS = ["*"]


def _env_flag(name: str, default: str) -> bool:
    value = os.getenv(name, default).strip().lower()
    return value in {"1", "true", "yes", "on"}

# V0.2 AMR HTTP integration configuration
# - ROBOT_OPS_TASK_SOURCE: which task source to use (mock_json | amr_http)
# - AMR_API_BASE_URL: base URL for upstream AMR Mock WMS HTTP API
# - AMR_HTTP_TIMEOUT_SECONDS: request timeout seconds for upstream calls
# - DASHBOARD_WS_STATUS_INTERVAL_SECONDS: backend-to-frontend status push interval
# - MQTT_BROKER_URL: local MQTT broker used for robot telemetry and motor bench command topics
# - MQTT_KEEPALIVE_SECONDS: MQTT client keepalive interval
# - SIM_PREVIEW_MJPEG_URL / GAZEBO_CAMERA_MJPEG_URL: optional upstream MJPEG URL created by the AMR/Gazebo side
ROBOT_OPS_TASK_SOURCE = os.getenv("ROBOT_OPS_TASK_SOURCE", "mock_json")
AMR_API_BASE_URL = os.getenv("AMR_API_BASE_URL", "http://127.0.0.1:8000")
MQTT_BROKER_URL = os.getenv("MQTT_BROKER_URL", "mqtt://127.0.0.1:1883")
ROBOT_ID = os.getenv("ROBOT_ID", "amr-001")
MQTT_MOTOR_CMD_TOPIC = os.getenv("MQTT_MOTOR_CMD_TOPIC", "robot/motor/cmd")
GAZEBO_CAMERA_MJPEG_URL = os.getenv(
    "SIM_PREVIEW_MJPEG_URL",
    os.getenv(
        "GAZEBO_CAMERA_MJPEG_URL",
        os.getenv("SIM_CAMERA_MJPEG_URL", ""),
    ),
).strip()
GAZEBO_CAMERA_LABEL = os.getenv(
    "SIM_PREVIEW_LABEL",
    os.getenv("GAZEBO_CAMERA_LABEL", "Gazebo Path View"),
).strip() or "Gazebo Path View"
GAZEBO_CAMERA_SOURCE = os.getenv(
    "SIM_PREVIEW_SOURCE",
    os.getenv("GAZEBO_CAMERA_SOURCE", "gazebo_preview"),
).strip() or "gazebo_preview"
SIM_CAMERA_PUBLIC_STREAM_URL = os.getenv(
    "SIM_PREVIEW_PUBLIC_STREAM_URL",
    os.getenv("SIM_CAMERA_PUBLIC_STREAM_URL", ""),
).strip()
MQTT_TOPICS = (
    "robot/state",
    "robot/imu",
    "robot/motor/status",
    "robot/alarm",
)
try:
    AMR_HTTP_TIMEOUT_SECONDS = int(os.getenv("AMR_HTTP_TIMEOUT_SECONDS", "3"))
except ValueError:
    AMR_HTTP_TIMEOUT_SECONDS = 3

try:
    MQTT_KEEPALIVE_SECONDS = int(os.getenv("MQTT_KEEPALIVE_SECONDS", "60"))
except ValueError:
    MQTT_KEEPALIVE_SECONDS = 60

try:
    SIM_CAMERA_HTTP_TIMEOUT_SECONDS = float(os.getenv("SIM_CAMERA_HTTP_TIMEOUT_SECONDS", "3"))
except ValueError:
    SIM_CAMERA_HTTP_TIMEOUT_SECONDS = 3.0

if MQTT_KEEPALIVE_SECONDS <= 0:
    MQTT_KEEPALIVE_SECONDS = 60

if SIM_CAMERA_HTTP_TIMEOUT_SECONDS <= 0:
    SIM_CAMERA_HTTP_TIMEOUT_SECONDS = 3.0

try:
    MOTOR_CMD_DEFAULT_TARGET_RPM = float(os.getenv("MOTOR_CMD_DEFAULT_TARGET_RPM", "0"))
except ValueError:
    MOTOR_CMD_DEFAULT_TARGET_RPM = 0.0

try:
    MOTOR_CMD_MAX_ABS_RPM = float(os.getenv("MOTOR_CMD_MAX_ABS_RPM", "80"))
except ValueError:
    MOTOR_CMD_MAX_ABS_RPM = 80.0

try:
    MOTOR_CMD_WHEEL_DIAMETER_M = float(os.getenv("MOTOR_CMD_WHEEL_DIAMETER_M", "0.065"))
except ValueError:
    MOTOR_CMD_WHEEL_DIAMETER_M = 0.065

try:
    MOTOR_CMD_MAX_TARGET_SPEED_MPS = float(os.getenv("MOTOR_CMD_MAX_TARGET_SPEED_MPS", "0.25"))
except ValueError:
    MOTOR_CMD_MAX_TARGET_SPEED_MPS = 0.25

try:
    MOTOR_CMD_DEFAULT_MAX_PWM = float(os.getenv("MOTOR_CMD_DEFAULT_MAX_PWM", "0.25"))
except ValueError:
    MOTOR_CMD_DEFAULT_MAX_PWM = 0.25

try:
    MOTOR_CMD_MAX_PWM_LIMIT = float(os.getenv("MOTOR_CMD_MAX_PWM_LIMIT", "0.25"))
except ValueError:
    MOTOR_CMD_MAX_PWM_LIMIT = 0.25

try:
    MOTOR_CMD_DEFAULT_TIMEOUT_MS = int(os.getenv("MOTOR_CMD_DEFAULT_TIMEOUT_MS", "800"))
except ValueError:
    MOTOR_CMD_DEFAULT_TIMEOUT_MS = 800

try:
    MOTOR_CMD_MIN_TIMEOUT_MS = int(os.getenv("MOTOR_CMD_MIN_TIMEOUT_MS", "100"))
except ValueError:
    MOTOR_CMD_MIN_TIMEOUT_MS = 100

try:
    MOTOR_CMD_MAX_TIMEOUT_MS = int(os.getenv("MOTOR_CMD_MAX_TIMEOUT_MS", "5000"))
except ValueError:
    MOTOR_CMD_MAX_TIMEOUT_MS = 5000

MOTOR_CMD_DEFAULT_ENABLED = _env_flag("MOTOR_CMD_DEFAULT_ENABLED", "true")
MOTOR_CMD_DEFAULT_CLOSED_LOOP = _env_flag("MOTOR_CMD_DEFAULT_CLOSED_LOOP", "true")

if MOTOR_CMD_MAX_ABS_RPM <= 0:
    MOTOR_CMD_MAX_ABS_RPM = 80.0

if MOTOR_CMD_WHEEL_DIAMETER_M <= 0:
    MOTOR_CMD_WHEEL_DIAMETER_M = 0.065

if MOTOR_CMD_MAX_TARGET_SPEED_MPS <= 0:
    MOTOR_CMD_MAX_TARGET_SPEED_MPS = 0.25

if MOTOR_CMD_DEFAULT_MAX_PWM < 0:
    MOTOR_CMD_DEFAULT_MAX_PWM = 0.0

if MOTOR_CMD_MAX_PWM_LIMIT <= 0:
    MOTOR_CMD_MAX_PWM_LIMIT = 0.25

if MOTOR_CMD_DEFAULT_MAX_PWM > MOTOR_CMD_MAX_PWM_LIMIT:
    MOTOR_CMD_DEFAULT_MAX_PWM = MOTOR_CMD_MAX_PWM_LIMIT

if MOTOR_CMD_MIN_TIMEOUT_MS <= 0:
    MOTOR_CMD_MIN_TIMEOUT_MS = 100

if MOTOR_CMD_MAX_TIMEOUT_MS < MOTOR_CMD_MIN_TIMEOUT_MS:
    MOTOR_CMD_MAX_TIMEOUT_MS = MOTOR_CMD_MIN_TIMEOUT_MS

if MOTOR_CMD_DEFAULT_TIMEOUT_MS < MOTOR_CMD_MIN_TIMEOUT_MS:
    MOTOR_CMD_DEFAULT_TIMEOUT_MS = MOTOR_CMD_MIN_TIMEOUT_MS
elif MOTOR_CMD_DEFAULT_TIMEOUT_MS > MOTOR_CMD_MAX_TIMEOUT_MS:
    MOTOR_CMD_DEFAULT_TIMEOUT_MS = MOTOR_CMD_MAX_TIMEOUT_MS

try:
    DASHBOARD_WS_STATUS_INTERVAL_SECONDS = float(os.getenv("DASHBOARD_WS_STATUS_INTERVAL_SECONDS", "3"))
except ValueError:
    DASHBOARD_WS_STATUS_INTERVAL_SECONDS = 3.0

if DASHBOARD_WS_STATUS_INTERVAL_SECONDS <= 0:
    DASHBOARD_WS_STATUS_INTERVAL_SECONDS = 3.0
