# Skill Panel 原型测试指南

本指南用于在本地静态 HTML 原型中验证 Skill Panel 的产品逻辑与交互流程。所有测试基于 `prototype/` 目录下的 HTML 文件与 `shared.js` 统一状态仓库。

## 1. 测试环境

- 浏览器：Chrome / Safari / Edge 最新稳定版
- 打开方式：直接用浏览器打开 `prototype/index.html`（无需服务器）
- 数据存储：`localStorage`（键 `sp-state-v2`）
- 重置数据：Settings → 关于与诊断 → 重置全部案例数据，或访问 `cases.html` 点击「重置全部案例数据」

## 2. 快速回归命令

```bash
cd /Users/shovy/.workbuddy/binaries/node/workspace
NODE_PATH=/Users/shovy/.workbuddy/binaries/node/workspace/node_modules \
/Users/shovy/.workbuddy/binaries/node/versions/22.22.2/bin/node \
"/Users/shovy/Documents/workbuddy/skill panel 原型设计/prototype/e2e-test.js"

NODE_PATH=/Users/shovy/.workbuddy/binaries/node/workspace/node_modules \
/Users/shovy/.workbuddy/binaries/node/versions/22.22.2/bin/node \
"/Users/shovy/Documents/workbuddy/skill panel 原型设计/prototype/walkthrough-test.js"
```

## 3. 核心状态说明

### 3.1 生命周期（lifecycleStatus）

- `active`：正常在 Library 中展示
- `archived`：只出现在 Library → 已归档 视图
- `ignored`：不在 Library 展示，只在 Settings → 忽略规则 中管理

### 3.2 健康状态优先级

`permission_denied > path_missing > external_conflict > yaml_error > empty_content > unfinished_draft > duplicate_candidate > archive_candidate > token_attention > normal`

### 3.3 12 个内置案例

| 案例 ID | 生命周期 | 主要健康/待处理 | 测试重点 |
|---|---|---|---|
| `demo-normal` | active | normal | 正常编辑、归档、收藏 |
| `demo-codex` | active | normal | Codex 来源使用数据统一显示「暂无数据」 |
| `demo-archive-candidate` | active | archive_candidate | 归档建议、置信度、数据窗口 |
| `demo-external-conflict` | active | external_conflict | 冲突弹窗、强制覆盖后不再重复弹窗 |
| `demo-yaml-error` | active | yaml_error | Editor 自动定位错误行、暂停元数据同步 |
| `demo-path-missing` | active | path_missing | 路径失效处理、不提供编辑 |
| `demo-permission-denied` | active | permission_denied | 重新授权、停止管理目录 |
| `demo-archived` | archived | normal | 恢复、永久删除、历史版本 |
| `demo-ignored` | ignored | ignored | 只在 Settings 管理、恢复管理 |
| `demo-duplicate-a/b` | active | duplicate_candidate | 比较差异、保留/归档/忽略 |
| `demo-draft` | active | unfinished_draft | 未应用草稿流程 |
| `demo-empty-content` | active | empty_content | 空内容提示、Editor 完善 |

## 4. Library 页面测试

### 4.1 默认视图

1. 打开 `index.html`
2. 确认默认只展示 `active` Skill
3. 确认左侧来源筛选包含：Claude Code、Codex、自定义目录、分隔线、生命周期视图 → 已归档
4. 确认已归档视图可切换，且只展示 `lifecycleStatus === 'archived'` 的 Skill
5. 确认已忽略 Skill 不出现在 Library 任何视图

### 4.2 筛选与搜索

1. 在搜索框输入 `demo-yaml` → 只匹配对应 Skill
2. 打开筛选面板：
   - 使用数据：选择「有使用数据」→ Codex/Custom Skill 应被过滤
   - 选择「无使用数据」→ Claude Skill 应被过滤
   - 确认没有 `external_changed` 筛选条件
3. 切换来源或页码后，确认顶部批量选择已清空
4. 确认「已启用筛选」标签显示当前生效条件

