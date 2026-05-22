#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ROS_SETUP="${ROS_SETUP:-/opt/ros/jazzy/setup.bash}"
MICROROS_SETUP="${MICROROS_SETUP:-/home/ina/microros_ws/install/setup.bash}"
MICRO_ROS_TRANSPORT="${MICRO_ROS_TRANSPORT:-udp4}"
MICRO_ROS_UDP_PORT="${MICRO_ROS_UDP_PORT:-8888}"
MICRO_ROS_DEV="${MICRO_ROS_DEV:-/dev/ttyACM0}"
MICRO_ROS_BAUD="${MICRO_ROS_BAUD:-115200}"
MICRO_ROS_IMU_TOPIC="${MICRO_ROS_IMU_TOPIC:-auto}"
MICRO_ROS_IMU_TOPICS="${MICRO_ROS_IMU_TOPICS:-/imu/data /imu/filtered}"
MICRO_ROS_TOPIC_WAIT_SECONDS="${MICRO_ROS_TOPIC_WAIT_SECONDS:-45}"
MICRO_ROS_MESSAGE_TYPE="${MICRO_ROS_MESSAGE_TYPE:-sensor_msgs/msg/Imu}"

MQTT_HOST="${MQTT_HOST:-127.0.0.1}"
MQTT_PORT="${MQTT_PORT:-1883}"
MQTT_BROKER_URL="${MQTT_BROKER_URL:-mqtt://$MQTT_HOST:$MQTT_PORT}"
MQTT_IMU_TOPIC="${MQTT_IMU_TOPIC:-robot/imu}"
MICRO_ROS_STATE_TOPIC="${MICRO_ROS_STATE_TOPIC:-/robot/state}"
MQTT_STATE_TOPIC="${MQTT_STATE_TOPIC:-robot/state}"
ROBOT_MQTT_BRIDGE_SRC_DIR="${ROBOT_MQTT_BRIDGE_SRC_DIR:-/home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1/ros2/robot_mqtt_bridge}"
ROBOT_MOTOR_STATUS_TOPIC="${ROBOT_MOTOR_STATUS_TOPIC:-/motor/status}"
ROBOT_MOTOR_CMD_TOPIC="${ROBOT_MOTOR_CMD_TOPIC:-/motor/cmd}"
MQTT_MOTOR_STATUS_TOPIC="${MQTT_MOTOR_STATUS_TOPIC:-robot/motor/status}"
MQTT_MOTOR_CMD_TOPIC="${MQTT_MOTOR_CMD_TOPIC:-robot/motor/cmd}"
MOTOR_CMD_MAX_ABS_RPM="${MOTOR_CMD_MAX_ABS_RPM:-80.0}"
MOTOR_CMD_MAX_PWM_LIMIT="${MOTOR_CMD_MAX_PWM_LIMIT:-0.25}"
ROBOT_ID="${ROBOT_ID:-amr-001}"
BRIDGE_RATE_LIMIT_HZ="${BRIDGE_RATE_LIMIT_HZ:-5}"

DASHBOARD_HOST="${DASHBOARD_HOST:-127.0.0.1}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9000}"
DASHBOARD_API_BASE_URL="${DASHBOARD_API_BASE_URL:-http://$DASHBOARD_HOST:$DASHBOARD_PORT}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-8001}"
FRONTEND_URL="${FRONTEND_URL:-http://$FRONTEND_HOST:$FRONTEND_PORT/frontend/}"
ROBOT_OPS_TASK_SOURCE="${ROBOT_OPS_TASK_SOURCE:-mock_json}"

LOG_DIR="${LOG_DIR:-/tmp/robot_ops_microros_sensor_stack}"
PID_DIR="$LOG_DIR/pids"
MQTT_LOG="$LOG_DIR/mqtt_broker.log"
AGENT_LOG="$LOG_DIR/micro_ros_agent.log"
BRIDGE_LOG="$LOG_DIR/microros_imu_to_mqtt_bridge.log"
STATE_BRIDGE_LOG="$LOG_DIR/microros_state_to_mqtt_bridge.log"
MOTOR_STATUS_BRIDGE_LOG="$LOG_DIR/robot_motor_status_bridge.log"
MOTOR_CMD_BRIDGE_LOG="$LOG_DIR/robot_motor_cmd_bridge.log"
DASHBOARD_BACKEND_LOG="$LOG_DIR/dashboard_backend.log"
FRONTEND_LOG="$LOG_DIR/frontend_static.log"

