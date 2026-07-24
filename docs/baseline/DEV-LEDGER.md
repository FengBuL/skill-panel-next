# Skill Panel PRD 5.0 原型重构开发台账

**文档性质：** 开发过程台账（步骤 + 结果）  
**产品基线：** Skill Panel PRD 5.0 中文优先 MVP 交互原型  
**工作目录：** `prototype/`  
**台账截止：** 2026-07-24 冻结确认  
**关联文档：** `FINAL-FREEZE-REPORT.md`（冻结结论）· `HANDOFF-REPORT.md`（交接）· 各 `phase-*-*.md`（阶段报告）

---

## 0. 台账说明

| 项 | 内容 |
| --- | --- |
| 目的 | 记录从旧 v2 静态原型到 PRD 5.0 v3 原型的**分阶段重构步骤与验收结果** |
| 记录粒度 | 按 Phase 记「目标 → 主要动作 → 产物 → 测试结果 → 停点」 |
| 版本控制 | `prototype/` **当时非 Git 仓库**；本台账以文件系统与阶段报告为准 |
| 不含 | 生产发布、真实网络/磁盘、AI、完整英文、签名公证 |

---

## 1. 重构总览时间线

```text
旧 v2 单文件 Skill 原型
    │
    ├─ 规划：prototype-refactor-plan.md（问题审计 + 新模型 + 分阶段）
    │
    ├─ Phase A …… 工程与状态基线（v3 唯一源、UUID、生命周期、CSS）
    ├─ Phase B …… 首次扫描与变化中心
    ├─ Phase B.1 … 扫描流程收口
    ├─ Phase C/C.1  Library 查询与视图
    ├─ Phase D/D.1/D.2  Detail / Editor / Conflict
    ├─ Phase E/E.1  安装与更新前置
    ├─ Phase F0–F3  Install / Update / Uninstall / Duplicate
    ├─ Phase F.4/F.4.1  Update Preview→Prepare→Confirm 加固
    ├─ Phase G …… Insights / Activity / Settings / Cases 守卫
    ├─ Phase G.1 … 最终验收阻塞修复
    ├─ Phase G.2 … 冻结前 settings / 测试确定性收口
    │
    └─ 冻结归档 …… FINAL-FREEZE-REPORT.md（允许冻结）
```

**最终门禁：** `run-all-tests.js` → **20 suites · All passed · exit 0**

---

## 2. 重构前问题基线（为何要改）

摘自 `prototype-refactor-plan.md` 审计结论：

| 类别 | 旧状问题 | 重构目标 |
| --- | --- | --- |
| 数据模型 | 单路径 Skill；无 Instance/File/SourceBinding | v3 Asset / Instance / File / Host / Binding |
| 主键 | 名称 / `Date.now` / `Math.random` | 永久 UUID（运行时 `uuid()`，种子 `seedUuid`） |
| 生命周期 | `ignored` 误作 Skill 主生命周期 | Ignore 仅规则层；Asset 用正式枚举 |
| 扫描 | `settings.scanStatus/Result` 字符串 | ScanSession / Discovery / ChangeSet 分层 |
| 写入 | `getSkill` 副本导致写不回 | Raw 写 + Public 只读副本 |
| CSS | 各页复制 Token / shell | `shared.css` 唯一公共源 |
| IA | 按存储位置组织 | Library / Insights / Activity / Settings |

---

## 3. 分阶段开发台账

### Phase A — 工程与状态基线

| 字段 | 内容 |
| --- | --- |
| **时间参考** | 约 2026-07-21（见 `phase-a-closure-report.md`） |
| **目标** | v3 成为唯一持久化源；永久 UUID；生命周期收口；CSS 去重 |
| **主要步骤** | ① 重写 `shared.js` 为 v3 State（`sp-state-v3`）② `loadState` 剔除派生数组 ③ `seedUuid` / `uuid` ④ Ignore 迁出生命周期 ⑤ 页面改读 Public API ⑥ `shared.css` 收口重复选择器 |
| **关键产物** | `shared.js` / `shared.css` / 主页面骨架；`phase1-targeted-tests.js` |
| **测试结果** | Phase1 专项 + e2e/walkthrough 适配通过（报告复核六项通过） |
| **停点** | **未进入 Phase B** |

---

### Phase B — 首次扫描与变化中心