### 4.3 批量选择

1. 选中若干行后切换页码 → 确认选择清空
2. 选中若干行后修改搜索词 → 确认选择清空
3. 选中若干行后修改来源 → 确认选择清空
4. 当存在隐藏选择项时，确认批量归档/忽略按钮被禁用或提示
5. 表头全选支持 `indeterminate` 状态

### 4.4 状态单元格

1. 对 `demo-yaml-error` 行，确认状态列显示「YAML 错误」+ 剩余待处理数量
2. 对 `demo-external-conflict` 行，确认显示「外部冲突」
3. 对 `demo-archive-candidate` 行，确认显示「清理候选」

### 4.5 行尾操作

1. `demo-normal`：编辑、详情、归档、忽略
2. `demo-archived`（在已归档视图）：恢复、详情、删除
3. `demo-path-missing`：不出现「编辑」按钮

## 5. Detail 页面测试

### 5.1 正常 Skill（demo-normal）

1. 从 Library 点击「打开详情」
2. 确认顶部操作：编辑、收藏、打开目录
3. 确认返回按钮回到 Library 并保留筛选/滚动位置

### 5.2 YAML 错误（demo-yaml-error）

1. 打开 Detail
2. 确认顶部显示「打开 Editor 定位错误」按钮
3. 点击后进入 Editor，自动滚动到错误行并高亮
4. 确认右侧元数据面板显示「元数据双向同步已暂停」

### 5.3 路径丢失（demo-path-missing）

1. 打开 Detail
2. 确认不出现「编辑」按钮
3. 确认管理建议区提供：定位新路径、重新关联、忽略、移除失效记录
4. 确认路径显示为原路径

### 5.4 权限拒绝（demo-permission-denied）

1. 打开 Detail
2. 确认顶部操作：重新授权、停止管理目录
3. 确认不提供编辑

### 5.5 外部冲突（demo-external-conflict）

1. 从 Detail 或 Editor 进入冲突处理
2. 确认选项：比较并合并、重新加载磁盘版本、保留草稿、另存为新 Skill、强制覆盖
3. 选择「强制覆盖」→ 二次确认 → 应用成功
4. 再次点击「应用更改」→ 确认不再进入同一个冲突弹窗

### 5.6 已归档（demo-archived）

1. 在 Library → 已归档 打开 Detail
2. 确认操作：恢复、选择恢复目录、打开归档目录、查看历史版本、永久删除
3. 点击恢复 → 选择目标目录 → 确认恢复到 active Library

### 5.7 已忽略（demo-ignored）

1. 确认该 Skill 不在 Library
2. 在 Settings → 忽略规则 中找到 demo-ignored
3. 点击「恢复管理」→ 确认 Skill 回到 active Library

## 6. Editor 页面测试

### 6.1 正常编辑（demo-normal）

1. 从 Library 点击「编辑」
2. 修改内容 → 确认草稿状态变为「草稿未应用」
3. 按 Ctrl/Cmd+S 或点击「应用更改」
4. 确认创建快照并写回

### 6.2 YAML 错误自动定位（demo-yaml-error）

1. 从 Detail 点击「打开 Editor 定位错误」
2. 确认 Editor 自动聚焦并选中错误行
3. 确认右侧元数据 tab 显示暂停提示
4. 在元数据 tab 输入内容 → 确认不会同步回源码
5. 修复 YAML 后 → 确认暂停提示消失

### 6.3 外部冲突强制覆盖（demo-external-conflict）

1. 进入 Editor
2. 点击「应用更改」→ 弹出「外部文件已变更」
3. 点击「强制覆盖…」→ 弹出二次确认
4. 确认后应用成功
5. 再次点击「应用更改」→ 不再弹出同一个冲突弹窗

### 6.4 返回来源

1. 从 Insights → 文件问题 → 打开 Editor
2. 在 Editor 点击「返回」
3. 确认回到 Insights 的对应 tab

