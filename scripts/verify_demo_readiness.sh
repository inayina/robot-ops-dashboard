#!/usr/bin/env bash

set -u

DASHBOARD_API_BASE_URL="${DASHBOARD_API_BASE_URL:-http://127.0.0.1:9000}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:8001/frontend/}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-5}"
VERIFY_OPTIONAL_WRITE_ENDPOINTS="${VERIFY_OPTIONAL_WRITE_ENDPOINTS:-false}"

DASHBOARD_API_BASE_URL="${DASHBOARD_API_BASE_URL%/}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ -z "${PYTHON_BIN:-}" ]]; then
  if [[ -x "$PROJECT_ROOT/.venv/bin/python" ]]; then
    PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python"
  else
    PYTHON_BIN="python3"
  fi
fi

if [[ -z "${WS_STATUS_URL:-}" ]]; then
  if [[ "$DASHBOARD_API_BASE_URL" == https://* ]]; then
    WS_STATUS_URL="wss://${DASHBOARD_API_BASE_URL#https://}/ws/status"
  else
    WS_STATUS_URL="ws://${DASHBOARD_API_BASE_URL#http://}/ws/status"
  fi
fi

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS %s\n' "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf 'WARN %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf 'FAIL %s\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'FAIL required command not found: %s\n' "$1"
    exit 127
  fi
}

http_get() {
  local url=$1
  local output_path=$2
  local http_code

  http_code="$(
    curl \
      --silent \
      --show-error \
      --noproxy '*' \
      --max-time "$CURL_TIMEOUT_SECONDS" \
      --output "$output_path" \
      --write-out '%{http_code}' \
      "$url" 2>/dev/null
  )"
  local curl_status=$?

  if [ "$curl_status" -ne 0 ]; then
    printf 'curl_error'
    return 1
  fi

  printf '%s' "$http_code"
}

http_post_json() {
  local url=$1
  local payload=$2
  local output_path=$3
  local http_code

  http_code="$(
    curl \
      --silent \
      --show-error \
      --noproxy '*' \
      --max-time "$CURL_TIMEOUT_SECONDS" \
      --request POST \
      --header 'Content-Type: application/json' \
      --data "$payload" \
      --output "$output_path" \
      --write-out '%{http_code}' \
      "$url" 2>/dev/null
  )"
  local curl_status=$?

  if [ "$curl_status" -ne 0 ]; then
    printf 'curl_error'
    return 1
  fi

  printf '%s' "$http_code"
}

check_http_200() {
  local label=$1
  local url=$2
  local output_path=$3
  local http_code

  http_code="$(http_get "$url" "$output_path")"
  if [ "$http_code" = "200" ]; then
    pass "$label $url"
    return 0
  fi

  fail "$label $url HTTP=$http_code"
  return 1
}

check_optional_http_200() {
  local label=$1
  local url=$2
  local output_path=$3
  local http_code

  http_code="$(http_get "$url" "$output_path")"
  if [ "$http_code" = "200" ]; then
    pass "$label $url"
    return 0
  fi

  warn "$label unavailable or not configured $url HTTP=$http_code"
  return 1
}

check_body_contains() {
  local label=$1
  local output_path=$2
  local pattern=$3

  if grep -F "$pattern" "$output_path" >/dev/null 2>&1; then
    pass "$label contains $pattern"
    return 0
  fi

  fail "$label missing $pattern"
  return 1
}

check_ws_status() {
  local url=$1

  "$PYTHON_BIN" - "$url" "$CURL_TIMEOUT_SECONDS" <<'PY'
import asyncio
import json
import sys

url = sys.argv[1]
timeout = float(sys.argv[2])

try:
    import websockets
except Exception as exc:
    print(f"websockets_import_error: {exc}")
    sys.exit(2)

async def main() -> None:
    async with websockets.connect(url, open_timeout=timeout, close_timeout=1) as ws:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        payload = json.loads(raw)
        required = ["type", "timestamp", "tasks", "robot"]
        missing = [key for key in required if key not in payload]
        if missing:
            raise RuntimeError(f"missing keys: {', '.join(missing)}")
        if payload.get("type") != "dashboard_status":
            raise RuntimeError(f"unexpected type: {payload.get('type')}")
        if not isinstance(payload.get("tasks"), list):
            raise RuntimeError("tasks is not a list")
        if not isinstance(payload.get("robot"), dict):
            raise RuntimeError("robot is not an object")
        print(
            "dashboard_status "
            f"tasks={len(payload.get('tasks') or [])} "
            f"robot_status={payload.get('robot', {}).get('status', '-')}"
        )

asyncio.run(main())
PY
  local ws_status=$?

  if [ "$ws_status" -eq 0 ]; then
    pass "WebSocket /ws/status $url"
    return 0
  fi

  fail "WebSocket /ws/status $url"
  return 1
}

