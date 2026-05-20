# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- 新增 `scripts/start_microros_sensor_stack.sh`，用于一键启动 micro-ROS agent、ROS 2 -> MQTT IMU bridge、Dashboard backend 与前端页面。
- 新增 `scripts/microros_imu_to_mqtt_bridge.py`，将 `sensor_msgs/msg/Imu` 或 JSON 字符串 topic 只读桥接到 MQTT `robot/imu`。
- 固化 IMU -> Dashboard 数据边界：ESP32-S3 通过 micro-ROS / Wi-Fi UDP 进入 ROS 2，PC 端 bridge 仅将 `/imu/data` 或 `/imu/filtered` 低频镜像到 MQTT `robot/imu`，Dashboard 不新增控制链路。
- 新增最小 MQTT 只读接入：连接默认 broker `mqtt://127.0.0.1:1883`，订阅 `robot/state`、`robot/imu`、`robot/motor/status`、`robot/alarm`
- 新增 `GET /api/robot/status`，返回 backend 内存中的 MQTT 最新缓存状态
- `/ws/status` 在 MQTT 新消息到达时推送新的 `dashboard_status` 快照
- 新增 `scripts/mock_mqtt_motor_status_publisher.py` 用于模拟发布 `robot/motor/status`
- 前端 Motor / Encoder 卡片对齐 `robot-state-monitor-v1` 的 `robot_status_api_bridge` 输出，展示 `actual_rpm` 并容错解析 `motor_state` JSON 字符串；本地 N20 closed-loop bench CSV 字段保留占位
- 更新 README 与 MQTT/WebSocket/API 文档，明确该链路仍为只读监控，不发布控制指令
- 前端新增 MPU6050 / IMU 状态区域，复用 `/api/robot/status` 与 `/ws/status` 展示 MQTT `robot/imu` 最新状态，并按 3 秒 stale、10 秒 offline 判断 freshness
- 优化前端实时监控区为固定卡片布局，WebSocket 刷新时只更新字段、状态灯、进度条和姿态 transform，降低录屏时的布局跳动
- 新增最小 Mock WMS task proxy：`GET /api/wms/tasks`、`POST /api/wms/tasks`
- 前端新增 Mock WMS 任务创建表单和任务列表手动刷新
- 新增 `docs/wms_task_proxy_design.md`，明确 WMS task proxy 不做 Nav2、电机、MQTT 控制或数据库持久化
- 新增 `scripts/start_dashboard_api_stack.sh`，一键启动 AMR API、Dashboard backend 和 frontend，不自动跑任务
- `start_dashboard_api_stack.sh --with-amr-visualization` 可额外启动 AMR Gazebo/RViz/Nav2 和 HTTP executor loop，用于观察 Dashboard 创建任务后的执行过程

## v0.1.0 - 2026-05-18

- 添加后端 FastAPI 应用以读取 AMR Mock WMS HTTP API（backend/app）
- 添加前端静态 Dashboard（frontend/）
- 添加文档：API 契约、集成指南、路线图、WebSocket 状态流（docs/）
- 添加测试与 mock 数据（backend/tests、mock/）

验证信息：本地已通过 11 个单元测试（运行命令：
`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /home/ina/workspace/robot-ops-dashboard/.venv/bin/python -m pytest -q backend/tests`），在 `backend/` 范围内未发现明文凭证。

配置说明：运行时配置从环境变量读取，详见 `backend/app/config.py`。

发布建议：

```bash
git add README.md backend/README.md backend/app/config.py backend/app/main.py backend/app/schemas.py backend/requirements.txt backend/app/services/*.py backend/tests/ docs/*.md frontend/* AGENTS.md scripts/ CHANGELOG.md
git commit -m "chore(release): 初始发布 v0.1.0

- 添加后端 FastAPI 应用以读取 AMR Mock WMS HTTP API（backend/app）
- 添加前端静态 Dashboard（frontend/）
- 添加文档：API 契约、集成指南、路线图、WebSocket 状态流（docs/）
- 添加测试与 mock 数据（backend/tests, mock/）
- 已验证：本地通过 11 个单元测试；backend/ 未发现明文凭证
- 配置说明：运行时配置从环境变量读取（参见 backend/app/config.py）
- 标记版本：v0.1.0
"
git tag -a v0.1.0 -m "v0.1.0 初始发布"
git push origin HEAD
git push origin --tags
```

---
