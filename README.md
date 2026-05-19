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

当前版本已推进到 `V0.2` 的 AMR HTTP 集成，并新增最小 MQTT 设备状态接入与 Mock WMS 任务创建入口，主要能力包括：

- 支持通过 HTTP 读取 `amr_warehouse_navigation` Mock WMS 的 `/tasks` 接口（只读）
- 将上游任务映射为 Dashboard 统一 `Task` 契约，前端无需感知上游字段差异
- 新增 `GET /api/wms/tasks` 与 `POST /api/wms/tasks`，作为 AMR Mock WMS `/tasks` 的最小 HTTP proxy
- 前端新增 Mock WMS 任务创建表单和 WMS 任务列表
- 新增 Dashboard Backend 到 Frontend 的 `/ws/status` WebSocket 状态流，用于推送任务列表和机器人状态快照
- 后端启动时连接本地 MQTT broker，默认 `mqtt://127.0.0.1:1883`
- 订阅 `robot/state`、`robot/imu`、`robot/motor/status`、`robot/alarm`，并在内存中缓存最新消息
- 新增 `GET /api/robot/status` 返回最新 MQTT 机器人状态快照
- 可通过环境变量切换数据源：`ROBOT_OPS_TASK_SOURCE=mock_json|amr_http`

当前版本保留 V0.1 的基础能力，并允许通过 AMR HTTP API 创建 Mock WMS task；该能力仅限本地 Mock WMS 任务创建，不直接控制 Nav2、电机、底盘或真实机器人。

当前 **不引入前端框架，不实现 Nav2 控制、电机控制、多机器人调度、复杂 WMS 逻辑、数据库持久化、ROS 2 bridge 或 AI 平台能力**。MQTT 仅用于订阅和展示状态，不向机器人发布控制指令。WebSocket 仅用于 Dashboard Backend 向 Frontend 推送状态快照。

当前后端状态：

- 已提供 FastAPI Backend
- `/api/tasks` 可切换 `mock_json` 或 `amr_http`
- `/api/wms/tasks` 代理 AMR Mock WMS 的任务查询与创建
- `/api/device-status` 与 `/api/alerts` 当前仍可继续返回 mock 数据
- `/api/robot/status` 返回 MQTT 最新缓存状态；broker 不可用时返回 `disconnected` 连接状态
- `/ws/status` 推送统一 `dashboard_status` 消息，当前包含 `tasks`、`robot`，并在收到 MQTT 数据后带上最新 `motor` 与 `imu`

当前前端状态：

- 已提供纯 HTML / CSS / JavaScript 页面
- 使用原生 HTML / CSS / JavaScript
- 默认请求 Dashboard backend 的 `/api/tasks`、`/api/device-status`、`/api/alerts`
- 同步请求 `/api/robot/status`，用于展示 MQTT `robot/imu` 最新缓存状态
- 通过表单调用 Dashboard backend 的 `POST /api/wms/tasks` 创建 Mock WMS task
- 可手动刷新 `GET /api/wms/tasks` 任务列表
- 页面加载后连接 Dashboard backend 的 `/ws/status`
- 保留每 3 秒 HTTP 自动刷新作为 WebSocket 断开时的 fallback
- MQTT 新消息会通过现有 `/ws/status` 只读状态流推送到前端
- 新增 MPU6050 / IMU 状态区域，展示 online/offline、last_seen、accel x/y/z、gyro x/y/z、temperature 与 state
- 不提供 Nav2 控制、电机控制、多机器人调度或复杂 WMS 逻辑

当前联调脚本状态：

- 已提供 `scripts/verify_amr_http_integration.sh`
- 用于验证 `AMR Mock WMS API -> Dashboard Backend -> /api/tasks` 的 HTTP 数据映射，并创建一条 Mock WMS 测试任务确认任务可见性
- 不启动前端、不启动 uvicorn、不依赖 ROS 2 / Nav2 / Gazebo

## 第一阶段优先级

V0.1 到后续 V0.2 的首要工作，是优先对接 `amr_warehouse_navigation` 的 **Mock WMS HTTP API**，先把 AMR 任务流、任务状态和基础告警链路跑通。

在此基础上，当前已先落地最小 MQTT 只读状态接入，后续仍预留两条扩展方向：

- 扩展 `ros2-robot-digital-twin` 项目的 MQTT / micro-ROS 下位机状态数据映射
- 引入机器学习异常分类、LLM 诊断建议、YOLO 视觉检测结果展示

## Frontend Live Demo

V0.2 前端演示页支持状态监控与最小 Mock WMS 任务创建，推荐按下面顺序启动：

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
- Frontend 通过 `POST /api/wms/tasks` 创建 Mock WMS task，并通过 `GET /api/wms/tasks` 手动刷新 WMS 任务列表
- Frontend 每 3 秒保留 HTTP 自动刷新 fallback，便于录屏时观察新任务和状态变化
- 这是 **Mock WMS demo**，不提供 Nav2 控制、电机控制或真实机器人控制

