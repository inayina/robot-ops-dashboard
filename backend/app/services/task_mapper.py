from typing import Any


def map_amr_status_to_dashboard_status(status: str | None) -> str:
    if not status:
        return "blocked"

    s = str(status).strip().lower()
    mapping = {
        "pending": "queued",
        "queued": "queued",
        "dispatching": "dispatching",
        "running": "running",
        "in_progress": "running",
        "succeeded": "completed",
        "success": "completed",
        "completed": "completed",
        "failed": "failed",
        "error": "failed",
        "cancelled": "cancelled",
        "canceled": "cancelled",
        "blocked": "blocked",
        "unknown": "blocked",
    }

    return mapping.get(s, "blocked")


def infer_progress_from_dashboard_status(status: str) -> int:
    progress_by_status = {
        "queued": 0,
        "dispatching": 20,
        "running": 50,
        "blocked": 50,
        "completed": 100,
        "failed": 100,
        "cancelled": 100,
    }

    return progress_by_status.get(status, 0)


def normalize_progress(value: Any, fallback_status: str) -> int:
    if value is None or value == "":
        return infer_progress_from_dashboard_status(fallback_status)

    try:
        progress = float(value)
    except (TypeError, ValueError):
        return infer_progress_from_dashboard_status(fallback_status)

    return round(max(0, min(100, progress)))


TASK_POINTS = ("station_a", "station_b", "dock_a", "start_zone")


def parse_dashboard_task_name(task_name: Any) -> dict[str, str]:
    if not isinstance(task_name, str) or not task_name.startswith("dashboard_"):
        return {}

    body = task_name[len("dashboard_") :]
    for pickup in TASK_POINTS:
        marker = f"_{pickup}_to_"
        marker_index = body.find(marker)
        if marker_index == -1:
            continue

        rest = body[marker_index + len(marker) :]
        dropoff = next((point for point in TASK_POINTS if rest == point or rest.startswith(f"{point}_")), "")
        return {
            "task_type": body[:marker_index],
            "pickup_station": pickup,
            "dropoff_station": dropoff,
        }

    return {}


def map_amr_task_to_dashboard_task(raw_task: dict[str, Any]) -> dict[str, Any]:
    """Map a raw AMR task (unknown shape) into the Dashboard Task contract.

    The mapper tries common key names and falls back to None for missing fields.
    """

    def _first(*keys, default=None):
        for k in keys:
            if k in raw_task and raw_task[k] is not None:
                return raw_task[k]
        return default

    source_status = _first("source_status", "status", "state")
    dashboard_status = map_amr_status_to_dashboard_status(source_status)
    task_name = _first("task_id", "task_name", "id", "wms_task_id")
    task_name_meta = parse_dashboard_task_name(task_name)
    progress = normalize_progress(
        _first("progress", "percent"),
        fallback_status=dashboard_status,
    )

    mapped = {
        "task_id": task_name,
        "order_id": _first("order_id", "order", "business_id"),
        "robot_id": _first("robot_id", "assigned_robot", "robot"),
        "task_type": _first("task_type", "type", "job_type", default=task_name_meta.get("task_type")),
        "priority": _first("priority", "urgency"),
        "status": dashboard_status,
        "source_status": source_status,
        "progress": progress,
        "pickup_station": _first(
            "pickup_station",
            "from",
            "source_location",
            default=task_name_meta.get("pickup_station") or "start_zone",
        ),
        "dropoff_station": _first("dropoff_station", "to", "target_location", "target_name", default=task_name_meta.get("dropoff_station")),
        "created_at": _first("created_at", "created", "created_time"),
        "assigned_at": _first("assigned_at", "assigned", "assigned_time"),
        "started_at": _first("started_at", "started", "start_time"),
        "updated_at": _first("updated_at", "updated", "updated_time"),
        "due_at": _first("due_at", "due", "due_time"),
        "blocked_reason": _first("blocked_reason", "blocking_reason", "status_reason"),
        "last_event": _first("last_event", "event", "status_reason"),
        "labels": _first("labels", default=[]) or [],
    }

    return mapped
