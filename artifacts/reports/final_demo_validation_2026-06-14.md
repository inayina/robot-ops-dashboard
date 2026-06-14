# 最终演示验证 - 2026-06-14

## 结果

- 仪表盘（含可选写入）就绪：通过
- 后端测试：42 个通过
- 截图：已生成
- 视频：已生成
- AMR 任务下发：已验证
- 电机命令下行：已验证到 ROS `/motor/cmd`
- IMU 实时遥测上行：在仪表盘中已验证
- 机器人状态上行：在仪表盘中已验证
- 电机状态上行：在仪表盘中已验证，当前状态为安全停止 / 数据过期（stale）

## 命令

```bash
VERIFY_OPTIONAL_WRITE_ENDPOINTS=true ./scripts/verify_demo_readiness.sh
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest backend/tests
npm run capture:screenshots
node scripts/capture_dashboard_artifacts.js --video --dispatch --motor-demo --record-ms 75000
```

## 产物

- `artifacts/screenshots/dashboard-overview-1440x900.png`
- `artifacts/screenshots/dashboard-task-dispatch-1440x900.png`
- `artifacts/screenshots/dashboard-recording-frame-1366x768.png`
- `artifacts/screenshots/dashboard-motor-curve-1440x900.png`
- `artifacts/screenshots/dashboard-evaluation-platform-1440x900.png`
- `artifacts/screenshots/dashboard-failure-cases-crop.png`
- `artifacts/videos/dashboard-demo-walkthrough.webm`

## 说明

- 在就绪检查期间，`POST /api/wms/tasks` 返回 HTTP 201。
- 在就绪检查期间，`POST /api/robot/motor/cmd` 的 STOP 返回 HTTP 200。
- N20 台架录制探针使用 `target_speed_mps=0.08`（`target_rpm≈23.5`），超时设置较短，随后发送 STOP。
- 修复后端 MQTT 发布回退逻辑后，ROS `/motor/cmd` 收到了仪表盘的 STOP 有效负载。
- 在用户移动硬件后，ROS `/imu/filtered` 开始发出 IMU 有效负载，仪表盘收到 `robot/imu`。
- 仪表盘收到带有 `state_label=normal` 的 `robot/state`。
- 仪表盘收到 `robot/motor/status`；当前电机状态为停止/过期，`target_rpm=0`、`actual_rpm=0`、`pwm=0`、`fault=false`。
- 在出现实时遥测后，已重新生成最终截图和视频。
- 录屏中已包含 Dashboard 内嵌 `Simulation Preview`，来源为 `local_rviz_mjpeg`，标签为 `RViz Path View`。
- 当前 Playwright 录屏只覆盖浏览器内的 Dashboard 页面；它包含 WMS 任务下发、硬件遥测、Motor bench 和内嵌 RViz Path View，不包含桌面上单独打开的原生 RViz / Gazebo 窗口。
- 评估与 GPU 字段为基线 / 模拟 / 预留。
