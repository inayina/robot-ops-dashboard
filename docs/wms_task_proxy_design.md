# WMS 任务下发 Proxy 设计

## 文档状态

本文件描述的 Mock WMS task proxy 已在当前代码中实现。

`POST /api/wms/tasks` 当前用于本地演示和接口映射验证，但它确实是当前可用功能，而不是单纯保留中的草案。

## 1. 目标

在 Dashboard 中新增一个最小 Mock WMS 任务创建入口，用于本地演示：

- 前端填写任务参数
- Dashboard backend 作为 HTTP proxy 转发到 AMR Mock WMS HTTP API
- AMR Mock WMS API 创建任务
- 前端通过只读列表查看任务

该能力只面向 Mock WMS task 创建，不代表 Dashboard 具备 Nav2、电机、底盘或真实机器人控制能力。

## 2. 范围

本次实现：

- 新增 `GET /api/wms/tasks`
- 新增 `POST /api/wms/tasks`
- 前端新增最小任务表单与 WMS 任务列表
- 复用 `AMR_API_BASE_URL`，默认 `http://127.0.0.1:8000`

本次不实现：

- MQTT 任务下发或 MQTT 控制
- 真实电机控制
- Nav2 控制
- 多机器人调度
- 数据库持久化
- 登录认证
- 云端部署

## 3. Backend 边界

Dashboard backend 只做 HTTP proxy / aggregation：

- `GET /api/wms/tasks` 转发到 `GET {AMR_API_BASE_URL}/tasks`
- `POST /api/wms/tasks` 接收 `pickup`、`dropoff`、`task_type`
- 后端将 `dropoff` 映射为上游当前需要的 `target_name`
- 后端生成一个 `task_name` 用于保留 Dashboard 创建来源与表单信息
- 返回 AMR API 的原始响应

Dashboard backend 不保存任务，不维护队列，不直接修改 AMR API 的既有接口。

## 4. 请求示例

Dashboard 前端向 backend 发送：

```json
{
  "task_type": "transport",
  "pickup": "start_zone",
  "dropoff": "station_a"
}
```

Backend 转发到 AMR Mock WMS API：

```json
{
  "target_name": "station_a",
  "task_name": "dashboard_transport_start_zone_to_station_a_20260519T120000Z"
}
```

说明：

- `pickup` 当前只用于 Dashboard 任务名和前端展示，不改变上游 Mock WMS API 契约。
- `dropoff` 对应 AMR Mock WMS 当前的 `target_name`。
- 如果上游拒绝某个目标点，backend 原样返回可读错误状态。

## 5. 前端行为

前端新增：

- `task_type` 输入，默认 `transport`
- `pickup` 下拉：`station_a`、`station_b`、`dock_a`、`start_zone`
- `dropoff` 下拉：`station_a`、`station_b`、`dock_a`、`start_zone`
- 创建按钮：调用 `POST /api/wms/tasks`
- 手动刷新按钮：调用 `GET /api/wms/tasks`
- 任务列表：展示 task id、pickup、dropoff、status、created_at、updated_at

## 6. 与 MQTT 的关系

MQTT 保持只读状态接入，只用于设备状态观察：

- 不通过 MQTT 发布任务
- 不通过 MQTT 控制电机
- 不通过 MQTT 改变机器人行为

## 7. 验证口径

最小验证：

1. AMR Mock WMS HTTP API 已启动
2. Dashboard backend 已启动
3. 前端页面可通过表单创建任务
4. `curl http://127.0.0.1:9000/api/wms/tasks` 能看到上游任务列表
5. backend 测试可用 mock AMR service 验证 GET/POST proxy 行为
