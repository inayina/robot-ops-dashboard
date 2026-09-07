# PROJECT_NARRATIVE — robot-ops-dashboard（求职叙事）

> 本文档是 `robot-ops-dashboard` 的求职叙事索引：定位 → 技术栈 → 核心能力与边界 → 验证与证据现状 → 能证明/不能证明 → 跨仓集成 → 已知问题 → 面试可讲点 → 边界声明。
> 证据纪律约定（与 WS3 审计报告一致）：【已实现】= 直接代码/文件证据；【文档声明】= README / docs / AGENTS.md 原文；【推断】= 基于证据的合理推断；【未确认】= 未实际运行验证。
> 事实依据：只读审计报告 `ws3_amr-dashboard.md`（2026-08-05）+ 仓库内代码与文档；本文档不新增任何未经审计的数字。

---

## 1. 仓库定位

- GitHub 仓库名：`inayina/robot-ops-dashboard`（本地路径 `~/workspace/robot-ops-dashboard`）。
- 一句话定位：**Robot Operations Dashboard** —— 机器人系统上层运维、数据链路与评测展示驾驶舱，聚合 AMR 任务流、设备状态、告警、本地联调入口与只读 evaluation 展示层。
- 当前阶段：**`monitoring-first with explicit interactions`**（监控优先 + 显式受限交互）——是**运维与测试驾驶舱，不是 Nav2 控制台、不是底盘级高频闭环、不是完整机器人控制器**。【已实现】AGENTS.md 与 README「当前展示口径」逐条一致。
- 三件可被追问的设计决策：① 前端纯静态（无框架/构建工具）；② 后端零 ROS 2 / Nav2 / Gazebo 依赖；③ AMR 集成边界保持在 HTTP API 层。

## 2. 技术栈

| 层 | 技术 | 证据 |
|---|---|---|
| 前端 | 纯 HTML / CSS / JS（`frontend/index.html` 591 行、`styles.css` 4632 行、`app.js` 3755 行），无 React/Vue、无 Vite/Webpack | 【已实现】与 AGENTS.md 前端约束一致 |
| 后端 | FastAPI + pydantic v2 + httpx + MQTT 客户端（`backend/app/`），**零 ROS 依赖** | 【已实现】与 AGENTS.md 后端约束一致 |
| 数据 | `mock/*.json` 8 个样例文件 + `backend/data/eval_runs/sample_eval_run.json`（评测展示层） | 【已实现】 |
| 测试 | pytest：`backend/tests/` 7 个测试文件；**无 CI**（仓库无 `.github/`）；`package.json` 的 test 为占位 stub | 【已实现】测试文件存在；无 CI【推断】 |
| 配置 | `config.py` 全部运行时配置来自环境变量 | 【已实现】与 AGENTS.md 配置约束一致 |

## 3. 核心能力与落地（monitoring-first 边界内的能力）

### 3.1 HTTP adapter 读 AMR API 【已实现】

- `services/amr_http_service.py`：`GET /health`、`GET /tasks`、`POST /tasks`（httpx，`trust_env=False`）。
- WMS proxy：`GET /api/wms/tasks`（main.py:846，上游原样透传）；`POST /api/wms/tasks`（main.py:854，`build_wms_create_payload` 生成 `{target_name, task_name}` → 上游 `POST /tasks`；`WmsTaskCreateRequest` 限 4 个点位：`station_a / station_b / dock_a / start_zone`）。
- 契约一致性：`docs/api_contract.md` 的 WMS proxy 契约与代码完全一致；`docs/wms_task_proxy_design.md` 标注「已实现」（非草案）。【已实现】审计比对确认。

### 3.2 WebSocket `/ws/status` + MQTT 状态接入 【已实现】

- `/ws/status`（main.py:878）：3 秒心跳推送 + MQTT 消息触发广播（`StatusWebSocketHub`）。
- MQTT 订阅 `robot/state`、`robot/imu`、`robot/motor/status`、`robot/alarm`，内存缓存，`GET /api/robot/status` 读取。
- IMU / robot state 保持**只读镜像**，不做回写。【已实现】

### 3.3 受限电机 bench 命令 【已实现】（限幅即边界）

- `POST /api/robot/motor/cmd`（main.py:829）→ MQTT `robot/motor/cmd` 发布。
- 硬限幅：RPM ≤ 80、PWM ≤ 0.25、timeout 100–5000ms、wheel Ø 0.065m——「低频、受限、显式 bench 命令」边界的代码体现。【已实现】

### 3.4 前端健壮性与展示口径 【已实现】

- 断连不白屏：`app.js` 多处 `disconnected` 状态分支 + HTTP 轮询回退。【已实现】
- 前端 4 任务点下拉（`app.js:116 WMS_TASK_POINTS`）↔ `schemas.py TaskPointName` 一致（`station_a/station_b/dock_a/start_zone`）。【已实现】
- 端口口径一致：AMR API 8000 / backend 9000 / 前端 8001 / micro-ROS 8888（README ↔ `config.py` ↔ `app.js:1`）。【已实现】
- Evaluation 展示层（观察项）：`GET /api/evaluation/*`（main.py:768-795）纯 mock / baseline / read-only；README 明确「不宣称已有真实 VLA / RL / world model 训练结果」，GPU 未接入时显示 `not_connected`。【已实现】属有意定位。

## 4. 验证与证据现状

