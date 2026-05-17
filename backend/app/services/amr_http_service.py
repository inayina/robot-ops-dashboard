from typing import Any, List
import httpx

from ..config import AMR_API_BASE_URL, AMR_HTTP_TIMEOUT_SECONDS


class AmrHttpError(Exception):
    pass


class AmrNetworkError(AmrHttpError):
    pass


class AmrResponseError(AmrHttpError):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class AmrHttpService:
    """Simple HTTP client for upstream AMR Mock WMS HTTP API.

    This is intentionally small and only implements the read-only calls
    needed by the dashboard: health and tasks.
    """

    def __init__(
        self,
        base_url: str | None = None,
        timeout: int | None = None,
        trust_env: bool = False,
    ) -> None:
        self.base_url = (base_url or AMR_API_BASE_URL).rstrip("/")
        self.timeout = timeout if timeout is not None else AMR_HTTP_TIMEOUT_SECONDS
        self.trust_env = trust_env

    def _get(self, path: str) -> httpx.Response:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=self.timeout, trust_env=self.trust_env) as client:
                return client.get(url)
        except ImportError as exc:
            raise AmrNetworkError(
                "HTTP client could not initialize. Local AMR calls should bypass proxy environment variables."
            ) from exc
        except httpx.RequestError as exc:
            raise AmrNetworkError(f"Failed to request {url}: {exc}") from exc

    def fetch_amr_health(self) -> dict[str, Any]:
        resp = self._get("/health")

        if resp.status_code != 200:
            raise AmrResponseError(f"AMR health returned {resp.status_code}", status_code=resp.status_code)

        try:
            return resp.json()
        except Exception as exc:
            raise AmrResponseError("Invalid JSON in AMR health response") from exc

    def fetch_amr_tasks(self) -> List[dict[str, Any]]:
        resp = self._get("/tasks")

        if resp.status_code != 200:
            raise AmrResponseError(f"AMR /tasks returned {resp.status_code}", status_code=resp.status_code)

        try:
            payload = resp.json()
        except Exception as exc:
            raise AmrResponseError("Invalid JSON in AMR /tasks response") from exc

        # Accept several common shapes: list, {"data": [...]}, {"tasks": [...]}
        if isinstance(payload, list):
            return payload

        if isinstance(payload, dict):
            if "data" in payload and isinstance(payload["data"], list):
                return payload["data"]
            if "tasks" in payload and isinstance(payload["tasks"], list):
                return payload["tasks"]

        raise AmrResponseError("Unexpected payload shape for AMR /tasks")
