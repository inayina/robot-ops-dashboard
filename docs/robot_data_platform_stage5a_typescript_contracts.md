# Robot Data Platform Stage 5A：TypeScript Contracts

## 当前范围

Stage 5A 只建立 TypeScript strict、Vite build、Zod runtime schema 与 contract tests。
现有 `frontend/index.html` 继续加载 `frontend/app.js`，因此本阶段不改变 Dashboard
的运行行为、DOM、WebSocket、WMS 或 Motor bench 路径。

## Contract 边界

- `management.ts` 对应 Platform `/v2` 的 Robot、Device、Runtime、RuntimeSession。
- `dataPlatform.ts` 对应 `/data/v1` 的 Run、Episode、Artifact、Dataset、
  DatasetVersion、ProcessingJob、EvaluationRun、FailureCase 与 Telemetry。
- Platform wire response 必须先通过 Zod schema，之后才能成为 typed object。
- `metadata`、`result`、`evidence` 等开放 JSON 在未形成下游稳定契约前保持
  `unknown`，消费者必须进一步验证后才能读取字段。
- Management Plane prefixed ID 与 Robot Data Plane UUID 使用不同 branded type。
- Go `omitempty` 字段按 optional 建模，不把缺失与 `null` 混为一谈。

## HOC 边界

`HOCContext` 只定义未来导航上下文。当前 HOC 没有消费 deep-link query contract，
所以任何 replay builder 必须继续返回 `unsupported`；Stage 5A 不声称 replay 已接通。

## Data mode

配置 schema 只允许 `real` 或 `demo`，默认 `real`。Stage 5D 才会把该配置接入
Dashboard runtime，并删除当前自动 offline mock fallback。Stage 5A 中 Agent 尚未实现。

## 验证命令

```bash
cd frontend
npm run typecheck
npm test
npm run build
```

Stage 5A 验收时 build 只生成独立 contract library，不替换页面入口。Stage 5C 已将
实际页面入口接入 Vite，当前产物位于 `dist/frontend/`；本段保留的是 5A 当时边界。
