# Full Pipeline Validation Report

本文记录 `robot-ops-dashboard` 最终 demo readiness 与可选硬件/交互链路联调结果。结论按实际证据填写：已通过的接口、已生成的截图/录屏可以直接用于作品集；IMU、robot state 与 motor status 已进入 Dashboard，最终浏览器录屏包含 Dashboard 内嵌 RViz Path View，Evaluation/GPU 仍按 baseline / mock / reserved 标注。

## 本次验证结论

| Item | Value |
| --- | --- |
| Date | 2026-06-14 Asia/Shanghai |
| Scenario | Final dashboard demo capture with optional WMS + motor bench interactions |
| Result | PASS for dashboard demo, optional WMS POST, motor bench command/status, live IMU telemetry, screenshots and video |
| Readiness command | `VERIFY_OPTIONAL_WRITE_ENDPOINTS=true ./scripts/verify_demo_readiness.sh` |
| Readiness result | `PASS=30 WARN=0 FAIL=0` |
| Backend tests | `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest backend/tests` -> `42 passed` |
| Screenshot output | `artifacts/screenshots/` |
| Video output | `artifacts/videos/dashboard-demo-walkthrough.webm` |

## 当前启动状态

| 服务 | 地址 / 状态 | 本次结果 |
| --- | --- | --- |
| Dashboard backend | `http://127.0.0.1:9000` | PASS |
| Dashboard frontend | `http://127.0.0.1:8001/frontend/` | PASS |
| AMR Mock WMS API | `http://127.0.0.1:8010` | PASS |
| MQTT broker | `mqtt://127.0.0.1:1883` | PASS |
| micro-ROS Agent | UDP `8888` process present | process present |
| ROS 2 graph | `/stm32_bridge`, `/robot_motor_cmd_bridge`, `/robot_motor_status_bridge` present | present |
| Live robot telemetry | `robot/state`, `robot/imu`, `robot/motor/status` | PASS |
| WebSocket | `ws://127.0.0.1:9000/ws/status` | PASS |
| Simulation Preview | `GET /api/sim/preview` | PASS, final recording shows embedded `RViz Path View` |
| Evaluation Summary | `GET /api/evaluation/summary` | PASS, baseline / mock / reserved |

## 环境变量

本次 backend 使用：

```bash
ROBOT_OPS_TASK_SOURCE=amr_http
AMR_API_BASE_URL=http://127.0.0.1:8010
MQTT_BROKER_URL=mqtt://127.0.0.1:1883
DASHBOARD_API_BASE_URL=http://127.0.0.1:9000
FRONTEND_URL=http://127.0.0.1:8001/frontend/
```

正式截图/录屏时配置了 Dashboard 内嵌 RViz Path View 预览流：

```bash
SIM_PREVIEW_MJPEG_URL=http://127.0.0.1:8090/stream
GAZEBO_CAMERA_LABEL=RViz Path View
GAZEBO_CAMERA_SOURCE=local_rviz_mjpeg
```

## 必测接口结果

| API | Expected | Result |
| --- | --- | --- |
| `GET /health` | HTTP 200, `status=ok` | PASS |
| `GET /api/tasks` | HTTP 200, AMR HTTP source | PASS |
| `GET /api/robot/status` | HTTP 200, MQTT connection/status object | PASS |
| `GET /api/sim/preview` | HTTP 200, connected or disconnected state | PASS |
| `GET /api/evaluation/summary` | `run_id`, `dataset_version`, `model_version`, `task_success_rate`, `failure_cases`, `quality_checks`, `gpu_usage` | PASS |
| `WebSocket /ws/status` | `dashboard_status` with tasks and robot object | PASS |
| `GET /api/wms/tasks` | AMR Mock WMS proxy available | PASS |
| `POST /api/wms/tasks` | Create Mock WMS task through Dashboard proxy | PASS, HTTP 201 |
| `POST /api/robot/motor/cmd` | STOP-only optional command check | PASS, HTTP 200 |

## Task Dispatch 验证

已通过 Dashboard backend proxy 创建任务：

