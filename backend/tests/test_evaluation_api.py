import asyncio

import httpx
from backend.app import main


async def _get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.get(path)


def get(path: str) -> httpx.Response:
    return asyncio.run(_get(path))


def test_evaluation_runs_api_returns_mock_baseline_contract():
    resp = get("/api/evaluation/runs")
    body = resp.json()

    assert resp.status_code == 200
    assert body["source"] == "mock_robot_data_evaluation_runs"
    assert isinstance(body["data"], list)
    assert body["data"]

    allowed_run_types = {"mock_evaluation", "baseline_system_evaluation", "interface_reserved"}
    for run in body["data"]:
        assert run["run_type"] in allowed_run_types
        assert "run_id" in run
        assert "dataset_version" in run
        assert "model_version" in run
        assert "result_scope" in run

    reserved_run = next(run for run in body["data"] if run["run_type"] == "interface_reserved")
    assert reserved_run["task_success_rate"] is None
    assert "reserved" in reserved_run["result_scope"]


def test_evaluation_summary_returns_core_fields():
    resp = get("/api/evaluation/summary")
    body = resp.json()

    assert resp.status_code == 200
    for field in [
        "run_id",
        "dataset_version",
        "model_version",
        "task_success_rate",
        "failure_count",
        "data_sources",
        "latest_status",
        "gpu_usage",
        "quality_checks",
    ]:
        assert field in body

    assert body["run_id"] == "eval_run_20260613_baseline_nav2_001"
    assert body["model_version"] == "baseline_nav2_no_learning"
    assert body["failure_count"] == 1
    assert isinstance(body["data_sources"], list)
    assert body["quality_checks"]["no_real_training_claim"] is True
    assert "reserved" in body["gpu_usage"]


def test_evaluation_registry_and_compute_routes_are_read_only_payloads():
    paths = [
        "/api/evaluation/datasets",
        "/api/evaluation/models",
        "/api/evaluation/failure-cases",
        "/api/evaluation/compute",
    ]

    for path in paths:
        resp = get(path)
        body = resp.json()
        assert resp.status_code == 200
        assert body["source"].startswith("mock_robot_data_")
        assert isinstance(body["generated_at"], str)
        assert isinstance(body["data"], list)


def test_model_registry_marks_reserved_vla_as_not_trained():
    resp = get("/api/evaluation/models")
    body = resp.json()

    reserved = next(item for item in body["data"] if item["model_version"] == "vla_interface_reserved")
    nav2_baseline = next(item for item in body["data"] if item["model_version"] == "nav2_baseline_no_ml_v0")

    assert reserved["training_status"] == "reserved_only"
    assert reserved["metrics_available"] is False
    assert nav2_baseline["training_status"] == "not_trained"
    assert "not an ML model" in nav2_baseline["notes"]


def test_compute_usage_does_not_fake_gpu_metrics():
    resp = get("/api/evaluation/compute")
    body = resp.json()

    gpu = next(item for item in body["data"] if item["resource_type"] == "gpu")
    assert gpu["gpu_status"] == "not_connected"
    assert gpu["gpu_name"] is None
    assert gpu["gpu_utilization_pct"] is None
    assert gpu["gpu_memory_used_mb"] is None
