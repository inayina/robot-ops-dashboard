from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx


class RobotDataPlatformError(Exception):
    pass


class RobotDataPlatformService:
    """Read-only HTTP adapter from the Dashboard BFF to Robot Data Platform."""

    def __init__(self, base_url: str, timeout: float, hoc_base_url: str,
                 trust_env: bool = False) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.hoc_base_url = hoc_base_url.rstrip("/")
        self.trust_env = trust_env

    def _get(self, path: str) -> Any:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=self.timeout, trust_env=self.trust_env) as client:
                response = client.get(url)
        except httpx.RequestError as exc:
            raise RobotDataPlatformError(f"Platform request failed: {url}: {exc}") from exc
        if response.status_code != 200:
            raise RobotDataPlatformError(
                f"Platform {path} returned {response.status_code}: {response.text[:300]}"
            )
        try:
            return response.json()
        except ValueError as exc:
            raise RobotDataPlatformError(f"Platform {path} returned invalid JSON") from exc

    @staticmethod
    def _envelope(data: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "robot-platform-service",
            "data": data,
        }

    def dataset_versions(self) -> dict[str, Any]:
        versions = self._get("/dataset-versions")
        if not isinstance(versions, list):
            raise RobotDataPlatformError("Platform dataset version list must be an array")
        mapped = []
        for version in versions:
            detail = self._get(f"/dataset-versions/{version['dataset_version_id']}")
            episodes = detail.get("episodes") or []
            splits = Counter(str(item.get("split", "unknown")) for item in episodes)
            mapped.append({
                "dataset_version_id": version["dataset_version_id"],
                "dataset_version": version["external_id"],
                "dataset_key": version["dataset_key"],
                "dataset_type": version["schema_id"],
                "sample_count": len(episodes),
                "split_counts": dict(splits),
                "content_sha256": version["content_sha256"],
                "status": version["status"],
                "source_chain": f"{version['source_repo']} -> robot-platform-service",
                "storage_ref": "PostgreSQL metadata + MinIO artifact URIs",
                "is_mock": False,
                "evaluation_run_ids": [
                    item["evaluation_run_id"] for item in detail.get("evaluation_runs") or []
                ],
                "processing_job_ids": [
                    item["processing_job_id"] for item in detail.get("processing_jobs") or []
                ],
                "created_at": version.get("created_at"),
            })
        return self._envelope(mapped)

    def evaluation_runs(self) -> dict[str, Any]:
        evaluations = self._get("/evaluation-runs")
        if not isinstance(evaluations, list):
            raise RobotDataPlatformError("Platform evaluation run list must be an array")
        mapped = []
        for evaluation in evaluations:
            detail = self._get(f"/evaluation-runs/{evaluation['evaluation_run_id']}")
            result = evaluation.get("result") or {}
            task_result = result.get("stage_a_gt") or result
            outcome = task_result.get("outcome") or {}
            success = outcome.get("success")
            total = 1 if isinstance(success, bool) else _denominator(result)
            succeeded = (1 if success else 0) if isinstance(success, bool) else _numerator(result)
            failures = detail.get("failure_cases") or []
            version = detail["dataset_version"]
            mapped.append({
                "run_id": evaluation["evaluation_run_id"],
                "evaluation_run_id": evaluation["evaluation_run_id"],
                "execution_run_id": evaluation["run_id"],
                "run_type": "platform_evaluation",
                "scenario": evaluation["evaluation_kind"],
                "dataset_version_id": evaluation["dataset_version_id"],
                "dataset_version": version["external_id"],
                "model_version": task_result.get("identity", {}).get("model_id") or "recorded_external_model",
                "status": evaluation["status"],
                "task_total": total,
                "task_success": succeeded,
                "task_failed": len(failures),
                "task_success_rate": (succeeded / total) if total else None,
                "started_at": detail.get("run", {}).get("started_at"),
                "finished_at": detail.get("run", {}).get("ended_at"),
                "evidence_level": evaluation["evidence_level"],
                "report_uri": evaluation["report_object_uri"],
                "report_sha256": evaluation["report_sha256"],
                "result_scope": "platform_imported_existing_evaluation",
                "failure_case_ids": [item["failure_case"]["failure_case_id"] for item in failures],
            })
        return self._envelope(mapped)

    def failure_cases(self) -> dict[str, Any]:
        failures = self._get("/failure-cases")
        if not isinstance(failures, list):
            raise RobotDataPlatformError("Platform failure case list must be an array")
        mapped = []
        for item in failures:
            failure, episode = item["failure_case"], item["episode"]
            episode_view = self._get(f"/episodes/{episode['episode_id']}")
            evaluation_view = self._get(f"/evaluation-runs/{failure['evaluation_run_id']}")
            dataset_version = evaluation_view["dataset_version"]
            artifacts = episode_view.get("artifacts") or []
            replay_artifact = _pick_replay_artifact(artifacts)
            query = {
                "episode_id": episode["episode_id"],
                "evaluation_run_id": failure["evaluation_run_id"],
                "dataset_version_id": dataset_version["dataset_version_id"],
                "dataset_version": dataset_version["external_id"],
            }
            if replay_artifact:
                query["artifact_uri"] = replay_artifact["object_uri"]
                query["artifact_id"] = replay_artifact["artifact_id"]
            mapped.append({
                "failure_case_id": failure["failure_case_id"],
                "evaluation_run_id": failure["evaluation_run_id"],
                "run_id": episode["run_id"],
                "episode_id": episode["episode_id"],
                "episode_external_id": episode["external_id"],
                "failure_type": failure["failure_stage"],
                "failure_stage": failure["failure_stage"],
                "failure_reason": failure["failure_reason"],
                "severity": "warning",
                "summary": failure["failure_reason"],
                "evidence_level": (failure.get("evidence") or {}).get("evidence_level"),
                "artifacts": artifacts,
                "replay_artifact": replay_artifact,
                "episode_url": f"/api/evaluation/episodes/{episode['episode_id']}",
                "replay_url": f"{self.hoc_base_url}/?{urlencode(query)}",
                "replay_contract": "locator_only_hoc_does_not_auto_load_platform_artifact",
                "status": "open",
            })
        return self._envelope(mapped)

    def inspection_runs(self, source_repo: str, external_id: str) -> dict[str, Any]:
        query = urlencode({"source_repo": source_repo, "external_id": external_id})
        run = self._get(f"/runs?{query}")
        lineage = self._get(f"/runs/{run['run_id']}/lineage")
        episodes = lineage.get("episodes") or []
        if len(episodes) != 1:
            raise RobotDataPlatformError(
                "AMR inspection lineage must contain exactly one route Episode"
            )
        episode_view = episodes[0]
        episode = episode_view.get("episode") or {}
        metadata = episode.get("metadata") or {}
        points = metadata.get("points") or []
        if not isinstance(points, list):
            raise RobotDataPlatformError("AMR inspection points must be an array")
        summary = metadata.get("summary") or {}
        artifacts = episode_view.get("artifacts") or []
        versions = episode_view.get("dataset_versions") or []
        jobs = episode_view.get("processing_jobs") or []
        report = next(
            (item for item in artifacts if item.get("artifact_type") == "inspection_report"),
            None,
        )
        warnings = [
            point for point in points
            if (point.get("finding") or {}).get("level") == "warning"
        ]
        completed = int(summary.get("completed_points") or 0)
        total = int(summary.get("total_points") or len(points))
        mapped = {
            "run_id": run["run_id"],
            "execution_run_id": run["run_id"],
            "source_run_id": run["external_id"],
            "run_type": "platform_inspection",
            "scenario": episode.get("schema_id") or "amr_inspection",
            "robot_id": run.get("robot_ref"),
            "source_task_id": metadata.get("source_task_id"),
            "source_trigger": metadata.get("source_trigger"),
            "status": run.get("status"),
            "task_total": total,
            "task_success": completed,
            "task_failed": int(summary.get("execution_failures") or 0),
            "task_success_rate": (completed / total) if total else None,
            "warning_count": len(warnings),
            "warning_points": [point.get("point_id") for point in warnings],
            "inspection_points": points,
            "dataset_version_id": versions[0].get("dataset_version_id") if versions else None,
            "dataset_version": versions[0].get("external_id") if versions else None,
            "model_version": "amr_domain_owned_red_ratio_rule",
            "started_at": run.get("started_at"),
            "finished_at": run.get("ended_at"),
            "evidence_level": "simulation_runtime_verified",
            "evidence_boundary": metadata.get("evidence_boundary"),
            "report_uri": report.get("object_uri") if report else None,
            "report_sha256": report.get("sha256") if report else None,
            "artifact_count": len(artifacts),
            "processing_job_ids": [item.get("processing_job_id") for item in jobs],
            "result_scope": "platform_imported_existing_amr_inspection",
            "failure_case_ids": [],
        }
        return self._envelope([mapped])

    def episode(self, episode_id: str) -> dict[str, Any]:
        return self._get(f"/episodes/{episode_id}")

    def telemetry_latest(self, params: dict[str, str]) -> dict[str, Any]:
        """Read latest telemetry through Platform; never query TDengine here."""
        return self._get(f"/telemetry/latest?{urlencode(params)}")

    def telemetry_range(self, params: dict[str, str]) -> dict[str, Any]:
        """Read a bounded raw or aggregate range through Platform."""
        return self._get(f"/telemetry/range?{urlencode(params)}")


def _numerator(result: dict[str, Any]) -> int:
    try:
        return int((result.get("overall_success") or {}).get("numerator") or 0)
    except (TypeError, ValueError):
        return 0


def _denominator(result: dict[str, Any]) -> int:
    try:
        return int((result.get("overall_success") or {}).get("denominator") or 0)
    except (TypeError, ValueError):
        return 0


def _pick_replay_artifact(artifacts: list[dict[str, Any]]) -> dict[str, Any] | None:
    order = {
        "policy_action_trace": 0,
        "runtime_ground_truth_events": 1,
        "evaluation_episode_report": 2,
        "failure_video": 3,
    }
    candidates = [item for item in artifacts if item.get("object_uri")]
    return min(candidates, key=lambda item: order.get(str(item.get("artifact_type")), 99),
               default=None)
