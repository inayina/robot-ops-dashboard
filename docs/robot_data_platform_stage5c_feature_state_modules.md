# Robot Data Platform Stage 5C：Feature / State Modules

## 当前范围

Stage 5C 将 TypeScript 模块接入 Dashboard 的真实运行入口，同时保持现有 HTML、CSS
和 DOM renderer。没有引入 React、Redux 或 Zustand，也没有改变 Motor/WMS 的写操作
边界。页面继续通过 Dashboard FastAPI BFF 获取 operations 与 evaluation 数据；浏览器
直连 Platform 的部署与 real/demo policy 留给 Stage 5D。

## 模块边界

- `state/dashboardStore.ts` 统一持有 section snapshot、IMU/Motor snapshot、HTTP refresh
  锁、transport connectivity 和 evaluation selection。
- store 用 observation timestamp 解决 HTTP polling 与 WebSocket 的竞争：旧 HTTP snapshot
  不得覆盖较新的 stream snapshot；时间相同时 WebSocket 优先。
- `realtime/statusSocket.ts` 负责 socket lifecycle、重连和 `dashboard_status` runtime
  validation。无效 JSON 或 schema drift 不进入 renderer。
- `features/wms/model.ts`、`features/robotStatus/telemetry.ts`、
  `features/evaluation/model.ts` 持有无 DOM 的 transform，可独立测试。
- `app.js` 暂时保留 DOM 查询、rendering 和现有 interaction；它通过只读 store view
  消费状态，不再直接写 `cachedPayloads` 或 transport/telemetry 全局变量。

## Runtime 入口

`index.html -> src/main.ts -> app.js -> typed modules`

Vite base 固定为 `/frontend/`，与当前脚本和录屏 URL 保持一致。四条本地启动链已改为
启动仓内锁定版本的 Vite；缺少 `frontend/node_modules/.bin/vite` 时 fail closed，并提示
先安装依赖。生产 build 输出到 ignored 的 `dist/frontend/`。

## 证据边界

- Stage 5C 是前端工程化与静态/浏览器冒烟证据，不是硬件、任务成功或 Sim2Real 验收。
- 当前 evaluation fallback 行为尚未在本阶段移除；显式 real/demo 隔离属于 Stage 5D。
- `PlatformClient` 保持唯一的 read-only TypeScript Platform transport，但 Dashboard 当前
  BFF 数据路径尚未改为浏览器直连，不声称已完成最终共享消费闭环。
- HOC replay contract、read-only Agent 和 Agent evaluation 不在 5C 范围。

## 验证

```bash
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
bash -n scripts/start_dashboard_api_stack.sh \
  scripts/start_motor_control_chain.sh \
  scripts/start_microros_sensor_stack.sh \
  scripts/run_amr_dashboard_recording_demo.sh
```

此外应在临时 Vite 服务上打开 `/frontend/`，确认页面主标题可见、无 page error。
backend 未启动时出现 HTTP/WebSocket connection refused 属预期 disconnected 状态，
不能记为 live integration PASS。
