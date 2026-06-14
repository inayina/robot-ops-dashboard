# 全流程软硬联调 Demo 计划

本文用于准备作品集中的“机器人数据链路与评测平台”全流程截图、录屏和总结材料。执行原则是先做可验证、可复现、边界清楚的联调展示，不虚构真实训练结果、真实整车结果或未完成的机器人能力。

当前计划只描述演示与验证流程；真实硬件、电机 bench、Gazebo / RViz / Nav2 等运行步骤必须由人工确认后再执行。

## 1. 当前仓库能力盘点

### 1.1 `amr_warehouse_navigation`

作用：提供 ROS 2 / Gazebo / Nav2 / Mock WMS 仿真任务链路，负责 AMR 任务状态、导航结果和 task result。

已经具备：

- ROS 2 / Gazebo / Nav2 仿真导航链路。
- Mock WMS HTTP API，可提供 task 创建、查询和状态回写。
- Mock WMS executor / task runner，可消费任务并驱动 Nav2 仿真执行。
- task result writeback，可把导航结果回写到 Mock WMS task 状态。

真实完成：

- Mock WMS API、任务创建/查询、Nav2 仿真执行和任务状态回写属于当前作品集可展示主线。
- 实际展示前仍需在该仓库本地运行验证 `/health`、`/tasks`、Nav2 lifecycle、`/navigate_to_pose` 和 task result。

mock / reserved / planned：

- 商业 WMS、多机器人调度、真实仓储系统接入不作为当前完成项。
- 不把 Gazebo 仿真结果包装成真实小车运行结果。
- 不宣称 Dashboard 直接控制 Nav2。

边界：

- `robot-ops-dashboard` 只通过 HTTP API 集成 AMR Mock WMS。
- 不把 ROS 2 / Nav2 / Gazebo 代码复制进 Dashboard 仓库。

### 1.2 `ros2-robot-digital-twin`

作用：提供 STM32 / ESP32-S3 / micro-ROS / MQTT / IMU / Motor / Encoder 硬件状态链路。当前硬件口径是 N20 编码器单电机闭环 bench。

已经具备：

- STM32 + MPU6050 到 ESP32-S3 的 IMU / robot state 上行链路。
- ESP32-S3 micro-ROS 到 PC ROS 2 topic 的桥接链路。
- ROS 2 topic 到 MQTT 的只读状态镜像链路。
- Motor / Encoder bench 状态回传链路。
- Dashboard 显式 motor command 经 MQTT / ROS 2 bridge 下发的低频受限 bench 链路。

真实完成：

- IMU、robot state、motor status 可经 ROS 2 / MQTT 镜像到 Dashboard。
- 当前可展示的是 N20 编码器单电机 bench，不是完整底盘。
- motor command 只通过 Dashboard backend 的 `POST /api/robot/motor/cmd`，由 backend 限幅并补齐安全字段。

mock / reserved / planned：

- 真实双轮小车、长期稳定整车运动、完整底盘闭环、完整 `ros2_control` 不作为当前完成项。
- 不虚构真实小车结果。
- 不把单电机 bench 的 wheel speed 说成整车速度。

边界：

- 不自动刷板。
- 不自动修改 PlatformIO 配置。
- 不自动启动电机长时间运行。
- 真实硬件运行前必须人工确认供电、固定方式和停止方式。

### 1.3 `robot-ops-dashboard`

作用：FastAPI / MQTT / WebSocket / Dashboard / System Evaluation & Validation Layer 统一展示入口。

已经具备：

- REST API：
  - `GET /health`
  - `GET /api/tasks`
  - `GET /api/wms/tasks`
  - `POST /api/wms/tasks`
  - `GET /api/robot/status`
  - `POST /api/robot/motor/cmd`
  - `GET /api/evaluation/summary`
  - `GET /api/evaluation/runs`
  - `GET /api/evaluation/datasets`
  - `GET /api/evaluation/models`
  - `GET /api/evaluation/failure-cases`
  - `GET /api/evaluation/compute`
- WebSocket：
  - `WebSocket /ws/status`
- 前端：
  - 纯 HTML / CSS / JavaScript cockpit。
  - Task / Robot Link / IMU / Motor / Event Stream。
  - System Evaluation & Validation Layer。
- MQTT：
  - 订阅 `robot/imu`、`robot/state`、`robot/motor/status`、`robot/alarm`。
  - 发布 `robot/motor/cmd`，仅用于低频受限 bench 命令。

真实完成：

- FastAPI backend、MQTT topic 缓存、WebSocket 推送和纯静态前端已经落地。
- AMR HTTP adapter 已能通过配置读取上游 Mock WMS API。
- Evaluation Summary 和 mock/baseline/reserved 数据展示已经落地。

mock / reserved / planned：