MQTT_PID_FILE="$PID_DIR/mqtt_broker.pid"
AGENT_PID_FILE="$PID_DIR/micro_ros_agent.pid"
BRIDGE_PID_FILE="$PID_DIR/microros_imu_to_mqtt_bridge.pid"
STATE_BRIDGE_PID_FILE="$PID_DIR/microros_state_to_mqtt_bridge.pid"
MOTOR_STATUS_BRIDGE_PID_FILE="$PID_DIR/robot_motor_status_bridge.pid"
MOTOR_CMD_BRIDGE_PID_FILE="$PID_DIR/robot_motor_cmd_bridge.pid"
DASHBOARD_PID_FILE="$PID_DIR/dashboard_backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend_static.pid"

START_DASHBOARD=true
START_FRONTEND=true
START_BRIDGE=true
START_STATE_BRIDGE=true
START_MOTOR_STATUS_BRIDGE=true
START_MOTOR_CMD_BRIDGE=true
START_MQTT=true
CHECK_ONLY=false

usage() {
  cat <<EOF
用法：
  $(basename "$0") [选项]

一键启动 micro-ROS + Motor 看板联调链路：
  1. MQTT broker: $MQTT_BROKER_URL
  2. micro-ROS agent: $MICRO_ROS_TRANSPORT
  3. ROS 2 -> MQTT bridge: $MICRO_ROS_IMU_TOPIC -> $MQTT_IMU_TOPIC
  4. ROS 2 -> MQTT state bridge: $MICRO_ROS_STATE_TOPIC -> $MQTT_STATE_TOPIC
  5. ROS 2 -> MQTT motor status bridge: $ROBOT_MOTOR_STATUS_TOPIC -> $MQTT_MOTOR_STATUS_TOPIC
  6. MQTT -> ROS 2 motor cmd bridge: $MQTT_MOTOR_CMD_TOPIC -> $ROBOT_MOTOR_CMD_TOPIC
  7. Dashboard backend: $DASHBOARD_API_BASE_URL
  8. Frontend page: $FRONTEND_URL

选项：
  --transport MODE       micro-ROS Agent transport，默认：$MICRO_ROS_TRANSPORT，支持 udp4 或 serial
  --udp-port PORT        micro-ROS UDP 端口，默认：$MICRO_ROS_UDP_PORT
  --dev PATH             serial 模式串口设备，默认：$MICRO_ROS_DEV
  --baud RATE            serial 模式波特率，默认：$MICRO_ROS_BAUD
  --ros-setup PATH       ROS 2 setup.bash，默认：$ROS_SETUP
  --microros-setup PATH  micro-ROS 工作空间 setup.bash，默认：$MICROROS_SETUP
  --imu-topic TOPIC      ROS 2 IMU topic，默认 auto，在 $MICRO_ROS_IMU_TOPICS 中选择
  --state-topic TOPIC    ROS 2 robot state topic，默认：$MICRO_ROS_STATE_TOPIC
  --topic-wait SEC       等待 IMU topic 出现的秒数，默认：$MICRO_ROS_TOPIC_WAIT_SECONDS
  --message-type TYPE    支持 sensor_msgs/msg/Imu 或 std_msgs/msg/String，默认：$MICRO_ROS_MESSAGE_TYPE
  --mqtt-broker URL      MQTT broker URL，默认：$MQTT_BROKER_URL
  --mqtt-topic TOPIC     Dashboard MQTT topic，默认：$MQTT_IMU_TOPIC
  --state-mqtt-topic TOPIC Dashboard robot state MQTT topic，默认：$MQTT_STATE_TOPIC
  --motor-bridge-src PATH motor bridge 源码目录，默认：$ROBOT_MQTT_BRIDGE_SRC_DIR
  --motor-status-topic TOPIC ROS 2 motor status topic，默认：$ROBOT_MOTOR_STATUS_TOPIC
  --motor-cmd-topic TOPIC  ROS 2 motor cmd topic，默认：$ROBOT_MOTOR_CMD_TOPIC
  --motor-status-mqtt-topic TOPIC MQTT motor status topic，默认：$MQTT_MOTOR_STATUS_TOPIC
  --motor-cmd-mqtt-topic TOPIC MQTT motor cmd topic，默认：$MQTT_MOTOR_CMD_TOPIC
  --robot-id ID          MQTT payload robot_id，默认：$ROBOT_ID
  --rate-limit-hz HZ     ROS 2 -> MQTT 桥接限频，默认：$BRIDGE_RATE_LIMIT_HZ
  --no-dashboard         不启动 Dashboard backend
  --no-frontend          不启动前端静态页面
  --no-bridge            只启动 micro-ROS agent，不启动 IMU/state/motor bridges
  --no-state-bridge      不启动 /robot/state -> MQTT bridge
  --no-motor-bridge      不启动 motor status / cmd bridges
  --no-motor-status-bridge 不启动 /motor/status -> MQTT bridge
  --no-motor-cmd-bridge  不启动 robot/motor/cmd -> /motor/cmd bridge
  --no-mqtt              不启动/探测本地 MQTT broker
  --check                只做脚本与本地配置自检，不启动进程
  --stop                 停止本脚本上次启动的服务
  --status               打印当前服务探测结果
  -h, --help             显示帮助

常用：
  ./scripts/start_microros_sensor_stack.sh
  ./scripts/start_microros_sensor_stack.sh --imu-topic /imu/data
  ./scripts/start_microros_sensor_stack.sh --transport serial --dev /dev/ttyACM0
  ./scripts/start_microros_sensor_stack.sh --stop

环境变量：
  ROS_SETUP、MICROROS_SETUP、MICRO_ROS_TRANSPORT、MICRO_ROS_UDP_PORT、
  MICRO_ROS_DEV、MICRO_ROS_BAUD、MICRO_ROS_IMU_TOPIC、MICRO_ROS_IMU_TOPICS、
  MICRO_ROS_STATE_TOPIC、MICRO_ROS_TOPIC_WAIT_SECONDS、MICRO_ROS_MESSAGE_TYPE、
  MQTT_BROKER_URL、MQTT_IMU_TOPIC、MQTT_STATE_TOPIC、ROBOT_MQTT_BRIDGE_SRC_DIR、
  ROBOT_MOTOR_STATUS_TOPIC、ROBOT_MOTOR_CMD_TOPIC、MQTT_MOTOR_STATUS_TOPIC、
  MQTT_MOTOR_CMD_TOPIC、MOTOR_CMD_MAX_ABS_RPM、MOTOR_CMD_MAX_PWM_LIMIT、
  ROBOT_ID、DASHBOARD_PORT、FRONTEND_PORT、LOG_DIR
EOF
}

