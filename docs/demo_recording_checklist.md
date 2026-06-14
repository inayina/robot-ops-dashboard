# Demo 录屏与截图检查清单

本文用于正式录屏前人工彩排。目标是把 `robot-ops-dashboard` 录成“可截图、可讲述、边界清楚”的作品集 demo：AMR/WMS task、IMU/Motor 状态链路、Simulation Preview 和 System Evaluation & Validation Layer 都能被看见。

## 1. 安全确认

开始任何真实硬件画面前，先人工确认：

- 不刷写 STM32 / ESP32-S3。
- 不修改 PlatformIO 配置。
- 电机已悬空或可靠固定。
- 供电电压、电流限制和接线极性已确认。
- STOP 命令或断电方式随时可用。
- 本次只展示 N20 单电机 bench，不宣称整车运动。
- Dashboard motor command 只走 `POST /api/robot/motor/cmd`，且不长时间运行电机。

## 2. 推荐启动顺序

本次最终验证使用 AMR Mock WMS `:8010`。如果你的本机 AMR API 使用默认 `:8000`，把下面环境变量改回 `http://127.0.0.1:8000`。

1. AMR Mock WMS API。
2. MQTT broker。
3. 可选 micro-ROS Agent 和 ROS 2 -> MQTT bridge。
4. Dashboard backend：

```bash
ROBOT_OPS_TASK_SOURCE=amr_http \
AMR_API_BASE_URL=http://127.0.0.1:8010 \
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 9000
```

5. Dashboard frontend：

```bash
.venv/bin/python -m http.server 8001 --bind 127.0.0.1
```

6. 打开：

```text
http://127.0.0.1:8001/frontend/
```

7. 验证：

```bash
./scripts/verify_demo_readiness.sh
```

期望结果：`Readiness result: PASS`。可选写接口默认跳过；录屏前如需验证 Task Dispatch，可只手动 POST `/api/wms/tasks`，不要自动跑 motor command。

## 3. 必测接口

| 接口 | 录屏前要求 |
| --- | --- |
| `GET /health` | HTTP 200, `status=ok` |
| `GET /api/tasks` | HTTP 200，展示 AMR 或 mock task source |
| `GET /api/robot/status` | HTTP 200，IMU/Motor 有数据或明确 no data / disconnected |
| `GET /api/sim/preview` | HTTP 200，实时 stream 或 Offline / Mock |
| `GET /api/evaluation/summary` | 包含 `run_id`、`dataset_version`、`model_version`、`task_success_rate`、`failure_cases`、`quality_checks`、`gpu_usage` |
| `WebSocket /ws/status` | 返回 `dashboard_status` |
| `GET /api/wms/tasks` | AMR Mock WMS 可用时通过 |
| `POST /api/wms/tasks` | 手动验证一次 Task Dispatch 即可 |
| `POST /api/robot/motor/cmd` | 仅真实 bench 安全确认后手动验证 |

## 4. Dashboard 首屏检查

首屏应稳定显示：

- 顶部 Backend / Stream / ROS 2 / micro-ROS / MQTT 状态。
- 左侧 Robot Link 和 Event Log。
- 中间 IMU 姿态展示。
- 中间数据流：单向遥测、任务 HTTP、Motor Bench。
- 中间 Motor Bench Flow。
- 右侧 Current Task Execution。
- 右侧 Task Dispatch。
- 右侧 Simulation Preview，未接入实时流时必须显示 Offline / Mock Preview。

## 5. System Evaluation & Validation 检查

第二屏应稳定显示：

- `System Evaluation & Validation Layer`。
- `Data Sources -> Evaluation Run -> Quality Checks -> ML-ready Export`。
- `run_id`。
- `dataset_version`。
- `model_version`。
- `task_success_rate`。
- `failure_cases`。
- `quality_checks`。
- Compute / GPU：未接入时显示 `not_connected`、`--`、`reserved`。
- Current Scope：baseline / mock / reserved，不宣称真实训练。

## 6. 截图顺序

建议保存到 `artifacts/screenshots/`：

1. `dashboard-overview-1440x900.png`：Dashboard 总览。
2. `dashboard-task-dispatch-1440x900.png`：Task Dispatch + Current Task Execution。
3. `dashboard-robot-status-1440x900.png`：Robot Link + IMU + Motor。
4. `dashboard-motor-curve-1440x900.png`：Motor Bench Flow，`0.08 m/s` 短时阶跃与 STOP 前曲线。
5. `dashboard-sim-preview-1440x900.png`：Gazebo/RViz Preview，小窗可为 Offline / Mock。
6. `dashboard-evaluation-platform-1440x900.png`：System Evaluation & Validation Layer。
7. `api-health-and-summary-terminal.png`：readiness 或 curl 输出。
8. 可选 `amr-gazebo-rviz-task-result.png`：外部 Gazebo/RViz 画面。

## 7. 60 秒录屏分镜

0-8s：Dashboard 总览
展示 cockpit 首屏。旁白：这是机器人数据链路与评测 Dashboard，汇总 AMR task、硬件遥测、motor bench 和 baseline evaluation。

8-20s：Task Dispatch
展示 `Task Dispatch`，手动发一个 `start_zone -> station_a` 任务。旁白：Dashboard 通过 HTTP adapter 进入 AMR Mock WMS；Nav2/Gazebo 执行属于上游 AMR 仓库。

20-32s：Robot Status / IMU
展示 Robot Link、IMU 姿态、MQTT/WebSocket 状态。旁白：IMU/robot state 是只读镜像；本次录屏已收到 live telemetry，断链时会显示 no data / disconnected。

32-42s：Simulation Preview
展示 Simulation Preview。旁白：这是 Dashboard 内嵌的 RViz Path View / Gazebo preview；没有实时 MJPEG 时显示 Offline / Mock，不是真实相机流，也不是 Playwright 录到的桌面原生窗口。

42-52s：Motor Bench
展示 Motor Bench Flow 和 STOP 入口。旁白：这里只是 N20 单电机 bench 的低频受限命令链路，不是完整底盘控制器。

52-60s：System Evaluation & Validation
滚到 Evaluation 第二屏。旁白：这里展示 baseline/mock evaluation、failure cases、quality checks 和 GPU reserved 状态，不宣称真实 VLA/RL/world model 训练结果。

## 8. 录屏中禁止宣称

- 不宣称 Dashboard 直接控制 Nav2。
- 不宣称 motor bench 是完整双轮底盘或真实差速小车。
- 不宣称已有真实 VLA / RL / world model 训练结果。
- 不把 mock success rate 当作公开 benchmark。
- 不宣称已实现完整商业 WMS、多机器人调度或完整 AI 训练平台。
- 不把 Simulation Preview 说成真实相机流。

## 9. 录屏后检查

- 视频中没有隐私路径、token、Wi-Fi 密码或设备序列信息。
- Mock / Offline / Reserved 标签没有被裁掉。
- Evaluation 口径是 baseline / mock / reserved。
- Motor 口径是 N20 single-motor closed-loop bench。
- 页面没有白屏，网络失败时显示 disconnected / no data。
- 观众能看懂三条链路：AMR task、IMU/Motor telemetry、System Evaluation & Validation layer。
