# Skill Panel 1.x 原型重构计划

> 本计划依据 PRD 5.0、`03-数据模型与状态机.md`、`04-旧原型迁移映射.md`、`06-分阶段执行提示词.md`、`07-验收清单.md`、`08-回归测试用例.md` 以及当前原型现状编制。

## 一、当前文件与模块审计

### 1.1 现有文件清单

| 文件 | 当前状态 | 主要问题 |
|---|---|---|
| `shared.js` | v2 状态源，1032 行 | 单文件 Skill 模型；无 Instance/File/SourceBinding/ScanSession/ChangeSet；`ignored` 被用作 Skill 主生命周期；`Math.random()` 生成 ID；读取副本导致 mutation 写不回；normalize 丢失未声明字段。 |
| `shared.css` | 公共 Token + 组件 | 本身较完整，但各页面大量复制 `:root`、`.btn`、`.app`、`.titlebar`、`.sidebar`、`.nav` 等公共样式，未成为唯一来源。 |
| `index.html` | Library 主页面 | 重复声明整套 Token 与 shell 样式；左侧导航仍按“存储位置”组织；无扫描变化/Missing/Archive 等二级入口；表格视图为主，缺卡片/目录树；右侧详情与旧模型绑定。 |
| `skill-detail.html` | 详情页 | 重复 CSS；围绕单文件 SKILL.md；无文件树、实例面板、来源绑定、权限面板；Missing 未作为生命周期处理。 |
| `skill-editor.html` | 单文件编辑器 | 重复 CSS；只编辑 SKILL.md；无实例范围、包快照、只读授权；冲突弹窗较简陋。 |
| `compare.html` | 重复组比较 | 仅支持左右两个 Skill；无多实例判断、合并、归档等完整结果。 |
| `insights.html` | 待处理任务页 | 缺 Dashboard、Suggestions；Pending 数据仍基于旧任务类型。 |
| `activity.html` | 审计页 | 混入 usage call 记录；事件模型未区分 AuditEvent 与 PendingTask。 |
| `settings.html` | 设置页 | 分组不符合 PRD 5.0；缺扫描、权限、快照、安装更新、生命周期等二级设置。 |
| `new-skill.html` | 新建 Skill | 应下线为主流程，仅保留开发入口。 |
| `add-existing.html` | 添加已有 Skill | 应合并进安装向导的 Local Directory / Local ZIP 来源。 |
| `cases.html` | 开发测试入口 | 可保留，但需扩展新状态案例。 |
| `e2e-test.js` / `walkthrough-test.js` | 回归测试 | 基于旧模型和旧选择器，需随重构更新。 |

### 1.2 当前状态模型问题

- **主键不稳定**：旧 Skill `id` 使用名称或 `Date.now() + random`，不符合“永久 UUID”。
- **单路径模型**：`absolutePath` 与 Skill 一一对应，无法表达多实例。
- **生命周期错误**：`ignored` 被当作 Skill 生命周期，而 PRD 5.0 要求它只用于扫描排除/建议/重复组。
- **扫描无分层**：`scanStatus`/`scanResult` 只存简单字符串，没有 `ScanSession`、`ScanDiscovery`、`ChangeSet`、`ChangeItem`。
- **写入失效**：`normalizeSkill` 返回副本，`archiveSkill`/`ignoreSkill` 等函数若从 `getSkill()` 取值再赋值会写不回 state。
- **normalize 丢字段**：旧 `normalizeSkill` 只保留显式列出的字段，扩展字段会被丢弃。
- **Draft 绑定 Skill**：Draft 只绑定 `skillId`，未绑定 `instanceId` + `fileId`。
- **Snapshot 无类型**：未区分 file / package / batch。
- **来源/权限缺失**：无 `SourceBinding` 和 `PermissionGrant`。

### 1.3 当前 CSS 问题

- `index.html`、`skill-detail.html` 等页面内部 `<style>` 块完整复制了 `:root`、`*` reset、`.app`、`.titlebar`、`.traffic`、`.shell`、`.sidebar`、`.brand`、`.nav`、`.btn` 等公共样式。
- 部分页面还覆盖了 `shared.css` 的 Token 值，导致主题切换不一致。

## 二、新增 / 重写 / 保留 / 下线文件清单