## 7. Insights 页面测试

### 7.1 建议归档

1. 找到 `demo-archive-candidate`
2. 确认显示：数据窗口 90 天、来源、置信度、原目录、归档目录、快照规则、恢复方式
3. 点击「归档」→ 确认 Skill 移出 active Library

### 7.2 重复待确认

1. 找到 `demo-duplicate-a/b`
2. 点击「查看差异」→ 进入 Compare 页面
3. 测试保留左侧、保留右侧、归档左侧、归档右侧、忽略重复组
4. 操作后确认返回 Insights

### 7.3 文件问题

1. `demo-yaml-error`：点击「打开 Editor」→ 验证 Editor 定位
2. `demo-path-missing`：点击「修复路径」→ 提示在 Settings 中处理
3. `demo-permission-denied`：点击「重新授权」→ 提示授权成功

## 8. Compare 页面测试

1. 从 Insights 重复组进入 Compare
2. 确认左右侧显示文档 Token、使用次数、最近编辑/使用
3. 点击「查看详情」「编辑」→ 进入对应页面
4. 点击「返回」→ 回到 Insights
5. 保留左侧/右侧后 → 确认回到来源页

## 9. Activity 页面测试

1. 切换「待处理」/「历史记录」
2. 点击事件行 → 右侧抽屉显示详情
3. 对 pending 事件点击「打开 Editor」/「查看详情」→ 验证跨页面跳转
4. 点击「标记为已处理」→ 事件状态更新

## 10. Settings 页面测试

1. 已忽略 Skill 管理：
   - 找到 `demo-ignored`
   - 点击「恢复管理」→ 回到 active Library
2. 扫描与诊断：
   - 点击「重新扫描」→ 确认扫描状态摘要
   - 点击「打开案例中心」→ 进入 `cases.html`
   - 点击「重置全部案例数据」→ 确认 localStorage 重置

## 11. Cases 页面测试

1. 打开 `cases.html`
2. 确认 12 个案例卡片全部显示
3. 每个案例点击「打开 Detail」「打开 Editor」→ 验证进入对应页面
4. 点击「重置全部案例数据」→ 刷新后数据恢复初始状态

## 12. 跨页面上下文测试

### 12.1 Library → Detail → 返回

1. 在 Library 设置筛选：来源 = Claude Code，搜索 = `demo`
2. 打开 `demo-normal` Detail
3. 点击返回 → 确认回到 Library，筛选和滚动位置保留

### 12.2 Insights → Compare → Editor → 返回

1. 在 Insights → 重复待确认 打开 Compare
2. 在 Compare 点击左侧「编辑」
3. 在 Editor 点击返回 → 确认回到 Compare
4. 在 Compare 点击返回 → 确认回到 Insights 重复 tab

### 12.3 Activity → Editor → 返回

1. 在 Activity 待处理中打开 external_conflict 事件的 Editor
2. 点击返回 → 确认回到 Activity 待处理视图

## 13. 回归检查清单

- [ ] 所有页面脚本通过 `node --check` 语法检查
- [ ] e2e-test.js 全部通过
- [ ] walkthrough-test.js 全部通过
- [ ] 所有 HTML 文件能直接通过浏览器打开并渲染（HTTP 200 或 file:// 正常）
- [ ] 无直接 `location.href = 'skill-detail.html?skill=...'` 等硬编码跳转（统一使用 `SP.openSkillDetail` / `SP.openSkillEditor` / `SP.openCompare` / `SP.returnToOrigin`）
- [ ] Codex 来源 Skill 使用数据不显示 0 次调用，统一显示「暂无数据」
- [ ] 路径丢失/权限拒绝 Skill 在 Library 行尾和 Detail 不提供编辑入口
- [ ] 强制覆盖后 `_forceOverriddenAt` 记录生效，不重复进入冲突弹窗
- [ ] YAML 错误 Skill 进入 Editor 自动定位错误行并暂停元数据同步