- evaluation 数据是 `mock_evaluation`、`baseline_system_evaluation` 或 `interface_reserved`。
- 不宣称真实 VLA / RL / world model 训练结果。
- 无真实 GPU 接入时必须显示 `not_connected`、`N/A` 或 reserved 口径。

边界：

- Dashboard 是运维与测试驾驶舱，不是 Nav2 控制台。
- Dashboard 不是完整 WMS、完整 AI 训练平台或底盘级控制器。
- IMU、robot state 与设备遥测保持只读镜像。
- motor bench 只允许显式、低频、受限的人机命令。

## 2. 全流程联调目标

本次 Demo 目标是展示三条真实系统链路和一个只读 evaluation 展示层。

AMR 仿真任务链路：

```text
AMR Mock WMS task
  -> Nav2 / Gazebo task execution
  -> task result writeback
  -> Dashboard GET /api/tasks
  -> frontend Current Task Execution
```

IMU / robot state 遥测链路：

```text
STM32 / ESP32-S3 IMU + robot state
  -> micro-ROS
  -> ROS 2 topics
  -> MQTT robot/imu, robot/state
  -> Dashboard GET /api/robot/status + WebSocket /ws/status
  -> frontend IMU / Robot Link
```

Motor / Encoder bench 链路：

```text
Dashboard explicit motor cmd
  -> POST /api/robot/motor/cmd
  -> MQTT robot/motor/cmd
  -> ROS 2 /motor/cmd
  -> N20 motor bench
  -> robot/motor/status
  -> Dashboard Motor / Encoder
```

Evaluation 展示闭环：

```text
mock / baseline eval run data
  -> GET /api/evaluation/summary and /api/evaluation/*
  -> Evaluation Summary
  -> System Evaluation & Validation Layer
```

最终画面需要让面试官看到：

- task 从上游 AMR API 进入 Dashboard。
- 硬件 IMU / Motor 状态经 MQTT / WebSocket 到达前端。
- Evaluation Summary 能把 `run_id`、`dataset_version`、`model_version`、success rate、failure cases、quality checks、compute 状态放在一个只读视图里。
- 所有 mock / baseline / reserved 项都被明确标注。

## 3. 建议启动顺序

1. AMR WMS API / Mock task API
   - 默认地址：`http://127.0.0.1:8000`
   - 用途：`/health`、`/tasks`、任务创建、任务状态回写。

2. MQTT broker
   - 默认地址：`127.0.0.1:1883`
   - 用途：承接 `robot/imu`、`robot/state`、`robot/motor/status`、`robot/motor/cmd`。

3. micro-ROS Agent
   - 默认 UDP 端口：`8888`
   - 仅在真实 ESP32-S3 已准备好时启动。
   - 若只做 dashboard mock/evaluation 截图，可跳过。

4. ROS 2 to MQTT bridge
   - IMU bridge：ROS 2 IMU topic -> `robot/imu`
   - robot state bridge：`/robot/state` -> `robot/state`
   - motor status bridge：`/motor/status` -> `robot/motor/status`
   - motor cmd bridge：`robot/motor/cmd` -> `/motor/cmd`

5. Dashboard backend
   - 默认地址：`http://127.0.0.1:9000`
   - 推荐环境变量：

```bash
export ROBOT_OPS_TASK_SOURCE=amr_http
export AMR_API_BASE_URL=http://127.0.0.1:8000
export MQTT_BROKER_URL=mqtt://127.0.0.1:1883
```

6. Dashboard frontend
   - 默认地址：`http://127.0.0.1:8001/frontend/`
   - 前端默认连接 `http://127.0.0.1:9000` 的 API / WebSocket。

7. 可选 Gazebo / RViz / Nav2
   - 仅用于展示 AMR 仿真画面、路径和 task result。
   - 不属于 Dashboard backend 依赖项。

8. 可选 motor bench / IMU data
   - 只有在人工确认供电、固定方式和停止方式后才运行真实硬件。
   - 若只做作品集静态截图，可使用已存在 mock / baseline 数据。

## 4. 安全边界

本次 Demo 准备过程必须遵守：

- 不自动刷板。
- 不自动修改 PlatformIO 配置。
- 不自动启动长时间电机运行。
- 不自动启动会影响硬件安全的命令。
- 不绕过 `POST /api/robot/motor/cmd` 直接下发执行器命令。
- 不把 motor bench 说成完整底盘控制。
- 不把 Gazebo 仿真说成真实小车结果。
- 不宣称真实 VLA / RL / world model 结果。

motor bench 只允许使用现有安全配置：

- 低频命令。
- backend 限幅。
- 短 timeout。
- `stop=true` 可显式停止。
- `max_pwm` 保守设置。
- `target_speed_mps` / `target_rpm` 不超过现有配置约束。

