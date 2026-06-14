# Videos

本目录用于保存作品集录屏素材。

推荐素材：

- `dashboard-demo-walkthrough.webm`：Playwright 生成的 60-90 秒页面走查。
- `dashboard-demo-final.mp4`：最终剪辑或压缩后的作品集版本。

默认 Playwright 录屏不会触发任务创建或电机命令。需要完整交互时显式传入：

```bash
node scripts/capture_dashboard_artifacts.js --dispatch --motor-demo --record-ms 75000
```

当前仓库已保留：

- `dashboard-demo-walkthrough.webm`：用于 GitHub / 作品集预览的最终页面走查录屏素材，包含 Dashboard、WMS Task Dispatch、硬件遥测、Motor bench 与 Dashboard 内嵌 RViz Path View。

说明：Playwright 录屏只捕获浏览器页面，不捕获桌面上单独打开的原生 RViz / Gazebo 窗口。如需展示 Gazebo 本体窗口，应另行使用桌面录屏工具补录。
