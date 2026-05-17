from pathlib import Path
import os

APP_NAME = "robot-ops-dashboard-backend"
APP_VERSION = "0.1.0"
APP_DESCRIPTION = "Minimal FastAPI backend for serving local mock robot operations data."

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MOCK_DIR = PROJECT_ROOT / "mock"

TASKS_FILE = MOCK_DIR / "sample_amr_tasks.json"
DEVICE_STATUS_FILE = MOCK_DIR / "sample_device_status.json"
ALERTS_FILE = MOCK_DIR / "sample_alerts.json"

MOCK_DATA_FILES = {
    "tasks": TASKS_FILE,
    "device_status": DEVICE_STATUS_FILE,
    "alerts": ALERTS_FILE,
}

CORS_ALLOW_ORIGINS = ["*"]
CORS_ALLOW_METHODS = ["GET"]
CORS_ALLOW_HEADERS = ["*"]

# V0.2 AMR HTTP integration configuration
# - ROBOT_OPS_TASK_SOURCE: which task source to use (mock_json | amr_http)
# - AMR_API_BASE_URL: base URL for upstream AMR Mock WMS HTTP API
# - AMR_HTTP_TIMEOUT_SECONDS: request timeout seconds for upstream calls
# - DASHBOARD_WS_STATUS_INTERVAL_SECONDS: backend-to-frontend status push interval
ROBOT_OPS_TASK_SOURCE = os.getenv("ROBOT_OPS_TASK_SOURCE", "mock_json")
AMR_API_BASE_URL = os.getenv("AMR_API_BASE_URL", "http://127.0.0.1:8000")
try:
    AMR_HTTP_TIMEOUT_SECONDS = int(os.getenv("AMR_HTTP_TIMEOUT_SECONDS", "3"))
except ValueError:
    AMR_HTTP_TIMEOUT_SECONDS = 3

try:
    DASHBOARD_WS_STATUS_INTERVAL_SECONDS = float(os.getenv("DASHBOARD_WS_STATUS_INTERVAL_SECONDS", "3"))
except ValueError:
    DASHBOARD_WS_STATUS_INTERVAL_SECONDS = 3.0

if DASHBOARD_WS_STATUS_INTERVAL_SECONDS <= 0:
    DASHBOARD_WS_STATUS_INTERVAL_SECONDS = 3.0
