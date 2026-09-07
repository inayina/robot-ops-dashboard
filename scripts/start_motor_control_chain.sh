#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ROS_SETUP="${ROS_SETUP:-/opt/ros/jazzy/setup.bash}"
MICROROS_SETUP="${MICROROS_SETUP:-/home/ina/microros_ws/install/setup.bash}"
ROBOT_MQTT_BRIDGE_SRC_DIR="${ROBOT_MQTT_BRIDGE_SRC_DIR:-/home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1/ros2/robot_mqtt_bridge}"

MQTT_HOST="${MQTT_HOST:-127.0.0.1}"
MQTT_PORT="${MQTT_PORT:-1883}"
MQTT_BROKER_URL="${MQTT_BROKER_URL:-mqtt://$MQTT_HOST:$MQTT_PORT}"
MQTT_MOTOR_STATUS_TOPIC="${MQTT_MOTOR_STATUS_TOPIC:-robot/motor/status}"
MQTT_MOTOR_CMD_TOPIC="${MQTT_MOTOR_CMD_TOPIC:-robot/motor/cmd}"
ROBOT_MOTOR_STATUS_TOPIC="${ROBOT_MOTOR_STATUS_TOPIC:-/motor/status}"
ROBOT_MOTOR_CMD_TOPIC="${ROBOT_MOTOR_CMD_TOPIC:-/motor/cmd}"
ROBOT_ID="${ROBOT_ID:-amr-001}"

MOTOR_CMD_MAX_ABS_RPM="${MOTOR_CMD_MAX_ABS_RPM:-80.0}"
MOTOR_CMD_MAX_PWM_LIMIT="${MOTOR_CMD_MAX_PWM_LIMIT:-0.25}"

DASHBOARD_HOST="${DASHBOARD_HOST:-127.0.0.1}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9000}"
DASHBOARD_API_BASE_URL="${DASHBOARD_API_BASE_URL:-http://$DASHBOARD_HOST:$DASHBOARD_PORT}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-8001}"
FRONTEND_URL="${FRONTEND_URL:-http://$FRONTEND_HOST:$FRONTEND_PORT/frontend/}"
ROBOT_OPS_TASK_SOURCE="${ROBOT_OPS_TASK_SOURCE:-mock_json}"

LOG_DIR="${LOG_DIR:-/tmp/robot_ops_motor_control_chain}"
PID_DIR="$LOG_DIR/pids"
MQTT_LOG="$LOG_DIR/mqtt_broker.log"
MOTOR_STATUS_BRIDGE_LOG="$LOG_DIR/motor_status_bridge.log"
MOTOR_CMD_BRIDGE_LOG="$LOG_DIR/motor_cmd_bridge.log"
DASHBOARD_BACKEND_LOG="$LOG_DIR/dashboard_backend.log"
FRONTEND_LOG="$LOG_DIR/frontend_static.log"

MQTT_PID_FILE="$PID_DIR/mqtt_broker.pid"
MOTOR_STATUS_BRIDGE_PID_FILE="$PID_DIR/motor_status_bridge.pid"
MOTOR_CMD_BRIDGE_PID_FILE="$PID_DIR/motor_cmd_bridge.pid"
DASHBOARD_PID_FILE="$PID_DIR/dashboard_backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend_static.pid"

CHECK_ONLY=false
STATUS_ONLY=false
STOP_ONLY=false
START_DASHBOARD=true
START_FRONTEND=true
START_MQTT=true
START_MOTOR_STATUS_BRIDGE=true
START_MOTOR_CMD_BRIDGE=true
SEND_STOP_PROBE=false

