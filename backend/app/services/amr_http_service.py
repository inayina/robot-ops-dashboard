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

    This is intentionally small and keeps the dashboard integration at
    the HTTP boundary: health, task listing, and Mock WMS task creation.
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

    def _post_json(self, path: str, payload: dict[str, Any]) -> httpx.Response:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=self.timeout, trust_env=self.trust_env) as client:
                return client.post(url, json=payload)
        except ImportError as exc:
            raise AmrNetworkError(
                "HTTP client could not initialize. Local AMR calls should bypass proxy environment variables."
            ) from exc
        except httpx.RequestError as exc:
            raise AmrNetworkError(f"Failed to request {url}: {exc}") from exc

    def _json_payload(self, resp: httpx.Response, label: str, expected_statuses: set[int]) -> Any:
        if resp.status_code not in expected_statuses:
            detail = resp.text.strip()
            try:
                payload = resp.json()
                if isinstance(payload, dict):
                    detail = str(payload.get("detail") or payload)
                else:
                    detail = str(payload)
            except Exception:
                detail = detail or "<empty response>"

            raise AmrResponseError(
                f"AMR {label} returned {resp.status_code}: {detail}",
                status_code=resp.status_code,
            )

        try:
            return resp.json()
        except Exception as exc:
            raise AmrResponseError(f"Invalid JSON in AMR {label} response") from exc

    def fetch_amr_health(self) -> dict[str, Any]:
        resp = self._get("/health")

        payload = self._json_payload(resp, "health", {200})
        if not isinstance(payload, dict):
            raise AmrResponseError("Unexpected payload shape for AMR health")
        return payload

    def fetch_wms_tasks_payload(self) -> Any:
        resp = self._get("/tasks")
        return self._json_payload(resp, "/tasks", {200})

    def fetch_amr_tasks(self) -> List[dict[str, Any]]:
        payload = self.fetch_wms_tasks_payload()

        # Accept several common shapes: list, {"data": [...]}, {"tasks": [...]}
        if isinstance(payload, list):
            return payload

        if isinstance(payload, dict):
            if "data" in payload and isinstance(payload["data"], list):
                return payload["data"]
            if "tasks" in payload and isinstance(payload["tasks"], list):
                return payload["tasks"]

        raise AmrResponseError("Unexpected payload shape for AMR /tasks")

    def create_wms_task(self, payload: dict[str, Any]) -> tuple[int, Any]:
        resp = self._post_json("/tasks", payload)
        response_payload = self._json_payload(resp, "/tasks", {200, 201, 202})
        return resp.status_code, response_payload