log() {
  echo "[microros-stack] $*"
}

fail() {
  echo "[microros-stack] ERROR: $*" >&2
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

parse_mqtt_url() {
  python3 - "$MQTT_BROKER_URL" <<'PY'
import sys
from urllib.parse import urlparse

url = sys.argv[1]
if "://" not in url:
    url = f"mqtt://{url}"
parsed = urlparse(url)
print(parsed.hostname or "127.0.0.1")
print(parsed.port or 1883)
PY
}

refresh_mqtt_host_port() {
  local parsed
  parsed="$(parse_mqtt_url)"
  MQTT_HOST="$(echo "$parsed" | sed -n '1p')"
  MQTT_PORT="$(echo "$parsed" | sed -n '2p')"
}

ensure_dirs() {
  mkdir -p "$LOG_DIR" "$PID_DIR"
}

ensure_start_paths() {
  [[ -f "$ROS_SETUP" ]] || fail "未找到 ROS 2 setup.bash：$ROS_SETUP"
  [[ -f "$MICROROS_SETUP" ]] || fail "未找到 micro-ROS setup.bash：$MICROROS_SETUP"
  if [[ "$START_DASHBOARD" == true || "$START_BRIDGE" == true || "$START_STATE_BRIDGE" == true ]]; then
    [[ -x "$DASHBOARD_ROOT/.venv/bin/python" ]] || fail "未找到 Dashboard Python venv：$DASHBOARD_ROOT/.venv/bin/python"
  fi
  if [[ "$START_BRIDGE" == true || "$START_STATE_BRIDGE" == true ]]; then
    [[ -f "$SCRIPT_DIR/microros_imu_to_mqtt_bridge.py" ]] || fail "未找到 bridge 脚本。"
  fi
  if [[ "$START_MOTOR_STATUS_BRIDGE" == true || "$START_MOTOR_CMD_BRIDGE" == true ]]; then
    [[ -d "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge" ]] || fail "未找到 motor bridge 源码目录：$ROBOT_MQTT_BRIDGE_SRC_DIR"
    [[ -f "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge/motor_status_bridge_node.py" ]] || fail "未找到 motor_status_bridge_node.py"
    [[ -f "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge/motor_cmd_bridge_node.py" ]] || fail "未找到 motor_cmd_bridge_node.py"
  fi
  if [[ "$MICRO_ROS_TRANSPORT" != "udp4" && "$MICRO_ROS_TRANSPORT" != "serial" ]]; then
    fail "不支持的 micro-ROS Agent transport：$MICRO_ROS_TRANSPORT"
  fi

  if [[ "$MICRO_ROS_TRANSPORT" == "serial" ]]; then
    [[ -e "$MICRO_ROS_DEV" ]] || fail "未找到串口设备：$MICRO_ROS_DEV"
    if [[ ! -r "$MICRO_ROS_DEV" || ! -w "$MICRO_ROS_DEV" ]]; then
      fail "当前用户无法读写 $MICRO_ROS_DEV。临时调试可执行：sudo chmod a+rw $MICRO_ROS_DEV；长期建议把用户加入 dialout 组后重新登录。"
    fi
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --transport)
        MICRO_ROS_TRANSPORT=$2
        shift 2
        ;;
      --udp-port)
        MICRO_ROS_UDP_PORT=$2
        shift 2
        ;;
      --dev)
        MICRO_ROS_DEV=$2
        shift 2
        ;;
      --baud)
        MICRO_ROS_BAUD=$2
        shift 2
        ;;
      --ros-setup)
        ROS_SETUP=$2
        shift 2
        ;;
      --microros-setup)
        MICROROS_SETUP=$2
        shift 2
        ;;
      --imu-topic)
        MICRO_ROS_IMU_TOPIC=$2
        shift 2
        ;;
      --state-topic)
        MICRO_ROS_STATE_TOPIC=$2
        shift 2
        ;;
      --topic-wait)
        MICRO_ROS_TOPIC_WAIT_SECONDS=$2
        shift 2
        ;;
      --message-type)
        MICRO_ROS_MESSAGE_TYPE=$2
        shift 2
        ;;
      --mqtt-broker)
        MQTT_BROKER_URL=$2
        shift 2
        ;;
      --mqtt-topic)
        MQTT_IMU_TOPIC=$2
        shift 2
        ;;
      --state-mqtt-topic)
        MQTT_STATE_TOPIC=$2
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
      --robot-id)
        ROBOT_ID=$2
        shift 2
        ;;
      --rate-limit-hz)
        BRIDGE_RATE_LIMIT_HZ=$2
        shift 2
        ;;
      --no-dashboard)
        START_DASHBOARD=false
        START_FRONTEND=false
        shift
        ;;
      --no-frontend)
        START_FRONTEND=false
        shift
        ;;
      --no-bridge)
        START_BRIDGE=false
        START_STATE_BRIDGE=false
        START_MOTOR_STATUS_BRIDGE=false
        START_MOTOR_CMD_BRIDGE=false
        shift
        ;;
      --no-state-bridge)
        START_STATE_BRIDGE=false
        shift
        ;;
      --no-motor-bridge)
        START_MOTOR_STATUS_BRIDGE=false
        START_MOTOR_CMD_BRIDGE=false
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
      --no-mqtt)
        START_MQTT=false
        shift
        ;;
      --check)
        CHECK_ONLY=true
        shift
        ;;
      --stop)
        ensure_dirs
        stop_pid_file "Frontend static server" "$FRONTEND_PID_FILE"
        stop_pid_file "Dashboard backend" "$DASHBOARD_PID_FILE"
        stop_pid_file "ROS 2 -> MQTT bridge" "$BRIDGE_PID_FILE"
        stop_pid_file "ROS 2 -> MQTT state bridge" "$STATE_BRIDGE_PID_FILE"
        stop_pid_file "ROS 2 -> MQTT motor status bridge" "$MOTOR_STATUS_BRIDGE_PID_FILE"
        stop_pid_file "MQTT -> ROS 2 motor cmd bridge" "$MOTOR_CMD_BRIDGE_PID_FILE"
        stop_pid_file "micro-ROS agent" "$AGENT_PID_FILE"
        stop_pid_file "MQTT broker" "$MQTT_PID_FILE"
        exit 0
        ;;
      --status)
        ensure_dirs
        refresh_mqtt_host_port
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