| 类型 | 文件 | 说明 |
|---|---|---|
| **新增** | `onboarding.html` | 首次启动与扫描授权 |
| **新增** | `scan.html` | 扫描进度、暂停/继续/取消、失败目录 |
| **新增** | `scan-changes.html` | 扫描变化中心、Change Set 确认 |
| **新增** | `install.html` | 安装向导（GitHub/Git/ZIP/本地） |
| **新增** | `update.html` | 更新与三方 Diff |
| **新增** | `conflict.html` | Diff 与冲突处理 |
| **新增** | `uninstall.html` | 卸载与本地修改处理 |
| **新增** | `relink.html` | Missing Relink（也可做弹层） |
| **重写主体** | `index.html` | Library 二级导航、三视图、快速详情、多实例 |
| **大幅重写** | `skill-detail.html` | 文件树、实例、来源、权限、快照、生命周期 |
| **大幅重写** | `skill-editor.html` | 多文件、实例范围、只读授权、Diff、包快照 |
| **重写业务** | `compare.html` | 重复组、多实例判断、任意候选、合并结果 |
| **重构** | `insights.html` | Dashboard / Pending / Suggestions |
| **重构** | `activity.html` | 纯审计事件，移除默认调用记录 |
| **重构分组** | `settings.html` | 扫描/Library/权限/数据/快照/更新/生命周期/诊断 |
| **重写核心** | `shared.js` | v3 状态模型与确定性模拟 |
| **清理并强化** | `shared.css` | 唯一公共 Token 与组件源 |
| **保留** | `cases.html` | 开发模式测试入口，扩展新状态案例 |
| **下线主流程** | `new-skill.html` | 保留开发入口，不再进主按钮/导航 |
| **合并** | `add-existing.html` | 功能并入 `install.html` 的本地来源 |
| **更新** | `e2e-test.js` / `walkthrough-test.js` | 适配新模型与新选择器 |

## 三、新状态模型设计（v3）

### 3.1 顶层 State 结构

```js
{
  version: 3,
  initialized: false,            // 是否已完成首次授权与初始索引
  settings: { ... },
  viewStates: { library, scanChanges, detail, insights, activity, settings },

  // 核心资产
  skills: [],                    // Asset/Skill 实体
  instances: [],                 // SkillInstance 实体
  files: [],                     // SkillFile 实体

  // 来源与权限
  sourceBindings: [],            // SourceBinding
  permissionGrants: [],          // PermissionGrant

  // 扫描与变化
  scanSessions: [],              // ScanSession
  scanDiscoveries: [],           // ScanDiscovery（临时发现）
  changeSets: [],                // ChangeSet
  changeItems: [],               // ChangeItem

  // 编辑与历史
  drafts: [],                    // Draft（绑定 instanceId + fileId）
  snapshots: [],                 // Snapshot（file/package/batch）

  // 数据与审计
  usageEvents: [],               // UsageEvent/Attribution
  auditEvents: [],               // AuditEvent（不可变）
  pendingTasks: [],              // PendingTask（可解决）

  // 分类与重复
  categories: [],                // Category 树
  tags: [],                      // Tag 列表
  duplicateGroups: [],           // 重复组候选

  // 宿主与适配器
  hosts: [],                     // 宿主目录配置
  usageAdapters: []              // 数据源适配器状态
}
```

### 3.2 核心实体字段

#### Asset / Skill

```js
{
  id: 'uuid',                    // 永久 UUID
  assetType: 'skill',
  name: 'pr-review',
  displayName: 'PR Review',
  description: '',
  categoryIds: [],
  tagIds: [],
  defaultCategoryId: null,
  isFavorite: false,
  lifecycleStatus: 'available',  // discovered | pending-review | available | missing | archived | deleted
  primaryInstanceId: 'uuid',
  invocation: '',                // 调用方式
  supportedHosts: [],
  createdAt: '',
  updatedAt: ''
}
```

#### SkillInstance

```js
{
  id: 'uuid',
  skillId: 'uuid',
  hostType: 'claude-code',       // claude-code | codex | cursor | warp | custom
  rootPath: '/.../.claude/skills/pr-review',
  skillFilePath: '/.../.claude/skills/pr-review/SKILL.md',
  lifecycleStatus: 'available',  // available | missing | install-error
  permissionMode: 'read-only',   // read-only | managed
  installedVersion: '1.4.0',
  healthStatuses: [],            // normal | path-missing | permission-denied | yaml-error | empty-content
  localModificationStatus: 'clean', // clean | modified | conflict
  sourceBindingId: null,
  isPrimary: false,
  lastSeenAt: '',
  missingSince: null,
  contentHash: '',               // 全包哈希
  fileCount: 0,
  packageSizeBytes: 0
}
```

