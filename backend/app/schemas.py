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


class SimPreviewResponse(BaseModel):
    source: str = Field(description="Simulation preview source type.")
    connection: Literal["connected", "disconnected"] = Field(description="Preview stream connection state.")
    stream_url: str | None = Field(default=None, description="Optional browser-readable preview stream URL.")
    last_update_at: str = Field(description="Preview status generation timestamp.")
    label: str = Field(description="Human-readable preview label.")


class MotorCommandRequest(BaseModel):
    target_rpm: float = Field(default=0.0, description="Requested motor target RPM.")
    target_speed_mps: float | None = Field(
        default=None,
        description="Optional wheel-end equivalent target speed in m/s for low-speed bench commands.",
    )
    direction: Literal["forward", "reverse", "stop"] = Field(
        default="forward",
        description="Requested bench direction label. The first dashboard version sends forward or stop only.",
    )
    enabled: bool = Field(default=True, description="Enable or disable the motor control path.")
    closed_loop: bool = Field(default=True, description="Whether the motor loop should remain in closed-loop mode.")
    max_pwm: float = Field(default=0.25, description="Maximum allowed PWM duty ratio.")
    timeout_ms: int = Field(default=800, description="Command timeout window in milliseconds.")
    stop: bool = Field(default=False, description="Emergency stop-style stop command; highest priority.")


class MotorCommandResponse(BaseModel):
    topic: str = Field(description="MQTT topic that received the command.")
    published_at: str = Field(description="Backend publish timestamp.")
    payload: dict[str, Any] = Field(description="Normalized command payload published to MQTT.")


TaskPointName = Literal["station_a", "station_b", "dock_a", "start_zone"]


class WmsTaskCreateRequest(BaseModel):
    task_type: str = Field(default="transport", min_length=1, max_length=64)
    pickup: TaskPointName = Field(description="Pickup point selected by the dashboard form.")
    dropoff: TaskPointName = Field(description="Dropoff point forwarded to AMR Mock WMS as target_name.")
