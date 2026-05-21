# Backend V0.2

## 目标

`backend/` 提供 `robot-ops-dashboard` 的最小 Python FastAPI 后端骨架。

当前 backend 仍以监控聚合为主线，但当前代码已经实现两类显式交互能力：

- `POST /api/wms/tasks`：创建上游 Mock WMS task
- `POST /api/robot/motor/cmd`：发布低频 MQTT 电机命令

建议优先把 backend 理解为：

- 读取 `mock/` 目录下的 JSON 文件
- 通过 HTTP API 返回任务、设备状态和告警数据
- 通过 HTTP adapter 读取上游 AMR API 并映射为 Dashboard 统一任务模型
- 通过 MQTT 订阅机器人状态 topic，并在内存中缓存最新消息
- 通过 MQTT 发布受限的 motor command
- 为纯静态前端提供统一入口

当前版本明确不做：

- 不修改 `amr_warehouse_navigation`
- 不接数据库
- 不接 ML / LLM / YOLO
- 不直接控制 Nav2
- 不提供底盘级或真实机器人高频闭环控制
- 不做多机器人调度或复杂 WMS 逻辑
- 不改动其他仓库

补充说明：

- `POST /api/wms/tasks`、`POST /api/robot/motor/cmd`、`/ws/status` 都是当前代码已实现的能力。
- 其中 motor command 适合本地 demo / bench 联调，但不应被表述为完整控制平面。
- 如果文档之间存在冲突，以根目录 `AGENTS.md` 与 [docs/current_scope.md](/home/ina/workspace/robot-ops-dashboard/docs/current_scope.md) 为准。

## 目录结构

```text
backend/
├── __init__.py
├── README.md
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── main.py
│   ├── schemas.py
│   └── services/
│       ├── __init__.py
│       ├── amr_http_service.py
│       ├── mqtt_motor_command.py
│       ├── mqtt_robot_status.py
│       ├── mock_data_service.py
│       └── task_mapper.py
└── tests/
    ├── test_motor_command_api.py
    ├── test_mqtt_robot_status.py
    ├── test_task_mapper.py
    └── test_tasks_api.py
```

## 依赖安装

建议在仓库根目录执行：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## 本地启动

在仓库根目录执行：

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 9000 --reload
```

如果你已经 `cd backend`，则可以执行：

```bash
source ../.venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 9000 --reload
```

启动后自检：

```bash
curl --noproxy '*' http://127.0.0.1:9000/health
curl --noproxy '*' http://127.0.0.1:9000/api/tasks
curl --noproxy '*' http://127.0.0.1:9000/api/device-status
curl --noproxy '*' http://127.0.0.1:9000/api/alerts
curl --noproxy '*' http://127.0.0.1:9000/api/robot/status
```

启动后默认访问地址：

- `http://127.0.0.1:9000` (recommended for V0.2 when running alongside the AMR mock)

说明：

- 如果 shell 设置了 `http_proxy` / `https_proxy`，手工 `curl` 本机地址时建议显式加 `--noproxy '*'`
- Backend 请求本机 `127.0.0.1` 上游时默认不继承代理环境，避免本地联调被 SOCKS/HTTP proxy 干扰

## 联调命令

### `mock_json` 模式

```bash
source .venv/bin/activate
export ROBOT_OPS_TASK_SOURCE=mock_json
uvicorn backend.app.main:app --host 127.0.0.1 --port 9000 --reload
```

```bash
curl --noproxy '*' http://127.0.0.1:9000/health
curl --noproxy '*' http://127.0.0.1:9000/api/tasks
```

### `amr_http` 模式

确保上游 Mock WMS 已经在 `http://127.0.0.1:8000` 提供：

- `GET /health`
- `GET /tasks`

然后在仓库根目录执行：

```bash
source .venv/bin/activate
export ROBOT_OPS_TASK_SOURCE=amr_http
export AMR_API_BASE_URL=http://127.0.0.1:8000
export AMR_HTTP_TIMEOUT_SECONDS=3
uvicorn backend.app.main:app --host 127.0.0.1 --port 9000 --reload
```

联调验证：

