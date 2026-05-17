# Robot Operations and Testing Dashboard

## 项目定位

`robot-ops-dashboard` 定位为 **Robot Operations and Testing Dashboard**，用于承接机器人系统的上层运维、测试验证与状态监控需求。

它不是一个单独的 AMR 业务看板，而是面向多类机器人系统、测试流程和现场设备状态的统一观察层，重点服务以下场景：

- AMR 任务执行进度可视化
- 设备健康与通信状态监控
- 测试验证过程留痕与结果汇总
- 异常告警聚合与排障辅助
- 后续 AI 分析结果展示与诊断建议承载

## 当前阶段

当前版本已推进到 `V0.2` 的初始只读 AMR HTTP 集成，主要新增：

- 支持通过 HTTP 读取 `amr_warehouse_navigation` Mock WMS 的 `/tasks` 接口（只读）
- 将上游任务映射为 Dashboard 统一 `Task` 契约，前端无需感知上游字段差异
- 新增 Dashboard Backend 到 Frontend 的 `/ws/status` WebSocket 状态流，用于推送任务列表和机器人状态快照
- 可通过环境变量切换数据源：`ROBOT_OPS_TASK_SOURCE=mock_json|amr_http`

当前版本保留 V0.1 的基础能力，仍然只读，不会对上游下发任务或控制机器人。

当前 **不引入前端框架，不实现任务下发、Nav2 控制、电机控制、数据库、MQTT、ROS 2 bridge 或 AI 平台能力**。WebSocket 仅用于 Dashboard Backend 向 Frontend 推送只读状态快照。

当前后端状态：

- 已提供 FastAPI 只读 Backend
- `/api/tasks` 可切换 `mock_json` 或 `amr_http`
- `/api/device-status` 与 `/api/alerts` 当前仍可继续返回 mock 数据
- `/ws/status` 推送统一 `dashboard_status` 消息，当前包含 `tasks`、`robot`，并保留 `motor: null`、`imu: null`

当前前端状态：

- 已提供纯 HTML / CSS / JavaScript 页面
- 使用原生 HTML / CSS / JavaScript
- 默认请求 Dashboard backend 的 `/api/tasks`、`/api/device-status`、`/api/alerts`
- 页面加载后连接 Dashboard backend 的 `/ws/status`
- 保留每 3 秒 HTTP 自动刷新作为 WebSocket 断开时的 fallback
- 只读展示，不提供任务下发、Nav2 控制或电机控制

当前联调脚本状态：

- 已提供 `scripts/verify_amr_http_integration.sh`
- 用于验证 `AMR Mock WMS API -> Dashboard Backend -> /api/tasks` 的只读 HTTP 数据链路
- 不启动前端、不启动 uvicorn、不依赖 ROS 2 / Nav2 / Gazebo

## 第一阶段优先级

V0.1 到后续 V0.2 的首要工作，是优先对接 `amr_warehouse_navigation` 的 **Mock WMS HTTP API**，先把 AMR 任务流、任务状态和基础告警链路跑通。

在此基础上，后续预留两条扩展方向：

- 对接 `ros2-robot-digital-twin` 项目的 MQTT / micro-ROS 下位机状态数据
- 引入机器学习异常分类、LLM 诊断建议、YOLO 视觉检测结果展示

## Frontend Live Demo

V0.2 前端演示页为只读监控模式，推荐按下面顺序启动：

1. `AMR Mock WMS API` at `127.0.0.1:8000`
   确保上游仓库已经启动，并能访问 `GET /health` 与 `GET /tasks`。
2. `Dashboard backend` at `127.0.0.1:9000`

```bash
source .venv/bin/activate
export ROBOT_OPS_TASK_SOURCE=amr_http
export AMR_API_BASE_URL=http://127.0.0.1:8000
uvicorn backend.app.main:app --host 127.0.0.1 --port 9000 --reload
```

3. `frontend static server` at `127.0.0.1:8001/frontend/`

```bash
python3 -m http.server 8001
```

浏览器访问：

- `http://127.0.0.1:8001/frontend/`

说明：