pid_file_running() {
  local pid_file=$1
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1
}

run_check() {
  refresh_mqtt_host_port
  ensure_dirs
  require_command bash
  require_command python3
  require_command curl
  bash -n "$0"
  if [[ "$START_MQTT" == true ]]; then
    require_command mosquitto_pub
  fi
  ensure_start_paths
  if [[ "$START_BRIDGE" == true || "$START_STATE_BRIDGE" == true ]]; then
    "$DASHBOARD_ROOT/.venv/bin/python" -m py_compile "$SCRIPT_DIR/microros_imu_to_mqtt_bridge.py"
  fi
  if [[ "$START_MOTOR_STATUS_BRIDGE" == true || "$START_MOTOR_CMD_BRIDGE" == true ]]; then
    python3 -m py_compile \
      "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge/motor_status_bridge_node.py" \
      "$ROBOT_MQTT_BRIDGE_SRC_DIR/robot_mqtt_bridge/motor_cmd_bridge_node.py"
  fi
  if check_micro_ros_agent_available; then
    log "micro-ROS Agent: OK"
  else
    fail "micro-ROS Agent: unavailable，请确认 micro-ROS 工作空间已构建并可 source。"
  fi
  print_ros_topic_check
  print_mqtt_check
  log "IMU bridge: OK，脚本可编译，支持 $MICRO_ROS_IMU_TOPIC -> $MQTT_IMU_TOPIC。"
  log "State bridge: OK，脚本可编译，支持 $MICRO_ROS_STATE_TOPIC -> $MQTT_STATE_TOPIC。"
  if [[ "$START_MOTOR_STATUS_BRIDGE" == true ]]; then
    log "Motor status bridge: OK，源码可编译，支持 $ROBOT_MOTOR_STATUS_TOPIC -> $MQTT_MOTOR_STATUS_TOPIC。"
  fi
  if [[ "$START_MOTOR_CMD_BRIDGE" == true ]]; then
    log "Motor cmd bridge: OK，源码可编译，支持 $MQTT_MOTOR_CMD_TOPIC -> $ROBOT_MOTOR_CMD_TOPIC。"
  fi
  log "自检完成：未启动任何进程。"
}