usage() {
  cat <<EOF
用法：
  $(basename "$0") [选项]

启动或复用电机 bench 控制链路，不启动 micro-ROS agent：
  1. MQTT broker: $MQTT_BROKER_URL
  2. ROS 2 -> MQTT motor status bridge: $ROBOT_MOTOR_STATUS_TOPIC -> $MQTT_MOTOR_STATUS_TOPIC
  3. MQTT -> ROS 2 motor cmd bridge: $MQTT_MOTOR_CMD_TOPIC -> $ROBOT_MOTOR_CMD_TOPIC
  4. Dashboard backend: $DASHBOARD_API_BASE_URL
  5. Frontend page: $FRONTEND_URL

选项：
  --ros-setup PATH             ROS 2 setup.bash，默认：$ROS_SETUP
  --microros-setup PATH        micro-ROS setup.bash，默认：$MICROROS_SETUP
  --motor-bridge-src PATH      motor bridge 源码目录，默认：$ROBOT_MQTT_BRIDGE_SRC_DIR
  --motor-status-topic TOPIC   ROS 2 motor status topic，默认：$ROBOT_MOTOR_STATUS_TOPIC
  --motor-cmd-topic TOPIC      ROS 2 motor cmd topic，默认：$ROBOT_MOTOR_CMD_TOPIC
  --motor-status-mqtt-topic TOPIC
                              MQTT motor status topic，默认：$MQTT_MOTOR_STATUS_TOPIC
  --motor-cmd-mqtt-topic TOPIC MQTT motor cmd topic，默认：$MQTT_MOTOR_CMD_TOPIC
  --mqtt-broker URL            MQTT broker URL，默认：$MQTT_BROKER_URL
  --robot-id ID                MQTT payload robot_id，默认：$ROBOT_ID
  --no-mqtt                    不启动/探测本地 MQTT broker
  --no-dashboard               不启动 Dashboard backend
  --no-frontend                不启动 Vite 前端页面
  --no-motor-status-bridge     不启动 /motor/status -> MQTT bridge
  --no-motor-cmd-bridge        不启动 robot/motor/cmd -> /motor/cmd bridge
  --send-stop-probe            启动后显式发送一次 stop=true 探针命令
  --check                      只做本地配置自检，不启动进程
  --status                     打印当前状态
  --stop                       停止本脚本上次启动的进程
  -h, --help                   显示帮助

常用：
  ./scripts/start_motor_control_chain.sh
  ./scripts/start_motor_control_chain.sh --check
  ./scripts/start_motor_control_chain.sh --status
  ./scripts/start_motor_control_chain.sh --stop
EOF
}

log() {
  echo "[motor-chain] $*"
}

fail() {
  echo "[motor-chain] ERROR: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "缺少依赖命令：$1"
  fi
}

ensure_dirs() {
  mkdir -p "$LOG_DIR" "$PID_DIR"
}

write_pid_file() {
  local pid=$1
  local pid_file=$2
  echo "$pid" >"$pid_file"
}

