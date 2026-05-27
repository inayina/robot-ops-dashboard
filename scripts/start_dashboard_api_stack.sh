#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AMR_REPO_ROOT="${AMR_REPO_ROOT:-/home/ina/ros2_ws/src/amr_warehouse_sim}"
AMR_DB_PATH="${AMR_DB_PATH:-$AMR_REPO_ROOT/data/mock_wms.db}"
TASK_POINTS_PATH="${TASK_POINTS_PATH:-$AMR_REPO_ROOT/config/task_points.yaml}"
AMR_PYTHON="${AMR_PYTHON:-$AMR_REPO_ROOT/.venv/bin/python}"
AMR_WORKSPACE="${AMR_WORKSPACE:-}"

AMR_API_HOST="${AMR_API_HOST:-127.0.0.1}"
AMR_API_PORT="${AMR_API_PORT:-8000}"
AMR_API_BASE_URL="${AMR_API_BASE_URL:-http://$AMR_API_HOST:$AMR_API_PORT}"

DASHBOARD_HOST="${DASHBOARD_HOST:-127.0.0.1}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9000}"
DASHBOARD_API_BASE_URL="${DASHBOARD_API_BASE_URL:-http://$DASHBOARD_HOST:$DASHBOARD_PORT}"
GAZEBO_CAMERA_MJPEG_URL="${SIM_PREVIEW_MJPEG_URL:-${GAZEBO_CAMERA_MJPEG_URL:-${SIM_CAMERA_MJPEG_URL:-}}}"
SIM_CAMERA_PUBLIC_STREAM_URL="${SIM_PREVIEW_PUBLIC_STREAM_URL:-${SIM_CAMERA_PUBLIC_STREAM_URL:-}}"
GAZEBO_CAMERA_LABEL="${SIM_PREVIEW_LABEL:-${GAZEBO_CAMERA_LABEL:-Gazebo Path View}}"
GAZEBO_CAMERA_SOURCE="${SIM_PREVIEW_SOURCE:-${GAZEBO_CAMERA_SOURCE:-gazebo_preview}}"
SIM_PREVIEW_HOST="${SIM_PREVIEW_HOST:-127.0.0.1}"
SIM_PREVIEW_PORT="${SIM_PREVIEW_PORT:-8090}"
RVIZ_PREVIEW_WINDOW_REGEX="${RVIZ_PREVIEW_WINDOW_REGEX:-rviz}"
RVIZ_PREVIEW_CAPTURE_MODE="${RVIZ_PREVIEW_CAPTURE_MODE:-window}"

FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-8001}"
FRONTEND_URL="${FRONTEND_URL:-http://$FRONTEND_HOST:$FRONTEND_PORT/frontend/}"

LOG_DIR="${LOG_DIR:-/tmp/robot_ops_dashboard_api_stack}"
PID_DIR="$LOG_DIR/pids"
AMR_API_LOG="$LOG_DIR/amr_mock_wms_api.log"
DASHBOARD_BACKEND_LOG="$LOG_DIR/dashboard_backend.log"
FRONTEND_LOG="$LOG_DIR/frontend_static.log"
AMR_NAV_LAUNCH_LOG="$LOG_DIR/amr_navigation_visualization.log"
HTTP_EXECUTOR_LOG="$LOG_DIR/amr_http_executor_loop.log"
RVIZ_PREVIEW_LOG="$LOG_DIR/rviz_preview.log"
RVIZ_VIEWER_LOG="$LOG_DIR/rviz_viewer.log"
AMR_API_PID_FILE="$PID_DIR/amr_mock_wms_api.pid"
DASHBOARD_PID_FILE="$PID_DIR/dashboard_backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend_static.pid"
AMR_NAV_LAUNCH_PID_FILE="$PID_DIR/amr_navigation_visualization.pid"
HTTP_EXECUTOR_PID_FILE="$PID_DIR/amr_http_executor_loop.pid"
RVIZ_PREVIEW_PID_FILE="$PID_DIR/rviz_preview.pid"
RVIZ_VIEWER_PID_FILE="$PID_DIR/rviz_viewer.pid"