start_mqtt_if_needed() {
  if [[ "$START_MQTT" != true ]]; then
    return 0
  fi

  require_command mosquitto_pub
  if mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "robot/ops-dashboard/probe" -m "probe" >/dev/null 2>&1; then
    log "MQTT broker 已可用：$MQTT_BROKER_URL"
    return 0
  fi

  require_command mosquitto
  log "启动本地 MQTT broker：$MQTT_HOST:$MQTT_PORT"
  setsid mosquitto -p "$MQTT_PORT" >"$MQTT_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$MQTT_PID_FILE"

  local attempt
  for attempt in {1..10}; do
    if mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "robot/ops-dashboard/probe" -m "probe" >/dev/null 2>&1; then
      log "MQTT broker ready: $MQTT_BROKER_URL"
      return 0
    fi
    sleep 1
  done

  fail "MQTT broker 未就绪，请查看日志：$MQTT_LOG"
}

check_micro_ros_agent_available() {
  bash -lc "
    source '$ROS_SETUP'
    source '$MICROROS_SETUP'
    ros2 pkg executables micro_ros_agent >/dev/null
  "
}

start_micro_ros_agent_if_needed() {
  if pid_file_running "$AGENT_PID_FILE"; then
    log "micro-ROS agent 已在运行，PID=$(cat "$AGENT_PID_FILE")"
    return 0
  fi

  check_micro_ros_agent_available || fail "micro_ros_agent 不可用，请确认 micro-ROS 工作空间已构建并可 source。"
  log "启动 micro-ROS agent：$MICRO_ROS_TRANSPORT，日志：$AGENT_LOG"
  if [[ "$MICRO_ROS_TRANSPORT" == "udp4" ]]; then
    setsid bash -lc "
      source '$ROS_SETUP'
      source '$MICROROS_SETUP'
      exec ros2 run micro_ros_agent micro_ros_agent udp4 --port '$MICRO_ROS_UDP_PORT'
    " >"$AGENT_LOG" 2>&1 < /dev/null &
  else
    setsid bash -lc "
      source '$ROS_SETUP'
      source '$MICROROS_SETUP'
      exec ros2 run micro_ros_agent micro_ros_agent serial --dev '$MICRO_ROS_DEV' -b '$MICRO_ROS_BAUD'
    " >"$AGENT_LOG" 2>&1 < /dev/null &
  fi
  write_pid_file "$!" "$AGENT_PID_FILE"
  sleep 2

  if ! pid_file_running "$AGENT_PID_FILE"; then
    fail "micro-ROS agent 启动后退出，请查看日志：$AGENT_LOG"
  fi
}

