# SPN-FOUNDATION-001 生产基础

## 基线

- 任务类型：稳定实现 / 工程基础。
- 起始分支：`codex/core`。
- 起始提交：`e99d954131dcbbf26aedeae6316ab2660d5fa726`。
- 工作目录：`/Users/shovy/Documents/cursor/skill-panel-next-workspaces/codex-core`。
- 产品依据：PRD 5.0、冻结报告、交接报告、数据模型与状态机。

## 目标

1. 建立四分支、四 worktree 及角色所有权。
2. 建立 React、TypeScript、Vite、Tauri 2、Rust、SQLite 与 FTS5 工程基础。
3. 建立 `health_check`、`schema_version`、Tauri adapter、浏览器 mock adapter 和 Controller 闭环。
4. 建立 CI、测试、架构与安全基线。
5. 复验冻结原型 20-suite。

## 范围

### 新增

- 协同、任务、架构、安全和交付文档。
- 前端工程骨架与最小运行状态占位页。
- Tauri、SQLite migration 和 Rust 分层骨架。
- 契约、集成、Rust 和 Playwright smoke 测试。
- CI 和 PR 模板。

### 修改

- `README.md`。
- `SOURCE-MAP.md`。

### 排除

- 正式 Library、Insights、Activity、Settings 页面。
- 冻结原型业务代码。
- 真实用户目录扫描。
- 真实 Skill 文件读写。
- 安装脚本、受控终端、AI、远程执行。

## 所有权

- Cursor：本任务不编辑 Cursor 独占目录。
- Codex：核心、测试、CI、架构和安全目录。
- 共享文件唯一负责人：Codex。

## 数据安全

- 真实用户数据：不接触。
- 文件读取：只读取当前仓库和测试临时目录。
- 文件写入：只写当前 worktree、构建输出和测试临时目录。
- 删除或覆盖：无用户文件删除或覆盖。
- 脚本执行：只执行依赖安装、格式、构建和测试命令。
- 回滚方式：原子 commits；数据库测试使用独立临时文件。

## 契约与迁移

### 新增命令

| 命令             | 用途                                | 参数 | 返回                |
| ---------------- | ----------------------------------- | ---- | ------------------- |
| `health_check`   | 验证 Tauri 命令链路                 | 无   | 运行状态与服务名    |
| `schema_version` | 初始化 SQLite 并读取 migration 版本 | 无   | 整数 schema version |

### 新增持久化

- SQLite `schema_migrations` 记录 migration 版本。
- migration `0001_initial.sql` 创建基础元数据与 FTS5 探针表。
- 默认数据库位于 Tauri app data 目录；测试使用临时目录。
- 首次基础版本无旧数据迁移。

### 兼容方案

- 浏览器环境使用 mock adapter，固定返回健康状态和 schema version。
- Tauri 环境通过 `@tauri-apps/api/core` 调用同名命令。
- Controller 只依赖 `SystemAdapter` 契约。

## 验收

- [x] 四个 worktree 和远端分支一一对应。
- [ ] 文档完整描述所有权、架构、存储和安全边界。
- [ ] 前端占位页可展示运行环境、健康状态和 schema version。
- [ ] Rust 命令和 SQLite migration 有测试。
- [ ] CI 覆盖全部要求。
- [ ] 冻结原型 20-suite exit 0。
- [ ] `codex/core → develop` PR 已创建且未自动合并。

## 验证

```text
格式：npm run format:check
lint：npm run lint
类型：npm run typecheck
前端测试：npm test
前端构建：npm run build
Rust fmt：npm run rust:fmt
Rust clippy：npm run rust:clippy
Rust test：npm run cargo:test
Playwright：npm run test:e2e
原型回归：npm run test:prototype
```

## 风险与人工等待点

- 主要风险：Tauri 平台依赖、SQLite FTS5 可用性、Playwright 浏览器环境。
- 暂停条件：需要真实用户目录、破坏性操作、核心状态机变更或依赖许可无法确认。
- 人工验收点：检查 `codex/core → develop` PR，人工决定是否合并。