- Frontend 默认请求 `http://127.0.0.1:9000/api/tasks`
- Frontend 默认连接 `ws://127.0.0.1:9000/ws/status` 接收只读状态流
- Frontend 每 3 秒保留 HTTP 自动刷新 fallback，便于录屏时观察新任务和状态变化
- 这是 **read-only demo**，只做监控展示，不提供任务下发、Nav2 控制或电机控制

## WebSocket Status Stream

Dashboard backend 提供只读 WebSocket 状态流：

- Endpoint：`/ws/status`
- 方向：Dashboard Backend -> Frontend
- 数据来源：复用 Dashboard backend 既有 HTTP adapter 与 mock device status，不让前端直连 AMR API、ROS 2、MQTT 或 ESP32
- 作用：向前端推送任务列表与机器人状态快照

消息结构：

```json
{
  "type": "dashboard_status",
  "timestamp": "2026-05-18T10:00:00+00:00",
  "tasks": [],
  "robot": {},
  "motor": null,
  "imu": null
}
```

说明：

- `/api/tasks`、`/api/device-status`、`/api/alerts` 继续保留，验证脚本仍通过 HTTP 验证。
- `motor` 与 `imu` 当前仅保留字段，后续如接入 `motor_state` / `imu_state` 需要先补设计文档。

## AMR 四点录屏脚本

如果需要录制“AMR 任务执行 + Dashboard 实时刷新”的完整演示，可以使用仓库内录屏编排脚本：

```bash
chmod +x scripts/run_amr_dashboard_recording_demo.sh
./scripts/run_amr_dashboard_recording_demo.sh
```

默认行为：

- 使用上游 AMR 仓库：`/home/ina/ros2_ws/src/amr_warehouse_sim`
- 使用 Mock WMS 数据库：`/home/ina/ros2_ws/src/amr_warehouse_sim/data/mock_wms.db`
- 确保 Dashboard backend 以 `ROBOT_OPS_TASK_SOURCE=amr_http` 读取 `http://127.0.0.1:8000/tasks`
- 启动或复用前端静态页面：`http://127.0.0.1:8001/frontend/`
- 调用 AMR 仓库已有 visual demo，依次执行 `station_a station_b shelf_1 shelf_2`

录屏前建议先打开：

- `http://127.0.0.1:8001/frontend/`

常用参数：

```bash
# 复用已经启动的 navigation.launch.py 会话
./scripts/run_amr_dashboard_recording_demo.sh --skip-launch

# 不打开 Gazebo GUI / RViz，适合只看 Dashboard
./scripts/run_amr_dashboard_recording_demo.sh --headless

# 只启动/检查 AMR API、Dashboard backend 和前端，不执行任务
./scripts/run_amr_dashboard_recording_demo.sh --no-run-demo

# 指定其它 AMR 仓库或数据库
./scripts/run_amr_dashboard_recording_demo.sh \
  --amr-repo /home/ina/ros2_ws/src/amr_warehouse_sim \
  --db /home/ina/ros2_ws/src/amr_warehouse_sim/data/mock_wms.db
```

注意：

- 该脚本是 **录屏/demo 编排工具**，不是常规 dashboard 测试脚本。
- 任务执行由上游 `amr_warehouse_sim/scripts/run_mock_wms_visual_demo.sh` 完成。
- Dashboard 本身仍然只通过 HTTP 读取 `/tasks`，不直接控制 Nav2、Gazebo、电机或真实机器人。
- 如果 8000 端口已有 AMR API 但读取的不是 `data/mock_wms.db`，脚本会直接报错，避免再次出现“测试在跑，但看板盯着另一个数据库”的情况。

## HTTP Integration Verification

在 AMR Mock WMS API 和 Dashboard backend 都已经启动后，可以运行仓库内脚本验证只读 HTTP 数据链路：

```bash
chmod +x scripts/verify_amr_http_integration.sh
./scripts/verify_amr_http_integration.sh
```

默认地址：

- `AMR_API_BASE_URL=http://127.0.0.1:8000`
- `DASHBOARD_API_BASE_URL=http://127.0.0.1:9000`