- `id=7`
- `task_name=dashboard_transport_start_zone_to_station_b_20260613T172540Z`
- `target_name=station_b`
- `status=pending`

后续截图/录屏和 readiness optional write 过程中又创建了 AMR Mock WMS demo task，当前 `GET /api/tasks` 返回 `source=amr_http:http://127.0.0.1:8010`，任务总数已增长到 11 条以上。录屏中 Task Dispatch / Event Log / Current Task Execution 有可见变化。

## Motor Bench 验证

### 发现并修复的问题

实机联调时发现 `POST /api/robot/motor/cmd` 返回 200，但 `robot/motor/cmd` 没有稳定进入 broker/ROS 下游。已修复：

- `backend/app/services/mqtt_motor_command.py` 增加 `mosquitto_pub` CLI fallback。
- paho fallback 继续保留，并补上 `loop_start()` / `loop_stop()`。
- `backend/tests/test_motor_command_api.py` 增加 publisher fallback 与 paho loop 测试。

### 已执行命令

安全顺序：

1. STOP command。
2. 录屏探针：`target_speed_mps=0.08`，折算 `target_rpm≈23.50`，低于 `80 rpm` bench limit，`timeout_ms=2500`，随后 STOP。
3. STOP command。
4. 截图/录屏结束后再次 STOP。
5. readiness optional write 再执行一次 STOP-only motor check。

### 证据

- Dashboard API `POST /api/robot/motor/cmd` 返回 HTTP 200。
- ROS `/motor/cmd` 已收到 Dashboard STOP payload，证明 Dashboard -> MQTT -> ROS 下行链路可达。
- `VERIFY_OPTIONAL_WRITE_ENDPOINTS=true ./scripts/verify_demo_readiness.sh` 中 `POST /api/robot/motor/cmd stop command HTTP=200`。

### 硬件上行结果

用户轻轻移动 IMU/主控板后，Dashboard 已收到 motor status 上行：

- `GET /api/robot/status` 中 `robot/motor/status` 非空。
- `robot/motor/status.status=stale`，这是安全停止后的状态。
- `target_rpm=0.0`，`actual_rpm=0.0`，`pwm=0.0`，`fault=false`。
- `last_seen_at=2026-06-14T03:01:14Z` 左右。

录屏口径：motor command 下行已验证，motor status 上行已进入 Dashboard；当前电机处于停止 / stale / timeout 安全状态，不宣称持续运行或整车运动。

## IMU / Robot State 验证

ROS graph 显示：

- `/stm32_bridge` 存在。
- `/imu/data`、`/imu/filtered`、`/robot/state` topic 存在。
- `/imu/data` publisher QoS 为 `BEST_EFFORT`。

用户移动硬件后，已收到 live telemetry：

- ROS `/imu/filtered` 读到 `sensor_msgs/msg/Imu`，包含 quaternion、angular velocity 和 linear acceleration。
- MQTT `robot/imu` 收到 payload。
- Dashboard `GET /api/robot/status` 中 `robot.imu` 非空，`state=online`。
- Dashboard `GET /api/robot/status` 中 `robot.state.state_label=normal`。
- Dashboard 总览截图中 IMU 显示 `Online`，Robot Link 显示 `Healthy`。

录屏口径：IMU / robot state 只读上行链路已验证；不提供隐藏控制能力。

## Simulation Preview 验证

最终录屏抽帧确认：

- Dashboard 右下角 `Simulation Preview` 为 `CONNECTED`。
- `source=local_rviz_mjpeg`。
- `label=RViz Path View`。
- 画面中可见嵌入式 RViz 路径视图。

录屏口径：当前视频是 Playwright 浏览器录屏，包含 Dashboard 内嵌 RViz Path View；它不捕获桌面上单独打开的原生 RViz / Gazebo 窗口。没有实时 MJPEG 时，页面会回退为 Offline / Mock Preview。

## Evaluation Summary 验证

`GET /api/evaluation/summary` 当前展示：