- `backend/tests/` 7 个 pytest 文件存在：`test_evaluation_api`、`test_microros_imu_bridge`、`test_motor_command_api`、`test_mqtt_robot_status`、`test_system_validation_summary`、`test_task_mapper`、`test_tasks_api`。【已实现】
- **未实际运行 pytest**（审计只读约束，避免写入 `.pytest_cache`）→ 通过与否【未确认】。
- **无 CI**：仓库无 `.github/`；`package.json` test 为占位 stub（`echo "Error: no test specified"`）。【推断】
- 文档体系：`docs/` 26 份设计/契约/验证文档；`scripts/` 12 个启动/验证/录屏脚本；`artifacts/` 截图与验证报告。【已实现】
- git：HEAD `d058f57`（2026-06-14），10 个提交（2026-05-16 → 06-14）；**工作区未提交**：`M README.md` + `?? docs/embodied_ai_system_audit.md`。【已实现】

## 5. 能证明 / 不能证明清单

**能证明（代码/文件级证据）**
- 前端纯静态、后端零 ROS 依赖、HTTP 集成边界在 adapter 层。【已实现】
- HTTP adapter 3 端点、WMS proxy 契约、WS 心跳 + MQTT 广播、受限电机命令硬限幅参数全部有代码证据。【已实现】
- 契约一致性：`api_contract.md` / `wms_task_proxy_design.md` ↔ 代码一致；端口与点位口径一致。【已实现】
- 跨仓状态映射覆盖 amr 全部 5 种状态（见 §6）。【已实现】

**不能证明（未验证）**
- 7 个 pytest 是否通过（未运行）。【未确认】
- MQTT / WebSocket / HTTP 的运行时联调行为（未启动任何服务）。【未确认】
- GitHub 远端状态（未核对；本地 HEAD 在 `main`）。【未确认】
- 文档中 `/api/v0/*` 为早期建议命名，不代表已实现（代码中无 `/api/v0` 路由，grep 为空）。【已实现】澄清。

## 6. 跨仓集成关系（消费 amr_warehouse_navigation）

审计逐端点核对，dashboard 消费 amr Mock WMS HTTP API：

- **3 端点一致**：`GET /health`、`GET /tasks`、`POST /tasks` 在 amr 侧全部存在、方法一致、payload 契约匹配（`{target_name, task_name}` 与上游要求完全吻合）。【已实现】
- **状态映射 5 种全覆盖**：`task_mapper.py` 覆盖 amr 全部 5 种状态（`pending→queued`、`running→running`、`succeeded→completed`、`failed→failed`、`canceled→cancelled`）。【已实现】
- payload 兼容三种响应形状（list / `{"data":[]}` / `{"tasks":[]}`）。【已实现】
- 默认端口一致：`AMR_API_BASE_URL=http://127.0.0.1:8000` ↔ amr API 默认 `--port 8000`。【已实现】
- 边界清晰：dashboard 不调用 `PATCH /tasks/{id}/status`（状态回写由 amr executor 负责）；dashboard 不直接调度 Nav2。【已实现】
- 前端任务名闭环：`parse_dashboard_task_name` 解析 `dashboard_transport_<pickup>_to_<dropoff>_…` → 还原 pickup/dropoff，与 dashboard 生成的 task_name 格式闭环。【已实现】

## 7. 已知问题（如实列出）

1. **无 CI（中）**：7 个 pytest 已存在但无自动化执行入口；`package.json` test 为 stub（amr 仓有现成 `python-test.yml` 模板可抄）。
2. **工作区未提交（中）**：`README.md` 已修改（+65/-2）、`docs/embodied_ai_system_audit.md` 未跟踪 → GitHub 展示与本地不一致风险，需提交或清理。
3. **跨仓 D1（中）**：前端 dropoff 下拉含 `start_zone`（schemas 允许），但上游 Mock WMS 白名单不含 `start_zone` → 用户手动选择时上游 `POST /tasks` 返回 400。
4. **跨仓 D3（低-中）**：前端暴露的 `dock_a` 在上游实际落到 `candidate_dock_a`（未完成正式 3 轮验证），叙述口径需统一。
5. `api_contract.md` 的「已实现接口」清单混入 `/api/v0/*` 占位（已注明不代表已实现，面试被追问需主动澄清）（低）。
6. README 未记录后端 pytest 测试入口（低）。

## 8. 面试可讲点

1. **monitoring-first 架构取舍**：「监控优先 + 显式受限交互」——为什么一个机器人项目刻意不做高频控制：边界即安全设计。
2. **受限电机命令的硬限幅设计**：RPM ≤ 80 / PWM ≤ 0.25 / timeout 范围——「安全边界如何在代码里落地」的具体答案。
3. **跨仓 HTTP 契约对齐**：双端端点/方法/payload 一致、状态机映射 5 状态全覆盖、三种响应形状兼容——系统集成岗位的硬素材，比「我会 ROS」更有说服力。
4. **断连不白屏的前端健壮性**：disconnected 分支 + HTTP 轮询回退。
5. **边界诚实**：Evaluation 层明确标注 mock / baseline / reserved，不宣称训练结果；GPU 未接入显示 `not_connected` 不填假数据——面试追问下是加分项。

## 9. 边界声明

- Dashboard 是**运维与测试驾驶舱，不是 Nav2 控制台**；不提供控制 Nav2 的能力。
- IMU / robot state 为**只读镜像**；电机命令仅低频、受限、显式的本地 bench 入口；不提供底盘级高频闭环、多机器人编排或真实机器人完整控制。
- **不宣称真实 VLA / RL / world model 训练结果**：Evaluation 数据仅表示 `mock_evaluation`、`baseline_system_evaluation` 或 `interface_reserved`。
- 7 个 pytest 未在当前环境实际运行复核；本文档所有「一致」结论基于代码与文档静态比对，未做真实 HTTP 联调。
