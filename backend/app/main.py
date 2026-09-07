import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from . import config
from .config import (
    ALERTS_FILE,
    APP_DESCRIPTION,
    APP_NAME,
    APP_VERSION,
    COMPUTE_USAGE_FILE,
    CORS_ALLOW_HEADERS,
    CORS_ALLOW_METHODS,
    CORS_ALLOW_ORIGINS,
    DATASET_VERSIONS_FILE,
    DEVICE_STATUS_FILE,
    EVALUATION_RUNS_FILE,
    FAILURE_CASES_FILE,
    MODEL_VERSIONS_FILE,
    SAMPLE_EVAL_RUN_FILE,
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
    SimPreviewResponse,
    WmsTaskCreateRequest,
)
from .services.mock_data_service import MockDataError, MockDataService
from .services.amr_http_service import AmrHttpService, AmrHttpError
from .services.robot_data_platform_service import (
    RobotDataPlatformError,
    RobotDataPlatformService,
)
from .services.mjpeg_stream_proxy import MjpegStreamProxy, MjpegStreamProxyError
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


def get_robot_data_platform_service() -> RobotDataPlatformService:
    return RobotDataPlatformService(
        base_url=config.ROBOT_DATA_PLATFORM_BASE_URL,
        timeout=config.ROBOT_DATA_PLATFORM_TIMEOUT_SECONDS,
        hoc_base_url=config.HOC_BASE_URL,
        trust_env=False,
    )


def platform_envelope(action: str) -> MockEnvelope:
    service = get_robot_data_platform_service()
    try:
        payload = getattr(service, action)()
        return MockEnvelope(**payload)
    except RobotDataPlatformError as exc:
        raise_api_error(502, "robot_data_platform_error", str(exc), config.ROBOT_DATA_PLATFORM_BASE_URL)


