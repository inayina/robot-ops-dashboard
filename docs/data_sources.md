# 数据源规划

## 1. 规划目标

Dashboard 的价值来自“多源汇总”。因此，V0.1 需要先明确数据从哪里来、如何接入、当前优先级是什么。

## 2. 数据源清单

| 数据源 | 上游项目/系统 | 传输方式 | 优先级 | 当前状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| AMR 任务流 / Mock WMS task | `amr_warehouse_navigation` Mock WMS API | HTTP | 最高 | 已有任务读取与最小 task creation proxy | 用于任务页、总览页、告警页、本地演示 |
| 机器人设备状态与电机联调 | `ros2-robot-digital-twin` / 本地 MQTT mock | MQTT | 高 | 已有状态接入与受限 motor command | 用于设备页、告警页、bench 联调 |
| 下位机状态 | `ros2-robot-digital-twin` / micro-ROS | micro-ROS 桥接 | 高 | 后续预留 | 用于底盘、传感器、安全模块状态 |
| 测试执行结果 | 测试脚本/验证流水线 | 文件或 HTTP | 中 | 后续规划 | 用于测试验证页 |
| AI 异常结果 | ML / LLM / YOLO 服务 | HTTP 或消息流 | 中 | 后续预留 | 用于 AI 扩展页 |
| 人工标注信息 | 运维/测试人员 | 手工录入或配置 | 低 | 后续可选 | 用于备注、确认、复盘 |

## 3. 第一阶段数据源

当前阶段只聚焦一个主数据源：

- `amr_warehouse_navigation` 的 Mock WMS HTTP API
- Dashboard backend 通过 `GET /api/wms/tasks` / `POST /api/wms/tasks` 提供最小 HTTP proxy

原因：

- 最容易构成可演示的任务主线
- 可以快速定义任务状态归一化规则
- 可以为后续告警与测试验证提供上下文主轴

## 4. 第二阶段数据源

当任务流稳定后，优先补充设备层可观测性。当前已先实现 MQTT 状态链路，并补齐低频 motor command：

- MQTT 设备状态流：订阅 `robot/state`、`robot/imu`、`robot/motor/status`、`robot/alarm`
- MQTT 电机命令流：发布 `robot/motor/cmd`
- micro-ROS 下位机状态

这两类数据会让 Dashboard 从“任务看板”升级为“系统运维看板”。

## 5. 数据接入策略

### 5.1 HTTP 数据

适合：

- 任务列表
- 任务详情
- 工位状态
- 基础业务统计

建议策略：

- 轮询拉取
- 对 Mock WMS task creation 使用显式 HTTP proxy
- 加入更新时间戳
- 映射上游状态到统一状态
- 异常请求记录成数据源健康状态

### 5.2 MQTT 数据

适合：

- 高频设备状态
- 在线离线事件
- 电池、温度、告警状态
- 子系统心跳

建议策略：

- 订阅后聚合
- 用最近一条消息构建当前状态
- 对长时间未更新的主题进行离线判定

### 5.3 micro-ROS 数据

适合：

- 下位机内部子系统状态
- MCU 或传感器侧的底层状态值
- 更细粒度的健康指标

建议策略：

- 通过桥接器转为 Dashboard 可消费的数据对象
- 避免直接把底层 topic 细节暴露给前端

## 6. 数据质量要求

建议尽早定义如下质量标准：

- 时间戳完整
- 机器人 ID / 任务 ID 可关联
- 状态枚举可归一化
- 同一对象的数据冲突可解释
- 能区分“无数据”和“离线”

## 7. 数据源边界

本仓库是数据消费与展示层，不是各数据源的业务主系统。

因此：

- 只提供最小 Mock WMS task creation proxy，不负责完整 WMS 业务单据
- 不负责驱动 Nav2 执行
- 不负责底盘级高频电机闭环控制
- 不负责承载完整 AI 推理服务

这里只负责把这些系统的关键信息聚合成统一视图。