pid_file_running() {
  local pid_file=$1
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file")"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
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

parse_mqtt_url() {
  python3 - "$MQTT_BROKER_URL" <<'PY'
import sys
from urllib.parse import urlparse

url = sys.argv[1]
parsed = urlparse(url if "://" in url else f"mqtt://{url}")
if parsed.scheme not in {"mqtt", "tcp"} or not parsed.hostname:
    raise SystemExit(f"Invalid MQTT broker URL: {url}")
print(parsed.hostname)
print(parsed.port or 1883)
PY
}

refresh_mqtt_host_port() {
  local parsed
  parsed="$(parse_mqtt_url)"
  MQTT_HOST="$(echo "$parsed" | sed -n '1p')"
  MQTT_PORT="$(echo "$parsed" | sed -n '2p')"
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
  local output_path=$3
  local attempt

  for attempt in {1..30}; do
    if http_get "$url" "$output_path"; then
      log "$label ready: $url"
      return 0
    fi
    sleep 1
  done

  fail "$label 在 30 秒内未就绪：$url"
}

mqtt_available() {
  mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "robot/ops-dashboard/motor-chain/probe" -m "probe" >/dev/null 2>&1
}

ros_topic_exists() {
  local topic=$1
  bash -lc "
    source '$ROS_SETUP'
    source '$MICROROS_SETUP'
    ros2 topic list 2>/dev/null | grep -Fx '$topic' >/dev/null
  "
}

venv_site_packages() {
  "$DASHBOARD_ROOT/.venv/bin/python" - <<'PY'
import site
print(site.getsitepackages()[0])
PY
}

ensure_paths() {
  [[ -f "$ROS_SETUP" ]] || fail "未找到 ROS 2 setup.bash：$ROS_SETUP"
  [[ -f "$MICROROS_SETUP" ]] || fail "未找到 micro-ROS setup.bash：$MICROROS_SETUP"
  [[ -d "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge" ]] || fail "未找到 motor bridge 源码目录：$ROBOT_MQTT_BRIDGE_SRC_DIR"
  [[ -f "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge/motor_status_bridge_node.py" ]] || fail "未找到 motor_status_bridge_node.py"
  [[ -f "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge/motor_cmd_bridge_node.py" ]] || fail "未找到 motor_cmd_bridge_node.py"

  if [[ "$START_DASHBOARD" == true || "$START_MOTOR_STATUS_BRIDGE" == true || "$START_MOTOR_CMD_BRIDGE" == true ]]; then
    [[ -x "$DASHBOARD_ROOT/.venv/bin/python" ]] || fail "未找到 Dashboard Python venv：$DASHBOARD_ROOT/.venv/bin/python"
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ros-setup)
        ROS_SETUP=$2
        shift 2
        ;;
      --microros-setup)
        MICROROS_SETUP=$2
        shift 2
        ;;
      --motor-bridge-src)
        ROBOT_MQTT_BRIDGE_SRC_DIR=$2
        shift 2
        ;;
      --motor-status-topic)
        ROBOT_MOTOR_STATUS_TOPIC=$2
        shift 2
        ;;
      --motor-cmd-topic)
        ROBOT_MOTOR_CMD_TOPIC=$2
        shift 2
        ;;
      --motor-status-mqtt-topic)
        MQTT_MOTOR_STATUS_TOPIC=$2
        shift 2
        ;;
      --motor-cmd-mqtt-topic)
        MQTT_MOTOR_CMD_TOPIC=$2
        shift 2
        ;;
      --mqtt-broker)
        MQTT_BROKER_URL=$2
        shift 2
        ;;
      --robot-id)
        ROBOT_ID=$2
        shift 2
        ;;
      --no-mqtt)
        START_MQTT=false
        shift
        ;;
      --no-dashboard)
        START_DASHBOARD=false
        shift
        ;;
      --no-frontend)
        START_FRONTEND=false
        shift
        ;;
      --no-motor-status-bridge)
        START_MOTOR_STATUS_BRIDGE=false
        shift
        ;;
      --no-motor-cmd-bridge)
        START_MOTOR_CMD_BRIDGE=false
        shift
        ;;
      --send-stop-probe)
        SEND_STOP_PROBE=true
        shift
        ;;
      --check)
        CHECK_ONLY=true
        shift
        ;;
      --status)
        STATUS_ONLY=true
        shift
        ;;
      --stop)
        STOP_ONLY=true
        shift
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

  refresh_mqtt_host_port
}

run_check() {
  ensure_dirs
  require_command bash
  require_command curl
  require_command python3
  bash -n "$0"
  if [[ "$START_MQTT" == true ]]; then
    require_command mosquitto_pub
  fi
  ensure_paths
  python3 -m py_compile \
    "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge/motor_status_bridge_node.py" \
    "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge/motor_cmd_bridge_node.py"

  if [[ "$START_MQTT" == true ]]; then
    if mqtt_available; then
      log "MQTT broker: OK $MQTT_BROKER_URL"
    else
      log "MQTT broker: unavailable $MQTT_BROKER_URL（启动时会尝试启动本地 mosquitto）"
    fi
  fi

  if ros_topic_exists "$ROBOT_MOTOR_STATUS_TOPIC"; then
    log "ROS 2 motor status topic: OK $ROBOT_MOTOR_STATUS_TOPIC"
  else
    log "ROS 2 motor status topic: not detected（bridge 可启动，但暂时不会有状态数据）"
  fi

  if ros_topic_exists "$ROBOT_MOTOR_CMD_TOPIC"; then
    log "ROS 2 motor cmd topic: OK $ROBOT_MOTOR_CMD_TOPIC"
  else
    log "ROS 2 motor cmd topic: not detected（cmd bridge 启动后应发布该 topic）"
  fi

  log "Motor status bridge: OK，支持 $ROBOT_MOTOR_STATUS_TOPIC -> $MQTT_MOTOR_STATUS_TOPIC。"
  log "Motor cmd bridge: OK，支持 $MQTT_MOTOR_CMD_TOPIC -> $ROBOT_MOTOR_CMD_TOPIC。"
  log "自检完成：未启动任何进程。"
}