真实硬件运行前必须人工确认：

- 电机悬空或可靠固定。
- 供电电压、电流限制、接线极性正确。
- TB6612 / ESP32 / STM32 / 编码器接线稳固。
- STOP 命令或断电方式可立即执行。
- 操作者与旋转部件保持安全距离。
- 当前展示口径是 N20 单电机 bench，不是整车运行。

## 5. 验证清单

### 5.1 Dashboard health

命令：

```bash
curl --noproxy '*' http://127.0.0.1:9000/health
```

预期：

- `status=ok`
- AMR 联调时 `mode=amr_http`
- mock 截图模式可为 `mock_json`

### 5.2 Task API

命令：

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/tasks
```

预期：

- AMR 联调时 `source=amr_http:http://127.0.0.1:8000`
- AMR 成功执行时可看到任务从 `queued` / `running` 到 `completed`
- 上游不可用时 Dashboard 返回明确错误，不白屏

### 5.3 WMS proxy

命令：

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/wms/tasks
```

预期：

- Dashboard backend 可代理 AMR Mock WMS task list。
- 该接口不直接控制 Nav2、电机或真实机器人。

### 5.4 Robot status

命令：

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/robot/status
```

预期：

- MQTT connected 时显示 `robot/imu`、`robot/state`、`robot/motor/status` 最新缓存。
- broker 或数据源不可用时显示 `disconnected`、`stale` 或 `no data`。
- 该接口只返回 backend 进程内存中的最新 MQTT 消息。

### 5.5 Evaluation Summary

命令：

```bash
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/summary
```

预期：

- 返回 `run_id`
- 返回 `dataset_version`
- 返回 `model_version`
- 返回 `task_success_rate`
- 返回 `failure_count`
- 返回 `quality_checks`
- 页面或文档必须标注 baseline / mock / reserved，不宣称真实训练结果。

### 5.6 MQTT 最新消息

命令：

```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/imu -C 1 -W 5
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/state -C 1 -W 3
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/motor/status -C 1 -W 5
mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/motor/cmd -C 1 -W 20
```

预期：

- `robot/imu` 有 IMU payload。
- `robot/state` 有 robot state payload。
- `robot/motor/status` 有 motor / encoder 状态。
- `robot/motor/cmd` 只在显式发送 motor command 后出现。

### 5.7 WebSocket

检查目标：

- `ws://127.0.0.1:9000/ws/status`

预期：

- 可收到 `dashboard_status`。
- payload 包含 tasks、robot、imu、motor。
- MQTT 新消息可触发新的状态快照推送。

### 5.8 前端页面

打开：

```text
http://127.0.0.1:8001/frontend/
```

预期：

- 首屏显示 Task / Robot Link / IMU / Motor / Event Stream / Simulation Preview。
- 第二屏显示 System Evaluation & Validation Layer。
- 网络失败或后端不可用时显示 `disconnected` 或明确错误，不白屏。
- 页面文案不宣称 Dashboard 是完整控制器或真实 AI 训练平台。

## 6. 截图清单

推荐保留到 `artifacts/screenshots/`。如果需要单独给作品集导出，也可以复制到 `screenshots/`。

必选截图：

- Dashboard 总览：首屏 cockpit，包含 Task、Robot Link、IMU、Motor、Simulation Preview。
- System Evaluation & Validation Layer：展示 `run_id`、dataset/model/run 数据关系、成功率、failure cases、quality checks。
- Robot Status / Motor / IMU 状态：突出 MQTT、micro-ROS、IMU 姿态、motor telemetry。
- API 返回结果：`/health`、`/api/tasks`、`/api/robot/status`、`/api/evaluation/summary`。
- 终端联调状态：AMR API、Dashboard backend、MQTT、micro-ROS Agent、bridge 状态。

可选截图：

- Gazebo 仓库场景和 AMR。
- RViz map / robot pose / goal / path。
- AMR task result writeback。
- disconnected / stale 状态，用于展示故障可视化能力。

推荐命名：

- `dashboard-overview-1440x900.png`
- `dashboard-evaluation-platform-1440x900.png`
- `dashboard-failure-cases-crop.png`
- `dashboard-robot-status-1440x900.png`
- `api-health-and-summary-terminal.png`
- `amr-gazebo-rviz-task-result.png`

## 7. 录屏脚本

### 7.1 60 秒 HR 版

0-8s：Dashboard 总览  
旁白：这是机器人数据链路与评测平台入口，用一个轻量 Dashboard 汇总 AMR 任务、硬件遥测、motor bench 和 baseline evaluation。

8-20s：AMR / WMS task  
画面：Task Dispatch 或 Current Task Execution。  
旁白：任务通过 Dashboard backend HTTP proxy 进入 AMR Mock WMS；Nav2 / Gazebo 执行结果再回写为任务状态。