def get_mjpeg_stream_proxy() -> MjpegStreamProxy:
    return MjpegStreamProxy(
        upstream_url=config.GAZEBO_CAMERA_MJPEG_URL,
        timeout_seconds=config.SIM_CAMERA_HTTP_TIMEOUT_SECONDS,
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


def build_evaluation_summary() -> dict[str, Any]:
    payload = mock_data_service.load_payload(SAMPLE_EVAL_RUN_FILE)
    task_results = payload.get("task_results")
    failure_cases = payload.get("failure_cases")
    failure_count = len(failure_cases) if isinstance(failure_cases, list) else 0
    latest_status = payload.get("latest_status") or derive_latest_evaluation_status(task_results)
    live_run = build_live_evaluation_run()
    live_failure_cases = live_run.get("failure_cases", [])
    summary_failure_cases = failure_cases if isinstance(failure_cases, list) else []
    validation_metrics = payload.get("validation_metrics", {})
    if not isinstance(validation_metrics, dict):
        validation_metrics = {}
    evidence_links = payload.get("evidence_links", [])
    if not isinstance(evidence_links, list):
        evidence_links = []

    return {
        "run_id": payload.get("run_id"),
        "run_type": "baseline_system_evaluation",
        "status": live_run.get("status") or latest_status,
        "dataset_version": payload.get("dataset_version"),
        "model_version": payload.get("model_version"),
        "policy_type": payload.get("policy_type"),
        "baseline_version": payload.get("baseline_version") or payload.get("model_version"),
        "control_policy": payload.get("control_policy") or payload.get("policy_type"),
        "scenario": payload.get("scenario"),
        "task_success_rate": payload.get("task_success_rate"),
        "task_total": live_run.get("task_total"),
        "task_success": live_run.get("task_success"),
        "task_failed": live_run.get("task_failed"),
        "failure_count": failure_count + len(live_failure_cases),
        "failure_cases": [*live_failure_cases, *summary_failure_cases],
        "data_sources": payload.get("data_sources", []),
        "latest_status": latest_status,
        "live_run": live_run,
        "gpu_usage": payload.get("gpu_usage"),
        "validation_metrics": validation_metrics,
        "evidence_links": evidence_links,
        "amr_e2e_status": validation_metrics.get("amr_e2e_status"),
        "dashboard_api_status": validation_metrics.get("dashboard_api_status"),
        "websocket_status": validation_metrics.get("websocket_status"),
        "mqtt_telemetry_status": validation_metrics.get("mqtt_telemetry_status"),
        "motor_bench_status": validation_metrics.get("motor_bench_status"),
        "no_real_training_claim": validation_metrics.get("no_real_training_claim") is True,
        "quality_checks": {
            **(payload.get("quality_checks", {}) if isinstance(payload.get("quality_checks"), dict) else {}),
            **live_run.get("quality_checks", {}),
        },
    }


def derive_latest_evaluation_status(task_results: Any) -> str:
    if not isinstance(task_results, list) or not task_results:
        return "unknown"

    latest_task = task_results[-1]
    if not isinstance(latest_task, dict):
        return "unknown"

    return str(latest_task.get("status") or latest_task.get("result") or "unknown")


def build_live_evaluation_run() -> dict[str, Any]:
    now = utc_now_iso()
    try:
        tasks_envelope = load_tasks_envelope()
        tasks = tasks_envelope.data
        task_source = tasks_envelope.source
        task_error = None
    except Exception as exc:
        tasks = []
        task_source = config.ROBOT_OPS_TASK_SOURCE
        task_error = extract_status_error_detail(exc)

    mqtt_status = build_robot_status_response().model_dump()
    telemetry = mqtt_status.get("robot", {})
    latest_task = select_latest_task(tasks)
    task_counts = count_live_task_statuses(tasks)
    terminal_total = task_counts["completed"] + task_counts["failed"] + task_counts["cancelled"] + task_counts["blocked"]
    success_denominator = terminal_total or len(tasks)
    task_success_rate = task_counts["completed"] / success_denominator if success_denominator else None
    latest_status = str(latest_task.get("status") or latest_task.get("source_status") or "no_task") if latest_task else "no_task"
    route = build_task_route_label(latest_task)
    imu_live = bool(telemetry.get("imu"))
    robot_state = telemetry.get("state") if isinstance(telemetry.get("state"), dict) else {}
    motor_status = telemetry.get("motor_status")
    motor_live = bool(motor_status)

    return {
        "run_id": f"live_dashboard_eval_{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        "run_type": "baseline_system_evaluation",
        "scenario": f"Live dashboard snapshot: {route}" if route else "Live dashboard task and telemetry snapshot",
        "robot_id": robot_state.get("robot_id") or config.ROBOT_ID,
        "task_source": task_source,
        "dataset_version": "live_dashboard_wms_mqtt_snapshot_v0.1",
        "model_version": "baseline_nav2_no_learning",
        "baseline_version": "baseline_nav2_no_learning",
        "control_policy": "rule_based_nav2_baseline",
        "status": latest_status,
        "task_total": len(tasks),
        "task_success": task_counts["completed"],
        "task_failed": task_counts["failed"] + task_counts["cancelled"] + task_counts["blocked"],
        "task_success_rate": task_success_rate,
        "started_at": pick_earliest_task_timestamp(tasks),
        "finished_at": pick_latest_task_timestamp(tasks),
        "latest_task_id": latest_task.get("task_id") if latest_task else None,
        "latest_task_route": route,
        "latest_task_status": latest_status,
        "result_scope": "live_dashboard_snapshot_plus_baseline_contract_not_model_training",
        "failure_cases": build_live_failure_cases(tasks, motor_status),
        "quality_checks": {
            "live_task_source_connected": task_error is None,
            "live_task_count": len(tasks),
            "live_imu_payload": imu_live,
            "live_motor_status_payload": motor_live,
            "live_robot_state_payload": bool(telemetry.get("state")),
            "live_mqtt_connection": mqtt_status.get("connection", {}).get("status"),
            "live_task_error": task_error,
        },
        "feature_snapshot": {
            "imu_state": telemetry.get("imu", {}).get("state") if isinstance(telemetry.get("imu"), dict) else None,
            "motor_status": motor_status.get("status") if isinstance(motor_status, dict) else None,
            "motor_error_rpm": extract_motor_error_rpm(motor_status),
            "motor_pwm": extract_motor_pwm(motor_status),
            "updated_at": now,
        },
    }


def count_live_task_statuses(tasks: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"completed": 0, "failed": 0, "cancelled": 0, "blocked": 0}
    for task in tasks:
        status = str(task.get("status") or task.get("source_status") or "").lower()
        if status in {"completed", "succeeded", "success"}:
            counts["completed"] += 1
        elif status in {"failed", "error"}:
            counts["failed"] += 1
        elif status in {"cancelled", "canceled"}:
            counts["cancelled"] += 1
        elif status == "blocked":
            counts["blocked"] += 1
    return counts


def select_latest_task(tasks: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not tasks:
        return None

    def _task_sort_key(task: dict[str, Any]) -> tuple[int, str]:
        status = str(task.get("status") or "").lower()
        active_rank = 1 if status in {"queued", "dispatching", "running", "blocked"} else 0
        timestamp = (
            task.get("updated_at")
            or task.get("last_update_at")
            or task.get("created_at")
            or task.get("completed_at")
            or ""
        )
        return active_rank, str(timestamp)

    return sorted(tasks, key=_task_sort_key, reverse=True)[0]


def build_task_route_label(task: dict[str, Any] | None) -> str:
    if not task:
        return ""
    pickup = task.get("pickup_station") or task.get("pickup") or "-"
    dropoff = task.get("dropoff_station") or task.get("dropoff") or task.get("target_name") or "-"
    return f"{pickup} -> {dropoff}"


def pick_latest_task_timestamp(tasks: list[dict[str, Any]]) -> str | None:
    values = [
        task.get("updated_at") or task.get("last_update_at") or task.get("completed_at") or task.get("created_at")
        for task in tasks
    ]
    return max((str(value) for value in values if value), default=None)


def pick_earliest_task_timestamp(tasks: list[dict[str, Any]]) -> str | None:
    values = [task.get("created_at") or task.get("started_at") or task.get("updated_at") for task in tasks]
    return min((str(value) for value in values if value), default=None)


def build_live_failure_cases(tasks: list[dict[str, Any]], motor_status: Any) -> list[dict[str, Any]]:
    failure_cases: list[dict[str, Any]] = []
    for task in tasks:
        status = str(task.get("status") or task.get("source_status") or "").lower()
        if status not in {"blocked", "failed", "cancelled", "canceled"}:
            continue
        task_id = task.get("task_id") or task.get("id") or task.get("task_name") or "task"
        failure_cases.append(
            {
                "failure_case_id": f"live_task_{task_id}_{status}",
                "task_id": task_id,
                "failure_type": f"task_{status}",
                "severity": "warning" if status == "blocked" else "info",
                "summary": f"Live WMS task is {status}: {build_task_route_label(task)}.",
                "evidence": ["GET /api/tasks", "WebSocket /ws/status"],
                "status": "open" if status in {"blocked", "failed"} else "reviewed",
            }
        )

    if isinstance(motor_status, dict) and str(motor_status.get("status") or "").lower() == "stale":
        failure_cases.append(
            {
                "failure_case_id": "live_motor_status_stale",
                "task_id": None,
                "failure_type": "telemetry_stale",
                "severity": "info",
                "summary": "Motor bench status is stale after safe stop; command path remains explicit and bounded.",
                "evidence": ["GET /api/robot/status", "robot/motor/status"],
                "status": "reviewed",
            }
        )

    return failure_cases[:6]


def extract_motor_state(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    motor_state = payload.get("motor_state") or payload.get("motorState")
    if isinstance(motor_state, dict):
        return motor_state
    if isinstance(motor_state, str) and motor_state.strip():
        try:
            parsed = json.loads(motor_state)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def extract_motor_error_rpm(payload: Any) -> float | None:
    if not isinstance(payload, dict):
        return None
    motor_state = extract_motor_state(payload)
    value = motor_state.get("error_rpm", payload.get("error_rpm"))
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def extract_motor_pwm(payload: Any) -> float | None:
    if not isinstance(payload, dict):
        return None
    motor_state = extract_motor_state(payload)
    value = motor_state.get("pwm", motor_state.get("pwm_duty", payload.get("pwm")))
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_sim_preview_response(request: Request) -> SimPreviewResponse:
    stream_proxy = get_mjpeg_stream_proxy()
    if not stream_proxy.is_configured():
        return SimPreviewResponse(
            source="mock",
            connection="disconnected",
            stream_url=None,
            last_update_at=utc_now_iso(),
            label=config.GAZEBO_CAMERA_LABEL,
        )

    try:
        stream_proxy.validate()
    except MjpegStreamProxyError:
        return SimPreviewResponse(
            source=config.GAZEBO_CAMERA_SOURCE,
            connection="disconnected",
            stream_url=None,
            last_update_at=utc_now_iso(),
            label=config.GAZEBO_CAMERA_LABEL,
        )

    stream_url = config.SIM_CAMERA_PUBLIC_STREAM_URL or str(request.url_for("get_sim_stream"))
    return SimPreviewResponse(
        source=config.GAZEBO_CAMERA_SOURCE,
        connection="connected",
        stream_url=stream_url,
        last_update_at=utc_now_iso(),
        label=config.GAZEBO_CAMERA_LABEL,
    )


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


@app.get("/api/evaluation/runs", response_model=MockEnvelope)
async def get_evaluation_runs() -> MockEnvelope:
    return platform_envelope("evaluation_runs")


@app.get("/api/evaluation/datasets", response_model=MockEnvelope)
async def get_evaluation_datasets() -> MockEnvelope:
    return platform_envelope("dataset_versions")


@app.get("/api/evaluation/models", response_model=MockEnvelope)
async def get_evaluation_models() -> MockEnvelope:
    return load_mock_envelope(MODEL_VERSIONS_FILE)


@app.get("/api/evaluation/failure-cases", response_model=MockEnvelope)
async def get_evaluation_failure_cases() -> MockEnvelope:
    return platform_envelope("failure_cases")


@app.get("/api/evaluation/episodes/{episode_id}")
async def get_evaluation_episode(episode_id: str) -> dict[str, Any]:
    try:
        return get_robot_data_platform_service().episode(episode_id)
    except RobotDataPlatformError as exc:
        raise_api_error(502, "robot_data_platform_error", str(exc), config.ROBOT_DATA_PLATFORM_BASE_URL)


@app.get("/api/evaluation/compute", response_model=MockEnvelope)
async def get_evaluation_compute() -> MockEnvelope:
    return load_mock_envelope(COMPUTE_USAGE_FILE)


@app.get("/api/evaluation/summary")
async def get_evaluation_summary() -> dict[str, Any]:
    return build_evaluation_summary()


@app.get("/api/robot/status", response_model=RobotStatusResponse)
async def get_robot_status() -> RobotStatusResponse:
    return build_robot_status_response()


@app.get("/api/sim/preview", response_model=SimPreviewResponse)
async def get_sim_preview(request: Request) -> SimPreviewResponse:
    return build_sim_preview_response(request)


@app.get("/api/sim/stream")
async def get_sim_stream() -> StreamingResponse:
    stream_proxy = get_mjpeg_stream_proxy()
    try:
        client, stream_context, upstream_response = await stream_proxy.open_stream()
    except MjpegStreamProxyError as exc:
        raise_api_error(
            status_code=exc.status_code,
            error_type="sim_stream_proxy_error",
            detail=str(exc),
            path=config.GAZEBO_CAMERA_MJPEG_URL or "SIM_PREVIEW_MJPEG_URL|GAZEBO_CAMERA_MJPEG_URL",
        )

    media_type = upstream_response.headers.get("content-type") or "multipart/x-mixed-replace"
    return StreamingResponse(
        stream_proxy.iter_chunks(client, stream_context, upstream_response),
        media_type=media_type,
        headers={"Cache-Control": "no-store"},
    )


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
