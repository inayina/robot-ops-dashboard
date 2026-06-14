# Recording Rehearsal Checklist

## Goal

在 90 秒录屏前人工跑通 Robot Ops System 主链路，确认 Dashboard、AMR Mock WMS、Gazebo、RViz、micro-ROS、IMU、Motor / Encoder、MQTT 与 WebSocket 的真实联动状态。

本轮只做人工彩排和记录，不新增自动化脚本，不重构代码，不扩展功能。

## Current Scope

- Dashboard 是观察与监控层，以及 single N20 motor bench 的低频受限命令入口。
- AMR 链路通过 HTTP adapter 读取 / 创建 Mock WMS task，不直接从 Dashboard 控制 Nav2。
- Motor 展示口径是 `Wheel Speed / 轮端等效速度`，不是 `Robot Speed / 整车速度`。
- 当前硬件是 single N20 motor bench，不是完整双轮底盘，不声明 `ros2_control` 已完成。
- `POST /api/robot/motor/cmd` 只能用于保守 bench 命令和 Stop，不直接发 PWM，不绕过 Dashboard backend。

## Local Repository Paths

- Dashboard local path: `/home/ina/workspace/robot-ops-dashboard`
- AMR local path: `/home/ina/ros2_ws/src/amr_warehouse_sim`
- Digital Twin local path: `/home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1`

## Service Port Map

统一按这张表记，不要再混用 `8001` 和 `9000`：

| Service | Port | 用途 / 当前口径 |
| --- | ---: | --- |
| AMR Mock WMS API | `8000` | 上游任务 HTTP API，只有 `ROBOT_OPS_TASK_SOURCE=amr_http` 时才用 |
| Frontend static server | `8001` | 浏览器只打开这个地址：`http://127.0.0.1:8001/frontend/` |
| MQTT broker | `1883` | `robot/imu`、`robot/state`、`robot/motor/status`、`robot/motor/cmd` |
| micro-ROS Agent UDP | `8888` | ESP32-S3 -> ROS 2 的 UDP 入口 |
| Dashboard backend | `9000` | `/api/*` 与 `/ws/status`，frontend 默认也连这里 |

联调口令：

- `8001` 只是前端静态页。
- `9000` 才是 backend API / WebSocket。
- `1883` 是 MQTT broker。
- `8888` 是 micro-ROS Agent UDP，不是 HTTP。

## Manual Startup Order

### 1. 清理旧进程

命令：

```bash
ps -eo pid=,args= | rg "navigation.launch.py|simulation.launch.py|gz sim|rviz2|parameter_bridge|robot_state_publisher|odom_tf_node|nav2_amcl/amcl|nav2_planner/planner_server|nav2_controller/controller_server|nav2_bt_navigator/bt_navigator|mock_wms_api|uvicorn|http.server|micro_ros_agent|motor_status_bridge|motor_cmd_bridge|microros_imu_to_mqtt_bridge|mosquitto"
```

只停止确认属于本轮的旧进程，例如旧 Dashboard backend / frontend：

```bash
kill <dashboard_backend_pid> <frontend_pid>
```

预期输出：只看到本轮相关进程；系统级 mosquitto 可复用。  
成功判断：`8000/8001/9000/8888` 没有旧进程占用，`1883` broker 可用。  
失败时先看：端口占用、旧 `uvicorn` mode 是否仍是 `mock_json`、旧 frontend / backend 是否还占着 `9000`。

### 2. 启动 AMR Gazebo + Nav2 + RViz

命令：

```bash
cd /home/ina/ros2_ws
export HOME=/tmp/robot_ops_rehearsal_home
export ROS_LOG_DIR=/tmp/robot_ops_rehearsal_ros_logs
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch amr_warehouse_sim navigation.launch.py
```

设置 initial pose：

```bash
cd /home/ina/ros2_ws
export HOME=/tmp/robot_ops_rehearsal_home
export ROS_LOG_DIR=/tmp/robot_ops_rehearsal_ros_logs
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 run amr_warehouse_sim publish_initial_pose --preset start_zone --wait-for-subscribers 30
```

检查：

