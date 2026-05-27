from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager
from urllib.parse import urlparse

import httpx


class MjpegStreamProxyError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class MjpegStreamProxy:
    """HTTP-only MJPEG proxy for simulation preview streams."""

    def __init__(
        self,
        upstream_url: str,
        timeout_seconds: float,
        trust_env: bool = False,
    ) -> None:
        self.upstream_url = upstream_url.strip()
        self.timeout_seconds = timeout_seconds
        self.trust_env = trust_env

    def is_configured(self) -> bool:
        return bool(self.upstream_url)

    def validate(self) -> None:
        if not self.upstream_url:
            raise MjpegStreamProxyError(
                "SIM_PREVIEW_MJPEG_URL or GAZEBO_CAMERA_MJPEG_URL is not configured.",
                status_code=503,
            )

        parsed = urlparse(self.upstream_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise MjpegStreamProxyError(
                "SIM_PREVIEW_MJPEG_URL or GAZEBO_CAMERA_MJPEG_URL must be an absolute http(s) URL.",
                status_code=500,
            )

    async def open_stream(
        self,
    ) -> tuple[
        httpx.AsyncClient,
        AbstractAsyncContextManager[httpx.Response],
        httpx.Response,
    ]:
        self.validate()
        timeout = httpx.Timeout(
            timeout=self.timeout_seconds,
            connect=self.timeout_seconds,
            read=None,
        )
        client = httpx.AsyncClient(
            timeout=timeout,
            trust_env=self.trust_env,
            follow_redirects=True,
        )
        stream_context = client.stream(
            "GET",
            self.upstream_url,
            headers={"accept": "multipart/x-mixed-replace,image/jpeg,*/*"},
        )

        try:
            response = await stream_context.__aenter__()
        except httpx.RequestError as exc:
            await client.aclose()
            raise MjpegStreamProxyError(f"Failed to connect to MJPEG upstream: {exc}", status_code=502) from exc

        if response.status_code >= 400:
            await stream_context.__aexit__(None, None, None)
            await client.aclose()
            raise MjpegStreamProxyError(
                f"MJPEG upstream returned HTTP {response.status_code}.",
                status_code=502,
            )

        return client, stream_context, response

    async def iter_chunks(
        self,
        client: httpx.AsyncClient,
        stream_context: AbstractAsyncContextManager[httpx.Response],
        response: httpx.Response,
    ) -> AsyncIterator[bytes]:
        try:
            async for chunk in response.aiter_bytes():
                if chunk:
                    yield chunk
        finally:
            await stream_context.__aexit__(None, None, None)
            await client.aclose()
