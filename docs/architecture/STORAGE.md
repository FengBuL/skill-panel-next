# 存储边界

## SQLite

SQLite 保存 Skill Panel 自有管理数据：

- Asset、Skill、SkillInstance、AssetFile 元数据。
- Formal Index、Scan Result、Change Set 的关系与状态。
- Category、Tag、PermissionGrant、SourceBinding。
- Draft、Snapshot 元数据、Usage、Activity 和设置。
- FTS5 文本索引。
- migration 版本。

SQLite 不保存 API Key、系统凭据或默认完整提示词正文。

## 文件系统

文件系统保存：

- 用户拥有的 Skill Package；应用默认只读。
- 快照内容与包归档。
- 导出文件和脱敏诊断包。
- 受控临时文件。

数据库只保存快照路径、哈希、大小、创建原因、保留策略和关联对象。快照文件使用应用数据
目录下的内容寻址布局：

```text
snapshots/<asset-uuid>/<snapshot-uuid>/<relative-path>
```

写入流程需要先创建临时快照、校验完整性、原子提交数据库记录，再进入目标写入。快照失败
时终止高风险操作。

## Skill 文件所有权

Skill 文件始终由用户拥有。应用获得的读取或写入权限只限定操作能力，不转移所有权。分类、
标签、收藏和索引默认只写 SQLite。同步到 `SKILL.md` 需要单独授权、Diff 和快照。

## Migration

- migration 文件只追加，已发布 migration 禁止改写。
- `schema_migrations` 记录已应用版本。
- 每个 migration 在事务内执行。
- 本基础任务只建立 `0001_initial.sql` 和 FTS5 可用性探针。
- 后续实体表需要独立任务卡和迁移评审。

## 备份与恢复

当前基础任务不提供用户备份流程。后续设计需覆盖数据库、快照索引和文件内容的一致性，
并明确恢复会覆盖的范围。
