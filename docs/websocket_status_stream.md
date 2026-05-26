# WebSocket 状态推送设计

## 目标

本设计用于在 `robot-ops-dashboard` 内新增 Dashboard Backend 到 Frontend 的状态推送层。

该能力只服务前端实时展示，不替代现有 HTTP REST API，也不改变 Dashboard Backend 读取 AMR Mock WMS HTTP API 的方式。

## 范围

当前实现范围：

- 新增 `GET` 风格的 WebSocket 连接入口：`/ws/status`
- 由 Dashboard Backend 周期性推送任务列表和机器人状态快照
- MQTT 新消息到达时，Dashboard Backend 通过同一连接推送新的状态快照
- 前端页面加载后连接该状态流，并在收到消息时刷新任务列表和设备状态区域
- 前端 MPU6050 / IMU 区域复用状态流中的 `imu` 与 `robot.mqtt.topics["robot/imu"]` 最新缓存
- 保留现有 HTTP 轮询作为 fallback

当前不纳入范围：

- 不新增机器人控制接口
- 不新增 `POST /tasks`
- 不接入 ROS 2、Nav2、Gazebo 或 ESP32
- 不通过 WebSocket 发布控制指令
- 不修改 `amr_warehouse_navigation` 或 `ros2-robot-digital-twin`

## 数据来源

WebSocket 状态流仍通过 Dashboard Backend 内部既有读取逻辑获得数据：

- `tasks` 使用 `/api/tasks` 相同的数据源配置与任务映射逻辑
- `robot` 当前由 `mock/sample_device_status.json` 与 MQTT 最新设备状态聚合得到
- `motor` 来自 MQTT `robot/motor/status` 最新缓存，未收到时为 `null`
- `imu` 来自 MQTT `robot/imu` 最新缓存，未收到时为 `null`

因此，AMR 集成边界仍保持在 HTTP API 层。

## 消息结构

`/ws/status` 推送统一消息：

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

## 失败行为

- WebSocket 断开时，前端显示轻量 `disconnected` 状态。
- 前端继续通过现有 HTTP polling 读取 `/api/tasks`、`/api/device-status` 和 `/api/alerts`。
- 前端继续通过 `/api/robot/status` 读取 MQTT `robot/imu` 最新缓存，作为 IMU 区域的 HTTP fallback。
- 前端继续通过 `/api/robot/status` 读取 MQTT `robot/motor/status` 最新缓存，作为 Motor / Encoder 状态区域的 HTTP fallback；无真实 topic 时保持 null / placeholder。
- 如果后端生成状态快照时无法读取上游 AMR HTTP API，WebSocket 发送错误状态快照，不对上游产生写入或控制副作用。
- 如果 MQTT broker 未连接，`robot.mqtt.connection.status` 会显示 `disconnected` 或 `connecting`，不会影响 AMR HTTP 查询接口。
- IMU 区域按 `robot/imu` 最新 `received_at` 判断状态：超过 3 秒无新消息显示 `stale`，超过 10 秒显示 `offline`。
- 电机控制仍走独立的 `POST /api/robot/motor/cmd`，不会复用 `/ws/status`。

## 后续集成预留

后续如接入真实机器人状态，应优先新增独立设计文档，再逐步实现：

- `robot_status_api_bridge`
- `motor_state`
- `imu_state`
