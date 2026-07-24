# Skill Panel PRD 5.0 原型交接报告

**基线状态：** 已冻结（见 `FINAL-FREEZE-REPORT.md`）  
**交接日期：** 2026-07-24  
**范围：** `prototype/` 目录（中文优先 MVP 交互原型，Phase A–G）

本报告面向后续接手开发 / 产品 / 测试同学，说明**改了什么、结构如何、怎么跑、还有什么坑**。  
不以生产发布为目标；真实网络、真实磁盘、AI、完整英文、签名公证等均不在本基线内。

---

## 1. 文件变更总览

> 说明：`prototype/` **不是 Git 仓库**，下列清单按冻结基线的职能分类，而非单次 diff。  
> 相对早期静态 HTML / v2 原型，当前基线以 v3 `shared.js` + 分页面脚本为主。

### 1.1 核心运行时（长期演进主文件）

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 大幅演进 | `shared.js` | 状态、种子数据、Public API、Install/Update/Uninstall/Duplicate、Settings、Activity Pending、i18n |
| 演进 | `shared.css` | 全局样式、主题变量、Toast、Modal |
| 保留参考 | `shared.v2.js` / `shared.v2.css` | **历史兼容副本，运行时页面已不依赖**；勿再当主路径改 |

### 1.2 正式页面（HTML）

| 操作 | 文件 |
| --- | --- |
| 主工作区 | `index.html`（Library）、`insights.html`、`activity.html`、`settings.html` |
| 生命周期 | `onboarding.html`、`scan.html`、`scan-changes.html` |
| Skill 读写 | `skill-detail.html`、`skill-editor.html`、`conflict.html`、`new-skill.html`、`add-existing.html` |
| 运维操作 | `install.html`、`update.html`、`uninstall.html`、`compare.html` |
| 开发专用 | `cases.html`（非 `?dev=1` / `sp-dev=1` 不可用） |

### 1.3 页面脚本（按页面拆分）

| 文件 | 对应能力 |
| --- | --- |
| `library-app.js` | Library 表/树、筛选、批量 |
| `skill-detail-app.js` | Detail |
| `skill-editor-app.js` | Editor |
| `conflict-app.js` | 外部冲突 |
| `install-app.js` / `update-app.js` / `uninstall-app.js` / `compare-app.js` | F 系列操作 UI |
| `chrome-launch.js` | Playwright Chromium 启动选项 |

### 1.4 测试与验收

| 文件 | 说明 |
| --- | --- |
| `run-all-tests.js` | **20 suite 统一入口** |
| `e2e-test.js` / `walkthrough-test.js` | 端到端 / 走查 |
| `phase1/2`、`phase-b1`、`phase-c*`、`phase-d*`、`phase-e*`、`phase-f*`、`phase-g*` | 分阶段定向测试 |
| `phase-f-*-fragment.js` / `phase-f1-ops-fragment.js` | F 系列测试片段 / 拼装辅助 |

### 1.5 文档与资产

| 操作 | 文件 |
| --- | --- |
| 新增（冻结） | `FINAL-FREEZE-REPORT.md` |
| 阶段报告 | `phase-a-closure-report.md`、`phase-b*-completion-report.md` 等 |
| 规划/指南 | `prototype-refactor-plan.md`、`prototype-logic-change.md`、`prototype-test-guide.md` |
| 截图 | `screenshot-*.png` |
| 依赖声明 | `package.json`、`package-lock.json` |
| 本地依赖（不纳入源码语义） | `node_modules/` |

### 1.6 G.1 / G.2 冻结前最后一轮实际改动面

**允许修改并已落地：**

- `shared.js`
- `insights.html` / `activity.html` / `settings.html`（G.1）
- `phase-g-targeted-tests.js`
- （必要时）`run-all-tests.js` — G.1 阶段已纳入 20 suite；G.2 **未改**页面与其它 suite

**G.2 仅改：** `shared.js`、`phase-g-targeted-tests.js`  
**冻结归档仅新增：** `FINAL-FREEZE-REPORT.md`（外加一处 Activity Pending 文案修正）

**明确未删正式产品页面；** 未删除测试套件。

---

## 2. 页面结构变化（相对早期原型 / G 阶段重点）

### 2.1 信息架构（IA）

