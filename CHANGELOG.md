# Changelog

All notable changes to this project will be documented in this file.

## v0.1.0 - 2026-05-18

- 添加后端 FastAPI 应用以读取 AMR Mock WMS HTTP API（backend/app）
- 添加前端静态 Dashboard（frontend/）
- 添加文档：API 契约、集成指南、路线图、WebSocket 状态流（docs/）
- 添加测试与 mock 数据（backend/tests、mock/）

验证信息：本地已通过 11 个单元测试（运行命令：
`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 /home/ina/workspace/robot-ops-dashboard/.venv/bin/python -m pytest -q backend/tests`），在 `backend/` 范围内未发现明文凭证。

配置说明：运行时配置从环境变量读取，详见 `backend/app/config.py`。

发布建议：

```bash
git add README.md backend/README.md backend/app/config.py backend/app/main.py backend/app/schemas.py backend/requirements.txt backend/app/services/*.py backend/tests/ docs/*.md frontend/* AGENTS.md scripts/ CHANGELOG.md
git commit -m "chore(release): 初始发布 v0.1.0

- 添加后端 FastAPI 应用以读取 AMR Mock WMS HTTP API（backend/app）
- 添加前端静态 Dashboard（frontend/）
- 添加文档：API 契约、集成指南、路线图、WebSocket 状态流（docs/）
- 添加测试与 mock 数据（backend/tests, mock/）
- 已验证：本地通过 11 个单元测试；backend/ 未发现明文凭证
- 配置说明：运行时配置从环境变量读取（参见 backend/app/config.py）
- 标记版本：v0.1.0
"
git tag -a v0.1.0 -m "v0.1.0 初始发布"
git push origin HEAD
git push origin --tags
```

---