#### SkillFile

```js
{
  id: 'uuid',
  instanceId: 'uuid',
  skillId: 'uuid',
  relativePath: 'SKILL.md',
  fileType: 'text',              // text | binary | symlink | unknown
  mimeType: 'text/markdown',
  sizeBytes: 0,
  content: '',                   // 文本文件内容；二进制为 null
  contentHash: '',
  modifiedAt: '',
  tokenCount: null,
  tokenCountMode: 'exact',       // exact | estimated | unavailable
  indexStatus: 'indexed',        // indexed | skipped | failed
  skipReason: null,
  isNestedSkillMarker: false
}
```

#### SourceBinding

```js
{
  id: 'uuid',
  skillId: 'uuid',
  sourceType: 'github',          // github | git | zip | local
  sourceUrl: '',
  repository: '',
  branch: '',
  baselineVersion: '',
  baselineCommit: '',
  baselineSnapshotId: null,
  trustPolicy: 'untrusted',      // untrusted | trusted-content | trusted-scripts
  lastCheckedAt: null,
  updateStatus: 'unknown'        // unknown | up-to-date | available | conflict | failed
}
```

#### PermissionGrant

```js
{
  id: 'uuid',
  scopeType: 'instance',         // instance | directory
  scopeId: 'uuid',
  readAccess: true,
  writeAccess: false,
  grantedAt: '',
  status: 'active'               // active | expired | revoked
}
```

#### ScanSession

```js
{
  id: 'uuid',
  scanType: 'first-full',        // first-full | manual-full
  status: 'scanning',            // idle | scanning | paused | cancelled | completed-pending-confirmation | applying | applied | partial-failure
  startedAt: '',
  finishedAt: null,
  currentPath: '',
  visitedDirectoryCount: 0,
  discoveredCount: 0,
  failureCount: 0,
  pausedAt: null,
  cancelledAt: null,
  failures: []                   // { path, reason }
}
```

#### ScanDiscovery

```js
{
  id: 'uuid',
  scanSessionId: 'uuid',
  candidateSkillId: null,        // 匹配到的已有 UUID，可能为 null
  path: '',
  hostType: '',
  skillName: '',
  skillFileContent: '',
  files: [],                     // 临时文件摘要
  evidence: {},                  // 匹配依据
  discoveredAt: ''
}
```

#### ChangeSet / ChangeItem

```js
// ChangeSet
{
  id: 'uuid',
  scanSessionId: 'uuid',
  status: 'pending',             // pending | partially-applied | applied | discarded
  createdAt: '',
  appliedAt: null
}

// ChangeItem
{
  id: 'uuid',
  changeSetId: 'uuid',
  changeType: 'added',           // added | content-changed | path-changed | missing | file-deleted | health-changed | duplicate-changed | instance-changed | rebind-candidate
  skillId: null,                 // 已有 Skill UUID 或 null
  discoveryId: 'uuid',
  status: 'pending',             // pending | accepted | ignored | deferred
  evidence: {},
  fileDiffs: [],
  confirmedAt: null
}
```

#### Draft

```js
{
  id: 'uuid',
  skillId: 'uuid',
  instanceId: 'uuid',
  fileId: 'uuid',
  content: '',
  createdAt: '',
  updatedAt: '',
  baseContentHash: '',
  baseFileModifiedAt: '',
  status: 'modified',            // modified | conflict
  lastAutosaveResult: 'ok'
}
```

#### Snapshot

```js
{
  id: 'uuid',
  skillId: 'uuid',
  instanceId: 'uuid | null',
  type: 'package',               // file | package | batch
  createdAt: '',
  note: '',
  source: 'manual',              // manual | auto | pre-edit | pre-archive | pre-update | pre-delete
  files: [],                     // type=file 时单文件；type=package 时全包文件快照
  retained: false                // 长期保留
}
```

#### UsageEvent

```js
{
  id: 'uuid',
  skillId: 'uuid | null',
  instanceId: 'uuid | null',
  sessionId: '',
  callCount: 1,
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  attributionLevel: 'accurate',  // accurate | partial | unattributed | no-data
  sourceAdapterId: '',
  occurredAt: ''
}
```

#### AuditEvent / PendingTask

