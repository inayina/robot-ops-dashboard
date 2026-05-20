# 电机 MQTT 控制最小闭环设计

## 目标

在保持 Dashboard backend 不直接依赖 ROS 2 的前提下，补齐一条最小电机控制闭环：

```text
frontend
  -> POST /api/robot/motor/cmd
  -> backend publish MQTT robot/motor/cmd
  -> ROS2-MQTT bridge
  -> ROS 2 /motor/cmd
  -> ESP32 / motor task
```

同时保留现有状态上报链路：

```text
ESP32 /motor/status
  -> ROS2-MQTT bridge
  -> MQTT robot/motor/status
  -> backend cache
  -> /api/robot/status + /ws/status
  -> frontend
```

## 边界

- frontend 不直接连接 ROS 2。
- frontend 不直接连接 MQTT。
- backend 只通过 HTTP 提供控制入口，并通过 MQTT 发布控制消息。
- backend 不处理编码器原始脉冲。
- ROS 2 topic 与 MQTT topic 的互转由 `robot-state-monitor-v1` 中的 `robot_mqtt_bridge` 负责。

## 命令契约

Dashboard backend 发布 MQTT topic：`robot/motor/cmd`

建议 payload：

```json
{
  "robot_id": "amr-001",
  "source": "dashboard_backend",
  "command_id": "motor-cmd-20260520T120000Z",
  "issued_at": "2026-05-20T12:00:00Z",
  "target_rpm": 120.0,
  "enabled": true,
  "closed_loop": true,
  "max_pwm": 0.25,
  "timeout_ms": 800,
  "stop": false
}
```

## 安全约束

- `stop` 优先级最高；一旦为 `true`，下游必须停车。
- `enabled=false` 时，不允许持续输出驱动。
- `max_pwm` 必须在 backend 先做一次约束，再由下游再次约束。
- `timeout_ms` 必须在 backend 先做一次约束，再由下游再次约束。
- Dashboard 只提供低频人机控制，不承担实时闭环。

## 前端变更

Motor 卡片新增：

- `enable` 开关
- `target_rpm` 输入
- `max_pwm` 输入
- `timeout_ms` 输入
- `Apply` / `Stop` 按钮

继续展示：

- `target_rpm`
- `measured_rpm`
- `pwm`
- `error_rpm`
- `enabled`
- `closed_loop`
- `fault`

## 验证

- `POST /api/robot/motor/cmd` 能返回已发布 payload
- backend 测试可在无 ROS 2 / 无真实硬件条件下通过 mock 验证
- 前端在 backend 不可用时显示错误，不白屏
