# Robot Data Platform Stage 5B：Typed Read-only Client

## 范围

Stage 5B 新增环境无关的 TypeScript `HttpClient` 与 `PlatformClient`，直接对应
`robot-platform-service /data/v1` 当前已实现的 GET API。Stage 5C 已把 TypeScript
模块接入实际页面 dependency graph，但当前 Dashboard evaluation 仍通过 FastAPI BFF
读取 Platform；是否改为浏览器直连要在 Stage 5D 连同 real/demo mode 与 origin policy
一起收敛，不能在 CORS 和部署边界未确认时暗中切换数据路径。

## Transport contract

`HttpClient` 只公开 GET，统一处理：

- 1–60000 ms timeout 与 caller abort；
- request ID；
- network、HTTP status、content type、empty body、invalid JSON；
- Zod runtime response validation；
- 不记录或附带完整 response payload；
- 拒绝 absolute/scheme-relative request path，避免逃逸配置的 Platform origin。

错误统一为 `ApiClientError`，可安全序列化 `kind`、endpoint、request ID、HTTP
status 和 schema issue path。`cause` 不进入 `toJSON()`。

## Current PlatformClient surface

- DatasetVersion list/detail；
- Run exact external lookup、get、lineage；
- Episode exact external lookup、context；
- ProcessingJob get；
- EvaluationRun list/detail；
- FailureCase list；
- Artifact get；
- IMU/runtime metrics latest/range telemetry。

当前 Platform 没有 generic search、pagination、Dataset GET、event query 或 motor
telemetry，因此本 client 不制造这些能力。FailureCase、EvaluationRun、DatasetVersion
list response 仍按当前裸 JSON array contract 解析。

## Read-only boundary

`PlatformClient` 没有通用 request、POST、PUT、PATCH 或 DELETE 方法。WMS task create
和 Motor bench command 后续必须进入独立 Dashboard operations client，Agent 不得获得
该 client。

## 验证

```bash
cd frontend
npm run typecheck
npm test
npm run build
```
