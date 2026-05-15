from pathlib import Path

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