### 一键启动本地 API 和页面

如果只想启动 API 和 Dashboard 页面，不想自动执行 AMR 任务，请使用：

```bash
./scripts/start_dashboard_api_stack.sh
```

它会启动或复用：

- AMR Mock WMS API：`http://127.0.0.1:8000`
- Dashboard backend：`http://127.0.0.1:9000`
- Frontend 静态页面：`http://127.0.0.1:8001/frontend/`

这个脚本不会调用 AMR visual demo，不会自动创建或执行任务。
如果 9000 端口已有 Dashboard backend，但当前 mode 不是 `amr_http`，或 `/api/tasks` 的 `source` 不匹配当前 `AMR_API_BASE_URL`，脚本会直接报错，避免页面误读旧数据源。

如果希望在 Dashboard 页面创建任务后，能在 AMR 仓库的 Gazebo/RViz 可视化里看到执行过程，请使用：

```bash
./scripts/start_dashboard_api_stack.sh --with-amr-visualization
```

这个模式会额外启动或复用：

- AMR `navigation.launch.py`
- Gazebo / RViz 可视化
- AMR HTTP executor loop

然后你在 Dashboard 页面创建 Mock WMS task 后，executor 会通过 `AMR_API_BASE_URL/tasks` 轮询并消费 pending task，向 Nav2 发送 `NavigateToPose`。它不会自动创建任务，任务仍然由页面或 curl 创建。

常用命令：

```bash
# 查看探测状态
./scripts/start_dashboard_api_stack.sh --status

# 启动 API、页面、AMR 可视化和 executor，但不自动创建任务
./scripts/start_dashboard_api_stack.sh --with-amr-visualization

# 复用已经启动的 AMR navigation.launch.py
./scripts/start_dashboard_api_stack.sh --with-amr-visualization --skip-nav-launch

# 只启动执行链路但不打开 Gazebo GUI / RViz
./scripts/start_dashboard_api_stack.sh --with-amr-visualization --headless

# 停止由该脚本启动的服务
./scripts/start_dashboard_api_stack.sh --stop

# 只启动 AMR API 和 Dashboard backend，不启动 frontend
./scripts/start_dashboard_api_stack.sh --no-frontend
```

## Mock WMS Task Create Verification

验证顺序：

1. 启动 AMR HTTP API，确保可访问：

```bash
curl --noproxy '*' http://127.0.0.1:8000/health
curl --noproxy '*' http://127.0.0.1:8000/tasks
```

2. 启动 Dashboard backend：

```bash
source .venv/bin/activate
export AMR_API_BASE_URL=http://127.0.0.1:8000
uvicorn backend.app.main:app --host 127.0.0.1 --port 9000 --reload
```

3. 启动 frontend：

```bash
python3 -m http.server 8001
```

4. 打开页面并创建任务：

- `http://127.0.0.1:8001/frontend/`
- 在 `Mock WMS` 区域选择 `pickup`、`dropoff`，点击 `创建任务`

5. 用 curl 验证 Dashboard proxy：

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/wms/tasks | python3 -m json.tool
```

6. 也可以直接通过 Dashboard backend 创建任务：

```bash
curl --noproxy '*' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"task_type":"transport","pickup":"start_zone","dropoff":"station_a"}' \
  http://127.0.0.1:9000/api/wms/tasks | python3 -m json.tool
```

说明：

- Dashboard backend 只把请求转发到 AMR Mock WMS HTTP API，不写数据库。
- `pickup` 当前用于 Dashboard 生成 `task_name` 和前端展示；上游 Mock WMS 当前实际执行目标来自 `dropoff -> target_name`。
- 如果上游拒绝某个目标点，例如当前 AMR Mock WMS 不接受 `start_zone` 作为 target，Dashboard 会返回上游错误。

## MQTT Robot Status

Dashboard backend 会在启动时尝试连接本地 MQTT broker：

- 默认 broker：`mqtt://127.0.0.1:1883`
- 可覆盖环境变量：`MQTT_BROKER_URL=mqtt://127.0.0.1:1883`
- 订阅 topic：`robot/state`、`robot/imu`、`robot/motor/status`、`robot/alarm`
- 缓存位置：backend 进程内存，不写数据库
- HTTP 接口：`GET /api/robot/status`

推荐启动顺序：

1. 启动本地 MQTT broker，例如：

```bash
mosquitto -p 1883
```

2. 启动 Dashboard backend：

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 9000 --reload
```

3. 在另一个终端启动 mock motor publisher：

```bash
source .venv/bin/activate
python3 scripts/mock_mqtt_motor_status_publisher.py --broker mqtt://127.0.0.1:1883 --interval 1
```

验证命令：

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/robot/status | python3 -m json.tool
```

如果安装了 `mosquitto-clients`，也可以观察原始 topic：

