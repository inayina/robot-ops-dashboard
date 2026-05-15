from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
from .schemas import ErrorResponse, HealthResponse, MockEnvelope
from .services.mock_data_service import MockDataError, MockDataService

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


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=APP_NAME,
        version=APP_VERSION,
        mode="mock-json",
    )


@app.get("/api/tasks", response_model=MockEnvelope)
async def get_tasks() -> MockEnvelope:
    payload = mock_data_service.load_payload(TASKS_FILE)
    return MockEnvelope(**payload)


@app.get("/api/device-status", response_model=MockEnvelope)
async def get_device_status() -> MockEnvelope:
    payload = mock_data_service.load_payload(DEVICE_STATUS_FILE)
    return MockEnvelope(**payload)


@app.get("/api/alerts", response_model=MockEnvelope)
async def get_alerts() -> MockEnvelope:
    payload = mock_data_service.load_payload(ALERTS_FILE)
    return MockEnvelope(**payload)