```bash
ros2 lifecycle get /map_server
ros2 lifecycle get /amcl
ros2 lifecycle get /planner_server
ros2 lifecycle get /controller_server
ros2 lifecycle get /bt_navigator
ros2 action info /navigate_to_pose
ros2 topic list -t | sort
timeout 4s ros2 run tf2_ros tf2_echo map odom
timeout 4s ros2 topic echo /odom --once
timeout 4s ros2 topic echo /scan_filtered --once
```

预期输出：5 个关键 lifecycle 节点为 `active [3]`，`/navigate_to_pose` 有 `Action servers: 1`，`/map`、`/odom`、`/scan`、`/scan_filtered`、`/tf` 可见。  
成功判断：RViz 可见 map / robot pose / goal / path，Gazebo 可见 AMR。  
失败时先看：是否已发布 initial pose、`map -> odom` TF、`/navigate_to_pose` server、Nav2 lifecycle 是否完整 active。

### 3. 启动 AMR Mock WMS API

命令：

```bash
cd /home/ina/ros2_ws/src/amr_warehouse_sim
rm -f /tmp/robot_ops_rehearsal_mock_wms.db
source .venv/bin/activate
python3 -m amr_warehouse_sim.mock_wms_api \
  --db /tmp/robot_ops_rehearsal_mock_wms.db \
  --task-points /home/ina/ros2_ws/src/amr_warehouse_sim/config/task_points.yaml \
  --host 127.0.0.1 \
  --port 8000 \
  --log-level info
```

检查：

```bash
curl --noproxy '*' http://127.0.0.1:8000/health
curl --noproxy '*' http://127.0.0.1:8000/tasks
```

预期输出：`/health` 返回 `status=ok`，空库时 `/tasks` 返回 `count=0`。  
成功判断：`8000` 可用，task list 可查。  
失败时先看：`.venv` 依赖、`MOCK_WMS_DB_PATH` / `--db`、`config/task_points.yaml`。

### 4. 启动 MQTT broker

本轮复用系统 mosquitto：

```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t '$SYS/broker/version' -C 1 -W 2
```

如果未运行：

```bash
mosquitto -p 1883
```

预期输出：`mosquitto version 2.0.18` 或 broker 启动日志。  
成功判断：`1883` 可订阅。  
失败时先看：mosquitto 是否安装、端口占用、防火墙或 broker 配置。

### 5. 启动 micro-ROS Agent

命令：

```bash
cd /home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1
export HOME=/tmp/robot_ops_rehearsal_home
export ROS_LOG_DIR=/tmp/robot_ops_rehearsal_ros_logs
source /opt/ros/jazzy/setup.bash
source /home/ina/microros_ws/install/setup.bash
ros2 run micro_ros_agent micro_ros_agent udp4 --port 8888 -v 4
```

预期输出：`running... | port: 8888`，ESP32 连接后出现 `session established`。  
成功判断：ESP32 在 `/dev/ttyACM0` 可见，Agent 看到 client session，ROS 2 topics 出现。  
失败时先看：ESP32 是否复位、WiFi / Agent IP、`AGENT_PORT=8888`、`ROS_DOMAIN_ID`。

### 6. 启动 IMU / robot state telemetry

ROS 2 topics 检查：

```bash
source /opt/ros/jazzy/setup.bash
source /home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1/install/setup.bash
ros2 topic list -t | sort | rg "(/imu/data|/imu/filtered|/robot/state)"
timeout 4s ros2 topic echo /imu/data --once
timeout 4s ros2 topic echo /imu/filtered --once
timeout 4s ros2 topic echo /robot/state --once
```

IMU MQTT bridge：

```bash
cd /home/ina/workspace/robot-ops-dashboard
export PYTHONPATH=/home/ina/workspace/robot-ops-dashboard/.venv/lib/python3.12/site-packages:${PYTHONPATH:-}
source /opt/ros/jazzy/setup.bash
source /home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1/install/setup.bash
python3 scripts/microros_imu_to_mqtt_bridge.py \
  --ros-topic /imu/data \
  --mqtt-broker mqtt://127.0.0.1:1883 \
  --mqtt-topic robot/imu \
  --robot-id amr-001 \
  --rate-limit-hz 5

python3 scripts/microros_imu_to_mqtt_bridge.py \
  --ros-topic /robot/state \
  --message-type std_msgs/msg/Int32 \
  --mqtt-broker mqtt://127.0.0.1:1883 \
  --mqtt-topic robot/state \
  --robot-id amr-001 \
  --rate-limit-hz 0
```

MQTT 检查：