```bash
mosquitto_sub -h 127.0.0.1 -t 'robot/#' -v
```

说明：

- MQTT 当前只消费状态，不发布控制指令。
- broker 未启动时，backend 仍可启动，`/api/robot/status` 会显示 MQTT 连接状态为 `disconnected` 或 `connecting`。
- 前端已有 `/ws/status`，收到 MQTT 新消息后 backend 会通过该 WebSocket 推送新的 `dashboard_status` 快照。

## WebSocket Status Stream

Dashboard backend 提供只读 WebSocket 状态流：

- Endpoint：`/ws/status`
- 方向：Dashboard Backend -> Frontend
- 数据来源：复用 Dashboard backend 既有 HTTP adapter、mock device status 与 MQTT 最新缓存，不让前端直连 AMR API、ROS 2 或 ESP32
- 作用：向前端推送任务列表、机器人状态快照和 MQTT 设备状态更新

消息结构：

```json
{
  "type": "dashboard_status",
  "timestamp": "2026-05-18T10:00:00+00:00",
  "tasks": [],
  "robot": {
    "mqtt": {}
  },
  "motor": {
    "robot_id": "amr-001",
    "status": "online"
  },
  "imu": null
}
```

说明：

- `/api/tasks`、`/api/device-status`、`/api/alerts` 继续保留，验证脚本仍通过 HTTP 验证。
- `motor` 与 `imu` 来自 MQTT 最新缓存；尚未收到对应 topic 时返回 `null`。
- 前端 IMU 区域同时复用 `/api/robot/status` 与 `/ws/status`；按 `robot/imu` 最新 `received_at` 判断 freshness：超过 3 秒显示 `stale`，超过 10 秒显示 `offline`。
- IMU 区域只展示状态，不新增控制按钮，不向 MQTT broker 发布消息。

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
- Dashboard 本身只通过 HTTP API 读取或创建 Mock WMS task，不直接控制 Nav2、Gazebo、电机或真实机器人。
- 如果 8000 端口已有 AMR API 但读取的不是 `data/mock_wms.db`，脚本会直接报错，避免再次出现“测试在跑，但看板盯着另一个数据库”的情况。

## HTTP Integration Verification

在 AMR Mock WMS API 和 Dashboard backend 都已经启动后，可以运行仓库内脚本验证 HTTP 数据映射与 Mock WMS task creation 链路：

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

- 该脚本会创建一条上游 Mock WMS 测试任务，仅用于本地 Mock WMS 验证。
- 不控制 Nav2，不控制电机，不启动浏览器
- 前端展示是否正常仍由人工打开 `http://127.0.0.1:8001/frontend/` 确认

## 项目边界

本仓库负责的是“观察、聚合、解释、展示”，并提供最小 Mock WMS 任务创建 proxy，不直接承担底层控制职责。

明确不做的事情：

- 不直接控制 Nav2
- 不直接控制电机、底盘或执行器
- 不通过 MQTT 下发任务或控制指令
- 不做多机器人调度
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
│   ├── wms_task_proxy_design.md
│   ├── ai_extension_plan.md
│   ├── test_plan.md
│   └── commit_convention.md
├── mock/
│   ├── sample_amr_tasks.json
│   ├── sample_device_status.json
│   └── sample_alerts.json
├── scripts/
│   ├── mock_mqtt_motor_status_publisher.py
│   ├── run_amr_dashboard_recording_demo.sh
│   ├── start_dashboard_api_stack.sh
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
│           ├── mqtt_robot_status.py
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
- `backend/` 当前提供最小 FastAPI 后端、AMR HTTP adapter、Mock WMS task proxy 与 MQTT 状态缓存
- `frontend/` 当前用于本地静态监控页面与 Mock WMS task 创建

## 文档导航

- [总体设计](docs/design.md)
- [演进路线](docs/roadmap.md)
- [数据接口契约](docs/api_contract.md)
- [数据源规划](docs/data_sources.md)
- [页面规划](docs/dashboard_pages.md)
- [AMR HTTP 集成方案](docs/integration_amr_http.md)
- [MQTT / micro-ROS 集成方案](docs/integration_mqtt_device.md)
- [WMS 任务下发 Proxy 设计](docs/wms_task_proxy_design.md)
- [AI 扩展规划](docs/ai_extension_plan.md)
- [测试计划](docs/test_plan.md)
- [提交命名规范](docs/commit_convention.md)

## 适合展示的项目描述

如果后续需要用于 GitHub 首页说明或简历描述，可以概括为：

> 面向机器人系统运维、测试验证与状态监控的上层 Dashboard，围绕 `amr_warehouse_navigation` Mock WMS HTTP API 与本地 MQTT 状态 topic 建立监控和 Mock task 创建链路，并为 micro-ROS 设备接入、机器学习异常分类、LLM 诊断建议与 YOLO 视觉结果展示预留扩展能力。
