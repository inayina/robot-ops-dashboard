# 作品集摘要

## 项目一句话

`robot-ops-dashboard` 是机器人数据链路与评测平台 Demo 的主入口仓库，用一个轻量 Web Dashboard 展示 AMR/WMS 任务流、IMU / robot state 状态流、Motor / Encoder bench 控制与回传流，并通过只读 evaluation 层展示 `run_id`、`dataset_version`、`model_version`、任务成功率、失败样本与 compute 状态。

## 展示目标

本项目用于说明一个机器人系统如何从底层传感器、边缘控制器、ROS 2 软件层、MQTT / HTTP 集成层，最终汇聚到运维驾驶舱。

重点不是把 Dashboard 做成完整机器人控制器，而是展示：

- 上层运维页面如何稳定读取机器人任务状态。
- 下位机和 ROS 2 状态如何通过 MQTT 镜像到 Web 端。
- 受限、显式、低频的 motor bench 命令如何通过 Dashboard backend 下发并回传状态。
- baseline / mock evaluation 数据如何以只读契约接入实验看板。
- 网络断开、broker 不可用、上游 API 不可用时，页面如何显示 `disconnected` 或明确错误，而不是白屏。

## 三条数据链

### 1. AMR / WMS 任务链路

Dashboard frontend 通过 Dashboard backend 调用 AMR Mock WMS HTTP API，读取任务列表、创建 Mock WMS task，并观察任务状态变化。上游 AMR 仓库负责 Nav2、Gazebo、Mock WMS executor 和任务状态回写。

本仓库只通过 HTTP adapter 集成 AMR API，不直接依赖 ROS 2、Nav2 或 Gazebo。

### 2. IMU / Robot State 状态链路

STM32 + MPU6050 数据经 ESP32-S3 micro-ROS bridge 进入 ROS 2 topic，再由 PC 端 bridge 低频镜像到 MQTT。Dashboard backend 订阅 `robot/imu` 与 `robot/state`，前端通过 `/api/robot/status` 和 `/ws/status` 展示 IMU 姿态、sensor state LED 与链路健康状态。

这条链路在 Dashboard 侧是只读状态镜像。

### 3. Motor / Encoder bench 链路

Dashboard frontend 通过显式表单调用 `POST /api/robot/motor/cmd`，backend 进行限幅和安全字段规范化后发布到 MQTT `robot/motor/cmd`。下游 ESP32 motor bench 执行低频受限命令，并通过 ROS 2 / MQTT 回传 `robot/motor/status`，前端展示 target rpm、measured rpm、pwm、encoder 与 fault 状态。

这不是完整底盘控制器，也不是 Nav2 控制面板。

### 4. Data & Evaluation 展示层

Dashboard backend 通过 `GET /api/evaluation/*` 读取本仓库 `mock/` 下的只读 evaluation 数据，前端在首屏 cockpit 下方展示 `Experiment Context`、`Baseline Evaluation`、`Dataset / Model Registry`、`Failure Sample Review` 和 `Compute / GPU Status`。

当前 evaluation 结果只表示 `mock_evaluation`、`baseline_system_evaluation` 或 `interface_reserved`。本项目没有真实 VLA / RL / world model 训练结果，不把 reserved interface 包装成真实模型成绩。

## 系统边界

- 前端保持纯 HTML / CSS / JavaScript。
- Backend 使用 FastAPI，作为 HTTP / WebSocket / MQTT 集成层。
- Dashboard backend 不直接启动或导入 ROS 2、Nav2、Gazebo 代码。
- AMR 任务集成边界是 HTTP API。
- IMU 与 robot state 是只读镜像。
- Motor bench 只允许通过已实现的显式接口低频下发受限命令。
- Evaluation API 全部为只读 `GET`，不创建 WMS task，不发布 MQTT，不控制机器人。
- 无真实 GPU 采样时，compute 卡片显示 `not_connected`。

## 相关仓库

- Dashboard 主入口：`robot-ops-dashboard`
- AMR 导航与 Mock WMS：`amr_warehouse_navigation`
- 嵌入式数字孪生与 micro-ROS / MQTT：`ros2-robot-digital-twin`

## 可提取到作品集的素材

- 截图：`artifacts/screenshots/`
- 录屏：`artifacts/videos/`
- 验证报告：`artifacts/reports/`
- 60-90 秒录屏脚本：`docs/dashboard_demo_storyboard.md`
- 联调彩排清单：`docs/recording_rehearsal_checklist.md`

## 建议作品集标题

Robot Data Link & Evaluation Dashboard: AMR/WMS, micro-ROS Telemetry and Baseline Evaluation Demo

## 建议作品集描述

一个面向机器人数据链路与系统 baseline 评测的 Dashboard Demo。项目把 AMR Mock WMS 任务流、micro-ROS IMU / robot state 状态流、Motor / Encoder bench 状态与受限命令链路汇聚到同一个 Web 驾驶舱，并增加只读 evaluation 层展示 run、dataset、model/baseline、失败样本和 compute 状态。当前没有真实 VLA / RL / world model 训练结果，相关区域仅作为接口预留。
