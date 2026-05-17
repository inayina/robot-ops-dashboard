import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from . import config
from .config import (
    ALERTS_FILE,
    APP_DESCRIPTION,
    APP_NAME,
    APP_VERSION,
    CORS_ALLOW_HEADERS,
    CORS_ALLOW_METHODS,
    CORS_ALLOW_ORIGINS,
    DEVICE_STATUS_FILE,
    TASKS_FILE,
)
from .schemas import DashboardStatusMessage, ErrorResponse, HealthResponse, MockEnvelope
from .services.mock_data_service import MockDataError, MockDataService
from .services.amr_http_service import AmrHttpService, AmrHttpError
from .services import task_mapper

app = FastAPI(
    title=APP_NAME,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=False,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
)

mock_data_service = MockDataService()


@app.exception_handler(MockDataError)
async def handle_mock_data_error(_: Request, exc: MockDataError) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error_type=exc.error_type,
            detail=exc.detail,
            path=str(exc.path),
        ).model_dump(),
    )


def get_amr_service() -> AmrHttpService:
    return AmrHttpService(
        base_url=config.AMR_API_BASE_URL,
        timeout=config.AMR_HTTP_TIMEOUT_SECONDS,
        trust_env=False,
    )


def raise_api_error(status_code: int, error_type: str, detail: str, path: str | Path) -> None:
    raise HTTPException(
        status_code=status_code,
        detail=ErrorResponse(
            error_type=error_type,
            detail=detail,
            path=str(path),
        ).model_dump(),
    )


def load_mock_envelope(path: Path) -> MockEnvelope:
    try:
        payload = mock_data_service.load_payload(path)
        return MockEnvelope(**payload)
    except MockDataError as exc:
        raise_api_error(
            status_code=500,
            error_type=exc.error_type,
            detail=exc.detail,
            path=exc.path,
        )
    except ValidationError as exc:
        raise_api_error(
            status_code=500,
            error_type="mock_payload_contract_error",
            detail=f"Mock payload does not match dashboard contract: {exc}",
            path=path,
        )


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_tasks_envelope() -> MockEnvelope:
    mode = config.ROBOT_OPS_TASK_SOURCE
    if mode == "mock_json":
        return load_mock_envelope(TASKS_FILE)

    if mode == "amr_http":
        try:
            raw_tasks = get_amr_service().fetch_amr_tasks()
        except AmrHttpError as exc:
            raise_api_error(
                status_code=502,
                error_type="amr_http_error",
                detail=str(exc),
                path=config.AMR_API_BASE_URL,
            )

        try:
            mapped = [task_mapper.map_amr_task_to_dashboard_task(t) for t in raw_tasks]
        except Exception as exc:
            raise_api_error(
                status_code=502,
                error_type="amr_task_mapping_error",
                detail=f"Failed to map AMR tasks to dashboard contract: {exc}",
                path=config.AMR_API_BASE_URL,
            )

        envelope = {
            "generated_at": utc_now_iso(),
            "source": f"amr_http:{config.AMR_API_BASE_URL}",
            "data": mapped,
        }
        try:
            return MockEnvelope(**envelope)
        except ValidationError as exc:
            raise_api_error(
                status_code=502,
                error_type="dashboard_contract_error",
                detail=f"Mapped AMR tasks do not match dashboard contract: {exc}",
                path=config.AMR_API_BASE_URL,
            )

    raise_api_error(
        status_code=500,
        error_type="invalid_task_source",
        detail=f"Unsupported ROBOT_OPS_TASK_SOURCE: {mode}",
        path="ROBOT_OPS_TASK_SOURCE",
    )


def summarize_robot_status(devices_envelope: MockEnvelope) -> dict[str, Any]:
    devices = devices_envelope.data
    total = len(devices)
    online = sum(1 for device in devices if device.get("comm_status") == "online")
    intermittent = sum(1 for device in devices if device.get("comm_status") == "intermittent")
    offline = sum(1 for device in devices if device.get("comm_status") == "offline")
    warning = sum(1 for device in devices if device.get("health_status") == "warning")
    critical = sum(1 for device in devices if device.get("health_status") == "critical")

    if total == 0:
        status = "unknown"
    elif critical > 0 or offline > 0:
        status = "critical"
    elif warning > 0 or intermittent > 0:
        status = "warning"
    else:
        status = "healthy"

    return {
        "status": status,
        "source": devices_envelope.source,
        "generated_at": devices_envelope.generated_at,
        "devices": devices,
        "summary": {
            "total": total,
            "online": online,
            "intermittent": intermittent,
            "offline": offline,
            "warning": warning,
            "critical": critical,
        },
    }


def build_dashboard_status_message() -> DashboardStatusMessage:
    tasks_envelope = load_tasks_envelope()
    devices_envelope = load_mock_envelope(DEVICE_STATUS_FILE)
    return DashboardStatusMessage(
        timestamp=utc_now_iso(),
        tasks=tasks_envelope.data,
        robot=summarize_robot_status(devices_envelope),
        motor=None,
        imu=None,
    )


def build_dashboard_status_error_message(exc: Exception) -> DashboardStatusMessage:
    detail = getattr(exc, "detail", str(exc))
    if isinstance(detail, dict):
        detail = detail.get("detail") or detail.get("error_type") or str(detail)

    return DashboardStatusMessage(
        timestamp=utc_now_iso(),
        tasks=[],
        robot={
            "status": "disconnected",
            "source": "dashboard_backend",
            "generated_at": utc_now_iso(),
            "devices": [],
            "summary": {
                "total": 0,
                "online": 0,
                "intermittent": 0,
                "offline": 0,
                "warning": 0,
                "critical": 0,
            },
            "error": str(detail),
        },
        motor=None,
        imu=None,
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=APP_NAME,
        version=APP_VERSION,
        mode=config.ROBOT_OPS_TASK_SOURCE,
    )


@app.get("/api/tasks", response_model=MockEnvelope)
async def get_tasks() -> MockEnvelope:
    return load_tasks_envelope()


@app.get("/api/device-status", response_model=MockEnvelope)
async def get_device_status() -> MockEnvelope:
    return load_mock_envelope(DEVICE_STATUS_FILE)


@app.get("/api/alerts", response_model=MockEnvelope)
async def get_alerts() -> MockEnvelope:
    return load_mock_envelope(ALERTS_FILE)


@app.websocket("/ws/status")
async def websocket_status(websocket: WebSocket) -> None:
    await websocket.accept()

    while True:
        try:
            message = build_dashboard_status_message()
        except Exception as exc:
            message = build_dashboard_status_error_message(exc)

        try:
            await websocket.send_json(message.model_dump())
            await asyncio.wait_for(
                websocket.receive_text(),
                timeout=config.DASHBOARD_WS_STATUS_INTERVAL_SECONDS,
            )
        except asyncio.TimeoutError:
            continue
        except WebSocketDisconnect:
            break
