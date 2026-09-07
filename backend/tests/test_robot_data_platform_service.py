import httpx

from backend.app.services import robot_data_platform_service as module
from backend.app.services.robot_data_platform_service import RobotDataPlatformService


DATASET_ID = "01977777-7777-7777-8777-777777777777"
EVALUATION_ID = "01944444-4444-7444-8444-444444444444"
EPISODE_ID = "01955555-5555-7555-8555-555555555555"
ARTIFACT_ID = "01922222-2222-7222-8222-222222222222"
INSPECTION_RUN_ID = "01988888-8888-7888-8888-888888888888"
INSPECTION_EPISODE_ID = "01999999-9999-7999-8999-999999999999"


def payload_for(path):
    if path in ("/data/v1/telemetry/latest", "/data/v1/telemetry/range"):
        return {"stream_name": "imu", "rows": [{"ax": 1.0}]}
    if path == "/data/v1/dataset-versions":
        return [{"dataset_version_id": DATASET_ID, "external_id": "release-v1",
                 "dataset_key": "panda", "schema_id": "release-v0", "content_sha256": "a" * 64,
                 "status": "released", "source_repo": "data-lab", "created_at": "now"}]
    if path == f"/data/v1/dataset-versions/{DATASET_ID}":
        return {"episodes": [{"split": "train"}, {"split": "benchmark"}],
                "evaluation_runs": [{"evaluation_run_id": EVALUATION_ID}],
                "processing_jobs": [{"processing_job_id": "job"}]}
    if path == "/data/v1/evaluation-runs":
        return [{"evaluation_run_id": EVALUATION_ID, "run_id": "run", "dataset_version_id": DATASET_ID,
                 "evaluation_kind": "reach_grasp_lift", "status": "completed",
                 "evidence_level": "runtime_observed", "report_object_uri": "s3://report",
                 "report_sha256": "b" * 64,
                 "result": {"stage_a_gt": {"identity": {"model_id": "model-v1"},
                                             "outcome": {"success": False}}}}]
    if path == f"/data/v1/evaluation-runs/{EVALUATION_ID}":
        return {"dataset_version": {"dataset_version_id": DATASET_ID, "external_id": "release-v1"},
                "run": {}, "failure_cases": [{"failure_case": {"failure_case_id": "failure"}}]}
    if path == "/data/v1/failure-cases":
        return [{"failure_case": {"failure_case_id": "failure", "evaluation_run_id": EVALUATION_ID,
                                   "failure_stage": "reach", "failure_reason": "did not close",
                                   "evidence": {"evidence_level": "runtime_observed"}},
                 "episode": {"episode_id": EPISODE_ID, "run_id": "run", "external_id": "eval/seed_42"}}]
    if path == f"/data/v1/episodes/{EPISODE_ID}":
        return {"episode": {"episode_id": EPISODE_ID}, "artifacts": [{
            "artifact_id": ARTIFACT_ID, "artifact_type": "policy_action_trace",
            "object_uri": "s3://robot-data/actions.jsonl", "sha256": "c" * 64,
        }]}
    if path == "/data/v1/runs":
        return {"run_id": INSPECTION_RUN_ID, "external_id": "inspection-run-002",
                "source_repo": "amr_warehouse_sim", "robot_ref": "my_robot",
                "status": "completed", "started_at": "start", "ended_at": "end"}
    if path == f"/data/v1/runs/{INSPECTION_RUN_ID}/lineage":
        return {"run": {"run_id": INSPECTION_RUN_ID}, "episodes": [{
            "episode": {"episode_id": INSPECTION_EPISODE_ID,
                        "schema_id": "gazebo-inspection-run-v1",
                        "metadata": {
                            "source_task_id": None, "source_trigger": "manual_cli",
                            "evidence_boundary": "Gazebo only",
                            "summary": {"total_points": 3, "completed_points": 3,
                                        "execution_failures": 0},
                            "points": [
                                {"point_id": "cabinet_a", "finding": {"level": "pass"}},
                                {"point_id": "pump_b", "finding": {"level": "warning"}},
                                {"point_id": "panel_c", "finding": {"level": "pass"}},
                            ],
                        }},
            "artifacts": [
                {"artifact_type": "inspection_rgb", "object_uri": "s3://rgb"},
                {"artifact_type": "inspection_report", "object_uri": "s3://report",
                 "sha256": "d" * 64},
            ],
            "dataset_versions": [{"dataset_version_id": DATASET_ID,
                                  "external_id": "inspection-run-002-v1"}],
            "processing_jobs": [{"processing_job_id": "inspection-job"}],
        }]}
    raise AssertionError(path)


class FakeClient:
    def __init__(self, *args, **kwargs): pass
    def __enter__(self): return self
    def __exit__(self, *args): return None
    def get(self, url):
        request = httpx.Request("GET", url)
        return httpx.Response(200, json=payload_for(request.url.path), request=request)


def test_platform_adapter_maps_real_ids_and_replay_locator(monkeypatch):
    monkeypatch.setattr(module.httpx, "Client", FakeClient)
    service = RobotDataPlatformService("http://platform/data/v1", 1, "http://hoc")
    datasets = service.dataset_versions()["data"]
    runs = service.evaluation_runs()["data"]
    failures = service.failure_cases()["data"]

    assert datasets[0]["dataset_version_id"] == DATASET_ID
    assert datasets[0]["split_counts"] == {"train": 1, "benchmark": 1}
    assert runs[0]["evaluation_run_id"] == EVALUATION_ID
    assert runs[0]["task_success_rate"] == 0.0
    assert failures[0]["episode_id"] == EPISODE_ID
    assert failures[0]["replay_artifact"]["artifact_id"] == ARTIFACT_ID
    assert f"episode_id={EPISODE_ID}" in failures[0]["replay_url"]
    assert "artifact_uri=s3%3A%2F%2Frobot-data%2Factions.jsonl" in failures[0]["replay_url"]


def test_platform_adapter_maps_amr_inspection_without_fabricating_task_or_failure(monkeypatch):
    monkeypatch.setattr(module.httpx, "Client", FakeClient)
    service = RobotDataPlatformService("http://platform/data/v1", 1, "http://hoc")

    run = service.inspection_runs("amr_warehouse_sim", "inspection-run-002")["data"][0]

    assert run["run_id"] == INSPECTION_RUN_ID
    assert run["source_run_id"] == "inspection-run-002"
    assert run["source_task_id"] is None
    assert run["source_trigger"] == "manual_cli"
    assert run["task_total"] == run["task_success"] == 3
    assert run["warning_count"] == 1
    assert run["warning_points"] == ["pump_b"]
    assert run["failure_case_ids"] == []
    assert run["artifact_count"] == 2
    assert run["report_sha256"] == "d" * 64


def test_telemetry_queries_stay_behind_platform_facade(monkeypatch):
    monkeypatch.setattr(module.httpx, "Client", FakeClient)
    service = RobotDataPlatformService("http://platform/data/v1", 1, "http://hoc")
    latest = service.telemetry_latest({"robot_id": "rob-1", "stream_name": "imu"})
    ranged = service.telemetry_range({
        "robot_id": "rob-1", "stream_name": "imu",
        "from": "2026-09-07T00:00:00Z", "to": "2026-09-07T00:01:00Z",
        "aggregation": "avg",
    })
    assert latest["rows"][0]["ax"] == 1.0
    assert ranged["stream_name"] == "imu"