```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/imu -C 1 -W 5
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/state -C 1 -W 3
```

预期输出：`robot/imu`、`robot/state` 都有 MQTT 数据。  
成功判断：`/imu/data`、`/imu/filtered`、`/robot/state` 有 ROS 2 数据，`robot/imu`、`robot/state` 有 MQTT 数据。  
当前口径：`robot/state` 通过本仓库 `scripts/microros_imu_to_mqtt_bridge.py --message-type std_msgs/msg/Int32` 镜像到 MQTT，不再依赖外部专用 state bridge。  
失败时先看：micro-ROS Agent、ESP32 topic、bridge 依赖 `paho-mqtt`、QoS。

### 7. 启动 motor telemetry / safe command 链路

推荐直接使用仓库脚本，它会统一拉起：

- `micro_ros_agent` on `8888`
- `robot/imu` bridge
- `robot/state` bridge
- `robot/motor/status` bridge
- `robot/motor/cmd` bridge
- Dashboard backend `9000`
- Frontend `8001`

命令：

```bash
cd /home/ina/workspace/robot-ops-dashboard
./scripts/start_microros_sensor_stack.sh
```

手动 fallback 才需要分别启动下面两个 motor bridge。

Motor status bridge：

```bash
cd /home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1/ros2/robot_mqtt_bridge
export PYTHONPATH=/home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1/ros2/robot_mqtt_bridge:/home/ina/workspace/robot-ops-dashboard/.venv/lib/python3.12/site-packages:${PYTHONPATH:-}
source /opt/ros/jazzy/setup.bash
python3 -m robot_mqtt_bridge.motor_status_bridge_node --ros-args \
  -p motor_status_topic:=/motor/status \
  -p mqtt_host:=127.0.0.1 \
  -p mqtt_port:=1883 \
  -p mqtt_topic:=robot/motor/status \
  -p robot_id:=amr-001
```

Motor cmd bridge：

```bash
python3 -m robot_mqtt_bridge.motor_cmd_bridge_node --ros-args \
  -p ros_cmd_topic:=/motor/cmd \
  -p mqtt_host:=127.0.0.1 \
  -p mqtt_port:=1883 \
  -p mqtt_topic:=robot/motor/cmd \
  -p robot_id:=amr-001 \
  -p max_abs_target_rpm:=80.0 \
  -p max_pwm_limit:=0.25
```

检查：

```bash
timeout 4s ros2 topic echo /motor/status --once
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/motor/status -C 1 -W 5
```

预期输出：`/motor/status` 和 `robot/motor/status` 有 JSON 状态。  
成功判断：Dashboard backend 后续可读到 `target_rpm`、`actual_rpm` / `measured_rpm`、`pwm`、`status`。  
失败时先看：ESP32 固件是否发布 `/motor/status`，`PYTHONPATH` 是否包含 `robot_mqtt_bridge` 源码目录，broker 是否可用。

### 8. 启动 Dashboard backend

当前标准联调端口固定使用 `9000`：

```bash
cd /home/ina/workspace/robot-ops-dashboard
source .venv/bin/activate
export PYTHONPATH=/home/ina/workspace/robot-ops-dashboard
export ROBOT_OPS_TASK_SOURCE=amr_http
export AMR_API_BASE_URL=http://127.0.0.1:8000
export MQTT_BROKER_URL=mqtt://127.0.0.1:1883
export MOTOR_CMD_MAX_ABS_RPM=80
export MOTOR_CMD_MAX_PWM_LIMIT=0.25
export MOTOR_CMD_DEFAULT_MAX_PWM=0.25
uvicorn backend.app.main:app --host 127.0.0.1 --port 9000
```

检查：

```bash
curl --noproxy '*' http://127.0.0.1:9000/health
curl --noproxy '*' http://127.0.0.1:9000/api/tasks
curl --noproxy '*' http://127.0.0.1:9000/api/robot/status
```

预期输出：`/health` 为 `ok`，`mode=amr_http`；`/api/tasks` source 为 `amr_http:http://127.0.0.1:8000`；`/api/robot/status` connection 为 `connected`。  
成功判断：backend 同时连上 AMR API 和 MQTT。  
失败时先看：`AMR_API_BASE_URL`、`MQTT_BROKER_URL`、端口 `9000`、backend `.venv`。

### 9. 启动 Dashboard frontend