START_FRONTEND=true
WITH_AMR_VISUALIZATION=false
USE_GZ_GUI=true
USE_RVIZ=true
SKIP_NAV_LAUNCH=false
AUTO_LOCAL_RVIZ_PREVIEW=false
START_SEPARATE_RVIZ_VIEWER=false
EXECUTOR_POLL_INTERVAL_SEC="${EXECUTOR_POLL_INTERVAL_SEC:-3}"
READY_TIMEOUT_SEC="${READY_TIMEOUT_SEC:-90}"
NAVIGATION_TIMEOUT_SEC="${NAVIGATION_TIMEOUT_SEC:-180}"
INITIAL_POSE_WAIT_SEC="${INITIAL_POSE_WAIT_SEC:-30}"

usage() {
  cat <<EOF
用法：
  $(basename "$0") [选项]

默认只启动/复用本地 API 和页面，不执行 AMR visual demo，不自动创建任务。

若使用 `--with-amr-visualization` 且未显式提供 `--sim-preview-url`，
脚本会默认抓取本机 RViz path 视图并把它接到 Dashboard 的 `Simulation Preview` 小窗。

启动内容：
  1. AMR Mock WMS API: $AMR_API_BASE_URL
  2. Dashboard backend: $DASHBOARD_API_BASE_URL
  3. Frontend static page: $FRONTEND_URL

选项：
  --amr-repo PATH      AMR 仓库路径，默认：$AMR_REPO_ROOT
  --db PATH            Mock WMS SQLite 数据库，默认：$AMR_DB_PATH
  --task-points PATH   task_points.yaml，默认：$TASK_POINTS_PATH
  --no-frontend        只启动 AMR API 和 Dashboard backend
  --with-amr-visualization
                       启动 AMR Gazebo/RViz/Nav2，并启动 HTTP executor 循环
                       executor 会消费你在 Dashboard 页面创建的 Mock WMS task
  --headless           配合 --with-amr-visualization，不启动 Gazebo GUI / RViz
  --sim-preview-url URL
                       把 Gazebo / RViz path 预览的 MJPEG HTTP URL 传给 Dashboard backend
  --sim-camera-url URL
                       兼容别名，等价于 --sim-preview-url
  --sim-preview-public-url URL
                       可选：覆盖 frontend 使用的公开 stream URL
  --sim-camera-public-url URL
                       兼容别名，等价于 --sim-preview-public-url
  --sim-preview-label LABEL
                       可选：覆盖 Simulation Preview 标签，默认：$GAZEBO_CAMERA_LABEL
  --sim-camera-label LABEL
                       兼容别名，等价于 --sim-preview-label
  --rviz-preview-port PORT
                       自动本地 RViz 预览使用的端口，默认：$SIM_PREVIEW_PORT
  --skip-nav-launch    配合 --with-amr-visualization，复用已有 navigation.launch.py
  --executor-poll SEC  HTTP executor 轮询间隔，默认：$EXECUTOR_POLL_INTERVAL_SEC
  --ready-timeout SEC  executor 等待 Nav2 ready 秒数，默认：$READY_TIMEOUT_SEC
  --navigation-timeout SEC
                       单个 NavigateToPose 超时秒数，默认：$NAVIGATION_TIMEOUT_SEC
  --stop               停止本脚本上次启动的服务
  --status             打印当前服务探测结果
  -h, --help           显示帮助

常用：
  ./scripts/start_dashboard_api_stack.sh
  ./scripts/start_dashboard_api_stack.sh --with-amr-visualization
  ./scripts/start_dashboard_api_stack.sh --stop

环境变量：
  AMR_REPO_ROOT、AMR_DB_PATH、TASK_POINTS_PATH、AMR_WORKSPACE、
  AMR_API_PORT、DASHBOARD_PORT、FRONTEND_PORT、LOG_DIR、
  SIM_PREVIEW_MJPEG_URL、GAZEBO_CAMERA_MJPEG_URL、
  SIM_PREVIEW_PUBLIC_STREAM_URL、SIM_CAMERA_PUBLIC_STREAM_URL、
  SIM_PREVIEW_LABEL、GAZEBO_CAMERA_LABEL、
  SIM_PREVIEW_SOURCE、GAZEBO_CAMERA_SOURCE、
  SIM_PREVIEW_HOST、SIM_PREVIEW_PORT、
  RVIZ_PREVIEW_WINDOW_REGEX、RVIZ_PREVIEW_CAPTURE_MODE
EOF
}

