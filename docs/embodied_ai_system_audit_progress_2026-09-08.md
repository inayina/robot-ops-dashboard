# 具身智能系统架构审计进度同步（2026-09-08）

> 本文是 `docs/embodied_ai_system_audit.md` 的当前进度补充，不重写 2026-07-20 的历史审计。
> 当前工作分支：`feat/robot-data-platform-dashboard`。
> 本次只同步架构与实施状态，不新增 Agent、不改变运行行为。

## 1. 当前阶段结论

项目已经从“多个机器人 Demo / 子系统并列”进入“统一平台对象、数据平面、运行态与交互层收口”的阶段。

当前重点不再是继续横向增加新仓库或新算法，而是：

1. 保持各仓 authority / evidence boundary 清晰；
2. 用 `robot-platform-service` 统一 Robot / Device / Runtime / Run / Episode / DatasetVersion / EvaluationRun / FailureCase / Artifact / Telemetry 等平台对象；
3. 用 `robot-ops-dashboard` 作为上层工作台，通过 typed contract / BFF / read-only client 消费这些对象；
4. 在已有 typed object 与 HOC context 基础上，再决定 Agent 的信息架构、tool trace、evidence binding 和 side-effect confirmation，而不是先做一个聊天框。

因此，当前开发阶段可概括为：

```text
机器人执行与采集层
  ├─ ros2-arm-teleoperation-suite
  ├─ amr_warehouse_navigation
  ├─ ros2-robot-digital-twin
  └─ robot-control-runtime
            │
            ▼
数据 / 管理平台层
  ├─ robot-arm-episode-data-lab
  ├─ robot-platform-service
  └─ ros2-moveit-pybullet-bridge
            │
            ▼
工作台 / 交互层
  └─ robot-ops-dashboard
            │
            ▼
下一阶段：Agent UX / Architecture
```

Agent 的定位应是 **现有平台对象的交互与编排层**，不是新的事实源，也不能绕过控制边界。

---

## 2. 各主仓当前状态

### 2.1 `ros2-arm-teleoperation-suite`

定位已经收口为 Panda 三仓系统的上游：**Execution / Acquisition / Task-GT**。

当前主能力：

- ROS 2 Jazzy + MoveIt Servo + `ros2_control` + MuJoCo；
- C++ safety monitor、500 Hz 笛卡尔阻抗控制；
- 虚拟 CANopen / DS402；
- 场景 / 腕部 RGBD 与触觉采集；
- LeRobot episode 录制与上游物理任务门禁。

当前 learned-policy 的权威结论仍是：Route A Reach `1/4`、Grasp `0/4`、Lift `0/4`；Route B 是 Isaac–ROS observation/control-state 前置条件阻塞，不能写成策略任务失败。

**审计边界：** 没有真实 Panda，没有完成 Sim2Real；scripted oracle 可完成任务只说明仿真执行环境可行，不代表学习策略成功。

### 2.2 `robot-arm-episode-data-lab`

定位为三仓机械臂系统中游：**Dataset Contract / Training / Evaluation / Handoff**。

当前已形成：

- schema 与动作语义适配；
- non-overwrite / SHA 锁定 release；
- ACT / SmolVLA 等训练验证负载；
- Data / Offline / Interface / Behavior / Task / System 分层评测；
- framework-neutral JSONL handoff；
- 跨仓 contract CI。

核心原则保持：loss 下降、open-loop Pass、interface Pass、加载成功都不能升级为抓取成功。

### 2.3 `ros2-moveit-pybullet-bridge`

定位为下游 **Handoff Replay / Distribution & Risk Monitoring / HOC**。

当前已形成：

- handoff fail-fast 校验；
- `PolicyRunner` 开环 JSONL replay；
- `PandaActionAdapter`；
- KL / W1 / MMD 分布监控；
- risk engine 与 Hold / E-Stop 接线验证；
- Brain / Execution / Safety / Task-GT 四泳道 HOC。

**审计边界：** `PolicyRunner` 是 replay harness，不是在线 policy brain；risk readiness / HOC 绿灯不等于任务成功；默认 safety bridge 仍保持 dry-run 边界。

### 2.4 `amr_warehouse_navigation`

AMR 已从最初的单车 Nav2 Demo 扩展为：

- Gazebo + SLAM Toolbox + Nav2 稳定单车基线；
- Mock WMS SQLite / CLI / HTTP / executor；
- 最小 Fleet / EMS 学习抽象：Registry、Dispatcher、haul FSM、heartbeat reassignment、resource lock；
- vendor integration 保持 opt-in、state-only；
- 独立 Gazebo inspection reference scenario，包含真实 simulated movement、RGB frame、确定性视觉规则、PNG/JSON/SQLite evidence。

当前 inspection reference 结果为 `2 PASS + 1 WARNING`。

