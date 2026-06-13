# Demo 录屏与截图检查清单

本文用于正式录屏前人工彩排。目标是确保作品集材料清楚展示 AMR 仿真任务、IMU / Motor 硬件状态链路、MQTT / HTTP / WebSocket 数据链路，以及 Dashboard Evaluation Summary。

## 1. 录屏前安全确认

开始任何真实硬件画面前，先人工确认：

- 不刷写 STM32 / ESP32-S3。
- 不修改 PlatformIO 配置。
- 电机已悬空或可靠固定。
- 供电电压、电流限制和接线极性已确认。
- TB6612 / ESP32 / STM32 / 编码器接线稳固。
- STOP 命令或断电方式随时可用。
- 本次只展示 N20 单电机 bench，不宣称整车运动。
- Dashboard motor command 只走 `POST /api/robot/motor/cmd`。

## 2. 服务与端口检查

推荐端口：

| 服务 | 地址 | 用途 |
| --- | --- | --- |
| AMR Mock WMS API | `http://127.0.0.1:8000` | 上游任务 API |
| Frontend static server | `http://127.0.0.1:8001/frontend/` | 浏览器页面 |
| MQTT broker | `127.0.0.1:1883` | robot telemetry / motor command |
| micro-ROS Agent UDP | `8888` | ESP32-S3 -> ROS 2 |
| Dashboard backend | `http://127.0.0.1:9000` | `/api/*` 与 `/ws/status` |

建议启动顺序：

1. AMR Mock WMS API：提供 `/health`、`/tasks` 和 task result writeback。
2. MQTT broker：承接 `robot/imu`、`robot/state`、`robot/motor/status`、`robot/motor/cmd`。
3. micro-ROS Agent：仅在真实 ESP32-S3 已准备好时启动。
4. ROS 2 -> MQTT bridge：镜像 IMU、robot state、motor status，并桥接 motor cmd。
5. Dashboard backend：推荐 `ROBOT_OPS_TASK_SOURCE=amr_http`。
6. Dashboard frontend：打开静态页面。
7. 可选 Gazebo / RViz / Nav2：仅用于 AMR 仿真画面。
8. 可选 motor bench：必须先完成硬件安全确认。

只读检查：

```bash
curl --noproxy '*' http://127.0.0.1:9000/health
curl --noproxy '*' http://127.0.0.1:9000/api/tasks
curl --noproxy '*' http://127.0.0.1:9000/api/robot/status
curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/summary
curl --noproxy '*' http://127.0.0.1:8001/frontend/
./scripts/verify_demo_readiness.sh
```

## 3. 画面准备

浏览器：

- 打开 `http://127.0.0.1:8001/frontend/`。
- 关闭无关标签页。
- 保持页面宽度为 `1440x900` 或 `1366x768`。
- 不展示隐私路径、token、Wi-Fi 信息或串口设备敏感信息。

Dashboard 首屏应能看到：

- 顶部系统状态。
- Robot Link。
- IMU 姿态展示。
- Motor Bench Flow。
- Current Task Execution。
- Task Dispatch。
- Simulation Preview。
- Event Stream。

第二屏应能看到：

- Evaluation & ML-ready Data Layer。
- `run_id`。
- `dataset_version`。
- `model_version`。
- success rate。
- failure cases。
- quality checks。
- compute / GPU status。

## 4. 必选截图

保存到 `artifacts/screenshots/`，需要导出作品集时再复制到 `screenshots/`。

- `dashboard-overview-1440x900.png`：Dashboard 总览。
- `dashboard-task-dispatch-1440x900.png`：Task Dispatch 与 Current Task Execution。
- `dashboard-robot-status-1440x900.png`：Robot Link / IMU / Motor 状态。
- `dashboard-evaluation-summary-1440x900.png`：Evaluation Summary。
- `dashboard-ml-ready-data-layer-1440x900.png`：ML-ready Data Layer。
- `api-health-and-summary-terminal.png`：API 返回结果。
- `terminal-integration-status.png`：AMR API / MQTT / micro-ROS / bridge / Dashboard 状态。