```js
// AuditEvent（不可变）
{
  id: 'uuid',
  time: '',
  skillId: null,
  instanceId: null,
  eventType: 'scan',
  category: 'system',
  source: 'Skill Panel',
  result: 'completed',
  targetPath: null,
  snapshotId: null,
  draftId: null,
  taskId: null,
  exitCode: null,
  rollbackResult: null,
  note: ''
}

// PendingTask（可解决）
{
  id: 'uuid',
  skillId: 'uuid',
  instanceId: 'uuid | null',
  taskType: 'archive_candidate',
  priority: 'normal',
  reasonCodes: [],
  dataWindow: '90d',
  confidence: 'high',
  status: 'open',                // open | resolved | ignored | deferred
  createdAt: '',
  resolvedAt: null,
  groupId: null
}
```

### 3.3 关键数据一致性规则

1. 一个有效实例路径只能对应一个 Instance。
2. 同一 Skill 的多个 Instance 默认聚合显示。
3. 分类、标签、收藏不随扫描覆盖。
4. 扫描未确认前不改变 Formal Index（`skills`/`instances`/`files` 主表）。
5. `getSkill()` 等读取函数不得丢失未声明字段。
6. 读取函数可返回副本，但写入函数必须修改原始 state 对象。
7. 不重复存储可推导关系（PendingTask IDs 可由 `skillId` 查询）。
8. 所有页面返回时恢复来源页、搜索、筛选、视图、分页、选中项和滚动位置。
9. 高风险操作在状态中记录快照和 AuditEvent。
10. 本地文件内容作为不可信输入，动态文本统一转义。

## 四、分阶段修改计划

### 阶段 A：工程与状态基线

- 重写 `shared.js` 为 v3 状态模型。
- 拆分 Skill/Instance/File/SourceBinding/PermissionGrant/ScanSession/ScanDiscovery/ChangeSet/ChangeItem。
- 修复 normalize 丢字段、mutation 写不回、Draft 绑定、Compare group 参数、返回上下文。
- 迁移旧演示数据到新结构；至少包含：多实例 Skill、Missing 实例、可更新 Skill、本地修改 Skill、未绑定来源 Skill。
- 清理 `index.html`、`skill-detail.html` 等页面的重复公共 CSS，强化 `shared.css` 唯一来源地位。
- 保证现有页面不会因状态升级全部报错。
- **验收**：页面可用新状态读取 Skill；一个 Skill 可含多个 Instance；每个 Instance 可含多个 File。

### 阶段 B：首次扫描与变化中心

- 新增 `onboarding.html`（首次授权与隐私说明）。
- 新增 `scan.html`（扫描进度、暂停/继续/取消、失败目录）。
- 新增 `scan-changes.html`（Change Set 确认、Diff、哈希、二进制元数据）。
- 实现 Formal Index 与临时 Scan Result 分离。
- **验收**：未确认扫描结果不替换正式 Library；旧 Library 在扫描中仍可用。

### 阶段 C：Library 重构

- 重写 `index.html`：二级入口、表格/卡片/目录树三视图、右侧快速详情、多实例聚合。
- 搜索覆盖名称、描述、分类、标签、调用方式、路径、宿主、SKILL.md 全文、包内文本文件。
- 顶部状态入口：扫描中、待确认变化、可更新、Missing、重复组、安装异常。
- **验收**：三视图切换不丢失搜索/筛选/选中/详情；多实例可展开。

### 阶段 D：Detail、文件和权限

- 重写 `skill-detail.html`：文件树、实例面板、来源绑定、权限面板、快照/Activity、生命周期。
- 支持设置主实例、单实例授权、Missing Relink。
- 使用数据严格区分 0 次 / 暂无 / 部分 / 无法归因。
- **验收**：可区分 Skill/Instance/File；可对单实例申请写权限。

### 阶段 E：Editor、Diff 和冲突

- 重写 `skill-editor.html`：左侧文件树、中间编辑、右侧 Preview/结构/元数据/Diff/问题。
- 新增 `conflict.html`：双向/三方 Diff、重新加载、保留草稿、合并、另存为、强制覆盖。
- 无写权限时禁止应用；外部修改不静默覆盖；强制覆盖前创建完整包快照。
- **验收**：无权限不能应用；外部修改触发冲突流程。

### 阶段 F：安装、更新、卸载、Compare

- 新增 `install.html`、`update.html`、`uninstall.html`。
- 重写 `compare.html`：重复组任意候选、多实例确认、合并、归档。
- 安装来源：GitHub/Git/ZIP/本地目录/本地 ZIP；不自动执行脚本；来源绑定记录官方基线。
- 更新支持完整/自定义、三方 Diff、多实例部分成功、回滚。
- 卸载支持保留副本、移出宿主、解除来源绑定。
- **验收**：安装更新不自动执行脚本；本地修改不静默丢失；更新失败可回滚。