- `run_id=eval_run_20260613_baseline_nav2_001`
- `dataset_version=robot_ops_dataset_mock_wms_mqtt_v0.1`
- `model_version=baseline_nav2_no_learning`
- `task_success_rate=0.667`
- `failure_cases[0]=failure_mock_station_b_blocked_001`
- `quality_checks.no_real_training_claim=true`
- `gpu_usage=N/A - reserved for future training or evaluation runners`

录屏口径：这是 baseline/mock evaluation summary，不是真实 VLA / RL / world model 训练结果。

## Artifacts

截图：

- `artifacts/screenshots/dashboard-overview-1440x900.png`
- `artifacts/screenshots/dashboard-task-dispatch-1440x900.png`
- `artifacts/screenshots/dashboard-recording-frame-1366x768.png`
- `artifacts/screenshots/dashboard-motor-curve-1440x900.png`
- `artifacts/screenshots/dashboard-evaluation-platform-1440x900.png`
- `artifacts/screenshots/dashboard-failure-cases-crop.png`

录屏：

- `artifacts/videos/dashboard-demo-walkthrough.webm`

截图和录屏已在 live IMU/Motor telemetry 出现后重新生成。录屏命令：

```bash
node scripts/capture_dashboard_artifacts.js --video --dispatch --motor-demo --record-ms 75000
```

为兼顾曲线可见性与台架安全，`--motor-demo` 使用 `0.08 m/s`，点击 `SEND CMD` 后保留短时阶跃并主动点击 `STOP`。最终 `dashboard-demo-walkthrough.webm` 为 1440x900，约 112 秒。

## 真实联调与 Mock/Fallback/Reserved

| 类别 | 状态 | 说明 |
| --- | --- | --- |
| Dashboard backend / frontend | 真实运行 | FastAPI + static HTML/CSS/JS |
| AMR HTTP adapter | 真实联调 | backend 指向本机 AMR Mock WMS API `:8010` |
| WebSocket `/ws/status` | 真实运行 | 推送 tasks/robot 快照 |
| MQTT broker | 真实连接 | broker 可用 |
| Task Dispatch POST | 真实 HTTP 写入 Mock WMS | 已创建 task |
| Motor command downlink | 真实联调 | Dashboard -> MQTT -> ROS `/motor/cmd` 已验证 |
| Motor status uplink | 真实联调 | Dashboard 已收到 `robot/motor/status`，当前安全停止 / stale |
| IMU / robot state uplink | 真实联调 | Dashboard 已收到 `robot/imu` 与 `robot/state` |
| Simulation Preview | 真实页面嵌入预览 | 最终浏览器录屏包含 Dashboard 内嵌 `RViz Path View`；不包含桌面原生 RViz / Gazebo 窗口 |
| Evaluation | baseline / mock / reserved | 只读 JSON，不宣称真实训练 |
| GPU | reserved | 未接入，显示 N/A / not_connected |

## 当前限制

- Dashboard backend 不直接依赖 ROS 2、Nav2 或 Gazebo。
- Dashboard 不控制 Nav2，不做底盘高频闭环。
- Motor 只允许 N20 single-motor closed-loop bench 口径。
- Motor command 下行已验证；motor status 上行已进入 Dashboard。当前状态是安全停止 / stale，不宣称长时间运行。
- IMU / robot state 上行已验证，数据为只读 telemetry。
- 当前 GPU 未接入，compute/GPU 只能显示 `not_connected` / `N/A` / `reserved`。
- 当前 Playwright 录屏包含 Dashboard 内嵌 RViz Path View；如未接入实时 MJPEG，页面会显示 Offline / Mock。
- 当前 Evaluation 是 baseline / mock / reserved，不是真实训练结果。

## 最终结论

Dashboard demo、Task Dispatch、System Evaluation & Validation Layer、Dashboard 内嵌 RViz Path View、受限 motor command 下行、IMU / robot state / motor status 上行、截图和约 112 秒录屏都已完成并有 artifacts。视频是浏览器录屏，不包含桌面原生 RViz / Gazebo 窗口；Evaluation 与 GPU 仍是 baseline / mock / reserved。
