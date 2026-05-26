#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AMR_DB_PATH_WAS_PROVIDED=false
TASK_POINTS_PATH_WAS_PROVIDED=false
AMR_PYTHON_WAS_PROVIDED=false

if [[ -n "${AMR_DB_PATH+x}" ]]; then
  AMR_DB_PATH_WAS_PROVIDED=true
fi

if [[ -n "${TASK_POINTS_PATH+x}" ]]; then
  TASK_POINTS_PATH_WAS_PROVIDED=true
fi

if [[ -n "${AMR_PYTHON+x}" ]]; then
  AMR_PYTHON_WAS_PROVIDED=true
fi

AMR_REPO_ROOT="${AMR_REPO_ROOT:-/home/ina/ros2_ws/src/amr_warehouse_sim}"
AMR_DB_PATH="${AMR_DB_PATH:-$AMR_REPO_ROOT/data/mock_wms.db}"
TASK_POINTS_PATH="${TASK_POINTS_PATH:-$AMR_REPO_ROOT/config/task_points.yaml}"
AMR_API_HOST="${AMR_API_HOST:-127.0.0.1}"
AMR_API_PORT="${AMR_API_PORT:-8000}"
AMR_API_BASE_URL="${AMR_API_BASE_URL:-http://$AMR_API_HOST:$AMR_API_PORT}"
DASHBOARD_HOST="${DASHBOARD_HOST:-127.0.0.1}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9000}"
DASHBOARD_API_BASE_URL="${DASHBOARD_API_BASE_URL:-http://$DASHBOARD_HOST:$DASHBOARD_PORT}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-8001}"
FRONTEND_URL="${FRONTEND_URL:-http://$FRONTEND_HOST:$FRONTEND_PORT/frontend/}"
AMR_PYTHON="${AMR_PYTHON:-$AMR_REPO_ROOT/.venv/bin/python}"

LOG_DIR="${LOG_DIR:-/tmp/robot_ops_dashboard_recording}"
AMR_API_LOG="$LOG_DIR/amr_mock_wms_api.log"
DASHBOARD_BACKEND_LOG="$LOG_DIR/dashboard_backend.log"
FRONTEND_LOG="$LOG_DIR/frontend_static.log"

CLEAN_MODE=true
HEADLESS=false
SKIP_LAUNCH=false
VERBOSE=false
RUN_DEMO=true
KEEP_SERVICES=true

TARGETS=(station_a station_b shelf_1 shelf_2)

declare -a STARTED_PIDS=()

usage() {
  cat <<EOF
用法：
  $(basename "$0") [选项] [target1 target2 ...]

默认录屏流程：
  1. 确保 AMR Mock WMS API 读取：$AMR_DB_PATH
  2. 启动/检查 Dashboard backend：$DASHBOARD_API_BASE_URL
  3. 启动/检查前端静态页面：$FRONTEND_URL
  4. 调用 AMR visual demo，按顺序跑四个任务点：
     station_a station_b shelf_1 shelf_2

常用示例：
  ./scripts/run_amr_dashboard_recording_demo.sh
  ./scripts/run_amr_dashboard_recording_demo.sh --skip-launch
  ./scripts/run_amr_dashboard_recording_demo.sh --headless --verbose
  ./scripts/run_amr_dashboard_recording_demo.sh --no-run-demo

选项：
  --amr-repo PATH      AMR 仓库路径，默认：$AMR_REPO_ROOT
  --db PATH            Mock WMS SQLite 数据库，默认：$AMR_DB_PATH
  --task-points PATH   task_points.yaml，默认：$TASK_POINTS_PATH
  --no-clean           不向 AMR visual demo 传 --clean
  --skip-launch        复用已经启动的 navigation.launch.py
  --headless           以 headless 模式运行 AMR visual demo
  --verbose            打印 AMR visual demo 详细 ready 状态
  --no-run-demo        只启动/检查 API、Dashboard 和前端，不执行四点任务
  --cleanup-services   脚本退出时关闭本脚本启动的 AMR API / Dashboard / frontend
  -h, --help           显示帮助

说明：
  这个脚本是录屏编排工具，会显式调用 AMR 仓库的 visual demo。
  Dashboard 通过 HTTP 读取或创建 AMR Mock WMS task；电机 bench 命令不由本脚本触发。
EOF
}

log() {
  echo "[recording-demo] $*"
}

fail() {
  echo "[recording-demo] ERROR: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "缺少依赖命令：$1"
  fi
}

