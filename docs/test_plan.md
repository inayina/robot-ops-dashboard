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
- 是否明确写出不直接控制 Nav2、但当前已实现受限 motor command
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
- `POST /api/robot/motor/cmd` payload 限幅与 publish 调用测试
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
- 前端静态检查：`node --check frontend/app.js`
- 前端布局稳定性检查：打开前端观察 30 秒，确认 `/ws/status` 刷新时 `System Health`、`AMR Task Status`、`IMU Status`、`Motor / Encoder`、`Event Stream` 卡片顺序、位置和高度不跳动
- IMU 实时刷新检查：当 `last_message_at` 持续刷新时，仅数字、状态灯、水平条和姿态方块变化，Roll/Pitch/Yaw 保持固定三行占位
- `robot/motor/status` mock publisher 可向本地 broker 发布对齐 `robot_status_api_bridge` 的测试数据，前端能解析 `motor_state` JSON 字符串
- 前端 Motor / Encoder 表单能调用 `POST /api/robot/motor/cmd`
- `stop=true` 时 backend 返回的 published payload 会强制 `target_rpm=0`
- 消息断流后的离线判定
- micro-ROS 桥接字段映射
- `scripts/start_microros_sensor_stack.sh` 可启动 micro-ROS agent 与 ROS 2 -> MQTT bridge，并保持 Dashboard backend 只通过 MQTT 读取状态
- `scripts/start_microros_sensor_stack.sh --check` 可在不启动进程的情况下验证脚本语法、bridge 编译、micro-ROS Agent、ROS 2 topic 与 MQTT broker 可用性
- 端到端验证 IMU -> Dashboard 状态推送链路：
  1. 启动 Dashboard backend 和 MQTT broker
  2. 运行 `./scripts/start_microros_sensor_stack.sh`
  3. 复位 ESP32-S3，让其通过 micro-ROS / Wi-Fi UDP 连接 PC micro-ROS Agent
  4. 确认 `ros2 topic hz /imu/data` 正常；如使用滤波数据，确认 `ros2 topic hz /imu/filtered` 正常
  5. 确认 `mosquitto_sub -h 127.0.0.1 -t robot/imu -v` 能收到 PC bridge 镜像后的 IMU 数据
  6. 确认 `curl --noproxy '*' http://127.0.0.1:9000/api/robot/status` 能看到 `robot.imu` 和 `topics["robot/imu"].received_at`
  7. 确认前端通过 `/ws/status` 刷新 IMU freshness
  8. 确认 Dashboard 仍不下发 `/cmd_vel`；如启用 motor command，仅通过 `POST /api/robot/motor/cmd` -> MQTT `robot/motor/cmd` 这条显式链路发布低频命令
- 同一机器人多子系统状态聚合
- 设备告警生成正确性

## 6. V0.5 AI 扩展测试计划

AI 扩展引入后，建议重点关注：

- AI 结果结构合法性
- 置信度展示正确性
- LLM 建议与证据分离
- YOLO 检测结果与原图关联正确性
- 人工确认流程是否保留

## 7. 作品集 Evaluation 层测试计划

当前已新增只读 evaluation API 与前端 `Data & Evaluation Layer`，测试重点是防止 mock/baseline/reserved 数据被误读为真实训练结果。

### 7.1 Mock JSON 合法性

```bash
python3 -m json.tool mock/sample_evaluation_runs.json >/dev/null
python3 -m json.tool mock/sample_dataset_versions.json >/dev/null
python3 -m json.tool mock/sample_model_versions.json >/dev/null
python3 -m json.tool mock/sample_failure_cases.json >/dev/null
python3 -m json.tool mock/sample_compute_usage.json >/dev/null
```

检查点：

- `run_type` 只出现 `mock_evaluation`、`baseline_system_evaluation`、`interface_reserved`。
- `vla_interface_reserved` 的 `training_status` 必须是 `reserved_only`。
- 无真实 GPU 采样时，`gpu_status=not_connected`，GPU 数值字段为 `null`。

### 7.2 API 验证

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/runs | python3 -m json.tool
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/datasets | python3 -m json.tool
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/models | python3 -m json.tool
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/failure-cases | python3 -m json.tool
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/compute | python3 -m json.tool
```

检查点：

- 所有接口为只读 `GET`。
- 响应沿用 `generated_at`、`source`、`data` envelope。
- 接口不触发 WMS task creation，不发布 MQTT，不依赖 ROS 2 / Nav2 / Gazebo。

### 7.3 前端展示验证

```bash
node --check frontend/app.js
npm run capture:screenshots
```

检查点：

- 首页首屏 cockpit 不被 evaluation 区域挤乱。
- 第二屏 `Data & Evaluation Layer` 能看到 `run_id`、`dataset_version`、`model_version`、任务成功率、失败样本与 GPU 状态。
- 页面明确显示 `baseline`、`mock`、`reserved`、`not_connected` 等标签。
- backend 不可用时，前端显示 disconnected 或明确错误状态，不白屏。

## 8. 验收口径

当前阶段可接受的最小验收标准：

1. 文档结构完整
2. 项目边界清晰
3. 第一阶段优先链路明确且指向 AMR Mock WMS HTTP API
4. 最小 Mock WMS task proxy 具备前端表单、curl 与 backend 单元测试验证方式
5. MQTT 状态接入具备 API 与 mock publisher 验证方式
6. `POST /api/robot/motor/cmd` 具备 payload 限幅、stop 优先级和 publish 错误处理测试
7. Evaluation mock 数据和 API 可被直接用于作品集展示
8. Evaluation 页面明确区分 mock、baseline 与 reserved，不虚构真实训练结果

## 9. 当前阶段不测试的内容

V0.1 不测试以下内容，因为尚未实现：

- 前端交互
- 后端服务逻辑
- 真实 HTTP 接口联调
- 真实 MQTT 连接
- 真实 AI 推理结果接入
- 真实 VLA / RL / world model 训练结果
- 真实 GPU 训练任务或 GPU 利用率采样
