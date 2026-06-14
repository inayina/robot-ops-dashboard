# 页面规划

## 1. 页面设计目标

Dashboard 页面规划服务于两个关键词：

- 运维
- 测试

页面不应只展示 AMR 任务，还要支持设备状态、异常排查和测试验证信息。

## 2. 页面清单

## 2.1 总览页 Overview

用途：

- 快速查看当前机器人系统整体健康度
- 适合项目负责人、运维和值班人员第一眼查看
- 当前首页优先把任务流、阻塞状态、设备链路和告警状态放在首屏摘要中；它不是纯只读页面，但所有交互都必须走显式 backend HTTP API。
- 当前前端首页采用单屏机器人运维驾驶舱布局：顶部固定状态摘要栏；左列收敛为 `Robot Link`、`Event Log` 与 `Safety STOP`；中列以 IMU 姿态、三条加高的数据流泳道和 `Motor Bench Flow` 为核心展示，其中 `单向遥测` 表示 ESP32 / micro-ROS / ROS 2 / MQTT 到 Dashboard 的只读镜像，`任务 HTTP` 表示 Dashboard backend 与 AMR Mock WMS 的读取 / 创建双向交互，`Motor Bench` 表示受限命令下发与状态回传双向链路，速度控制与电机曲线合并在同一数据流卡片中；右列固定为 `Current Task Execution`、`Task Dispatch` 与 `Simulation Preview` 三张主卡片，三张卡在 1366x768 与 1440x900 下保持一屏可见。当前任务执行卡统一展示任务 ID、状态、进度、路线、机器人、阶段、当前步骤与任务统计，长任务 ID 和当前步骤使用单行省略。
- `Robot Link` 与顶部链路状态在收到 live MQTT / micro-ROS 镜像设备时，优先使用 `mqtt_*` 实时设备计算健康状态；`future_*` mock 样例不再主导录屏总览状态，避免真实硬件在线时被 reserved/mock 设备误标为 warning 或 critical。
- `Task Dispatch` 只保留任务类型、起点、终点、下发按钮和一行轻量刷新状态；完整 WMS task list 不在右侧主卡内展示，避免任务列表行数影响单屏布局。
- `Event Log` 显示最近 8 条状态事件，优先记录当前 WMS 任务状态变化、任务下发、电机 bench 命令、告警和连接异常；正常 WebSocket 心跳不再作为泛化事件占用列表空间。
- `Simulation Preview` 通过 `GET /api/sim/preview` 读取连接状态。未配置预览流时显示 Gazebo path view 未连接占位画面；配置 `SIM_PREVIEW_MJPEG_URL` 或 `GAZEBO_CAMERA_MJPEG_URL` 后，前端自动使用返回的 `/api/sim/stream` 切换到真实 MJPEG 画面。该区域不嵌入 RViz、不做 noVNC、不做 WebRTC；上游画面可以是 Gazebo 顶视图，也可以是带 path 的 RViz 视图。
- 首页首屏仍按固定 cockpit 组织，AMR / IMU / Motor / Simulation Preview 主卡片保持一屏可见；首屏下方新增 `Data & Evaluation Layer`，页面允许纵向滚动到第二屏用于作品集截图。卡片使用固定 header/body/footer 分层，长文本统一单行裁剪，NetworkError 等长错误只进入 Event Log，主卡片保留短状态和离线预览占位。
- `System Evaluation & Validation Layer` 固定为只读展示区，面向作品集截图组织为 Hero、纵向流程图、`Experiment Record`、`Failure & Quality Checks`、`ML-ready Features` 三张卡片和 `Current Scope` 说明。该区域通过 `GET /api/evaluation/*` 读取 mock/baseline/reserved 数据；接口不可用时使用前端 `Offline / Mock` fallback，不写数据库、不发布 MQTT、不创建 WMS task。

建议模块：

- 在线机器人数量
- 活跃任务数量
- 阻塞任务数量
- 关键告警数量
- 最近测试批次结果
- 数据源健康状态

## 2.2 AMR 任务页 Tasks

用途：

- 聚焦 `amr_warehouse_navigation` Mock WMS HTTP API 输出的任务流

建议模块：

- 任务列表
- Mock WMS 任务创建表单
- WMS 任务列表手动刷新
- 任务状态筛选
- 按机器人分组查看任务
- 超时/阻塞任务高亮
- 任务详情抽屉或详情页

核心价值：

- 这是 V0.2 最优先落地的页面
- 当前任务创建仅通过 Dashboard backend 的 HTTP proxy 调用 AMR Mock WMS API，不直接控制 Nav2、电机或真实机器人

## 2.3 设备状态页 Devices

用途：

- 承接 `ros2-robot-digital-twin` 的 MQTT / micro-ROS 状态

建议模块：

- 机器人设备树
- 电池状态
- 通信状态
- 传感器健康状态
- MPU6050 / IMU 最新状态：online/offline、last_seen、accel、gyro、temperature、state
- 安全模块状态
- 最近离线事件

## 2.4 告警中心页 Alerts

用途：

- 集中展示任务、设备、网络、测试和 AI 相关告警

建议模块：

- 按严重级别分组
- 按来源分组
- 告警确认状态
- 建议动作
- 证据与上下文链接

## 2.5 测试验证页 Testing

用途：

- 用于展示现场验证、回归测试和专项测试结果
- 当前首页第二屏已提供轻量版 `Data & Evaluation Layer`，用于作品集展示 `run_id`、`dataset_version`、`model_version`、任务成功率、失败样本与 GPU/compute 状态。
- 当前 evaluation 结果只覆盖 `mock_evaluation`、`baseline_system_evaluation` 和 `interface_reserved`，不展示虚构的真实 VLA / RL / world model 成绩。

建议模块：

- 测试批次列表
- 场景通过率
- 最近失败用例
- 失败原因统计
- 环境与版本信息
- Dataset / model registry
- GPU / compute source health

## 2.6 AI 洞察页 AI Insights

用途：

- 展示后续 AI 扩展能力结果

建议模块：

- 机器学习异常分类结果
- LLM 诊断建议
- YOLO 检测结果与截图
- 置信度与人工确认状态

## 3. 页面优先级

推荐优先级如下：

1. 总览页
2. AMR 任务页
3. 告警中心页
4. 设备状态页
5. 测试验证页
6. AI 洞察页

原因：

- 总览页和任务页最容易建立第一阶段可演示主线
- 告警页能够把任务与设备问题连起来
- 设备、测试和 AI 页面适合后续分阶段增强

## 4. V0.1 与 V0.2 的关系

V0.1 只做页面定义与数据准备，不实现前端。

V0.2 开始，建议先围绕以下页面做原型：

- 总览页
- AMR 任务页
- 告警中心页

## 5. 明确不做的页面职责

这些页面只负责展示和解释，不直接承担：

- Nav2 操作面板
- 独立的高频电机控制面板
- 完整 WMS 操作系统
- 完整 AI 平台工作台

补充说明：

- 当前首页 Motor / Encoder 卡片已包含受限控制表单，用于低频 bench 联调。
- 这不等同于提供独立的底盘调参台或实时控制工作台。
- 当前页面口径应表述为 monitoring-first dashboard with explicit interactions，而不是 read-only dashboard。
