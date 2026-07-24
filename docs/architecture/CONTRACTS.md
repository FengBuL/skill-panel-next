# 前后端契约

## 原则

- 契约位于 `src/contracts/**`，UI、Controller 和 Adapter 共用。
- Rust command 使用与 TypeScript 等价的 `snake_case` JSON 字段。
- command 名称保持稳定；字段变更需要迁移说明与契约测试。
- UI 只接收 Controller 状态，不感知 invoke 细节。

## 基础契约

```ts
type RuntimeKind = "browser-mock" | "tauri";

interface HealthStatus {
  status: "ok";
  service: "skill-panel-next";
}

interface SystemAdapter {
  readonly runtime: RuntimeKind;
  healthCheck(): Promise<HealthStatus>;
  schemaVersion(): Promise<number>;
}
```

## Command 映射

| TypeScript 方法   | Tauri command    | 参数 | 返回           |
| ----------------- | ---------------- | ---- | -------------- |
| `healthCheck()`   | `health_check`   | 无   | `HealthStatus` |
| `schemaVersion()` | `schema_version` | 无   | `number`       |

## 版本策略

- schema version 由 SQLite migration 决定。
- 契约破坏性变化进入新 command 或显式版本字段。
- 新字段优先采用可选读取、明确默认值和向后兼容序列化。
- 测试同时覆盖 mock、Controller 和 Rust 序列化结果。
