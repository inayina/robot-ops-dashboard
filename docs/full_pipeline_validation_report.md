# Full Pipeline Validation Report

本文是作品集 Demo 的验证报告模板。实际运行后，将每一项的结果、时间戳、截图路径和备注补齐。不要在未验证时填写“通过”。

## Test Date

| Item | Value |
| --- | --- |
| Date | 待填写 |
| Operator | 待填写 |
| Scenario | Full pipeline demo readiness |
| Result | Pending |

## Environment

| 项目 | 内容 |
| --- | --- |
| Dashboard backend | `http://127.0.0.1:9000` |
| Dashboard frontend | `http://127.0.0.1:8001/frontend/` |
| AMR Mock WMS API | `http://127.0.0.1:8000` |
| MQTT broker | `127.0.0.1:1883` |
| micro-ROS Agent | UDP `8888` |
| Evaluation source | Mock / Baseline / Reserved JSON unless real source is verified |

## Repositories

| Repository | Role | Status |
| --- | --- | --- |
| `robot-ops-dashboard` | FastAPI / MQTT / WebSocket / Dashboard / Evaluation Summary | 待验证 |
| `amr_warehouse_navigation` | ROS 2 / Gazebo / Nav2 / Mock WMS task pipeline | 待验证 |
| `ros2-robot-digital-twin` | STM32 / ESP32-S3 / micro-ROS / MQTT / IMU / Motor / Encoder | 待验证 |

## Startup Order

| Step | Service | Expected Result | Result |
| --- | --- | --- | --- |
| 1 | AMR Mock WMS API | `/health` and `/tasks` available | 待验证 |
| 2 | MQTT broker | `127.0.0.1:1883` accepts subscribe/publish | 待验证 |
| 3 | micro-ROS Agent | ESP32-S3 session established, if hardware is used | 待验证 |
| 4 | ROS 2 -> MQTT bridges | IMU/state/motor topics mirrored to MQTT | 待验证 |
| 5 | Dashboard backend | `/health` returns `ok` | 待验证 |
| 6 | Dashboard frontend | `http://127.0.0.1:8001/frontend/` loads | 待验证 |
| 7 | Optional Gazebo / RViz / Nav2 | AMR simulation visible | 待验证 |
| 8 | Optional motor bench | Only after manual safety confirmation | 待验证 |

## API Validation

Use `scripts/verify_demo_readiness.sh` for the first read-only pass.

| API | Command | Expected | Result |
| --- | --- | --- | --- |
| `/health` | `curl --noproxy '*' http://127.0.0.1:9000/health` | HTTP 200 and `status=ok` | 待验证 |
| `/api/tasks` | `curl --noproxy '*' http://127.0.0.1:9000/api/tasks` | HTTP 200, AMR or mock source clear | 待验证 |
| `/api/wms/tasks` | `curl --noproxy '*' http://127.0.0.1:9000/api/wms/tasks` | HTTP proxy works when AMR API is available | 待验证 |
| `/api/robot/status` | `curl --noproxy '*' http://127.0.0.1:9000/api/robot/status` | MQTT cache returned or disconnected state shown | 待验证 |
| `/api/evaluation/summary` | `curl --noproxy '*' http://127.0.0.1:9000/api/evaluation/summary` | `run_id`, `dataset_version`, `model_version`, quality checks | 待验证 |

## MQTT / WebSocket Validation

| Check | Command or Observation | Expected | Result |
| --- | --- | --- | --- |
| MQTT IMU | `mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/imu -C 1 -W 5` | Payload or timeout recorded as Offline | 待验证 |
| MQTT robot state | `mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/state -C 1 -W 3` | Payload or timeout recorded as Offline | 待验证 |
| MQTT motor status | `mosquitto_sub -h 127.0.0.1 -p 1883 -t robot/motor/status -C 1 -W 5` | Payload or timeout recorded as Offline | 待验证 |
| MQTT motor cmd | `robot/motor/cmd` observation | Only appears after explicit manual command | 待验证 |
| WebSocket | `ws://127.0.0.1:9000/ws/status` | `dashboard_status` with tasks/robot/imu/motor | 待验证 |

## Dashboard Validation

| Area | Expected | Result | Screenshot |
| --- | --- | --- | --- |
| Overview | Task / Robot Link / IMU / Motor / Event Stream visible | 待验证 | 待填写 |
| Simulation Preview | Connected stream or disconnected placeholder | 待验证 | 待填写 |
| Task Dispatch | Clearly uses backend HTTP API | 待验证 | 待填写 |
| Robot Status | Online / stale / offline state clear | 待验证 | 待填写 |
| Motor / Encoder | N20 bench status only, not full chassis | 待验证 | 待填写 |
| Evaluation Summary | Baseline / Mock / Reserved labels clear | 待验证 | 待填写 |
| ML-ready Data Layer | Data source -> Evaluation Run -> Quality Checks -> Export clear | 待验证 | 待填写 |

## Hardware Status

| 检查项 | 结果 | 备注 |
| --- | --- | --- |
| 未自动刷板 | 待验证 |  |
| 未自动修改 PlatformIO 配置 | 待验证 |  |
| 电机悬空或可靠固定 | 待验证 |  |
| 供电电压和电流限制已确认 | 待验证 |  |
| 接线极性和编码器连接已确认 | 待验证 |  |
| STOP 命令或断电方式可立即执行 | 待验证 |  |
| 录屏口径为 N20 单电机 bench | 待验证 |  |

## Known Limitations

- AMR 仿真运行依赖外部 ROS 2 / Gazebo / Nav2 环境；不可用时只展示 Mock / Offline。
- IMU / motor live data 依赖真实硬件和 micro-ROS；不可用时显示 Offline / Mock。
- Evaluation 当前是 mock / baseline / reserved 数据，不是真实 VLA / RL / world model 训练结果。
- Motor bench 是 N20 单电机 bench，不是真实整车。
- Dashboard backend 不直接依赖 ROS 2、Nav2 或 Gazebo。

## Portfolio Screenshot Notes

| 输出物 | 路径 | 状态 |
| --- | --- | --- |
| 总览截图 | `artifacts/screenshots/` 或 `screenshots/` | 待生成 |
| Evaluation 截图 | `artifacts/screenshots/` 或 `screenshots/` | 待生成 |
| API 截图 | `artifacts/screenshots/` 或 `screenshots/` | 待生成 |
| 60 秒 HR 版录屏 | `artifacts/videos/` | 待生成 |
| 2-3 分钟技术版录屏 | `artifacts/videos/` | 待生成 |
| 作品集总结 | `docs/portfolio_demo_summary.md` | 已准备模板 |

Recommended order:

1. Dashboard overview.
2. Task dispatch / current task execution.
3. Robot Link + IMU status.
4. Motor / Encoder bench status.
5. Evaluation Summary.
6. ML-ready Data Layer.
7. API terminal results.
8. Optional Gazebo / RViz.

## Next Steps

- Run `scripts/verify_demo_readiness.sh` after backend and frontend are started.
- Fill this report with real PASS / FAIL results.
- Capture screenshots in `artifacts/screenshots/` and optional `screenshots/`.
- Record 60s HR version and 2-3 minute technical version.
- Keep Mock / Offline / Reserved labels visible whenever live hardware or ROS 2 / Gazebo is unavailable.

## Final Conclusion

Pending. Fill only after real validation.