可选截图：

- `amr-gazebo-rviz-task-result.png`：Gazebo / RViz / task result。
- `dashboard-disconnected-state.png`：disconnected / stale 状态。

## 5. 60 秒 HR 版录屏脚本

0-8s：Dashboard 总览  
画面停在首屏 cockpit。  
旁白：这是机器人数据链路与评测平台入口，用一个 Dashboard 汇总 AMR 任务、硬件遥测、motor bench 和 baseline evaluation。

8-20s：AMR / WMS task  
画面展示 Task Dispatch 或 Current Task Execution。  
旁白：任务通过 Dashboard backend HTTP proxy 进入 AMR Mock WMS，Nav2 / Gazebo 执行后再回写任务状态。

20-32s：IMU / robot state  
画面聚焦 IMU 姿态和 Robot Link。  
旁白：STM32 / ESP32-S3 的状态经 micro-ROS 到 ROS 2，再镜像到 MQTT，Dashboard 只读展示。

32-44s：Motor / Encoder bench  
画面聚焦 Motor Bench Flow。  
旁白：这里是 N20 单电机 bench 的低频受限命令链路，不是完整底盘控制器。

44-55s：Evaluation & ML-ready Data Layer  
画面滚动到第二屏。  
旁白：评测层把 run、dataset、model baseline、失败样本和质量检查组织为只读摘要。

55-60s：收束  
画面回到总览或停在 Evaluation Summary。  
旁白：当前展示真实系统集成能力和 baseline / mock evaluation 结构，不宣称真实 VLA / RL / world model 训练结果。

## 6. 2-3 分钟技术版录屏脚本

0-20s：系统架构  
说明三个仓库职责：AMR 仿真任务链路、硬件 digital twin 状态链路、Dashboard 聚合与 evaluation 展示。

20-55s：AMR 链路  
展示 AMR Mock WMS API、任务创建/查询、Nav2 / Gazebo 执行、task result writeback、Dashboard task 映射。

55-90s：IMU / robot state 链路  
展示 micro-ROS Agent、ROS 2 IMU topic、MQTT `robot/imu` / `robot/state`、Dashboard `/api/robot/status` 和前端 IMU 状态。

90-125s：Motor / Encoder bench 链路  
展示 `POST /api/robot/motor/cmd` 的受限命令、MQTT `robot/motor/cmd`、ROS 2 `/motor/cmd`、encoder status 和 STOP 口径。

125-155s：Evaluation Summary  
展示 `run_id`、`dataset_version`、`model_version`、success rate、failure cases、quality checks、compute status。

155-180s：安全边界  
说明 Dashboard 不控制 Nav2、不做完整底盘闭环、不启动训练；上游不可用时显示 disconnected / stale / no data。

## 7. 禁止在录屏中宣称

- 不宣称 Dashboard 直接控制 Nav2。
- 不宣称 motor bench 是完整双轮底盘或真实小车。
- 不宣称已有真实 VLA / RL / world model 训练结果。
- 不把 mock success rate 当作公开 benchmark。
- 不宣称已实现完整商业 WMS、多机器人调度或完整 AI 训练平台。

录屏时不应该做的事情：

- 不临场刷板或改 PlatformIO 配置。
- 不在未确认安全的情况下点击 motor `Apply`。
- 不长时间运行 motor bench。
- 不用 Dashboard 绕过 backend 直接连 MQTT / ROS 2 / 硬件。
- 不展示未打码的隐私路径、token、Wi-Fi 密码或设备序列信息。
- 不把 Offline / Mock / Reserved 状态隐藏起来。

## 8. 录屏后检查

- 视频中没有隐私路径或敏感凭据。
- 每个 mock / baseline / reserved 项都被清楚标注。
- motor bench 口径是 N20 单电机 bench。
- Evaluation 是只读展示。
- 网络失败时页面没有白屏。
- 结尾能看懂三条链路：AMR task、IMU/Motor telemetry、Evaluation Summary。