| 字段 | 内容 |
| --- | --- |
| **目标** | Host 唯一扫描配置源；ScanSession 状态机；ChangeSet 确认流 |
| **主要步骤** | ① 删除持久化 `storageLocations`，Host 正式化 ② `createScanSession` / pause / resume / cancel / tick ③ `createChangeSet` / apply ④ 新增 `onboarding.html`、`scan.html`、`scan-changes.html` ⑤ Library 待处理横幅 |
| **状态机摘要** | `idle → scanning ⇄ paused → completed-pending-confirmation \| partial-failure \| cancelled` |
| **关键产物** | 上述三页 + `phase2-targeted-tests.js` + `phase-b-completion-report.md` |
| **测试结果** | Phase2：**17 passed** |
| **停点** | **未进入 Phase C**（B.1 前先收口扫描缺口） |

---

### Phase B.1 — 扫描流程收口

| 字段 | 内容 |
| --- | --- |
| **目标** | 首次路由、种子/演示隔离、Rebind、Update Available、取消后部分结果、检查点、Audit 不可变、onboardingDecision 闭环 |
| **主要步骤** | ① `markOnboardingComplete` / 未初始化重定向 ② 完成态 UI 按 session 恢复（修「空扫描」误判）③ ChangeSet 应用写 decision ④ AuditEvent 不可变约定巩固 |
| **关键产物** | `phase-b1-targeted-tests.js`（扩至 10 项）+ `phase-b1-completion-report.md` |
| **测试结果** | B.1：**10 passed** |
| **停点** | **未进入 Phase C** |

---

### Phase C / C.1 — Library

| 字段 | 内容 |
| --- | --- |
| **目标** | Library 查询 API、视图状态、表/树、筛选排序分页、批量动作 |
| **主要步骤** | ① `queryLibraryAssets` / `getLibraryCounts` / viewState ② `library-app.js` 拆分 ③ C.1 加固与回归 |
| **关键产物** | `library-app.js`、`phase-c-targeted-tests.js`、`phase-c1-targeted-tests.js` |
| **测试结果** | C：**20** · C.1：**6**（均 passed） |
| **停点** | 进入 Detail/Editor 前 Library 契约稳定 |

---

### Phase D / D.1 / D.2 — Detail · Editor · Conflict

| 字段 | 内容 |
| --- | --- |
| **目标** | 多文件详情、编辑会话、应用更改、外部冲突决议 |
| **主要步骤** | ① Detail API（文件树、实例、快照、权限）② Editor Session / Draft / Diff / prepareApply / confirmApply ③ Conflict 页与 Keep/Discard/Reload/Merge/SaveCopy / ForceOverwrite ④ D.1/D.2 加固与 flake 治理 |
| **关键产物** | `skill-detail-app.js`、`skill-editor-app.js`、`conflict-app.js` + 对应 HTML；`phase-d*` 测试 |
| **测试结果** | D：**35** · D.1：**22** · D.2：**18** |
| **停点** | 读写主路径可回归后再做安装更新 |

---

### Phase E / E.1 — 安装与更新前置

| 字段 | 内容 |
| --- | --- |
| **目标** | Install/Update 页面与 Operation 骨架、Demo Case、导航入口 |
| **主要步骤** | ① `install.html` / `update.html` + app 脚本 ② `resolveInstallSource` / `checkForUpdates` 等前置 API ③ E.1 收口 |
| **关键产物** | Install/Update 壳 + `phase-e*` 测试 |
| **测试结果** | E：**34** · E.1：**24** |
| **停点** | 完整 Confirm 状态机放入 Phase F |

---

### Phase F0 – F3 — 运维操作状态机

| 子阶段 | 目标摘要 | 测试结果 |
| --- | --- | --- |
| **F0** | 操作公共约定、失败/部分失败语义 | **8 passed** |
| **F** | Compare / Duplicate 决议基础 | **16 passed** |
| **F1** | Install prepare/confirm、回滚语义 | **24 passed** |
| **F2** | Uninstall 流程与回滚 | **22 passed** |
| **F3** | Duplicate Resolution 完整链路 | **12 passed** |

| 字段 | 内容 |
| --- | --- |
| **主要步骤** | 统一 Operation 模型；Preview→Prepare→Confirm；失败 / partial / rollback-failed；`phase-f-*-fragment.js` 测试拼装 |
| **关键产物** | `install-app.js`、`uninstall-app.js`、`compare-app.js` 等 + 大量 `phase-f*` 测试与 fragment |
| **停点** | Update 细粒度策略进入 F.4 |

