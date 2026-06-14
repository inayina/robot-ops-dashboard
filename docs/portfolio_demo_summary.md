# 作品集 Demo 总结与提取入口

本文用于从 `robot-ops-dashboard` 仓库中快速提取作品集、简历、面试讲解和录屏素材。

本仓库是机器人系统 Demo 的主展示入口，连接 AMR 仿真导航、实机状态遥测、电机 bench 和系统评测验收层。它的定位是上层观察、联调和评测 Dashboard，不是 Nav2 控制器、底盘级高频闭环控制器或完整商业 WMS。

## 项目标题

Robot Data Link & Evaluation Dashboard: AMR/WMS, micro-ROS Telemetry and Baseline Evaluation Demo

## 一句话简介

`robot-ops-dashboard` 是一个面向机器人系统集成与测试验证的轻量 Web Dashboard，用于统一展示 AMR/WMS 任务链路、micro-ROS/MQTT 实机遥测链路、Motor/Encoder bench 链路，并通过 System Evaluation & Validation Layer 汇总任务执行、链路健康、接口契约和验收证据。

## 项目定位

本仓库当前阶段是 `monitoring-first with explicit interactions`：

- 展示 AMR 任务创建、查询、执行状态和结果回写。
- 展示 IMU、robot state、motor status 等硬件状态链路。
- 提供受限、显式、低频的 motor bench 命令入口。
- 通过 HTTP、WebSocket 和 MQTT 聚合跨仓库数据。
- 通过 System Evaluation & Validation Layer 展示系统验收摘要、失败样本、质量检查和证据文档。
- 为作品集截图、录屏和面试讲解提供统一入口。

边界说明：

- Dashboard backend 通过 HTTP adapter 读取 AMR Mock WMS API，不直接依赖 ROS 2、Nav2 或 Gazebo。
- IMU、robot state 与设备遥测链路保持只读镜像。
- Motor bench 命令入口只用于低频、显式、受限的本地 bench 联调。
- Dashboard 不参与实时 PID 闭环，不提供完整移动底盘控制。
- Evaluation 数据属于 baseline、mock 或 reserved 口径，不宣称真实 VLA、RL 或 world model 训练结果。
- GPU 未接入时显示 `not_connected`、`N/A` 或 `reserved`，不伪造 GPU 利用率。

## 关联仓库

| 仓库 | 角色 | 作品集提取重点 |
| --- | --- | --- |
| `robot-ops-dashboard` | 主展示入口 | Dashboard、API、WebSocket、Evaluation Layer、录屏素材 |
| `amr_warehouse_navigation` | AMR 仿真导航与 Mock WMS | Nav2、Gazebo、Mock WMS、任务执行、验收报告 |
| `ros2-robot-digital-twin` | 实机状态与电机控制子系统 | STM32、ESP32-S3、micro-ROS、MQTT、IMU、Motor bench |

## 系统数据链

### AMR / WMS 任务链路

```text
Dashboard frontend
-> Dashboard backend FastAPI
-> AMR Mock WMS HTTP API
-> SQLite task database
-> Mock WMS executor / task runner
-> Nav2 NavigateToPose
-> Gazebo AMR
-> task status writeback
-> Dashboard task view
```

提取关键词：AMR 任务下发、Mock WMS、Nav2 执行、HTTP API 集成、任务状态回写、系统集成测试。

### IMU / Robot State 遥测链路

```text
STM32 + MPU6050
-> ESP32-S3 micro-ROS bridge
-> ROS 2 topics /imu/data, /imu/filtered, /robot/state
-> MQTT mirror robot/imu, robot/state
-> Dashboard backend cache
-> /api/robot/status, /ws/status
-> Dashboard IMU Status card
```

提取关键词：micro-ROS、ROS 2 topic、MQTT 状态镜像、传感器状态监控、WebSocket 实时展示、机器人遥测链路。

### Motor / Encoder Bench 链路

```text
Dashboard frontend
-> POST /api/robot/motor/cmd
-> Dashboard backend safety limit
-> MQTT robot/motor/cmd
-> ROS 2 /motor/cmd
-> ESP32 motor_control_task
-> TB6612 / N20 motor bench
-> ROS 2 /motor/status
-> MQTT robot/motor/status
-> Dashboard Motor / Encoder card
```

提取关键词：电机 bench、编码器反馈、目标速度、实际速度、PWM 输出、安全限幅、低频人工命令入口。

## System Evaluation & Validation Layer

本仓库的评测层不是机器学习 benchmark，也不宣称已有真实 VLA、RL 或 world model 训练结果。它是机器人系统集成 Demo 的系统验收层，用于汇总：

- AMR 任务执行结果。
- Dashboard API 可用性。
- WebSocket 状态流。
- MQTT 遥测新鲜度。
- Motor bench 目标值、反馈值、PWM 和 error。
- 失败样本与质量检查。
- 跨仓库证据文档。

当前评测口径：

