import httpx

from backend.app.services import robot_data_platform_service as module
from backend.app.services.robot_data_platform_service import RobotDataPlatformService


DATASET_ID = "01977777-7777-7777-8777-777777777777"
EVALUATION_ID = "01944444-4444-7444-8444-444444444444"
EPISODE_ID = "01955555-5555-7555-8555-555555555555"
ARTIFACT_ID = "01922222-2222-7222-8222-222222222222"


def payload_for(path):
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