check_optional_writes() {
  local tmp_dir=$1
  local wms_post_json="$tmp_dir/wms_post.json"
  local motor_cmd_json="$tmp_dir/motor_cmd.json"
  local http_code

  if [ "$VERIFY_OPTIONAL_WRITE_ENDPOINTS" != "true" ]; then
    warn "optional write checks skipped; set VERIFY_OPTIONAL_WRITE_ENDPOINTS=true to test POST /api/wms/tasks and POST /api/robot/motor/cmd"
    return 0
  fi

  http_code="$(
    http_post_json \
      "$DASHBOARD_API_BASE_URL/api/wms/tasks" \
      '{"task_type":"transport","pickup":"start_zone","dropoff":"station_a"}' \
      "$wms_post_json"
  )"
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    pass "Optional POST /api/wms/tasks HTTP=$http_code"
  else
    warn "Optional POST /api/wms/tasks unavailable HTTP=$http_code"
  fi

  http_code="$(
    http_post_json \
      "$DASHBOARD_API_BASE_URL/api/robot/motor/cmd" \
      '{"target_rpm":0,"target_speed_mps":0,"direction":"stop","enabled":false,"closed_loop":true,"max_pwm":0,"timeout_ms":100,"stop":true}' \
      "$motor_cmd_json"
  )"
  if [ "$http_code" = "200" ]; then
    pass "Optional POST /api/robot/motor/cmd stop command HTTP=200"
  else
    warn "Optional POST /api/robot/motor/cmd unavailable HTTP=$http_code"
  fi
}

main() {
  require_command curl
  require_command grep
  require_command mktemp
  require_command "$PYTHON_BIN"

  local tmp_dir
  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/robot_ops_demo_readiness.XXXXXX")"
  trap "rm -rf '$tmp_dir'" EXIT

  local health_json="$tmp_dir/health.json"
  local tasks_json="$tmp_dir/tasks.json"
  local robot_status_json="$tmp_dir/robot_status.json"
  local sim_preview_json="$tmp_dir/sim_preview.json"
  local evaluation_summary_json="$tmp_dir/evaluation_summary.json"
  local wms_tasks_json="$tmp_dir/wms_tasks.json"
  local frontend_html="$tmp_dir/frontend.html"

  printf 'Demo readiness check\n'
  printf 'Dashboard API: %s\n' "$DASHBOARD_API_BASE_URL"
  printf 'Frontend URL:  %s\n' "$FRONTEND_URL"
  printf 'WebSocket URL: %s\n' "$WS_STATUS_URL"
  printf 'Python:        %s\n' "$PYTHON_BIN"
  printf '\n'

  if check_http_200 "Dashboard health" "$DASHBOARD_API_BASE_URL/health" "$health_json"; then
    check_body_contains "Dashboard health" "$health_json" '"status":"ok"'
  fi

  if check_http_200 "Dashboard tasks API" "$DASHBOARD_API_BASE_URL/api/tasks" "$tasks_json"; then
    check_body_contains "Dashboard tasks API" "$tasks_json" '"source"'
    check_body_contains "Dashboard tasks API" "$tasks_json" '"data"'
  fi

  if check_http_200 "Robot status API" "$DASHBOARD_API_BASE_URL/api/robot/status" "$robot_status_json"; then
    check_body_contains "Robot status API" "$robot_status_json" '"connection"'
    check_body_contains "Robot status API" "$robot_status_json" '"robot"'
    check_body_contains "Robot status API" "$robot_status_json" '"topics"'
  fi

  if check_http_200 "Simulation preview API" "$DASHBOARD_API_BASE_URL/api/sim/preview" "$sim_preview_json"; then
    check_body_contains "Simulation preview API" "$sim_preview_json" '"connection"'
    check_body_contains "Simulation preview API" "$sim_preview_json" '"source"'
    check_body_contains "Simulation preview API" "$sim_preview_json" '"label"'
  fi

  if check_http_200 "Evaluation summary API" "$DASHBOARD_API_BASE_URL/api/evaluation/summary" "$evaluation_summary_json"; then
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"run_id"'
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"dataset_version"'
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"model_version"'
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"task_success_rate"'
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"failure_cases"'
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"quality_checks"'
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"gpu_usage"'
  fi

  if check_http_200 "Frontend page" "$FRONTEND_URL" "$frontend_html"; then
    check_body_contains "Frontend page" "$frontend_html" "Simulation Preview"
    check_body_contains "Frontend page" "$frontend_html" "System Evaluation & Validation Layer"
    check_body_contains "Frontend page" "$frontend_html" "evalNoTrainingClaim"
    check_body_contains "Frontend page" "$frontend_html" "Offline / Mock Preview"
  fi

  check_ws_status "$WS_STATUS_URL"
  check_optional_http_200 "Optional GET /api/wms/tasks" "$DASHBOARD_API_BASE_URL/api/wms/tasks" "$wms_tasks_json"
  check_optional_writes "$tmp_dir"

  printf '\n'
  printf 'Summary: PASS=%s WARN=%s FAIL=%s\n' "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"

  if [ "$FAIL_COUNT" -ne 0 ]; then
    printf 'Readiness result: FAIL\n'
    printf 'Hint: unavailable ROS 2/Gazebo/hardware is acceptable only when the API and UI explicitly label it Mock / Offline / Reserved.\n'
    exit 1
  fi

  printf 'Readiness result: PASS\n'
}

main "$@"
