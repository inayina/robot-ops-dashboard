# 数据接口契约

## 1. 目标

本文件描述 `robot-ops-dashboard` 的统一数据契约，用于隔离上游数据源差异。

当前阅读口径：

- 当前主线仍是监控聚合
- 当前代码已实现 WMS task proxy、motor command、WebSocket 等显式接口
- 本文档需要同时描述只读监控契约和受限交互契约

后续无论数据来自 HTTP、MQTT、micro-ROS 还是 AI 服务，都建议先映射到本文档定义的统一结构。

## 2. 接口风格

建议优先采用只读查询接口，面向 Dashboard 展示层输出；同时允许少量显式交互接口承接本地演示和受限控制需求。

当前已实现的监控接口：

- `GET /health`
- `GET /api/tasks`
- `GET /api/device-status`
- `GET /api/alerts`
- `GET /api/robot/status`

当前已实现的显式交互接口：

- `GET /api/v0/summary`
- `GET /api/v0/tasks`
- `GET /api/v0/device-status`
- `GET /api/v0/alerts`
- `GET /api/wms/tasks`
- `POST /api/wms/tasks`
- `POST /api/robot/motor/cmd`
- `GET /api/v0/ai-insights`
- `WebSocket /ws/status`

说明：

- `GET /api/v0/...` 仍是早期建议命名，不代表当前已实现
- 当前代码不提供 Nav2 控制或完整机器人控制平面
- `POST /api/wms/tasks` 仅用于创建上游 AMR Mock WMS task，不承担多机器人调度或完整 WMS 逻辑
- `POST /api/robot/motor/cmd` 当前已实现，用于低频受限电机控制
- `/ws/status` 仅用于 Dashboard Backend 向 Frontend 推送状态快照，不替代 HTTP REST API
- `/api/robot/status` 为 MQTT 状态读取接口，只返回 backend 内存中缓存的最新消息

## 3. 通用响应结构

建议统一使用如下响应外壳：

```json
{
  "generated_at": "2026-05-16T09:00:00+08:00",
  "source": "mock",
  "data": []
}
```

对象型接口可将 `data` 替换为对象。

## 4. 任务对象 Task

