# 数据接口契约

## 1. 目标

本文件描述 `robot-ops-dashboard` 的统一数据契约，用于隔离上游数据源差异。

V0.1 只定义契约与 Mock 数据，不实现真实接口。后续无论数据来自 HTTP、MQTT、micro-ROS 还是 AI 服务，都建议先映射到本文档定义的统一结构。

## 2. 接口风格

建议采用只读查询接口，面向 Dashboard 展示层输出：

- `GET /api/v0/summary`
- `GET /api/v0/tasks`
- `GET /api/v0/device-status`
- `GET /api/v0/alerts`
- `GET /api/v0/ai-insights`

说明：

- `V0.1` 仅为建议契约，不代表已实现
- 本仓库当前阶段不提供控制类接口
- 不提供 Nav2 控制、电机控制或任务下发能力

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

## 8. 设计原则

统一契约需要坚持以下原则：

1. 优先只读，不设计控制接口
2. 统一模型优先于上游原始字段
3. 原始状态需要保留 `source_status`
4. AI 输出必须携带证据与置信度
5. 所有告警对象都应能回溯到源对象

## 9. 与项目边界的关系

本文档定义的是 Dashboard 的展示型数据契约，不代表本仓库承担以下职责：

- Nav2 控制平面
- 电机控制平面
- 完整 WMS 业务接口
- 完整 AI 训练与推理平台接口
