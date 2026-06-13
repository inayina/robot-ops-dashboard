# Evaluation Dashboard 设计说明

## 1. 设计目标

本设计用于第一阶段轻量 mock evaluation 层，帮助作品集展示机器人数据链路与评测平台能力。

目标是让 HR 和技术面试官在一张截图里看懂：

- 一个 `run_id` 如何关联 `dataset_version`、`model_version` 和 `policy_type`。
- ROS2/Nav2 task、IMU/Motor/MQTT 遥测和 Dashboard status 如何汇总为一次 `Evaluation Run Record`。
- 该 run record 如何进一步导出为 `ML-ready Feature Export`。
- 当前页面只展示 baseline / mock 结构，不宣称真实 VLA、RL 或 world model 训练结果。

## 2. 当前实现

当前前端页面为 `Evaluation & ML-ready Data Layer`，结构为：

1. Hero 区：标题、副标题和中文说明，强调 `run_id / dataset_version / model_version` 结构。
2. 纵向流程图：`ROS2/Nav2 Task + IMU/Motor/MQTT + Dashboard Status` -> `Evaluation Run Record` -> `ML-ready Feature Export` -> `Evaluation Summary / Future ML`。
3. 三张摘要卡：`Experiment Record`、`Failure & Quality Checks`、`ML-ready Features`。
4. 右下角 `Current Scope`：明确当前是 baseline system evaluation / mock evaluation structure。

数据文件：

- `backend/data/eval_runs/sample_eval_run.json`
- `mock/sample_evaluation_runs.json`
- `mock/sample_dataset_versions.json`
- `mock/sample_model_versions.json`
- `mock/sample_failure_cases.json`
- `mock/sample_compute_usage.json`

API：

- `GET /api/evaluation/summary`
- `GET /api/evaluation/runs`
- `GET /api/evaluation/datasets`
- `GET /api/evaluation/models`
- `GET /api/evaluation/failure-cases`
- `GET /api/evaluation/compute`

页面展示字段控制在摘要层，不展示完整数据库字段：

- `run_id`
- `dataset_version`
- `model_version`
- `policy_type`
- `task_success_rate`
- `failure_cases`
- `timestamp_check`
- `missing_value_check`
- `source_check`
- `mqtt_delay`
- `status_timeout`
- `task_result`
- `recovery_count`
- `imu_rms`
- `motor_error`
- `pwm_output`
- `label`

这些接口只读读取本地 JSON，不写数据库，不创建 WMS task，不发布 MQTT，不控制机器人。当前端无法访问 evaluation API 时，页面使用内置 `Offline / Mock` fallback 摘要数据，避免作品集截图出现白屏或空卡片。

## 3. Baseline / Mock 口径

当前数据是 baseline / mock evaluation：

- `model_version=baseline_nav2_no_learning`
- `policy_type=rule_based_nav2_baseline`
- `gpu_usage=N/A - reserved`

这表示当前展示的是已有系统 pipeline 的 baseline evaluation，不是训练出的机器人策略，不是 VLA / RL / world model。

页面或文档中不得将这些字段包装成真实训练结果。

## 4. 质量检查

`quality_checks` 用于显示 evaluation 数据是否满足作品集展示与接口契约要求：

- schema 是否可读
- 时间戳或日志路径是否存在
- data source 是否命名
- 是否明确标注 mock / baseline
- 是否避免真实训练结果宣称

这些检查当前来自 mock JSON，后续可以由验证脚本或 CI 生成。

## 5. 后续扩展

后续可以扩展为更接近实验管理平台的接口，但仍建议保持 Dashboard 只读：

- LeRobot 风格：dataset、episode、policy eval、success rate。
- RLDS 风格：episode、step、reward、success、failure tag。
- W&B 风格：run、artifact、dataset version、metrics。
- MLflow 风格：experiment、run、model version、artifact URI、metric。

推荐演进路径：

1. 保持 `sample_eval_run.json` 作为最小契约。
2. 增加多个 run 文件或一个 run index。
3. 增加 artifact 路径校验脚本。
4. 后续再对接外部实验管理系统的只读 API。

## 6. 明确不做

第一阶段不做：

- 不做真实训练任务启动。
- 不做 GPU 调度。
- 不上传或下载真实模型权重。
- 不接管 Nav2、ROS 2 或底盘控制。
- 不把 mock success rate 当作公开 benchmark。
