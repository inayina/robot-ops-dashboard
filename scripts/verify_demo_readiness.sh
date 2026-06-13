#!/usr/bin/env bash

set -u

DASHBOARD_API_BASE_URL="${DASHBOARD_API_BASE_URL:-http://127.0.0.1:9000}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:8001/frontend/}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-5}"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS %s\n' "$1"
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

main() {
  require_command curl
  require_command grep
  require_command mktemp

  local tmp_dir
  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/robot_ops_demo_readiness.XXXXXX")"
  trap 'rm -rf "$tmp_dir"' EXIT

  local health_json="$tmp_dir/health.json"
  local tasks_json="$tmp_dir/tasks.json"
  local robot_status_json="$tmp_dir/robot_status.json"
  local evaluation_summary_json="$tmp_dir/evaluation_summary.json"
  local frontend_html="$tmp_dir/frontend.html"

  printf 'Demo readiness check\n'
  printf 'Dashboard API: %s\n' "$DASHBOARD_API_BASE_URL"
  printf 'Frontend URL:  %s\n' "$FRONTEND_URL"
  printf '\n'

  if check_http_200 "Dashboard health" "$DASHBOARD_API_BASE_URL/health" "$health_json"; then
    check_body_contains "Dashboard health" "$health_json" '"status":"ok"'
  fi

  check_http_200 "Dashboard tasks API" "$DASHBOARD_API_BASE_URL/api/tasks" "$tasks_json"
  check_http_200 "Robot status API" "$DASHBOARD_API_BASE_URL/api/robot/status" "$robot_status_json"

  if check_http_200 "Evaluation summary API" "$DASHBOARD_API_BASE_URL/api/evaluation/summary" "$evaluation_summary_json"; then
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"run_id"'
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"dataset_version"'
    check_body_contains "Evaluation summary" "$evaluation_summary_json" '"model_version"'
  fi

  check_http_200 "Frontend page" "$FRONTEND_URL" "$frontend_html"

  printf '\n'
  printf 'Summary: PASS=%s FAIL=%s\n' "$PASS_COUNT" "$FAIL_COUNT"

  if [ "$FAIL_COUNT" -ne 0 ]; then
    printf 'Readiness result: FAIL\n'
    printf 'Hint: unavailable ROS2/Gazebo/hardware is acceptable for phase 1 if the docs and UI label it Mock / Offline / Reserved.\n'
    exit 1
  fi

  printf 'Readiness result: PASS\n'
}

main "$@"