start_mqtt_if_needed() {
  if [[ "$START_MQTT" != true ]]; then
    return 0
  fi

  require_command mosquitto_pub
  if mqtt_available; then
    log "MQTT broker 已可用：$MQTT_BROKER_URL"
    return 0
  fi

  require_command mosquitto
  log "启动本地 MQTT broker：$MQTT_BROKER_URL，日志：$MQTT_LOG"
  setsid mosquitto -p "$MQTT_PORT" >"$MQTT_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$MQTT_PID_FILE"
  sleep 2

  if ! mqtt_available; then
    fail "MQTT broker 启动后不可用，请查看日志：$MQTT_LOG"
  fi
}

start_motor_status_bridge_if_needed() {
  if [[ "$START_MOTOR_STATUS_BRIDGE" != true ]]; then
    return 0
  fi

  if pid_file_running "$MOTOR_STATUS_BRIDGE_PID_FILE"; then
    log "ROS 2 -> MQTT motor status bridge 已在运行，PID=$(cat "$MOTOR_STATUS_BRIDGE_PID_FILE")"
    return 0
  fi

  local site_packages
  site_packages="$(venv_site_packages)"
  log "启动 ROS 2 -> MQTT motor status bridge：$ROBOT_MOTOR_STATUS_TOPIC -> $MQTT_MOTOR_STATUS_TOPIC，日志：$MOTOR_STATUS_BRIDGE_LOG"
  setsid bash -lc "
    source '$ROS_SETUP'
    source '$MICROROS_SETUP'
    export PYTHONPATH='$ROBOT_MQTT_BRIDGE_SRC_DIR':'$site_packages':\${PYTHONPATH:-}
    exec python3 -m robot_mqtt_bridge.motor_status_bridge_node --ros-args \
      -p motor_status_topic:='$ROBOT_MOTOR_STATUS_TOPIC' \
      -p mqtt_host:='$MQTT_HOST' \
      -p mqtt_port:=$MQTT_PORT \
      -p mqtt_topic:='$MQTT_MOTOR_STATUS_TOPIC' \
      -p robot_id:='$ROBOT_ID'
  " >"$MOTOR_STATUS_BRIDGE_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$MOTOR_STATUS_BRIDGE_PID_FILE"
  sleep 2

  if ! pid_file_running "$MOTOR_STATUS_BRIDGE_PID_FILE"; then
    fail "ROS 2 -> MQTT motor status bridge 启动后退出，请查看日志：$MOTOR_STATUS_BRIDGE_LOG"
  fi
}

start_motor_cmd_bridge_if_needed() {
  if [[ "$START_MOTOR_CMD_BRIDGE" != true ]]; then
    return 0
  fi

  if pid_file_running "$MOTOR_CMD_BRIDGE_PID_FILE"; then
    log "MQTT -> ROS 2 motor cmd bridge 已在运行，PID=$(cat "$MOTOR_CMD_BRIDGE_PID_FILE")"
    return 0
  fi

  local site_packages
  site_packages="$(venv_site_packages)"
  log "启动 MQTT -> ROS 2 motor cmd bridge：$MQTT_MOTOR_CMD_TOPIC -> $ROBOT_MOTOR_CMD_TOPIC，日志：$MOTOR_CMD_BRIDGE_LOG"
  setsid bash -lc "
    source '$ROS_SETUP'
    source '$MICROROS_SETUP'
    export PYTHONPATH='$ROBOT_MQTT_BRIDGE_SRC_DIR':'$site_packages':\${PYTHONPATH:-}
    exec python3 -m robot_mqtt_bridge.motor_cmd_bridge_node --ros-args \
      -p ros_cmd_topic:='$ROBOT_MOTOR_CMD_TOPIC' \
      -p mqtt_host:='$MQTT_HOST' \
      -p mqtt_port:=$MQTT_PORT \
      -p mqtt_topic:='$MQTT_MOTOR_CMD_TOPIC' \
      -p robot_id:='$ROBOT_ID' \
      -p max_abs_target_rpm:=$MOTOR_CMD_MAX_ABS_RPM \
      -p max_pwm_limit:=$MOTOR_CMD_MAX_PWM_LIMIT
  " >"$MOTOR_CMD_BRIDGE_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$MOTOR_CMD_BRIDGE_PID_FILE"
  sleep 2

  if ! pid_file_running "$MOTOR_CMD_BRIDGE_PID_FILE"; then
    fail "MQTT -> ROS 2 motor cmd bridge 启动后退出，请查看日志：$MOTOR_CMD_BRIDGE_LOG"
  fi
}

