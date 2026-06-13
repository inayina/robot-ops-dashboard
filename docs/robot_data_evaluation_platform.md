# 机器人数据链路与评测平台说明

## 1. 定位

`robot-ops-dashboard` 当前可作为作品集中的 **具身智能机器人数据链路与评测平台**入口。

这里的“平台”不是完整训练平台，也不是机器人控制器，而是把已有机器人链路的数据聚合到统一 Dashboard，并用只读的 baseline / mock evaluation 视图展示：

- 数据从哪里来
- 哪个 `run_id` 使用了哪个 `dataset_version`
- 当前展示的是哪个 `model_version` 或系统 baseline
- 任务成功率和失败样本如何被记录
- GPU / compute 数据源是否真实连接

## 2. 真实能力

当前真实链路包括：

- AMR Mock WMS HTTP API -> Mock WMS executor -> Nav2 / Gazebo -> task status writeback -> Dashboard。
- STM32 / ESP32-S3 / micro-ROS / ROS 2 -> MQTT mirror -> Dashboard。
- FastAPI backend -> WebSocket / REST -> 纯 HTML/CSS/JS frontend。
- 低频受限 Motor bench 命令链路：`POST /api/robot/motor/cmd` -> MQTT `robot/motor/cmd`。

Dashboard backend 仍不直接依赖 ROS 2、Nav2 或 Gazebo；AMR 集成边界仍保持在 HTTP API 层。

## 3. Evaluation 口径

新增 evaluation 数据只用于作品集展示和接口预留，分为三类：

| 类型 | 含义 |
| --- | --- |
| `baseline_system_evaluation` | 对已有系统链路的 baseline 评测，例如 Nav2 + Mock WMS task pipeline，不代表训练模型 |
| `mock_evaluation` | 用 mock 数据验证数据契约、页面展示和失败样本 review 流程 |
| `interface_reserved` | 给未来 VLA / RL / world model 结果预留字段和页面位置，目前没有真实结果 |

任何 `interface_reserved` 项都必须明确写出 `reserved_only` 或 `no_training_result`，不能被包装成真实模型成绩。

## 4. 新增只读数据链路

新增 mock 文件：

- `mock/sample_evaluation_runs.json`
- `mock/sample_dataset_versions.json`
- `mock/sample_model_versions.json`
- `mock/sample_failure_cases.json`
- `mock/sample_compute_usage.json`

新增只读 API：

- `GET /api/evaluation/runs`
- `GET /api/evaluation/datasets`
- `GET /api/evaluation/models`
- `GET /api/evaluation/failure-cases`
- `GET /api/evaluation/compute`

这些接口只读取本仓库 mock 文件，不写数据库，不发布 MQTT，不创建 WMS task，不控制 Nav2、电机或真实机器人。

## 5. 前端展示

首页首屏仍是机器人联调 cockpit。其下新增 `Data & Evaluation Layer`：

- `Experiment Context`
- `Baseline Evaluation`
- `Dataset / Model Registry`
- `Failure Sample Review`
- `Compute / GPU Status`

该区域用于作品集截图中的“评测平台”视角。没有真实 GPU 或真实训练结果时，页面必须显示 `not_connected`、`reserved` 或 `not_trained`。

## 6. 明确不宣称

本仓库当前不宣称：

- 已完成真实 VLA / RL / world model 训练。
- 已有真实 embodied AI benchmark 成绩。
- Dashboard 能控制 Nav2 或完整底盘。
- Dashboard 是完整 WMS、完整多机器人调度系统或完整模型训练平台。

更准确的作品集描述是：

> 一个面向机器人数据链路、系统 baseline 评测和实验看板展示的轻量 Dashboard。它把 AMR 仿真任务链路、micro-ROS/MQTT 硬件状态链路和只读 mock evaluation contract 放在同一个可演示入口中。