命令：

```bash
cd /home/ina/workspace/robot-ops-dashboard
python3 -m http.server 8001 --bind 127.0.0.1
```

打开：

```text
http://127.0.0.1:8001/frontend/
```

预期输出：静态页 `200 OK`。  
成功判断：页面可加载。  
当前标准：frontend 默认就是 `API_BASE_URL=http://127.0.0.1:9000`，联调尽量不要改 backend 端口。  
失败时先看：`8001` 是否被旧 http.server 占用，浏览器 console 是否报 `127.0.0.1:9000` 连接失败。

## Manual Verification Commands

### Dashboard

```bash
curl --noproxy '*' http://127.0.0.1:9000/health
curl --noproxy '*' http://127.0.0.1:9000/api/tasks
curl --noproxy '*' http://127.0.0.1:9000/api/wms/tasks
curl --noproxy '*' http://127.0.0.1:9000/api/robot/status
curl --noproxy '*' -X POST http://127.0.0.1:9000/api/robot/motor/cmd \
  -H 'Content-Type: application/json' \
  -d '{"target_speed_mps":0.03,"direction":"forward","enabled":true,"closed_loop":true,"max_pwm":0.12,"timeout_ms":500,"stop":false}'
curl --noproxy '*' -X POST http://127.0.0.1:9000/api/robot/motor/cmd \
  -H 'Content-Type: application/json' \
  -d '{"direction":"stop","enabled":false,"closed_loop":true,"max_pwm":0.0,"timeout_ms":500,"stop":true}'
```

WebSocket 快速检查：

```bash
cd /home/ina/workspace/robot-ops-dashboard
source .venv/bin/activate
python -c 'import asyncio,json,websockets; code = """async def main():
    async with websockets.connect(\"ws://127.0.0.1:9000/ws/status\") as ws:
        msg = await asyncio.wait_for(ws.recv(), timeout=5)
        data = json.loads(msg)
        print(data.get(\"type\"), len(data.get(\"tasks\", [])), bool(data.get(\"imu\")), bool(data.get(\"motor\")))
"""; exec(code); asyncio.run(main())'
```

### AMR

```bash
curl --noproxy '*' http://127.0.0.1:8000/health
curl --noproxy '*' -X POST http://127.0.0.1:8000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"target_name":"station_a","task_name":"manual-http-task-station-a"}'
curl --noproxy '*' http://127.0.0.1:8000/tasks
curl --noproxy '*' http://127.0.0.1:8000/tasks/1
ros2 run amr_warehouse_sim mock_wms_executor \
  --api-base-url http://127.0.0.1:8000 \
  --execute \
  --ready-timeout 60 \
  --navigation-timeout 180
```

SQLite queue runner 可选：

```bash
ros2 run amr_warehouse_sim init_mock_wms_db --db /tmp/robot_ops_rehearsal_mock_wms.db
ros2 run amr_warehouse_sim create_mock_task --db /tmp/robot_ops_rehearsal_mock_wms.db --target station_a --task-name demo-station-a
ros2 run amr_warehouse_sim list_mock_tasks --db /tmp/robot_ops_rehearsal_mock_wms.db
ros2 run amr_warehouse_sim mock_wms_task_runner --db /tmp/robot_ops_rehearsal_mock_wms.db --execute --max-tasks 1 --ready-timeout 60
```

### ROS 2

```bash
ros2 topic list
timeout 4s ros2 topic echo /odom --once
timeout 4s ros2 topic echo /scan --once
timeout 4s ros2 topic echo /scan_filtered --once
timeout 4s ros2 topic echo /imu/data --once
timeout 4s ros2 topic echo /imu/filtered --once
timeout 4s ros2 topic echo /robot/state --once
timeout 4s ros2 topic echo /motor/status --once
timeout 20s ros2 topic echo --once /motor/cmd
ros2 action list | grep navigate
ros2 action info /navigate_to_pose
ros2 lifecycle get /map_server
ros2 lifecycle get /amcl
ros2 lifecycle get /planner_server
ros2 lifecycle get /controller_server
ros2 lifecycle get /bt_navigator
timeout 4s ros2 run tf2_ros tf2_echo map odom
```

### MQTT

```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/imu -C 1 -W 5
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/state -C 1 -W 3
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/motor/status -C 1 -W 5
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/motor/cmd -C 1 -W 20
```