start_dashboard_backend_if_needed() {
  if [[ "$START_DASHBOARD" != true ]]; then
    return 0
  fi

  local health_json="$LOG_DIR/dashboard_health.json"
  local dashboard_python="$DASHBOARD_ROOT/.venv/bin/python"

  if http_get "$DASHBOARD_API_BASE_URL/health" "$health_json"; then
    log "Dashboard backend 已在运行：$DASHBOARD_API_BASE_URL"
    return 0
  fi

  log "启动 Dashboard backend，日志：$DASHBOARD_BACKEND_LOG"
  setsid bash -lc "
    cd '$DASHBOARD_ROOT'
    exec env \
      ROBOT_OPS_TASK_SOURCE='$ROBOT_OPS_TASK_SOURCE' \
      MQTT_BROKER_URL='$MQTT_BROKER_URL' \
      MQTT_MOTOR_CMD_TOPIC='$MQTT_MOTOR_CMD_TOPIC' \
      MOTOR_CMD_MAX_ABS_RPM='$MOTOR_CMD_MAX_ABS_RPM' \
      MOTOR_CMD_MAX_PWM_LIMIT='$MOTOR_CMD_MAX_PWM_LIMIT' \
      '$dashboard_python' -m uvicorn backend.app.main:app \
        --host '$DASHBOARD_HOST' \
        --port '$DASHBOARD_PORT'
  " >"$DASHBOARD_BACKEND_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$DASHBOARD_PID_FILE"
  wait_for_http "$DASHBOARD_API_BASE_URL/health" "Dashboard backend" "$health_json"
}

start_frontend_if_needed() {
  local vite_bin="$DASHBOARD_ROOT/frontend/node_modules/.bin/vite"

  if [[ "$START_FRONTEND" != true ]]; then
    return 0
  fi

  local tmp_file="$LOG_DIR/frontend_probe.html"
  if http_get "$FRONTEND_URL" "$tmp_file"; then
    log "Frontend 已可访问：$FRONTEND_URL"
    return 0
  fi

  if [[ ! -x "$vite_bin" ]]; then
    log "缺少 Vite：请先在 $DASHBOARD_ROOT/frontend 执行 npm install"
    return 1
  fi

  log "启动 Vite 前端：$FRONTEND_URL，日志：$FRONTEND_LOG"
  (
    cd "$DASHBOARD_ROOT/frontend"
    exec setsid "$vite_bin" --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort
  ) >"$FRONTEND_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$FRONTEND_PID_FILE"
  wait_for_http "$FRONTEND_URL" "Frontend" "$tmp_file"
}

send_stop_probe_if_requested() {
  if [[ "$SEND_STOP_PROBE" != true ]]; then
    return 0
  fi

  local response_json="$LOG_DIR/motor_stop_probe_response.json"
  log "发送显式 stop=true 探针命令：$DASHBOARD_API_BASE_URL/api/robot/motor/cmd"
  curl \
    --silent \
    --show-error \
    --noproxy '*' \
    --max-time 5 \
    --request POST \
    --header 'Content-Type: application/json' \
    --data '{"target_speed_mps":0,"target_rpm":0,"enabled":false,"closed_loop":true,"stop":true,"timeout_ms":500}' \
    "$DASHBOARD_API_BASE_URL/api/robot/motor/cmd" \
    >"$response_json"
  log "stop 探针响应已保存：$response_json"
}

