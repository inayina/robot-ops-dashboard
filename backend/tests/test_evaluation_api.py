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
    def inspection_runs(self, source_repo, external_id):
        return {"generated_at": "2026-09-07T00:00:00Z", "source": "robot-platform-service", "data": [{
            "run_id": "01a079d3-e264-74ad-ad29-cbae817b6353",
            "run_type": "platform_inspection",
            "source_repo": source_repo,
            "source_run_id": external_id,
            "source_task_id": None,
            "source_trigger": "manual_cli",
            "status": "completed",
            "task_total": 3,
            "task_success": 3,
            "warning_points": ["pump_b"],
        }]}

    def evaluation_runs(self):
        return {"generated_at": "2026-09-06T00:00:00Z", "source": "robot-platform-service", "data": [{
            "run_id": "01944444-4444-7444-8444-444444444444",
            "evaluation_run_id": "01944444-4444-7444-8444-444444444444",
            "run_type": "platform_evaluation", "dataset_version": "release-v1",
            "dataset_version_id": "01977777-7777-7777-8777-777777777777",
            "model_version": "model-v1", "result_scope": "platform_imported_existing_evaluation",
            "status": "completed", "task_total": 1, "task_success": 0,
            "task_failed": 1, "task_success_rate": 0.0,
        }]}

    def dataset_versions(self):
        return {"generated_at": "2026-09-06T00:00:00Z", "source": "robot-platform-service", "data": [{
            "dataset_version": "release-v1", "dataset_version_id": "01977777-7777-7777-8777-777777777777",
            "dataset_type": "release-v0", "sample_count": 50, "is_mock": False,
        }]}

    def failure_cases(self):
        return {"generated_at": "2026-09-06T00:00:00Z", "source": "robot-platform-service", "data": [{
            "failure_case_id": "01933333-3333-7333-8333-333333333333",
            "episode_id": "01955555-5555-7555-8555-555555555555",
            "failure_type": "reach", "summary": "gripper did not close",
            "replay_url": "http://127.0.0.1:8080/?episode_id=01955555-5555-7555-8555-555555555555",
        }]}

    def episode(self, episode_id):
        return {"episode": {"episode_id": episode_id}, "artifacts": []}


def test_evaluation_runs_api_returns_platform_contract(monkeypatch):
    monkeypatch.setattr(main, "get_robot_data_platform_service", FakePlatformService)
    resp = get("/api/evaluation/runs")
    body = resp.json()

    assert resp.status_code == 200
    assert body["source"] == "robot-platform-service"
    assert isinstance(body["data"], list)
    assert body["data"]
    for run in body["data"]:
        assert run["run_type"] == "platform_evaluation"
        assert "run_id" in run
        assert "dataset_version" in run
        assert "model_version" in run
        assert "result_scope" in run


def test_inspection_runs_api_preserves_source_provenance(monkeypatch):
    monkeypatch.setattr(main, "get_robot_data_platform_service", FakePlatformService)
    resp = get("/api/inspection/runs")
    body = resp.json()

    assert resp.status_code == 200
    assert body["source"] == "robot-platform-service"
    assert len(body["data"]) == 1
    run = body["data"][0]
    assert run["run_type"] == "platform_inspection"
    assert run["source_run_id"] == "inspection-run-002"
    assert run["source_task_id"] is None
    assert run["source_trigger"] == "manual_cli"
    assert run["warning_points"] == ["pump_b"]


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
        "failure_cases",
        "data_sources",
        "latest_status",
        "gpu_usage",
        "quality_checks",
    ]:
        assert field in body

    assert body["run_id"] == "eval_run_20260613_baseline_nav2_001"
    assert body["model_version"] == "baseline_nav2_no_learning"
    assert body["failure_count"] >= 1
    assert isinstance(body["failure_cases"], list)
    failure_case_ids = {case["failure_case_id"] for case in body["failure_cases"]}
    assert "failure_mock_station_b_blocked_001" in failure_case_ids
    assert isinstance(body["data_sources"], list)
    assert body["quality_checks"]["no_real_training_claim"] is True
    assert isinstance(body["live_run"], dict)
    assert body["live_run"]["result_scope"] == "live_dashboard_snapshot_plus_baseline_contract_not_model_training"
    assert body["live_run"]["quality_checks"]["live_task_count"] >= 0
    assert "reserved" in body["gpu_usage"]


def test_platform_dataset_failure_and_episode_routes(monkeypatch):
    monkeypatch.setattr(main, "get_robot_data_platform_service", FakePlatformService)
    for path in ["/api/evaluation/datasets", "/api/evaluation/failure-cases"]:
        resp = get(path)
        body = resp.json()
        assert resp.status_code == 200
        assert body["source"] == "robot-platform-service"
        assert isinstance(body["data"], list)
    episode_id = "01955555-5555-7555-8555-555555555555"
    resp = get(f"/api/evaluation/episodes/{episode_id}")
    assert resp.status_code == 200
    assert resp.json()["episode"]["episode_id"] == episode_id


def test_model_and_compute_routes_remain_explicit_mock_or_reserved():
    paths = ["/api/evaluation/models", "/api/evaluation/compute"]

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