list_ros_topics() {
  ROS_SETUP_PATH="$ROS_SETUP" MICROROS_SETUP_PATH="$MICROROS_SETUP" bash -lc '
    source "$ROS_SETUP_PATH"
    source "$MICROROS_SETUP_PATH"
    ros2 topic list
  ' 2>/dev/null || true
}

ros_topic_exists() {
  local topic=$1
  local topics
  topics="$(list_ros_topics)"
  while IFS= read -r line; do
    [[ "$line" == "$topic" ]] && return 0
  done <<<"$topics"
  return 1
}

resolve_imu_topic_once() {
  local candidate
  if [[ "$MICRO_ROS_IMU_TOPIC" != "auto" ]]; then
    if ros_topic_exists "$MICRO_ROS_IMU_TOPIC"; then
      echo "$MICRO_ROS_IMU_TOPIC"
      return 0
    fi
    return 1
  fi

  for candidate in $MICRO_ROS_IMU_TOPICS; do
    if ros_topic_exists "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

wait_for_imu_topic_if_needed() {
  if [[ "$START_BRIDGE" != true ]]; then
    return 0
  fi

  local resolved_topic=""
  local waited=0
  local topic_label="$MICRO_ROS_IMU_TOPIC"
  if [[ "$topic_label" == "auto" ]]; then
    topic_label="$MICRO_ROS_IMU_TOPICS"
  fi

  log "等待 ROS 2 IMU topic 出现：$topic_label"
  while [[ "$waited" -lt "$MICRO_ROS_TOPIC_WAIT_SECONDS" ]]; do
    if resolved_topic="$(resolve_imu_topic_once)"; then
      MICRO_ROS_IMU_TOPIC="$resolved_topic"
      log "检测到 ROS 2 IMU topic：$MICRO_ROS_IMU_TOPIC"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  fail "未在 ${MICRO_ROS_TOPIC_WAIT_SECONDS}s 内发现 ROS 2 IMU topic：$topic_label。请确认 ESP32 已复位并通过 micro-ROS UDP 连接到 Agent。"
}

print_ros_topic_check() {
  local resolved_topic=""
  if resolved_topic="$(resolve_imu_topic_once)"; then
    log "ROS 2 IMU topic: OK $resolved_topic"
  else
    log "ROS 2 IMU topic: not detected（启动 Agent 并复位 ESP32 后应出现 $MICRO_ROS_IMU_TOPICS）"
  fi

  if ros_topic_exists "$MICRO_ROS_STATE_TOPIC"; then
    log "ROS 2 robot state topic: OK $MICRO_ROS_STATE_TOPIC"
  else
    log "ROS 2 robot state topic: not detected（期望 topic：$MICRO_ROS_STATE_TOPIC）"
  fi

  if ros_topic_exists "$ROBOT_MOTOR_STATUS_TOPIC"; then
    log "ROS 2 motor status topic: OK $ROBOT_MOTOR_STATUS_TOPIC"
  else
    log "ROS 2 motor status topic: not detected（期望 topic：$ROBOT_MOTOR_STATUS_TOPIC）"
  fi

  if ros_topic_exists "$ROBOT_MOTOR_CMD_TOPIC"; then
    log "ROS 2 motor cmd topic: OK $ROBOT_MOTOR_CMD_TOPIC"
  else
    log "ROS 2 motor cmd topic: not detected（期望 topic：$ROBOT_MOTOR_CMD_TOPIC）"
  fi
}

print_mqtt_check() {
  if mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "robot/ops-dashboard/probe" -m "probe" >/dev/null 2>&1; then
    log "MQTT broker: OK $MQTT_BROKER_URL"
  else
    log "MQTT broker: unavailable $MQTT_BROKER_URL（正常启动时脚本会尝试启动本地 broker）"
  fi
}

venv_site_packages() {
  "$DASHBOARD_ROOT/.venv/bin/python" - <<'PY'
import sys
print(f"{sys.prefix}/lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages")
PY
}

start_bridge_if_needed() {
  if [[ "$START_BRIDGE" != true ]]; then
    return 0
  fi

  if pid_file_running "$BRIDGE_PID_FILE"; then
    log "ROS 2 -> MQTT bridge 已在运行，PID=$(cat "$BRIDGE_PID_FILE")"
    return 0
  fi

  local site_packages
  site_packages="$(venv_site_packages)"
  log "启动 ROS 2 -> MQTT bridge：$MICRO_ROS_IMU_TOPIC -> $MQTT_IMU_TOPIC，日志：$BRIDGE_LOG"
  setsid bash -lc "
    source '$ROS_SETUP'
    source '$MICROROS_SETUP'
    export PYTHONPATH='$site_packages':\${PYTHONPATH:-}
    exec python3 '$SCRIPT_DIR/microros_imu_to_mqtt_bridge.py' \
      --ros-topic '$MICRO_ROS_IMU_TOPIC' \
      --message-type '$MICRO_ROS_MESSAGE_TYPE' \
      --mqtt-broker '$MQTT_BROKER_URL' \
      --mqtt-topic '$MQTT_IMU_TOPIC' \
      --robot-id '$ROBOT_ID' \
      --rate-limit-hz '$BRIDGE_RATE_LIMIT_HZ'
  " >"$BRIDGE_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$BRIDGE_PID_FILE"
  sleep 2

  if ! pid_file_running "$BRIDGE_PID_FILE"; then
    fail "ROS 2 -> MQTT bridge 启动后退出，请查看日志：$BRIDGE_LOG"
  fi
}

start_state_bridge_if_needed() {
  if [[ "$START_STATE_BRIDGE" != true ]]; then
    return 0
  fi

  if pid_file_running "$STATE_BRIDGE_PID_FILE"; then
    log "ROS 2 -> MQTT state bridge 已在运行，PID=$(cat "$STATE_BRIDGE_PID_FILE")"
    return 0
  fi

  local site_packages
  site_packages="$(venv_site_packages)"
  log "启动 ROS 2 -> MQTT state bridge：$MICRO_ROS_STATE_TOPIC -> $MQTT_STATE_TOPIC，日志：$STATE_BRIDGE_LOG"
  setsid bash -lc "
    source '$ROS_SETUP'
    source '$MICROROS_SETUP'
    export PYTHONPATH='$site_packages':\${PYTHONPATH:-}
    exec python3 '$SCRIPT_DIR/microros_imu_to_mqtt_bridge.py' \
      --ros-topic '$MICRO_ROS_STATE_TOPIC' \
      --message-type 'std_msgs/msg/Int32' \
      --mqtt-broker '$MQTT_BROKER_URL' \
      --mqtt-topic '$MQTT_STATE_TOPIC' \
      --robot-id '$ROBOT_ID' \
      --rate-limit-hz '0'
  " >"$STATE_BRIDGE_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$STATE_BRIDGE_PID_FILE"
  sleep 2

  if ! pid_file_running "$STATE_BRIDGE_PID_FILE"; then
    fail "ROS 2 -> MQTT state bridge 启动后退出，请查看日志：$STATE_BRIDGE_LOG"
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
  if http_get "$DASHBOARD_API_BASE_URL/health" "$health_json"; then
    log "Dashboard backend 已在运行：$DASHBOARD_API_BASE_URL"
    return 0
  fi

  log "启动 Dashboard backend，MQTT_BROKER_URL=$MQTT_BROKER_URL"
  (
    cd "$DASHBOARD_ROOT"
    setsid env \
      ROBOT_OPS_TASK_SOURCE="$ROBOT_OPS_TASK_SOURCE" \
      MQTT_BROKER_URL="$MQTT_BROKER_URL" \
      "$DASHBOARD_ROOT/.venv/bin/python" -m uvicorn backend.app.main:app \
        --host "$DASHBOARD_HOST" \
        --port "$DASHBOARD_PORT"
  ) >"$DASHBOARD_BACKEND_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$DASHBOARD_PID_FILE"
  wait_for_http "$DASHBOARD_API_BASE_URL/health" "Dashboard backend" "$health_json"
}

start_frontend_if_needed() {
  if [[ "$START_FRONTEND" != true ]]; then
    return 0
  fi

  local frontend_html="$LOG_DIR/frontend_index.html"
  if http_get "$FRONTEND_URL" "$frontend_html"; then
    log "Frontend 静态服务已在运行：$FRONTEND_URL"
    return 0
  fi

  log "启动前端静态服务：$FRONTEND_URL"
  (
    cd "$DASHBOARD_ROOT"
    setsid python3 -m http.server "$FRONTEND_PORT" --bind "$FRONTEND_HOST"
  ) >"$FRONTEND_LOG" 2>&1 < /dev/null &
  write_pid_file "$!" "$FRONTEND_PID_FILE"
  wait_for_http "$FRONTEND_URL" "Frontend static server" "$frontend_html"
}

print_status() {
  local tmp_file="$LOG_DIR/status_probe.json"

  print_mqtt_check

  if pid_file_running "$AGENT_PID_FILE"; then
    log "micro-ROS agent: running PID=$(cat "$AGENT_PID_FILE")"
  else
    log "micro-ROS agent: not running"
  fi

  if pid_file_running "$BRIDGE_PID_FILE"; then
    log "ROS 2 -> MQTT bridge: running PID=$(cat "$BRIDGE_PID_FILE")"
  else
    log "ROS 2 -> MQTT bridge: not running"
  fi

  if pid_file_running "$STATE_BRIDGE_PID_FILE"; then
    log "ROS 2 -> MQTT state bridge: running PID=$(cat "$STATE_BRIDGE_PID_FILE")"
  else
    log "ROS 2 -> MQTT state bridge: not running"
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

  print_ros_topic_check

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

print_urls() {
  log "micro-ROS + motor 联调链路已启动。"
  log "Frontend 页面：$FRONTEND_URL"
  log "Robot status API：$DASHBOARD_API_BASE_URL/api/robot/status"
  log "micro-ROS agent 日志：$AGENT_LOG"
  log "ROS 2 -> MQTT bridge 日志：$BRIDGE_LOG"
  log "ROS 2 -> MQTT state bridge 日志：$STATE_BRIDGE_LOG"
  log "ROS 2 -> MQTT motor status bridge 日志：$MOTOR_STATUS_BRIDGE_LOG"
  log "MQTT -> ROS 2 motor cmd bridge 日志：$MOTOR_CMD_BRIDGE_LOG"
  log "停止命令：./scripts/start_microros_sensor_stack.sh --stop"
}

main() {
  parse_args "$@"
  if [[ "$CHECK_ONLY" == true ]]; then
    run_check
    exit 0
  fi
  refresh_mqtt_host_port
  ensure_dirs
  require_command curl
  require_command python3
  ensure_start_paths
  start_micro_ros_agent_if_needed
  wait_for_imu_topic_if_needed
  start_mqtt_if_needed
  start_bridge_if_needed
  start_state_bridge_if_needed
  start_motor_status_bridge_if_needed
  start_motor_cmd_bridge_if_needed
  start_dashboard_backend_if_needed
  start_frontend_if_needed
  print_status
  print_urls
}

main "$@"
