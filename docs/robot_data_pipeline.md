# 机器人数据链路说明

## 1. 目标

本文说明 `robot-ops-dashboard` 如何作为机器人数据链路与评测展示入口，接收 ROS 2、MQTT、HTTP、WebSocket 与 CSV / artifact 风格的数据。

当前仓库仍是 Dashboard 与 evaluation 展示层，不是 ROS 2 节点、不直接控制 Nav2、不承担完整训练平台职责。

## 2. 数据进入 Dashboard 的路径

### 2.1 ROS 2

ROS 2 数据不由 Dashboard backend 直接订阅。

当前推荐路径：

1. 机器人或仿真侧发布 ROS 2 topic，例如 `/imu/data`、`/robot/state`、`/motor/status`。
2. 独立 bridge 将 ROS 2 topic 转为 MQTT 消息。
3. Dashboard backend 只订阅 MQTT topic，并缓存最新状态。
4. 前端通过 `GET /api/robot/status` 或 `WebSocket /ws/status` 展示。

这样可以保持本仓库不直接依赖 ROS 2、Nav2 或 Gazebo。

### 2.2 MQTT

MQTT 负责承接真实硬件状态链路和本地 bench 状态：

- `robot/imu`
- `robot/state`
- `robot/motor/status`
- `robot/alarm`
- `robot/motor/cmd`

其中状态 topic 是 Dashboard 的只读输入；`robot/motor/cmd` 只通过 `POST /api/robot/motor/cmd` 这个显式、低频、受限接口发布。

### 2.3 HTTP

HTTP 用于任务与 evaluation 数据：

- `GET /api/tasks`：Dashboard 统一任务视图，可来自 mock JSON 或 AMR Mock WMS HTTP API。
- `GET /api/wms/tasks` / `POST /api/wms/tasks`：最小 Mock WMS task proxy。
- `GET /api/evaluation/summary`：读取 `backend/data/eval_runs/sample_eval_run.json` 的核心摘要。
- `GET /api/evaluation/*`：读取 mock evaluation registry、failure cases 与 compute 状态。

AMR 集成边界保持在 HTTP adapter 层，Dashboard backend 不直接驱动 Nav2。

### 2.4 WebSocket

`WebSocket /ws/status` 用于前端实时刷新任务、设备、IMU 与电机状态快照。

该通道只服务 Dashboard 展示，不替代 REST API，不承载训练任务，也不作为控制通道。

### 2.5 CSV / artifact

CSV 与 artifact 当前是预留输入形态，用于后续导入离线 evaluation 结果，例如：

- task result CSV
- failure case CSV
- telemetry sample CSV
- screenshot / video / log artifact

当前第一阶段只在 `sample_eval_run.json` 的 `log_paths` 和 `data_sources` 中保留路径，不读取真实 CSV，也不生成真实训练指标。

## 3. 当前 evaluation 口径

当前 evaluation 层只支持：

- `baseline_system_evaluation`
- `mock_evaluation`
- `interface_reserved`

其中：

- `baseline_nav2_no_learning` 表示 Nav2 / Mock WMS 系统 baseline，不是学习模型。
- `rule_based_nav2_baseline` 表示规则或系统 pipeline baseline，不是 VLA / RL / world model。
- `gpu_usage` 为 `N/A` 或 `reserved` 时，表示没有真实 GPU 训练或评测采样。

## 4. 后续可对接方向

后续可以在保持只读边界的前提下，对接类似以下平台风格：

- LeRobot：机器人数据集、episode、policy eval result。
- RLDS：episode / step / reward / success flag 数据格式。
- W&B：run、artifact、dataset version、metric history。
- MLflow：experiment、run、artifact、model version、metric。

这些对接应优先通过 HTTP 或离线文件导入，不应让 Dashboard backend 直接承担训练调度器职责。