正式侧栏固定 4 项工作区入口：

1. Library  
2. Insights  
3. Activity  
4. Settings  

Cases **不在正式导航**；仅开发模式进入。

### 2.2 Insights（G / G.1）

- 摘要区 `.sum` 由 `div` 改为 **`<button>`**（键盘 Enter/Space 可切换分类）
- 分类：建议归档 / 重复 / 文件问题 / 未完成草稿 / Token / 最近维护
- Archive Modal：打开聚焦、Escape 关闭、关闭后焦点回触发按钮
- 忽略归档 / 文件问题：走原子 API（见下），不再只建 IgnoreRule

### 2.3 Activity（G / G.1）

- 子视图：Pending / History
- **Pending 数据源变更（重要）：**
  - 不再单纯按 `AuditEvent.category === 'pending'` 展示
  - 使用 `SP.getOpenPendingActivityEvents()`：  
    - 有 `taskId` → 对应 PendingTask 必须仍为 `open`  
    - 无 `taskId` → 仍可出现在 Pending，但**不提供 Resolve**
  - 已解决任务的原 AuditEvent 保留在 History
- 侧栏徽章：`SP.getOpenPendingTaskCount()`（= 可见 open pending **事件**数，含无 taskId）
- Resolve Modal：焦点 / Escape / 焦点归还

### 2.4 Settings（G / G.1 / G.2）

- Host 列表来自 `SP.getHosts()`；用户文案为「已管理目录」，**不再展示** `SP.getHosts()` 字样
- 控件绑定：每个 Select/Input/Switch **只绑一次 change**；重复开关（如 `savePromptContent`）实时同步；失败回滚全部对应控件
- `#scan-meta` 只读摘要保留；**settings 对象不再包含** `scanStatus` / `scanResult`（G.2）
- Cases 相关行仅 `isDevMode()` 显示

### 2.5 Library / Detail / Editor / Ops 页面

- Phase C–F 期间完成主流程 UI；**G.1/G.2 冻结规则禁止再改这些正式页面**
- Update：Preview → Prepare → Confirm；每文件策略、写权限显式确认等在 F.4 / F.4.1 定型

---

## 3. JavaScript 数据结构与公共方法变更

### 3.1 状态模型要点（`shared.js`）

主实体（v3）：

- `assets` / `instances` / `files` / `hosts` / `sourceBindings`
- `pendingTasks` / `ignoreRules` / `auditEvents` / `usageEvents`
- `drafts` / `snapshots` / `operations`（Install/Update/Uninstall/Duplicate 等）
- `settings` / `viewStates` / `scanSessions` / `changeSets` …

**Settings（G.2）：**

- `defaultSettings()` **已删除** `scanStatus`、`scanResult`
- `loadState()` **仍会 delete** 历史持久化里的这两个字段（兼容清理）
- `resetSettingsToDefaults()`：`getState().settings = defaultSettings()` 全量替换

### 3.2 新增 / 强化的 Public API（交接重点）

| API | 用途 |
| --- | --- |
| `SP.getOpenPendingActivityEvents()` | Activity Pending 列表数据源 |
| `SP.getOpenPendingTaskCount()` | Activity 侧栏计数（可见 open pending events） |
| `SP.ignorePendingSuggestion({ taskId, skillId, reason })` | 忽略建议：IgnoreRule + resolve 精确任务 + `suggestion_ignored` AuditEvent |
| `SP.t(key, vars?)` | i18n 取值 |
| `SP.applyLanguage` / `SP.applyLang` | 更新 `SP.lang`、`html lang`、`[data-i18n]` / placeholder / aria |
| `SP.setSetting` / `SP.resetSettingsToDefaults` / `SP.getSettings` | 设置读写与校验（G.1 加强校验） |
| `SP.getUpdatePlanPreview` | Update 预览（只读，F.4） |
| `prepareUpdate` / `confirmUpdate` / … | Update 状态机（**冻结后勿随意改**） |
| 同理 Install / Uninstall / Duplicate 的 `prepare*` / `confirm*` | Phase F 状态机 |

### 3.3 测试专用（非正式页面可用）

仅在 test mode 注入：

```js
SP.__test.getRawState / patchRawState / saveState / getAssetRaw / …
```

正式页面**不得**依赖 Raw State。

