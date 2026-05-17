# 演进路线图

## 总体思路

路线规划遵循“先可展示、再可接入、后可扩展”的节奏。

V0.1 不引入前端框架，重点把项目定位、边界、数据契约、Mock 数据和最小后端骨架打牢。

## V0.1 文档、Mock 与 Backend Skeleton 基线

目标：

- 明确项目定位为 Robot Operations and Testing Dashboard
- 输出核心设计文档
- 定义任务、设备、告警的统一数据结构
- 提供 Mock 样例数据用于后续联调与演示
- 提供最小 FastAPI 后端骨架，统一暴露本地 mock 数据读取接口

交付物：

- README
- 设计、路线、接口、数据源、页面与测试文档
- `mock/*.json` 示例数据
- `backend/` 下的只读 API 最小实现

## V0.2 AMR HTTP 只读接入

优先级最高。

Current：HTTP REST + WebSocket status stream。

目标：

- 优先对接 `amr_warehouse_navigation` 的 Mock WMS HTTP API
- 拉通 AMR 任务列表、任务状态、异常任务和基础概览
- 建立从上游原始字段到 Dashboard 统一字段的映射层
- 提供 Dashboard Backend 到 Frontend 的只读 WebSocket 状态流

关键成果：

- HTTP 轮询策略
- WebSocket `/ws/status` 状态推送
- 任务状态归一化
- 基础任务告警生成
- 看板原型所需的只读查询接口

## V0.3 设备状态接入

Future：`robot_status_api_bridge` / `motor_state` / `imu_state integration`。

目标：

- 预留并逐步接入 `ros2-robot-digital-twin` 项目的 MQTT / micro-ROS 状态
- 支持设备在线状态、通信状态、基础健康状态聚合

关键成果：

- MQTT topic 约定
- micro-ROS 状态映射
- 设备状态统一模型
- 设备告警基础规则

## V0.4 测试验证视角增强

目标：

- 补充测试任务、测试批次、回归结果和失败原因展示
- 支持现场验证与回归测试看板化

关键成果：

- 测试记录数据结构
- 场景通过率统计
- 失败样本与证据链接
- 测试告警或风险清单

## V0.5 AI 扩展能力

目标：

- 引入机器学习异常分类
- 引入 LLM 诊断建议
- 引入 YOLO 视觉检测结果展示

关键成果：

- AI 结果输入接口
- 可追溯的证据链设计
- 建议与结论分离展示
- 人工确认与反馈闭环预留

## 当前不纳入范围

为了保证节奏清晰，以下内容暂不纳入近期里程碑：

- 直接下发导航控制命令
- 直接控制电机或执行器
- 完整 WMS 功能建设
- 完整 AI 平台建设
- 复杂权限系统与多租户系统

## 推荐里程碑口径

适合对外说明为：

1. 第一阶段先完成 AMR 任务数据接入与只读可视化设计
2. 第二阶段补足设备状态与测试验证链路
3. 第三阶段叠加 AI 辅助洞察能力
