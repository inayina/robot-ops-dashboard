# MQTT / micro-ROS 设备接入方案

## 1. 规划目标

在 AMR HTTP 任务流打通之后，下一阶段需要接入 `ros2-robot-digital-twin` 项目的 MQTT / micro-ROS 下位机状态，让 Dashboard 具备更完整的设备可观测性。

目标包括：

- 设备在线离线监控
- 电池与底盘健康监控
- 传感器与安全模块状态监控
- 与任务流、告警流的关联分析

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

## 5. MQTT 主题建议

当前先做规划，后续可根据 `ros2-robot-digital-twin` 实际实现调整。

建议主题风格示例：

- `robots/{robot_id}/battery/status`
- `robots/{robot_id}/chassis/status`
- `robots/{robot_id}/lidar/status`
- `robots/{robot_id}/safety/status`
- `robots/{robot_id}/network/status`

说明：

- 这里只是建议主题规划，不代表真实主题已定稿
- 真正实现时应以上游项目实际 topic 为准

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
