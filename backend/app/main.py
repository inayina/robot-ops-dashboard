import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import math
from pathlib import Path
from typing import Any, AsyncIterator

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
from .schemas import (
    DashboardStatusMessage,
    ErrorResponse,
    HealthResponse,
    MotorCommandRequest,
    MotorCommandResponse,
    MockEnvelope,
    RobotStatusResponse,
    WmsTaskCreateRequest,
)
from .services.mock_data_service import MockDataError, MockDataService
from .services.amr_http_service import AmrHttpService, AmrHttpError
from .services.mqtt_motor_command import MotorCommandPublishError, RobotMqttMotorCommandService
from .services.mqtt_robot_status import RobotMqttStatusService
from .services import task_mapper

mock_data_service = MockDataService()
mqtt_status_service = RobotMqttStatusService(
    broker_url=config.MQTT_BROKER_URL,
    topics=config.MQTT_TOPICS,
    keepalive_seconds=config.MQTT_KEEPALIVE_SECONDS,
)
mqtt_motor_command_service = RobotMqttMotorCommandService(
    broker_url=config.MQTT_BROKER_URL,
    topic=config.MQTT_MOTOR_CMD_TOPIC,
    keepalive_seconds=config.MQTT_KEEPALIVE_SECONDS,
)


class StatusWebSocketHub:
    def __init__(self) -> None:
        self._clients: dict[WebSocket, asyncio.Lock] = {}
        self._clients_lock = asyncio.Lock()

    async def add(self, websocket: WebSocket) -> None:
        async with self._clients_lock:
            self._clients[websocket] = asyncio.Lock()

    async def remove(self, websocket: WebSocket) -> None:
        async with self._clients_lock:
            self._clients.pop(websocket, None)

    async def send(self, websocket: WebSocket, payload: dict[str, Any]) -> None:
        async with self._clients_lock:
            send_lock = self._clients.get(websocket)

        if send_lock is None:
            return

        async with send_lock:
            await websocket.send_json(payload)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self._clients_lock:
            clients = list(self._clients.keys())

        disconnected: list[WebSocket] = []
        for websocket in clients:
            try:
                await self.send(websocket, payload)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            await self.remove(websocket)

    async def has_clients(self) -> bool:
        async with self._clients_lock:
            return bool(self._clients)


status_websocket_hub = StatusWebSocketHub()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    loop = asyncio.get_running_loop()

    def schedule_status_broadcast(_message: dict[str, Any]) -> None:
        asyncio.run_coroutine_threadsafe(broadcast_dashboard_status(), loop)

    mqtt_status_service.start(on_message=schedule_status_broadcast)
    try:
        yield
    finally:
        mqtt_status_service.stop()


app = FastAPI(
    title=APP_NAME,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=False,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
)


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


def raise_amr_proxy_error(exc: AmrHttpError, action: str) -> None:
    status_code = getattr(exc, "status_code", None) or 502
    raise_api_error(
        status_code=status_code,
        error_type="amr_wms_proxy_error",
        detail=f"{action}: {exc}",
        path=config.AMR_API_BASE_URL,
    )


def build_wms_create_payload(request: WmsTaskCreateRequest) -> dict[str, Any]:
    task_type = request.task_type.strip()
    if not task_type:
        raise_api_error(
            status_code=400,
            error_type="invalid_wms_task",
            detail="task_type must not be blank.",
            path="/api/wms/tasks",
        )

    safe_task_type = "".join(
        char if char.isalnum() or char in {"_", "-"} else "_"
        for char in task_type.lower()
    ).strip("_")
    safe_task_type = safe_task_type or "task"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    task_name = f"dashboard_{safe_task_type}_{request.pickup}_to_{request.dropoff}_{timestamp}"

    return {
        "target_name": request.dropoff,
        "task_name": task_name,
    }


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


def clamp_float(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def clamp_int(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, value))


def speed_mps_to_rpm(speed_mps: float) -> float:
    wheel_circumference_m = math.pi * config.MOTOR_CMD_WHEEL_DIAMETER_M
    if wheel_circumference_m <= 0:
        return 0.0
    return speed_mps * 60.0 / wheel_circumference_m


def rpm_to_speed_mps(rpm: float) -> float:
    wheel_circumference_m = math.pi * config.MOTOR_CMD_WHEEL_DIAMETER_M
    return rpm * wheel_circumference_m / 60.0


