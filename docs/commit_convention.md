# 提交命名规范

## 1. 目标

本文件用于统一 `robot-ops-dashboard` 仓库的 Git 提交命名方式，方便：

- 回看历史时快速理解每次改动
- 区分文档、Mock、前端、后端和仓库配置变更
- 后续多人协作时保持提交风格一致

本仓库建议采用 **Conventional Commits 简化版**，并结合中文说明。

## 2. 推荐格式

推荐使用以下格式：

```text
<type>(<scope>): <简短中文说明>
```

示例：

```text
feat(backend): 增加 mock 数据只读 API
docs(readme): 同步前后端 V0.1 状态
fix(mock): 修正 alerts 样例中的阶段描述
chore(repo): 添加 .gitignore 忽略虚拟环境和缓存文件
```

如果某次提交范围很明确，也可以省略 `scope`：

```text
docs: 补充 AMR HTTP 集成说明
chore: 初始化 robot-ops-dashboard V0.1 基线工程
```

## 3. type 约定

### `feat`

用于新增功能或新增能力。

适用场景：

- 新增后端接口
- 新增静态页面展示能力
- 新增 mock 数据结构

示例：

```text
feat(frontend): 增加 AMR 任务列表静态展示页
feat(backend): 增加设备状态和告警只读 API
```

### `fix`

用于修复错误、修正文案、修正结构不一致问题。

适用场景：

- 修复接口返回问题
- 修复 README 与实际实现不同步
- 修复 mock 数据字段错误

示例：

```text
fix(mock): 修正 sample_alerts 与当前仓库状态不一致的问题
fix(backend): 修复 mock 文件缺失时的错误返回格式
```

### `docs`

用于文档更新，不涉及功能逻辑变化。

适用场景：

- 更新 README
- 更新设计文档
- 增加使用说明

示例：

```text
docs(readme): 补充 Backend V0.1 启动说明
docs(docs): 完善 Dashboard 页面规划文档
```

### `chore`

用于工程整理、初始化、配置调整、忽略规则和依赖维护。

适用场景：

- 初始化仓库
- 添加 `.gitignore`
- 调整目录结构
- 增加基础配置文件

示例：

```text
chore(repo): 初始化 robot-ops-dashboard V0.1 基线工程
chore(repo): 添加 .gitignore 并忽略本地虚拟环境
```

### `refactor`

用于重构代码结构，但不改变对外功能。

适用场景：

- 重构 mock 数据读取逻辑
- 抽离公共函数
- 调整模块拆分

示例：

```text
refactor(backend): 抽离 mock 数据读取服务
```

### `style`

用于仅调整样式或代码格式，不改变逻辑。

适用场景：

- 调整页面配色和布局
- 纯格式化整理

示例：

```text
style(frontend): 优化静态页面卡片布局和配色
```

### `test`

用于测试、验证脚本或测试文档补充。

适用场景：

- 增加接口验证说明
- 增加测试计划
- 增加本地验证脚本

示例：

```text
test(backend): 补充本地 curl 验证说明
test(docs): 完善 V0.1 测试计划
```

## 4. scope 约定

本仓库建议优先使用以下 `scope`：

- `repo`: 仓库级配置、初始化、忽略规则
- `readme`: 根 README
- `docs`: `docs/` 下设计文档
- `mock`: `mock/` 下数据样例
- `frontend`: 静态页面和前端展示
- `backend`: FastAPI 后端骨架

示例：

```text
docs(readme): 同步仓库首页状态说明
feat(frontend): 增加 device status 和 alerts 展示
feat(backend): 增加 health 和 mock 数据读取接口
```

## 5. 命名建议

提交标题建议遵循以下规则：

1. 一次提交只描述一类核心变更
2. 说明“做了什么”，不要只写“更新”“修改”
3. 标题尽量控制在一行内
4. 优先用动词开头

不推荐：

```text
fix: 修改一下
docs: 更新文档
chore: 调整项目
```

推荐：

```text
fix(mock): 修正任务样例中的阶段标签命名
docs(readme): 补充前端静态页面状态说明
chore(repo): 添加 Python 项目忽略规则
```

## 6. 适合当前仓库的常见提交示例

### 首次提交

```text
chore(repo): 初始化 robot-ops-dashboard V0.1 基线工程
```

### 文档阶段

```text
docs(docs): 完善数据源规划与 AI 扩展设计
docs(readme): 同步项目边界与阶段目标
```

### mock 数据阶段

```text
feat(mock): 增加 AMR 任务和设备状态样例数据
fix(mock): 修正 alerts 样例中的项目阶段描述
```

### 静态页面阶段

```text
feat(frontend): 增加 mock 数据静态展示页面
style(frontend): 优化任务表格和告警卡片样式
```

### 后端阶段

```text
feat(backend): 增加 FastAPI mock 数据只读接口
refactor(backend): 重构配置和数据读取模块拆分
test(backend): 补充本地接口验证步骤
```

## 7. 推荐使用方式

如果你想保持简单，日常直接使用下面这一套就够了：

```text
chore(repo): 仓库初始化或配置整理
docs(readme): README 更新
docs(docs): 设计文档更新
feat(mock): 新增或扩展 mock 数据
fix(mock): 修正 mock 数据问题
feat(frontend): 新增前端展示能力
style(frontend): 调整页面样式
feat(backend): 新增后端能力
fix(backend): 修复后端问题
refactor(backend): 后端重构
test(backend): 后端验证或测试补充
```

## 8. 当前建议

对于这个仓库，建议优先使用下面这个格式：

```text
<type>(<scope>): <简短中文说明>
```

这是一个足够清晰、同时又不会太重的规范，适合当前 V0.1 到后续多阶段演进的提交历史维护。