```bash
curl --noproxy '*' http://127.0.0.1:8000/health
curl --noproxy '*' http://127.0.0.1:8000/tasks
curl --noproxy '*' http://127.0.0.1:9000/health
curl --noproxy '*' http://127.0.0.1:9000/api/tasks
```

`/api/tasks` 在 `amr_http` 模式下会请求上游 `http://127.0.0.1:8000/tasks`，并将原始任务映射为 Dashboard Task 契约后返回。

### WMS task proxy

Dashboard backend 提供最小 Mock WMS 任务创建 proxy：

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/wms/tasks | python3 -m json.tool
```

```bash
curl --noproxy '*' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"task_type":"transport","pickup":"start_zone","dropoff":"station_a"}' \
  http://127.0.0.1:9000/api/wms/tasks | python3 -m json.tool
```

说明：

- `GET /api/wms/tasks` 转发到上游 `GET /tasks`。
- `POST /api/wms/tasks` 接收 `task_type`、`pickup`、`dropoff`，并转为上游当前接受的 `target_name` 与 `task_name`。
- 该 proxy 不写数据库，不通过 MQTT 下发任务，不控制 Nav2 或电机。

### MQTT 状态接入

Backend 启动时会尝试连接 MQTT broker：

- 默认地址：`mqtt://127.0.0.1:1883`
- 覆盖方式：`MQTT_BROKER_URL=mqtt://127.0.0.1:1883`
- 订阅 topic：`robot/state`、`robot/imu`、`robot/motor/status`、`robot/alarm`

启动本地 broker 后，可以用仓库内 mock publisher 模拟 `robot_status_api_bridge` 的电机状态镜像：

```bash
source .venv/bin/activate
python3 scripts/mock_mqtt_motor_status_publisher.py --interval 1
```