当前 `robot/state` MQTT 可由本仓库 bridge 脚本直接镜像；如果这里超时，优先检查 `/robot/state` ROS 2 topic、bridge 进程和 broker。

## Full-chain Rehearsal Result

日期：`2026-05-22`

通过项：

- Dashboard local path 自动确认为 `/home/ina/workspace/robot-ops-dashboard`。
- AMR Gazebo + Nav2 + RViz 启动成功。
- `publish_initial_pose --preset start_zone` 成功发布 10 次 initial pose。
- `/map_server`、`/amcl`、`/planner_server`、`/controller_server`、`/bt_navigator` 均为 `active [3]`。
- `/navigate_to_pose` 有 `Action servers: 1`，server 为 `/bt_navigator`。
- `/map`、`/odom`、`/scan`、`/scan_filtered`、`/tf` 可见，`map -> odom` TF 可用。
- AMR Mock WMS API `8000` 启动成功，`/health` 和 `/tasks` 可用。
- `./scripts/start_microros_sensor_stack.sh` 成功拉起 micro-ROS agent、IMU/state bridge、motor status bridge、motor cmd bridge、Dashboard backend 和 frontend。
- Dashboard backend `9000` 启动成功，`/health` 为 `ok`，mode 为 `amr_http`。
- Dashboard backend `/api/tasks` 成功读取 AMR API，source 为 `amr_http:http://127.0.0.1:8000`。
- 通过 `POST /api/wms/tasks` 创建 task `1`，目标 `station_a`，状态 `pending`。
- AMR HTTP executor 成功消费 task `1`，结果：`outcome=succeeded`，`NavigateToPose result: SUCCEEDED`。
- AMR API `/tasks/1` 回写为 `status=succeeded`。
- Dashboard `/api/tasks` 映射为 `status=completed`，`progress=100`。
- micro-ROS Agent `8888` 启动成功，ESP32 session established。
- ROS 2 `/imu/data`、`/imu/filtered`、`/robot/state`、`/motor/status` 可读。
- `robot/imu` MQTT 有数据，Dashboard `/api/robot/status` 可读到 IMU。
- `robot/state` MQTT 有数据，Dashboard `/api/robot/status` 可读到 robot state。
- `robot/motor/status` MQTT 有数据，Dashboard `/api/robot/status` 可读到 motor status。
- `POST /api/robot/motor/cmd` 最终录屏推荐命令：`target_speed_mps=0.08`，换算 `target_rpm≈23.50`，低于 `80 rpm` bench limit；短时运行后 STOP。
- `robot/motor/cmd` MQTT 收到 backend payload，ROS 2 `/motor/cmd` 收到桥接后的 String。
- 更新后的 ESP32 bench 固件支持运行时 arm/disarm：`enabled=true` 且 `stop=false` 会把 `motor_state.hardware_outputs_enabled` 切到 `1`，`stop=true` 或 `enabled=false` 会切回 `0`。
- 更新后的 ESP32 bench 固件已经把普通 `/motor/cmd` 路径接到真实 encoder feedback：`actual_rpm` / `measured_rpm` 来自单 N20 bench 编码器滤波值；当前 `20 rpm` 量级可接近目标，`40/60/80 rpm` 仍是保守 tune，可能有明显稳态误差。
- Stop 命令通过 Dashboard backend 发布成功：`target_rpm=0.0`、`target_speed_mps=0.0`、`direction=stop`、`enabled=false`、`stop=true`。
- `/ws/status` 可用，测试输出：`dashboard_status 1 True True`。

未通过 / 需确认项：

- 即使 `robot/motor/status` 已显示 `source=motor_cmd`、`target_rpm>0` 且 `hardware_outputs_enabled=1`，实际 N20 是否转动、encoder RPM 是否变化仍需要人工看 bench 硬件确认。
- RViz 日志出现一次 GLSL sampler warning，但 RViz 进程继续运行，未阻塞 Nav2 成功。

## Dashboard Observation Checklist

- System Health：backend `9000` 正常，MQTT connection 为 `connected`。
- AMR Task Status：`station_a` task 从 `pending` 到 `completed`，progress `100`。
- IMU Status：`robot/imu` 刷新，显示 accel / gyro / orientation。
- Motor / Encoder：显示 Wheel Speed / 轮端等效速度、Target RPM、Actual RPM / measured RPM、PWM、Status。
- Event Stream：能看到 frontend loaded、backend status、task / IMU / motor 更新。
- 当前页面注意：除非明确做运行时覆盖，否则坚持 frontend `8001` + backend `9000` 这一组默认端口。