print_status() {
  local tmp_file="$LOG_DIR/status_probe.json"

  if [[ "$START_MQTT" == true ]] && mqtt_available; then
    log "MQTT broker: OK $MQTT_BROKER_URL"
  elif [[ "$START_MQTT" == true ]]; then
    log "MQTT broker: unavailable $MQTT_BROKER_URL"
  fi

  if pid_file_running "$MOTOR_STATUS_BRIDGE_PID_FILE"; then
    log "ROS 2 -> MQTT motor status bridge: running PID=$(cat "$MOTOR_STATUS_BRIDGE_PID_FILE")"
  else
    log "ROS 2 -> MQTT motor status bridge: not running"
  fi

  if pid_file_running "$MOTOR_CMD_BRIDGE_PID_FILE"; then
    log "MQTT -> ROS 2 motor cmd bridge: running PID=$(cat "$MOTOR_CMD_BRIDGE_PID_FILE")"
  else
    log "MQTT -> ROS 2 motor cmd bridge: not running"
  fi

  if ros_topic_exists "$ROBOT_MOTOR_STATUS_TOPIC"; then
    log "ROS 2 motor status topic: OK $ROBOT_MOTOR_STATUS_TOPIC"
  else
    log "ROS 2 motor status topic: not detected $ROBOT_MOTOR_STATUS_TOPIC"
  fi

  if ros_topic_exists "$ROBOT_MOTOR_CMD_TOPIC"; then
    log "ROS 2 motor cmd topic: OK $ROBOT_MOTOR_CMD_TOPIC"
  else
    log "ROS 2 motor cmd topic: not detected $ROBOT_MOTOR_CMD_TOPIC"
  fi

  if http_get "$DASHBOARD_API_BASE_URL/health" "$tmp_file"; then
    log "Dashboard backend: OK $DASHBOARD_API_BASE_URL"
  else
    log "Dashboard backend: unavailable $DASHBOARD_API_BASE_URL"
  fi

  if http_get "$DASHBOARD_API_BASE_URL/api/robot/status" "$tmp_file"; then
    log "Robot status API: OK $DASHBOARD_API_BASE_URL/api/robot/status"
  else
    log "Robot status API: unavailable"
  fi

  if http_get "$FRONTEND_URL" "$tmp_file"; then
    log "Frontend: OK $FRONTEND_URL"
  else
    log "Frontend: unavailable $FRONTEND_URL"
  fi
}

stop_all() {
  stop_pid_file "ROS 2 -> MQTT motor status bridge" "$MOTOR_STATUS_BRIDGE_PID_FILE"
  stop_pid_file "MQTT -> ROS 2 motor cmd bridge" "$MOTOR_CMD_BRIDGE_PID_FILE"
  stop_pid_file "Dashboard backend" "$DASHBOARD_PID_FILE"
  stop_pid_file "Frontend static server" "$FRONTEND_PID_FILE"
  stop_pid_file "MQTT broker" "$MQTT_PID_FILE"
}

print_urls() {
  log "电机控制链路已启动。"
  log "Frontend 页面：$FRONTEND_URL"
  log "Robot status API：$DASHBOARD_API_BASE_URL/api/robot/status"
  log "Motor command API：$DASHBOARD_API_BASE_URL/api/robot/motor/cmd"
  log "ROS 2 -> MQTT motor status bridge 日志：$MOTOR_STATUS_BRIDGE_LOG"
  log "MQTT -> ROS 2 motor cmd bridge 日志：$MOTOR_CMD_BRIDGE_LOG"
  log "Dashboard backend 日志：$DASHBOARD_BACKEND_LOG"
  log "停止命令：./scripts/start_motor_control_chain.sh --stop"
}

main() {
  parse_args "$@"
  ensure_dirs

  if [[ "$STOP_ONLY" == true ]]; then
    stop_all
    exit 0
  fi

  if [[ "$CHECK_ONLY" == true ]]; then
    run_check
    exit 0
  fi

  if [[ "$STATUS_ONLY" == true ]]; then
    print_status
    exit 0
  fi

  require_command curl
  require_command python3
  ensure_paths
  start_mqtt_if_needed
  start_motor_status_bridge_if_needed
  start_motor_cmd_bridge_if_needed
  start_dashboard_backend_if_needed
  start_frontend_if_needed
  send_stop_probe_if_requested
  print_status
  print_urls
}

main "$@"
