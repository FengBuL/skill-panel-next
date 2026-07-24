# Skill Panel Next Agent 规则

本文件适用于 Skill Panel Next 全部生产开发。进入任一 worktree 后，先阅读本文件和当前任务卡。

## 权威来源

按以下顺序处理冲突：

1. 数据安全、不可逆操作与用户授权边界。
2. `docs/prd/PRD5.0.md`。
3. `docs/baseline/FINAL-FREEZE-REPORT.md` 与 `docs/baseline/HANDOFF-REPORT.md`。
4. `docs/refactor-plan/03-数据模型与状态机.md`。
5. `docs/refactor-plan/02-信息架构与页面规格.md`。
6. 验收清单、回归测试与冻结原型。
7. 生产实现与后续任务卡。

全盘扫描仍等待独立安全裁决。裁决完成前，生产代码不得扫描真实用户目录。

## 工作区与分支

| 路径                                                                   | 分支         | 用途               |
| ---------------------------------------------------------------------- | ------------ | ------------------ |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/main`       | `main`       | 稳定里程碑         |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/develop`    | `develop`    | 日常集成与完整验证 |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/cursor-ui`  | `cursor/ui`  | Cursor UI 工作区   |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/codex-core` | `codex/core` | Codex 核心工作区   |

父目录 `skill-panel-next-workspaces` 不建立 Git 仓库。旧路径
`/Users/shovy/Documents/cursor/skill panel next` 已停用。

每次工作前运行：

```bash
pwd
git status --short --branch
git worktree list
```

发现目录、分支或工作区状态不符合任务卡时立即停止。Cursor 与 Codex 禁止编辑同一个
worktree。

## 文件所有权

Cursor 独占：

```text
src/ui/**
src/ui-fixtures/**
tests/visual/**
docs/visual-baseline/**
docs/design/**
```

Codex 独占：

```text
src/contracts/**
src/controllers/**
src/adapters/**
src-tauri/**
tests/contracts/**
tests/integration/**
tests/e2e/**
.github/**
scripts/**
docs/architecture/**
docs/security/**
docs/coordination/**
```

共享区域由任务卡指定唯一负责人：

```text
src/app/**
README.md
SOURCE-MAP.md
AGENTS.md
docs/tasks/**
docs/templates/**
docs/delivery/**
```

跨角色变更通过 PR 和交接文档进入 `develop`。长期角色分支使用普通 merge commit，禁止
squash、force push、直接 push `main`、自动合并和删除远端分支。

## 产品边界

- 一级导航固定为 Library、Insights、Activity、Settings。
- Library 是核心入口。
- 永久 UUID 是实体主键；Asset、SkillInstance、AssetFile 分层保存。
- Formal Index、Scan Result、Change Set 分离。
- 默认只读。
- UI 只依赖 Controller；Controller 只依赖契约化 Adapter。
- `src/ui/**` 禁止直接调用 Tauri、SQLite 或文件系统。
- Rust 负责领域状态、SQLite、文件系统、权限、快照、事务和安全边界。
- 生产运行路径禁止引用 `prototype/shared.js`。
- Skill Panel v3.8.3 代码不进入本项目。
- 当前阶段不引入 AI 自动改写，不在应用内执行 Skill。

## 原型冻结

`prototype/` 是视觉、流程与状态契约。未经任务卡和人工批准，不得修改原型业务代码。
原型依赖使用 `prototype/package-lock.json` 固定安装。涉及生产行为契约的变更需重新运行
20-suite，并在交付文档记录命令、结果和耗时。

## 数据安全

- 扫描、日志读取和文件写入都需要明确的允许根目录与权限。
- 本任务及未获批准的后续任务不得读取、扫描或修改真实 Skill 文件。
- 路径必须规范化，并验证仍位于允许根目录内；符号链接需要单独判定。
- 敏感目录、路径逃逸、全盘扫描、额外路径访问进入专门安全评审。
- 写入前检查权限、目标路径、文件状态和快照。
- 删除、覆盖、移动、批量操作和脚本执行需要显示影响范围并再次确认。
- 后台任务不得静默修改用户文件。
- 日志、错误、截图和诊断信息需要脱敏路径、用户名、邮箱、密钥和正文。
- 临时测试文件只写入独立临时目录。
- 禁止读取、记录或索取证书、密钥和 GitHub secrets。

## 开发与测试

- 先写任务卡和架构决策。
- 行为代码遵循失败测试 → 最小实现 → 重构。
- 每个 commit 保持原子性，避免无关重构。
- 新增字段、命令或持久化结构前，记录用途、默认值、迁移与兼容方案。
- 前端至少运行格式检查、lint、类型检查、单元测试和生产构建。
- Rust 至少运行 `cargo fmt --check`、`cargo clippy -- -D warnings`、`cargo test`。
- 生产流程变更运行 Playwright smoke。
- 冻结契约相关变更运行原型 20-suite。
- 无法执行的验证需记录命令、原因和剩余风险。

## 交付

任务完成后更新 `docs/delivery/<TASK-ID>.md`，至少包含：

```text
完成内容：
工作区布局：
分支状态：
新增文件：
修改文件：
未修改范围：
架构决策：
数据安全：
验证命令：
验证结果：
原型测试：
CI 状态：
提交哈希：
分支：
PR：
截图路径：
模块文档：
已知问题：
下一步建议：
```

删除、覆盖、批量操作、脚本执行或真实用户目录访问需要单独人工确认。任务授权未覆盖的
高风险动作必须暂停。
