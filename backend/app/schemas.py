from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(description="Current backend health status.")
    service: str = Field(description="Backend service name.")
    version: str = Field(description="Backend version.")
    mode: str = Field(description="Current data mode.")


class ErrorResponse(BaseModel):
    error_type: str = Field(description="Machine-readable error category.")
    detail: str = Field(description="Human-readable error detail.")
    path: str = Field(description="Related filesystem path.")


class MockEnvelope(BaseModel):
    generated_at: str = Field(description="Mock payload generation timestamp.")
    source: str = Field(description="Payload source description.")
    data: list[dict[str, Any]] = Field(description="Payload data list.")


class DashboardStatusMessage(BaseModel):
    type: str = Field(default="dashboard_status", description="WebSocket message type.")
    timestamp: str = Field(description="Status snapshot timestamp.")
    tasks: list[dict[str, Any]] = Field(description="Dashboard task list snapshot.")
    robot: dict[str, Any] = Field(description="Robot status snapshot.")
    motor: dict[str, Any] | None = Field(default=None, description="Latest MQTT motor state snapshot.")
    imu: dict[str, Any] | None = Field(default=None, description="Latest MQTT IMU state snapshot.")


class RobotStatusResponse(BaseModel):
    generated_at: str = Field(description="Robot status response generation timestamp.")
    source: str = Field(description="Robot telemetry source description.")
    connection: dict[str, Any] = Field(description="MQTT connection state.")
    topics: dict[str, dict[str, Any] | None] = Field(description="Latest cached MQTT message by topic.")
    robot: dict[str, Any] = Field(description="Latest normalized robot status assembled from MQTT topics.")


TaskPointName = Literal["station_a", "station_b", "dock_a", "start_zone"]


class WmsTaskCreateRequest(BaseModel):
    task_type: str = Field(default="transport", min_length=1, max_length=64)
    pickup: TaskPointName = Field(description="Pickup point selected by the dashboard form.")
    dropoff: TaskPointName = Field(description="Dropoff point forwarded to AMR Mock WMS as target_name.")
