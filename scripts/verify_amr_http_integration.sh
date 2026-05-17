#!/usr/bin/env bash

set -euo pipefail

AMR_API_BASE_URL="${AMR_API_BASE_URL:-http://127.0.0.1:8000}"
DASHBOARD_API_BASE_URL="${DASHBOARD_API_BASE_URL:-http://127.0.0.1:9000}"
WAIT_SECONDS="${WAIT_SECONDS:-2}"

pass() {
  echo "PASS $1"
}

fail() {
  echo "FAIL $1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command not found: $1"
  fi
}

http_get() {
  local url="$1"
  local output_path="$2"
  local http_code

  if ! http_code="$(
    curl \
      --silent \
      --show-error \
      --noproxy '*' \
      --max-time 5 \
      --output "$output_path" \
      --write-out '%{http_code}' \
      "$url"
  )"; then
    fail "request failed: GET $url"
  fi

  printf '%s' "$http_code"
}

http_post_json() {
  local url="$1"
  local payload="$2"
  local output_path="$3"
  local http_code

  if ! http_code="$(
    curl \
      --silent \
      --show-error \
      --noproxy '*' \
      --max-time 5 \
      --output "$output_path" \
      --write-out '%{http_code}' \
      --request POST \
      --header 'Content-Type: application/json' \
      --data "$payload" \
      "$url"
  )"; then
    fail "request failed: POST $url"
  fi

  printf '%s' "$http_code"
}

print_response_excerpt() {
  local file_path="$1"
  python3 - "$file_path" <<'PY'
import pathlib
import sys

content = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace").strip()
if not content:
    print("<empty response>")
else:
    print(content[:400])
PY
}

require_command curl
require_command python3

case "$WAIT_SECONDS" in
  1|2|3)
    ;;
  *)
    fail "WAIT_SECONDS must be 1, 2, or 3"
    ;;
esac

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

amr_health_json="$tmp_dir/amr_health.json"
dashboard_before_json="$tmp_dir/dashboard_before.json"
create_task_json="$tmp_dir/create_task.json"
dashboard_after_json="$tmp_dir/dashboard_after.json"

task_name="integration-demo-$(date -u +%Y%m%d%H%M%S)"
create_payload="$(python3 - "$task_name" <<'PY'
import json
import sys

task_name = sys.argv[1]
print(json.dumps({"task_name": task_name, "target_name": "station_a"}))
PY
)"

amr_health_code="$(http_get "$AMR_API_BASE_URL/health" "$amr_health_json")"
if [[ "$amr_health_code" != "200" ]]; then
  fail "AMR API health check returned HTTP $amr_health_code: $(print_response_excerpt "$amr_health_json")"
fi
pass "AMR API health check"

dashboard_before_code="$(http_get "$DASHBOARD_API_BASE_URL/api/tasks" "$dashboard_before_json")"
if [[ "$dashboard_before_code" != "200" ]]; then
  fail "Dashboard API check returned HTTP $dashboard_before_code: $(print_response_excerpt "$dashboard_before_json")"
fi
pass "Dashboard API check"

create_task_code="$(http_post_json "$AMR_API_BASE_URL/tasks" "$create_payload" "$create_task_json")"
if [[ "$create_task_code" != "200" && "$create_task_code" != "201" && "$create_task_code" != "202" ]]; then
  fail "AMR task creation returned HTTP $create_task_code: $(print_response_excerpt "$create_task_json")"
fi
pass "created AMR task $task_name"

sleep "$WAIT_SECONDS"

task_visible=0
source_status_value=""
status_value=""

for attempt in 1 2 3; do
  dashboard_after_code="$(http_get "$DASHBOARD_API_BASE_URL/api/tasks" "$dashboard_after_json")"
  if [[ "$dashboard_after_code" != "200" ]]; then
    fail "Dashboard task refresh returned HTTP $dashboard_after_code: $(print_response_excerpt "$dashboard_after_json")"
  fi

  set +e
  validation_output="$(
    python3 - "$dashboard_after_json" "$task_name" <<'PY'
import json
import sys

payload_path = sys.argv[1]
task_name = sys.argv[2]

with open(payload_path, "r", encoding="utf-8") as fh:
    payload = json.load(fh)

source = payload.get("source")
if not isinstance(source, str):
    print("INVALID_PAYLOAD|missing source field")
    sys.exit(2)

if not source.startswith("amr_http"):
    print(f"SOURCE_MISMATCH|{source}")
    sys.exit(3)

data = payload.get("data")
if not isinstance(data, list):
    print("INVALID_PAYLOAD|data is not a list")
    sys.exit(2)

matched = None
for item in data:
    candidates = (
        item.get("task_id"),
        item.get("task_name"),
        item.get("order_id"),
    )
    if any(candidate is not None and str(candidate) == task_name for candidate in candidates):
        matched = item
        break

if matched is None:
    print(f"NOT_FOUND|{source}")
    sys.exit(4)

source_status = str(matched.get("source_status"))
status = str(matched.get("status"))

if source_status != "pending":
    print(f"SOURCE_STATUS_MISMATCH|{source_status}")
    sys.exit(5)

if status != "queued":
    print(f"STATUS_MISMATCH|{status}")
    sys.exit(6)

print(f"FOUND_OK|{source}|{source_status}|{status}")
PY
  )"
  validation_status=$?
  set -e

  case "$validation_status" in
    0)
      IFS='|' read -r _result _source source_status_value status_value <<<"$validation_output"
      task_visible=1
      break
      ;;
    4)
      if [[ "$attempt" -lt 3 ]]; then
        sleep 1
        continue
      fi
      ;;
    2)
      fail "Dashboard payload validation failed: ${validation_output#*|}"
      ;;
    3)
      fail "Dashboard source check failed: expected source starting with amr_http, got ${validation_output#*|}"
      ;;
    5)
      fail "Dashboard source_status check failed: expected pending, got ${validation_output#*|}"
      ;;
    6)
      fail "Dashboard status mapping check failed: expected queued, got ${validation_output#*|}"
      ;;
    *)
      fail "unexpected validation result: $validation_output"
      ;;
  esac
done

if [[ "$task_visible" -ne 1 ]]; then
  fail "task $task_name not visible through Dashboard /api/tasks after waiting ${WAIT_SECONDS}s"
fi

pass "task visible through Dashboard /api/tasks"
pass "source=amr_http"
pass "$source_status_value mapped to $status_value"
echo "ALL CHECKS PASSED"
