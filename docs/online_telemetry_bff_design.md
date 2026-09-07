# Online Telemetry BFF 设计

## 范围

Stage 4 只增加只读 HTTP facade：Dashboard backend 调用
`robot-platform-service /data/v1/telemetry/latest|range`，浏览器不持有 TDengine
地址、凭据或 SQL 语义。现有 MQTT IMU 状态仍是低频即时镜像，不升级为时序事实源。

## 接口

- `GET /api/telemetry/latest`：透传 `robot_id`、`device_id`、`runtime_id`、
  `session_id`、`stream_name`。
- `GET /api/telemetry/range`：在上述参数外透传 RFC3339 `from/to`、
  `aggregation=raw|avg|min|max|count`、可选 `window` 和 `limit`。

返回体保持 Platform 的 typed telemetry query response；上游不可达时 BFF 返回明确
`502 robot_data_platform_error`，不退回 mock 数据，也不显示为在线。

## 边界与失败行为

Dashboard backend 只读，不写 telemetry/event，不连接 ROS 2/CEL1/TDengine。超时由
`ROBOT_DATA_PLATFORM_TIMEOUT_SECONDS` 控制。Platform 离线只影响展示，不改变机器人
Runtime、watchdog、device supervision 或 safety 状态。
