# 测试计划

## 1. 测试目标

虽然 V0.1 还没有前端代码和后端实现，但仍然需要为后续开发预先定义验证思路，保证文档、数据契约和 Mock 数据具备可落地性。

## 2. V0.1 测试范围

当前阶段主要验证以下内容：

- 文档之间的定位与边界是否一致
- 数据契约与 Mock 数据是否一致
- 任务、设备、告警样例是否能覆盖核心场景
- 第一阶段优先级是否明确指向 `amr_warehouse_navigation` Mock WMS HTTP API

## 3. V0.1 测试项

### 3.1 文档一致性检查

检查点：

- 是否明确写出项目定位为 Robot Operations and Testing Dashboard
- 是否明确写出当前不写前端代码、不引入框架
- 是否明确写出当前优先接入 `amr_warehouse_navigation` Mock WMS HTTP API
- 是否明确写出后续预留 MQTT / micro-ROS / ML / LLM / YOLO 能力接入
- 是否明确写出不直接控制 Nav2、不直接控制电机
- 是否明确写出不承担完整 WMS 或完整 AI 平台职责

### 3.2 Mock 数据结构检查

检查点：

- JSON 结构合法
- 字段名称与 `docs/api_contract.md` 一致
- 时间字段格式统一
- 状态枚举合理

### 3.3 场景覆盖检查

建议至少覆盖以下场景：

- 正常执行中的 AMR 任务
- 阻塞中的 AMR 任务
- 已完成 AMR 任务
- 正常在线设备
- 通信抖动设备
- 严重告警

## 4. V0.2 集成测试计划

当进入 HTTP 接入阶段后，建议增加以下测试：

- Mock WMS HTTP API 可访问性测试
- 任务字段映射正确性测试
- 任务状态归一化测试
- `GET /api/wms/tasks` proxy 转发测试
- `POST /api/wms/tasks` payload 映射与 AMR 响应透传测试
- 数据刷新与更新时间测试
- 异常请求与重试策略测试

当前后端单元测试推荐命令：

```bash
env PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest backend/tests -q
```

说明：本仓库常规测试不依赖 ROS 2、Nav2 或 Gazebo。在安装 ROS 2 的开发机上，pytest 可能自动加载系统级 ROS pytest 插件，建议用上面的命令避免外部插件影响本仓库测试结果。

## 5. V0.3 设备链路测试计划

设备接入后，建议覆盖。当前最小 MQTT 接入已先覆盖 topic 缓存与 API 映射的单元测试：

- MQTT topic 订阅正确性
- `GET /api/robot/status` 返回最新缓存状态
- 前端 IMU 区域能从 `/api/robot/status` 与 `/ws/status` 读取 `robot/imu` 最新缓存
- IMU `last_seen` 超过 3 秒显示 `stale`，超过 10 秒显示 `offline`
- `robot/motor/status` mock publisher 可向本地 broker 发布测试数据
- 消息断流后的离线判定
- micro-ROS 桥接字段映射
- 同一机器人多子系统状态聚合
- 设备告警生成正确性

## 6. V0.5 AI 扩展测试计划

AI 扩展引入后，建议重点关注：

- AI 结果结构合法性
- 置信度展示正确性
- LLM 建议与证据分离
- YOLO 检测结果与原图关联正确性
- 人工确认流程是否保留

## 7. 验收口径

当前阶段可接受的最小验收标准：

1. 文档结构完整
2. 项目边界清晰
3. 第一阶段优先链路明确且指向 AMR Mock WMS HTTP API
4. 最小 Mock WMS task proxy 具备前端表单、curl 与 backend 单元测试验证方式
5. 最小 MQTT 只读状态接入具备 API 与 mock publisher 验证方式
6. Mock 数据可被直接用于演示或后续联调

## 8. 当前阶段不测试的内容

V0.1 不测试以下内容，因为尚未实现：

- 前端交互
- 后端服务逻辑
- 真实 HTTP 接口联调
- 真实 MQTT 连接
- 真实 AI 推理结果接入