## 90s Recording Storyboard

### 0-8s Dashboard Overview

- System Health
- AMR Task Status
- IMU Status
- Motor / Encoder
- Event Stream

### 8-18s Create AMR Task

- 通过 Dashboard 或 curl 创建 Mock WMS task。
- 展示 task 状态 `pending` / `running`。
- Event Stream 有事件。

### 18-38s Gazebo AMR Motion

- 展示仓库场景和 AMR 移动。
- 机器人保持在画面中央。

### 38-55s RViz Nav2 Visualization

- Map
- Robot pose
- Goal
- Path
- Costmap 只在画面不乱时打开。

### 55-68s Dashboard Task Status Writeback

- 回到 Dashboard。
- task status 更新为 completed / succeeded 映射。
- Event Stream 更新。
- last update timestamp 刷新。

### 68-82s Motor / Encoder Telemetry

- Wheel Speed
- Target RPM
- Actual RPM
- PWM
- Status
- 明确口径：single N20 motor bench。

### 82-90s IMU / Robot State + Closing Overview

- IMU / robot state 刷新。
- 最后停在 Dashboard 总览页。

## Window Layout Recommendation

- 左上：Dashboard frontend。
- 左下：Dashboard backend / AMR API / executor 终端。
- 右上：Gazebo，机器人居中。
- 右下：RViz，显示 map、robot pose、goal、path。
- 录 Motor / Encoder 时切到 Dashboard 卡片和 N20 bench 近景，不把它说成整车速度。

## Motor / Hardware Safety Checklist

- 确认 ESP32 在 `/dev/ttyACM0`。
- 确认当前固件 `kEnableN20ClosedLoopBench=false`。
- 确认 `kEnableMotorHardwareOutputs=false`，除非明确进入人工 bench 硬件演示。
- 命令只通过 `POST /api/robot/motor/cmd`。
- 不直接发布 PWM。
- 本轮录屏命令建议：`target_speed_mps=0.08`、`timeout_ms=2500`，录到曲线后立即 STOP。
- Stop 必须先验证可用：`stop=true`、`enabled=false`、`target_rpm=0`、`target_speed_mps=0`。
- 录屏口径只写 Wheel Speed / 轮端等效速度。

## Known Risks

- 如果临时把 backend 改到非 `9000`，frontend 默认仍会连 `http://127.0.0.1:9000`，页面会直接显示 disconnected。
- 如果 `robot/state` bridge 没启动，Dashboard 的 `robot.state` 会是 `null`，Sensor Status LEDs 会显示 `No Data`。
- Nav2 fresh session 可能有 lifecycle / action server 短暂波动，先等 5-10 秒并重发 initial pose。
- `station_a` 本轮成功，但不同 session 中 station / shelf candidate 坐标仍可能有耗时和 recoveries 波动。
- Motor status 目前可能显示 `stale`，需要人工确认 ESP32 当前固件与 bench 运行模式。

## What to Automate Later

- `demo_recording_flow.sh` 可以自动做端口检查、相关进程清理、AMR API health、Dashboard backend health、MQTT topic smoke。
- 可自动创建一条 Mock WMS task 并启动 HTTP executor。
- 可自动输出 `/api/tasks`、`/api/robot/status`、`/ws/status` 快照。
- 可自动检查 `robot/imu`、`robot/state`、`robot/motor/status` 是否有 MQTT 数据。
- 可自动检查 backend 是否偏离默认 `9000`，并提示 frontend 端口口径。

## What Should Remain Manual

- Gazebo / RViz 画面构图。
- 浏览器页面打开和录屏切镜头。
- N20 bench 物理安全确认。
- 是否按下 Stop、是否观察电机实际停止。
- 是否展示 costmap，避免画面过乱。
- 是否口播当前不是完整底盘、不是生产级 WMS、不是 ros2_control。

## Open Questions Before Recording

- Motor bench 录屏是否要启用真实硬件输出，还是只展示安全命令与状态链路？
- 90 秒版本使用单条 `station_a`，还是 `station_a -> station_b` 双任务队列？