---

### Phase F.4 / F.4.1 — Update 加固

| 字段 | 内容 |
| --- | --- |
| **F.4 目标** | 每文件策略 UI；显式写权限；`getUpdatePlanPreview`；Preview→Prepare→Confirm；结果页与 Audit 语义 |
| **F.4.1 目标** | 路径分类（modified/binary vs remoteAdds/Deletes）；Confirm 去重；Draft/Pending 幂等；多实例 `instanceStates`；二进制真实变更；Operation/Binding/Audit 优先级 |
| **主要步骤** | ① `update-app.js` + `shared.js` Update API ② 定向测试 22 / 25 ③ 禁止后续 Phase G 改动该状态机 |
| **测试结果** | F.4：**22 passed, 0 failed** · F.4.1：**25 passed, 0 failed** |
| **停点** | Update 契约冻结，进入体验与验收 Phase G |

---

### Phase G — Insights / Activity / Settings / Cases 守卫

| 字段 | 内容 |
| --- | --- |
| **目标** | 三页视觉与 IA；Cases 仅开发模式；Settings Host 列表与危险区；Activity 结果文案；`run-all` 扩至 20 suite |
| **主要步骤** | ① Insights/Activity/Settings 视觉收口 ② Cases `?dev=1` / `sp-dev=1` 守卫 ③ `setSetting` 返回 `{ok}`；导出 `applyTheme`/`applyLang` ④ `phase-g-targeted-tests.js` 初版 48 项 |
| **测试结果** | 初版 G：**48 passed**；全量 20 suite 绿 |
| **停点** | 进入 G.1 修验收阻塞项 |

---

### Phase G.1 — 最终验收阻塞修复

| 字段 | 内容 |
| --- | --- |
| **约束** | 只改 `shared.js`、三页 HTML、`phase-g-targeted-tests.js`（必要时 `run-all-tests.js`）；**禁止改 Phase F 状态机与其它正式页** |
| **步骤 1** | Activity Pending：`getOpenPendingActivityEvents` / `getOpenPendingTaskCount`；Pending 跟 open 任务；History 保留原事件 |
| **步骤 2** | Insights：`ignorePendingSuggestion` 原子忽略（规则 + resolve + Audit） |
| **步骤 3** | Settings：全量 `defaultSettings` 重置；严格 `setSetting`；控件单次绑定与同步回滚 |
| **步骤 4** | `applyLanguage` 真正更新 `[data-i18n]` / placeholder / aria |
| **步骤 5** | a11y：sum→button；Modal 焦点/Escape；动态字段 `$escape`/textContent |
| **步骤 6** | Phase G 强化弱测 + 新增 G-49…G-56 → **56 项** |
| **测试结果** | G：**56 passed, 0 failed**；F.4/F.4.1 仍绿；20 suite exit 0 |
| **停点** | 进入 G.2 冻结前收口 |

---

### Phase G.2 — 冻结前确定性收口

| 字段 | 内容 |
| --- | --- |
| **约束** | **仅** `shared.js` + `phase-g-targeted-tests.js`；禁止改页面/其它 suite |
| **步骤 1** | 从 `defaultSettings()` 删除 `scanStatus`/`scanResult`；`loadState` 仍清理历史字段 |
| **步骤 2** | Playwright Context 固定 `locale: 'zh-CN'` |
| **步骤 3** | G-52 改为完整 settings 对象深度比较 + 刷新复验 |
| **步骤 4** | 注释 `getOpenPendingTaskCount` 语义（可见 pending events ≠ 全部 PendingTask） |
| **测试结果** | 中文宿主 56 / 英文宿主 56；F.4.1 25；F.4 22；**20 suite All passed · exit 0** |
| **停点** | **允许冻结** |

---

### 冻结归档

| 字段 | 内容 |
| --- | --- |
| **步骤** | ① 撰写 `FINAL-FREEZE-REPORT.md` ② 修正 Activity Pending 文案一致性 ③ 输出 `HANDOFF-REPORT.md` ④ 本开发台账 |
| **结果** | 冻结基线确认；未自动 commit/tag/push（目录无 Git / 规则禁止） |
| **变更规则** | 新需求进新版本或分支；紧急修复须记录+回归；改完必跑 20-suite；禁止未授权改版本号/commit/push |