20-32s：IMU / robot state  
画面：IMU 姿态、Robot Link、Event Stream。  
旁白：STM32 / ESP32-S3 数据经 micro-ROS 进入 ROS 2，再低频镜像到 MQTT，Dashboard 只读展示状态。

32-44s：Motor / Encoder bench  
画面：Motor Bench Flow、target / actual / pwm / fault。  
旁白：这里是 N20 单电机 bench 的低频受限命令链路，不是整车控制器；命令必须走 backend 安全接口。

44-55s：System Evaluation & Validation Layer
画面：滚动到第二屏。  
旁白：系统把 run、dataset、model baseline、失败样本和质量检查组织成评测摘要，便于后续 ML-ready 数据沉淀。

55-60s：收束  
旁白：这个 Demo 展示的是机器人系统集成、数据链路、可观测性和安全边界意识；当前没有宣称真实 VLA / RL / world model 训练结果。

### 7.2 2-3 分钟技术版

0-20s：系统架构  
说明三个仓库职责：AMR 仿真任务链路、硬件 digital twin 状态链路、Dashboard 聚合与 evaluation 展示入口。

20-55s：AMR Mock WMS -> Nav2 / Gazebo -> Dashboard  
展示 AMR API、任务创建/查询、Nav2 / Gazebo 执行、task result writeback、Dashboard task 映射。

55-90s：STM32 / ESP32-S3 -> micro-ROS -> ROS 2 -> MQTT -> Dashboard  
展示 micro-ROS Agent、ROS 2 IMU topic、MQTT `robot/imu` / `robot/state`、Dashboard `/api/robot/status` 和前端 IMU 状态。

90-125s：Motor command -> MQTT -> ROS 2 -> N20 bench -> Dashboard  
展示 `POST /api/robot/motor/cmd` 的限幅命令、MQTT `robot/motor/cmd`、ROS 2 `/motor/cmd`、encoder status 和 STOP 口径。

125-155s：System Evaluation & Validation Layer
展示 `run_id`、`dataset_version`、`model_version`、success rate、failure cases、quality checks、compute status。

155-180s：安全边界与失败展示  
强调 Dashboard 不控制 Nav2、不做完整底盘闭环、不启动训练；上游不可用时显示 disconnected / stale / no data。

## 8. 输出物清单

本次作品集 Demo 最终输出建议包括：

- `docs/demo_full_pipeline_plan.md`
- `docs/demo_recording_checklist.md`
- `docs/full_pipeline_validation_report.md`
- `docs/portfolio_demo_summary.md`
- `artifacts/screenshots/`：仓库内默认截图目录。
- `screenshots/`：作品集导出截图目录，可选。
- `scripts/verify_demo_readiness.sh`：可选，只读 readiness 检查脚本。

`scripts/verify_demo_readiness.sh` 若后续实现，必须只做非破坏性检查：

- 允许 HTTP GET。
- 允许 MQTT subscribe probe。
- 允许 WebSocket receive probe。
- 允许文件路径和静态资源检查。
- 默认不 POST motor command。
- 默认不创建 AMR task。
- 默认不启动 Gazebo / Nav2。
- 默认不启动 micro-ROS。
- 默认不刷板。

## 9. 自动完成 vs 人工操作

可以自动完成：

- 生成本文档和相关 checklist / report / summary 文档。
- 创建截图目录占位。
- 编写只读 readiness 检查脚本。
- 检查 dashboard 静态文件、mock/evaluation JSON、FastAPI route 是否存在。
- 对已经启动的服务执行只读验证：`/health`、`/api/tasks`、`/api/robot/status`、`/api/evaluation/summary`、WebSocket receive。
- 使用 Playwright 采集不触发 dispatch / motor command 的静态截图。

必须人工操作或人工确认后执行：

- 刷写 STM32 / ESP32-S3 固件。
- 修改 PlatformIO 配置。
- 给真实硬件上电。
- 启动真实 motor bench 输出。
- 确认电机悬空/固定、急停/断电方式和安全距离。
- 启动 Gazebo / RViz / Nav2 完整仿真演示。
- 点击 Dashboard 的 Task Dispatch。
- 发送 motor command。
- 宣称任何真实 VLA / RL / world model / 真实小车结果。

## 10. Assumptions

- 当前 workspace 中只直接可见 `robot-ops-dashboard`。
- `amr_warehouse_navigation` 与 `ros2-robot-digital-twin` 的真实状态需要在实际联调前进入对应仓库复核。
- 作品集口径坚持：真实系统集成能力 + mock/baseline evaluation 展示，不包装成真实训练平台或完整机器人控制器。
- 所有截图、录屏和总结文档都应明确区分真实完成、mock、reserved 和 planned。
