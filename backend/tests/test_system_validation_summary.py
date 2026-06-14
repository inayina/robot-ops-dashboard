import asyncio

import httpx
from backend.app import main


async def _get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


def get(path: str) -> httpx.Response:
    return asyncio.run(_get(path))


def test_system_validation_summary_exposes_validation_metrics_and_evidence_links():
    resp = get("/api/evaluation/summary")
    body = resp.json()

    assert resp.status_code == 200
    assert "validation_metrics" in body
    assert "evidence_links" in body

    validation_metrics = body["validation_metrics"]
    for field in [
        "amr_e2e_status",
        "dashboard_api_status",
        "websocket_status",
        "mqtt_telemetry_status",
        "motor_bench_status",
        "no_real_training_claim",
    ]:
        assert field in validation_metrics
        assert field in body

    assert validation_metrics["no_real_training_claim"] is True
    assert body["no_real_training_claim"] is True
    assert isinstance(body["evidence_links"], list)

    evidence_paths = {item["path"] for item in body["evidence_links"]}
    assert "amr_warehouse_navigation/docs/acceptance_checklist.md" in evidence_paths
    assert (
        "amr_warehouse_navigation/docs/wms/reports/"
        "mock_wms_http_executor_end_to_end_validation_2026_05_14.md"
    ) in evidence_paths
    assert "robot-ops-dashboard/backend/tests/test_evaluation_api.py" in evidence_paths
    assert "ros2-robot-digital-twin/scripts/check_real_hw_chain.sh" in evidence_paths
