from backend.app.services.task_mapper import (
    infer_progress_from_dashboard_status,
    map_amr_status_to_dashboard_status,
    map_amr_task_to_dashboard_task,
    normalize_progress,
)


def test_status_mapping_known():
    assert map_amr_status_to_dashboard_status("pending") == "queued"
    assert map_amr_status_to_dashboard_status("running") == "running"
    assert map_amr_status_to_dashboard_status("succeeded") == "completed"
    assert map_amr_status_to_dashboard_status("failed") == "failed"
    assert map_amr_status_to_dashboard_status("cancelled") == "cancelled"


def test_status_mapping_unknown_defaults_blocked():
    assert map_amr_status_to_dashboard_status(None) == "blocked"
    assert map_amr_status_to_dashboard_status("weird_status") == "blocked"


def test_progress_mapping_uses_upstream_value_first():
    assert normalize_progress(45, fallback_status="completed") == 45
    assert normalize_progress("72.4", fallback_status="running") == 72
    assert normalize_progress(200, fallback_status="running") == 100
    assert normalize_progress(-1, fallback_status="running") == 0


def test_progress_mapping_falls_back_to_status():
    assert infer_progress_from_dashboard_status("queued") == 0
    assert infer_progress_from_dashboard_status("dispatching") == 20
    assert infer_progress_from_dashboard_status("running") == 50
    assert infer_progress_from_dashboard_status("blocked") == 50
    assert infer_progress_from_dashboard_status("completed") == 100
    assert infer_progress_from_dashboard_status("failed") == 100
    assert infer_progress_from_dashboard_status("cancelled") == 100


def test_map_task_fields():
    raw = {
        "id": "T-1",
        "order": "ORD-1",
        "assigned_robot": "R-1",
        "type": "transfer",
        "priority": "high",
        "status": "running",
        "percent": 45,
        "from": "A1",
        "to": "B2",
        "created": "2026-05-16T01:00:00Z",
        "labels": ["amr"],
    }

    mapped = map_amr_task_to_dashboard_task(raw)
    assert mapped["task_id"] == "T-1"
    assert mapped["order_id"] == "ORD-1"
    assert mapped["robot_id"] == "R-1"
    assert mapped["task_type"] == "transfer"
    assert mapped["status"] == "running"
    assert mapped["source_status"] == "running"
    assert mapped["progress"] == 45
    assert mapped["pickup_station"] == "A1"
    assert mapped["dropoff_station"] == "B2"
    assert mapped["labels"] == ["amr"]


def test_map_amr_http_fields_from_mock_wms():
    raw = {
        "id": 3,
        "task_name": "live-validation-20260513-station-b",
        "target_name": "station_b",
        "status": "succeeded",
        "status_reason": "NavigateToPose result: SUCCEEDED.",
        "created_at": "2026-05-13T14:00:04Z",
        "updated_at": "2026-05-13T14:03:46Z",
    }

    mapped = map_amr_task_to_dashboard_task(raw)
    assert mapped["task_id"] == "live-validation-20260513-station-b"
    assert mapped["dropoff_station"] == "station_b"
    assert mapped["status"] == "completed"
    assert mapped["source_status"] == "succeeded"
    assert mapped["progress"] == 100
    assert mapped["blocked_reason"] == "NavigateToPose result: SUCCEEDED."
    assert mapped["last_event"] == "NavigateToPose result: SUCCEEDED."


def test_map_dashboard_wms_task_name_restores_route_fields():
    raw = {
        "task_name": "dashboard_transport_start_zone_to_station_a_20260614T031800Z",
        "target_name": "station_a",
        "status": "pending",
        "created_at": "2026-06-14T03:18:00Z",
    }

    mapped = map_amr_task_to_dashboard_task(raw)

    assert mapped["task_type"] == "transport"
    assert mapped["pickup_station"] == "start_zone"
    assert mapped["dropoff_station"] == "station_a"
