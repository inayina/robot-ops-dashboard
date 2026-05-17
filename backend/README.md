# Backend V0.1

## 目标

`backend/` 提供 `robot-ops-dashboard` 的最小 Python FastAPI 后端骨架。

当前版本只负责：

- 读取 `mock/` 目录下的 JSON 文件
- 通过只读 HTTP API 返回任务、设备状态和告警数据
- 通过只读 WebSocket 向前端推送 Dashboard 状态快照
- 为后续本地静态前端或前端框架接入提供统一入口

当前版本明确不做：

- 不修改 `amr_warehouse_navigation`
- 不接 MQTT
- 不接数据库
- 不接 ML / LLM / YOLO
- 不直接控制 Nav2
- 不直接控制电机
- 不改动其他仓库

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
│       ├── mock_data_service.py
│       └── task_mapper.py
└── tests/
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

## 接口列表

- `GET /health`
- `GET /api/tasks`
- `GET /api/device-status`
- `GET /api/alerts`
- `WebSocket /ws/status`

## 接口说明

### `GET /health`

返回服务状态与当前运行模式。

### `GET /api/tasks`

读取并返回：

- 默认读取 `mock/sample_amr_tasks.json`（`ROBOT_OPS_TASK_SOURCE=mock_json`）
- 可切换到 AMR HTTP 只读模式：设置 `ROBOT_OPS_TASK_SOURCE=amr_http`，并配置 `AMR_API_BASE_URL`。

注意：V0.2 为只读集成，Dashboard 不会向上游下发任务或修改任务状态。

### `GET /api/device-status`

读取并返回：

- `mock/sample_device_status.json`

### `GET /api/alerts`

读取并返回：

- `mock/sample_alerts.json`

### `WebSocket /ws/status`

推送 Dashboard 只读状态快照：

- `tasks` 复用 `/api/tasks` 的数据源配置与映射逻辑
- `robot` 当前由 `mock/sample_device_status.json` 聚合得到
- `motor` 当前固定为 `null`
- `imu` 当前固定为 `null`

示例消息：

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

注意：该 WebSocket 仅存在于 Dashboard Backend -> Frontend，不连接 AMR API、ROS 2、MQTT、ESP32 或真实硬件。

## 错误处理

当前版本包含两类基础错误返回：

- Mock JSON 文件不存在
- Mock JSON 内容解析失败
- 上游 AMR HTTP 请求失败 / 超时 / 返回非 200
- 上游任务映射失败或返回结构不符合 Dashboard 契约

错误返回会包含：

- `error_type`
- `detail`
- `path`

## CORS

当前版本已开启基础 CORS 配置，允许后续本地前端访问。

V0.1 采用宽松策略，便于本地联调；后续如果进入真实部署阶段，再按环境收紧来源配置。
