# Reports

本目录用于保存演示和验证报告，方便作品集复盘。

建议包含：

- Dashboard backend `/health`、`/api/tasks`、`/api/robot/status` 验证结果。
- AMR Mock WMS `/health`、`/tasks` 验证结果。
- MQTT topic 采样记录。
- 录屏前彩排结论。

常用参考文档：

- `docs/portfolio_demo_summary.md`
- `docs/recording_rehearsal_checklist.md`
- `docs/dashboard_demo_storyboard.md`
- `docs/test_plan.md`

最终演示报告：

- `artifacts/reports/final_demo_validation_2026-06-14.md`
- `artifacts/reports/final_demo_validation_2026-06-14.zh.md`

上传 GitHub 前建议同时确认：

- `README.md` 能直接说明项目定位、边界、演示入口和素材路径。
- `docs/portfolio_demo_summary.md` 可作为作品集、简历和面试提取入口。
- `artifacts/screenshots/` 与 `artifacts/videos/` 包含最终截图和录屏素材。
- `backend/tests/` 与 `scripts/verify_demo_readiness.sh` 是当前主要验证入口。
