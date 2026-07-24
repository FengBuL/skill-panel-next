# SPN-FOUNDATION-001 交付

## 完成内容

- 安全迁移原仓库并建立四个平级 worktree。
- 创建并推送 `develop`、`cursor/ui`、`codex/core`。
- 建立 Cursor / Codex 所有权、任务卡、交接和交付模板。
- 建立生产架构、契约、存储、扫描边界和安全基线。
- 初始化 React 19、TypeScript、Vite 8、Tauri 2、Rust、SQLite 与 FTS5。
- 实现 `health_check`、`schema_version`、Tauri adapter、浏览器 mock adapter 和
  Controller。
- 创建最小技术状态占位页，不包含正式产品导航和业务流程。
- 建立前端、Rust、生产 Playwright 和冻结原型 CI 门禁。
- 使用固定 lockfile 复验冻结原型 20-suite。

## 工作区布局

| 路径                                                                   | 分支         | 状态           |
| ---------------------------------------------------------------------- | ------------ | -------------- |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/main`       | `main`       | 保持 `e99d954` |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/develop`    | `develop`    | 保持 `e99d954` |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/cursor-ui`  | `cursor/ui`  | 保持 `e99d954` |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/codex-core` | `codex/core` | 本任务实现     |

旧路径 `/Users/shovy/Documents/cursor/skill panel next` 已迁移并停用。父目录没有 Git
仓库。

## 分支状态

- 基线：`e99d954131dcbbf26aedeae6316ab2660d5fa726`。
- 文档与治理：`68224cf`。
- 生产技术闭环：`c8c1bee`。
- CI 与生产 smoke：`91dfc6f`。
- `main`、`develop`、`cursor/ui` 未发生内容修改。

## 新增文件

- `AGENTS.md`。
- `docs/coordination/**`、`docs/templates/**`、`docs/tasks/**`。
- `docs/architecture/**`、`docs/security/**`。
- `src/app/**`、`src/contracts/**`、`src/controllers/**`、`src/adapters/**`。
- `src-tauri/**`。
- `tests/contracts/**`、`tests/integration/**`、`tests/e2e/**`。
- `.github/workflows/ci.yml`、`.github/pull_request_template.md`。
- 前端、Rust、Playwright、格式和 lint 配置。

## 修改文件

- `README.md`。
- `SOURCE-MAP.md`。
- `.gitignore`。

## 未修改范围

- 冻结原型业务代码。
- 正式 Library、Insights、Activity、Settings 页面。
- 真实用户目录和真实 Skill 文件。
- 安装脚本、受控终端、AI、远程执行和全盘扫描。
- `main/`、`develop/`、`cursor-ui/` worktree 内容。

## 架构决策

- 依赖方向固定为 React UI → Controller → Adapter → Tauri Command → Application →
  Domain → Infrastructure。
- UI 禁止直接访问 Tauri、SQLite 和文件系统。
- Rust 负责 SQLite、migration、应用数据目录与安全错误边界。
- SQLite migration `0001_initial.sql` 创建 migration 记录、应用元数据和 FTS5
  `asset_search`。
- 浏览器预览固定使用 mock adapter；Tauri 环境使用同名命令契约。
- TypeScript 固定为与 `typescript-eslint` 兼容的 `6.0.3`。
- `rusqlite 0.40.1` 在本机 Rust 1.94.1 上触发未稳定 API 编译错误，锁定可编译的
  `rusqlite 0.39.0` 与 `libsqlite3-sys 0.37.0`。

## 数据安全

- 本任务未扫描或读取真实用户目录。
- 本任务未读取、修改或删除真实 Skill 文件。
- SQLite 测试只使用测试框架创建的临时目录。
- 数据库错误返回固定安全摘要，不暴露绝对路径。
- 全盘扫描记录为待独立安全裁决能力，当前没有生产实现。
- 测试截图只包含 mock 运行状态和 schema version。

## 验证命令

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run rust:fmt
npm run rust:clippy
npm run cargo:test
npm run test:e2e
npm ci --prefix prototype
npm run test:prototype
```

## 验证结果

- Prettier：通过。
- ESLint：通过。
- TypeScript：通过。
- Vitest：3 个测试文件、5 项测试通过。
- Vite 生产构建：通过。
- Rust fmt：通过。
- Rust clippy：通过，warnings 视为错误。
- Rust test：2 项集成测试通过。
- 生产 Playwright：1/1 通过，1024×768。

TDD 证据：

- 前端首次 RED：3 项行为断言失败，2 项契约已通过。
- 前端 GREEN：5/5 通过。
- Rust health contract 临时回归为 `starting` 后测试按预期失败，恢复 `ok` 后 2/2
  通过。

## 原型测试

- `npm ci --prefix prototype`：安装 3 个包，0 个已知漏洞。
- 首轮失败：本机 8081 被两个 WorkBuddy Python 进程占用，旧工作目录已不存在，页面返回
  404；runner 在 173.31 秒后人工中止。
- 处理：未终止既有进程；使用独立临时只读 HTTP 代理将本轮 Chrome 请求转向当前
  `prototype/`。
- 完整重跑：20/20 suites 全部通过，exit 0。
- 完整耗时：`real 1061.57s`，约 17 分 41.57 秒。
- 临时代理和 wrapper 已停止并删除。
- `prototype/` Git 状态没有修改。

## CI 状态

- 本地 YAML 解析通过。
- CI 覆盖前端格式、lint、类型、测试、构建、Rust fmt、clippy、test、生产
  Playwright smoke 和原型 20-suite。
- 原型 CI 在同一步骤启动并回收 8081 静态服务器。
- 远端 Actions 状态在 PR 创建后记录。

## 提交哈希

- `68224cf`：仓库治理、架构和安全文档。
- `c8c1bee`：生产工程与最小技术闭环。
- `91dfc6f`：CI、PR 模板和生产 Playwright smoke。

## 分支

`codex/core`

## PR

待创建：`codex/core → develop`，保持未自动合并。

## 截图路径

`docs/delivery/evidence/SPN-FOUNDATION-001/system-status-1024x768.png`

## 模块文档

- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/CONTRACTS.md`
- `docs/architecture/STORAGE.md`
- `docs/security/SECURITY-BASELINE.md`
- `docs/security/SCAN-BOUNDARY.md`

## 已知问题

1. 本机 8081 仍由两个旧 WorkBuddy Python 进程占用；本任务没有终止未知进程。
2. 远端 CI 尚待 PR 创建后执行。
3. 当前截图来自浏览器 mock adapter；真实 Tauri command 由 Rust 测试覆盖。
4. 当前图标和页面都是技术占位，未形成正式品牌和产品 UI。

## 下一步建议

1. 人工评审 `codex/core → develop` PR，等待 CI 全部通过后决定合并。
2. Cursor 在独立任务中基于冻结契约设计正式 UI。
3. 单独启动全盘扫描安全裁决，确定允许根目录、敏感目录、符号链接和资源限制。