验证最新缓存：

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/robot/status | python3 -m json.tool
```

说明：

- 默认状态链路会订阅和展示 MQTT 数据，不写数据库。
- `robot/motor/status` 当前对齐 `/home/ina/Documents/PlatformIO/Projects/robot-state-monitor-v1/ros2/robot_status_api_bridge`，包含 `status`、`actual_rpm`、`motor_state`、`freshness`、`last_update_time`。
- `motor_state` 当前是 ROS 2 `/motor/state` 的原始 JSON 字符串，前端只做容错解析与展示；它不是远程启动电机、设置 PWM 或下发运动目标的接口。
- `POST /api/robot/motor/cmd` 会额外向 MQTT `robot/motor/cmd` 发布规范化后的低频命令，用于本地联调与 bench 控制。

## 接口列表

当前已实现接口：

- `GET /health`
- `GET /api/tasks`
- `GET /api/device-status`
- `GET /api/alerts`
- `GET /api/robot/status`
- `GET /api/wms/tasks`
- `POST /api/wms/tasks`
- `POST /api/robot/motor/cmd`
- `WebSocket /ws/status`

## 接口说明

### `GET /health`

返回服务状态与当前运行模式。

### `GET /api/tasks`

读取并返回：

- 默认读取 `mock/sample_amr_tasks.json`（`ROBOT_OPS_TASK_SOURCE=mock_json`）
- 可切换到 AMR HTTP 只读模式：设置 `ROBOT_OPS_TASK_SOURCE=amr_http`，并配置 `AMR_API_BASE_URL`。

注意：`/api/tasks` 仍是 Dashboard Task 契约读取接口；Mock WMS task 创建请使用 `/api/wms/tasks`。

### `GET /api/device-status`

读取并返回：

- `mock/sample_device_status.json`

### `GET /api/alerts`

读取并返回：

- `mock/sample_alerts.json`

### `GET /api/robot/status`

返回 backend 内存中缓存的最新 MQTT 机器人状态：

- `connection`：MQTT broker 连接状态
- `topics`：每个订阅 topic 的最新消息，未收到时为 `null`
- `robot.state`：来自 `robot/state`
- `robot.imu`：来自 `robot/imu`
- `robot.motor_status`：来自 `robot/motor/status`，当前用于展示 `robot_status_api_bridge` 输出的电机状态镜像
- `robot.alarm`：来自 `robot/alarm`

### `POST /api/robot/motor/cmd`

该接口用于发布低频受限的电机控制命令：

- 接收前端电机命令表单参数
- 由 backend 做限幅和安全字段补全
- 发布到 MQTT `robot/motor/cmd`
- 返回最终发布的规范化 payload

当前请求体字段：

- `target_rpm`
- `enabled`
- `closed_loop`
- `max_pwm`
- `timeout_ms`
- `stop`

当前规范化规则：

- `target_rpm` 会被限制到 `[-MOTOR_CMD_MAX_ABS_RPM, MOTOR_CMD_MAX_ABS_RPM]`
- `max_pwm` 会被限制到 `[0, MOTOR_CMD_MAX_PWM_LIMIT]`
- `timeout_ms` 会被限制到 `[MOTOR_CMD_MIN_TIMEOUT_MS, MOTOR_CMD_MAX_TIMEOUT_MS]`
- `stop=true` 时会强制把 `target_rpm` 置为 `0`
- backend 自动补充 `robot_id`、`source=dashboard_backend`、`command_id`、`issued_at`

该接口适合本地 bench / dashboard 联调，但不表示 backend 已承担高频闭环控制职责。

### `GET /api/wms/tasks`

转发到 AMR Mock WMS API 的 `GET /tasks`，返回上游任务列表响应。

### `POST /api/wms/tasks`

接收前端任务参数：

```json
{
  "task_type": "transport",
  "pickup": "start_zone",
  "dropoff": "station_a"
}
```

转发到 AMR Mock WMS API 的 `POST /tasks`：

```json
{
  "target_name": "station_a",
  "task_name": "dashboard_transport_start_zone_to_station_a_20260519T120000Z"
}
```

返回 AMR API 的原始响应和状态码。

### `WebSocket /ws/status`

推送 Dashboard 只读状态快照：

- `tasks` 复用 `/api/tasks` 的数据源配置与映射逻辑
- `robot` 由 `mock/sample_device_status.json` 与 MQTT 最新设备状态聚合得到
- `motor` 来自 MQTT `robot/motor/status` 最新缓存，未收到时为 `null`
- `imu` 来自 MQTT `robot/imu` 最新缓存，未收到时为 `null`

示例消息：

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
    "status": "ok",
    "actual_rpm": 118.25,
    "motor_state": "{\"target_rpm\":120.0,\"actual_rpm\":118.25,\"error_rpm\":1.75,\"pwm_duty\":0.4,\"direction\":1,\"control_enabled\":1,\"saturated\":0,\"timeout\":0,\"estop\":0,\"fault\":0,\"source\":\"target_rpm\",\"loop\":42}",
    "freshness": {
      "actual_rpm": {
        "topic": "/motor/actual_rpm",
        "status": "ok"
      },
      "motor_state": {
        "topic": "/motor/state",
        "status": "ok"
      }
    },
    "last_update_time": "2026-05-18T10:00:00Z"
  },
  "imu": null
}
```

注意：该 WebSocket 仅存在于 Dashboard Backend -> Frontend，用于推送状态快照。`motor` 当前用于 Motor / Encoder 状态卡片展示 `robot_status_api_bridge` 输出；电机命令发布走独立的 `POST /api/robot/motor/cmd`，而不是通过 WebSocket 下发。

## 错误处理

当前版本包含两类基础错误返回：

- Mock JSON 文件不存在
- Mock JSON 内容解析失败
- 上游 AMR HTTP 请求失败 / 超时 / 返回非 200
- 上游任务映射失败或返回结构不符合 Dashboard 契约
- AMR Mock WMS task proxy 创建失败时，返回 `amr_wms_proxy_error`
- MQTT broker 未启动或暂时断开时，`/api/robot/status` 返回连接状态，不影响其它只读接口启动

错误返回会包含：

- `error_type`
- `detail`
- `path`

## CORS

当前版本已开启基础 CORS 配置，允许后续本地前端访问。

V0.1 采用宽松策略，便于本地联调；后续如果进入真实部署阶段，再按环境收紧来源配置。
