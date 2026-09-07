# Robot Data Platform BFF 接入设计

状态：已实现并完成本地真实联调（2026-09-07）

## 目标

保留现有 FastAPI + 纯 HTML/CSS/JS 架构，只把三个最高价值的 evaluation
视图从仓内 mock JSON 切换为 `robot-platform-service` HTTP API：

- DatasetVersion registry
- EvaluationRun / Episode lineage
- FailureCase review

Stage 3 增加一个只读 AMR inspection projection。BFF 按
`source_repo + external_id` 查询 Platform Run，再读取 lineage；浏览器不读取 AMR
SQLite、本地 artifact 路径或 ROS 2。

Dashboard backend 是 BFF；浏览器不直连 PostgreSQL、MinIO 或 Platform。

由于 Data Platform 本地 MinIO 占用 `127.0.0.1:9000`，联调时 BFF 使用 9002，
前端可通过 `?api_base_url=http://127.0.0.1:9002` 选择 BFF。原有 9000 默认值保持
兼容；该参数只改变浏览器到 BFF 的地址，不允许浏览器绕过 BFF。

## HTTP 边界

运行时配置：

- `ROBOT_DATA_PLATFORM_BASE_URL`，默认 `http://127.0.0.1:9100/data/v1`
- `ROBOT_DATA_PLATFORM_TIMEOUT_SECONDS`，默认 5 秒
- `HOC_BASE_URL`，默认 `http://127.0.0.1:8080`
- `AMR_INSPECTION_SOURCE_REPO`，默认 `amr_warehouse_sim`
- `AMR_INSPECTION_SOURCE_RUN_ID`，默认 `inspection-run-002`

BFF 保持现有只读路径：

- `GET /api/evaluation/datasets`
- `GET /api/evaluation/runs`
- `GET /api/evaluation/failure-cases`

并增加 `GET /api/evaluation/episodes/{episode_id}` 作为 Episode drill-down。
Stage 3 另增加 `GET /api/inspection/runs`；前端只把返回的 inspection Run 合并到
只读 Run registry，不把它伪装成 EvaluationRun，也不触发导航或重新计算 finding。
Platform 不可达或 contract 错误时返回明确 502；这三个视图不再回退到 mock。
Models、compute、AMR/MQTT 等不在本阶段范围内。

## Replay / Diagnose

FailureCase 返回由 BFF 生成的 HOC 定位 URL，参数包含稳定
`episode_id`、`evaluation_run_id` 和优先 replay artifact URI。当前 HOC 没有消费
这些 query 参数并自动加载对象的实现，因此按钮只建立可审计的 handoff 定位，不能
描述为已执行 replay。HOC 仍拥有 replay/risk/diagnostics 行为。

## 验收

1. BFF 测试使用 HTTP mock 验证 Platform payload 映射，不读取 PostgreSQL。
2. 本地真实联调返回 `source=robot-platform-service`，且 ID/SHA/URI 与 Platform 一致。
3. 浏览器 DatasetVersion 可筛选相关失败样本；FailureCase 可展开 Episode artifacts，
   并打开带稳定定位参数的 Replay / Diagnose 链接。

本次真实验收对象：

- DatasetVersion `01a076a0-158d-73c4-a7ad-320c9b87db15`
- EvaluationRun `01a076a1-3a98-7581-9529-c2981e5aea63`
- FailureCase `01a076a1-3aa3-7618-921c-809da80111d6`
- Episode `01a076a1-3a94-78bd-bc68-a8b09e56aff9`
- Replay artifact `01a076a2-32f8-7315-b723-226f9e274b23`

验收时三个 BFF collection 均返回 `source=robot-platform-service`。浏览器 DOM 显示
DatasetVersion、EvaluationRun、失败原因和稳定 Episode ID，并生成带上述 ID 与
`s3://.../actions.jsonl` URI 的 HOC locator。HOC 尚未实现 query 自动装载，故仍按
`locator_only_hoc_does_not_auto_load_platform_artifact` 标记。