| 指标 | 含义 |
| --- | --- |
| `task_success_rate` | AMR / Mock WMS 任务执行成功率 |
| `failure_cases` | 阻塞、超时、链路断连等失败样本 |
| `quality_checks` | schema、timestamp、source、mock/baseline 标注检查 |
| `telemetry_freshness` | IMU / motor MQTT 状态是否及时刷新 |
| `motor_error_rpm` | 电机目标速度和实际速度误差 |
| `evidence_links` | 指向 AMR、Dashboard、硬件仓库的验收文档或测试脚本 |

## 当前最终验证状态

截至 2026-06-14，本仓库已完成最终 demo readiness 检查：

- `GET /health`：PASS。
- `GET /api/tasks`：PASS。
- `GET /api/robot/status`：PASS。
- `GET /api/sim/preview`：PASS；最终录屏中已连接 Dashboard 内嵌 `RViz Path View`，无实时 MJPEG 时会回退为 Offline / Mock。
- `GET /api/evaluation/summary`：PASS，包含 `failure_cases`、`quality_checks`、`gpu_usage`。
- `WebSocket /ws/status`：PASS。
- `GET /api/wms/tasks`：PASS，backend 已指向本机 AMR Mock WMS API。
- `POST /api/wms/tasks`：PASS，已通过 Dashboard proxy 创建一次 Mock WMS task。
- `POST /api/robot/motor/cmd`：PASS，仅执行 STOP 与短时低速 N20 bench 探针，随后 STOP。

验证详情见：

- [full_pipeline_validation_report.md](./full_pipeline_validation_report.md)
- [final_demo_validation_2026-06-14.md](../artifacts/reports/final_demo_validation_2026-06-14.md)
- [final_demo_validation_2026-06-14.zh.md](../artifacts/reports/final_demo_validation_2026-06-14.zh.md)

## 真实联调内容

- Dashboard backend / frontend 真实运行。
- AMR Mock WMS HTTP API 真实接入，`POST /api/wms/tasks` 可创建任务。
- WebSocket `/ws/status` 真实推送 task/robot 快照。
- MQTT broker connection 真实可用。
- IMU / robot state 已通过 micro-ROS / MQTT 上行进入 Dashboard。
- Motor command 下行已到 ROS `/motor/cmd`；motor status 上行已进入 Dashboard，当前为安全停止 / stale。
- 前端页面真实展示 Task Dispatch、Robot Link、IMU、Motor、Simulation Preview 和 System Evaluation & Validation Layer。

## Mock / Fallback / Reserved 内容

- Simulation Preview 支持实时 MJPEG 预览；最终录屏中展示的是 Dashboard 内嵌 `RViz Path View`，不是桌面原生 Gazebo / RViz 窗口。无实时 MJPEG 时显示 Offline / Mock。
- Evaluation 是 baseline / mock / reserved JSON，不是真实训练成绩。
- GPU 未接入，显示 `not_connected` / `N/A` / `reserved`。
- VLA、RL、world model 只保留接口口径，不宣称训练结果。

## 可复现入口

启动 Dashboard backend：

```bash
source .venv/bin/activate
export ROBOT_OPS_TASK_SOURCE=amr_http
export AMR_API_BASE_URL=http://127.0.0.1:8000
uvicorn backend.app.main:app --host 127.0.0.1 --port 9000 --reload
```

启动前端静态页面：

```bash
python3 -m http.server 8001
```

浏览器访问：

```text
http://127.0.0.1:8001/frontend/
```

一键启动本地 API 和页面：

```bash
./scripts/start_dashboard_api_stack.sh
```

启动带 AMR 可视化的录屏环境：

```bash
./scripts/start_dashboard_api_stack.sh --with-amr-visualization
```

采集截图和录屏：

```bash
npm run capture:screenshots
npm run capture:video
```

完整交互录制：

```bash
node scripts/capture_dashboard_artifacts.js --dispatch --motor-demo --record-ms 75000
```

## 推荐作品集表达

可以这样讲：

> 这个项目是我做的机器人数据链路与评测 Dashboard。它不把 Dashboard 做成底盘控制器，而是作为上层运维和测试驾驶舱，通过 HTTP adapter 接 AMR Mock WMS，通过 MQTT/WebSocket 接机器人状态，通过只读 evaluation API 展示 baseline/mock 评测结果。重点是系统集成、数据契约、可观测性和安全边界。

## 60-90 秒录屏讲解顺序

### 0-10 秒：项目总览

展示 Dashboard 首页。

讲解重点：

> 这是一个机器人系统集成与测试验证 Dashboard，用于把 AMR 任务、实机遥测、电机 bench 和系统验收结果放到统一入口。

### 10-30 秒：AMR / WMS 任务链路

展示任务下发和任务状态变化。

讲解重点：

> Dashboard 通过 HTTP proxy 对接 AMR Mock WMS API，实际 Nav2 / Gazebo / executor 在 AMR 仓库中运行，本仓库保持清晰的系统集成边界。

### 30-50 秒：IMU / Robot State 遥测链路

展示 IMU 姿态、RMS 状态和 ROS 2 / micro-ROS / MQTT 链路。

讲解重点：

> STM32 + MPU6050 经 ESP32-S3 micro-ROS 进入 ROS 2，再通过 MQTT 镜像到 Dashboard，实现硬件状态可观察。