log() {
  echo "[api-stack] $*"
}

fail() {
  echo "[api-stack] ERROR: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "缺少依赖命令：$1"
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

wait_for_stream_bytes() {
  local url=$1
  local label=$2
  local output_path=$3
  local attempt

  for attempt in {1..45}; do
    : >"$output_path"
    curl \
      --silent \
      --show-error \
      --noproxy '*' \
      --max-time 2 \
      --output "$output_path" \
      "$url" >/dev/null 2>&1 || true

    if [[ -s "$output_path" ]]; then
      log "$label ready: $url"
      return 0
    fi
    sleep 1
  done

  fail "$label 在 45 秒内未返回有效画面：$url"
}

write_pid_file() {
  local pid=$1
  local pid_file=$2
  echo "$pid" >"$pid_file"
}

stop_pid_file() {
  local label=$1
  local pid_file=$2

  if [[ ! -f "$pid_file" ]]; then
    log "$label 没有本脚本记录的 PID。"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    log "停止 $label PID=$pid"
    kill "$pid" >/dev/null 2>&1 || true
  else
    log "$label PID=$pid 已不存在。"
  fi

  rm -f "$pid_file"
}

ensure_paths() {
  [[ -d "$DASHBOARD_ROOT" ]] || fail "Dashboard 仓库不存在：$DASHBOARD_ROOT"
  [[ -d "$AMR_REPO_ROOT" ]] || fail "AMR 仓库不存在：$AMR_REPO_ROOT"
  [[ -f "$TASK_POINTS_PATH" ]] || fail "未找到 task points 文件：$TASK_POINTS_PATH"

  if [[ -z "$AMR_WORKSPACE" ]]; then
    AMR_WORKSPACE="$(cd "$AMR_REPO_ROOT/../.." && pwd)"
  fi

  if [[ ! -x "$AMR_PYTHON" ]]; then
    AMR_PYTHON=python3
  fi

  if [[ "$WITH_AMR_VISUALIZATION" == true ]]; then
    [[ -f /opt/ros/jazzy/setup.bash ]] || fail "未找到 /opt/ros/jazzy/setup.bash，请先安装 ROS 2 Jazzy。"
    [[ -f "$AMR_WORKSPACE/install/setup.bash" ]] || fail "未找到 $AMR_WORKSPACE/install/setup.bash，请先构建 ROS 工作空间。"
  fi

  mkdir -p "$LOG_DIR" "$PID_DIR"
}

configure_sim_preview_defaults() {
  if [[ -n "$GAZEBO_CAMERA_MJPEG_URL" ]]; then
    return 0
  fi

  if [[ "$WITH_AMR_VISUALIZATION" == true && "$USE_RVIZ" == true ]]; then
    AUTO_LOCAL_RVIZ_PREVIEW=true
    START_SEPARATE_RVIZ_VIEWER=true
    USE_RVIZ=false
    GAZEBO_CAMERA_MJPEG_URL="http://$SIM_PREVIEW_HOST:$SIM_PREVIEW_PORT/stream"
    if [[ "$GAZEBO_CAMERA_LABEL" == "Gazebo Path View" ]]; then
      GAZEBO_CAMERA_LABEL="RViz Path View"
    fi
    if [[ "$GAZEBO_CAMERA_SOURCE" == "gazebo_preview" ]]; then
      GAZEBO_CAMERA_SOURCE="local_rviz_mjpeg"
    fi
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --amr-repo)
        AMR_REPO_ROOT=$2
        AMR_DB_PATH="$2/data/mock_wms.db"
        TASK_POINTS_PATH="$2/config/task_points.yaml"
        AMR_PYTHON="$2/.venv/bin/python"
        AMR_WORKSPACE="$(cd "$2/../.." && pwd)"
        shift 2
        ;;
      --db)
        AMR_DB_PATH=$2
        shift 2
        ;;
      --task-points)
        TASK_POINTS_PATH=$2
        shift 2
        ;;
      --no-frontend)
        START_FRONTEND=false
        shift
        ;;
      --with-amr-visualization)
        WITH_AMR_VISUALIZATION=true
        shift
        ;;
      --headless)
        USE_GZ_GUI=false
        USE_RVIZ=false
        shift
        ;;
      --sim-preview-url|--sim-camera-url)
        GAZEBO_CAMERA_MJPEG_URL=$2
        shift 2
        ;;
      --sim-preview-public-url|--sim-camera-public-url)
        SIM_CAMERA_PUBLIC_STREAM_URL=$2
        shift 2
        ;;
      --sim-preview-label|--sim-camera-label)
        GAZEBO_CAMERA_LABEL=$2
        shift 2
        ;;
      --rviz-preview-port)
        SIM_PREVIEW_PORT=$2
        shift 2
        ;;
      --skip-nav-launch)
        SKIP_NAV_LAUNCH=true
        WITH_AMR_VISUALIZATION=true
        shift
        ;;
      --executor-poll)
        EXECUTOR_POLL_INTERVAL_SEC=$2
        shift 2
        ;;
      --ready-timeout)
        READY_TIMEOUT_SEC=$2
        shift 2
        ;;
      --navigation-timeout)
        NAVIGATION_TIMEOUT_SEC=$2
        shift 2
        ;;
      --stop)
        require_command kill
        ensure_paths
        stop_pid_file "RViz preview stream" "$RVIZ_PREVIEW_PID_FILE"
        stop_pid_file "RViz viewer" "$RVIZ_VIEWER_PID_FILE"
        stop_pid_file "AMR HTTP executor loop" "$HTTP_EXECUTOR_PID_FILE"
        stop_pid_file "AMR navigation visualization" "$AMR_NAV_LAUNCH_PID_FILE"
        stop_pid_file "Frontend static server" "$FRONTEND_PID_FILE"
        stop_pid_file "Dashboard backend" "$DASHBOARD_PID_FILE"
        stop_pid_file "AMR Mock WMS API" "$AMR_API_PID_FILE"
        exit 0
        ;;
      --status)
        require_command curl
        ensure_paths
        print_status
        exit 0
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "未知参数：$1"
        ;;
    esac
  done
}