**审计边界：** Fleet 多机行为主要在 `SimulatedRobotContext + pytest` 验证，Gazebo/Nav2 双车 demo deferred；vendor state-only 不能写成 heterogeneous concurrent task execution。

### 2.5 `ros2-robot-digital-twin`

当前内容已经从“数字孪生”泛化命名收口为 **Real-Hardware State And Motor Control** 子系统。

主链路：

```text
STM32F411 + MPU6050
  -> UART
ESP32-S3 + micro-ROS
  -> ROS 2
  -> MQTT/backend
  -> Robot Ops Dashboard
```

同时保留 Dashboard -> MQTT -> ROS 2 -> ESP32 -> N20 motor bench 的低频、受限命令链。

**审计边界：** Dashboard frontend 不直连 ROS 2 / ESP32；当前不引入 `ros2_control` 作为主链；硬件状态链与 motor bench evidence 不能升级为整机量产控制结论。

### 2.6 `robot-control-runtime`

当前已收口为 **ROS-free C++20 Linux edge runtime + commissioning workbench**。

核心能力：

- `RuntimeDaemon` 状态机、watchdog、session / sequence / deadline command admission；
- device supervision、fault / recovery；
- SocketCAN 生命周期；
- Modbus RTU agent；
- Qt commissioning workbench；
- release manifest / hash、diagnostics、incident RCA、rollback contract。

核心 ownership 原则已经明确：控制 authority 留在 Orange Pi edge runtime，不交给 Qt、网络或上层平台。

**审计边界：** 当前 local release candidate、vcan / loopback / dirty physical smoke 与完整 physical acceptance 分层记录；物理闭环验收仍 OPEN / DEFERRED；不声称 PREEMPT_RT、hard realtime、功能安全、工业伺服或生产控制器。

### 2.7 `robot-platform-service` · `feat/robot-data-platform-mvp`

Data Platform 分支已经成为当前跨仓收口的核心基础设施。

当前存储职责：

- PostgreSQL：identity / lifecycle / lineage / Event；
- MinIO：大对象 Artifact；
- TDengine：连续 IMU / Runtime numerical telemetry；
- SQLite：仅保留 legacy v1 对象。

当前已实现 / 接入的关键阶段：

- Panda existing episode / artifact vertical slice；
- AMR existing inspection run vertical slice；
- ProcessingJob 最小状态机与 Data Lab worker；
- EvaluationRun / FailureCase / Episode lineage；
- Stage 4 Online Telemetry Data Plane；
- Dashboard BFF / HOC handoff 所需的数据对象。

**审计边界：** Platform 只做管理与数据平面，不参与实时控制；Platform 离线不得改变 Runtime watchdog / device supervision / safety ownership；AMR / Panda 的 domain authority 仍留在源仓，Platform 不重判任务真值。

### 2.8 `robot-ops-dashboard` · `feat/robot-data-platform-dashboard`

这是当前最明显的阶段推进点。

与 `main` 相比，当前分支已完成两次阶段提交，并新增了 Robot Data Platform BFF、Vite / TypeScript 工程、typed contracts、read-only client、feature/state/realtime 模块。

#### Stage 5A：TypeScript Contracts — 已完成

- Vite + TypeScript strict；
- Zod runtime schemas；
- branded IDs；
- management / data platform / dashboard / HOC contracts；
- contract tests。

#### Stage 5B：Typed Read-only Client — 已完成

- `HttpClient` 统一 timeout / abort / request-id / network / HTTP / JSON / schema error；
- `PlatformClient` 当前覆盖 DatasetVersion、Run、Run lineage、Episode context、ProcessingJob、EvaluationRun、FailureCase、Artifact、Telemetry；
- client 保持 GET-only；
- WMS create 与 Motor bench command 不进入该 client，未来 Agent 也不得获得 operations client。

#### Stage 5C：Feature / State / Realtime Modules — 已完成

- `DashboardStore`；
- HTTP polling / WebSocket snapshot 竞争处理；
- `statusSocket` lifecycle / reconnect / schema validation；
- WMS / robotStatus / evaluation 无 DOM model；
- `index.html -> src/main.ts -> app.js -> typed modules` 已成为真实 dependency graph；
- 保留现有 DOM renderer，没有引入 React / Redux / Zustand。

当前 `main.ts` 标识为 `stage-5c.v1`。

HOC 侧已经定义：

- `HOCArtifactLocator`；
- `HOCContext`：episode / evaluation run / failure case / dataset version / artifact；
- `HOCReplayResolution`：`unsupported | ready`。

这意味着下一步可以围绕稳定 ID、evidence 和 replay handoff 设计 Agent 交互，而不需要重新发明对象模型。

---

## 3. 当前系统层级重新审计

2026-07 的六仓审计已经不能完整描述当前系统。更准确的当前结构是：

