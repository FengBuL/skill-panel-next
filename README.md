# Skill Panel Next

**远端：** `https://github.com/FengBuL/skill-panel-next`

**产品依据：** PRD 5.0

**原型状态：** 视觉、流程、状态模型与交互已冻结

**生产状态：** `SPN-FOUNDATION-001` 基础工程建设中

---

## 目录结构

四个权威 worktree：

| 路径                                                                   | 分支         | 角色       |
| ---------------------------------------------------------------------- | ------------ | ---------- |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/main`       | `main`       | 稳定里程碑 |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/develop`    | `develop`    | 日常集成   |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/cursor-ui`  | `cursor/ui`  | Cursor UI  |
| `/Users/shovy/Documents/cursor/skill-panel-next-workspaces/codex-core` | `codex/core` | Codex 核心 |

旧路径 `/Users/shovy/Documents/cursor/skill panel next` 已迁移并停用。禁止继续从旧路径启动
开发。Git 内容权威来源为远端仓库和 `main`。

---

## 建议阅读顺序

1. `docs/prd/PRD5.0.md`
2. `docs/baseline/FINAL-FREEZE-REPORT.md`
3. `docs/baseline/DEV-LEDGER.md`
4. `docs/baseline/HANDOFF-REPORT.md`
5. `docs/refactor-plan/03-数据模型与状态机.md`
6. `docs/refactor-plan/02-信息架构与页面规格.md`
7. `prototype/`（实现与回归）

生产开发先阅读 `AGENTS.md` 和 `docs/tasks/` 中的当前任务卡。

---

## 原型启动

```bash
cd prototype
npm ci
python3 -m http.server 8081
# http://localhost:8081/index.html

node run-all-tests.js   # 期望 20 suites · exit 0
```

---

## 分支约定

- `main` 只接收来自 `develop` 的里程碑 PR。
- `develop` 接收 `codex/core` 与 `cursor/ui` PR。
- 长期角色分支使用普通 merge commit。
- 禁止自动合并、force push、直接 push `main` 和删除远端角色分支。
- 冻结规则持续有效；原型变更需要授权和 20-suite 回归。