### 50-70 秒：Motor / Encoder Bench

展示速度滑块、SEND CMD、STOP、target / measured / pwm / error 曲线。

讲解重点：

> 电机 bench 是低频受限命令链路，用于验证 Dashboard 到 ESP32 motor task 的命令和状态闭环，不是完整底盘控制器。

### 70-90 秒：System Evaluation & Validation Layer

展示系统评测层。

讲解重点：

> 评测层不是机器学习成绩，而是系统验收摘要。它汇总 AMR 任务成功率、链路健康、遥测新鲜度、电机 bench 状态、失败样本和跨仓库证据文档。

## 简历可提取描述

项目名称：机器人数据链路与系统评测 Dashboard。

一句话描述：

> 设计并实现一个面向机器人系统集成与测试验证的 Web Dashboard，聚合 AMR/WMS 任务状态、micro-ROS/MQTT 实机遥测、电机 bench 状态与系统验收摘要，实现跨 ROS 2、HTTP、MQTT、WebSocket 的端到端可观察链路。

项目描述：

- 搭建 FastAPI + WebSocket + 静态前端 Dashboard，统一展示 AMR 任务、设备状态、IMU 姿态、电机 bench 和事件流。
- 通过 HTTP proxy 对接 AMR Mock WMS API，实现任务创建、任务查询、任务状态回写的上层可视化。
- 通过 MQTT 接入 micro-ROS / ROS 2 状态镜像，展示 IMU、robot state、motor status 等实机遥测数据。
- 实现受限电机命令入口，将 Dashboard 命令经 backend 安全限幅后发布到 MQTT，并展示 target rpm、measured rpm、pwm、error rpm 和安全状态。
- 新增 System Evaluation & Validation Layer，汇总任务成功率、失败样本、质量检查、链路健康和跨仓库验收证据，支撑作品集录屏和面试讲解。
- 明确系统边界：Dashboard 不直接控制 Nav2，不参与实时 PID 闭环，不宣称真实 VLA、RL 或 world model 训练结果。

技术关键词：

```text
ROS 2, micro-ROS, MQTT, FastAPI, WebSocket, AMR, Nav2, Gazebo,
STM32, ESP32-S3, Motor Bench, System Integration,
Evaluation Dashboard, Test Validation
```

## 面试表达重点

这个项目最核心的价值不是单个页面或单个算法，而是把机器人系统中的任务链路、硬件状态链路、电机 bench 链路和验收证据组织成一个可观察、可验证、可复现的系统。

可以重点讲三个问题：

1. 系统边界清晰：Dashboard 只作为观察层和低频联调入口，不直接控制 Nav2 或实时 PID。
2. 数据链路闭环：AMR 任务、IMU 状态、电机状态都能通过 HTTP / MQTT / WebSocket 回到前端。
3. 评测可见：把任务成功率、链路健康、失败样本和验收文档放入 System Evaluation & Validation Layer，方便面试官或交付人员快速判断系统是否可复现、可验证。

## 推荐 60 秒讲法

这个项目是一个机器人数据链路与评测 Dashboard。上游 AMR 仓库负责 Mock WMS、Nav2 和 Gazebo 任务；硬件链路负责 STM32 / ESP32-S3 / micro-ROS / MQTT 的 IMU 和 motor bench 状态；Dashboard 仓库负责把 HTTP task、MQTT telemetry、WebSocket status 和只读 evaluation summary 汇总成一个可展示入口。当前 evaluation 是 baseline / mock / reserved 口径，不宣称真实 VLA、RL 或 world model 结果。这个 Demo 的重点是系统集成、数据链路、可观测性和安全边界。

## 推荐素材清单

- Dashboard 总览截图。
- Task Dispatch / Current Task Execution 截图。
- Robot Link / IMU / Motor 截图。
- Motor Bench 曲线截图：`0.08 m/s`，约 `23.5 rpm`，短时阶跃后 STOP。
- Simulation Preview 截图，可为 Offline / Mock。
- System Evaluation & Validation Layer 截图。
- API readiness 输出截图。
- 可选 Gazebo / RViz 截图。
- 60 秒作品集录屏。

## 不应宣称的内容

为了保持作品集可信度，本项目不应宣称：

- 已实现完整商业 WMS。
- 已实现多机器人调度。
- Dashboard 可直接控制 Nav2。
- Motor bench 是完整移动底盘控制。
- 已训练真实 VLA、RL 或 world model。
- 已接入真实 GPU 训练或大规模数据集。
- 当前系统达到生产级稳定性。

更准确的说法是：

> 这是一个面向机器人系统集成、状态监控和 baseline 验收的作品集 Demo，重点展示跨 ROS 2、HTTP、MQTT、WebSocket 和嵌入式硬件链路的系统组织能力。

## 当前状态说明

可以录屏。最终对外版本应以 [demo_recording_checklist.md](./demo_recording_checklist.md) 和 [dashboard_demo_storyboard.md](./dashboard_demo_storyboard.md) 的顺序录制，并保留 Mock / Offline / Reserved 标签；如果展示 Gazebo 本体窗口，需要另行补桌面录屏。