cleanup_started_services() {
  if [[ "$KEEP_SERVICES" == true ]]; then
    return 0
  fi

  local pid
  for pid in "${STARTED_PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      log "停止本脚本启动的服务 PID=$pid"
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

parse_args() {
  TARGETS=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --amr-repo)
        AMR_REPO_ROOT=$2
        if [[ "$AMR_DB_PATH_WAS_PROVIDED" == false ]]; then
          AMR_DB_PATH="$2/data/mock_wms.db"
        fi
        if [[ "$TASK_POINTS_PATH_WAS_PROVIDED" == false ]]; then
          TASK_POINTS_PATH="$2/config/task_points.yaml"
        fi
        if [[ "$AMR_PYTHON_WAS_PROVIDED" == false ]]; then
          AMR_PYTHON="$2/.venv/bin/python"
        fi
        shift 2
        ;;
      --db)
        AMR_DB_PATH=$2
        AMR_DB_PATH_WAS_PROVIDED=true
        shift 2
        ;;
      --task-points)
        TASK_POINTS_PATH=$2
        TASK_POINTS_PATH_WAS_PROVIDED=true
        shift 2
        ;;
      --no-clean)
        CLEAN_MODE=false
        shift
        ;;
      --skip-launch)
        SKIP_LAUNCH=true
        shift
        ;;
      --headless)
        HEADLESS=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      --no-run-demo)
        RUN_DEMO=false
        shift
        ;;
      --cleanup-services)
        KEEP_SERVICES=false
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        TARGETS+=("$1")
        shift
        ;;
    esac
  done

  if [[ ${#TARGETS[@]} -eq 0 ]]; then
    TARGETS=(station_a station_b shelf_1 shelf_2)
  fi
}

http_get() {
  local url=$1
  local output_path=$2
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
    return 1
  fi

  [[ "$http_code" == "200" ]]
}

wait_for_http() {
  local url=$1
  local label=$2
  local tmp_file=$3
  local attempt

  for attempt in {1..30}; do
    if http_get "$url" "$tmp_file"; then
      log "$label ready: $url"
      return 0
    fi
    sleep 1
  done

  fail "$label 在 30 秒内未就绪：$url"
}

ensure_paths() {
  [[ -d "$DASHBOARD_ROOT" ]] || fail "Dashboard 仓库不存在：$DASHBOARD_ROOT"
  [[ -d "$AMR_REPO_ROOT" ]] || fail "AMR 仓库不存在：$AMR_REPO_ROOT"
  [[ -x "$AMR_REPO_ROOT/scripts/run_mock_wms_visual_demo.sh" ]] || \
    fail "未找到 AMR visual demo 脚本：$AMR_REPO_ROOT/scripts/run_mock_wms_visual_demo.sh"
  [[ -f "$TASK_POINTS_PATH" ]] || fail "未找到 task points 文件：$TASK_POINTS_PATH"

  if [[ ! -x "$AMR_PYTHON" ]]; then
    AMR_PYTHON=python3
  fi

  mkdir -p "$LOG_DIR"
}

start_amr_api_if_needed() {
  local health_json="$LOG_DIR/amr_health.json"

  if http_get "$AMR_API_BASE_URL/health" "$health_json"; then
    log "AMR Mock WMS API 已在运行：$AMR_API_BASE_URL"
  else
    log "启动 AMR Mock WMS API，数据库：$AMR_DB_PATH"
    (
      cd "$AMR_REPO_ROOT"
      MOCK_WMS_DB_PATH="$AMR_DB_PATH" \
      MOCK_WMS_TASK_POINTS_PATH="$TASK_POINTS_PATH" \
      "$AMR_PYTHON" -m amr_warehouse_sim.mock_wms_api \
        --host "$AMR_API_HOST" \
        --port "$AMR_API_PORT"
    ) >"$AMR_API_LOG" 2>&1 &
    STARTED_PIDS+=("$!")
    wait_for_http "$AMR_API_BASE_URL/health" "AMR Mock WMS API" "$health_json"
  fi

  python3 - "$health_json" "$AMR_DB_PATH" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
actual = pathlib.Path(str(payload.get("db_path", ""))).resolve()
expected = pathlib.Path(sys.argv[2]).resolve()
if actual != expected:
    print(
        "AMR Mock WMS API 当前读取的数据库不匹配：\n"
        f"  actual:   {actual}\n"
        f"  expected: {expected}\n"
        "请停止旧的 8000 端口服务，或用 MOCK_WMS_DB_PATH 指向 expected 后重启。",
        file=sys.stderr,
    )
    sys.exit(1)
PY
}

start_dashboard_backend_if_needed() {
  local health_json="$LOG_DIR/dashboard_health.json"
  local tasks_json="$LOG_DIR/dashboard_tasks.json"

  if http_get "$DASHBOARD_API_BASE_URL/health" "$health_json"; then
    log "Dashboard backend 已在运行：$DASHBOARD_API_BASE_URL"
  else
    local uvicorn_bin="$DASHBOARD_ROOT/.venv/bin/uvicorn"
    [[ -x "$uvicorn_bin" ]] || fail "未找到 uvicorn：$uvicorn_bin。请先安装 backend 依赖。"

    log "启动 Dashboard backend，AMR_API_BASE_URL=$AMR_API_BASE_URL"
    (
      cd "$DASHBOARD_ROOT"
      ROBOT_OPS_TASK_SOURCE=amr_http \
      AMR_API_BASE_URL="$AMR_API_BASE_URL" \
      "$uvicorn_bin" backend.app.main:app \
        --host "$DASHBOARD_HOST" \
        --port "$DASHBOARD_PORT"
    ) >"$DASHBOARD_BACKEND_LOG" 2>&1 &
    STARTED_PIDS+=("$!")
    wait_for_http "$DASHBOARD_API_BASE_URL/health" "Dashboard backend" "$health_json"
  fi

  python3 - "$health_json" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
mode = payload.get("mode")
if mode != "amr_http":
    print(
        f"Dashboard backend 当前 mode={mode!r}，录屏需要 mode='amr_http'。"
        "请停止旧的 9000 端口服务后重跑脚本。",
        file=sys.stderr,
    )
    sys.exit(1)
PY

  if ! http_get "$DASHBOARD_API_BASE_URL/api/tasks" "$tasks_json"; then
    fail "Dashboard /api/tasks 不可用，请查看日志：$DASHBOARD_BACKEND_LOG"
  fi

  python3 - "$tasks_json" "$AMR_API_BASE_URL" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
expected = f"amr_http:{sys.argv[2].rstrip('/')}"
actual = payload.get("source")
if actual != expected:
    print(
        "Dashboard backend 当前读取的 AMR source 不匹配：\n"
        f"  actual:   {actual}\n"
        f"  expected: {expected}\n"
        "请停止旧的 9000 端口服务，或用正确 AMR_API_BASE_URL 重启。",
        file=sys.stderr,
    )
    sys.exit(1)
PY
}

start_frontend_if_needed() {
  local frontend_html="$LOG_DIR/frontend_index.html"

  if http_get "$FRONTEND_URL" "$frontend_html"; then
    log "Frontend 静态服务已在运行：$FRONTEND_URL"
    return 0
  fi

  log "启动前端静态服务：$FRONTEND_URL"
  (
    cd "$DASHBOARD_ROOT"
    python3 -m http.server "$FRONTEND_PORT" --bind "$FRONTEND_HOST"
  ) >"$FRONTEND_LOG" 2>&1 &
  STARTED_PIDS+=("$!")
  wait_for_http "$FRONTEND_URL" "Frontend static server" "$frontend_html"
}

print_recording_urls() {
  log "录屏页面：$FRONTEND_URL"
  log "Dashboard tasks API：$DASHBOARD_API_BASE_URL/api/tasks"
  log "AMR tasks API：$AMR_API_BASE_URL/tasks"
  log "日志目录：$LOG_DIR"
}

run_visual_demo() {
  local demo_script="$AMR_REPO_ROOT/scripts/run_mock_wms_visual_demo.sh"
  local args=()

  if [[ "$CLEAN_MODE" == true && "$SKIP_LAUNCH" == false ]]; then
    args+=(--clean)
  fi

  if [[ "$SKIP_LAUNCH" == true ]]; then
    args+=(--skip-launch)
  fi

  if [[ "$HEADLESS" == true ]]; then
    args+=(--headless)
  fi

  if [[ "$VERBOSE" == true ]]; then
    args+=(--verbose)
  fi

  args+=(--db "$AMR_DB_PATH")
  args+=(--task-points "$TASK_POINTS_PATH")
  args+=(--max-tasks "${#TARGETS[@]}")
  args+=("${TARGETS[@]}")

  log "开始执行 AMR 四点任务：${TARGETS[*]}"
  log "使用数据库：$AMR_DB_PATH"
  bash "$demo_script" "${args[@]}"
}

main() {
  parse_args "$@"
  trap cleanup_started_services EXIT

  require_command curl
  require_command python3
  require_command bash

  ensure_paths
  start_amr_api_if_needed
  start_dashboard_backend_if_needed
  start_frontend_if_needed
  print_recording_urls

  if [[ "$RUN_DEMO" == true ]]; then
    run_visual_demo
    log "四点任务流程结束。前端页面会继续每 3 秒读取同一个 Mock WMS 数据库。"
  else
    log "已跳过 AMR visual demo，仅完成服务联通检查。"
  fi
}

main "$@"
