# MQTT / micro-ROS 设备接入方案

## 1. 规划目标

在 AMR HTTP 任务流打通之后，下一阶段需要接入 `ros2-robot-digital-twin` 项目的 MQTT / micro-ROS 下位机状态，让 Dashboard 具备更完整的设备可观测性。

目标包括：

- 设备在线离线监控
- 电池与底盘健康监控
- 传感器与安全模块状态监控
- 与任务流、告警流的关联分析

## 1.1 当前最小实现

当前仓库已实现最小 MQTT 只读接入，用于本地验证设备状态链路：

- Backend 启动时连接 MQTT broker，默认 `mqtt://127.0.0.1:1883`
- 订阅 `robot/state`、`robot/imu`、`robot/motor/status`、`robot/alarm`
- 将每个 topic 的最新消息缓存在 backend 进程内存中
- 提供 `GET /api/robot/status` 返回最新缓存状态
- 如果前端连接了 `/ws/status`，MQTT 新消息会触发新的 `dashboard_status` 快照推送
- 前端 MPU6050 / IMU 区域复用 `/api/robot/status` 与 `/ws/status` 展示 `robot/imu` 最新状态
- 提供 `scripts/mock_mqtt_motor_status_publisher.py` 模拟发布 `robot/motor/status`

该实现仍属于 `read-only monitoring`，不发布控制指令，不控制 Nav2、电机或真实机器人，不做数据库持久化。

## 2. 适用范围

本方案主要针对以下数据：

- MQTT 主题中的设备状态消息
- micro-ROS 上报的底层控制器与传感器状态
- 由桥接器转换后的统一状态对象

## 3. 接入原则

### 3.1 订阅与展示，不直接控制

本仓库后续可以消费 MQTT / micro-ROS 数据，但不直接承担：

- 电机控制
- 执行器控制
- Nav2 控制
- 下位机配置与烧录

### 3.2 统一映射到 DeviceStatus

无论消息来自 MQTT 还是 micro-ROS，最终都建议映射到统一的 `DeviceStatus` 对象。

### 3.3 优先保留时间戳与来源

设备状态很容易出现延迟、丢包和抖动，因此必须保留：

- 消息时间
- 最近接收时间
- 来源 topic 或节点
- 通信状态判断结果

## 4. 建议承接的设备子系统

建议优先覆盖以下子系统：

- `battery`
- `chassis_controller`
- `lidar`
- `safety_controller`
- `imu`
- `motor_driver`
- `wireless_bridge`

## 5. MQTT 主题

当前最小实现已订阅以下固定 topic：

- `robot/state`
- `robot/imu`
- `robot/motor/status`
- `robot/alarm`

后续可根据 `ros2-robot-digital-twin` 实际实现扩展更细粒度的 topic。

建议主题风格示例：


- `robots/{robot_id}/battery/status`
- `robots/{robot_id}/chassis/status`
- `robots/{robot_id}/lidar/status`
- `robots/{robot_id}/safety/status`
- `robots/{robot_id}/network/status`

说明：

- 当前四个 `robot/...` topic 用于最小本地联调。
- 扩展到多机器人或更多子系统时，应优先补充设计文档，再调整接口契约。

## 6. micro-ROS 状态承接建议

micro-ROS 侧更适合提供底层子系统细粒度状态，例如：

- 电机驱动反馈
- 编码器或里程计状态
- MCU 心跳
- 电流、电压、温度等原始指标

建议不要把原始 micro-ROS topic 直接暴露给前端，而是通过桥接器转为统一对象。

## 7. 通信状态判断建议

建议在 Dashboard 层统一判断通信状态：

- `online`：近期持续收到消息
- `intermittent`：有消息但抖动明显或更新时间超阈值
- `offline`：长时间未收到消息

当前前端对 MPU6050 / IMU 的展示规则：

- 数据来源为 MQTT `robot/imu` 最新缓存，HTTP 读取 `/api/robot/status`，实时更新复用 `/ws/status`
- 展示字段包括 online/offline、last_seen、accel x/y/z、gyro x/y/z、temperature 与 state
- 以 backend 缓存消息的 `received_at` 作为 `last_seen`
- 超过 3 秒没有新 IMU 消息时显示 `stale`
- 超过 10 秒没有新 IMU 消息时显示 `offline`
- 该区域只读展示，不提供控制按钮，也不向 MQTT broker 发布消息

这部分逻辑后续是设备告警的重要来源。

## 8. 与任务链路的联动

设备状态接入后，可以与任务数据形成联动，例如：

- 任务阻塞时检查底盘控制器或激光雷达状态
- 任务失败时关联低电量或通信中断
- 机器人离线时直接影响任务可分配状态

这会让 Dashboard 从“任务列表”升级为“问题定位工具”。

## 9. 与 Mock 数据的关系

V0.1 中，设备链路使用 `mock/sample_device_status.json` 作为占位数据结构样例。

后续实现时建议保持：

1. MQTT 原始消息
2. micro-ROS 原始状态
3. Dashboard 归一化设备状态

三层之间的清晰映射关系。