### A. Robot / Execution Plane

- Panda control & acquisition
- AMR navigation / inspection
- STM32 / ESP32 real-hardware state & motor bench
- Orange Pi edge runtime

### B. Data / Management Plane

- Robot / Device / Runtime identity
- Run / Episode / DatasetVersion
- ProcessingJob
- EvaluationRun / FailureCase
- Artifact
- Telemetry / Event

### C. Validation / Replay Plane

- Data Lab layered evaluation
- Handoff
- PyBullet replay
- Distribution / risk
- HOC evidence lanes

### D. Operations / Experience Plane

- Dashboard BFF
- typed frontend contracts
- state / realtime / feature modules
- future Agent interaction layer

因此项目当前的核心价值已经从“我做了很多机器人模块”逐渐变成：

> **把机器人执行、数据、评测、运行态、证据和运维入口做成有边界、有 contract、有 lineage 的系统。**

---

## 4. 当前已知架构债务 / 不一致

以下问题需要保留在审计里，不能因为 Stage 5C 完成而忽略：

1. **Dashboard 文档 authority 不一致。** 当前分支已经使用 Vite + TypeScript，但旧 `README.md` / `AGENTS.md` 中仍有“纯 HTML/CSS/JS、不引入 Vite”的历史约束，需要后续单独做 docs closeout；今天不修改代码或扩大范围。
2. **BFF vs browser direct Platform 尚未最终收敛。** 当前 evaluation / operations 仍经 Dashboard FastAPI BFF；`PlatformClient` 已存在，但是否浏览器直连要和 CORS、部署 origin、real/demo policy 一起决定。
3. **real / demo mode 尚未完全收口。** Stage 5D 仍需处理当前 fallback 与显式数据模式隔离。
4. **HOC replay 尚未自动执行。** 当前有 stable context / handoff contract，但 HOC 不会自动装载 artifact URI；不能把 contract 写成 replay 已接通。
5. **Agent 尚未实现。** 当前所有 Agent 相关结论只能表述为 architecture readiness / contract readiness。
6. **Agent 必须保持 read-only-by-default。** Robot control、Motor bench、WMS task create 等 side-effect path 不应被 Agent 直接获得；未来若提供动作能力，应采用 proposal -> human confirmation -> bounded execution。
7. **源仓 authority 不能被 Platform / Agent 改写。** Task-GT、AMR inspection result、evaluation evidence 仍由对应源系统判定，Platform/Agent 只查询、组织和解释。

---

## 5. Stage 5 当前进度重新标定

```text
Stage 5A  Vite + TypeScript strict + contracts        DONE
Stage 5B  typed read-only Platform client             DONE
Stage 5C  feature / state / realtime runtime modules  DONE

当前暂停开发：2026-09-08

Stage 5D  Agent UX / architecture reference study     NEXT
Stage 5E  Agent tool registry                         NOT STARTED
Stage 5F  Agent runtime / orchestrator                NOT STARTED
Stage 5G  evidence-aware answer / tool trace UI       NOT STARTED
Stage 5H  HOC replay proposal + confirmation          NOT STARTED
```

今天的决策是：**不继续开发 Agent，先研究成熟 Agent / observability / enterprise data 产品的信息架构。**

研究重点不是“聊天框长什么样”，而是：

- Agent 在工作台中的位置；
- typed objects 如何成为对话上下文；
- tool call / progress / failure 怎么可视化；
- answer 如何绑定 Run / Episode / FailureCase / Artifact / Telemetry evidence；
- side-effect action 如何 proposal / confirm；
- HOC replay 如何作为可审计动作而不是黑盒自动执行。

---

## 6. 下一阶段设计原则（尚未实施）

未来 Agent 若进入实现，应遵循以下原则：

```text
Natural Language
      ↓
Agent / Orchestrator
      ↓
Typed read-only tools
      ↓
Platform APIs / Dashboard BFF
      ↓
Run · Episode · DatasetVersion · EvaluationRun
FailureCase · Artifact · Telemetry · Runtime
      ↓
Evidence-aware answer
```

写操作必须是另一条路径：

```text
Agent suggestion
      ↓
Proposed action
      ↓
Human confirmation
      ↓
Bounded operation / HOC replay
```

Agent 不直接进入底盘高频控制、Runtime watchdog、安全回路或硬件控制 authority。

---

## 7. 本次同步结论

截至 2026-09-08，项目的短板已经不再主要是“缺一个数据库 / 缺一个 API / 缺一个机器人 Demo”。

当前最值得投入的下一步是 **Agent 产品架构与交互范式研究**，然后基于现有 typed contracts、Platform object model、HOC context 和 evidence boundary 做小步实现。

在完成参考研究之前，不继续扩大 Stage 5 实现范围。
