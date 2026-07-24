# 生产架构

## 目标

Skill Panel Next 采用本地优先桌面架构。React 负责展示和临时界面状态，Rust 负责持久化、
权限、文件系统与安全边界。

## 依赖方向

```text
React UI
  ↓
Controller
  ↓
Adapter Contract
  ├─ Browser Mock Adapter
  └─ Tauri Adapter
       ↓
Tauri Command
  ↓
Application Service
  ↓
Domain
  ↓
Infrastructure
  ├─ SQLite
  ├─ File system
  └─ Snapshot store
```

依赖只能沿箭头方向。Domain 不依赖 Tauri、SQLite 或 React。UI 不直接依赖 Tauri API、
数据库或文件系统。

## 前端边界

- `src/app/**`：应用装配、启动和最小壳。
- `src/contracts/**`：前后端命令数据形状和 Adapter 接口。
- `src/controllers/**`：页面所需数据编排、加载状态和错误归一化。
- `src/adapters/**`：Tauri 与浏览器 mock 实现。
- `src/ui/**`：纯展示组件，由 Cursor 负责。
- `src/ui-fixtures/**`：确定性 UI fixtures，由 Cursor 负责。

本基础任务的占位页放在 `src/app/**`，只展示技术链路状态，不定义正式页面视觉。

## Rust 边界

- `src-tauri/src/commands/**`：Tauri 参数和返回值边界。
- `src-tauri/src/application/**`：用例编排与事务边界。
- `src-tauri/src/domain/**`：领域类型、规则和错误。
- `src-tauri/src/infrastructure/**`：SQLite、文件系统、快照和平台实现。
- `src-tauri/src/security/**`：允许根目录、路径规范化、脱敏和权限检查。

## 故障处理

- Adapter 将传输错误归一化为稳定错误类型。
- Command 返回可脱敏错误，不泄露绝对用户路径和敏感正文。
- 单个基础设施错误不得绕过 Application 事务边界。
- UI 展示可操作的状态摘要，诊断详情只进入脱敏日志。

## 当前基础闭环

`SystemController.load()` 同时请求 `health_check` 与 `schema_version`。浏览器预览使用 mock，
Tauri 使用真实命令。SQLite 首次连接时应用内置 migration，再返回 schema version。
