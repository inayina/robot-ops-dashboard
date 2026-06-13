# 作品集 Demo 总结

## 项目标题

Robot Data Link & Evaluation Dashboard: AMR/WMS, micro-ROS Telemetry and Baseline Evaluation Demo

## 一句话简介

这是一个面向机器人数据链路、系统 baseline 评测和运维可视化的轻量 Dashboard Demo，把 AMR Mock WMS 仿真任务、micro-ROS / MQTT 硬件遥测、N20 单电机 motor bench 和只读 evaluation 摘要汇聚到同一个作品集展示入口。

## 展示内容

本 Demo 展示三条系统数据链和一个只读评测层：

- AMR / WMS 任务链路：Dashboard backend 通过 HTTP adapter 读取和创建 AMR Mock WMS task，上游 AMR 仓库负责 Nav2 / Gazebo 执行和 task result writeback。
- IMU / robot state 状态链路：STM32 + MPU6050 经 ESP32-S3 micro-ROS 进入 ROS 2 topic，再由 PC bridge 镜像到 MQTT，Dashboard 只读展示。
- Motor / Encoder bench 链路：Dashboard 通过显式 `POST /api/robot/motor/cmd` 发布低频受限命令，下游 N20 单电机 bench 回传 encoder / motor status。
- Evaluation & ML-ready Data Layer：Dashboard 通过只读 `GET /api/evaluation/*` 展示 run、dataset、model baseline、失败样本、质量检查和 compute 状态。

## 机器人数据链路

数据从底层设备和仿真系统进入 Dashboard 时保持清晰边界：

- AMR task 通过 HTTP API 进入 Dashboard。
- IMU / robot state / motor status 通过 MQTT 进入 Dashboard。
- WebSocket `/ws/status` 只负责把 backend 汇总状态推送给前端。
- Evaluation 数据从本地 mock / baseline JSON 读取，不写数据库、不控制机器人。

## 任务状态

Dashboard 展示任务 ID、状态、进度、路线、当前阶段和最近事件。AMR 任务的真实执行由上游 AMR 仓库负责，Dashboard 只通过 HTTP adapter 读取和创建 Mock WMS task，并把上游状态映射到统一展示状态。

## 硬件状态

硬件状态聚焦 IMU、robot state、motor / encoder bench：

- IMU 姿态和传感器 freshness 用于展示 micro-ROS / MQTT 状态链路。
- Motor / Encoder 区域展示 target、actual、pwm、fault 和 STOP 口径。
- 当前硬件阶段是 N20 单电机 bench，不宣称真实整车控制。

## Evaluation Summary

Evaluation Summary 展示一次 run 的摘要：

- `run_id`
- `dataset_version`
- `model_version`
- `task_success_rate`
- failure count
- quality checks
- compute / GPU status

这些字段用于作品集说明数据契约和评测组织方式。当前结果是 baseline / mock / reserved，不是真实训练成绩。

## ML-ready Data Layer

ML-ready Data Layer 按以下顺序解释数据如何沉淀：

```text
数据来源
  -> Evaluation Run
  -> Quality Checks
  -> ML-ready Export
```

它的价值是展示后续可如何接入真实 dataset、episode、policy evaluation 或实验管理系统，而不是宣称当前已经完成 VLA / RL / world model 训练。

## 技术栈

- Frontend：纯 HTML / CSS / JavaScript。
- Backend：FastAPI、REST API、WebSocket。
- Integration：HTTP adapter、MQTT、micro-ROS bridge。
- Robotics：ROS 2、Gazebo、Nav2、Mock WMS。
- Embedded / hardware bench：STM32、ESP32-S3、MPU6050、TB6612、N20 motor with encoder。
- Evaluation layer：mock / baseline JSON contract，ML-ready feature 展示。

## 当前真实完成能力

- Dashboard backend 已实现 `/health`、`/api/tasks`、`/api/wms/tasks`、`/api/robot/status`、`/api/evaluation/summary` 和 `/ws/status`。
- Dashboard frontend 已实现机器人运维 cockpit 和 Evaluation & ML-ready Data Layer。
- AMR task 通过 HTTP API 边界接入 Dashboard。
- IMU / robot state / motor status 通过 MQTT 缓存进入 Dashboard。
- Motor command 通过 `POST /api/robot/motor/cmd` 显式发布，并在 backend 做限幅和安全字段补齐。
- Evaluation 数据明确标注为 baseline / mock / reserved，不写数据库、不发布 MQTT、不控制机器人。