### 4.1 字段定义

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_id` | string | 任务唯一标识 |
| `order_id` | string | 上游业务单号或工单号 |
| `robot_id` | string\|null | 执行机器人 ID |
| `task_type` | string | 任务类型，如搬运、补货、巡检 |
| `priority` | string | `low` / `normal` / `high` / `urgent` |
| `status` | string | `queued` / `dispatching` / `running` / `blocked` / `completed` / `failed` / `cancelled` |
| `source_status` | string | 上游系统原始状态 |
| `progress` | number | 0 到 100 的进度值 |
| `pickup_station` | string\|null | 起点工位 |
| `dropoff_station` | string\|null | 终点工位 |
| `created_at` | string | 创建时间 |
| `assigned_at` | string\|null | 分配时间 |
| `started_at` | string\|null | 开始时间 |
| `updated_at` | string | 最近更新时间 |
| `due_at` | string\|null | 期望完成时间 |
| `blocked_reason` | string\|null | 阻塞原因 |
| `last_event` | string\|null | 最近事件描述 |
| `labels` | array | 标签列表 |

### 4.2 对应 Mock 文件

- `mock/sample_amr_tasks.json`

### 4.3 进度展示规则

如果上游数据源提供 `progress` 或 `percent` 字段，Dashboard backend 应优先使用上游进度，并将其限制在 `0` 到 `100` 范围内。

如果上游没有提供显式进度，Dashboard backend 可以按归一化任务状态推导展示进度：

| `status` | `progress` |
| --- | --- |
| `queued` | `0` |
| `dispatching` | `20` |
| `running` | `50` |
| `blocked` | `50` |
| `completed` | `100` |
| `failed` | `100` |
| `cancelled` | `100` |

该字段只用于只读看板展示，不表示 Dashboard 具备任务调度或机器人控制能力。

## 5. 设备状态对象 DeviceStatus

### 5.1 字段定义

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `device_id` | string | 设备或子系统唯一标识 |
| `robot_id` | string\|null | 所属机器人 ID |
| `subsystem` | string | 子系统名，如 `battery`、`lidar`、`chassis_controller` |
| `device_type` | string | 设备类型 |
| `transport` | string | `http` / `mqtt` / `micro_ros` / `manual` |
| `comm_status` | string | `online` / `intermittent` / `offline` |
| `health_status` | string | `healthy` / `warning` / `critical` / `unknown` |
| `firmware_version` | string\|null | 固件版本 |
| `last_seen_at` | string | 最近看到数据的时间 |
| `metrics` | object | 设备指标集合 |
| `alarms` | array | 当前子系统关联告警关键词 |
| `labels` | array | 标签列表 |

### 5.2 对应 Mock 文件

- `mock/sample_device_status.json`

## 6. 告警对象 Alert

### 6.1 字段定义

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `alert_id` | string | 告警唯一标识 |
| `level` | string | `info` / `warning` / `critical` |
| `category` | string | `task` / `device` / `network` / `test` / `ai` |
| `title` | string | 告警标题 |
| `description` | string | 告警描述 |
| `status` | string | `open` / `acknowledged` / `resolved` |
| `source_type` | string | 告警来源类型 |
| `source_ref` | string\|null | 来源对象引用 |
| `related_robot_id` | string\|null | 关联机器人 ID |
| `related_task_id` | string\|null | 关联任务 ID |
| `triggered_at` | string | 触发时间 |
| `updated_at` | string | 更新时间 |
| `suggested_action` | string\|null | 建议动作 |
| `evidence` | array | 证据列表 |
| `labels` | array | 标签列表 |

### 6.2 对应 Mock 文件

- `mock/sample_alerts.json`

## 7. AI 洞察对象 AiInsight

该对象在未来版本中启用，建议保留如下结构：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `insight_id` | string | 洞察唯一标识 |
| `insight_type` | string | `ml_classification` / `llm_suggestion` / `yolo_detection` |
| `title` | string | 洞察标题 |
| `summary` | string | 简要说明 |
| `confidence` | number | 置信度 |
| `related_robot_id` | string\|null | 关联机器人 |
| `related_task_id` | string\|null | 关联任务 |
| `evidence` | array | 图片、日志、数值片段等证据 |
| `generated_at` | string | 生成时间 |
| `requires_human_review` | boolean | 是否需要人工确认 |

## 8. WMS Task Proxy

`GET /api/wms/tasks` 转发到 AMR Mock WMS API 的 `GET /tasks`，返回上游任务列表响应。

`POST /api/wms/tasks` 接收 Dashboard 前端任务参数：

```json
{
  "task_type": "transport",
  "pickup": "start_zone",
  "dropoff": "station_a"
}
```

Backend 转发到 AMR Mock WMS API 的 `POST /tasks`：

```json
{
  "target_name": "station_a",
  "task_name": "dashboard_transport_start_zone_to_station_a_20260519T120000Z"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_type` | string | 前端任务类型，默认 `transport` |
| `pickup` | string | 前端选择的起点，当前用于生成 `task_name` 与展示 |
| `dropoff` | string | 前端选择的终点，映射为上游 `target_name` |

说明：

- 当前可选点位：`station_a`、`station_b`、`dock_a`、`start_zone`。
- 如果上游 AMR Mock WMS 不接受某个 `target_name`，Dashboard 返回上游错误。
- 该接口不写数据库，不通过 MQTT 下发任务，不控制 Nav2 或电机。

## 9. WebSocket 状态消息 DashboardStatus

`/ws/status` 当前推送如下结构。`motor` 与 `imu` 来自 MQTT 最新缓存，尚未收到对应 topic 时为 `null`：

```json
{
  "type": "dashboard_status",
  "timestamp": "2026-05-18T10:00:00+00:00",
  "tasks": [],
  "robot": {
    "status": "warning",
    "source": "mock_mqtt_micro_ros",
    "generated_at": "2026-05-16T09:00:00+08:00",
    "devices": [],
    "summary": {
      "total": 0,
      "online": 0,
      "intermittent": 0,
      "offline": 0,
      "warning": 0,
      "critical": 0
    }
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

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 固定为 `dashboard_status` |
| `timestamp` | string | 状态快照生成时间 |
| `tasks` | array | Dashboard Task 列表，复用 `/api/tasks` 的映射结果 |
| `robot` | object | 机器人状态聚合，当前由 mock device status 与 MQTT 最新设备状态聚合得到 |
| `motor` | object\|null | MQTT `robot/motor/status` 最新 payload，当前对齐 `robot-state-monitor-v1` 的 `robot_status_api_bridge` 输出 |
| `imu` | object\|null | MQTT `robot/imu` 最新 payload |

前端 MPU6050 / IMU 区域会同时读取顶层 `imu` 和 `robot.mqtt.topics["robot/imu"]`。其中 `received_at` 用于展示 `last_seen` 并计算 freshness：超过 3 秒显示 `stale`，超过 10 秒显示 `offline`。

前端 Motor / Encoder 区域会读取顶层 `motor` 或 `robot.mqtt.topics["robot/motor/status"].payload`。当前展示 Wheel Speed / 轮端等效速度，并保留 `target_rpm`、`actual_rpm` / `measured_rpm`、`error_rpm`、`pwm_duty` / `pwm` 等调试字段。Wheel Speed 按 `wheel_diameter_m=0.065` 从 rpm 换算：`speed_mps = rpm * Math.PI * wheel_diameter_m / 60`。该速度是 single N20 motor bench 的轮端等效速度，不是 Robot Speed / 整车速度。页面提供保守的 Wheel Speed slider，拖动只更新 UI，点击 `Apply` 后才通过 `POST /api/robot/motor/cmd` 下发；不直接连接 MQTT / ROS 2 / ESP32 / TB6612，也不直接下发 PWM。

## 9.1 MQTT RobotStatus

`GET /api/robot/status` 返回 backend 内存中缓存的最新 MQTT 状态。

```json
{
  "generated_at": "2026-05-19T10:00:00+00:00",
  "source": "mqtt:mqtt://127.0.0.1:1883",
  "connection": {
    "status": "connected",
    "broker_url": "mqtt://127.0.0.1:1883",
    "error": null,
    "last_connected_at": "2026-05-19T09:59:59+00:00",
    "last_disconnected_at": null,
    "last_message_at": "2026-05-19T10:00:00+00:00"
  },
  "topics": {
    "robot/state": null,
    "robot/imu": null,
    "robot/motor/status": {
      "topic": "robot/motor/status",
      "received_at": "2026-05-19T10:00:00+00:00",
      "payload": {
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
        "last_update_time": "2026-05-19T10:00:00Z"
      },
      "payload_raw": "{\"robot_id\":\"amr-001\",\"status\":\"ok\",\"actual_rpm\":118.25}"
    },
    "robot/alarm": null
  },
  "robot": {
    "state": null,
    "imu": null,
    "motor_status": {
      "robot_id": "amr-001",
      "status": "ok",
      "actual_rpm": 118.25
    },
    "alarm": null,
    "devices": []
  }
}
```

说明：

- 当前订阅 topic 固定为 `robot/state`、`robot/imu`、`robot/motor/status`、`robot/alarm`。
- 该接口本身只读，不写数据库；电机控制由独立的 `POST /api/robot/motor/cmd` 承担。
- broker 未连接时，`connection.status` 会显示 `disconnected` 或 `connecting`，各 topic 可为 `null`。
- 前端 IMU 区域复用 `topics["robot/imu"].received_at` 作为 `last_seen`，并从 `robot.imu` 或该 topic 的 `payload` 读取 accel x/y/z、gyro x/y/z、temperature 与 state。
- 前端 Motor / Encoder 区域复用 `topics["robot/motor/status"].received_at`、payload `last_update_time` 或 `freshness.*.last_received_time` 作为 freshness 时间；无真实 topic 时保留 null / placeholder 状态。

## 10. 设计原则

统一契约需要坚持以下原则：

1. 状态数据优先通过只读接口暴露，写入或控制能力必须走显式接口
2. 统一模型优先于上游原始字段
3. 原始状态需要保留 `source_status`
4. AI 输出必须携带证据与置信度
5. 所有告警对象都应能回溯到源对象

## 11. 与项目边界的关系

本文档定义的是 Dashboard 的展示型数据契约，不代表本仓库承担以下职责：

- Nav2 控制平面
- 完整电机控制平面
- 完整 WMS 业务接口
- 完整 AI 训练与推理平台接口
