# AMR HTTP 集成方案

## 1. 集成目标

当前第一阶段优先对接 `amr_warehouse_navigation` 的 **Mock WMS HTTP API**。

目标不是实现机器人控制，而是把 AMR 任务流观察链路和最小 Mock WMS task creation 链路打通，为 Dashboard 提供：

- 任务列表
- 任务状态
- 任务异常
- 机器人与任务关联关系
- 面向总览页的任务统计
- 面向本地演示的 Mock WMS 任务创建入口

## 2. 集成原则

### 2.1 监控优先，Mock 任务创建保持显式

第一阶段优先读取和展示。当前允许 Dashboard backend 通过 HTTP proxy 创建 AMR Mock WMS task，但该能力不等同于机器人控制。

明确不做：

- 不从本仓库直接控制 Nav2
- 不从本仓库直接发起机器人动作
- 不把 Dashboard 做成调度系统
- 不承担完整 WMS 的业务编排或工单管理职责
- 不通过 MQTT 下发任务

### 2.2 先统一模型，再对接页面

即使上游 API 字段后续调整，也先映射到 Dashboard 的统一 `Task` 模型，再供页面使用。

### 2.3 允许 Mock 先行

在未完全掌握上游真实接口细节前，允许先按文档契约使用 Mock 数据推进页面和联调准备。

## 3. 第一阶段建议接入的数据能力

至少需要覆盖以下能力：

1. 任务列表查询
2. 单任务状态查询
3. 任务生命周期关键时间点
4. 任务与机器人关联关系
5. 任务异常或阻塞原因
6. 最小 Mock WMS task creation proxy

如果上游还提供以下能力，则可进一步增强：

- 工位状态
- 机器人位置摘要
- 任务事件历史
- 任务优先级

## 4. 建议的数据映射

| 上游概念 | Dashboard 统一字段 | 说明 |
| --- | --- | --- |
| WMS 任务号 | `task_id` | Dashboard 主键 |
| 业务单号 | `order_id` | 可用于业务追溯 |
| 机器人编号 | `robot_id` | 任务归属机器人 |
| 任务状态 | `source_status` | 保留上游原始状态 |
| 归一化状态 | `status` | 用于页面统一展示 |
| 任务进度 | `progress` | 优先使用上游 `progress` / `percent`；缺失时按 `status` 推导 |
| 起点工位 | `pickup_station` | 任务起始位置 |
| 终点工位 | `dropoff_station` | 任务目标位置 |
| 更新时间 | `updated_at` | 用于新鲜度判断 |
| 阻塞原因 | `blocked_reason` | 用于告警与详情 |

## 5. 状态归一化建议

建议把上游各种任务状态归一到以下枚举：

- `queued`
- `dispatching`
- `running`
- `blocked`
- `completed`
- `failed`
- `cancelled`

这样后续不管上游如何命名，都能在 Dashboard 层维持稳定展示逻辑。

当上游 Mock WMS 没有提供显式进度字段时，Dashboard backend 会按归一化状态生成展示进度：

| `status` | `progress` |
| --- | --- |
| `queued` | `0` |
| `dispatching` | `20` |
| `running` | `50` |
| `blocked` | `50` |
| `completed` | `100` |
| `failed` | `100` |
| `cancelled` | `100` |

该进度只用于看板展示，不代表 Dashboard 对任务执行链路有控制能力。

## 6. 数据拉取建议

建议采用轮询方式：

- 开发/演示阶段：5 到 10 秒轮询
- 后续按系统负载和延迟要求调整

每次拉取时建议记录：

- 拉取时间
- 成功/失败状态
- 结果条数
- 接口耗时

这些信息后续可作为“数据源健康状态”的输入。

## 6.1 Mock WMS Task Creation Proxy

Dashboard backend 新增：

- `GET /api/wms/tasks`：转发到 `GET {AMR_API_BASE_URL}/tasks`
- `POST /api/wms/tasks`：接收 `task_type`、`pickup`、`dropoff`，转发到 `POST {AMR_API_BASE_URL}/tasks`

上游 AMR Mock WMS 当前创建任务需要：

```json
{
  "target_name": "station_a",
  "task_name": "dashboard_transport_start_zone_to_station_a_20260519T120000Z"
}
```

Dashboard 前端使用：

```json
{
  "task_type": "transport",
  "pickup": "start_zone",
  "dropoff": "station_a"
}
```

映射规则：

- `dropoff` -> `target_name`
- `task_type`、`pickup`、`dropoff` -> `task_name`

该 proxy 不保存任务，不实现调度，不控制 Nav2、电机或真实机器人。

## 7. 告警生成建议

基于 AMR HTTP 任务流，可以先做最基础的任务类告警：

- 任务长时间未推进
- 任务阻塞
- 任务失败
- 任务分配异常
- 数据源请求失败

## 8. 与 Mock 数据的关系

V0.1 中，建议以 `mock/sample_amr_tasks.json` 作为联调占位数据。

这样可以让后续实现时做到：

1. 先基于 Mock 数据开发和演示
2. 再把 HTTP 拉取结果映射为同样结构
3. 页面无需感知数据是来自 Mock 还是来自真实接口

## 9. 风险与待确认项

后续需要与上游确认的内容包括：

- Mock WMS API 的真实接口路径
- 认证方式
- 是否存在分页
- 时间字段格式
- 是否有任务事件历史接口
- 是否有机器人状态补充接口

在这些信息未完全确认前，本仓库先以统一契约和 Mock 数据作为推进基线。

## 10. 配置与运行

- 在 Dashboard backend 中通过环境变量控制数据源：
	- `ROBOT_OPS_TASK_SOURCE`：`mock_json`（默认）或 `amr_http`
	- `AMR_API_BASE_URL`：上游 AMR Mock WMS 地址，默认 `http://127.0.0.1:8000`
	- `AMR_HTTP_TIMEOUT_SECONDS`：上游请求超时秒数，默认 `3`

示例：启动 Dashboard 并连接本地 AMR mock

```bash
export ROBOT_OPS_TASK_SOURCE=amr_http
export AMR_API_BASE_URL=http://127.0.0.1:8000
uvicorn backend.app.main:app --port 9000
```

注意：除 `POST /api/wms/tasks` 这个显式 Mock WMS task creation proxy 外，Dashboard 仍只拉取并映射任务数据；该 proxy 不直接控制 Nav2、电机或真实机器人。