## 明确边界

- Dashboard 不是 Nav2 控制台。
- Dashboard 不是完整 WMS 或多机器人调度系统。
- Dashboard 不是完整 AI 训练平台。
- 当前 motor bench 是 N20 单电机，不是完整真实小车。
- 当前 evaluation 不是真实 VLA / RL / world model 训练结果。
- 无真实 GPU 接入时，compute 状态应显示 `not_connected`、`N/A` 或 reserved。

## 后续计划

- 将 readiness 检查结果写入 `docs/full_pipeline_validation_report.md`。
- 为真实联调补充每次 run 的截图、录屏和任务结果。
- 在不改变 monitoring-first 边界的前提下，扩展只读 evaluation run index。
- 真实训练结果接入前，继续使用 Mock / Offline / Reserved 标签。

## 面试表达重点

可以强调：

- 我把机器人任务、硬件遥测和评测摘要统一到了一个可演示的数据链路入口。
- Dashboard backend 与 ROS 2 / Nav2 / Gazebo 解耦，只通过 HTTP / MQTT 集成。
- 对真实硬件交互采用显式接口、限幅、短 timeout 和 STOP 口径。
- 对 mock / baseline / reserved 数据明确标注，不夸大为真实训练成果。
- 前端在上游不可用时显示 disconnected / stale / no data，不白屏。

避免表达：

- 避免说“Dashboard 控制 Nav2”。
- 避免说“已经完成真实自动驾驶小车”。
- 避免说“已有 VLA / RL / world model 训练结果”。
- 避免把 mock success rate 说成公开 benchmark。
- 避免把单电机 wheel speed 说成整车速度。

## 推荐 60 秒讲法

这个项目是一个机器人数据链路与评测 Dashboard。上游 AMR 仓库负责 Mock WMS、Nav2 和 Gazebo 仿真任务；下位机链路负责 STM32 / ESP32-S3 / micro-ROS / MQTT 的 IMU 和 motor bench 状态；Dashboard 仓库负责把 HTTP task、MQTT telemetry、WebSocket status 和只读 evaluation summary 汇总成一个可展示入口。当前 evaluation 是 baseline / mock / reserved 口径，不宣称真实 VLA、RL 或 world model 结果。这个 Demo 的重点是系统集成、数据链路、可观测性和安全边界。

## 推荐技术版讲法

我把系统拆成三个边界清楚的仓库。AMR 仓库提供 Mock WMS HTTP API 和 Nav2 / Gazebo task executor；digital twin 仓库提供 STM32 / ESP32-S3 / micro-ROS / MQTT 的硬件状态链路；Dashboard 仓库只作为上层观察和受限联调入口。Dashboard backend 不导入 ROS 2 代码，而是通过 HTTP adapter 和 MQTT topic 缓存接入数据，并通过 `/ws/status` 推送给纯静态前端。motor bench 命令必须走 `POST /api/robot/motor/cmd`，backend 做限幅、timeout 和 stop 字段，适合 N20 单电机台架，不是完整底盘控制。Evaluation 层读取本地 mock / baseline 数据，展示 run、dataset、model baseline、failure cases 和 quality checks，为后续真实实验管理平台预留接口。

## 推荐素材清单

- Dashboard 总览截图。
- Task Dispatch / Current Task Execution 截图。
- IMU / Robot Link 截图。
- Motor / Encoder bench 截图。
- Evaluation Summary / ML-ready Data Layer 截图。
- API 返回结果截图。
- 终端联调状态截图。
- 可选 Gazebo / RViz 截图。
- 60 秒 HR 版录屏。
- 2-3 分钟技术版录屏。

## 最终交付物

- `docs/demo_full_pipeline_plan.md`
- `docs/demo_recording_checklist.md`
- `docs/full_pipeline_validation_report.md`
- `docs/portfolio_demo_summary.md`
- `artifacts/screenshots/`
- `screenshots/`
- `artifacts/videos/`

## 当前状态说明

截至本文档生成时，`robot-ops-dashboard` 是当前 workspace 中直接可见的仓库。AMR 与 digital twin 仓库的实际运行状态需要在正式联调前进入对应本地路径复核。作品集最终表达必须以实际验证报告为准。