### 阶段 G：Insights、Activity、Settings

- 重构 `insights.html`：Dashboard / Pending / Suggestions。
- 重构 `activity.html`：只展示管理审计事件。
- 重构 `settings.html`：扫描/Library/权限/数据/快照/更新/生命周期/诊断。
- 案例中心仅在开发模式可见。
- 全量回归测试并输出未完成模拟项。
- **验收**：Dashboard 展示核心指标；Activity 不包含普通调用记录；Settings 分组符合 PRD。

## 五、第一阶段（阶段 A）具体改动范围

### 5.1 目标

完成“工程与状态基线”：只改状态和公共层，不要求完成全部新 UI，但要求现有页面能正常打开、读取新结构数据不报错。

### 5.2 具体文件改动

| 文件 | 改动内容 |
|---|---|
| `shared.js` | 完全重写为 v3；新增实体 normalize；新增确定性 UUID 生成；新增旧数据迁移函数；新增跨页面上下文改进；修复 mutation 写回；保留对旧 v2 状态的自动迁移或重置。 |
| `shared.css` | 补充少量阶段 A 需要的工具类（如 `.text-muted`、`.flex` 等），保持公共样式唯一来源。 |
| `index.html` | 删除内部重复的 `:root`、reset、`.app`、`.titlebar`、`.sidebar`、`.nav`、`.btn` 等公共样式；调整脚本以读取新状态结构（如 `SP.getSkills()` 返回的新字段、实例聚合逻辑）。 |
| `skill-detail.html` | 删除重复公共 CSS；调整脚本读取新状态。 |
| `skill-editor.html` | 删除重复公共 CSS；调整脚本读取新状态。 |
| `insights.html` | 删除重复公共 CSS；调整脚本读取新状态。 |
| `activity.html` | 删除重复公共 CSS；调整脚本读取新状态。 |
| `settings.html` | 删除重复公共 CSS；调整脚本读取新状态。 |
| `compare.html` | 删除重复公共 CSS；调整脚本读取新状态。 |
| `cases.html` | 扩展展示新状态字段（多实例、文件列表等）。 |

### 5.3 阶段 A 不改动

- 不新增 `onboarding.html`、`scan.html`、`scan-changes.html`、`install.html`、`update.html`、`conflict.html`、`uninstall.html`、`relink.html`。
- 不完成 Library 三视图、右侧快速详情重构。
- 不完成 Detail 文件树、权限面板、来源面板。
- 不完成 Editor 多文件、包快照、冲突页。
- 不完成 Insights Dashboard / Suggestions、Activity 审计筛选、Settings 新分组。

### 5.4 阶段 A 验收路径

1. 打开 `index.html`，Library 能加载并展示 Skill 列表。
2. 至少一个 Skill 显示“2 个实例”，点击进入 `skill-detail.html` 能看到实例列表。
3. 打开 `cases.html`，能看到多实例、Missing、YAML 错误、重复组等案例。
4. 打开浏览器控制台，无 `shared.js` 语法错误、无 state 读取报错。
5. 在 `cases.html` 点击“重置全部案例数据”后，页面能正常重新加载。
6. 各页面（`index.html`、`skill-detail.html`、`skill-editor.html`、`insights.html`、`activity.html`、`settings.html`、`compare.html`、`cases.html`）均能通过 HTTP 200 且控制台无报错。

### 5.5 阶段 A 自测清单

- [x] `shared.js` 通过 `node --check`。
- [x] 所有 HTML 页面脚本通过 `node --check`（提取内联脚本）。
- [x] 页面 HTTP 200。
- [x] 旧 v2 localStorage 数据能自动迁移到新 v3，或回退到种子数据。
- [x] 多实例 Skill 在 Library 和 Detail 中可见。
- [x] Missing 实例状态被正确标记，不再作为 `ignored` 生命周期。

### 5.6 阶段 A 完成报告

#### 5.6.1 修改文件清单