check_amr_db_matches() {
  local health_json=$1

  python3 - "$health_json" "$AMR_DB_PATH" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
actual_value = payload.get("db_path")
if actual_value is None:
    sys.exit(0)

actual = pathlib.Path(str(actual_value)).resolve()
expected = pathlib.Path(sys.argv[2]).resolve()
if actual != expected:
    print(
        "AMR Mock WMS API 当前读取的数据库不匹配：\n"
        f"  actual:   {actual}\n"
        f"  expected: {expected}\n"
        "请停止旧的 AMR API，或用 AMR_DB_PATH 指向 actual 后重跑脚本。",
        file=sys.stderr,
    )
    sys.exit(1)
PY
}

start_amr_api_if_needed() {
  local health_json="$LOG_DIR/amr_health.json"

  if http_get "$AMR_API_BASE_URL/health" "$health_json"; then
    log "AMR Mock WMS API 已在运行：$AMR_API_BASE_URL"
    check_amr_db_matches "$health_json"
    return 0
  fi

  log "启动 AMR Mock WMS API，数据库：$AMR_DB_PATH"
  (
    cd "$AMR_REPO_ROOT"
    nohup "$AMR_PYTHON" -m amr_warehouse_sim.mock_wms_api \
      --host "$AMR_API_HOST" \
      --port "$AMR_API_PORT" \
      --db "$AMR_DB_PATH" \
      --task-points "$TASK_POINTS_PATH"
  ) >"$AMR_API_LOG" 2>&1 &
  write_pid_file "$!" "$AMR_API_PID_FILE"
  wait_for_http "$AMR_API_BASE_URL/health" "AMR Mock WMS API" "$health_json"
  check_amr_db_matches "$health_json"
}