def build_motor_command_payload(request: MotorCommandRequest) -> dict[str, Any]:
    stop = bool(request.stop)
    target_speed_mps = None
    if request.target_speed_mps is not None:
        target_speed_mps = clamp_float(
            float(request.target_speed_mps),
            0.0,
            config.MOTOR_CMD_MAX_TARGET_SPEED_MPS,
        )
        target_rpm = speed_mps_to_rpm(target_speed_mps)
    else:
        target_rpm = float(request.target_rpm)

    target_rpm = clamp_float(target_rpm, 0.0, config.MOTOR_CMD_MAX_ABS_RPM)
    if request.direction == "reverse":
        target_rpm = -target_rpm
    elif request.direction == "stop":
        target_rpm = 0.0

    max_pwm = clamp_float(
        float(request.max_pwm),
        0.0,
        config.MOTOR_CMD_MAX_PWM_LIMIT,
    )
    timeout_ms = clamp_int(
        int(request.timeout_ms),
        config.MOTOR_CMD_MIN_TIMEOUT_MS,
        config.MOTOR_CMD_MAX_TIMEOUT_MS,
    )
    published_target_speed_mps = (
        target_speed_mps if target_speed_mps is not None else rpm_to_speed_mps(abs(target_rpm))
    )

    return {
        "robot_id": config.ROBOT_ID,
        "source": "dashboard_backend",
        "command_id": f"motor_cmd_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}",
        "issued_at": utc_now_iso(),
        "target_rpm": 0.0 if stop else target_rpm,
        "target_speed_mps": 0.0 if stop else published_target_speed_mps,
        "direction": "stop" if stop else request.direction,
        "enabled": bool(request.enabled),
        "closed_loop": bool(request.closed_loop),
        "max_pwm": max_pwm,
        "timeout_ms": timeout_ms,
        "stop": stop,
    }


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


def build_robot_status_response() -> RobotStatusResponse:
    return RobotStatusResponse(**mqtt_status_service.build_status())


def extract_status_error_detail(exc: Exception) -> str:
    detail = getattr(exc, "detail", str(exc))
    if isinstance(detail, dict):
        detail = detail.get("detail") or detail.get("error_type") or str(detail)
    return str(detail)


def build_dashboard_status_message() -> DashboardStatusMessage:
    task_error = None
    try:
        tasks_envelope = load_tasks_envelope()
        tasks = tasks_envelope.data
    except Exception as exc:
        task_error = extract_status_error_detail(exc)
        tasks = []

    devices_envelope = load_mock_envelope(DEVICE_STATUS_FILE)
    mqtt_status = build_robot_status_response()
    mqtt_devices = mqtt_status.robot.get("devices", [])
    merged_devices_envelope = MockEnvelope(
        generated_at=utc_now_iso(),
        source=f"{devices_envelope.source}+{mqtt_status.source}",
        data=[*devices_envelope.data, *mqtt_devices],
    )
    robot = summarize_robot_status(merged_devices_envelope)
    robot["mqtt"] = mqtt_status.model_dump()
    if task_error:
        robot["error"] = f"tasks: {task_error}"

    return DashboardStatusMessage(
        timestamp=utc_now_iso(),
        tasks=tasks,
        robot=robot,
        motor=mqtt_status.robot.get("motor_status"),
        imu=mqtt_status.robot.get("imu"),
    )


def build_dashboard_status_error_message(exc: Exception) -> DashboardStatusMessage:
    detail = extract_status_error_detail(exc)

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


@app.get("/api/robot/status", response_model=RobotStatusResponse)
async def get_robot_status() -> RobotStatusResponse:
    return build_robot_status_response()


@app.post("/api/robot/motor/cmd", response_model=MotorCommandResponse)
async def publish_motor_command(request: MotorCommandRequest) -> MotorCommandResponse:
    payload = build_motor_command_payload(request)

    try:
        result = mqtt_motor_command_service.publish_motor_command(payload)
    except MotorCommandPublishError as exc:
        raise_api_error(
            status_code=502,
            error_type="motor_command_publish_error",
            detail=str(exc),
            path=config.MQTT_MOTOR_CMD_TOPIC,
        )

    return MotorCommandResponse(**result)


@app.get("/api/wms/tasks")
async def get_wms_tasks() -> Any:
    try:
        return get_amr_service().fetch_wms_tasks_payload()
    except AmrHttpError as exc:
        raise_amr_proxy_error(exc, "Failed to fetch AMR WMS tasks")


@app.post("/api/wms/tasks")
async def create_wms_task(request: WmsTaskCreateRequest) -> JSONResponse:
    upstream_payload = build_wms_create_payload(request)

    try:
        status_code, response_payload = get_amr_service().create_wms_task(upstream_payload)
    except AmrHttpError as exc:
        raise_amr_proxy_error(exc, "Failed to create AMR WMS task")

    return JSONResponse(status_code=status_code, content=response_payload)


async def broadcast_dashboard_status() -> None:
    if not await status_websocket_hub.has_clients():
        return

    try:
        message = build_dashboard_status_message()
    except Exception as exc:
        message = build_dashboard_status_error_message(exc)

    await status_websocket_hub.broadcast(message.model_dump())


@app.websocket("/ws/status")
async def websocket_status(websocket: WebSocket) -> None:
    await websocket.accept()
    await status_websocket_hub.add(websocket)

    try:
        while True:
            try:
                message = build_dashboard_status_message()
            except Exception as exc:
                message = build_dashboard_status_error_message(exc)

            try:
                await status_websocket_hub.send(websocket, message.model_dump())
                await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=config.DASHBOARD_WS_STATUS_INTERVAL_SECONDS,
                )
            except asyncio.TimeoutError:
                continue
            except WebSocketDisconnect:
                break
    finally:
        await status_websocket_hub.remove(websocket)
