import asyncio

import httpx

from backend.app import main


async def _get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


def get(path: str) -> httpx.Response:
    return asyncio.run(_get(path))


class FakePlatformService:
    calls = []

    def telemetry_latest(self, params):
        self.calls.append(("latest", params))
        return {"stream_name": params["stream_name"], "rows": []}

    def telemetry_range(self, params):
        self.calls.append(("range", params))
        return {"stream_name": params["stream_name"], "rows": []}


def test_telemetry_routes_proxy_only_whitelisted_query_parameters(monkeypatch):
    FakePlatformService.calls = []
    monkeypatch.setattr(main, "get_robot_data_platform_service", FakePlatformService)

    latest = get("/api/telemetry/latest?robot_id=rob-1&stream_name=imu&secret=no")
    ranged = get(
        "/api/telemetry/range?robot_id=rob-1&stream_name=runtime_metrics"
        "&from=2026-09-07T00%3A00%3A00Z&to=2026-09-07T00%3A01%3A00Z"
        "&aggregation=avg&window=1s&limit=20&secret=no"
    )

    assert latest.status_code == 200
    assert ranged.status_code == 200
    assert FakePlatformService.calls[0] == (
        "latest", {"robot_id": "rob-1", "stream_name": "imu"}
    )
    assert FakePlatformService.calls[1][0] == "range"
    assert "secret" not in FakePlatformService.calls[1][1]
    assert FakePlatformService.calls[1][1]["aggregation"] == "avg"
