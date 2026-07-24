# Cursor / Codex 所有权

## 分支职责

- `main`：稳定里程碑，只接受 `develop` PR。
- `develop`：角色分支集成与完整验证。
- `cursor/ui`：可见 UI、fixtures、视觉测试和设计资料。
- `codex/core`：契约、Controller、Adapter、Tauri、SQLite、安全、CI 和测试。

## 目录职责

| 区域                                                                   | 唯一负责人     | 合并门禁               |
| ---------------------------------------------------------------------- | -------------- | ---------------------- |
| `src/ui/**`、`src/ui-fixtures/**`                                      | Cursor         | 视觉证据与手动流程     |
| `src/contracts/**`、`src/controllers/**`、`src/adapters/**`            | Codex          | 契约和单元测试         |
| `src-tauri/**`                                                         | Codex          | fmt、clippy、Rust test |
| `tests/visual/**`、`docs/design/**`                                    | Cursor         | 截图与视觉基线         |
| `tests/contracts/**`、`tests/integration/**`、`tests/e2e/**`           | Codex          | 自动化验证             |
| `.github/**`、`scripts/**`、`docs/architecture/**`、`docs/security/**` | Codex          | CI 与安全评审          |
| 共享文件                                                               | 当前任务卡指定 | 单一负责人             |

## 共享文件流程

1. 任务卡列出共享文件和唯一负责人。
2. 另一角色通过交接文档提出变更建议。
3. 唯一负责人完成修改、验证和提交。
4. 角色分支通过普通 merge commit 进入 `develop`。
5. PR 合并后，最新 `develop` 合回角色分支。

## 并行纪律

- 两个 agent 禁止进入同一 worktree 编辑。
- 同一文件在一个批次只分配给一个角色。
- 发现另一角色未提交内容时停止并记录文件。
- `develop` 只用于集成检查，禁止存放未完成实验。

## SPN-FOUNDATION-001

本任务共享文件唯一负责人为 Codex：

```text
src/app/**
README.md
SOURCE-MAP.md
AGENTS.md
docs/tasks/SPN-FOUNDATION-001.md
docs/templates/**
docs/delivery/SPN-FOUNDATION-001.md
```

Cursor UI 范围保持冻结。
