# PLAN.md - 机器人数据链路与评测平台作品集改造计划

## 本次改造目标

将 `robot-ops-dashboard` 包装为面向作品集展示的 **具身智能机器人数据链路与评测平台**入口，同时保持当前 monitoring-first 与显式交互边界。

本次改造重点展示：

- 已有 AMR Mock WMS -> ROS 2 / Gazebo / Nav2 -> Dashboard 的仿真任务链路。
- 已有 STM32 / ESP32-S3 / micro-ROS / MQTT -> Dashboard 的硬件状态链路。
- FastAPI + MQTT + WebSocket + 纯 HTML/CSS/JS Dashboard 的端到端数据平台能力。
- 新增只读评测展示层，覆盖 `run_id`、`dataset_version`、`model_version`、失败样本、任务成功率、GPU/compute 状态。
- 所有评测数据明确标记为 `mock_evaluation`、`baseline_system_evaluation` 或 `interface_reserved`，不虚构真实 VLA / RL / world model 训练结果。

## 不做什么

- 不做真实模型训练，不宣称已有 VLA / RL / world model 结果。
- 不新增 Nav2 控制、底盘级高频闭环、多机器人调度或完整 WMS。
- 不新增写操作 API；本次新增接口全部为只读 `GET`。
- 不让 mock 评测数据看起来像真实 benchmark；前端和文档必须显示 `mock` / `baseline` / `reserved` 标签。
- 不引入 React、Vue、Vite、Webpack 等前端框架或复杂依赖。
- 不把 backend 直接接入 ROS 2、Gazebo、Nav2 或真实机器人硬件。

## 新增数据文件

所有文件放在 `mock/` 下，并沿用现有 envelope 结构：`generated_at`、`source`、`data`。

- `mock/sample_evaluation_runs.json`
  - 记录 `run_id`、`run_type`、`scenario`、`dataset_version`、`model_version`、任务成功率和 `result_scope`。
  - `run_type` 只使用 `mock_evaluation`、`baseline_system_evaluation`、`interface_reserved`。
- `mock/sample_dataset_versions.json`
  - 展示 AMR task、MQTT telemetry、micro-ROS IMU、motor bench status 等数据链路版本。
- `mock/sample_model_versions.json`
  - 初始包含 `nav2_baseline_no_ml_v0`、`rule_based_health_baseline_v0`、`vla_interface_reserved`。
  - 明确 `training_status` 为 `not_trained` 或 `reserved_only`。
- `mock/sample_failure_cases.json`
  - 展示失败样本队列，不自动生成诊断结论。
- `mock/sample_compute_usage.json`
  - 无真实 GPU 采样时使用 `gpu_status: not_connected`，GPU 数值字段为 `null`。

## 新增 API

新增 API 全部只读读取 mock 文件，不影响上游机器人行为：

- `GET /api/evaluation/runs`
- `GET /api/evaluation/datasets`
- `GET /api/evaluation/models`
- `GET /api/evaluation/failure-cases`
- `GET /api/evaluation/compute`

实现默认复用现有 `MockEnvelope` 与 `MockDataService`；本阶段不把 evaluation 数据加入 `/ws/status`。

## 新增前端卡片

在现有 cockpit 下方新增全宽 `Data & Evaluation Layer` 区域，不重排首屏 AMR / IMU / Motor / Simulation Preview 主驾驶舱。

- `Experiment Context`：展示 `run_id`、`dataset_version`、`model_version`、`result_scope`。
- `Baseline Evaluation Summary`：展示任务成功率、成功/失败/总任务数和 run 状态。
- `Dataset / Model Registry`：展示 dataset version 与 baseline/model version，并明确 Nav2 baseline 不是训练模型。
- `Failure Sample Review`：展示失败样本 ID、关联 run、failure type、severity 与 evidence refs。
- `Compute / GPU Status`：展示 GPU connected / not_connected、利用率、显存、CPU；无真实 GPU 数据时显示 `not connected`。

## 新增与更新文档

- 新增 `PLAN.md`。
- 新增 `docs/robot_data_evaluation_platform.md`。
- 更新 `docs/api_contract.md`、`docs/data_sources.md`、`docs/dashboard_pages.md`、`docs/test_plan.md`。
- 更新 `README.md` 与 `docs/portfolio_summary.md`，将作品集口径调整为机器人数据链路与评测平台，同时保留 monitoring-first 与显式交互边界。

## 验证命令

只读常规验证：

```bash
env PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest backend/tests -q
node --check frontend/app.js

python3 -m json.tool mock/sample_evaluation_runs.json >/dev/null
python3 -m json.tool mock/sample_dataset_versions.json >/dev/null
python3 -m json.tool mock/sample_model_versions.json >/dev/null
python3 -m json.tool mock/sample_failure_cases.json >/dev/null
python3 -m json.tool mock/sample_compute_usage.json >/dev/null
```

本地 API 与页面验证：

```bash
ROBOT_OPS_TASK_SOURCE=mock_json .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 9000 --reload
python3 -m http.server 8001 --bind 127.0.0.1

curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/runs | python3 -m json.tool
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/datasets | python3 -m json.tool
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/models | python3 -m json.tool
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/failure-cases | python3 -m json.tool
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/compute | python3 -m json.tool
```

截图采集：

```bash
npm run capture:screenshots
```

可选 AMR 联调验证：

```bash
ROBOT_OPS_TASK_SOURCE=amr_http ./scripts/verify_amr_http_integration.sh
```

注意：可选 AMR 联调脚本会创建上游 Mock WMS 测试任务，不作为默认只读验证步骤。

## 对作品集截图的展示建议

- `dashboard-overview-1440x900.png`：展示现有 AMR / WMS、IMU、Motor、Simulation Preview 主驾驶舱。
- `dashboard-evaluation-platform-1440x900.png`：滚动到 `Data & Evaluation Layer`，突出 `run_id`、`dataset_version`、`model_version`、任务成功率、失败样本和 GPU 状态。
- `dashboard-failure-cases-1366x768.png`：聚焦失败样本卡片，展示评测平台关注 failure case review。
- `dashboard-disconnected-evaluation-1440x900.png`：展示 GPU 或 evaluation 数据源 `not_connected` / `disconnected` 状态。

录屏旁白建议明确说明：当前没有真实 VLA / RL / world model 训练结果；本仓库展示的是机器人数据链路、baseline/system evaluation UI、mock evaluation contract 和接口预留能力。
