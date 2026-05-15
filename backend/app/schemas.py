from typing import Any

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
