# 当前仓库范围说明

更新时间：`2026-05-21`

## 1. 当前默认口径

`robot-ops-dashboard` 当前仍以 monitoring-first 为主，但文档需要反映当前代码已经实现的显式交互能力。

这意味着：

- Dashboard 的首要职责是读取、聚合、展示任务与设备状态。
- Dashboard 是观察与监控层，不是机器人控制器。
- AMR 集成边界保持在 HTTP API 层。
- Dashboard backend 不直接依赖 ROS 2、Nav2 或 Gazebo。
- 前端继续保持纯 HTML / CSS / JavaScript。
- 网络失败、上游不可用或 MQTT broker 未连接时，前端必须明确显示 `disconnected` 或错误状态，不能白屏。
- 如需影响上游或下游行为，必须通过显式 HTTP 接口触发，不能出现隐藏副作用。

## 2. 当前已实现接口

当前代码已实现以下接口：

- `GET /health`
- `GET /api/tasks`
- `GET /api/device-status`
- `GET /api/alerts`
- `GET /api/robot/status`
- `GET /api/wms/tasks`
- `POST /api/wms/tasks`
- `POST /api/robot/motor/cmd`
- `WebSocket /ws/status`

其中：

- `/api/tasks` 支持 `mock_json` 与 `amr_http` 两种任务数据源。
- `/api/robot/status` 只返回 backend 内存中的 MQTT 最新缓存。
- `/api/wms/tasks` 是对上游 Mock WMS `/tasks` 的最小 HTTP proxy。
- `/api/robot/motor/cmd` 会把命令规范化后发布到 MQTT `robot/motor/cmd`，用于低频受限电机控制。

## 3. 当前交互边界

虽然代码已经实现任务创建 proxy 和 motor command，但当前边界仍然受限：

- 不提供 Nav2 控制能力。
- 不提供底盘级高频闭环控制。
- 不提供多机器人调度能力。
- 前端不直接连接 ROS 2 或 MQTT。
- motor command 更适合本地 bench / dashboard 联调，不应被表述为完整机器人控制平面。

## 4. 文档阅读建议

当前阅读仓库文档时，建议按以下优先级理解：

1. 本文件与根目录 `AGENTS.md`
2. 根目录 `README.md`
3. `backend/README.md`
4. `docs/` 下的设计与集成文档

`docs/` 中若有文档仍保留更旧的只读表述，应以本文件、根目录 `README.md` 和当前代码实现为准。
