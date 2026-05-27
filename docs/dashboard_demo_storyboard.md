# Dashboard 录屏 Storyboard

本文用于指导最终 60-90 秒作品集录屏。录屏目标是清楚展示 `robot-ops-dashboard` 作为机器人系统集成与运维监控 Demo 主入口，连接 AMR/WMS、IMU 状态、电机控制三条数据链。

## 录屏前准备

- 启动 AMR Mock WMS API，并确认 `http://127.0.0.1:8000/health` 可用。
- 启动 Dashboard backend，推荐 `ROBOT_OPS_TASK_SOURCE=amr_http`。
- 启动 frontend static server，打开 `http://127.0.0.1:8001/frontend/`。
- 如展示真实仿真画面，配置 `SIM_PREVIEW_MJPEG_URL` 或使用 `./scripts/start_dashboard_api_stack.sh --with-amr-visualization`。
- 如展示 IMU / motor live 状态，启动 MQTT broker、micro-ROS Agent、ROS 2 -> MQTT bridge 与 motor status bridge。
- 录屏前先按 `docs/recording_rehearsal_checklist.md` 完成人工彩排。

## 推荐画面比例

- 首选：`1440x900`
- 备选：`1366x768`
- 浏览器只保留 Dashboard 页面，不展示 IDE 或终端隐私路径。

## 60-90 秒顺序

### 0-10 秒：项目入口与全局状态

画面停留在首页总览，先让观众看到：

- 顶部 `Mock WMS · Motor Bench · Telemetry`
- Backend / Stream / ROS 2 / micro-ROS / MQTT 状态
- 左侧 `Robot Link`
- 中间 IMU 姿态与三条 flow lane
- 右侧当前任务和 Simulation Preview

旁白重点：这是机器人运维与测试驾驶舱，不是底盘控制器；它把任务、遥测和 motor bench 状态汇聚到统一入口。

### 10-30 秒：AMR / WMS 任务链路

操作顺序：

1. 在 `Task Dispatch` 选择 `pickup=start_zone`。
2. 选择一个目标点，例如 `station_a`。
3. 点击 `DISPATCH`。
4. 观察 `Current Task Execution`、`Event Log`、`Simulation Preview` 的变化。

旁白重点：Dashboard 通过 backend HTTP proxy 调用 AMR Mock WMS API；实际 Nav2 / Gazebo / executor 在 AMR 仓库中运行，本仓库保持 HTTP 集成边界。

### 30-50 秒：IMU / Robot State 状态链路

画面聚焦中间 `IMU 姿态展示` 和左侧链路状态：

- Roll / Pitch / Yaw
- accel / gyro
- RMS sensor LED
- ROS 2 / micro-ROS / MQTT 状态

旁白重点：STM32 + MPU6050 经 ESP32-S3 micro-ROS 进入 ROS 2，再低频镜像到 MQTT，Dashboard 只读展示状态。

### 50-70 秒：Motor / Encoder bench 链路

操作顺序：

1. 展示 `Motor Bench Flow`。
2. 轻微调整 Wheel Speed slider。
3. 点击 `SEND CMD`。
4. 观察 target / measured / pwm / encoder 曲线变化。
5. 点击或展示 `STOP` 安全入口。

旁白重点：这是单 N20 motor bench 的低频受限命令链路，命令必须走 `POST /api/robot/motor/cmd`，不是完整底盘闭环，也不控制 Nav2。

### 70-90 秒：收束与作品集价值

画面回到全局 Dashboard，停留在三条 flow lane 和 Event Log：

- AMR/WMS 任务状态可观察
- IMU / robot state 只读遥测可观察
- Motor bench 显式交互可观察
- 网络异常时页面显示 `disconnected` 或错误状态

旁白重点：这个 Demo 展示的是机器人系统集成能力、边界意识和运维可视化能力。

## 可选 Playwright 采集

已经启动 Dashboard 后，可以用 Playwright 生成作品集素材：

```bash
npm run capture:screenshots
npm run capture:video
```

默认不会点击 `DISPATCH` 或发送 motor command。需要录制完整交互时显式执行：

```bash
node scripts/capture_dashboard_artifacts.js --dispatch --motor-demo --record-ms 75000
```

输出位置：

- `artifacts/screenshots/`
- `artifacts/videos/`

## 不要在录屏中宣称

- 不宣称 Dashboard 直接控制 Nav2。
- 不宣称当前 motor bench 是完整双轮底盘控制。
- 不宣称实现了多机器人调度、完整商业 WMS 或 AI 自动诊断闭环。
- 不把 RViz / Gazebo / ROS 2 代码说成本仓库的一部分。