### 3.4 v2 兼容层

仍导出 `getSkills` / `getSkill` / `getStorageLocations` 等，供旧页面形状读取；底层已是 v3 asset/instance。  
`shared.v2.js` 为整文件旧实现，**勿与现行 `shared.js` 混用**。

---

## 4. 原有功能可能受影响的点

| 区域 | 影响说明 |
| --- | --- |
| Activity Pending | 已 resolved 的 PendingTask 对应事件会从 Pending 消失，但仍在 History；依赖「category=pending 永驻 Pending」的旧假设会失效 |
| Activity 侧栏数字 | 等于可见 pending 事件数，**不等于**全部 open PendingTask 数（归档建议等可能无 pending AuditEvent） |
| Insights 忽略 | Archive/File 忽略会解决任务并写 AuditEvent；仅建 IgnoreRule 不够 |
| Settings 重置 | 全量 defaultSettings；旧逻辑若只 Object.assign 部分字段会不一致（已修） |
| Settings 非法值 | `setSetting` 严格校验，无效值不写 State；控件应回滚 |
| 语言 | `language: 'system'` 时跟随 `navigator`；测试固定 Playwright `locale: 'zh-CN'` |
| 扫描状态 | 不再存在于 settings；请读 Host / ScanSession / `#scan-meta` |
| Onboarding 守卫 | 未 `initialized` 会重定向 onboarding（测试/dev bypass 例外） |

**Phase F 状态机（Install/Update/Uninstall/Duplicate、Preview→Prepare→Confirm）在 G.1/G.2 明确禁止改动；** 接手若动这些，必须整套 F/F.4/F.4.1 回归。

---

## 5. 尚未完成 / 非本基线范围的交互

以下**不是漏测阻塞项**，而是产品边界或后续版本：

1. 真实远程下载 / 更新 / 鉴权  
2. 真实文件系统读写删、权限系统落地  
3. Hook / 脚本 / 依赖安装真实执行  
4. AI 能力  
5. 完整全局英文（目前 Insights/Activity/Settings 局部 i18n + 动态文案；Library 等仍中文为主）  
6. macOS 签名公证、Windows 安装升级回退人工验收  
7. 生产遥测、自动更新通道、商店分发  
8. Settings 部分区块标题/说明仍硬编码中文（导航与关键控件已部分 i18n）  
9. Toast / 「打开目录」等大量 **原型提示**，非真实系统调用  

MVP 主路径（Onboarding→Library→Detail/Editor→Scan→Install/Update/Uninstall→Insights/Activity/Settings）在原型层已可走通并有回归覆盖。

---

## 6. 临时兼容、重复代码、写死数据

### 6.1 临时 / 兼容代码

| 项 | 说明 |
| --- | --- |
| `loadState()` 删除 `scanStatus`/`scanResult` | 兼容旧 localStorage，非用户设置字段 |
| `getSkills` 等 v2 API | 兼容旧页面读模型 |
| `SP.__test` | 仅测试模式 |
| `shared.v2.*` | 历史备份，建议后续版本移出主目录或标明 deprecated |
| `isTestMode` / `isDevMode` / `isDevNavigationBypass` | 测试与开发旁路 |
| `applyLang` 别名 `applyLanguage` | 兼容旧调用 |

### 6.2 重复 / 碎片

| 项 | 说明 |
| --- | --- |
| `phase-f-*-fragment.js` | 测试拼装碎片，非产品运行时 |
| Settings 双份开关 | `savePromptContent` / `saveFilenames` 在「数据来源」「隐私」各一份；运行时需同步（已绑同步） |
| i18n 与页面内硬编码中英文 map | Activity 事件标签等仍有页面内 map + `SP.t` 并存 |

### 6.3 写死 / 模拟数据

| 项 | 说明 |
| --- | --- |
| Seed assets / hosts / adapters / pendingTasks | `shared.js` 内种子数据，演示与测试依赖 |
| `buildScanSteps()` 等 | 确定性模拟扫描步骤 |
| `installSim` / demo case loaders | Update/Install/Editor 演示场景 |
| Codex Token 限制文案 | 产品规则：无可靠数据不展示虚构 0 |
| 路径、归档目录默认值 | 如 `~/Library/Application Support/Skill Panel/Archive` |