如需覆盖：

```bash
AMR_API_BASE_URL=http://127.0.0.1:8000 \
DASHBOARD_API_BASE_URL=http://127.0.0.1:9000 \
./scripts/verify_amr_http_integration.sh
```

脚本会依次检查：

1. AMR API `GET /health`
2. Dashboard backend `GET /api/tasks`
3. AMR API `POST /tasks` 创建测试任务
4. Dashboard `/api/tasks` 中是否能看到该任务
5. `source` 是否表示 `amr_http`
6. `source_status=pending` 是否被映射为 `status=queued`

说明：

- 该脚本只验证 **HTTP read-only integration**
- 不控制 Nav2，不控制电机，不启动浏览器
- 前端展示是否正常仍由人工打开 `http://127.0.0.1:8001/frontend/` 确认

## 项目边界

本仓库负责的是“观察、聚合、解释、展示”，不直接承担底层控制职责。

明确不做的事情：

- 不直接控制 Nav2
- 不直接控制电机、底盘或执行器
- 不承担完整 WMS 职责
- 不承担完整 AI 平台职责

换句话说，这个仓库更像一个“机器人系统运维与测试驾驶舱”，而不是导航控制器、机器人固件平台或完整业务中台。

## 预期能力

后续版本预计围绕以下几个能力域展开：

1. 任务运维看板：任务状态、异常任务、机器人分配、任务耗时统计
2. 设备状态看板：电池、通信、传感器、底盘、安全模块等状态汇总
3. 测试验证看板：测试批次、回归结果、场景通过率、关键失败点
4. 告警中心：按严重级别聚合系统异常、设备异常和测试异常
5. AI 辅助中心：异常分类、诊断建议、视觉检测结果展示

## 仓库结构

```text
robot-ops-dashboard/
├── README.md
├── docs/
│   ├── design.md
│   ├── roadmap.md
│   ├── api_contract.md
│   ├── data_sources.md
│   ├── dashboard_pages.md
│   ├── integration_amr_http.md
│   ├── integration_mqtt_device.md
│   ├── ai_extension_plan.md
│   ├── test_plan.md
│   └── commit_convention.md
├── mock/
│   ├── sample_amr_tasks.json
│   ├── sample_device_status.json
│   └── sample_alerts.json
├── scripts/
│   ├── run_amr_dashboard_recording_demo.sh
│   └── verify_amr_http_integration.sh
├── backend/
│   ├── __init__.py
│   ├── README.md
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── config.py
│       ├── main.py
│       ├── schemas.py
│       └── services/
│           ├── __init__.py
│           ├── amr_http_service.py
│           ├── mock_data_service.py
│           └── task_mapper.py
└── frontend/
    ├── index.html
    ├── app.js
    └── styles.css
```

说明：

- `docs/` 用于沉淀设计、范围、接口契约与路线规划
- `mock/` 用于提供前后续开发、联调和演示的样例数据
- `backend/` 当前提供最小 FastAPI 只读后端骨架
- `frontend/` 当前用于本地静态只读监控页面展示

## 文档导航

- [总体设计](docs/design.md)
- [演进路线](docs/roadmap.md)
- [数据接口契约](docs/api_contract.md)
- [数据源规划](docs/data_sources.md)
- [页面规划](docs/dashboard_pages.md)
- [AMR HTTP 集成方案](docs/integration_amr_http.md)
- [MQTT / micro-ROS 集成方案](docs/integration_mqtt_device.md)
- [AI 扩展规划](docs/ai_extension_plan.md)
- [测试计划](docs/test_plan.md)
- [提交命名规范](docs/commit_convention.md)

## 适合展示的项目描述

如果后续需要用于 GitHub 首页说明或简历描述，可以概括为：

> 面向机器人系统运维、测试验证与状态监控的上层 Dashboard 设计仓库，首期围绕 `amr_warehouse_navigation` Mock WMS HTTP API 建立统一数据契约与可视化规划，并为 MQTT / micro-ROS 设备接入、机器学习异常分类、LLM 诊断建议与 YOLO 视觉结果展示预留扩展能力。
