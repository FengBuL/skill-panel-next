# 来源与清理说明（SOURCE-MAP）

## Git 权威来源

- 远端：`https://github.com/FengBuL/skill-panel-next`
- 稳定内容：`origin/main`

## 当前权威 worktree

| 路径                                                                   | 分支         | 角色       |
| ---------------------------------------------------------------------- | ------------ | ---------- |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/main`       | `main`       | 稳定里程碑 |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/develop`    | `develop`    | 集成       |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/cursor-ui`  | `cursor/ui`  | Cursor UI  |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/codex-core` | `codex/core` | Codex 核心 |

父目录 `skill-panel-next-workspaces` 不建立 Git 仓库。

## 旧路径迁移

`/Users/shovy/Documents/cursor/skill panel next` 已于 2026-07-25 安全移动到
`/Users/shovy/Documents/cursor/skill-panel-next-workspaces/main`。旧路径禁止继续用于开发或
启动命令。

## 已迁入后删除的原路径（避免双份占空间）

| 原路径                                                      | 状态       |
| ----------------------------------------------------------- | ---------- |
| `/Users/shovy/Documents/workbuddy/skill panel 原型设计/`    | **已删除** |
| `/Users/shovy/Desktop/skill-panel-prd5-prototype-refactor/` | **已删除** |
| `/Users/shovy/Desktop/未命名文件夹/`（旧阶段报告/截图副本） | **已删除** |

## 本工作区内已剔除（后续生产开发用不上）

| 剔除项                                          | 原因                           |
| ----------------------------------------------- | ------------------------------ |
| `shared.v2.js` / `shared.v2.css`                | 历史 v2 备份，运行时不用       |
| `screenshot-*.png`                              | 演示截图，非开发契约           |
| `docs/reviews/`                                 | 早期评审 zip / 文稿            |
| `docs/phase-reports/`                           | 细节已收入 `DEV-LEDGER`        |
| Agent 提示词 05/06、旧迁移映射 04、logic-change | 原型施工脚手架，生产阶段不需要 |
| `prototype/` 内与 `docs/baseline` 重复的 md     | 文档只保留一份                 |

## 保留给后续开发的内容

- `docs/prd/` — 需求与边际探讨
- `docs/refactor-plan/` — 01 方案、02 IA、03 状态机、07 验收、08 回归、重构计划
- `docs/baseline/` — 冻结 / 交接 / 台账 / 测试指南
- `prototype/` — 冻结实现与 Playwright 回归套件

整理日期：2026-07-25
