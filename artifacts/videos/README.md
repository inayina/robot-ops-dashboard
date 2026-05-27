# Videos

本目录用于保存作品集录屏素材。

推荐素材：

- `dashboard-demo-walkthrough.webm`：Playwright 生成的 60-90 秒页面走查。
- `dashboard-demo-final.mp4`：最终剪辑或压缩后的作品集版本。

默认 Playwright 录屏不会触发任务创建或电机命令。需要完整交互时显式传入：

```bash
node scripts/capture_dashboard_artifacts.js --dispatch --motor-demo --record-ms 75000
```
