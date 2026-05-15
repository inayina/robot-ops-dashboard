# Robot Operations and Testing Dashboard

## 项目定位

`robot-ops-dashboard` 定位为 **Robot Operations and Testing Dashboard**，用于承接机器人系统的上层运维、测试验证与状态监控需求。

它不是一个单独的 AMR 业务看板，而是面向多类机器人系统、测试流程和现场设备状态的统一观察层，重点服务以下场景：

- AMR 任务执行进度可视化
- 设备健康与通信状态监控
- 测试验证过程留痕与结果汇总
- 异常告警聚合与排障辅助
- 后续 AI 分析结果展示与诊断建议承载

## 当前阶段

当前版本为 `V0.1`，只做以下内容：

- 仓库说明文档
- 页面与数据结构设计
- 纯静态 mock 页面
- Mock 数据样例
- 最小 Python FastAPI 后端骨架
- 上游系统接入预案

当前 **不引入前端框架，不接真实上游接口，不实现数据库、MQTT、WebSocket 或 AI 平台能力**。

当前后端状态：

- 已提供 Backend V0.1 最小骨架
- 只读取 `mock/` 目录下的本地 JSON
- 只提供只读 API，便于后续本地页面或前端联调

当前前端状态：

- 已提供纯静态 mock 页面
- 使用原生 HTML / CSS / JavaScript
- 直接读取 `mock/` 下的本地 JSON 做展示

## 第一阶段优先级

V0.1 到后续 V0.2 的首要工作，是优先对接 `amr_warehouse_navigation` 的 **Mock WMS HTTP API**，先把 AMR 任务流、任务状态和基础告警链路跑通。

在此基础上，后续预留两条扩展方向：

- 对接 `ros2-robot-digital-twin` 项目的 MQTT / micro-ROS 下位机状态数据
- 引入机器学习异常分类、LLM 诊断建议、YOLO 视觉检测结果展示

## 项目边界

本仓库负责的是“观察、聚合、解释、展示”，不直接承担底层控制职责。

明确不做的事情：

- 不直接控制 Nav2
- 不直接控制电机、底盘或执行器
- 不承担完整 WMS 职责
- 不承担完整 AI 平台职责

换句话说，这个仓库更像一个“机器人系统运维与测试驾驶舱”，而不是导航控制器、机器人固件平台或完整业务中台。

## 预期能力

后续版本预计围绕以下几个能力域展开：

1. 任务运维看板：任务状态、异常任务、机器人分配、任务耗时统计
2. 设备状态看板：电池、通信、传感器、底盘、安全模块等状态汇总
3. 测试验证看板：测试批次、回归结果、场景通过率、关键失败点
4. 告警中心：按严重级别聚合系统异常、设备异常和测试异常
5. AI 辅助中心：异常分类、诊断建议、视觉检测结果展示

## 仓库结构

```text
robot-ops-dashboard/
├── README.md
├── docs/
│   ├── design.md
│   ├── roadmap.md
│   ├── api_contract.md
│   ├── data_sources.md
│   ├── dashboard_pages.md
│   ├── integration_amr_http.md
│   ├── integration_mqtt_device.md
│   ├── ai_extension_plan.md
│   ├── test_plan.md
│   └── commit_convention.md
├── mock/
│   ├── sample_amr_tasks.json
│   ├── sample_device_status.json
│   └── sample_alerts.json
├── backend/
│   ├── __init__.py
│   ├── README.md
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── config.py
│       ├── main.py
│       ├── schemas.py
│       └── services/
│           ├── __init__.py
│           └── mock_data_service.py
└── frontend/
    ├── index.html
    ├── app.js
    └── styles.css
```

说明：

- `docs/` 用于沉淀设计、范围、接口契约与路线规划
- `mock/` 用于提供前后续开发、联调和演示的样例数据
- `backend/` 当前提供最小 FastAPI 只读后端骨架
- `frontend/` 当前用于本地静态 mock 页面展示

## 文档导航

- [总体设计](docs/design.md)
- [演进路线](docs/roadmap.md)
- [数据接口契约](docs/api_contract.md)
- [数据源规划](docs/data_sources.md)
- [页面规划](docs/dashboard_pages.md)
- [AMR HTTP 集成方案](docs/integration_amr_http.md)
- [MQTT / micro-ROS 集成方案](docs/integration_mqtt_device.md)
- [AI 扩展规划](docs/ai_extension_plan.md)
- [测试计划](docs/test_plan.md)
- [提交命名规范](docs/commit_convention.md)

## 适合展示的项目描述

如果后续需要用于 GitHub 首页说明或简历描述，可以概括为：

> 面向机器人系统运维、测试验证与状态监控的上层 Dashboard 设计仓库，首期围绕 `amr_warehouse_navigation` Mock WMS HTTP API 建立统一数据契约与可视化规划，并为 MQTT / micro-ROS 设备接入、机器学习异常分类、LLM 诊断建议与 YOLO 视觉结果展示预留扩展能力。