start_dashboard_backend_if_needed() {
  local health_json="$LOG_DIR/dashboard_health.json"
  local tasks_json="$LOG_DIR/dashboard_tasks.json"
  local wms_tasks_json="$LOG_DIR/dashboard_wms_tasks.json"
  local sim_preview_json="$LOG_DIR/dashboard_sim_preview.json"
  local dashboard_python="$DASHBOARD_ROOT/.venv/bin/python"

  if http_get "$DASHBOARD_API_BASE_URL/health" "$health_json"; then
    log "Dashboard backend 已在运行：$DASHBOARD_API_BASE_URL"
  else
    [[ -x "$dashboard_python" ]] || fail "未找到 Python venv：$dashboard_python。请先安装 backend 依赖。"

    log "启动 Dashboard backend，AMR_API_BASE_URL=$AMR_API_BASE_URL"
    (
      cd "$DASHBOARD_ROOT"
      nohup env \
        ROBOT_OPS_TASK_SOURCE=amr_http \
        AMR_API_BASE_URL="$AMR_API_BASE_URL" \
        SIM_PREVIEW_MJPEG_URL="$GAZEBO_CAMERA_MJPEG_URL" \
        GAZEBO_CAMERA_MJPEG_URL="$GAZEBO_CAMERA_MJPEG_URL" \
        SIM_CAMERA_PUBLIC_STREAM_URL="$SIM_CAMERA_PUBLIC_STREAM_URL" \
        GAZEBO_CAMERA_LABEL="$GAZEBO_CAMERA_LABEL" \
        GAZEBO_CAMERA_SOURCE="$GAZEBO_CAMERA_SOURCE" \
        "$dashboard_python" -m uvicorn backend.app.main:app \
          --host "$DASHBOARD_HOST" \
          --port "$DASHBOARD_PORT"
    ) >"$DASHBOARD_BACKEND_LOG" 2>&1 &
    write_pid_file "$!" "$DASHBOARD_PID_FILE"
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
        f"Dashboard backend 当前 mode={mode!r}，API stack 需要 mode='amr_http'。\n"
        "请停止旧的 9000 端口服务后重跑脚本，或用正确环境变量重启 Dashboard backend。",
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

  if ! http_get "$DASHBOARD_API_BASE_URL/api/wms/tasks" "$wms_tasks_json"; then
    fail "Dashboard /api/wms/tasks 不可用，请查看日志：$DASHBOARD_BACKEND_LOG"
  fi

  if ! http_get "$DASHBOARD_API_BASE_URL/api/sim/preview" "$sim_preview_json"; then
    fail "Dashboard /api/sim/preview 不可用，请查看日志：$DASHBOARD_BACKEND_LOG"
  fi

  python3 - "$sim_preview_json" "$GAZEBO_CAMERA_MJPEG_URL" "$GAZEBO_CAMERA_LABEL" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
expected_stream = sys.argv[2].strip()
expected_label = sys.argv[3].strip()

actual_connection = payload.get("connection")
actual_stream = payload.get("stream_url")
actual_label = payload.get("label")

if expected_stream:
    if actual_connection != "connected":
        print(
            "Dashboard backend 当前未启用 Simulation Preview：\n"
            f"  expected preview stream: {expected_stream}\n"
            f"  actual connection: {actual_connection!r}\n"
            "请停止旧的 9000 端口服务后重跑脚本，或用正确 preview env 重启 Dashboard backend。",
            file=sys.stderr,
        )
        sys.exit(1)
    if not actual_stream:
        print(
            "Dashboard backend 的 Simulation Preview 未返回 stream_url。\n"
            "请检查 backend 日志或 camera URL 配置。",
            file=sys.stderr,
        )
        sys.exit(1)
else:
    if actual_connection != "disconnected":
        print(
            "当前脚本未传入 Simulation Preview URL，但 9000 端口上的 backend 已配置了 Simulation Preview。\n"
            "如果这是预期行为可以忽略；如果不是，请停止旧服务后重跑。",
            file=sys.stderr,
        )

if expected_label and actual_label != expected_label:
    print(
        "Dashboard backend 当前的 Simulation Preview label 不匹配：\n"
        f"  actual:   {actual_label!r}\n"
        f"  expected: {expected_label!r}\n"
        "请停止旧的 9000 端口服务后重跑脚本，或用正确 GAZEBO_CAMERA_LABEL 重启。",
        file=sys.stderr,
    )
    sys.exit(1)
PY
}

