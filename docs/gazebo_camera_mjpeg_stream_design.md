# Gazebo / Path Preview MJPEG Stream 接入设计

## 1. 背景

Dashboard 右侧 `Simulation Preview` 已经有占位画面和 `/api/sim/preview` 查询入口。为了在本地 bench / Gazebo 联调时看到真实的小车路径、本体位姿与运行过程，本设计增加只读 MJPEG 接入：

```text
Gazebo top view / RViz path view / ROS image topic
  -> AMR 侧 MJPEG bridge
  -> Dashboard backend /api/sim/stream
  -> /api/sim/preview 返回 stream_url
  -> Frontend <img> 自动切换为真实画面
```

## 2. 边界

- Dashboard backend 不直接依赖 ROS 2、Nav2、Gazebo、OpenCV 或 RViz。
- Dashboard backend 只通过 HTTP 读取 AMR / Gazebo 侧已经暴露的 MJPEG URL。
- `/api/sim/stream` 是只读媒体代理，不发布 ROS topic，不调用 Nav2，不改变机器人行为。
- Frontend 不直接连接 ROS 2、MQTT 或 Gazebo transport，只读取 backend 返回的 HTTP URL。
- 上游不可用或未配置时，前端必须继续显示 `disconnected` 和占位画面。

## 3. 配置

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SIM_PREVIEW_MJPEG_URL` | 空 | 推荐使用的上游 MJPEG HTTP URL，例如 Gazebo 顶视图或 RViz path 视图 |
| `GAZEBO_CAMERA_MJPEG_URL` | 空 | 兼容旧命名的上游 MJPEG HTTP URL |
| `SIM_CAMERA_MJPEG_URL` | 空 | `GAZEBO_CAMERA_MJPEG_URL` 的兼容别名 |
| `SIM_PREVIEW_LABEL` | `Gazebo Path View` | 推荐使用的前端预览标签 |
| `GAZEBO_CAMERA_LABEL` | `Gazebo Path View` | 兼容旧命名的前端预览标签 |
| `SIM_PREVIEW_SOURCE` | `gazebo_preview` | 推荐使用的 `/api/sim/preview.source` |
| `GAZEBO_CAMERA_SOURCE` | `gazebo_preview` | 兼容旧命名的 `/api/sim/preview.source` |
| `SIM_PREVIEW_PUBLIC_STREAM_URL` | 空 | 推荐使用的浏览器可访问 stream URL |
| `SIM_CAMERA_PUBLIC_STREAM_URL` | 空 | 可选的浏览器可访问 stream URL；为空时 backend 自动返回当前服务的 `/api/sim/stream` |
| `SIM_CAMERA_HTTP_TIMEOUT_SECONDS` | `3` | 连接上游 MJPEG 服务的超时时间 |

## 4. API 契约

### `GET /api/sim/preview`

未配置预览 URL 时返回占位状态：

```json
{
  "source": "mock",
  "connection": "disconnected",
  "stream_url": null,
  "last_update_at": "2026-05-26T10:00:00+00:00",
  "label": "Gazebo Path View"
}
```

已配置合法 HTTP(S) MJPEG URL 时返回：

```json
{
  "source": "gazebo_preview",
  "connection": "connected",
  "stream_url": "http://127.0.0.1:9000/api/sim/stream",
  "last_update_at": "2026-05-26T10:00:00+00:00",
  "label": "Gazebo Path View"
}
```

说明：`connection=connected` 表示 backend 已配置可代理的 HTTP MJPEG 来源。真实上游断流时，`/api/sim/stream` 返回错误，frontend 的 `<img>` 会回退到 `disconnected` 占位画面；后续轮询仍会继续尝试同一条 `stream_url`，便于上游恢复后自动回切真实画面。

### `GET /api/sim/stream`

- 未配置上游 URL：返回 `503`，错误类型为 `sim_stream_proxy_error`。
- 上游 URL 非 HTTP(S)：返回错误，错误类型为 `sim_stream_proxy_error`。
- 上游连接失败或返回错误：返回 `502`，错误类型为 `sim_stream_proxy_error`。
- 成功时返回 `multipart/x-mixed-replace` MJPEG 字节流，并设置 `Cache-Control: no-store`。

## 5. AMR / Gazebo 侧职责

AMR 仓库或 ROS 运行环境负责提供一个能看到小车路径的 MJPEG HTTP 服务，例如：

- Gazebo 顶视图或跟随视角的窗口采集。
- RViz 中带 `map / robot pose / goal / path` 的可视化窗口采集。
- ROS image topic 到 MJPEG bridge：可使用已有的 ROS web video 工具、image transport bridge 或 AMR 仓库内的轻量 HTTP bridge。
- 如果本地 X11 / OpenGL 窗口在 `ffmpeg x11grab` 下出现黑帧，优先改用 `xwd` 截图路径再转成 MJPEG。
- Dashboard 只需要最终的 `SIM_PREVIEW_MJPEG_URL` 或 `GAZEBO_CAMERA_MJPEG_URL`。
- 如果 AMR / Gazebo 当前没有可见路径的预览源，那么需要先在上游补这个输出；仅配置 Dashboard 不会凭空生成真实画面。

该设计不要求 Dashboard 启动 ROS 2、Gazebo 或图像处理节点。
