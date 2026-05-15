import json
from json import JSONDecodeError
from pathlib import Path
from typing import Any


class MockDataError(Exception):
    """Base exception for mock data access failures."""

    def __init__(self, detail: str, path: Path, error_type: str) -> None:
        super().__init__(detail)
        self.detail = detail
        self.path = path
        self.error_type = error_type


class MockDataFileNotFoundError(MockDataError):
    """Raised when a mock JSON file is missing."""

    def __init__(self, path: Path) -> None:
        detail = f"Mock data file not found: {path}"
        super().__init__(detail=detail, path=path, error_type="mock_file_not_found")


class MockDataParseError(MockDataError):
    """Raised when a mock JSON file cannot be parsed."""

    def __init__(self, path: Path, original_error: JSONDecodeError) -> None:
        detail = f"Failed to parse mock JSON: {original_error.msg}"
        super().__init__(detail=detail, path=path, error_type="mock_json_parse_error")


class MockDataService:
    """Provides read-only access to local mock JSON payloads."""

    def load_payload(self, path: Path) -> dict[str, Any]:
        if not path.exists():
            raise MockDataFileNotFoundError(path)

        try:
            with path.open("r", encoding="utf-8") as file:
                payload = json.load(file)
        except JSONDecodeError as error:
            raise MockDataParseError(path, error) from error

        if not isinstance(payload, dict):
            detail = "Mock JSON root must be an object."
            raise MockDataError(detail=detail, path=path, error_type="mock_json_invalid_shape")

        return payload