start_frontend_if_needed() {
  local frontend_html="$LOG_DIR/frontend_index.html"

  if [[ "$START_FRONTEND" == false ]]; then
    return 0
  fi

  if http_get "$FRONTEND_URL" "$frontend_html"; then
    log "Frontend 静态服务已在运行：$FRONTEND_URL"
    return 0
  fi

  log "启动前端静态服务：$FRONTEND_URL"
  (
    cd "$DASHBOARD_ROOT"
    nohup python3 -m http.server "$FRONTEND_PORT" --bind "$FRONTEND_HOST"
  ) >"$FRONTEND_LOG" 2>&1 &
  write_pid_file "$!" "$FRONTEND_PID_FILE"
  wait_for_http "$FRONTEND_URL" "Frontend static server" "$frontend_html"
}

start_separate_rviz_viewer_if_needed() {
  local rviz_config="$AMR_REPO_ROOT/rviz/nav2.rviz"

  if [[ "$START_SEPARATE_RVIZ_VIEWER" != true ]]; then
    return 0
  fi

  [[ -f "$rviz_config" ]] || fail "未找到 RViz 配置：$rviz_config"

  if [[ -f "$RVIZ_VIEWER_PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$RVIZ_VIEWER_PID_FILE")"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
      log "独立 RViz viewer 已在运行，PID=$existing_pid"
      return 0
    fi
    rm -f "$RVIZ_VIEWER_PID_FILE"
  fi

  log "启动独立 RViz path viewer（software rendering），日志：$RVIZ_VIEWER_LOG"
  (
    cd "$AMR_REPO_ROOT"
    nohup env DISPLAY="${DISPLAY:-:0}" bash -lc "
      source /opt/ros/jazzy/setup.bash
      source '$AMR_WORKSPACE/install/setup.bash'
      export LIBGL_ALWAYS_SOFTWARE=1
      export QT_QPA_PLATFORM=xcb
      exec rviz2 -d '$rviz_config'
    "
  ) >"$RVIZ_VIEWER_LOG" 2>&1 &
  write_pid_file "$!" "$RVIZ_VIEWER_PID_FILE"
  sleep 3
}

start_local_rviz_preview_if_needed() {
  local probe_file="$LOG_DIR/rviz_preview_probe.bin"
  local preview_script="$DASHBOARD_ROOT/scripts/serve_rviz_preview_mjpeg.sh"

  if [[ "$AUTO_LOCAL_RVIZ_PREVIEW" != true ]]; then
    return 0
  fi

  [[ -x "$preview_script" ]] || fail "未找到 RViz 预览脚本：$preview_script"

  if [[ -f "$RVIZ_PREVIEW_PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$RVIZ_PREVIEW_PID_FILE")"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
      log "本地 RViz preview 已在运行，PID=$existing_pid"
      wait_for_stream_bytes "$GAZEBO_CAMERA_MJPEG_URL" "RViz preview stream" "$probe_file"
      return 0
    fi
    rm -f "$RVIZ_PREVIEW_PID_FILE"
  fi

  log "启动本地 RViz path preview，输出：$GAZEBO_CAMERA_MJPEG_URL"
  (
    cd "$DASHBOARD_ROOT"
    nohup env \
      DISPLAY="${DISPLAY:-:0}" \
      HOST="$SIM_PREVIEW_HOST" \
      PORT="$SIM_PREVIEW_PORT" \
      WINDOW_REGEX="$RVIZ_PREVIEW_WINDOW_REGEX" \
      CAPTURE_MODE="$RVIZ_PREVIEW_CAPTURE_MODE" \
      "$preview_script"
  ) >"$RVIZ_PREVIEW_LOG" 2>&1 &
  write_pid_file "$!" "$RVIZ_PREVIEW_PID_FILE"
  wait_for_stream_bytes "$GAZEBO_CAMERA_MJPEG_URL" "RViz preview stream" "$probe_file"
}

navigation_launch_running() {
  pgrep -f "ros2 launch amr_warehouse_sim navigation.launch.py" >/dev/null 2>&1
}

start_amr_visualization_if_requested() {
  if [[ "$WITH_AMR_VISUALIZATION" != true ]]; then
    return 0
  fi

  if [[ "$SKIP_NAV_LAUNCH" == true ]]; then
    log "复用已有 AMR navigation.launch.py 会话。"
  elif navigation_launch_running; then
    log "检测到 AMR navigation.launch.py 已在运行，复用当前可视化会话。"
  else
    log "启动 AMR Gazebo/RViz/Nav2 可视化，日志：$AMR_NAV_LAUNCH_LOG"
    (
      cd "$AMR_REPO_ROOT"
      nohup bash -lc "
        source /opt/ros/jazzy/setup.bash
        source '$AMR_WORKSPACE/install/setup.bash'
        ros2 launch amr_warehouse_sim navigation.launch.py use_gz_gui:=$USE_GZ_GUI use_rviz:=$USE_RVIZ
      "
    ) >"$AMR_NAV_LAUNCH_LOG" 2>&1 &
    write_pid_file "$!" "$AMR_NAV_LAUNCH_PID_FILE"
    sleep 3
  fi

  log "发布 start_zone initial pose（失败会由 executor ready gate 继续暴露）"
  (
    cd "$AMR_REPO_ROOT"
    bash -lc "
      source /opt/ros/jazzy/setup.bash
      source '$AMR_WORKSPACE/install/setup.bash'
      ros2 run amr_warehouse_sim publish_initial_pose --preset start_zone --wait-for-subscribers '$INITIAL_POSE_WAIT_SEC'
    "
  ) >>"$AMR_NAV_LAUNCH_LOG" 2>&1 || true

  start_separate_rviz_viewer_if_needed
  start_local_rviz_preview_if_needed
  start_http_executor_loop_if_needed
}

start_http_executor_loop_if_needed() {
  if [[ -f "$HTTP_EXECUTOR_PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$HTTP_EXECUTOR_PID_FILE")"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
      log "AMR HTTP executor loop 已在运行，PID=$existing_pid"
      return 0
    fi
    rm -f "$HTTP_EXECUTOR_PID_FILE"
  fi

  log "启动 AMR HTTP executor loop。Dashboard 创建 task 后会被它消费执行。"
  (
    cd "$AMR_REPO_ROOT"
    nohup bash -lc "
      set +e
      source /opt/ros/jazzy/setup.bash
      source '$AMR_WORKSPACE/install/setup.bash'
      echo '[http-executor-loop] started at '\"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
      while true; do
        ros2 run amr_warehouse_sim mock_wms_executor \
          --api-base-url '$AMR_API_BASE_URL' \
          --execute \
          --ready-timeout '$READY_TIMEOUT_SEC' \
          --navigation-timeout '$NAVIGATION_TIMEOUT_SEC'
        status=\$?
        if [[ \$status -ne 0 ]]; then
          echo '[http-executor-loop] executor exited with status' \$status
        fi
        sleep '$EXECUTOR_POLL_INTERVAL_SEC'
      done
    "
  ) >"$HTTP_EXECUTOR_LOG" 2>&1 &
  write_pid_file "$!" "$HTTP_EXECUTOR_PID_FILE"
  log "AMR HTTP executor loop PID=$!，日志：$HTTP_EXECUTOR_LOG"
}

print_status() {
  local tmp_file="$LOG_DIR/status_probe.json"

  if http_get "$AMR_API_BASE_URL/health" "$tmp_file"; then
    log "AMR Mock WMS API: OK $AMR_API_BASE_URL"
  else
    log "AMR Mock WMS API: unavailable $AMR_API_BASE_URL"
  fi

  if http_get "$DASHBOARD_API_BASE_URL/health" "$tmp_file"; then
    log "Dashboard backend: OK $DASHBOARD_API_BASE_URL"
  else
    log "Dashboard backend: unavailable $DASHBOARD_API_BASE_URL"
  fi

  if http_get "$DASHBOARD_API_BASE_URL/api/sim/preview" "$tmp_file"; then
    python3 - "$tmp_file" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
print(
    "[api-stack] Simulation Preview:",
    payload.get("connection", "unknown"),
    payload.get("label", "-"),
    payload.get("stream_url") or "-",
)
PY
  else
    log "Simulation Preview: unavailable $DASHBOARD_API_BASE_URL/api/sim/preview"
  fi

  if http_get "$FRONTEND_URL" "$tmp_file"; then
    log "Frontend: OK $FRONTEND_URL"
  else
    log "Frontend: unavailable $FRONTEND_URL"
  fi

  if navigation_launch_running; then
    log "AMR visualization: navigation.launch.py running"
  else
    log "AMR visualization: not running"
  fi

  if [[ -f "$HTTP_EXECUTOR_PID_FILE" ]] && kill -0 "$(cat "$HTTP_EXECUTOR_PID_FILE")" >/dev/null 2>&1; then
    log "AMR HTTP executor loop: running PID=$(cat "$HTTP_EXECUTOR_PID_FILE")"
  else
    log "AMR HTTP executor loop: not running"
  fi

  if [[ -f "$RVIZ_PREVIEW_PID_FILE" ]] && kill -0 "$(cat "$RVIZ_PREVIEW_PID_FILE")" >/dev/null 2>&1; then
    log "RViz preview stream: running PID=$(cat "$RVIZ_PREVIEW_PID_FILE")"
  else
    log "RViz preview stream: not running"
  fi

  if [[ -f "$RVIZ_VIEWER_PID_FILE" ]] && kill -0 "$(cat "$RVIZ_VIEWER_PID_FILE")" >/dev/null 2>&1; then
    log "RViz viewer: running PID=$(cat "$RVIZ_VIEWER_PID_FILE")"
  else
    log "RViz viewer: not running"
  fi
}

print_urls() {
  log "服务已就绪，不会自动跑任务。"
  log "Frontend 页面：$FRONTEND_URL"
  log "Dashboard WMS proxy：$DASHBOARD_API_BASE_URL/api/wms/tasks"
  log "Simulation Preview：$DASHBOARD_API_BASE_URL/api/sim/preview"
  log "Dashboard health：$DASHBOARD_API_BASE_URL/health"
  log "AMR Mock WMS API：$AMR_API_BASE_URL/tasks"
  if [[ -n "$GAZEBO_CAMERA_MJPEG_URL" ]]; then
    log "Simulation Preview MJPEG：$GAZEBO_CAMERA_MJPEG_URL"
  else
    log "Simulation Preview MJPEG：未配置，Simulation Preview 会保持 disconnected"
  fi
  if [[ "$AUTO_LOCAL_RVIZ_PREVIEW" == true ]]; then
    log "Simulation Preview source：本地 RViz path capture"
    log "RViz preview 日志：$RVIZ_PREVIEW_LOG"
  fi
  if [[ "$WITH_AMR_VISUALIZATION" == true ]]; then
    log "AMR 可视化：已请求启动，Gazebo/RViz 中可观察 Dashboard 创建任务后的执行过程"
    log "AMR HTTP executor loop 日志：$HTTP_EXECUTOR_LOG"
  else
    log "如需观察任务执行过程：./scripts/start_dashboard_api_stack.sh --with-amr-visualization"
  fi
  log "日志目录：$LOG_DIR"
  log "停止本脚本启动的服务：./scripts/start_dashboard_api_stack.sh --stop"
}

main() {
  parse_args "$@"
  configure_sim_preview_defaults

  require_command curl
  require_command python3
  require_command nohup

  ensure_paths
  start_amr_api_if_needed
  start_dashboard_backend_if_needed
  start_frontend_if_needed
  start_amr_visualization_if_requested
  print_urls
}

main "$@"
