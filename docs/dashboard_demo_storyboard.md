# Dashboard Demo Storyboard

本文用于指导最终 60-90 秒作品集录屏。目标是清楚展示 `robot-ops-dashboard` 作为机器人数据链路、运维监控和 system validation 展示入口，而不是 Nav2 控制台、完整机器人控制器或 ML benchmark。

## 录屏前准备

1. 启动 AMR Mock WMS API。
2. 启动 MQTT broker。
3. 启动 Dashboard backend：

```bash
ROBOT_OPS_TASK_SOURCE=amr_http \
AMR_API_BASE_URL=http://127.0.0.1:8010 \
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 9000
```

4. 启动 frontend：

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 8001
```

5. 打开 `http://127.0.0.1:8001/frontend/`。
6. 运行 `./scripts/verify_demo_readiness.sh`，确认 `FAIL=0`。
7. 如要展示实时 Gazebo/RViz preview，先配置 `SIM_PREVIEW_MJPEG_URL`；否则保留 Offline / Mock Preview。

## 推荐画面比例

- 首选：`1440x900`
- 备选：`1366x768`

浏览器只保留 Dashboard 页面，不展示 IDE、token、Wi-Fi 信息或隐私路径。

## 60-90 秒录屏顺序

### 0-8 秒：总览

画面：Dashboard 首屏，停留 2-3 秒让观众看清布局。

必须露出：

- Backend / Stream / ROS 2 / micro-ROS / MQTT 状态。
- Robot Link。
- IMU 姿态展示。
- 三条数据流：单向遥测、任务 HTTP、Motor Bench。
- Current Task Execution。
- Task Dispatch。
- Simulation Preview。

旁白：

> 这是一个机器人数据链路与评测 Dashboard，用于把 AMR 任务、IMU/Motor 遥测、Simulation Preview 和 baseline evaluation 汇总到一个运维驾驶舱里。

### 8-20 秒：Task Dispatch

操作：

1. 在 `Task Dispatch` 选择 `pickup=start_zone`。
2. 选择 `dropoff=station_a`。
3. 点击 `DISPATCH`。
4. 观察 Current Task Execution 或 Event Log / task count 变化。

旁白：

> 任务通过 Dashboard backend 的 HTTP adapter 进入 AMR Mock WMS。Dashboard 不直接控制 Nav2，Nav2/Gazebo 执行属于上游 AMR 仓库。

### 20-32 秒：Robot Status / IMU

画面：聚焦 Robot Link 和 IMU 姿态卡。

必须露出：

- MQTT / WebSocket 状态。
- IMU Roll / Pitch / Yaw。
- accel / gyro。
- no data / stale / offline 状态，如果没有 live payload。

旁白：

> IMU 和 robot state 通过 micro-ROS / ROS 2 / MQTT 镜像到 Dashboard，这里只读展示，不做隐藏控制。

### 32-42 秒：Simulation Preview

画面：右侧 Simulation Preview 小窗。

两种口径：

- 有 MJPEG：展示 Gazebo/RViz path preview。
- 无 MJPEG：展示 Offline / Mock Preview。

旁白：

> 这里是 Gazebo 或 RViz preview，不是真实相机流。没有实时流时，页面明确显示 Offline / Mock。

### 42-52 秒：Motor Bench

画面：Motor Bench Flow 和 STOP 区域。

如没有安全硬件条件，只展示状态，不点击 SEND CMD。

旁白：

> 这里是 N20 单电机 bench 的低频受限命令链路，命令必须走 `POST /api/robot/motor/cmd`，不是完整底盘闭环。

### 52-70 秒：System Evaluation & Validation Layer

操作：滚动到第二屏。

必须露出：

- `run_id`
- `dataset_version`
- `baseline_version`
- `control_policy`
- `task_success_rate`
- `failure_cases`
- `validation_metrics`
- `Data Sources -> Validation Run -> API / Telemetry Checks -> Safety Boundary Evidence`

旁白：

> 这一层是系统验收摘要，不是 ML benchmark。它把 AMR 任务闭环、Dashboard API、WebSocket、MQTT 遥测和 Motor bench 状态放到同一个 baseline/mock validation record 中。

### 70-90 秒：证据链与安全边界

画面：停留在三张 evaluation 卡片，先扫过 `System Validation Summary`，再看 `Task Execution Metrics` 和 `Telemetry & Motor Bench Metrics`。

必须露出：

- `amr_e2e_status`
- `dashboard_api_status`
- `websocket_status`
- `mqtt_telemetry_status`
- `motor_bench_status`
- `no_real_training_claim=true`
- `evidence_links`
- Current Scope 中 baseline / mock / reserved 与 no real VLA / RL / world model training 说明

旁白：

> 这里的证据链接对应 AMR acceptance checklist、Mock WMS HTTP executor E2E 报告、Dashboard API 测试和 real hardware chain 检查脚本。Motor bench 仍是低频受限显式接口，reserved 字段不会被包装成真实训练或真实机器人结果。

## 截图顺序

1. Dashboard overview。
2. Task Dispatch + Current Task Execution。
3. Robot Link + IMU。
4. Motor Bench Flow。
5. Simulation Preview，connected 或 Offline / Mock。
6. System Validation Summary。
7. Telemetry & Motor Bench Metrics。
8. readiness/API 终端输出。

## 可选 Playwright 采集

已经启动 Dashboard 后，可以用 Playwright 生成素材：

```bash
npm run capture:screenshots
npm run capture:video
```

默认不应自动发送 motor command。需要录制完整交互时，先人工确认硬件安全，再显式执行相关参数。

## 禁止宣称

- 不宣称 Dashboard 直接控制 Nav2。
- 不宣称当前 motor bench 是完整双轮底盘控制。
- 不宣称实现了多机器人调度、完整商业 WMS 或 AI 自动诊断闭环。
- 不宣称已有真实 VLA / RL / world model 训练结果。
- 不把 RViz / Gazebo / ROS 2 代码说成本仓库的一部分。
- 不把 Offline / Mock / Reserved 状态隐藏起来。

## 最终判断

当前状态可以录屏。本次已接入 live IMU / robot state / motor status 上行；最终浏览器录屏包含 Dashboard 内嵌 RViz Path View。System Evaluation & Validation Layer 仍保留 baseline / mock / reserved 标识；如需展示桌面原生 Gazebo / RViz 窗口，应另行补桌面录屏。