| 文件 | 改动摘要 |
|---|---|
| `shared.js` | 完全重写为 v3 状态模型；新增 Asset / Instance / File / SourceBinding / PermissionGrant / ScanSession / ScanDiscovery / ChangeSet / ChangeItem / Snapshot / AuditEvent / UsageEvent 等实体与 normalize 函数；使用确定性 `seedUuid` 生成固定 UUID；新增 `deriveV2Skill` + `refreshV2Skills` 保持向后兼容的 `skills` 数组；修复 mutation 直接写回 `state.assets`；新增 `migrateV2ToV3` 自动迁移旧数据。 |
| `shared.css` | 保持公共 Token 与组件唯一来源；清理了各页面重复的 `:root` 定义。 |
| `index.html` | 删除内部重复公共 CSS；修复 `.detail` 抽屉在桌面端被错误隐藏的问题。 |
| `skill-detail.html` | 删除内部重复公共 CSS；脚本仍通过 `SP.getSkill` 读取派生 skills。 |
| `skill-editor.html` | 删除内部重复公共 CSS；脚本仍通过 `SP.getSkill` 读取派生 skills。 |
| `insights.html` | 删除内部重复公共 CSS；脚本仍通过派生 skills 工作。 |
| `activity.html` | 删除内部重复公共 CSS。 |
| `settings.html` | 删除内部重复公共 CSS。 |
| `compare.html` | 删除内部重复公共 CSS。 |
| `new-skill.html` / `add-existing.html` | 删除内部重复公共 CSS。 |
| `cases.html` | 删除内部重复公共 CSS。 |
| `e2e-test.js` | 更新选择器以匹配统一跨页面方法后的按钮。 |
| `walkthrough-test.js` | 更新为读取 `sp-state-v3`；`skills` → `assets` / `instances`；`activityEvents` → `auditEvents`；`ignoreRules` 保持兼容。 |

#### 5.6.2 已迁移演示数据

v3 seed data 包含以下关键案例：

- **多实例**：`pr-review` 包含 2 个 Instance（Claude Code 主实例 + custom 只读实例）。
- **Missing**：`demo-path-missing` 的主 Instance 标记为 `lifecycleStatus: 'missing'`、`healthStatuses: ['path-missing']`。
- **YAML 错误**：`demo-yaml-error` 的 Instance 标记 `healthStatuses: ['yaml-error']`。
- **本地修改/冲突**：`figma-tokens` 具有 `externalChange: true` 与 conflict draft。
- **可归档候选**：`performance-profile`、`accessibility-audit` 具有 `archiveCandidate: true`。
- **重复组**：`prompt-check` / `demo-duplicate-a` / `demo-duplicate-b` 归入重复组 B。
- **已归档**：`demo-archived` 的 Asset `lifecycleStatus: 'archived'`。
- **已忽略**：`demo-ignored` 通过 `ignoreRules` 记录。

#### 5.6.3 仍为模拟的能力

- 扫描流程：ScanSession / ScanDiscovery / ChangeSet / ChangeItem 仅建立数据结构与 seed 占位，未接入真实文件系统扫描。
- 权限系统：PermissionGrant 实体已建立，但尚未在 UI 中实现单实例写权限申请/授权流程。
- 来源绑定：SourceBinding 已建立，但未实现 GitHub/Git/ZIP 拉取与更新检查。
- 安装/更新/卸载：尚未新增 `install.html` / `update.html` / `uninstall.html` / `conflict.html` / `relink.html`。
- 快照：已记录归档前快照，但 Editor 尚未在编辑/覆盖前创建完整包快照。
- Library 三视图/目录树/快速详情：尚未重构，当前仍为旧表格 + 右侧抽屉。

#### 5.6.4 验收路径与自测结果

- 所有 HTML 页面 HTTP 200（10/10）。
- `node --check` 通过：`shared.js` + 10 个页面脚本全部 OK。
- `e2e-test.js`：11/11 通过。
- `walkthrough-test.js`：6/6 通过。
- 浏览器控制台无 `shared.js` 语法错误、无 state 读取报错。
- 打开 `index.html` 可加载 Skill 列表；`pr-review` 在详情中可见多实例。
- `cases.html` 可展示案例，点击“重置全部案例数据”后可重新加载。

#### 5.6.5 第二阶段启动条件

阶段 A 已完成，满足进入阶段 B（首次扫描与变化中心）的条件：状态基线稳定、UUID 与实体拆分完成、页面可正常打开读取新状态。

### 5.7 阶段 A 完成后将输出的内容

1. 修改文件清单。
2. 已迁移演示数据说明（含多实例、Missing、可更新、本地修改、未绑定来源示例）。
3. 仍为模拟的能力清单。
4. 可点击验收路径与自测结果。
5. 第二阶段启动条件确认。
