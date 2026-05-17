# AGENTS.md

本文件用于约束后续 AI/Codex 对本仓库的修改。

## 仓库定位

- 本仓库是 `robot-ops-dashboard`。
- 当前定位是 Robot Operations Dashboard。
- 当前主要用途是读取 AMR Mock WMS HTTP API，并展示 AMR 任务状态。
- Dashboard 是观察与监控层，不是机器人控制器。

## 当前阶段

- 当前阶段是 `read-only monitoring`。
- 不提供控制 Nav2 的能力。
- 不提供控制电机、底盘或真实机器人的能力。
- 不允许增加会改变上游机器人行为的隐藏副作用。

## 前端约束

- 前端继续保持纯 HTML/CSS/JS。
- 不允许擅自引入 React、Vue、Svelte、Angular 等前端框架。
- 不允许擅自引入 Vite、Webpack、Parcel、Next.js 等前端构建工具。
- 除非已有设计文档批准，否则保持轻量静态前端结构。
- 网络失败或后端不可用时，前端必须显示 `disconnected` 或明确错误状态，不能白屏。

## 后端与集成约束

- Dashboard backend 通过 HTTP adapter 读取 AMR API。
- Dashboard backend 不直接依赖 ROS 2、Nav2 或 Gazebo。
- 不允许把 `amr_warehouse_navigation` 的 ROS 2/Nav2/Gazebo 代码复制进本仓库。
- AMR 集成边界保持在 HTTP API 层。
- 修改时优先保持 API contract 稳定。
- 如确需调整 API contract，优先采用向后兼容的增量变更。

## 配置约束

- 集成配置必须通过环境变量或 config 模块管理。
- 不要把 `AMR_API_BASE_URL`、`ROBOT_OPS_TASK_SOURCE` 等运行时配置写死在业务逻辑里。
- 默认值可以放在 config/bootstrap 层，但业务逻辑应从配置读取。

## 变更流程

- 如需新增 `POST /tasks`、WebSocket、MQTT、多机器人编排或任何真实控制能力，必须先写设计文档。
- 设计文档应放在 `docs/` 下，再进入实现阶段。
- 不要在缺少设计文档的情况下直接实现重大能力扩展。
- 所有变更必须符合当前 monitoring-first 的仓库边界。

## 脚本与验证

- 新增脚本必须放在 `scripts/` 下。
- 验证脚本应验证 HTTP API 路径和数据映射行为。
- 常规测试或验证脚本不能要求启动 ROS 2、Nav2 或 Gazebo。
- 不要增加依赖真实机器人硬件的验证步骤。

## 文档约束

- 文档默认使用中文编写。
- 任何有实际影响的代码修改，都应同步更新 `README.md` 或 `docs/` 下的相关文档。
- 文档内容必须与仓库实际行为和约束保持一致。
- 修改 API 行为时，必须记录新的接口契约或使用流程。

## 修改风格

- 保持代码库简单，便于本地开发和演示。
- 优先做小而明确的修改，不做无设计依据的大型迁移。
- 除非文档明确批准扩展，否则始终尊重当前只读监控边界。
