# Backend V0.1

## 目标

`backend/` 提供 `robot-ops-dashboard` 的最小 Python FastAPI 后端骨架。

当前版本只负责：

- 读取 `mock/` 目录下的 JSON 文件
- 通过只读 HTTP API 返回任务、设备状态和告警数据
- 为后续本地静态前端或前端框架接入提供统一入口

当前版本明确不做：

- 不接真实 `amr_warehouse_navigation` Mock WMS HTTP API
- 不接 MQTT
- 不接 WebSocket
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
└── app/
    ├── __init__.py
    ├── config.py
    ├── main.py
    ├── schemas.py
    └── services/
        ├── __init__.py
        └── mock_data_service.py
```

## 依赖安装

建议在仓库根目录执行：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## 启动命令

在仓库根目录执行：

```bash
uvicorn backend.app.main:app --reload
```

启动后默认访问地址：

- `http://127.0.0.1:8000`

## 接口列表

- `GET /health`
- `GET /api/tasks`
- `GET /api/device-status`
- `GET /api/alerts`

## 接口说明

### `GET /health`

返回服务状态与当前运行模式。

### `GET /api/tasks`

读取并返回：

- `mock/sample_amr_tasks.json`

### `GET /api/device-status`

读取并返回：

- `mock/sample_device_status.json`

### `GET /api/alerts`

读取并返回：

- `mock/sample_alerts.json`

## 错误处理

当前版本包含两类基础错误返回：

- Mock JSON 文件不存在
- Mock JSON 内容解析失败

错误返回会包含：

- `error_type`
- `detail`
- `path`

## CORS

当前版本已开启基础 CORS 配置，允许后续本地前端访问。

V0.1 采用宽松策略，便于本地联调；后续如果进入真实部署阶段，再按环境收紧来源配置。