---

## 7. 当前启动与测试方式

### 7.1 本地预览

1. 静态服务（历史验收常用端口 **8081**）：

```bash
cd "/Users/shovy/Documents/workbuddy/skill panel 原型设计/prototype"
# 任选静态服务器，例如：
python3 -m http.server 8081
```

2. 浏览器打开：

- `http://localhost:8081/index.html`  
- 开发 Cases：`cases.html?dev=1` 或先设 `localStorage.sp-dev=1`

3. Node / Playwright（与验收一致时建议）：

```bash
NODE=/Users/shovy/.workbuddy/binaries/node/versions/22.22.2/bin/node
export NODE_PATH="$(pwd)/node_modules"
# 若本机 node_modules 不全，可指向其它已装 playwright 的路径
```

依赖：`npm install`（`playwright@1.61.1`）+ 本机 Chrome/Chromium（见 `chrome-launch.js`）。

### 7.2 测试命令

```bash
# 全量 20 suite（冻结后改代码必跑）
$NODE run-all-tests.js
# 或
npm test

# 分阶段
$NODE phase-g-targeted-tests.js      # 56
$NODE phase-f41-targeted-tests.js    # 25
$NODE phase-f4-targeted-tests.js     # 22
```

Phase G Context 固定 `locale: 'zh-CN'`；宿主 `LANG` 中/英均应 56 passed。

### 7.3 冻结后变更规则（摘要）

- 新需求进新版本 / 独立分支，不混入冻结基线  
- 紧急修复须记录原因、影响面、新增回归  
- 改完必须重跑完整 20-suite  
- **未经人工授权：禁止自动改版本号、commit、tag、push**

---

## 8. 已知问题清单

### 8.1 非阻塞（已接受）

1. 全模拟：无真实网络 / 磁盘副作用  
2. 非完整英文 i18n  
3. Pending 计数语义 ≠ 全部 PendingTask（已文档化）  
4. 目录内历史文档、截图、`shared.v2.*` 造成「文件噪音」  
5. `prototype/` 无 Git；版本管理需人工另建  
6. 大量 Toast「（原型）」文案  
7. 部分页面动态渲染仍混有硬编码中文  

### 8.2 接手时易踩坑

1. **改 Activity Pending 过滤逻辑** → 必跑 G-49 及 Activity 相关用例  
2. **改 Settings default / setSetting** → 必跑 G-23/25/52/53；注意 G.2 已去掉 settings 内扫描字段  
3. **改 Update 路径分类 / Confirm** → 必跑 F.4 + F.4.1，禁止静默改状态机  
4. **正式页读 `SP.__test`** → 违反架构；测试会抓  
5. **忽略建议只调 `createIgnoreRule`** → Insights 候选不会消失（须 `ignorePendingSuggestion`）  
6. **Playwright `evaluate` 多参数** → 需包成单对象（G 测试已踩过）  
7. **系统语言影响断言** → 应用 Context `locale: 'zh-CN'`，不要用宿主语言分支跳过  

### 8.3 无当前已知阻塞缺陷

冻结验收：**Phase A–G 通过，20 suite exit 0。**  
未授权前不要继续开发新功能、UI 优化或非阻塞重构。

---

## 9. 推荐阅读顺序（接手）

1. `FINAL-FREEZE-REPORT.md` — 冻结结论与规则  
2. 本交接报告  
3. Desktop 文档仓（若需要 PRD）：`skill-panel-prd5-prototype-refactor/PRD5.0.md`（**非**本运行时目录）  
4. `shared.js` 导出块（约文末 `const SP = { ... }`）  
5. `phase-g-targeted-tests.js` / `phase-f41-targeted-tests.js` — 行为契约  
6. `update-app.js` + Update 相关 API — 最复杂状态机  

---

## 10. 一句话交接结论

**Skill Panel PRD 5.0 中文优先交互原型已冻结：** 主流程可演示、Public API 以 `shared.js` 为唯一真相源、20 套 Playwright 回归为门禁；后续只允许受控缺陷修复或新版本分支，禁止在无授权情况下改代码、改版本号或推送远程。

---

*报告结束。如需把本文另存为独立文件名或拆成「研发 / 测试 / 产品」三份简版，可再说明格式要求。*