---

## 4. 结果汇总表

### 4.1 阶段完成度

| 阶段 | 状态 | 代表测试结果 |
| --- | --- | --- |
| A | 完成 | Phase1 + e2e/walkthrough 收口通过 |
| B | 完成 | 17 passed |
| B.1 | 完成 | 10 passed |
| C / C.1 | 完成 | 20 / 6 |
| D / D.1 / D.2 | 完成 | 35 / 22 / 18 |
| E / E.1 | 完成 | 34 / 24 |
| F0–F3 | 完成 | 8 / 16 / 24 / 22 / 12 |
| F.4 / F.4.1 | 完成 | **22 / 25** |
| G / G.1 / G.2 | 完成 | **56**（中/英宿主一致） |
| 冻结 | **已确认允许冻结** | 20 suites · exit 0 |

### 4.2 统一回归门禁（冻结时）

| Suite | 结果 |
| --- | --- |
| e2e / walkthrough / phase1 / phase2 / b1 | passed |
| c / c1 / d / d1 / d2 | passed |
| e / e1 / f0 / f / f1 / f2 / f3 | passed |
| f4 / f41 / g | **22 / 25 / 56** · 0 failed |
| **合计** | **20 suites · All passed · exit 0** |

### 4.3 架构结果（相对重构前）

| 维度 | 结果 |
| --- | --- |
| 状态源 | 唯一 `sp-state-v3`；Public API 读，页面不碰 Raw（测试除外） |
| 实体 | Asset / Instance / File / Host / PendingTask / AuditEvent / Operation … |
| 主流程 | Onboarding→Scan→Library→Detail/Editor→Install/Update/Uninstall→Insights/Activity/Settings |
| 导航 | 正式 4 入口；Cases 仅开发模式 |
| 测试 | Playwright 定向套件 + 统一 runner |
| 国际化 | 中文优先；G 阶段局部 English 切换（非完整产品英文） |

---

## 5. 关键决策备忘（台账摘录）

| 决策 | 结论 | 阶段 |
| --- | --- | --- |
| Host vs storageLocations | Host 为唯一目录/扫描配置源 | B |
| ignored | 仅 IgnoreRule / 任务层，非 Asset 生命周期 | A |
| AuditEvent | 不可变；Resolve/Ignore 写**新**事件 | B.1 / G.1 |
| Activity Pending | 可见 open pending events；有 taskId 则任务须 open | G.1 |
| Pending 侧栏计数 | = 可见 pending 事件数（含无 taskId），≠ 全部 PendingTask | G.1/G.2 |
| settings 扫描字段 | 移出 defaultSettings；loadState 兼容清理 | G.2 |
| Update 状态机 | G 阶段禁止改动 | G.1 约束 |
| Cases | 开发模式专用 | G |
| 冻结后改代码 | 须人工授权；必跑 20-suite | 冻结 |

---

## 6. 主要产物索引

| 类型 | 路径 |
| --- | --- |
| 运行时核心 | `shared.js` · `shared.css` |
| 页面 + app | `*.html` · `*-app.js` |
| 统一测试 | `run-all-tests.js` |
| 阶段测试 | `phase-*-targeted-tests.js` |
| 阶段报告 | `phase-a-closure-report.md` · `phase-b*-completion-report.md` |
| 规划 | `prototype-refactor-plan.md` |
| 冻结 | `FINAL-FREEZE-REPORT.md` |
| 交接 | `HANDOFF-REPORT.md` |
| 本台账 | `DEV-LEDGER.md`（本文件） |
| 历史参考（非运行时） | `shared.v2.js` · `shared.v2.css` |

---

## 7. 台账结论

1. **重构按 Phase A→G 顺序完成**，每阶段有明确停点与定向测试，避免大爆炸合并。  
2. **数据与状态机**从 v2 单文件模型演进为 PRD 5.0 v3，并以 Public API + 20-suite 作为契约。  
3. **最终结果：** Phase A–G 验收通过，允许冻结；已知限制为模拟态与非完整英文等非阻塞项。  
4. **后续工作**不得直接污染冻结基线；须新分支/新版本，并保留本台账追溯。

---

*台账编制日期：2026-07-25 · 状态：冻结基线归档配套文档*
