/* Skill Panel Shared v3 — theme, language, unified state store and utilities */
(function () {
  'use strict';

  const STATE_KEY = 'sp-state-v3';
  const ORIGIN_KEY = 'sp-origin';
  const THEME_KEY = 'sp-theme';
  const LANG_KEY = 'sp-lang';
  const STATE_VERSION = 3;
  const LEGACY_STATE_KEY = 'sp-state-v2';

  /* ---------- UUID ---------- */
  const _seedUuidMap = new Map();
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    // Fallback: v4-like
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function seedUuid(key) {
    if (!_seedUuidMap.has(key)) {
      const n = _seedUuidMap.size + 1;
      _seedUuidMap.set(key, `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`);
    }
    return _seedUuidMap.get(key);
  }

  /* ---------- i18n ---------- */
  const i18n = {
    zh: {
      'app.title': 'Skill Panel — 本地 Skill 管理',
      'nav.library': 'Library',
      'nav.insights': 'Insights',
      'nav.activity': 'Activity',
      'nav.settings': 'Settings',
      'source.claude': 'Claude Code',
      'source.codex': 'Codex',
      'source.custom': '自定义目录',
      'source.archived': '已归档',
      'theme.light': '浅色',
      'theme.dark': '深色',
      'theme.system': '自动',
      'lang.zh': '中文',
      'lang.en': 'EN',
      'search.placeholder': '搜索名称、路径、标签或描述…',
      'btn.new': '新建 Skill',
      'btn.add': '添加 Skill',
      'btn.cols': '列设置',
      'btn.filter': '筛选',
      'btn.edit': '编辑',
      'btn.detail': '详情',
      'btn.fav': '收藏',
      'btn.archive': '归档',
      'btn.ignore': '忽略建议',
      'btn.restore': '恢复',
      'btn.delete': '永久删除…',
      'btn.save': '保存',
      'btn.cancel': '取消',
      'btn.confirm': '确认',
      'btn.back': '← 返回',
      'btn.apply': '应用更改',
      'btn.diff': '查看差异',
      'btn.discard': '放弃草稿',
      'btn.snapshot': '创建快照',
      'status.normal': '正常',
      'status.archived': '已归档',
      'status.ignored': '已排除（规则）',
      'status.broken': '路径失效',
      'status.empty': '内容为空',
      'status.dup': '疑似重复',
      'status.idle': '清理候选',
      'status.external_changed': '外部修改',
      'status.yaml_error': 'YAML 错误',
      'status.required_field_missing': '必填字段缺失',
      'status.permission_denied': '无权限',
      'status.name_conflict': '同名冲突',
      'status.unfinished_draft': '未完成草稿',
      'status.failed_operation': '操作失败',
      'status.external_conflict': '外部冲突',
      'status.token_attention': 'Token 关注',
      'status.restore_conflict': '恢复冲突',
      'status.path-missing': '路径失效',
      'status.permission-denied': '无权限',
      'status.empty-content': '内容为空',
      'empty.search': '当前搜索无匹配 Skill',
      'empty.filter': '当前筛选无结果',
      'empty.data': '暂无可用数据',
      'empty.pending': '当前没有待处理事项',
      'empty.history': '历史记录为空',
      'toast.archived': '已归档管理状态（不移动宿主文件），可在 Library → 已归档 恢复',
      'toast.ignored': '已忽略建议；未改变 Asset 生命周期',
      'toast.restored': '已恢复管理生命周期（不移动宿主文件）',
      'toast.deleted': '已永久删除',
      'toast.saved': '已保存并创建快照',
      'toast.snapshot': '已创建快照',
      'toast.applied': '已应用更改',
      'toast.draft_saved': '草稿已自动保存',
      'codex.tip': '当前 Codex 缺少稳定、公开且可验证的逐 Skill 使用数据接口，因此暂时无法可靠统计单个 Skill 的调用次数和关联 Token。',
      'custom.tip': '自定义目录未连接使用数据适配器，仅展示本地可确认的文件与文档 Token。',
      'assoc.note': '关联 Token 包含 Skill 激活期间的会话上下文、文件内容和模型输出，仅用于趋势比较。',
      'insights.title': 'Insights',
      'insights.lead': '待处理任务队列。使用少只代表候选信号，不会自动判定无价值。',
      'insights.tab.archive': '建议归档',
      'insights.tab.dup': '重复待确认',
      'insights.tab.file': '文件问题',
      'insights.tab.draft': '未完成草稿',
      'insights.tab.token': 'Token 关注项',
      'insights.tab.maint': '最近维护',
      'insights.empty.archive': '没有建议归档的 Skill',
      'insights.empty.dup': '没有疑似重复',
      'insights.empty.file': '没有文件问题',
      'insights.empty.draft': '没有未完成草稿',
      'insights.empty.token': '没有 Token 关注项',
      'insights.empty.maint': '最近维护记录为空',
      'insights.btn.archive': '归档',
      'insights.btn.ignore': '忽略',
      'insights.btn.detail': '查看详情',
      'activity.title': 'Activity',
      'activity.lead': '待处理异常与可追溯历史记录。普通“打开 Skill”默认不展示。',
      'activity.tab.pending': '待处理',
      'activity.tab.history': '历史记录',
      'activity.filter.today': '今天',
      'activity.filter.7d': '最近 7 天',
      'activity.filter.30d': '最近 30 天',
      'activity.filter.all': '全部',
      'activity.filter.usage': '使用记录',
      'activity.filter.edit': '编辑应用',
      'activity.filter.snap': '快照恢复',
      'activity.filter.archive': '归档管理',
      'activity.filter.system': '系统维护',
      'activity.sort.latest': '最新时间',
      'activity.sort.earliest': '最早时间',
      'activity.sort.token': 'Token Top',
      'activity.sort.priority': '待处理优先级',
      'activity.empty.pending': '当前没有待处理事项',
      'activity.empty.history': '历史记录为空',
      'activity.btn.resolve': '标记为已处理',
      'activity.col.time': '时间',
      'activity.col.skill': 'Skill',
      'activity.col.event': '事件',
      'activity.col.category': '类别',
      'activity.col.source': '来源',
      'activity.col.token': '关联 Token',
      'activity.col.result': '结果',
      'activity.col.actions': '操作',
      'settings.sec.dirs': '目录设置',
      'settings.sec.sources': '数据来源',
      'settings.sec.backup': '草稿、备份与版本',
      'settings.sec.archive': '归档、忽略与删除',
      'settings.sec.appear': '外观与语言',
      'settings.sec.privacy': '隐私与安全',
      'settings.sec.about': '关于与诊断',
      'settings.dirs.title': '目录设置',
      'settings.dirs.lead': '扫描系统允许访问的授权范围。停止管理不会删除磁盘文件。',
      'settings.dirs.managed': '已管理目录',
      'settings.dirs.scanMeta': '最后全量扫描：{time} · 已管理目录 · 只识别包含 SKILL.md 的目录',
      'settings.toast.saved': '设置已保存',
      'settings.toast.reset': '设置已重置',
      'nav.workspace': '工作区'
    },
    en: {
      'app.title': 'Skill Panel — Local Skill Manager',
      'nav.library': 'Library',
      'nav.insights': 'Insights',
      'nav.activity': 'Activity',
      'nav.settings': 'Settings',
      'source.claude': 'Claude Code',
      'source.codex': 'Codex',
      'source.custom': 'Custom',
      'source.archived': 'Archived',
      'theme.light': 'Light',
      'theme.dark': 'Dark',
      'theme.system': 'Auto',
      'lang.zh': '中文',
      'lang.en': 'EN',
      'search.placeholder': 'Search name, path, tags or description…',
      'btn.new': 'New Skill',
      'btn.add': 'Add Skill',
      'btn.cols': 'Columns',
      'btn.filter': 'Filter',
      'btn.edit': 'Edit',
      'btn.detail': 'Detail',
      'btn.fav': 'Favorite',
      'btn.archive': 'Archive',
      'btn.ignore': 'Ignore suggestion',
      'btn.restore': 'Restore',
      'btn.delete': 'Delete Permanently…',
      'btn.save': 'Save',
      'btn.cancel': 'Cancel',
      'btn.confirm': 'Confirm',
      'btn.back': '← Back',
      'btn.apply': 'Apply Changes',
      'btn.diff': 'View Diff',
      'btn.discard': 'Discard Draft',
      'btn.snapshot': 'Create Snapshot',
      'status.normal': 'Normal',
      'status.archived': 'Archived',
      'status.ignored': 'Excluded (rule)',
      'status.broken': 'Broken Path',
      'status.empty': 'Empty',
      'status.dup': 'Duplicate',
      'status.idle': 'Cleanup Candidate',
      'status.external_changed': 'External Change',
      'status.yaml_error': 'YAML Error',
      'status.required_field_missing': 'Missing Required Field',
      'status.permission_denied': 'Permission Denied',
      'status.name_conflict': 'Name Conflict',
      'status.unfinished_draft': 'Unfinished Draft',
      'status.failed_operation': 'Failed Operation',
      'status.external_conflict': 'External Conflict',
      'status.token_attention': 'Token Attention',
      'status.restore_conflict': 'Restore Conflict',
      'status.path-missing': 'Broken Path',
      'status.permission-denied': 'Permission Denied',
      'status.empty-content': 'Empty Content',
      'empty.search': 'No matching Skill',
      'empty.filter': 'No results for current filters',
      'empty.data': 'No data available',
      'empty.pending': 'No pending items',
      'empty.history': 'No history records',
      'toast.archived': 'Archived. Recover via Library → Archived.',
      'toast.ignored': 'Suggestion ignored; Asset lifecycle unchanged.',
      'toast.restored': 'Restored and re-added to Library.',
      'toast.deleted': 'Permanently deleted.',
      'toast.saved': 'Saved and snapshot created.',
      'toast.snapshot': 'Snapshot created.',
      'toast.applied': 'Changes applied.',
      'toast.draft_saved': 'Draft autosaved.',
      'codex.tip': 'Codex currently lacks a stable, public, verifiable per-Skill usage API, so per-Skill call counts and associated tokens cannot be reliably shown.',
      'custom.tip': 'Custom directories have no usage adapter; only local file and document token data are shown.',
      'assoc.note': 'Associated tokens include session context, file contents and model output during Skill activation; for trend comparison only.',
      'insights.title': 'Insights',
      'insights.lead': 'Pending task queue. Low usage is only a candidate signal, not proof of low value.',
      'insights.tab.archive': 'Archive suggestions',
      'insights.tab.dup': 'Duplicates',
      'insights.tab.file': 'File issues',
      'insights.tab.draft': 'Unfinished drafts',
      'insights.tab.token': 'Token attention',
      'insights.tab.maint': 'Recent maintenance',
      'insights.empty.archive': 'No archive suggestions',
      'insights.empty.dup': 'No suspected duplicates',
      'insights.empty.file': 'No file issues',
      'insights.empty.draft': 'No unfinished drafts',
      'insights.empty.token': 'No token attention items',
      'insights.empty.maint': 'No recent maintenance records',
      'insights.btn.archive': 'Archive',
      'insights.btn.ignore': 'Ignore',
      'insights.btn.detail': 'View detail',
      'activity.title': 'Activity',
      'activity.lead': 'Pending exceptions and auditable history. Ordinary “open Skill” events are hidden by default.',
      'activity.tab.pending': 'Pending',
      'activity.tab.history': 'History',
      'activity.filter.today': 'Today',
      'activity.filter.7d': 'Last 7 days',
      'activity.filter.30d': 'Last 30 days',
      'activity.filter.all': 'All',
      'activity.filter.usage': 'Usage',
      'activity.filter.edit': 'Edits',
      'activity.filter.snap': 'Snapshots',
      'activity.filter.archive': 'Archive',
      'activity.filter.system': 'System',
      'activity.sort.latest': 'Newest',
      'activity.sort.earliest': 'Oldest',
      'activity.sort.token': 'Token Top',
      'activity.sort.priority': 'Pending priority',
      'activity.empty.pending': 'No pending items',
      'activity.empty.history': 'History is empty',
      'activity.btn.resolve': 'Mark as resolved',
      'activity.col.time': 'Time',
      'activity.col.skill': 'Skill',
      'activity.col.event': 'Event',
      'activity.col.category': 'Category',
      'activity.col.source': 'Source',
      'activity.col.token': 'Associated tokens',
      'activity.col.result': 'Result',
      'activity.col.actions': 'Actions',
      'settings.sec.dirs': 'Directories',
      'settings.sec.sources': 'Data sources',
      'settings.sec.backup': 'Drafts, backup & versions',
      'settings.sec.archive': 'Archive, ignore & delete',
      'settings.sec.appear': 'Appearance & language',
      'settings.sec.privacy': 'Privacy & security',
      'settings.sec.about': 'About & diagnostics',
      'settings.dirs.title': 'Directories',
      'settings.dirs.lead': 'Scan within authorized scopes. Stopping management does not delete disk files.',
      'settings.dirs.managed': 'Managed directories',
      'settings.dirs.scanMeta': 'Last full scan: {time} · Managed directories · Only folders with SKILL.md',
      'settings.toast.saved': 'Settings saved',
      'settings.toast.reset': 'Settings reset',
      'nav.workspace': 'Workspace'
    }
  };

  function t(key, vars) {
    const lang = SP.lang === 'en' ? 'en' : 'zh';
    let s = (i18n[lang] && i18n[lang][key]) || (i18n.zh && i18n.zh[key]) || key;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach(k => { s = String(s).split('{' + k + '}').join(String(vars[k])); });
    }
    return s;
  }

  /* ---------- helpers ---------- */
  const $now = () => new Date().toISOString();
  const $daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const $hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString();
  const $clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const $escape = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const $tokenApprox = (text) => text ? Math.ceil(text.split(/\s+/).filter(Boolean).length * 0.6) : 0;
  const $hash = (text) => { let h = 0; for (let i = 0; i < (text || '').length; i++) h = (h << 5) - h + text.charCodeAt(i); return Math.abs(h).toString(16); };
  const $dateOnly = (iso) => iso ? new Date(iso).toLocaleDateString('zh-CN') : '—';
  const $timeAgo = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso); const now = new Date(); const diff = (now - d) / 1000;
    if (diff < 60) return SP.lang === 'en' ? 'just now' : '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + (SP.lang === 'en' ? 'm ago' : ' 分钟前');
    if (diff < 86400) return Math.floor(diff / 3600) + (SP.lang === 'en' ? 'h ago' : ' 小时前');
    if (diff < 172800) return SP.lang === 'en' ? 'yesterday' : '昨天';
    return Math.floor(diff / 86400) + (SP.lang === 'en' ? 'd ago' : ' 天前');
  };
  const $formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso); const now = new Date(); const diff = (now - d) / 1000;
    if (diff < 86400) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };
  const $simpleMd = (md) => {
    if (!md) return '';
    let html = '';
    const lines = md.split('\n');
    let inCode = false, codeBuf = '';
    const flushCode = () => { if (!codeBuf) return; html += `<pre><code>${$escape(codeBuf)}</code></pre>`; codeBuf = ''; };
    for (const line of lines) {
      if (line.startsWith('```')) { if (inCode) { flushCode(); inCode = false; } else { inCode = true; } continue; }
      if (inCode) { codeBuf += line + '\n'; continue; }
      if (line.startsWith('# ')) { html += `<h1>${$escape(line.slice(2))}</h1>`; continue; }
      if (line.startsWith('## ')) { html += `<h2>${$escape(line.slice(3))}</h2>`; continue; }
      if (line.startsWith('### ')) { html += `<h3>${$escape(line.slice(4))}</h3>`; continue; }
      if (/^\d+\.\s/.test(line)) { html += `<li>${$escape(line.replace(/^\d+\.\s/, ''))}</li>`; continue; }
      if (line.startsWith('- ') || line.startsWith('* ')) { html += `<li>${$escape(line.slice(2))}</li>`; continue; }
      if (line.trim() === '') { html += '<br>'; continue; }
      html += `<p>${$escape(line)}</p>`;
    }
    if (inCode) flushCode();
    html = html.replace(/(<li>.*?<\/li>)+/g, m => `<ul>${m}</ul>`);
    return html;
  };
  const $lineDiff = (a, b) => {
    const A = (a || '').split('\n'), B = (b || '').split('\n');
    let out = ''; const max = Math.max(A.length, B.length);
    for (let i = 0; i < max; i++) {
      if (A[i] === B[i]) out += ` ${A[i] || ''}\n`;
      else { if (A[i] !== undefined) out += `- ${A[i]}\n`; if (B[i] !== undefined) out += `+ ${B[i]}\n`; }
    }
    return out;
  };
  const $parseYaml = (text) => {
    const obj = {};
    if (!text) return obj;
    const m = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!m) return obj;
    m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) obj[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    return obj;
  };
  const $buildYaml = (obj) => ['---', ...Object.entries(obj).map(([k, v]) => `${k}: ${v}`), '---'].join('\n');

  /* ---------- safe accessors ---------- */
  function $isArray(v) { return Array.isArray(v); }
  function $isStr(v) { return typeof v === 'string'; }
  function $safeJoin(arr, sep = ', ') { return $isArray(arr) ? arr.join(sep) : ''; }
  function $safeIncludes(arr, val) { return $isArray(arr) ? arr.includes(val) : false; }
  function $safeSlice(text, start, end) { return $isStr(text) ? text.slice(start, end) : ''; }
  function $safeLocale(n) { return typeof n === 'number' ? n.toLocaleString() : String(n ?? ''); }
  function $safeToLower(v) { return $isStr(v) ? v.toLowerCase() : ''; }
  function $coerceArray(v) { if (v == null) return []; if ($isArray(v)) return v; return [v]; }

  /* ---------- normalizers (preserve unknown fields) ---------- */
  function withDefaults(obj, defaults) {
    if (!obj || typeof obj !== 'object') obj = {};
    const out = { ...obj };
    for (const k of Object.keys(defaults)) {
      if (out[k] == null) out[k] = defaults[k];
    }
    return out;
  }

  function normalizeSupportedHosts(list) {
    const LEGACY = {
      claude: 'claude-code',
      'claude-code': 'claude-code',
      codex: 'codex',
      cursor: 'cursor',
      warp: 'warp',
      custom: 'custom'
    };
    let hostsTable = [];
    try { hostsTable = (getState().hosts || []); } catch (e) { hostsTable = []; }
    return Array.from(new Set($coerceArray(list).map(h => {
      if (!h) return null;
      const byId = hostsTable.find(x => x.id === h);
      if (byId && byId.hostType) return byId.hostType;
      if (LEGACY[h]) return LEGACY[h];
      return String(h);
    }).filter(Boolean)));
  }

  function normalizeAsset(asset) {
    const defaults = {
      id: '', assetType: 'skill', name: '', displayName: '', description: '',
      categoryIds: [], tagIds: [], defaultCategoryId: null, isFavorite: false,
      lifecycleStatus: 'available', primaryInstanceId: null,
      invocation: '', supportedHosts: [], createdAt: $now(), updatedAt: $now()
    };
    const out = withDefaults(asset, defaults);
    out.categoryIds = $coerceArray(out.categoryIds);
    out.tagIds = $coerceArray(out.tagIds);
    out.supportedHosts = normalizeSupportedHosts(out.supportedHosts);
    if (!out.displayName) out.displayName = out.name;
    if (!out.name && out.displayName) out.name = out.displayName.toLowerCase().replace(/\s+/g, '-');
    return out;
  }

  function normalizeInstance(instance) {
    const defaults = {
      id: '', skillId: null, hostType: 'claude-code',
      rootPath: '', skillFilePath: '',
      lifecycleStatus: 'available', permissionMode: 'read-only',
      installedVersion: '', healthStatuses: [],
      localModificationStatus: 'clean',
      sourceBindingId: null, isPrimary: false,
      lastSeenAt: $now(), missingSince: null,
      contentHash: '', fileCount: 0, packageSizeBytes: 0
    };
    const out = withDefaults(instance, defaults);
    out.healthStatuses = $coerceArray(out.healthStatuses);
    return out;
  }

  function normalizeFile(file) {
    const defaults = {
      id: '', instanceId: null, skillId: null, relativePath: '',
      fileType: 'text', mimeType: 'text/markdown', sizeBytes: 0,
      content: '', contentHash: '', modifiedAt: $now(),
      tokenCount: null, tokenCountMode: 'unavailable',
      indexStatus: 'indexed', skipReason: null,
      isNestedSkillMarker: false
    };
    const out = withDefaults(file, defaults);
    // Only real tokenizer results may be exact; approx / unknown must not claim exact.
    if (out.tokenCountMode === 'exact' && file.tokenCountExactSource !== 'tokenizer') {
      out.tokenCountMode = out.tokenCount != null ? 'estimated' : 'unavailable';
    }
    return out;
  }

  function normalizeSourceBinding(binding) {
    const defaults = {
      id: '', skillId: null, instanceId: null, scope: 'asset',
      sourceType: 'github', sourceUrl: '',
      repository: '', branch: '', baselineVersion: '', baselineCommit: '',
      baselineSnapshotId: null, trustPolicy: 'untrusted',
      lastCheckedAt: null, updateStatus: 'unknown',
      remoteVersion: '', remoteCommit: '',
      sourceDivergence: false
    };
    return withDefaults(binding, defaults);
  }

  function normalizePermissionGrant(grant) {
    const defaults = {
      id: '', scopeType: 'instance', scopeId: null, scopePath: '',
      readAccess: true, writeAccess: false,
      grantedAt: $now(), revokedAt: null, status: 'active',
      source: 'user', purpose: ''
    };
    return withDefaults(grant, defaults);
  }

  function normalizeScanSession(session) {
    const defaults = {
      id: '', scanType: 'first-full', status: 'idle',
      startedAt: $now(), finishedAt: null, currentPath: '',
      visitedDirectoryCount: 0, discoveredCount: 0, failureCount: 0,
      pausedAt: null, cancelledAt: null, failures: []
    };
    return withDefaults(session, defaults);
  }

  function normalizeScanDiscovery(discovery) {
    const defaults = {
      id: '', scanSessionId: null, candidateSkillId: null,
      path: '', hostType: '', skillName: '', skillFileContent: '',
      files: [], fileCount: 0, packageSizeBytes: 0,
      evidence: {}, discoveredAt: $now(), status: '',
      permissionStatus: 'granted', healthIssues: [],
      isNew: false, isDuplicate: false
    };
    const out = withDefaults(discovery, defaults);
    out.files = $coerceArray(out.files);
    out.healthIssues = $coerceArray(out.healthIssues);
    return out;
  }

  function normalizeChangeSet(changeSet) {
    const defaults = {
      id: '', scanSessionId: null, status: 'pending',
      source: '', checkpointId: null, results: [],
      createdAt: $now(), appliedAt: null,
      summary: { added: 0, changed: 0, missing: 0, failed: 0, unchanged: 0, duplicate: 0 }
    };
    const out = withDefaults(changeSet, defaults);
    out.summary = { ...defaults.summary, ...(out.summary || {}) };
    out.results = Array.isArray(out.results) ? out.results : [];
    return out;
  }

  function normalizeChangeItem(item) {
    const defaults = {
      id: '', changeSetId: '', changeType: 'added',
      skillId: null, discoveryId: null, instanceId: null,
      status: 'pending', evidence: {}, fileDiffs: [],
      path: '', summary: '', permissionStatus: 'granted',
      healthIssues: [], confirmedAt: null
    };
    const out = withDefaults(item, defaults);
    out.fileDiffs = $coerceArray(out.fileDiffs);
    out.healthIssues = $coerceArray(out.healthIssues);
    return out;
  }

  function normalizeDraft(draft) {
    const defaults = {
      id: '', skillId: null, instanceId: null, fileId: null,
      sessionId: null, relativePath: null,
      content: '', createdAt: $now(), updatedAt: $now(),
      baseContentHash: '', baseFileModifiedAt: $now(),
      status: 'modified', lastAutosaveResult: 'ok',
      sourceOperationId: null
    };
    return withDefaults(draft, defaults);
  }

  function normalizeSnapshot(snapshot) {
    const defaults = {
      id: '', skillId: null, instanceId: null, type: 'package',
      createdAt: $now(), note: '', source: 'manual', files: [], retained: false,
      checkpointData: null,
      fileCount: null, packageSizeBytes: null,
      contentCaptureStatus: null, capturedFileCount: null, metadataOnlyFileCount: null
    };
    const out = withDefaults(snapshot, defaults);
    out.files = $coerceArray(out.files);
    if (out.fileCount == null) out.fileCount = out.files.length;
    if (out.packageSizeBytes == null) {
      out.packageSizeBytes = out.files.reduce((n, f) => n + (f.sizeBytes != null ? f.sizeBytes : 0), 0);
    }
    return out;
  }

  function normalizeUsageEvent(event) {
    const defaults = {
      id: '', skillId: null, instanceId: null, sessionId: '',
      callCount: 1, inputTokens: null, outputTokens: null, totalTokens: null,
      attributionLevel: 'accurate', sourceAdapterId: '', occurredAt: $now()
    };
    const out = withDefaults(event, defaults);
    // v2 backward-compatible aliases
    out.time = out.occurredAt;
    out.tokenCount = out.totalTokens;
    out.attribution = out.attributionLevel;
    return out;
  }

  function normalizeAuditEvent(event) {
    const defaults = {
      id: '', time: $now(), skillId: null, instanceId: null,
      eventType: 'scan', category: 'system', source: 'Skill Panel',
      result: 'completed', targetPath: null, snapshotId: null,
      draftId: null, taskId: null, exitCode: null,
      rollbackResult: null, note: ''
    };
    return withDefaults(event, defaults);
  }

  function normalizePendingTask(task) {
    const defaults = {
      id: '', skillId: null, instanceId: null,
      taskType: 'archive_candidate', priority: 'normal',
      reasonCodes: [], dataWindow: '90d', confidence: 'high',
      status: 'open', createdAt: $now(), resolvedAt: null, groupId: null,
      sourceOperationId: null, relativePath: null, note: ''
    };
    const out = withDefaults(task, defaults);
    out.reasonCodes = $coerceArray(out.reasonCodes);
    return out;
  }

  function normalizeCategory(category) {
    const defaults = {
      id: '', name: '', parentId: null, sortOrder: 0, icon: '', description: ''
    };
    return withDefaults(category, defaults);
  }

  function normalizeTag(tag) {
    const defaults = { id: '', name: '', color: '' };
    return withDefaults(tag, defaults);
  }

  function normalizeDuplicateGroup(group) {
    const defaults = {
      id: '', name: '', skillIds: [], evidence: {}, confidence: 'medium', status: 'open'
    };
    const out = withDefaults(group, defaults);
    out.skillIds = $coerceArray(out.skillIds);
    return out;
  }
  function resolveDuplicateGroup(idOrName) {
    const state = getState();
    return state.duplicateGroups.find(g => g.id === idOrName || g.name === idOrName) || null;
  }

  function normalizeHost(host) {
    const defaults = {
      id: '', hostType: 'claude-code', name: '', path: '',
      enabled: true, permissionStatus: 'granted', isDefaultCreate: false,
      scanSub: true, followSymlinks: false, ignoreHidden: true,
      lastScanAt: null, skillCount: 0
    };
    return withDefaults(host, defaults);
  }

  function normalizeUsageAdapter(adapter) {
    const defaults = {
      id: '', name: '', hostTypes: [], status: 'none',
      lastSync: null, supportsCalls: false, supportsTokens: false
    };
    const out = withDefaults(adapter, defaults);
    out.hostTypes = $coerceArray(out.hostTypes);
    return out;
  }

  function normalizeIgnoreRule(rule) {
    const defaults = {
      id: '', ruleType: 'skill_id', skillId: null, path: null,
      contentHash: null, createdAt: $now(), reason: '', expiresAt: null
    };
    return withDefaults(rule, defaults);
  }

  function normalizeArchiveRecord(record) {
    const defaults = {
      id: '', skillId: null, originalPath: '', archivePath: '',
      archivedAt: $now(), reason: '', snapshotStatus: 'available'
    };
    return withDefaults(record, defaults);
  }

  /* ---------- settings defaults ---------- */
  function defaultSettings() {
    return {
      language: 'system', theme: 'system', density: 'standard',
      defaultPage: 'library', restoreLastView: true,
      defaultCreateLocationId: 'claude', scanSubdirectories: true,
      followSymlinks: false, ignoreHidden: true,
      fileChangeDetection: true, autosaveDrafts: true, showDiffBeforeApply: true,
      snapshotsPerSkill: 20, autoCleanupSnapshots: true,
      archiveDirectory: '~/Library/Application Support/Skill Panel/Archive',
      cleanupWindowDays: 90, ignoreFavorite: true,
      ignoreRecentlyEdited: true, ignoreUserCreated: true,
      finalSnapshotOnDelete: true, usageRetentionDays: 180,
      savePromptContent: false, saveFilenames: true,
      showCodexUsageNotice: true,
      wordWrap: true
    };
  }

  /* ---------- v2-shaped skill derivation ---------- */
  // Backward compatibility: existing pages read skills as flat v2 objects.
  function deriveV2Skill(assetId, stateArg) {
    const state = stateArg || getState();
    const asset = state.assets.find(a => a.id === assetId);
    if (!asset) return null;

    const instances = state.instances.filter(i => i.skillId === assetId);
    const primary = instances.find(i => i.isPrimary) || instances[0];
    const primaryFile = primary ? state.files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md') : null;
    const anyFile = primary ? state.files.find(f => f.instanceId === primary.id) : null;
    const file = primaryFile || anyFile;

    const sourceBinding = asset.sourceBindingId ? state.sourceBindings.find(b => b.id === asset.sourceBindingId) : null;

    // Health: derive from primary instance; map v3 hyphenated to v2 underscore
    let healthStatuses = ['normal'];
    if (primary && primary.healthStatuses.length) {
      healthStatuses = primary.healthStatuses.map(h => h.replace(/-/g, '_'));
    }

    // Lifecycle mapping v3 -> v2 view model (active is temporary display alias for available)
    let lifecycleStatus = 'active'; // v2 display alias for 'available'; TODO: remove in later phase
    if (asset.lifecycleStatus === 'archived') lifecycleStatus = 'archived';
    else if (asset.lifecycleStatus === 'deleted') lifecycleStatus = 'archived';
    // 'ignored' is NOT a lifecycle; it is tracked via ignoreRules only
    const isIgnored = state.ignoreRules.some(r =>
      r.skillId === assetId && (r.ruleType === 'skill_id' || r.ruleType === 'skill'));

    // Usage: aggregate canonical usage events (merged asset chain)
    const usageEvents = getCanonicalUsageEvents(assetId, state);
    const usage30 = usageEvents.filter(e => new Date(e.occurredAt) > new Date(Date.now() - 30 * 86400000)).reduce((s, e) => s + (e.callCount || 0), 0);
    const usage90 = usageEvents.filter(e => new Date(e.occurredAt) > new Date(Date.now() - 90 * 86400000)).reduce((s, e) => s + (e.callCount || 0), 0);
    const associatedTokenCount = usageEvents.reduce((s, e) => s + (e.totalTokens || 0), 0);
    const lastUsedAt = usageEvents.length ? usageEvents[usageEvents.length - 1].occurredAt : null;

    // Pending tasks linked to this skill
    const pendingTaskIds = state.pendingTasks.filter(t => t.skillId === assetId && t.status === 'open').map(t => t.id);

    // Storage location mapping from host
    let storageLocationId = 'custom';
    if (primary) {
      const host = state.hosts.find(h => h.hostType === primary.hostType);
      if (host) storageLocationId = host.id;
    }

    // Categories / tags: resolve names for v2 compatibility
    const categoryNames = asset.categoryIds.map(cid => state.categories.find(c => c.id === cid)?.name).filter(Boolean);
    const tagNames = asset.tagIds.map(tid => state.tags.find(t => t.id === tid)?.name).filter(Boolean);

    // Build v2-shaped object
    const skill = {
      id: asset.id,
      name: asset.name,
      displayName: asset.displayName,
      description: asset.description,
      version: primary ? primary.installedVersion : '',
      category: categoryNames[0] || '',
      tags: tagNames,
      author: sourceBinding ? sourceBinding.repository : (primary && primary.hostType === 'custom' ? 'local' : 'community'),
      storageLocationId,
      absolutePath: primary ? primary.skillFilePath : null,
      relativePath: primary ? primary.skillFilePath.replace(/^~\//, '') : null,
      hostBindings: primary ? [primary.hostType] : [],
      usageAdapterIds: state.usageAdapters.filter(a => primary && a.hostTypes.includes(primary.hostType)).map(a => a.id),
      lifecycleStatus,
      healthStatuses,
      pendingTaskIds,
      isFavorite: asset.isFavorite,
      isIgnored,
      updateStatus: sourceBinding ? sourceBinding.updateStatus : 'unknown',
      trustPolicy: sourceBinding ? sourceBinding.trustPolicy : 'untrusted',
      permissionMode: primary ? primary.permissionMode : 'read-only',
      isUserCreated: primary ? primary.hostType === 'custom' : false,
      isExternalImport: primary ? (primary.hostType !== 'custom' && sourceBinding && sourceBinding.sourceType !== 'local') : false,
      installedAt: primary ? primary.lastSeenAt : asset.createdAt,
      lastModifiedAt: file ? file.modifiedAt : asset.updatedAt,
      lastOpenedAt: file ? file.modifiedAt : asset.updatedAt,
      lastUsedAt,
      fileSize: file ? file.sizeBytes : null,
      contentHash: file ? file.contentHash : '',
      documentTokenCount: file && file.tokenCountMode !== 'unavailable' ? file.tokenCount : null,
      tokenizerId: 'cl100k_base',
      usage30,
      usage90,
      associatedTokenCount,
      duplicateGroupId: state.duplicateGroups.find(g => g.skillIds.includes(assetId))?.id || null,
      yamlErrorLine: null,
      yamlErrorField: null,
      yamlErrorReason: null,
      lastScanAt: null,
      primaryInstanceId: primary ? primary.id : null,
      instanceCount: instances.length,
      sourceBindingId: asset.sourceBindingId,
      _v3: true
    };

    // Preserve any v2-specific fields that may have been stored on the asset
    for (const k of ['yamlErrorLine', 'yamlErrorField', 'yamlErrorReason', 'lastScanAt', '_forceOverriddenAt']) {
      if (asset[k] != null) skill[k] = asset[k];
    }

    return skill;
  }

  function deriveAllV2Skills(state) {
    // In Phase 1 we maintain a derived skills array for backward compatibility.
    // This is recomputed on demand and is NEVER persisted to localStorage.
    return state.assets.map(a => deriveV2Skill(a.id, state)).filter(Boolean);
  }

  /* ---------- path scope helpers (Phase D.1) ---------- */
  function $normalizePath(p) {
    if (p == null) return '';
    let s = String(p).trim().replace(/\\/g, '/');
    // collapse duplicate slashes except leading ~
    s = s.replace(/\/+/g, '/');
    if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
    return s;
  }

  function $pathInScope(targetPath, scopePath) {
    const t = $normalizePath(targetPath);
    const s = $normalizePath(scopePath);
    if (!t || !s) return false;
    if (t === s) return true;
    return t.startsWith(s + '/');
  }

  function $snapshotFileRecord(file, options = {}) {
    const isBinary = file.fileType === 'binary';
    const captureContent = !!options.captureContent && !isBinary;
    return {
      relativePath: file.relativePath,
      fileType: file.fileType || 'text',
      mimeType: file.mimeType || '',
      sizeBytes: file.sizeBytes || 0,
      contentHash: file.contentHash || '',
      content: captureContent ? String(file.content || '') : null,
      modifiedAt: file.modifiedAt || null,
      tokenCount: file.tokenCount != null ? file.tokenCount : null,
      tokenCountMode: file.tokenCountMode || null,
      indexStatus: file.indexStatus || 'indexed',
      contentCaptureStatus: captureContent ? 'full' : 'metadata-only'
    };
  }

  function toFileMetadata(file) {
    if (!file) return null;
    return {
      id: file.id,
      instanceId: file.instanceId,
      skillId: file.skillId,
      relativePath: file.relativePath,
      fileType: file.fileType,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      contentHash: file.contentHash,
      modifiedAt: file.modifiedAt,
      tokenCount: file.tokenCount,
      tokenCountMode: file.tokenCountMode,
      indexStatus: file.indexStatus,
      skipReason: file.skipReason,
      isNestedSkillMarker: !!file.isNestedSkillMarker
    };
  }

  function getFilesRawInternal(opts = {}) {
    const state = getState();
    if (opts.instanceId) return state.files.filter(f => f.instanceId === opts.instanceId);
    if (opts.skillId) return state.files.filter(f => f.skillId === opts.skillId);
    return state.files.slice();
  }

  function getFileRawInternal(id) {
    return getState().files.find(x => x.id === id) || null;
  }

  function createPackageSnapshotForInstance(instanceId, meta = {}) {
    const inst = getInstanceRaw(instanceId);
    if (!inst) return null;
    const perm = getInstancePermission(instanceId);
    const isMissing = inst.lifecycleStatus === 'missing';
    const canCapture = !isMissing && perm && perm.readAccess && perm.contentAccessStatus === 'readable';
    const files = getFilesRawInternal({ instanceId });
    let capturedFileCount = 0;
    let metadataOnlyFileCount = 0;
    const records = files.map(f => {
      const rec = $snapshotFileRecord(f, { captureContent: canCapture });
      if (rec.contentCaptureStatus === 'full') capturedFileCount += 1;
      else metadataOnlyFileCount += 1;
      return rec;
    });
    const contentCaptureStatus = isMissing || !canCapture
      ? 'metadata-only'
      : (metadataOnlyFileCount === 0 ? 'full' : (capturedFileCount === 0 ? 'metadata-only' : 'partial'));
    const packageSizeBytes = records.reduce((n, f) => n + (f.sizeBytes || 0), 0);
    const snap = normalizeSnapshot({
      id: meta.id || uuid(),
      skillId: inst.skillId,
      instanceId: inst.id,
      type: 'package',
      createdAt: meta.createdAt || $now(),
      note: meta.note || '包快照',
      source: meta.source || 'manual',
      files: records,
      retained: meta.retained != null ? !!meta.retained : false,
      fileCount: records.length,
      packageSizeBytes,
      contentCaptureStatus,
      capturedFileCount,
      metadataOnlyFileCount
    });
    return snap;
  }

  function setSnapshotRetained(snapshotId, retained) {
    const snap = getState().snapshots.find(s => s.id === snapshotId);
    if (!snap) return { ok: false, error: 'Snapshot not found' };
    snap.retained = !!retained;
    addAuditEvent({
      skillId: snap.skillId,
      instanceId: snap.instanceId,
      eventType: 'snapshot_retain',
      category: 'system',
      source: 'Skill Panel',
      result: 'completed',
      snapshotId: snap.id,
      note: (retained ? '标记长期保留' : '取消长期保留') + ' · ' + (snap.note || snap.type)
    });
    saveState();
    return { ok: true, snapshotId, retained: !!retained };
  }
  const HOSTS = [
    { id: 'claude', hostType: 'claude-code', name: 'Claude Code', path: '~/.claude/skills', enabled: true, permissionStatus: 'granted', isDefaultCreate: true, scanSub: true, followSymlinks: false, ignoreHidden: true },
    { id: 'codex', hostType: 'codex', name: 'Codex', path: '~/.codex/skills', enabled: true, permissionStatus: 'granted', isDefaultCreate: false, scanSub: true, followSymlinks: false, ignoreHidden: true },
    { id: 'custom', hostType: 'custom', name: '自定义目录', path: '~/Projects/skills', enabled: true, permissionStatus: 'granted', isDefaultCreate: false, scanSub: true, followSymlinks: false, ignoreHidden: true },
    { id: 'archive', hostType: 'archive', name: '归档目录', path: '~/Library/Application Support/Skill Panel/Archive', enabled: true, permissionStatus: 'granted', isDefaultCreate: false, scanSub: true, followSymlinks: false, ignoreHidden: true }
  ];

  const ADAPTERS = [
    { id: 'claude-adapter', name: 'Claude Code', hostTypes: ['claude-code'], status: 'connected', lastSync: $daysAgo(0), supportsCalls: true, supportsTokens: true },
    { id: 'codex-adapter', name: 'Codex', hostTypes: ['codex'], status: 'limited', lastSync: $daysAgo(1), supportsCalls: false, supportsTokens: false },
    { id: 'custom-adapter', name: '自定义目录', hostTypes: ['custom'], status: 'none', lastSync: null, supportsCalls: false, supportsTokens: false }
  ];

  const CATEGORIES = [
    { id: 'cat-root-work', name: '工作流', parentId: null, sortOrder: 0 },
    { id: 'cat-engineering', name: '工程', parentId: 'cat-root-work', sortOrder: 1 },
    { id: 'cat-data', name: '数据', parentId: 'cat-root-work', sortOrder: 2 },
    { id: 'cat-security', name: '安全', parentId: 'cat-root-work', sortOrder: 3 },
    { id: 'cat-docs', name: '文档', parentId: null, sortOrder: 4 },
    { id: 'cat-product', name: '产品', parentId: null, sortOrder: 5 },
    { id: 'cat-tool', name: '工具', parentId: null, sortOrder: 6 },
    { id: 'cat-quality', name: '质量', parentId: 'cat-root-work', sortOrder: 7 },
    { id: 'cat-notes', name: '笔记', parentId: null, sortOrder: 8 },
    { id: 'cat-design', name: '设计', parentId: null, sortOrder: 9 },
    { id: 'cat-test', name: '测试', parentId: 'cat-root-work', sortOrder: 10 }
  ];

  const TAGS = [
    { id: 'tag-git', name: 'git' },
    { id: 'tag-review', name: 'review' },
    { id: 'tag-sql', name: 'sql' },
    { id: 'tag-db', name: 'db' },
    { id: 'tag-security', name: 'security' },
    { id: 'tag-deps', name: 'deps' },
    { id: 'tag-api', name: 'api' },
    { id: 'tag-mock', name: 'mock' },
    { id: 'tag-test', name: 'test' },
    { id: 'tag-ci', name: 'ci' },
    { id: 'tag-docs', name: 'docs' },
    { id: 'tag-refactor', name: 'refactor' },
    { id: 'tag-a11y', name: 'a11y' },
    { id: 'tag-migration', name: 'migration' },
    { id: 'tag-explain', name: 'explain' },
    { id: 'tag-onboarding', name: 'onboarding' },
    { id: 'tag-ops', name: 'ops' },
    { id: 'tag-perf', name: 'perf' },
    { id: 'tag-release', name: 'release' },
    { id: 'tag-zh', name: 'zh' },
    { id: 'tag-prompt', name: 'prompt' },
    { id: 'tag-notes', name: 'notes' },
    { id: 'tag-i18n', name: 'i18n' },
    { id: 'tag-style', name: 'style' },
    { id: 'tag-design', name: 'design' },
    { id: 'tag-tokens', name: 'tokens' },
    { id: 'tag-pm', name: 'pm' },
    { id: 'tag-triage', name: 'triage' },
    { id: 'tag-search', name: 'search' },
    { id: 'tag-backup', name: 'backup' },
    { id: 'tag-ocr', name: 'ocr' },
    { id: 'tag-lint', name: 'lint' },
    { id: 'tag-deploy', name: 'deploy' },
    { id: 'tag-demo', name: 'demo' }
  ];

  function catId(name) { return CATEGORIES.find(c => c.name === name)?.id || 'cat-engineering'; }
  function tagIds(names) { return names.map(n => TAGS.find(t => t.name === n)?.id).filter(Boolean); }

  const SKILL_DESC = [
    // Claude Code active
    { id: 'pr-review', name: 'pr-review', displayName: 'PR Review', storage: 'claude', desc: '审查 PR 差异，按严重级别输出问题与修复建议。', cat: '工程', tags: ['git','review'], version: '1.4.0', author: 'community', fav: true, usage: 86, usedDays: 0, modDays: 0, instDays: 120, tokenAttention: true },
    { id: 'sql-audit', name: 'sql-audit', displayName: 'SQL Audit', storage: 'claude', desc: '检查 SQL 索引与全表扫描风险。', cat: '数据', tags: ['sql','db'], version: '1.1.0', author: 'community', fav: false, usage: 64, usedDays: 0, modDays: 3, instDays: 110 },
    { id: 'dep-scan', name: 'dep-scan', displayName: 'Dependency Scan', storage: 'claude', desc: '扫描依赖漏洞与 license 冲突。', cat: '安全', tags: ['security','deps'], version: '2.0.1', author: 'community', fav: false, usage: 41, usedDays: 0, modDays: 7, instDays: 100, tokenAttention: true },
    { id: 'api-mock', name: 'api-mock', displayName: 'API Mock', storage: 'claude', desc: '根据 OpenAPI 生成本地 mock。', cat: '工程', tags: ['api','mock'], version: '0.9.2', author: 'community', fav: false, usage: 22, usedDays: 4, modDays: 14, instDays: 95, dupGroup: 'C' },
    { id: 'test-runner', name: 'test-runner', displayName: 'Test Runner', storage: 'claude', desc: '批量运行测试并汇总失败用例。', cat: '工程', tags: ['test','ci'], version: '1.0.0', author: 'community', fav: false, usage: 18, usedDays: 1, modDays: 1, instDays: 90, failedOp: 'save_failed' },
    { id: 'commit-format', name: 'commit-format', displayName: 'Commit Format', storage: 'claude', desc: '按约定式提交格式改写 commit message。', cat: '工程', tags: ['git'], version: '1.2.0', author: 'community', fav: false, usage: 15, usedDays: 2, modDays: 5, instDays: 85 },
    { id: 'doc-gen', name: 'doc-gen', displayName: 'Doc Generator', storage: 'claude', desc: '从代码注释生成文档。', cat: '文档', tags: ['docs'], version: '1.0.0', author: 'community', fav: false, usage: 12, usedDays: 3, modDays: 10, instDays: 80 },
    { id: 'refactor-helper', name: 'refactor-helper', displayName: 'Refactor Helper', storage: 'claude', desc: '按模式重构代码并生成 diff。', cat: '工程', tags: ['refactor'], version: '0.8.0', author: 'community', fav: false, usage: 9, usedDays: 5, modDays: 21, instDays: 75 },
    { id: 'security-check', name: 'security-check', displayName: 'Security Check', storage: 'claude', desc: '扫描常见安全反模式。', cat: '安全', tags: ['security'], version: '1.0.0', author: 'community', fav: true, usage: 7, usedDays: 6, modDays: 30, instDays: 70 },
    { id: 'migration-plan', name: 'migration-plan', displayName: 'Migration Plan', storage: 'claude', desc: '制定框架迁移步骤。', cat: '工程', tags: ['migration'], version: '0.5.0', author: 'community', fav: false, usage: 5, usedDays: 8, modDays: 35, instDays: 65 },
    { id: 'code-explainer', name: 'code-explainer', displayName: 'Code Explainer', storage: 'claude', desc: '用自然语言解释复杂代码片段。', cat: '工程', tags: ['explain'], version: '1.0.0', author: 'community', fav: false, usage: 3, usedDays: 10, modDays: 40, instDays: 60 },
    { id: 'onboarding-guide', name: 'onboarding-guide', displayName: 'Onboarding Guide', storage: 'claude', desc: '为新成员生成项目上手指南。', cat: '产品', tags: ['onboarding'], version: '0.9.0', author: 'community', fav: false, usage: 2, usedDays: 12, modDays: 50, instDays: 55 },
    { id: 'incident-response', name: 'incident-response', displayName: 'Incident Response', storage: 'claude', desc: '按模板记录故障处理过程。', cat: '运维', tags: ['ops'], version: '0.3.0', author: 'community', fav: true, usage: 1, usedDays: 14, modDays: 55, instDays: 50 },
    { id: 'performance-profile', name: 'performance-profile', displayName: 'Performance Profile', storage: 'claude', desc: '分析性能瓶颈并输出火焰图建议。', cat: '工程', tags: ['perf'], version: '0.2.0', author: 'community', fav: false, usage: 0, usedDays: null, modDays: 60, instDays: 120, archiveCandidate: true },
    { id: 'accessibility-audit', name: 'accessibility-audit', displayName: 'Accessibility Audit', storage: 'claude', desc: '检查前端可访问性问题。', cat: '工程', tags: ['a11y'], version: '0.1.0', author: 'community', fav: false, usage: 0, usedDays: null, modDays: 50, instDays: 110, archiveCandidate: true },
    // Codex active
    { id: 'release-notes', name: 'release-notes', displayName: 'Release Notes', storage: 'codex', desc: '从 commit 生成面向用户的更新说明。', cat: '文档', tags: ['docs','release'], version: '1.2.0', author: 'community', fav: true, usage: null, usedDays: null, modDays: 1, instDays: 100, dupGroup: 'A' },
    { id: 'changelog-zh', name: 'changelog-zh', displayName: 'Changelog ZH', storage: 'codex', desc: '中文变更日志，与 release-notes 高度重叠。', cat: '文档', tags: ['docs','zh'], version: '1.0.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 5, instDays: 90, dupGroup: 'A' },
    { id: 'prompt-lint', name: 'prompt-lint', displayName: 'Prompt Lint', storage: 'codex', desc: '检查 Skill 提示词结构。', cat: '质量', tags: ['prompt'], version: '0.8.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 14, instDays: 80, dupGroup: 'B' },
    { id: 'meeting-notes', name: 'meeting-notes', displayName: 'Meeting Notes', storage: 'codex', desc: '从转写生成行动项。', cat: '笔记', tags: ['notes'], version: '0.4.1', author: 'community', fav: false, usage: null, usedDays: null, modDays: 45, instDays: 100, archiveCandidate: true },
    { id: 'doc-translate', name: 'doc-translate', displayName: 'Doc Translate', storage: 'codex', desc: '翻译技术文档为中文。', cat: '文档', tags: ['i18n'], version: '0.7.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 20, instDays: 70 },
    { id: 'style-guide', name: 'style-guide', displayName: 'Style Guide', storage: 'codex', desc: '按团队规范检查代码风格。', cat: '质量', tags: ['style'], version: '1.0.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 25, instDays: 60 },
    { id: 'api-doc', name: 'api-doc', displayName: 'API Doc', storage: 'codex', desc: '从 OpenAPI 生成接口文档。', cat: '文档', tags: ['api'], version: '0.6.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 30, instDays: 50 },
    { id: 'readme-check', name: 'readme-check', displayName: 'README Check', storage: 'codex', desc: '检查 README 完整度。', cat: '文档', tags: ['docs'], version: '0.5.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 40, instDays: 40 },
    // Custom active
    { id: 'figma-tokens', name: 'figma-tokens', displayName: 'Figma Tokens', storage: 'custom', desc: '导出 Figma 变量为 CSS token。', cat: '设计', tags: ['design','tokens'], version: '1.0.3', author: 'local', fav: true, usage: null, usedDays: null, modDays: 2, instDays: 90, userCreated: true, externalChange: true, hasDraft: true },
    { id: 'prompt-check', name: 'prompt-check', displayName: 'Prompt Check', storage: 'custom', desc: '自建提示词结构检查。', cat: '质量', tags: ['prompt'], version: '1.1.0', author: 'local', fav: false, usage: null, usedDays: null, modDays: 9, instDays: 80, userCreated: true, dupGroup: 'B' },
    { id: 'linear-triage', name: 'linear-triage', displayName: 'Linear Triage', storage: 'custom', desc: '按影响面给 Linear issue 定优先级。', cat: '产品', tags: ['pm','triage'], version: '0.6.0', author: 'local', fav: false, usage: null, usedDays: null, modDays: 7, instDays: 60, userCreated: true },
    { id: 'ticket-summarizer', name: 'ticket-summarizer', displayName: 'Ticket Summarizer', storage: 'custom', desc: '汇总工单关键信息。', cat: '产品', tags: ['pm'], version: '0.4.0', author: 'local', fav: false, usage: null, usedDays: null, modDays: 12, instDays: 55, userCreated: true },
    { id: 'local-search', name: 'local-search', displayName: 'Local Search', storage: 'custom', desc: '在本地代码库中检索语义相似片段。', cat: '工程', tags: ['search'], version: '0.3.0', author: 'local', fav: false, usage: null, usedDays: null, modDays: 18, instDays: 50, userCreated: true },
    { id: 'weekly-report', name: 'weekly-report', displayName: 'Weekly Report', storage: 'custom', desc: '整理本周工作摘要。', cat: '产品', tags: ['pm'], version: '0.2.0', author: 'local', fav: false, usage: null, usedDays: null, modDays: 22, instDays: 45, userCreated: true },
    { id: 'backup-script', name: 'backup-script', displayName: 'Backup Script', storage: 'custom', desc: '备份本地配置文件。', cat: '工具', tags: ['backup'], version: '0.1.0', author: 'local', fav: false, usage: null, usedDays: null, modDays: 28, instDays: 40, userCreated: true },
    // File issue active
    { id: 'broken-path-demo', name: 'broken-path-demo', displayName: 'Broken Path', storage: 'custom', desc: '引用目录不存在。', cat: '—', tags: [], version: '0.0.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: null, instDays: 400, health: ['path-missing'], path: '~/Projects/missing/broken-path-demo/SKILL.md' },
    { id: 'empty-skill-draft', name: 'empty-skill-draft', displayName: 'Empty Draft', storage: 'claude', desc: '仅含标题的空壳草稿。', cat: '测试', tags: [], version: '0.0.1', author: 'local', fav: false, usage: null, usedDays: null, modDays: 1, instDays: 30, userCreated: true, health: ['empty-content'], unfinishedDraft: true },
    { id: 'yaml-error-demo', name: 'yaml-error-demo', displayName: 'YAML Error Demo', storage: 'codex', desc: 'frontmatter 解析失败。', cat: '测试', tags: [], version: '0.0.1', author: 'community', fav: false, usage: null, usedDays: null, modDays: 2, instDays: 20, health: ['yaml-error'] },
    { id: 'permission-denied-demo', name: 'permission-denied-demo', displayName: 'Permission Denied', storage: 'custom', desc: '无读取权限。', cat: '测试', tags: [], version: '0.0.1', author: 'community', fav: false, usage: null, usedDays: null, modDays: 3, instDays: 25, health: ['permission-denied'] },
    // Archived
    { id: 'ocr-table', name: 'ocr-table', displayName: 'OCR Table', storage: 'archive', desc: '旧版表格 OCR。', cat: '工具', tags: ['ocr'], version: '0.1.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 200, instDays: 500, archived: true, originalStorage: 'custom' },
    { id: 'old-api-mock', name: 'old-api-mock', displayName: 'Old API Mock', storage: 'archive', desc: '早期 API Mock 版本。', cat: '工程', tags: ['api','mock'], version: '0.5.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 180, instDays: 400, archived: true, originalStorage: 'claude', dupGroup: 'C' },
    { id: 'legacy-linter', name: 'legacy-linter', displayName: 'Legacy Linter', storage: 'archive', desc: '已废弃的 lint 规则。', cat: '质量', tags: ['lint'], version: '1.0.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 250, instDays: 600, archived: true, originalStorage: 'claude' },
    { id: 'deprecated-deploy', name: 'deprecated-deploy', displayName: 'Deprecated Deploy', storage: 'archive', desc: '旧部署脚本。', cat: '运维', tags: ['deploy'], version: '0.9.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 300, instDays: 700, archived: true, originalStorage: 'claude' },
    { id: 'outdated-tests', name: 'outdated-tests', displayName: 'Outdated Tests', storage: 'archive', desc: '过期测试模板。', cat: '工程', tags: ['test'], version: '0.4.0', author: 'community', fav: false, usage: null, usedDays: null, modDays: 220, instDays: 550, archived: true, originalStorage: 'claude' },
    // Demo cases
    { id: 'demo-normal', name: 'demo-normal', displayName: 'Demo Normal', storage: 'claude', desc: '正常、高频使用的 Claude Code Skill。', cat: '测试', tags: ['demo'], version: '1.0.0', author: 'demo', fav: true, usage: 86, usedDays: 0, modDays: 2, instDays: 200 },
    { id: 'demo-codex', name: 'demo-codex', displayName: 'Demo Codex', storage: 'codex', desc: 'Codex 来源，无逐 Skill 使用数据。', cat: '测试', tags: ['demo'], version: '1.0.0', author: 'demo', fav: false, usage: null, usedDays: null, modDays: 1, instDays: 90 },
    { id: 'demo-archive-candidate', name: 'demo-archive-candidate', displayName: 'Demo Archive Candidate', storage: 'claude', desc: '符合归档建议条件。', cat: '测试', tags: ['demo'], version: '0.5.0', author: 'demo', fav: false, usage: 0, usedDays: null, modDays: 70, instDays: 126, archiveCandidate: true },
    { id: 'demo-external-conflict', name: 'demo-external-conflict', displayName: 'Demo External Conflict', storage: 'custom', desc: '磁盘文件外部修改且存在未应用草稿。', cat: '测试', tags: ['demo'], version: '1.0.0', author: 'demo', fav: false, usage: null, usedDays: null, modDays: 1, instDays: 60, userCreated: true, externalChange: true, hasDraft: true, draftStatus: 'conflict' },
    { id: 'demo-yaml-error', name: 'demo-yaml-error', displayName: 'Demo YAML Error', storage: 'codex', desc: 'YAML frontmatter 解析失败。', cat: '测试', tags: ['demo'], version: '0.1.0', author: 'demo', fav: false, usage: null, usedDays: null, modDays: 2, instDays: 20, health: ['yaml-error'], yamlErrorLine: 3, yamlErrorField: 'category', yamlErrorReason: '缺少必填字段 category' },
    { id: 'demo-path-missing', name: 'demo-path-missing', displayName: 'Demo Path Missing', storage: 'custom', desc: '路径已经不存在。', cat: '测试', tags: ['demo'], version: '0.1.0', author: 'demo', fav: false, usage: null, usedDays: null, modDays: null, instDays: 400, health: ['path-missing'], path: '~/Projects/missing/demo-path-missing/SKILL.md', lastScanAt: $daysAgo(5) },
    { id: 'demo-permission-denied', name: 'demo-permission-denied', displayName: 'Demo Permission Denied', storage: 'custom', desc: '目录存在但没有读取权限。', cat: '测试', tags: ['demo'], version: '0.1.0', author: 'demo', fav: false, usage: null, usedDays: null, modDays: 3, instDays: 25, health: ['permission-denied'] },
    { id: 'demo-archived', name: 'demo-archived', displayName: 'Demo Archived', storage: 'archive', desc: '已归档 Skill。', cat: '测试', tags: ['demo'], version: '0.8.0', author: 'demo', fav: false, usage: 12, usedDays: 100, modDays: 150, instDays: 300, archived: true, originalStorage: 'claude' },
    { id: 'demo-scan-ignored', name: 'demo-scan-ignored', displayName: 'Demo Scan Ignored', storage: 'claude', desc: '扫描变化已忽略（IgnoreRule），Asset 仍为 Available。', cat: '测试', tags: ['demo'], version: '0.1.0', author: 'demo', fav: false, usage: 3, usedDays: 2, modDays: 10, instDays: 60 },
    { id: 'demo-duplicate-a', name: 'demo-duplicate-a', displayName: 'Demo Duplicate A', storage: 'claude', desc: '疑似重复 A。', cat: '测试', tags: ['demo'], version: '1.0.0', author: 'demo', fav: false, usage: 5, usedDays: 2, modDays: 5, instDays: 90, dupGroup: 'DEMO-DUP' },
    { id: 'demo-duplicate-b', name: 'demo-duplicate-b', displayName: 'Demo Duplicate B', storage: 'custom', desc: '疑似重复 B。', cat: '测试', tags: ['demo'], version: '0.9.0', author: 'demo', fav: false, usage: null, usedDays: null, modDays: 6, instDays: 90, userCreated: true, dupGroup: 'DEMO-DUP' },
    { id: 'demo-draft', name: 'demo-draft', displayName: 'Demo Draft', storage: 'claude', desc: '新建 Skill 尚未应用。', cat: '测试', tags: ['demo'], version: '0.1.0', author: 'demo', fav: false, usage: null, usedDays: null, modDays: 0, instDays: 0, userCreated: true, unfinishedDraft: true },
    { id: 'demo-empty-content', name: 'demo-empty-content', displayName: 'Demo Empty Content', storage: 'claude', desc: 'SKILL.md 内容为空或只有标题。', cat: '测试', tags: ['demo'], version: '0.1.0', author: 'demo', fav: false, usage: null, usedDays: null, modDays: 1, instDays: 10, userCreated: true, health: ['empty-content'] }
  ];

  const DUP_CONTENT = {
    'A': { left: 'release-notes', right: 'changelog-zh', reason: '名称与内容相似度高', similarity: 91, nameSim: 78 },
    'B': { left: 'prompt-lint', right: 'prompt-check', reason: '主题与规则集合重叠', similarity: 84, nameSim: 72 },
    'C': { left: 'api-mock', right: 'old-api-mock', reason: '功能与步骤相似', similarity: 76, nameSim: 65 },
    'DEMO-DUP': { left: 'demo-duplicate-a', right: 'demo-duplicate-b', reason: '演示重复组', similarity: 82, nameSim: 80 }
  };

  function buildContent(desc) {
    if (desc.id === 'demo-empty-content') return `---\nname: ${desc.name}\nversion: ${desc.version}\n---\n# ${desc.displayName || desc.name}\n`;
    if (desc.id === 'demo-yaml-error') return `---\nname: ${desc.name}\nversion: ${desc.version}\n---\n# ${desc.displayName || desc.name}\n\n${desc.desc}\n`;
    if (desc.id === 'demo-draft') return `---\nname: ${desc.name}\ndisplay: ${desc.displayName}\nversion: ${desc.version}\ncategory: ${desc.cat}\ntags: ${desc.tags.join(', ')}\nauthor: ${desc.author}\n---\n# ${desc.displayName || desc.name}\n\n${desc.desc}\n\n## 步骤\n1. 待完善\n`;
    if (desc.id === 'empty-skill-draft') return `# ${desc.displayName || desc.name}\n\n（待补充描述与步骤）`;
    if (desc.id === 'yaml-error-demo') return `---\nname: ${desc.name}\nversion: ${desc.version}\ncategory: ${desc.cat}\n---\n# ${desc.displayName || desc.name}\n\n${desc.desc}\n\n## 步骤\n1. 读取配置\n2. 执行检查\n`;
    if (desc.dupGroup === 'A') return `---\nname: ${desc.name}\nversion: ${desc.version}\ncategory: ${desc.cat}\n---\n# ${desc.displayName || desc.name}\n\n${desc.desc}\n\n## 步骤\n1. 读取变更记录\n2. 按类别整理\n3. 输出面向用户的说明\n\n## 类别\n- 功能\n- 修复\n- 性能\n`;
    if (desc.dupGroup === 'B') return `---\nname: ${desc.name}\nversion: ${desc.version}\ncategory: ${desc.cat}\n---\n# ${desc.displayName || desc.name}\n\n${desc.desc}\n\n## 步骤\n1. 解析 frontmatter\n2. 检查步骤完整性\n3. 输出建议\n\n## 检查项\n- 名称\n- 步骤\n- 工具\n`;
    if (desc.dupGroup === 'C') return `---\nname: ${desc.name}\nversion: ${desc.version}\ncategory: ${desc.cat}\n---\n# ${desc.displayName || desc.name}\n\n${desc.desc}\n\n## 步骤\n1. 读取 OpenAPI\n2. 生成路由\n3. 写示例响应\n\n## 输出\n- JSON\n- YAML\n`;
    return `---\nname: ${desc.name}\nversion: ${desc.version}\ncategory: ${desc.cat}\n---\n# ${desc.displayName || desc.name}\n\n${desc.desc}\n\n## 步骤\n1. 读取相关上下文\n2. 分析输入与约束\n3. 执行核心逻辑\n4. 输出结构化结果\n\n## 注意\n- 保持输出简洁\n- 仅使用已授权工具\n`;
  }

  function seedState() {
    const state = {
      version: STATE_VERSION,
      initialized: false,

      settings: defaultSettings(),
      viewStates: {
        library: {
          section: 'all',
          viewMode: 'table',
          search: '',
          filters: {},
          sort: 'recent',
          visibleColumns: null,
          page: 1,
          pageSize: 20,
          selectedAssetId: null,
          expandedAssetIds: [],
          expandedTreeNodes: [],
          scrollTop: 0,
          detailOpen: false,
          // legacy aliases kept for older pages/tests
          source: null,
          selectedId: null
        },
        insights: { tab: 'archive' },
        activity: { subview: 'pending', range: '7', kind: 'all', sort: 'latest', selectedId: null, search: '', scrollTop: 0 },
        settings: { section: 'dirs' },
        detail: {
          assetId: null,
          tab: 'overview',
          selectedInstanceId: null,
          selectedFileId: null,
          expandedFileNodes: [],
          activityFilter: 'all',
          snapshotFilter: 'all',
          scrollTop: 0,
          fileViewMode: 'preview'
        }
      },

      hosts: HOSTS.map(h => normalizeHost({ ...h, lastScanAt: $daysAgo(0), skillCount: 0 })),
      usageAdapters: ADAPTERS.map(a => normalizeUsageAdapter(a)),
      categories: CATEGORIES.map(c => normalizeCategory(c)),
      tags: TAGS.map(t => normalizeTag(t)),

      assets: [],
      instances: [],
      files: [],
      sourceBindings: [],
      permissionGrants: [],
      scanSessions: [],
      scanDiscoveries: [],
      changeSets: [],
      changeItems: [],
      drafts: [],
      snapshots: [],
      usageEvents: [],
      auditEvents: [],
      pendingTasks: [],
      duplicateGroups: [],

      // v2 compatibility arrays
      ignoreRules: [],
      archiveRecords: []
    };
    // Bind the in-progress state so that helper functions (e.g. createChangeSet) can use getState().
    _state = state;
    // Note: storageLocations are now a read-only view derived from hosts; see getStorageLocations().

    // Build duplicate groups first so we can reference them
    Object.entries(DUP_CONTENT).forEach(([groupId, meta]) => {
      const skillIds = SKILL_DESC.filter(d => d.dupGroup === groupId).map(d => d.id);
      state.duplicateGroups.push(normalizeDuplicateGroup({
        id: seedUuid('dup-' + groupId),
        name: groupId,
        skillIds,
        evidence: meta,
        confidence: 'medium',
        status: 'open'
      }));
    });

    // Build assets, instances, files
    SKILL_DESC.forEach(desc => {
      const host = state.hosts.find(h => h.id === desc.storage);
      // Seed data uses deterministic UUIDs; runtime-created entities use crypto.randomUUID().
      const assetId = seedUuid('asset-' + desc.id);
      const instanceId = seedUuid('instance-' + desc.id + '-0');
      const fileId = seedUuid('file-' + desc.id + '-skillmd');
      const content = buildContent(desc);
      const installedAt = $daysAgo(desc.instDays);
      const modifiedAt = desc.modDays === null ? installedAt : $daysAgo(desc.modDays);
      const lastUsedAt = desc.usedDays === null ? null : $daysAgo(desc.usedDays);

      let assetLifecycle = 'available';
      if (desc.archived) assetLifecycle = 'archived';
      // desc.ignored does NOT change asset lifecycle; it is handled via ignoreRules.

      let instanceLifecycle = 'available';
      if (desc.health && desc.health.includes('path-missing')) instanceLifecycle = 'missing';

      let instanceHealth = desc.health ? [...desc.health] : ['normal'];
      if (desc.health && desc.health.includes('yaml-error')) {
        // yaml-error in v3 is hyphenated
        instanceHealth = instanceHealth.map(h => h === 'yaml_error' ? 'yaml-error' : h.replace(/_/g, '-'));
      } else if (!desc.health) {
        instanceHealth = ['normal'];
      }

      const rootPath = desc.path ? desc.path.replace(/\/SKILL\.md$/, '') : `${host.path}/${desc.name}`;
      const skillFilePath = desc.path || `${host.path}/${desc.name}/SKILL.md`;

      // Source binding for some skills
      let sourceBindingId = null;
      if (!desc.userCreated && desc.storage !== 'archive') {
        sourceBindingId = seedUuid('source-' + desc.id);
        state.sourceBindings.push(normalizeSourceBinding({
          id: sourceBindingId,
          skillId: assetId,
          sourceType: 'github',
          sourceUrl: `https://github.com/example/skills/${desc.name}`,
          repository: `example/skills`,
          branch: 'main',
          baselineVersion: desc.version,
          baselineCommit: desc.version,
          trustPolicy: 'trusted-content',
          updateStatus: desc.id === 'api-doc' ? 'available' : 'up-to-date'
        }));
      }

      // Permission grant
      const permissionId = seedUuid('perm-' + desc.id);
      const isPermDenied = desc.health && (desc.health.includes('permission-denied') || desc.health.includes('permission_denied'));
      state.permissionGrants.push(normalizePermissionGrant({
        id: permissionId,
        scopeType: 'instance',
        scopeId: instanceId,
        scopePath: skillFilePath,
        readAccess: !isPermDenied,
        writeAccess: isPermDenied ? false : (desc.userCreated || desc.storage === 'custom'),
        status: 'active'
      }));

      // Asset
      state.assets.push(normalizeAsset({
        id: assetId,
        name: desc.name,
        displayName: desc.displayName,
        description: desc.desc,
        categoryIds: desc.cat === '—' ? [] : [catId(desc.cat)],
        tagIds: tagIds(desc.tags),
        defaultCategoryId: desc.cat === '—' ? null : catId(desc.cat),
        isFavorite: !!desc.fav,
        lifecycleStatus: assetLifecycle,
        primaryInstanceId: instanceId,
        invocation: '',
        supportedHosts: [host.hostType],
        sourceBindingId,
        createdAt: installedAt,
        updatedAt: modifiedAt,
        yamlErrorLine: desc.yamlErrorLine || null,
        yamlErrorField: desc.yamlErrorField || null,
        yamlErrorReason: desc.yamlErrorReason || null,
        lastScanAt: desc.lastScanAt || null
      }));

      // Instance
      state.instances.push(normalizeInstance({
        id: instanceId,
        skillId: assetId,
        hostType: host.hostType,
        rootPath,
        skillFilePath,
        lifecycleStatus: instanceLifecycle,
        permissionMode: desc.userCreated || desc.storage === 'custom' ? 'managed' : 'read-only',
        installedVersion: desc.version,
        healthStatuses: instanceHealth,
        localModificationStatus: desc.externalChange ? 'conflict' : (desc.hasDraft ? 'modified' : 'clean'),
        sourceBindingId,
        isPrimary: true,
        lastSeenAt: installedAt,
        missingSince: instanceLifecycle === 'missing' ? $daysAgo(5) : null,
        contentHash: $hash(content),
        fileCount: 1,
        packageSizeBytes: (content || '').length
      }));

      // File
      state.files.push(normalizeFile({
        id: fileId,
        instanceId,
        skillId: assetId,
        relativePath: 'SKILL.md',
        fileType: 'text',
        mimeType: 'text/markdown',
        sizeBytes: (content || '').length,
        content,
        contentHash: $hash(content),
        modifiedAt,
        tokenCount: $tokenApprox(content),
        tokenCountMode: 'estimated'
      }));

      // Archive records
      if (desc.archived) {
        const originalHost = state.hosts.find(h => h.id === (desc.originalStorage || 'claude'));
        state.archiveRecords.push(normalizeArchiveRecord({
          id: seedUuid('ar-' + desc.id),
          skillId: assetId,
          originalPath: `${originalHost.path}/${desc.name}/SKILL.md`,
          archivePath: skillFilePath,
          archivedAt: $daysAgo(30),
          reason: desc.id.startsWith('demo-') ? '演示归档' : '长期未使用',
          snapshotStatus: 'available'
        }));
      }
    });

    // Map duplicate group skillIds from names to asset UUIDs
    state.duplicateGroups.forEach(g => {
      g.skillIds = g.skillIds.map(nameOrId => {
        const asset = state.assets.find(a => a.name === nameOrId);
        return asset ? asset.id : nameOrId;
      }).filter(Boolean);
    });

    // Add a second instance for multi-instance demo: pr-review
    (function addMultiInstance() {
      const asset = state.assets.find(a => a.name === 'pr-review');
      if (!asset) return;
      const primary = state.instances.find(i => i.skillId === asset.id);
      const secondInstanceId = seedUuid('instance-pr-review-1');
      state.instances.push(normalizeInstance({
        id: secondInstanceId,
        skillId: asset.id,
        hostType: 'custom',
        rootPath: '~/Projects/shared-skills/pr-review',
        skillFilePath: '~/Projects/shared-skills/pr-review/SKILL.md',
        lifecycleStatus: 'available',
        permissionMode: 'read-only',
        installedVersion: primary.installedVersion,
        healthStatuses: ['normal'],
        localModificationStatus: 'clean',
        sourceBindingId: null,
        isPrimary: false,
        lastSeenAt: $daysAgo(1),
        contentHash: primary.contentHash,
        fileCount: 1,
        packageSizeBytes: primary.packageSizeBytes
      }));
      state.permissionGrants.push(normalizePermissionGrant({
        id: seedUuid('perm-pr-review-1'),
        scopeType: 'instance',
        scopeId: secondInstanceId,
        scopePath: '~/Projects/shared-skills/pr-review/SKILL.md',
        readAccess: true,
        writeAccess: false,
        status: 'active'
      }));
      state.files.push(normalizeFile({
        id: seedUuid('file-pr-review-1-skillmd'),
        instanceId: secondInstanceId,
        skillId: asset.id,
        relativePath: 'SKILL.md',
        fileType: 'text',
        mimeType: 'text/markdown',
        sizeBytes: primary.packageSizeBytes,
        content: state.files.find(f => f.instanceId === primary.id).content,
        contentHash: primary.contentHash,
        modifiedAt: $daysAgo(1),
        tokenCount: $tokenApprox(state.files.find(f => f.instanceId === primary.id).content),
        tokenCountMode: 'estimated'
      }));
      // Extra package text file for Phase C file-search demos (unique phrase only in this file).
      const refContent = '# PR Review Checklist\n\nPHASEC_FILE_SEARCH_MARKER: confirm checklist items before merge.\n\n- Diff size\n- Test coverage\n- Security notes\n';
      state.files.push(normalizeFile({
        id: seedUuid('file-pr-review-checklist'),
        instanceId: primary.id,
        skillId: asset.id,
        relativePath: 'references/checklist.md',
        fileType: 'text',
        mimeType: 'text/markdown',
        sizeBytes: refContent.length,
        content: refContent,
        contentHash: $hash(refContent),
        modifiedAt: $daysAgo(2),
        tokenCount: $tokenApprox(refContent),
        tokenCountMode: 'estimated'
      }));
      // Phase D: binary asset, nested SKILL.md, script
      state.files.push(normalizeFile({
        id: seedUuid('file-pr-review-icon'),
        instanceId: primary.id,
        skillId: asset.id,
        relativePath: 'assets/icon.png',
        fileType: 'binary',
        mimeType: 'image/png',
        sizeBytes: 2048,
        content: '',
        contentHash: $hash('png-demo-bytes'),
        modifiedAt: $daysAgo(10),
        tokenCount: null,
        tokenCountMode: 'unavailable',
        indexStatus: 'indexed'
      }));
      const nestedSkill = '---\nname: nested-helper\n---\n# Nested helper\n\nNested SKILL.md demo.\n';
      state.files.push(normalizeFile({
        id: seedUuid('file-pr-review-nested'),
        instanceId: primary.id,
        skillId: asset.id,
        relativePath: 'nested/SKILL.md',
        fileType: 'text',
        mimeType: 'text/markdown',
        sizeBytes: nestedSkill.length,
        content: nestedSkill,
        contentHash: $hash(nestedSkill),
        modifiedAt: $daysAgo(3),
        tokenCount: $tokenApprox(nestedSkill),
        tokenCountMode: 'estimated',
        isNestedSkillMarker: true
      }));
      const scriptContent = '#!/usr/bin/env node\nconsole.log("validate");\n';
      state.files.push(normalizeFile({
        id: seedUuid('file-pr-review-script'),
        instanceId: primary.id,
        skillId: asset.id,
        relativePath: 'scripts/validate.js',
        fileType: 'text',
        mimeType: 'application/javascript',
        sizeBytes: scriptContent.length,
        content: scriptContent,
        contentHash: $hash(scriptContent),
        modifiedAt: $daysAgo(4),
        tokenCount: $tokenApprox(scriptContent),
        tokenCountMode: 'estimated'
      }));
      // Custom instance also has SKILL.md + examples
      const exContent = '# Examples\n\nCustom instance only file.\n';
      state.files.push(normalizeFile({
        id: seedUuid('file-pr-review-1-examples'),
        instanceId: secondInstanceId,
        skillId: asset.id,
        relativePath: 'references/examples.md',
        fileType: 'text',
        mimeType: 'text/markdown',
        sizeBytes: exContent.length,
        content: exContent,
        contentHash: $hash(exContent),
        modifiedAt: $daysAgo(1),
        tokenCount: $tokenApprox(exContent),
        tokenCountMode: 'estimated'
      }));
      primary.fileCount = 5;
      primary.packageSizeBytes = (primary.packageSizeBytes || 0) + refContent.length + 2048 + nestedSkill.length + scriptContent.length;
      const second = state.instances.find(i => i.id === secondInstanceId);
      if (second) {
        second.fileCount = 2;
        second.packageSizeBytes = (second.packageSizeBytes || 0) + exContent.length;
      }
      // Snapshots for Detail demos
      state.snapshots.push(normalizeSnapshot({
        id: seedUuid('snap-pr-file'),
        skillId: asset.id,
        instanceId: primary.id,
        type: 'file',
        createdAt: $daysAgo(3),
        note: 'SKILL.md 文件快照',
        source: 'manual',
        files: [{ relativePath: 'SKILL.md', content: state.files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md').content }],
        retained: false
      }));
      state.snapshots.push(normalizeSnapshot({
        id: seedUuid('snap-pr-pkg'),
        skillId: asset.id,
        instanceId: primary.id,
        type: 'package',
        createdAt: $daysAgo(2),
        note: '完整包快照',
        source: 'pre-archive',
        files: state.files.filter(f => f.instanceId === primary.id).map(f => ({
          relativePath: f.relativePath,
          fileType: f.fileType,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes || 0,
          contentHash: f.contentHash,
          content: f.fileType === 'binary' ? null : (f.content || ''),
          modifiedAt: f.modifiedAt,
          indexStatus: f.indexStatus || 'indexed'
        })),
        retained: true,
        fileCount: state.files.filter(f => f.instanceId === primary.id).length,
        packageSizeBytes: state.files.filter(f => f.instanceId === primary.id).reduce((n, f) => n + (f.sizeBytes || 0), 0)
      }));
      state.snapshots.push(normalizeSnapshot({
        id: seedUuid('snap-pr-batch'),
        skillId: asset.id,
        instanceId: null,
        type: 'batch',
        createdAt: $daysAgo(1),
        note: '批量检查点快照',
        source: 'change-set',
        files: [],
        retained: true
      }));
      // Partial attribution usage sample
      state.usageEvents.push(normalizeUsageEvent({
        id: seedUuid('ue-pr-partial'),
        skillId: asset.id,
        instanceId: primary.id,
        sessionId: 'session-partial',
        callCount: 1,
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200,
        attributionLevel: 'partial',
        sourceAdapterId: 'claude-usage',
        occurredAt: $daysAgo(0)
      }));
    })();

    // Phase D: partial Missing — one available + one missing instance on same Asset
    (function addPartialMissing() {
      const asset = state.assets.find(a => a.name === 'commit-format') || state.assets.find(a => a.name === 'doc-gen');
      if (!asset) return;
      const primary = state.instances.find(i => i.skillId === asset.id && i.isPrimary);
      if (!primary || state.instances.filter(i => i.skillId === asset.id).length > 1) return;
      state.instances.push(normalizeInstance({
        id: seedUuid('instance-partial-missing'),
        skillId: asset.id,
        hostType: 'custom',
        rootPath: '~/Projects/missing/' + asset.name,
        skillFilePath: '~/Projects/missing/' + asset.name + '/SKILL.md',
        lifecycleStatus: 'missing',
        permissionMode: 'read-only',
        installedVersion: primary.installedVersion,
        healthStatuses: ['path-missing'],
        localModificationStatus: 'clean',
        sourceBindingId: null,
        isPrimary: false,
        lastSeenAt: $daysAgo(20),
        missingSince: $daysAgo(5),
        contentHash: primary.contentHash,
        fileCount: 1,
        packageSizeBytes: primary.packageSizeBytes
      }));
      reconcileAssetLifecycle(asset.id);
    })();

    // Phase D: ensure some skills remain unbound (no sourceBinding) — already true for many.
    // Mark demo-codex usage adapter path as no-data via existing null usage.
    // Demo scan-change ignore rule (Asset remains available)
    const demoScanIgnored = state.assets.find(a => a.name === 'demo-scan-ignored');
    if (demoScanIgnored) {
      const file = state.files.find(f => f.skillId === demoScanIgnored.id);
      const inst = state.instances.find(i => i.skillId === demoScanIgnored.id);
      state.ignoreRules.push(normalizeIgnoreRule({
        id: seedUuid('ig-demo-scan-ignored'),
        ruleType: 'scan-change',
        skillId: demoScanIgnored.id,
        path: inst ? inst.skillFilePath : null,
        contentHash: file ? file.contentHash : null,
        createdAt: $daysAgo(1),
        reason: '演示：忽略本次扫描变化（非忽略整个 Skill）'
      }));
    }

    // Generate usage events for Claude skills
    state.assets.filter(a => {
      const inst = state.instances.find(i => i.skillId === a.id && i.isPrimary);
      return inst && inst.hostType === 'claude-code';
    }).forEach(asset => {
      const desc = SKILL_DESC.find(d => d.id === asset.name);
      if (!desc || desc.usage === null || desc.usage === undefined) return;
      const events = [];
      for (let i = 0; i < desc.usage; i++) {
        const dayOffset = (i % 30);
        const hour = 8 + (i % 14);
        const time = new Date(Date.now() - dayOffset * 86400000 - (24 - hour) * 3600000).toISOString();
        const token = 500 + ((i * 137) % 4000);
        events.push(normalizeUsageEvent({
          id: seedUuid('ue-' + asset.name + '-' + i),
          skillId: asset.id,
          instanceId: state.instances.find(i => i.skillId === asset.id && i.isPrimary).id,
          sessionId: 'session-' + (i % 12),
          callCount: 1,
          inputTokens: Math.floor(token * 0.4),
          outputTokens: Math.floor(token * 0.6),
          totalTokens: token,
          attributionLevel: 'accurate',
          sourceAdapterId: 'claude-adapter',
          occurredAt: time
        }));
      }
      events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      state.usageEvents.push(...events);
    });

    // Snapshots for all skills
    state.assets.forEach(asset => {
      const primaryFile = state.files.find(f => f.skillId === asset.id && f.relativePath === 'SKILL.md');
      if (!primaryFile) return;
      state.snapshots.push(normalizeSnapshot({
        id: seedUuid('snap-' + asset.name + '-0'),
        skillId: asset.id,
        instanceId: state.instances.find(i => i.skillId === asset.id && i.isPrimary)?.id,
        type: 'package',
        createdAt: $daysAgo(3),
        note: '自动快照',
        source: 'auto',
        files: [{ relativePath: 'SKILL.md', content: primaryFile.content, contentHash: primaryFile.contentHash }]
      }));
      state.snapshots.push(normalizeSnapshot({
        id: seedUuid('snap-' + asset.name + '-1'),
        skillId: asset.id,
        instanceId: state.instances.find(i => i.skillId === asset.id && i.isPrimary)?.id,
        type: 'package',
        createdAt: $daysAgo(1),
        note: '打开时快照',
        source: 'open',
        files: [{ relativePath: 'SKILL.md', content: primaryFile.content, contentHash: primaryFile.contentHash }]
      }));
    });

    // Drafts
    const draftRecords = [
      { skillName: 'empty-skill-draft', content: `# empty-skill-draft\n\n（待补充）`, status: 'modified' },
      { skillName: 'figma-tokens', content: buildContent(SKILL_DESC.find(d => d.id === 'figma-tokens')) + '\n\n## 新增\n- 支持 dark mode 变量', status: 'conflict' },
      { skillName: 'test-runner', content: buildContent(SKILL_DESC.find(d => d.id === 'test-runner')) + '\n\n## 改动\n- 增加失败重试', status: 'modified' },
      { skillName: 'demo-external-conflict', content: buildContent(SKILL_DESC.find(d => d.id === 'demo-external-conflict')) + '\n\n## 新增\n- 演示外部冲突草稿', status: 'conflict' },
      { skillName: 'demo-draft', content: buildContent(SKILL_DESC.find(d => d.id === 'demo-draft')), status: 'modified' }
    ];
    draftRecords.forEach(d => {
      const asset = state.assets.find(a => a.name === d.skillName);
      if (!asset) return;
      const primary = state.instances.find(i => i.skillId === asset.id && i.isPrimary);
      const primaryFile = state.files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md');
      state.drafts.push(normalizeDraft({
        id: seedUuid('draft-' + d.skillName),
        skillId: asset.id,
        instanceId: primary.id,
        fileId: primaryFile.id,
        content: d.content,
        createdAt: $daysAgo(1),
        updatedAt: $hoursAgo(2),
        baseContentHash: primaryFile.contentHash,
        baseFileModifiedAt: primaryFile.modifiedAt,
        status: d.status,
        lastAutosaveResult: d.skillName === 'test-runner' ? 'failed' : 'ok'
      }));
    });

    // Pending tasks
    state.assets.forEach(asset => {
      if (asset.lifecycleStatus === 'archived') return;
      const desc = SKILL_DESC.find(d => d.id === asset.name);
      if (!desc) return;
      if (desc.archiveCandidate) state.pendingTasks.push(normalizePendingTask({ id: seedUuid('task-' + asset.name + '-archive'), skillId: asset.id, taskType: 'archive_candidate', priority: 'normal', reasonCodes: ['unused_90d'], dataWindow: '90d', confidence: 'high' }));
      if (desc.ignored) state.pendingTasks.push(normalizePendingTask({ id: seedUuid('task-' + asset.name + '-ignored'), skillId: asset.id, taskType: 'ignored', priority: 'normal', reasonCodes: ['manual_ignore'], dataWindow: 'all', confidence: 'high' }));
      if (desc.dupGroup) {
        const group = state.duplicateGroups.find(g => g.id === seedUuid('dup-' + desc.dupGroup));
        state.pendingTasks.push(normalizePendingTask({ id: seedUuid('task-' + asset.name + '-dup'), skillId: asset.id, taskType: 'duplicate_candidate', priority: 'normal', reasonCodes: ['similar_name_content'], dataWindow: 'all', confidence: 'medium', groupId: group.id }));
      }
      if (desc.health) desc.health.forEach(h => {
        const typeMap = { 'path-missing': 'path_missing', 'path_missing': 'path_missing', 'yaml-error': 'yaml_error', 'yaml_error': 'yaml_error', 'empty-content': 'empty_content', 'empty_content': 'empty_content', 'permission-denied': 'permission_denied', 'permission_denied': 'permission_denied' };
        if (typeMap[h]) state.pendingTasks.push(normalizePendingTask({ id: seedUuid('task-' + asset.name + '-' + h), skillId: asset.id, taskType: typeMap[h], priority: 'high', reasonCodes: [h], dataWindow: 'all', confidence: 'high' }));
      });
      if (desc.externalChange) state.pendingTasks.push(normalizePendingTask({ id: seedUuid('task-' + asset.name + '-conflict'), skillId: asset.id, taskType: 'external_conflict', priority: 'high', reasonCodes: ['external_changed'], dataWindow: 'all', confidence: 'high' }));
      if (desc.unfinishedDraft) state.pendingTasks.push(normalizePendingTask({ id: seedUuid('task-' + asset.name + '-draft'), skillId: asset.id, taskType: 'unfinished_draft', priority: 'normal', reasonCodes: ['draft_not_applied'], dataWindow: 'all', confidence: 'high' }));
      if (desc.failedOp) state.pendingTasks.push(normalizePendingTask({ id: seedUuid('task-' + asset.name + '-failed'), skillId: asset.id, taskType: 'failed_operation', priority: 'high', reasonCodes: [desc.failedOp], dataWindow: 'all', confidence: 'high' }));
      if (desc.tokenAttention) state.pendingTasks.push(normalizePendingTask({ id: seedUuid('task-' + asset.name + '-token'), skillId: asset.id, taskType: 'token_attention', priority: 'normal', reasonCodes: ['token_growth'], dataWindow: '7d', confidence: 'medium' }));
    });

    // Audit events
    state.usageEvents.forEach(ue => {
      state.auditEvents.push(normalizeAuditEvent({
        id: seedUuid('ae-usage-' + ue.id),
        time: ue.occurredAt,
        skillId: ue.skillId,
        instanceId: ue.instanceId,
        eventType: 'call',
        category: 'usage',
        source: 'Claude Code',
        result: 'completed',
        tokenCount: ue.totalTokens,
        attribution: ue.attributionLevel,
        note: '宿主调用记录'
      }));
    });
    state.assets.filter(a => {
      const inst = state.instances.find(i => i.skillId === a.id && i.isPrimary);
      return inst && inst.hostType === 'claude-code';
    }).forEach(asset => {
      const snaps = state.snapshots.filter(s => s.skillId === asset.id);
      state.auditEvents.push(normalizeAuditEvent({
        id: seedUuid('ae-apply-' + asset.name),
        time: $daysAgo(1),
        skillId: asset.id,
        eventType: 'apply_change',
        category: 'edit',
        source: 'Skill Panel',
        result: 'completed',
        snapshotId: snaps[0]?.id,
        note: '应用更改后写回 SKILL.md'
      }));
      state.auditEvents.push(normalizeAuditEvent({
        id: seedUuid('ae-snap-' + asset.name),
        time: $daysAgo(3),
        skillId: asset.id,
        eventType: 'create_snapshot',
        category: 'snap',
        source: 'Skill Panel',
        result: 'completed',
        snapshotId: snaps[1]?.id,
        note: '自动创建快照'
      }));
    });
    state.pendingTasks.filter(t => t.taskType === 'external_conflict').forEach(t => {
      state.auditEvents.push(normalizeAuditEvent({
        id: seedUuid('ae-conflict-' + t.skillId),
        time: $daysAgo(2),
        skillId: t.skillId,
        eventType: 'external_file_conflict',
        category: 'pending',
        source: '文件系统',
        result: 'pending',
        draftId: state.drafts.find(d => d.skillId === t.skillId)?.id,
        taskId: t.id,
        note: '磁盘文件已被其他应用修改'
      }));
    });
    state.pendingTasks.filter(t => t.taskType === 'failed_operation').forEach(t => {
      state.auditEvents.push(normalizeAuditEvent({
        id: seedUuid('ae-failed-' + t.skillId),
        time: $daysAgo(0),
        skillId: t.skillId,
        eventType: 'save_failed',
        category: 'pending',
        source: 'Skill Panel',
        result: 'failed',
        draftId: state.drafts.find(d => d.skillId === t.skillId)?.id,
        taskId: t.id,
        note: '写回磁盘失败，已保留草稿'
      }));
    });
    state.pendingTasks.filter(t => ['path_missing','yaml_error','empty_content','permission_denied'].includes(t.taskType)).forEach(t => {
      const labelMap = { path_missing: '路径不存在', yaml_error: 'frontmatter 解析失败', empty_content: '内容为空', permission_denied: '无读取权限' };
      state.auditEvents.push(normalizeAuditEvent({
        id: seedUuid('ae-issue-' + t.skillId + '-' + t.taskType),
        time: $daysAgo(t.taskType === 'yaml_error' ? 1 : 0),
        skillId: t.skillId,
        eventType: t.taskType,
        category: 'pending',
        source: t.taskType === 'path_missing' || t.taskType === 'permission_denied' ? '扫描' : 'Skill Panel',
        result: 'pending',
        taskId: t.id,
        note: labelMap[t.taskType]
      }));
    });
    state.archiveRecords.forEach(ar => {
      state.auditEvents.push(normalizeAuditEvent({
        id: seedUuid('ae-archive-' + ar.skillId),
        time: ar.archivedAt,
        skillId: ar.skillId,
        eventType: 'archive',
        category: 'archive',
        source: 'Skill Panel',
        result: 'completed',
        note: 'Skill 已归档'
      }));
    });
    state.auditEvents.push(normalizeAuditEvent({ id: seedUuid('ae-scan'), time: $daysAgo(0), eventType: 'scan', category: 'system', source: 'Skill Panel', result: 'completed', note: '重新扫描已授权目录' }));
    state.auditEvents.push(normalizeAuditEvent({ id: seedUuid('ae-adapter'), time: $daysAgo(1), eventType: 'adapter_sync', category: 'system', source: 'Claude Code', result: 'completed', note: '使用数据同步完成' }));

    // Recount host skill counts (only available assets)
    state.hosts.forEach(h => {
      h.skillCount = state.assets.filter(a => {
        if (a.lifecycleStatus !== 'available') return false;
        const inst = state.instances.find(i => i.skillId === a.id && i.isPrimary);
        return inst && inst.hostType === h.hostType;
      }).length;
    });

    // Note: deterministic scan scenario is no longer seeded automatically.
    // Use SP.loadDemoScanScenario() for cases.html or test environments.

    return state;
  }

  function seedScanScenario(state) {
    const session = normalizeScanSession({
      id: seedUuid('scan-seed'),
      scanType: 'first-full',
      status: 'completed-pending-confirmation',
      startedAt: $daysAgo(0),
      finishedAt: $hoursAgo(1),
      currentPath: '',
      visitedDirectoryCount: 12,
      discoveredCount: 11,
      failureCount: 1,
      failures: [{ path: '~/restricted/system-skills', reason: '无读取权限', time: $hoursAgo(1) }],
      steps: buildScanSteps(),
      currentStep: 12,
      hostIds: ['claude', 'codex', 'custom']
    });
    state.scanSessions.push(session);

    buildScanSteps().forEach((step, idx) => {
      if (step.status === 'failure') return;
      const discovery = _buildDiscovery(session, step);
      discovery.discoveredAt = $hoursAgo(1);
      state.scanDiscoveries.push(discovery);
    });

    createChangeSet(session.id);
  }

  function loadDemoScanScenario() {
    const state = getState();
    if (state.scanSessions.length > 0) return state.scanSessions[0];
    seedScanScenario(state);
    return state.scanSessions[0];
  }

  /* ---------- migration from v2 ---------- */
  function migrateFromV2(legacy) {
    const state = seedState();
    // Migrated users already have a Library; skip first-launch onboarding.
    state.initialized = true;
    state.onboardingDecision = 'migrated';
    // Preserve user settings
    if (legacy.settings) {
      Object.assign(state.settings, legacy.settings);
    }
    // Preserve view states
    if (legacy.viewStates) {
      for (const k of Object.keys(legacy.viewStates)) {
        if (state.viewStates[k]) Object.assign(state.viewStates[k], legacy.viewStates[k]);
      }
    }
    // If legacy has skills, create v3 entities from them
    if (Array.isArray(legacy.skills)) {
      legacy.skills.forEach(s => {
        if (!s || !s.id) return;
        const existing = state.assets.find(a => a.id === s.id);
        if (existing) {
          // Update existing seed asset with legacy metadata
          existing.isFavorite = !!s.isFavorite;
          existing.description = s.description || existing.description;
          return;
        }
        const assetId = s.id;
        const instanceId = seedUuid('mig-instance-' + assetId);
        const fileId = seedUuid('mig-file-' + assetId);
        const hostType = s.storageLocationId === 'codex' ? 'codex' : s.storageLocationId === 'custom' ? 'custom' : 'claude-code';
        const lifecycle = s.lifecycleStatus === 'archived' ? 'archived' : 'available'; // ignored is not an asset lifecycle

        state.assets.push(normalizeAsset({
          id: assetId,
          name: s.name,
          displayName: s.displayName || s.name,
          description: s.description || '',
          categoryIds: s.category ? [catId(s.category)] : [],
          tagIds: tagIds(s.tags || []),
          isFavorite: !!s.isFavorite,
          lifecycleStatus: lifecycle,
          primaryInstanceId: instanceId,
          supportedHosts: [hostType],
          createdAt: s.installedAt || $now(),
          updatedAt: s.lastModifiedAt || $now()
        }));

        state.instances.push(normalizeInstance({
          id: instanceId,
          skillId: assetId,
          hostType,
          rootPath: s.absolutePath ? s.absolutePath.replace(/\/SKILL\.md$/, '') : '',
          skillFilePath: s.absolutePath || '',
          lifecycleStatus: lifecycle === 'archived' ? 'available' : lifecycle,
          permissionMode: s.isUserCreated ? 'managed' : 'read-only',
          installedVersion: s.version || '',
          healthStatuses: (s.healthStatuses || ['normal']).map(h => String(h).replace(/_/g, '-')),
          isPrimary: true,
          lastSeenAt: s.lastModifiedAt || $now(),
          contentHash: s.contentHash || $hash(s.content),
          fileCount: 1,
          packageSizeBytes: s.fileSize || 0
        }));

        state.files.push(normalizeFile({
          id: fileId,
          instanceId,
          skillId: assetId,
          relativePath: 'SKILL.md',
          fileType: 'text',
          mimeType: 'text/markdown',
          sizeBytes: s.fileSize || 0,
          content: s.content || '',
          contentHash: s.contentHash || $hash(s.content),
          modifiedAt: s.lastModifiedAt || $now(),
          tokenCount: s.documentTokenCount,
          tokenCountMode: s.documentTokenCount == null ? 'unavailable' : 'estimated'
        }));

        // If legacy skill was ignored, create an ignore rule (ignored is not an asset lifecycle in v3)
        if (s.lifecycleStatus === 'ignored') {
          state.ignoreRules.push(normalizeIgnoreRule({
            id: seedUuid('mig-ignore-' + assetId),
            skillId: assetId,
            ruleType: 'skill_id',
            path: s.absolutePath || '',
            contentHash: s.contentHash || $hash(s.content),
            reason: '从 v2 迁移的忽略状态',
            createdAt: s.lastModifiedAt || $now(),
            expiresAt: null
          }));
        }
      });
    }
    // Preserve drafts
    if (Array.isArray(legacy.drafts)) {
      legacy.drafts.forEach(d => {
        if (!d || !d.skillId) return;
        const asset = state.assets.find(a => a.id === d.skillId);
        if (!asset) return;
        const inst = state.instances.find(i => i.skillId === asset.id && i.isPrimary);
        const file = inst ? state.files.find(f => f.instanceId === inst.id && f.relativePath === 'SKILL.md') : null;
        state.drafts.push(normalizeDraft({
          id: d.id || seedUuid('mig-draft-' + d.skillId),
          skillId: asset.id,
          instanceId: inst?.id,
          fileId: file?.id,
          content: d.content || '',
          createdAt: d.createdAt || $now(),
          updatedAt: d.updatedAt || $now(),
          baseContentHash: d.baseContentHash || '',
          baseFileModifiedAt: d.baseFileModifiedAt || $now(),
          status: d.status || 'modified',
          lastAutosaveResult: d.lastAutosaveResult || 'ok'
        }));
      });
    }
    // Preserve snapshots
    if (Array.isArray(legacy.snapshots)) {
      legacy.snapshots.forEach(sn => {
        if (!sn || !sn.skillId) return;
        const asset = state.assets.find(a => a.id === sn.skillId);
        if (!asset) return;
        state.snapshots.push(normalizeSnapshot({
          id: sn.id || seedUuid('mig-snap-' + sn.skillId),
          skillId: asset.id,
          instanceId: state.instances.find(i => i.skillId === asset.id && i.isPrimary)?.id,
          type: 'package',
          createdAt: sn.createdAt || $now(),
          note: sn.note || '',
          source: sn.source || 'manual',
          files: sn.content ? [{ relativePath: 'SKILL.md', content: sn.content, contentHash: $hash(sn.content) }] : []
        }));
      });
    }
    // Preserve pending tasks
    if (Array.isArray(legacy.pendingTasks)) {
      legacy.pendingTasks.forEach(t => {
        if (!t || !t.skillId) return;
        const asset = state.assets.find(a => a.id === t.skillId);
        if (!asset) return;
        state.pendingTasks.push(normalizePendingTask({
          id: t.id || seedUuid('mig-task-' + t.skillId),
          skillId: asset.id,
          taskType: t.taskType || 'archive_candidate',
          priority: t.priority || 'normal',
          reasonCodes: t.reasonCodes || [],
          dataWindow: t.dataWindow || 'all',
          confidence: t.confidence || 'medium',
          status: t.status || 'open',
          createdAt: t.createdAt || $now(),
          resolvedAt: t.resolvedAt || null,
          groupId: t.groupId || null
        }));
      });
    }
    // Preserve ignore rules and archive records
    if (Array.isArray(legacy.ignoreRules)) {
      legacy.ignoreRules.forEach(r => state.ignoreRules.push(normalizeIgnoreRule(r)));
    }
    if (Array.isArray(legacy.archiveRecords)) {
      legacy.archiveRecords.forEach(r => state.archiveRecords.push(normalizeArchiveRecord(r)));
    }
    // Preserve activity events as audit events
    if (Array.isArray(legacy.activityEvents)) {
      legacy.activityEvents.forEach(e => state.auditEvents.push(normalizeAuditEvent({
        id: e.id || seedUuid('mig-ae'),
        time: e.time || $now(),
        skillId: e.skillId,
        eventType: e.eventType || 'system',
        category: e.category || 'system',
        source: e.source || 'Skill Panel',
        result: e.result || 'completed',
        snapshotId: e.snapshotId,
        draftId: e.draftId,
        taskId: e.taskId,
        note: e.note || ''
      })));
    }
    // Preserve usage events
    if (Array.isArray(legacy.usageEvents)) {
      legacy.usageEvents.forEach(e => state.usageEvents.push(normalizeUsageEvent({
        id: e.id || seedUuid('mig-ue'),
        skillId: e.skillId,
        callCount: e.tokenCount ? 1 : 0,
        totalTokens: e.tokenCount || null,
        attributionLevel: e.attribution || 'accurate',
        sourceAdapterId: 'claude-adapter',
        occurredAt: e.time || $now()
      })));
    }

    return state;
  }

  /* ---------- state management ---------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === STATE_VERSION) {
          // Remove any persisted derived arrays or deprecated fields; they must be generated on demand
          delete parsed.skills;
          delete parsed.activityEvents;
          delete parsed.storageLocations; // hosts are the single source of directories
          if (parsed.settings) {
            delete parsed.settings.scanStatus;
            delete parsed.settings.scanResult;
          }
          // Existing v3 states created before first-launch routing should stay usable.
          if (parsed.initialized == null) parsed.initialized = true;
          return parsed;
        }
      }
    } catch (e) { console.error('loadState v3 failed', e); }

    // Try legacy migration
    try {
      const legacyRaw = localStorage.getItem(LEGACY_STATE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (legacy && legacy.version === 2) {
          const migrated = migrateFromV2(legacy);
          localStorage.setItem(STATE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch (e) { console.error('migrate v2 failed', e); }

    const seeded = seedState();
    try { localStorage.setItem(STATE_KEY, JSON.stringify(seeded)); } catch (err) { console.error('persist seed failed', err); }
    return seeded;
  }

  let _state = null;
  function getState() { if (!_state) _state = loadState(); return _state; }
  function saveState() { if (_state) localStorage.setItem(STATE_KEY, JSON.stringify(_state)); }
  function resetState() { _state = seedState(); saveState(); }

  function getSettings() { return JSON.parse(JSON.stringify(getState().settings || {})); }
  function normalizeArchiveDirectory(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!trimmed) return null;
    return trimmed.replace(/\/$/, '') || trimmed;
  }
  function setSetting(key, value) {
    const defaults = defaultSettings();
    const allowed = Object.keys(defaults);
    if (!allowed.includes(key)) {
      return { ok: false, error: 'unknown_setting', message: '未知设置项：' + key };
    }
    const boolKeys = Object.keys(defaults).filter(k => typeof defaults[k] === 'boolean');
    const stringKeys = ['language', 'theme', 'density', 'defaultPage', 'defaultCreateLocationId', 'archiveDirectory'];
    const numberEnums = {
      snapshotsPerSkill: [10, 20, 50, 100],
      cleanupWindowDays: [60, 90, 180],
      usageRetentionDays: [90, 180, 365]
    };

    if (boolKeys.includes(key)) {
      if (typeof value !== 'boolean') {
        return { ok: false, error: 'invalid_value', message: '设置类型不匹配' };
      }
    }
    if (stringKeys.includes(key)) {
      if (typeof value !== 'string') {
        return { ok: false, error: 'invalid_value', message: '设置类型不匹配' };
      }
    }
    if (key === 'theme' && !['light', 'dark', 'system'].includes(value)) {
      return { ok: false, error: 'invalid_value', message: '无效的主题值' };
    }
    if (key === 'language' && !['zh', 'en', 'system'].includes(value)) {
      return { ok: false, error: 'invalid_value', message: '无效的语言值' };
    }
    if (key === 'density' && !['standard', 'compact'].includes(value)) {
      return { ok: false, error: 'invalid_value', message: '无效的密度值' };
    }
    if (key === 'defaultPage' && !['library', 'insights', 'activity'].includes(value)) {
      return { ok: false, error: 'invalid_value', message: '无效的默认页面' };
    }
    if (key === 'defaultCreateLocationId') {
      const host = getState().hosts.find(h => h.id === value);
      if (!host || host.hostType === 'archive' || host.enabled === false) {
        return { ok: false, error: 'invalid_value', message: '无效的默认创建目录' };
      }
    }
    if (key === 'archiveDirectory') {
      const normalized = normalizeArchiveDirectory(value);
      if (!normalized) {
        return { ok: false, error: 'invalid_value', message: '归档目录不能为空' };
      }
      value = normalized;
    }
    if (numberEnums[key]) {
      const num = typeof value === 'number' ? value : Number(value);
      if (!numberEnums[key].includes(num)) {
        return { ok: false, error: 'invalid_value', message: '无效的数值' };
      }
      value = num;
    }

    getState().settings[key] = value;
    saveState();
    return { ok: true };
  }
  function getIgnoreRules() {
    return JSON.parse(JSON.stringify(getState().ignoreRules || []));
  }
  function resetSettingsToDefaults() {
    getState().settings = defaultSettings();
    saveState();
  }
  function clearArchiveRecords() { getState().archiveRecords = []; saveState(); }
  function clearUsageEvents() { getState().usageEvents = []; saveState(); }
  function setAdapterStatus(adapterId, status) {
    const a = (getState().usageAdapters || []).find(x => x.id === adapterId);
    if (!a) return { ok: false };
    a.status = status;
    saveState();
    return { ok: true };
  }

  function getViewState(page) { return JSON.parse(JSON.stringify(getState().viewStates[page] || {})); }
  function setViewState(page, patch) { getState().viewStates[page] = Object.assign(getState().viewStates[page] || {}, patch); saveState(); }

  function saveOrigin(ctx) { try { localStorage.setItem(ORIGIN_KEY, JSON.stringify(ctx)); } catch (e) {} }
  function getOrigin() { try { const raw = localStorage.getItem(ORIGIN_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function clearOrigin() { localStorage.removeItem(ORIGIN_KEY); }

  /* ---------- v3 entity API ---------- */
  function getAssets() { return getState().assets.map(a => normalizeAsset(a)); }
  function resolveAssetId(idOrName) {
    const state = getState();
    const byId = state.assets.find(x => x.id === idOrName);
    if (byId) return byId.id;
    const byName = state.assets.find(x => x.name === idOrName);
    return byName ? byName.id : null;
  }
  function resolveCanonicalAssetId(assetId) {
    if (!assetId) return null;
    const seen = new Set();
    let id = assetId;
    while (id) {
      if (seen.has(id)) return id;
      seen.add(id);
      const a = getState().assets.find(x => x.id === id);
      if (!a || !a.mergedIntoAssetId) return id;
      id = a.mergedIntoAssetId;
    }
    return assetId;
  }

  function getCanonicalUsageEvents(assetId, stateArg) {
    const state = stateArg || getState();
    const canonicalId = resolveCanonicalAssetId(assetId);
    if (!canonicalId) return [];
    const relatedIds = new Set([canonicalId]);
    state.assets.forEach(a => {
      if (resolveCanonicalAssetId(a.id) === canonicalId) relatedIds.add(a.id);
    });
    return state.usageEvents.filter(e => relatedIds.has(e.skillId));
  }
  function getAsset(idOrName) {
    const rid = resolveAssetId(idOrName);
    const a = rid ? getState().assets.find(x => x.id === rid) : null;
    if (!a) return null;
    if (a.lifecycleStatus === 'deleted' && a.mergedIntoAssetId) {
      return {
        ...normalizeAsset(a),
        mergedAway: true,
        canonicalAssetId: resolveCanonicalAssetId(a.id)
      };
    }
    return normalizeAsset(a);
  }
  function getAssetRaw(idOrName) { const rid = resolveAssetId(idOrName); return rid ? getState().assets.find(x => x.id === rid) : null; }

  function getInstances(opts = {}) {
    const state = getState();
    if (opts.skillId) return state.instances.filter(i => i.skillId === opts.skillId).map(i => normalizeInstance(i));
    if (opts.assetId) return state.instances.filter(i => i.skillId === opts.assetId).map(i => normalizeInstance(i));
    return state.instances.map(i => normalizeInstance(i));
  }
  function getInstance(id) { const i = getState().instances.find(x => x.id === id); return i ? normalizeInstance(i) : null; }
  function getInstanceRaw(id) { return getState().instances.find(x => x.id === id); }

  function getFiles(opts = {}) {
    return getFilesRawInternal(opts).map(f => toFileMetadata(f));
  }
  function getFile(id) {
    const f = getFileRawInternal(id);
    return f ? toFileMetadata(f) : null;
  }
  // Internal raw accessors — not exported on SP
  function getFileRaw(id) { return getFileRawInternal(id); }

  function getSourceBindings(skillId) {
    const state = getState();
    if (skillId) return state.sourceBindings.filter(b => b.skillId === skillId).map(b => normalizeSourceBinding(b));
    return state.sourceBindings.map(b => normalizeSourceBinding(b));
  }
  function getSourceBinding(id) { const b = getState().sourceBindings.find(x => x.id === id); return b ? normalizeSourceBinding(b) : null; }

  function getPermissionGrants(scopeId) {
    const state = getState();
    if (scopeId) return state.permissionGrants.filter(g => g.scopeId === scopeId).map(g => normalizePermissionGrant(g));
    return state.permissionGrants.map(g => normalizePermissionGrant(g));
  }

  function getScanSessions() { return getState().scanSessions.map(s => normalizeScanSession(s)); }
  function getScanSession(id) { const s = getState().scanSessions.find(x => x.id === id); return s ? normalizeScanSession(s) : null; }

  function getChangeSets(scanSessionId) {
    const state = getState();
    if (scanSessionId) return state.changeSets.filter(c => c.scanSessionId === scanSessionId).map(c => normalizeChangeSet(c));
    return state.changeSets.map(c => normalizeChangeSet(c));
  }

  /* ---------- backward-compatible skills API ---------- */
  // These derive flat v2-shaped view models from v3 entities on every call.
  // They are read-only; mutations must use getAssetRaw / getInstanceRaw / getFileRaw.
  function getSkills() { return deriveAllV2Skills(getState()).map(s => ({ ...s })); }
  function getSkill(idOrName) { const rid = resolveAssetId(idOrName); if (!rid) return null; const s = deriveV2Skill(rid); return s ? { ...s } : null; }
  function getActiveSkills() { return deriveAllV2Skills(getState()).filter(s => s.lifecycleStatus === 'active'); }
  function getArchivedSkills() { return deriveAllV2Skills(getState()).filter(s => s.lifecycleStatus === 'archived'); }
  function getIgnoredSkills() { return deriveAllV2Skills(getState()).filter(s => s.isIgnored); }

  // Hosts are the single formal source of scan targets / directories.
  function getHosts() { return getState().hosts.map(h => normalizeHost(h)); }
  function getHost(id) { const h = getState().hosts.find(x => x.id === id); return h ? normalizeHost(h) : null; }
  function getHostRaw(id) { return getState().hosts.find(x => x.id === id); }
  function updateHost(id, patch) {
    const h = getHostRaw(id);
    if (!h) return null;
    Object.assign(h, patch, { skillCount: computeHostSkillCount(id) });
    saveState();
    return normalizeHost(h);
  }
  function computeHostSkillCount(hostId) {
    const host = getState().hosts.find(h => h.id === hostId);
    if (!host) return 0;
    return getState().instances.filter(i => i.hostType === host.hostType && i.lifecycleStatus !== 'missing').length;
  }

  // storageLocations is a read-only v2-compatible view derived from hosts.
  function deriveStorageLocation(host) {
    if (!host) return null;
    return {
      ...host,
      type: host.hostType,
      skillCount: computeHostSkillCount(host.id)
    };
  }
  function getStorageLocations() { return getState().hosts.map(h => deriveStorageLocation(h)); }
  function getStorageLocation(id) { return deriveStorageLocation(getHostRaw(id)); }
  function getAdapters() { return JSON.parse(JSON.stringify(getState().usageAdapters || [])); }

  function hasUsageData(skill) { return skill.usageAdapterIds.some(aid => { const a = getState().usageAdapters.find(x => x.id === aid); return a && a.supportsCalls; }); }
  function isIgnored(skill) {
    // Only legacy skill-level ignore marks Asset as ignored. Scan/suggestion/path rules do not.
    return getState().ignoreRules.some(r =>
      r.skillId === skill.id && (r.ruleType === 'skill_id' || r.ruleType === 'skill'));
  }

  const STATUS_PRIORITY = ['permission_denied','path_missing','external_conflict','yaml_error','empty_content','unfinished_draft','duplicate_candidate','archive_candidate','token_attention','normal'];
  function getMainStatus(skill) {
    const pending = getState().pendingTasks.filter(t => t.skillId === skill.id && t.status === 'open').map(t => t.taskType);
    const health = $coerceArray(skill.healthStatuses);
    const candidates = [
      skill.lifecycleStatus === 'archived' ? 'archived' : null,
      isIgnored(skill) ? 'ignored' : null,
      $safeIncludes(health, 'permission_denied') ? 'permission_denied' : null,
      $safeIncludes(health, 'path_missing') ? 'path_missing' : null,
      $safeIncludes(pending, 'external_conflict') || $safeIncludes(pending, 'failed_operation') ? 'external_conflict' : null,
      $safeIncludes(health, 'yaml_error') || $safeIncludes(health, 'required_field_missing') ? ($safeIncludes(health, 'yaml_error') ? 'yaml_error' : 'required_field_missing') : null,
      $safeIncludes(health, 'empty_content') ? 'empty_content' : null,
      $safeIncludes(pending, 'unfinished_draft') ? 'unfinished_draft' : null,
      $safeIncludes(pending, 'duplicate_candidate') ? 'duplicate_candidate' : null,
      $safeIncludes(pending, 'archive_candidate') ? 'archive_candidate' : null,
      $safeIncludes(pending, 'token_attention') ? 'token_attention' : null
    ].filter(Boolean);
    if (!candidates.length) return 'normal';
    for (const p of STATUS_PRIORITY) { if (candidates.includes(p)) return p; }
    return candidates[0];
  }

  function getStatusClass(type) {
    const map = { normal: 'ok', archived: 'arch', ignored: 'arch', external_changed: 'warn', yaml_error: 'danger', required_field_missing: 'danger', empty_content: 'warn', path_missing: 'danger', permission_denied: 'danger', name_conflict: 'danger', duplicate_candidate: 'warn', archive_candidate: 'warn', unfinished_draft: 'warn', token_attention: 'warn', external_conflict: 'danger', failed_operation: 'danger', restore_conflict: 'danger' };
    return map[type] || 'ok';
  }

  function getStatusLabel(type) { return i18n[SP.lang || 'zh']['status.' + type] || type; }
  function getTaskLabel(type) { return i18n[SP.lang || 'zh']['status.' + type] || type; }

  function getPendingTasks(skill) { return getState().pendingTasks.filter(t => t.skillId === skill.id && t.status === 'open').map(t => normalizePendingTask(t)); }
  function getDraft(skillId) {
    const d = getState().drafts.find(d => d.skillId === skillId);
    return d ? toDraftSummary(d) : null;
  }
  function getSnapshots(skillId) {
    return getState().snapshots
      .filter(s => s.skillId === skillId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(s => JSON.parse(JSON.stringify(toSnapshotSummary(s))));
  }
  function getArchiveRecord(skillId) { return getState().archiveRecords.find(r => r.skillId === skillId); }
  function _freezeCopy(obj) { return Object.freeze(JSON.parse(JSON.stringify(obj))); }
  function getSkillEvents(skillId) { return getState().auditEvents.filter(e => e.skillId === skillId).sort((a, b) => b.time.localeCompare(a.time)).map(e => _freezeCopy(e)); }
  function getRecentEvents(limit = 6) { return getState().auditEvents.slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, limit).map(e => _freezeCopy(e)); }
  function getActivityEvents() { return getState().auditEvents.slice().map(e => _freezeCopy(e)); }
  function isOpenPendingActivityEvent(e) {
    if (!e || e.category !== 'pending') return false;
    if (!e.taskId) return true;
    const task = getState().pendingTasks.find(x => x.id === e.taskId);
    return !!(task && task.status === 'open');
  }
  function getOpenPendingActivityEvents() {
    return getActivityEvents().filter(isOpenPendingActivityEvent);
  }
  // Activity badge count: visible open pending events.
  // Unlinked pending AuditEvents are included; this is not the total raw PendingTask count.
  function getOpenPendingTaskCount() {
    return getOpenPendingActivityEvents().length;
  }
  function getAuditEvents() { return getState().auditEvents.slice().map(e => _freezeCopy(e)); }

  /* ---------- cross-page navigation ---------- */
  function openSkillDetail(skillId, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    let rid = resolveAssetId(skillId) || skillId;
    const raw = getState().assets.find(a => a.id === rid);
    if (raw && raw.mergedIntoAssetId) {
      rid = resolveCanonicalAssetId(rid);
    }
    const patch = { assetId: rid };
    if (context.tab) patch.tab = context.tab;
    if (context.instanceId) patch.selectedInstanceId = context.instanceId;
    if (context.fileId) patch.selectedFileId = context.fileId;
    setDetailViewState(patch);
    location.href = appendTestModeParam('skill-detail.html?skill=' + encodeURIComponent(rid));
  }
  function openSkillEditor(skillId, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const rid = resolveAssetId(skillId) || skillId;
    let sessionId = context.sessionId || null;
    if (!sessionId) {
      let mode = context.mode || null;
      if (!mode) {
        const inst = context.instanceId
          ? getInstanceRaw(context.instanceId)
          : (getState().instances.find(i => i.skillId === rid && i.isPrimary) || getState().instances.find(i => i.skillId === rid));
        const perm = inst ? getInstancePermission(inst.id) : null;
        mode = (perm && perm.writeAccess) ? 'editable' : 'read-only';
      }
      const opened = openEditorSession({
        assetId: rid,
        instanceId: context.instanceId || null,
        mode
      });
      if (opened && opened.ok) sessionId = opened.id;
      else if (mode === 'editable') {
        const fallback = openEditorSession({
          assetId: rid,
          instanceId: context.instanceId || null,
          mode: 'read-only'
        });
        if (fallback && fallback.ok) sessionId = fallback.id;
      }
    }
    const q = new URLSearchParams();
    q.set('skill', rid);
    if (sessionId) q.set('session', sessionId);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'skill-editor.html?' + q.toString();
  }

  function appendTestModeParam(url) {
    if (!isTestMode()) return url;
    if (!url) return url;
    const hasQ = String(url).indexOf('?') >= 0;
    if (/[?&]dev=1(?:&|$)/.test(url)) return url;
    return url + (hasQ ? '&' : '?') + 'dev=1';
  }

  function openConflictPage(conflictId, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const q = new URLSearchParams();
    if (conflictId) q.set('conflict', conflictId);
    if (context.sessionId) q.set('session', context.sessionId);
    if (context.assetId) q.set('skill', context.assetId);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'conflict.html?' + q.toString();
  }

  function openCompare(groupIdOrLeft, right, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    let candidateIds = [];
    let groupId = null;
    if (context.candidateIds && context.candidateIds.length) {
      candidateIds = context.candidateIds.map(id => resolveAssetId(id) || id).filter(Boolean);
    } else if (right) {
      const leftId = resolveAssetId(groupIdOrLeft) || groupIdOrLeft;
      const rightId = resolveAssetId(right) || right;
      candidateIds = [leftId, rightId].filter(Boolean);
    } else {
      groupId = groupIdOrLeft;
      const group = resolveDuplicateGroup(groupIdOrLeft);
      if (group) {
        candidateIds = $coerceArray(group.skillIds).map(id => resolveAssetId(id) || id).filter(Boolean);
        groupId = group.id;
      } else {
        const rid = resolveAssetId(groupIdOrLeft);
        if (rid) candidateIds = [rid];
      }
    }
    if (candidateIds.length < 2 && groupId) {
      getState().pendingTasks
        .filter(t => t.groupId === groupId && t.taskType === 'duplicate_candidate' && t.status === 'open')
        .forEach(t => { if (t.skillId && !candidateIds.includes(t.skillId)) candidateIds.push(t.skillId); });
    }
    const opened = openCompareSession(candidateIds, { groupId: groupId || context.groupId || null });
    const q = new URLSearchParams();
    if (opened.ok && opened.session) q.set('session', opened.session.id);
    if (groupId) q.set('group', groupId);
    if (candidateIds[0]) q.set('left', candidateIds[0]);
    if (candidateIds[1]) q.set('right', candidateIds[1]);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'compare.html?' + q.toString();
  }
  function openScan(context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const sid = context.scanSessionId || '';
    location.href = appendTestModeParam(sid ? ('scan.html?session=' + encodeURIComponent(sid)) : 'scan.html');
  }

  function markOnboardingComplete(decision) {
    const state = getState();
    state.initialized = true;
    state.onboardingDecision = decision;
    saveState();
    return state.onboardingDecision;
  }
  function openScanChanges(changeSetId, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), changeSetId, ...context });
    location.href = appendTestModeParam('scan-changes.html?set=' + encodeURIComponent(changeSetId));
  }
  function returnToOrigin(fallback = 'index.html') {
    const origin = getOrigin();
    clearOrigin();
    if (!origin) { location.href = fallback; return; }
    const page = origin.originPage || fallback;
    const params = new URLSearchParams();
    if (origin.originSearch != null) params.set('q', origin.originSearch);
    if (origin.originSelectedId) params.set('select', origin.originSelectedId);
    if (origin.originTab) params.set('tab', origin.originTab);
    const qs = params.toString() ? '?' + params.toString() : '';
    location.href = appendTestModeParam(page + qs);
  }

  function redirectToOnboardingIfNeeded() {
    if (typeof window === 'undefined' || typeof location === 'undefined') return false;
    if (isTestMode() || isDevNavigationBypass()) return false;
    const filename = (location.pathname.split('/').pop() || '').toLowerCase();
    const exempt = ['onboarding.html', 'cases.html'];
    if (exempt.includes(filename)) return false;
    if (filename.includes('test')) return false;
    const state = getState();
    if (!state.initialized) {
      location.replace('onboarding.html');
      return true;
    }
    return false;
  }

  /* ---------- derived insights ---------- */
  function getArchiveCandidates() {
    return getState().pendingTasks.filter(t => t.taskType === 'archive_candidate' && t.status === 'open').map(t => ({ task: normalizePendingTask(t), skill: getSkill(t.skillId) })).filter(x => x.skill && !x.skill.isUserCreated && x.skill.lifecycleStatus === 'active');
  }
  function getDuplicateGroups() {
    const map = {};
    getState().pendingTasks.filter(t => t.taskType === 'duplicate_candidate' && t.status === 'open').forEach(t => { (map[t.groupId] ||= []).push({ task: normalizePendingTask(t), skill: getSkill(t.skillId) }); });
    return Object.entries(map).map(([groupId, items]) => ({ groupId, items, meta: DUP_CONTENT[groupId] || {} })).filter(g => g.items.length > 1);
  }
  function getFileIssues() {
    return getState().pendingTasks.filter(t => ['path_missing','yaml_error','empty_content','permission_denied','name_conflict'].includes(t.taskType) && t.status === 'open').map(t => ({ task: normalizePendingTask(t), skill: getSkill(t.skillId) })).filter(x => x.skill);
  }
  function getUnfinishedDrafts() {
    return getState().pendingTasks.filter(t => t.taskType === 'unfinished_draft' && t.status === 'open').map(t => ({ task: normalizePendingTask(t), skill: getSkill(t.skillId), draft: getDraft(t.skillId) })).filter(x => x.skill);
  }
  function getTokenAttentions() {
    return getState().pendingTasks.filter(t => t.taskType === 'token_attention' && t.status === 'open').map(t => ({ task: normalizePendingTask(t), skill: getSkill(t.skillId), events: getCanonicalUsageEvents(t.skillId).slice(-7) })).filter(x => x.skill);
  }
  function getRecentMaintenance() {
    return getState().auditEvents.filter(e => ['apply_change','archive','restore_archive','restore_version','ignore','unignore'].includes(e.eventType)).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 20);
  }

  /* ---------- filters & sort ---------- */
  function filterSkills(skills, query, filters) {
    const q = (query || '').trim().toLowerCase();
    const f = filters || {};
    return skills.filter(s => {
      if (f.lifecycle && f.lifecycle.length && !$safeIncludes(f.lifecycle, s.lifecycleStatus)) return false;
      if (f.storage && f.storage.length && !$safeIncludes(f.storage, s.storageLocationId)) return false;
      if (f.host && f.host.length && !s.hostBindings.some(h => $safeIncludes(f.host, h))) return false;
      if (f.health && f.health.length && !s.healthStatuses.some(h => $safeIncludes(f.health, h))) return false;
      if (f.pending && f.pending.length) { const p = getPendingTasks(s).map(t => t.taskType); if (!f.pending.some(x => $safeIncludes(p, x))) return false; }
      if (f.category && f.category.length && !$safeIncludes(f.category, s.category)) return false;
      if (f.tags && f.tags.length && !f.tags.some(t => $safeIncludes(s.tags, t))) return false;
      if (f.fav && !s.isFavorite) return false;
      if (f.userCreated && !s.isUserCreated) return false;
      if (f.externalImport && !s.isExternalImport) return false;
      if (f.usage === 'has' && !hasUsageData(s)) return false;
      if (f.usage === 'no' && hasUsageData(s)) return false;
      if (q) {
        const blob = [s.name, s.displayName, s.description, s.absolutePath, s.relativePath, s.storageLocationId, ...s.hostBindings, s.category, ...s.tags, s.author].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  function sortSkills(skills, sort) {
    const copy = skills.slice();
    const priority = (s) => { const m = getMainStatus(s); return ['external_conflict','failed_operation'].includes(m) ? 0 : ['yaml_error','required_field_missing','empty_content','path_missing','permission_denied','name_conflict'].includes(m) ? 1 : ['archived','ignored'].includes(m) ? 2 : m === 'duplicate_candidate' ? 3 : m === 'archive_candidate' ? 4 : m === 'unfinished_draft' ? 5 : m === 'token_attention' ? 6 : 7; };
    switch (sort) {
      case 'name': return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'recent': return copy.sort((a, b) => (b.lastUsedAt || b.lastModifiedAt || '').localeCompare(a.lastUsedAt || a.lastModifiedAt || ''));
      case 'usage': return copy.sort((a, b) => (b.usage30 == null ? -1 : b.usage30) - (a.usage30 == null ? -1 : a.usage30));
      case 'edited': return copy.sort((a, b) => (b.lastModifiedAt || '').localeCompare(a.lastModifiedAt || ''));
      case 'doctoken': return copy.sort((a, b) => (b.documentTokenCount || 0) - (a.documentTokenCount || 0));
      case 'priority': return copy.sort((a, b) => priority(a) - priority(b) || (b.lastModifiedAt || '').localeCompare(a.lastModifiedAt || ''));
      default: return copy;
    }
  }

  /* ---------- mutations ---------- */
  function updateSkill(skillId, updater) {
    // Backward-compatible mutation: updater receives a v2-shaped view model,
    // then allowed fields are written back to v3 raw entities.
    const asset = getAssetRaw(skillId);
    if (!asset) return null;
    const skill = deriveV2Skill(skillId);
    if (!skill) return null;
    updater(skill);

    asset.updatedAt = $now();
    if (skill.displayName != null) asset.displayName = skill.displayName;
    if (skill.description != null) asset.description = skill.description;
    if (skill.isFavorite != null) asset.isFavorite = skill.isFavorite;

    const primary = getState().instances.find(i => i.skillId === skillId && i.isPrimary);
    const file = primary ? getState().files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md') : null;
    if (primary) {
      primary.lastSeenAt = $now();
      if (skill.content != null && file) {
        file.content = skill.content;
        file.contentHash = $hash(skill.content);
        file.modifiedAt = $now();
        file.sizeBytes = (skill.content || '').length;
        file.tokenCount = $tokenApprox(skill.content);
        file.tokenCountMode = 'estimated';
        primary.contentHash = file.contentHash;
        primary.packageSizeBytes = file.sizeBytes;
      }
    }
    saveState();
    return getSkill(skillId);
  }

  function createSnapshot(skillId, content, note = '') {
    // Legacy signature retained for old callers; permission-gated File Snapshot only.
    const rid = resolveAssetId(skillId);
    if (!rid) return null;
    const primary = getState().instances.find(i => i.skillId === rid && i.isPrimary)
      || getState().instances.find(i => i.skillId === rid);
    if (!primary) return null;
    const file = getFilesRawInternal({ instanceId: primary.id }).find(f => f.relativePath === 'SKILL.md');
    if (!file) return null;
    const perm = getInstancePermission(primary.id);
    if (!perm || !perm.readAccess) return null;
    // If explicit content provided and writable, temporarily use it only for snapshot capture via controlled path
    if (content != null && perm.writeAccess && perm.contentAccessStatus === 'readable') {
      const snap = normalizeSnapshot({
        id: uuid(),
        skillId: rid,
        instanceId: primary.id,
        type: 'file',
        createdAt: $now(),
        note: note || '文件快照',
        source: 'manual',
        files: [{
          relativePath: 'SKILL.md',
          fileType: 'text',
          mimeType: 'text/markdown',
          sizeBytes: String(content).length,
          contentHash: $hash(content),
          content: String(content),
          modifiedAt: $now(),
          indexStatus: 'indexed',
          contentCaptureStatus: 'full'
        }],
        contentCaptureStatus: 'full',
        capturedFileCount: 1,
        metadataOnlyFileCount: 0
      });
      getState().snapshots.push(snap);
      saveState();
      return toSnapshotSummary(snap);
    }
    const res = createFileSnapshot({ fileId: file.id, note: note || '文件快照', source: 'manual' });
    return res.ok ? res.snapshot : null;
  }

  function addAuditEvent(event) {
    const e = normalizeAuditEvent({ id: uuid(), time: $now(), ...event });
    getState().auditEvents.push(e);
    saveState();
    return e;
  }
  function addUsageEvent(event) {
    const e = normalizeUsageEvent({ id: uuid(), occurredAt: $now(), ...event });
    getState().usageEvents.push(e);
    const asset = getState().assets.find(a => a.id === e.skillId);
    if (asset) asset.updatedAt = $now();
    saveState();
    return e;
  }

  /* ---------- scan engine ---------- */
  // Deterministic simulated scan steps used by both live scan and seed scenario.
  const SCAN_STEP_INTERVAL_MS = 400;
  let _scanTimer = null;

  function buildScanSteps() {
    // A fixed set of simulated discoveries across hosts.
    // These map onto existing seed skills or introduce new candidate skills.
    return [
      { hostType: 'claude-code', path: '~/.claude/skills/pr-review/SKILL.md', skillName: 'pr-review', status: 'unchanged', existingName: 'pr-review', reason: '路径、内容与哈希均未变化' },
      { hostType: 'claude-code', path: '~/.claude/skills/sql-audit/SKILL.md', skillName: 'sql-audit', status: 'content-changed', existingName: 'sql-audit', reason: 'frontmatter 版本从 1.1.0 变为 1.2.0', newVersion: '1.2.0' },
      { hostType: 'claude-code', path: '~/.claude/skills/release-notes/SKILL.md', skillName: 'release-notes', status: 'path-changed', existingName: 'release-notes', oldPath: '~/.codex/skills/release-notes/SKILL.md', reason: '实例从 Codex 目录迁移到 Claude Code 目录' },
      { hostType: 'claude-code', path: '~/.claude/skills/api-doc/SKILL.md', skillName: 'api-doc', status: 'update-available', existingName: 'api-doc', reason: '来源绑定检测到可用更新', remoteVersion: '1.2.0', remoteCommit: 'a1b2c3d' },
      { hostType: 'claude-code', path: '~/.claude/skills/prompt-lint/SKILL.md', skillName: 'prompt-lint', status: 'duplicate', existingName: 'prompt-lint', pairedName: 'prompt-check', reason: '与 prompt-check 名称与内容相似' },
      { hostType: 'codex', path: '~/.codex/skills/prompt-check/SKILL.md', skillName: 'prompt-check', status: 'duplicate', existingName: 'prompt-check', pairedName: 'prompt-lint', reason: '与 prompt-lint 名称与内容相似' },
      { hostType: 'custom', path: '~/Projects/skills/new-local-skill/SKILL.md', skillName: 'new-local-skill', status: 'added', reason: '新发现 SKILL.md' },
      { hostType: 'custom', path: '~/Projects/skills/demo-draft/SKILL.md', skillName: 'demo-draft', status: 'path-changed', existingName: 'demo-draft', oldPath: '~/.claude/skills/demo-draft/SKILL.md', reason: '实例从 Claude Code 目录迁移到自定义目录' },
      { hostType: 'claude-code', path: '~/.claude/skills/demo-path-missing/SKILL.md', skillName: 'demo-path-missing', status: 'missing', existingName: 'demo-path-missing', reason: '上次扫描路径本次未找到文件' },
      { hostType: 'claude-code', path: '~/.claude/skills/demo-yaml-error/SKILL.md', skillName: 'demo-yaml-error', status: 'health-changed', existingName: 'demo-yaml-error', reason: 'frontmatter 解析失败' },
      { hostType: 'custom', path: '~/Projects/skills/demo-duplicate-a/SKILL.md', skillName: 'demo-duplicate-a', status: 'instance-changed', existingName: 'demo-duplicate-a', reason: '新增第二个实例（自定义目录）' },
      { hostType: 'custom', path: '~/Projects/skills/pr-review-rebind/SKILL.md', skillName: 'pr-review-rebind', status: 'rebind-candidate', existingName: 'pr-review', reason: '内容与 pr-review 高度相似，可重新绑定' },
      { hostType: 'archive', path: '~/Library/Application Support/Skill Panel/Archive/deprecated-skill/SKILL.md', skillName: 'deprecated-skill', status: 'file-deleted', existingName: 'demo-archived', reason: '归档目录中的旧 Skill 文件已被删除' },
      { hostType: 'claude-code', path: '~/restricted/system-skills/SKILL.md', skillName: 'system-skills', status: 'failure', reason: '无读取权限' }
    ];
  }

  function createScanSession(scanType = 'first-full', hostIds = null) {
    const state = getState();
    const hostsToScan = hostIds ? state.hosts.filter(h => hostIds.includes(h.id)) : state.hosts.filter(h => h.enabled && h.id !== 'archive');
    const session = normalizeScanSession({
      id: uuid(),
      scanType,
      status: 'idle',
      startedAt: $now(),
      currentPath: '',
      visitedDirectoryCount: 0,
      discoveredCount: 0,
      failureCount: 0,
      failures: [],
      steps: buildScanSteps(),
      currentStep: 0,
      hostIds: hostsToScan.map(h => h.id)
    });
    state.scanSessions.push(session);
    saveState();
    return session;
  }

  function getActiveScanSession() {
    const state = getState();
    return state.scanSessions.find(s => ['idle', 'scanning', 'paused'].includes(s.status)) || null;
  }

  function getScanDiscoveries(scanSessionId) {
    return getState().scanDiscoveries.filter(d => d.scanSessionId === scanSessionId).map(d => normalizeScanDiscovery(d));
  }

  function _scanTick(sessionId) {
    const state = getState();
    const session = state.scanSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'scanning') return false;
    if (session.currentStep >= session.steps.length) {
      _finishScanSession(session);
      return false;
    }
    const step = session.steps[session.currentStep];
    session.currentStep += 1;
    session.visitedDirectoryCount += 1;
    session.currentPath = step.path;

    if (step.status === 'failure') {
      session.failureCount += 1;
      session.failures.push({ path: step.path, reason: step.reason, time: $now() });
      addAuditEvent({ eventType: 'scan_directory_failed', category: 'system', source: 'Skill Panel', result: 'failed', note: `${step.path}: ${step.reason}` });
    } else {
      session.discoveredCount += 1;
      const discovery = _buildDiscovery(session, step);
      state.scanDiscoveries.push(discovery);
    }
    saveState();
    return true;
  }

  function _buildDiscovery(session, step) {
    const state = getState();
    const existingAsset = step.existingName ? state.assets.find(a => a.name === step.existingName) : null;
    const existingInstance = existingAsset ? state.instances.find(i => i.skillId === existingAsset.id && i.isPrimary) : null;
    const host = state.hosts.find(h => h.hostType === step.hostType) || state.hosts[0];
    const content = _buildSimulatedSkillMd(step.skillName, step.status, step.newVersion);
    const contentHash = $hash(content);
    const files = [{ relativePath: 'SKILL.md', sizeBytes: content.length, contentHash, fileType: 'text' }];
    const evidence = { reason: step.reason };
    if (existingAsset) {
      evidence.matchType = step.status === 'added' ? 'new' : 'existing';
      evidence.existingSkillId = existingAsset.id;
      evidence.existingInstanceId = existingInstance ? existingInstance.id : null;
      evidence.existingSkillName = existingAsset.name;
      evidence.existingPath = existingInstance ? existingInstance.skillFilePath : null;
      evidence.similarity = (step.status === 'duplicate' || step.status === 'rebind-candidate') ? 0.88 : null;
      evidence.pairedSkillId = step.pairedName ? (state.assets.find(a => a.name === step.pairedName)?.id || null) : null;
      evidence.oldPath = step.oldPath || (existingInstance ? existingInstance.skillFilePath : null);
      evidence.remoteVersion = step.remoteVersion || null;
      evidence.remoteCommit = step.remoteCommit || null;
    }
    const healthIssues = [];
    if (step.status === 'missing') healthIssues.push('path-missing');
    if (step.status === 'health-changed') healthIssues.push('yaml-error');
    if (step.status === 'failure') healthIssues.push('permission-denied');
    return normalizeScanDiscovery({
      id: uuid(),
      scanSessionId: session.id,
      candidateSkillId: existingAsset ? existingAsset.id : null,
      path: step.path,
      hostType: step.hostType,
      skillName: step.skillName,
      skillFileContent: content,
      files,
      fileCount: files.length,
      packageSizeBytes: content.length,
      evidence,
      permissionStatus: step.status === 'failure' ? 'denied' : 'granted',
      healthIssues,
      status: step.status,
      isNew: !existingAsset && step.status !== 'failure',
      isDuplicate: step.status === 'duplicate'
    });
  }

  function _buildSimulatedSkillMd(name, status, newVersion) {
    const version = newVersion || '0.1.0';
    return `---\nname: ${name}\nversion: ${version}\ncategory: 工程\ntags: scan\nauthor: scan\n---\n# ${name}\n\n${status === 'health-changed' ? '---\nmalformed: [\n' : `扫描阶段 B 模拟内容：${status}。`}\n`;
  }

  function _finishScanSession(session) {
    const hasFailures = session.failureCount > 0;
    session.status = hasFailures ? 'partial-failure' : 'completed-pending-confirmation';
    session.finishedAt = $now();
    addAuditEvent({ eventType: 'scan', category: 'system', source: 'Skill Panel', result: hasFailures ? 'partial' : 'completed', note: `发现 ${session.discoveredCount} · 失败 ${session.failureCount}` });
    createChangeSet(session.id);
    saveState();
  }

  function startScan(scanType = 'first-full', hostIds = null) {
    let session = getActiveScanSession();
    if (!session) session = createScanSession(scanType, hostIds);
    if (session.status !== 'idle' && session.status !== 'paused') return session;
    session.status = 'scanning';
    session.startedAt = $now();
    saveState();
    addAuditEvent({ eventType: 'scan_started', category: 'system', source: 'Skill Panel', result: 'completed', note: `类型：${scanType}` });
    _runScanTimer(session.id);
    return session;
  }

  function _runScanTimer(sessionId) {
    if (_scanTimer) clearInterval(_scanTimer);
    _scanTimer = setInterval(() => {
      const state = getState();
      const session = state.scanSessions.find(s => s.id === sessionId);
      if (!session || session.status !== 'scanning') { clearInterval(_scanTimer); _scanTimer = null; return; }
      const more = _scanTick(sessionId);
      if (!more) { clearInterval(_scanTimer); _scanTimer = null; }
    }, SCAN_STEP_INTERVAL_MS);
  }

  function pauseScan(sessionId) {
    const session = getState().scanSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'scanning') return null;
    session.status = 'paused';
    session.pausedAt = $now();
    if (_scanTimer) { clearInterval(_scanTimer); _scanTimer = null; }
    addAuditEvent({ eventType: 'scan_paused', category: 'system', source: 'Skill Panel', result: 'completed', note: `进度 ${session.currentStep}/${session.steps.length}` });
    saveState();
    return normalizeScanSession(session);
  }

  function resumeScan(sessionId) {
    const session = getState().scanSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'paused') return null;
    session.status = 'scanning';
    addAuditEvent({ eventType: 'scan_resumed', category: 'system', source: 'Skill Panel', result: 'completed', note: `进度 ${session.currentStep}/${session.steps.length}` });
    saveState();
    _runScanTimer(sessionId);
    return normalizeScanSession(session);
  }

  function cancelScan(sessionId) {
    const session = getState().scanSessions.find(s => s.id === sessionId);
    if (!session || !['idle', 'scanning', 'paused'].includes(session.status)) return null;
    session.status = 'cancelled';
    session.cancelledAt = $now();
    if (_scanTimer) { clearInterval(_scanTimer); _scanTimer = null; }
    addAuditEvent({ eventType: 'scan_cancelled', category: 'system', source: 'Skill Panel', result: 'completed', note: `已处理 ${session.currentStep}/${session.steps.length}` });
    saveState();
    return normalizeScanSession(session);
  }

  function scanTick(sessionId) { return _scanTick(sessionId); }

  // Backwards-compatible status helpers (now based on active session)
  function getScanStatus() {
    const session = getActiveScanSession();
    return session ? session.status : (getState().scanSessions.length ? 'completed' : null);
  }
  function getScanResult() {
    const session = getState().scanSessions[getState().scanSessions.length - 1];
    return session ? { discovered: session.discoveredCount, failed: session.failureCount, status: session.status } : null;
  }

  /* ---------- change set engine ---------- */
  function createChangeSet(scanSessionId, opts = {}) {
    const state = getState();
    const session = state.scanSessions.find(s => s.id === scanSessionId);
    if (!session) return null;
    const discoveries = state.scanDiscoveries.filter(d => d.scanSessionId === scanSessionId);
    const changeSet = normalizeChangeSet({ id: uuid(), scanSessionId, status: 'pending', source: opts.source || '' });
    state.changeSets.push(changeSet);

    const summary = { added: 0, changed: 0, missing: 0, failed: 0, unchanged: 0, duplicate: 0 };
    discoveries.forEach(d => {
      const item = _discoveryToChangeItem(changeSet.id, d);
      if (item) {
        state.changeItems.push(item);
        if (item.changeType === 'added') summary.added++;
        else if (item.changeType === 'missing') summary.missing++;
        else if (item.changeType === 'file-deleted') summary.changed++;
        else if (item.changeType === 'duplicate-changed') summary.duplicate++;
        else if (item.changeType === 'unchanged') summary.unchanged++;
        else summary.changed++;
      }
    });
    session.failures.forEach(() => summary.failed++);
    changeSet.summary = summary;
    const sourceNote = changeSet.source ? ` · 来源：${changeSet.source}` : '';
    addAuditEvent({ eventType: 'change_set_created', category: 'system', source: 'Skill Panel', result: 'completed', note: `新增 ${summary.added} · 更新 ${summary.changed} · Missing ${summary.missing} · 失败 ${summary.failed}${sourceNote}` });
    saveState();
    return changeSet;
  }

  function _discoveryToChangeItem(changeSetId, discovery) {
    const state = getState();
    const ev = discovery.evidence || {};
    const existingAsset = discovery.candidateSkillId ? state.assets.find(a => a.id === discovery.candidateSkillId) : null;
    const existingInstance = existingAsset ? state.instances.find(i => i.skillId === existingAsset.id && i.isPrimary) : null;

    let changeType = 'added';
    if (discovery.status === 'failure') return null; // failures are tracked on session.failures
    // Status-driven classifications take precedence over secondary evidence like oldPath.
    if (!existingAsset) changeType = 'added';
    else if (discovery.isDuplicate) changeType = 'duplicate-changed';
    else if (discovery.status === 'rebind-candidate') changeType = 'rebind-candidate';
    else if (discovery.status === 'update-available') changeType = 'update-available';
    else if (discovery.healthIssues.includes('path-missing')) changeType = 'missing';
    else if (discovery.healthIssues.includes('yaml-error')) changeType = 'health-changed';
    else if (discovery.status === 'file-deleted') changeType = 'file-deleted';
    else if (discovery.status === 'instance-changed') changeType = 'instance-changed';
    else if (ev.oldPath && ev.oldPath !== discovery.path) changeType = 'path-changed';
    else if (discovery.status === 'content-changed') changeType = 'content-changed';
    else if (discovery.status === 'unchanged') changeType = 'unchanged';

    const fileDiffs = [];
    if (existingInstance) {
      const existingFile = state.files.find(f => f.instanceId === existingInstance.id && f.relativePath === 'SKILL.md');
      if (existingFile) {
        const isContentChange = changeType === 'content-changed';
        fileDiffs.push({
          relativePath: 'SKILL.md',
          beforeHash: existingFile.contentHash,
          afterHash: discovery.files.find(f => f.relativePath === 'SKILL.md')?.contentHash || '',
          beforeSize: existingFile.sizeBytes,
          afterSize: discovery.files.find(f => f.relativePath === 'SKILL.md')?.sizeBytes || 0,
          changeType: isContentChange ? 'modified' : (changeType === 'missing' ? 'deleted' : 'unchanged')
        });
      }
    }

    const summary = _changeSummary(changeType, discovery, existingAsset, existingInstance);

    return normalizeChangeItem({
      id: uuid(),
      changeSetId,
      changeType,
      skillId: existingAsset ? existingAsset.id : null,
      discoveryId: discovery.id,
      instanceId: existingInstance ? existingInstance.id : null,
      path: discovery.path,
      summary,
      evidence: { ...ev, hostType: discovery.hostType },
      fileDiffs,
      permissionStatus: discovery.permissionStatus,
      healthIssues: discovery.healthIssues
    });
  }

  function _changeSummary(changeType, discovery, existingAsset, existingInstance) {
    const name = discovery.skillName;
    switch (changeType) {
      case 'added': return `新发现 ${name}`;
      case 'content-changed': return `${name} 内容已变化`;
      case 'path-changed': return `${name} 路径从 ${discovery.evidence?.oldPath || '旧路径'} 变为 ${discovery.path}`;
      case 'missing': return `${name} 在主路径未找到`;
      case 'file-deleted': return `${name} 归档文件已删除`;
      case 'health-changed': return `${name} 健康状态变化`;
      case 'duplicate-changed': return `${name} 疑似重复`;
      case 'instance-changed': return `${name} 新增实例`;
      case 'rebind-candidate': return `${name} 可重新绑定到已有 Skill`;
      case 'update-available': return `${name} 来源存在可用更新`;
      default: return `${name} 无变化`;
    }
  }

  function getChangeItems(changeSetId) {
    return getState().changeItems.filter(i => i.changeSetId === changeSetId).map(i => normalizeChangeItem(i));
  }

  function getPendingChangeSetCount() {
    return getState().changeSets.filter(c => c.status === 'pending').length;
  }

  function acceptChangeItem(itemId) {
    const item = getState().changeItems.find(i => i.id === itemId);
    if (!item || item.status !== 'pending') return null;
    item.status = 'accepted';
    item.confirmedAt = $now();
    addAuditEvent({ eventType: 'change_item_accepted', category: 'system', source: 'Skill Panel', result: 'completed', note: item.summary, skillId: item.skillId });
    saveState();
    return normalizeChangeItem(item);
  }

  function ignoreChangeItem(itemId) {
    const item = getState().changeItems.find(i => i.id === itemId);
    if (!item || item.status !== 'pending') return null;
    item.status = 'ignored';
    item.confirmedAt = $now();
    addAuditEvent({ eventType: 'change_item_ignored', category: 'system', source: 'Skill Panel', result: 'completed', note: item.summary, skillId: item.skillId });
    saveState();
    return normalizeChangeItem(item);
  }

  function deferChangeItem(itemId) {
    const item = getState().changeItems.find(i => i.id === itemId);
    if (!item || item.status !== 'pending') return null;
    item.status = 'deferred';
    item.confirmedAt = $now();
    saveState();
    return normalizeChangeItem(item);
  }

  function _cloneForCheckpoint(arr) {
    return JSON.parse(JSON.stringify(arr || []));
  }

  function _createBatchCheckpoint(changeSet, items) {
    const state = getState();
    const affectedSkillIds = new Set(items.map(i => i.skillId).filter(Boolean));
    const assetFilter = a => affectedSkillIds.has(a.id);
    const instanceFilter = i => affectedSkillIds.has(i.skillId);
    const fileFilter = f => affectedSkillIds.has(f.skillId);
    // Include all potentially affected entity types so restore can fully revert.
    return normalizeSnapshot({
      id: uuid(),
      skillId: null,
      instanceId: null,
      type: 'batch',
      createdAt: $now(),
      note: `ChangeSet ${changeSet.id} 应用前检查点`,
      source: 'scan-apply',
      files: [],
      retained: true,
      checkpointData: {
        assets: _cloneForCheckpoint(state.assets.filter(assetFilter)),
        instances: _cloneForCheckpoint(state.instances.filter(instanceFilter)),
        files: _cloneForCheckpoint(state.files.filter(fileFilter)),
        duplicateGroups: _cloneForCheckpoint(state.duplicateGroups),
        sourceBindings: _cloneForCheckpoint(state.sourceBindings)
      }
    });
  }

  function applyChangeSet(changeSetId) {
    const state = getState();
    const changeSet = state.changeSets.find(c => c.id === changeSetId);
    if (!changeSet || changeSet.status !== 'pending') return { ok: false, error: 'Change set not found or already applied' };
    const items = state.changeItems.filter(i => i.changeSetId === changeSetId && i.status === 'accepted');

    // Formal Index checkpoint before applying
    const checkpoint = _createBatchCheckpoint(changeSet, items);
    state.snapshots.push(checkpoint);
    changeSet.checkpointId = checkpoint.id;

    const results = [];
    items.forEach(item => {
      const res = _applyChangeItem(item);
      results.push({ itemId: item.id, changeType: item.changeType, ok: res.ok, error: res.error, createdIds: res.createdIds || [] });
      addAuditEvent({ eventType: 'change_item_applied', category: 'system', source: 'Skill Panel', result: res.ok ? 'completed' : 'failed', note: `${item.summary}${res.error ? ' · ' + res.error : ''}`, skillId: item.skillId });
    });

    const allOk = results.every(r => r.ok);
    changeSet.status = allOk ? 'applied' : 'partial-failure';
    changeSet.appliedAt = $now();
    changeSet.results = results;
    addAuditEvent({ eventType: 'change_set_applied', category: 'system', source: 'Skill Panel', result: allOk ? 'completed' : 'partial', note: `接受 ${items.length} 项 · 成功 ${results.filter(r => r.ok).length} · 失败 ${results.filter(r => !r.ok).length}` });

    // Mark onboarding complete when the user applies scan changes.
    // initialized may already be true (set when first scan started so Library stays usable).
    state.initialized = true;
    if (state.onboardingDecision !== 'skip') {
      state.onboardingDecision = 'scan-applied';
    }

    saveState();
    return { ok: allOk, results, changeSet: normalizeChangeSet(changeSet) };
  }

  function _applyChangeItem(item) {
    const state = getState();
    const discovery = state.scanDiscoveries.find(d => d.id === item.discoveryId);
    if (!discovery) return { ok: false, error: 'Discovery missing' };
    if (discovery.skillFileContent == null) return { ok: false, error: 'Discovery content missing' };
    const existingAsset = item.skillId ? state.assets.find(a => a.id === item.skillId) : null;
    const existingInstance = existingAsset ? state.instances.find(i => i.skillId === existingAsset.id && i.skillFilePath === discovery.path) : null;
    const primaryInstance = existingAsset ? state.instances.find(i => i.skillId === existingAsset.id && i.isPrimary) : null;

    try {
      switch (item.changeType) {
        case 'added': {
          const assetId = uuid();
          const instanceId = uuid();
          const fileId = uuid();
          const now = $now();
          state.assets.push(normalizeAsset({
            id: assetId, name: discovery.skillName, displayName: discovery.skillName,
            description: '', categoryIds: [], tagIds: [], lifecycleStatus: 'available',
            primaryInstanceId: instanceId, supportedHosts: [discovery.hostType],
            createdAt: now, updatedAt: now
          }));
          state.instances.push(normalizeInstance({
            id: instanceId, skillId: assetId, hostType: discovery.hostType,
            rootPath: discovery.path.replace(/\/SKILL\.md$/, ''),
            skillFilePath: discovery.path,
            lifecycleStatus: 'available', permissionMode: 'managed', installedVersion: '0.1.0',
            healthStatuses: ['normal'], isPrimary: true, lastSeenAt: now,
            contentHash: discovery.files[0]?.contentHash || '', fileCount: discovery.fileCount,
            packageSizeBytes: discovery.packageSizeBytes
          }));
          state.files.push(normalizeFile({
            id: fileId, instanceId, skillId: assetId, relativePath: 'SKILL.md',
            fileType: 'text', mimeType: 'text/markdown',
            sizeBytes: discovery.files[0]?.sizeBytes || 0,
            content: discovery.skillFileContent,
            contentHash: discovery.files[0]?.contentHash || '',
            modifiedAt: now, tokenCount: $tokenApprox(discovery.skillFileContent),
            tokenCountMode: 'estimated'
          }));
          return { ok: true, createdIds: [assetId, instanceId, fileId] };
        }
        case 'rebind-candidate': {
          if (!existingAsset) return { ok: false, error: 'Asset not found' };
          const now = $now();
          // If the matched instance is missing, update its path to the new discovery;
          // otherwise add a new secondary instance so the original path remains valid.
          const matchedOldInstance = primaryInstance;
          const targetInstance = (matchedOldInstance && matchedOldInstance.lifecycleStatus === 'missing')
            ? matchedOldInstance
            : null;
          if (targetInstance) {
            targetInstance.skillFilePath = discovery.path;
            targetInstance.rootPath = discovery.path.replace(/\/SKILL\.md$/, '');
            targetInstance.hostType = discovery.hostType;
            targetInstance.lifecycleStatus = 'available';
            targetInstance.lastSeenAt = now;
            targetInstance.contentHash = discovery.files[0]?.contentHash || '';
            targetInstance.packageSizeBytes = discovery.packageSizeBytes;
            const file = state.files.find(f => f.instanceId === targetInstance.id && f.relativePath === 'SKILL.md');
            if (file) {
              file.content = discovery.skillFileContent;
              file.contentHash = discovery.files[0]?.contentHash || file.contentHash;
              file.sizeBytes = discovery.files[0]?.sizeBytes || file.sizeBytes;
              file.modifiedAt = now;
              file.tokenCount = $tokenApprox(discovery.skillFileContent);
            }
            existingAsset.updatedAt = now;
            return { ok: true, createdIds: [] };
          } else {
            const instanceId = uuid();
            const fileId = uuid();
            state.instances.push(normalizeInstance({
              id: instanceId, skillId: existingAsset.id, hostType: discovery.hostType,
              rootPath: discovery.path.replace(/\/SKILL\.md$/, ''),
              skillFilePath: discovery.path,
              lifecycleStatus: 'available', permissionMode: 'managed', installedVersion: primaryInstance?.installedVersion || '0.1.0',
              healthStatuses: ['normal'], isPrimary: false, lastSeenAt: now,
              contentHash: discovery.files[0]?.contentHash || '', fileCount: discovery.fileCount,
              packageSizeBytes: discovery.packageSizeBytes
            }));
            state.files.push(normalizeFile({
              id: fileId, instanceId, skillId: existingAsset.id, relativePath: 'SKILL.md',
              fileType: 'text', mimeType: 'text/markdown',
              sizeBytes: discovery.files[0]?.sizeBytes || 0,
              content: discovery.skillFileContent,
              contentHash: discovery.files[0]?.contentHash || '',
              modifiedAt: now, tokenCount: $tokenApprox(discovery.skillFileContent),
              tokenCountMode: 'estimated'
            }));
            existingAsset.updatedAt = now;
            return { ok: true, createdIds: [instanceId, fileId] };
          }
        }
        case 'update-available': {
          if (!existingAsset) return { ok: false, error: 'Asset not found' };
          const ev = discovery.evidence || {};
          const binding = state.sourceBindings.find(b => b.skillId === existingAsset.id);
          const now = $now();
          if (binding) {
            binding.updateStatus = 'available';
            binding.lastCheckedAt = now;
            if (ev.remoteVersion) binding.remoteVersion = ev.remoteVersion;
            if (ev.remoteCommit) binding.remoteCommit = ev.remoteCommit;
          }
          const existingTask = state.pendingTasks.find(t => t.skillId === existingAsset.id && t.taskType === 'update_available');
          if (!existingTask) {
            state.pendingTasks.push(normalizePendingTask({
              id: uuid(), skillId: existingAsset.id, taskType: 'update_available', priority: 'normal',
              reasonCodes: ['update_available'], dataWindow: 'all', confidence: 'high'
            }));
          }
          existingAsset.updatedAt = now;
          return { ok: true, createdIds: [] };
        }
        case 'content-changed':
        case 'health-changed': {
          if (!existingInstance) return { ok: false, error: 'Instance not found' };
          const file = state.files.find(f => f.instanceId === existingInstance.id && f.relativePath === 'SKILL.md');
          if (file) {
            file.content = discovery.skillFileContent;
            file.contentHash = discovery.files[0]?.contentHash || file.contentHash;
            file.sizeBytes = discovery.files[0]?.sizeBytes || file.sizeBytes;
            file.modifiedAt = $now();
            file.tokenCount = $tokenApprox(discovery.skillFileContent);
          }
          existingInstance.contentHash = discovery.files[0]?.contentHash || existingInstance.contentHash;
          existingInstance.packageSizeBytes = discovery.packageSizeBytes;
          existingInstance.healthStatuses = discovery.healthIssues.length ? discovery.healthIssues : ['normal'];
          existingInstance.lifecycleStatus = 'available';
          if (existingAsset) existingAsset.updatedAt = $now();
          break;
        }
        case 'path-changed': {
          const oldPath = item.evidence?.oldPath || discovery.evidence?.oldPath;
          const targetInstance = oldPath
            ? state.instances.find(i => i.skillId === existingAsset.id && i.skillFilePath === oldPath)
            : existingInstance;
          if (!targetInstance) return { ok: false, error: 'Instance not found' };
          targetInstance.skillFilePath = discovery.path;
          targetInstance.rootPath = discovery.path.replace(/\/SKILL\.md$/, '');
          targetInstance.hostType = discovery.hostType;
          targetInstance.lastSeenAt = $now();
          if (existingAsset) existingAsset.updatedAt = $now();
          break;
        }
        case 'missing': {
          if (!existingInstance) return { ok: false, error: 'Instance not found' };
          existingInstance.lifecycleStatus = 'missing';
          existingInstance.missingSince = $now();
          _reconcileAssetLifecycle(existingAsset);
          break;
        }
        case 'file-deleted': {
          if (!existingInstance) return { ok: false, error: 'Instance not found' };
          existingInstance.lifecycleStatus = 'missing';
          existingInstance.missingSince = $now();
          _reconcileAssetLifecycle(existingAsset);
          break;
        }
        case 'instance-changed': {
          // New secondary instance for existing asset
          if (!existingAsset) return { ok: false, error: 'Asset not found' };
          const instanceId = uuid();
          const fileId = uuid();
          const now = $now();
          state.instances.push(normalizeInstance({
            id: instanceId, skillId: existingAsset.id, hostType: discovery.hostType,
            rootPath: discovery.path.replace(/\/SKILL\.md$/, ''),
            skillFilePath: discovery.path,
            lifecycleStatus: 'available', permissionMode: 'managed', installedVersion: primaryInstance?.installedVersion || '0.1.0',
            healthStatuses: ['normal'], isPrimary: false, lastSeenAt: now,
            contentHash: discovery.files[0]?.contentHash || '', fileCount: discovery.fileCount,
            packageSizeBytes: discovery.packageSizeBytes
          }));
          state.files.push(normalizeFile({
            id: fileId, instanceId, skillId: existingAsset.id, relativePath: 'SKILL.md',
            fileType: 'text', mimeType: 'text/markdown',
            sizeBytes: discovery.files[0]?.sizeBytes || 0,
            content: discovery.skillFileContent,
            contentHash: discovery.files[0]?.contentHash || '',
            modifiedAt: now, tokenCount: $tokenApprox(discovery.skillFileContent),
            tokenCountMode: 'estimated'
          }));
          if (existingAsset) existingAsset.updatedAt = $now();
          return { ok: true, createdIds: [instanceId, fileId] };
        }
        case 'duplicate-changed': {
          // Ensure duplicate group exists
          if (!existingAsset) return { ok: false, error: 'Asset not found' };
          const pairedId = item.evidence?.pairedSkillId;
          let group = state.duplicateGroups.find(g => g.skillIds.includes(existingAsset.id) || (pairedId && g.skillIds.includes(pairedId)));
          if (!group) {
            group = normalizeDuplicateGroup({ id: uuid(), name: 'SCAN-DUP', skillIds: [existingAsset.id], evidence: item.evidence, confidence: 'medium', status: 'open' });
            if (pairedId) group.skillIds.push(pairedId);
            state.duplicateGroups.push(group);
          }
          if (!group.skillIds.includes(existingAsset.id)) group.skillIds.push(existingAsset.id);
          state.pendingTasks.push(normalizePendingTask({
            id: uuid(), skillId: existingAsset.id, taskType: 'duplicate_candidate', priority: 'normal',
            reasonCodes: ['similar_name_content'], dataWindow: 'all', confidence: 'medium', groupId: group.id
          }));
          break;
        }
        case 'unchanged':
          // No formal changes
          break;
        default:
          return { ok: false, error: 'Unsupported change type' };
      }
      return { ok: true, createdIds: [] };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function _reconcileAssetLifecycle(asset) {
    if (!asset) return;
    const instances = getState().instances.filter(i => i.skillId === asset.id);
    const allMissing = instances.length > 0 && instances.every(i => i.lifecycleStatus === 'missing');
    if (allMissing) asset.lifecycleStatus = 'missing';
    else asset.lifecycleStatus = 'available';
    asset.updatedAt = $now();
  }
  function reconcileAssetLifecycle(assetId) {
    const asset = getAssetRaw(assetId);
    if (asset) _reconcileAssetLifecycle(asset);
    saveState();
  }

  function restoreChangeSetCheckpoint(changeSetId) {
    const state = getState();
    const changeSet = state.changeSets.find(c => c.id === changeSetId);
    if (!changeSet || !changeSet.checkpointId) return { ok: false, error: 'Change set has no checkpoint' };
    const checkpoint = state.snapshots.find(s => s.id === changeSet.checkpointId);
    if (!checkpoint || !checkpoint.checkpointData) return { ok: false, error: 'Checkpoint snapshot missing' };

    const data = checkpoint.checkpointData;
    const createdIds = new Set();
    (changeSet.results || []).forEach(r => (r.createdIds || []).forEach(id => createdIds.add(id)));

    const replaceById = (current, normalizedCopy, idsToRemove) => {
      const byId = new Map(normalizedCopy.map(x => [x.id, x]));
      const next = [];
      current.forEach(x => {
        if (idsToRemove.has(x.id)) return;
        if (byId.has(x.id)) {
          next.push(normalizedCopy.find(c => c.id === x.id));
        } else {
          next.push(x);
        }
      });
      return next;
    };

    state.assets = replaceById(state.assets, data.assets.map(a => normalizeAsset(a)), createdIds);
    state.instances = replaceById(state.instances, data.instances.map(i => normalizeInstance(i)), createdIds);
    state.files = replaceById(state.files, data.files.map(f => normalizeFile(f)), createdIds);
    state.duplicateGroups = replaceById(state.duplicateGroups, data.duplicateGroups.map(g => normalizeDuplicateGroup(g)), createdIds);
    state.sourceBindings = replaceById(state.sourceBindings, data.sourceBindings.map(b => normalizeSourceBinding(b)), createdIds);

    addAuditEvent({ eventType: 'change_set_restored', category: 'system', source: 'Skill Panel', result: 'completed', note: `从检查点 ${changeSet.checkpointId} 恢复 Formal Index` });
    saveState();
    return { ok: true };
  }

  function convertRebindToAdd(itemId) {
    const state = getState();
    const item = state.changeItems.find(i => i.id === itemId);
    if (!item || item.changeType !== 'rebind-candidate' || item.status !== 'pending') return null;
    item.changeType = 'added';
    item.skillId = null;
    item.instanceId = null;
    item.summary = `新发现 ${item.path.split('/').pop().replace(/\.md$/i, '') || 'Skill'}`;
    item.fileDiffs = [];
    saveState();
    return normalizeChangeItem(item);
  }

  function resolveTask(taskId) {
    const t = getState().pendingTasks.find(x => x.id === taskId);
    if (t) { t.status = 'resolved'; t.resolvedAt = $now(); }
    saveState();
  }
  function resolveSkillTasks(skillId, ...types) {
    getState().pendingTasks.filter(t => t.skillId === skillId && types.includes(t.taskType)).forEach(t => { t.status = 'resolved'; t.resolvedAt = $now(); });
    saveState();
  }
  function createPendingTask(opts) {
    const t = normalizePendingTask({ id: uuid(), ...opts });
    getState().pendingTasks.push(t);
    saveState();
    return t;
  }

  function createIgnoreRule(opts) {
    const r = normalizeIgnoreRule({ id: uuid(), ...opts });
    getState().ignoreRules.push(r);
    saveState();
    return r;
  }
  function removeIgnoreRule(ruleId) {
    const idx = getState().ignoreRules.findIndex(r => r.id === ruleId);
    if (idx >= 0) { getState().ignoreRules.splice(idx, 1); saveState(); }
  }
  function ignorePendingSuggestion(options = {}) {
    const taskId = options.taskId;
    const reason = options.reason || '暂时忽略建议';
    const task = getState().pendingTasks.find(x => x.id === taskId);
    if (!task || task.status !== 'open') {
      return { ok: false, error: 'task_not_found', message: '待处理任务不存在或已解决' };
    }
    let skillId = options.skillId ? (resolveAssetId(options.skillId) || options.skillId) : task.skillId;
    if (options.skillId && skillId !== task.skillId) {
      return { ok: false, error: 'skill_mismatch', message: 'Skill 与任务不匹配' };
    }
    skillId = task.skillId;
    createIgnoreRule({ skillId, ruleType: 'suggestion', note: reason });
    resolveTask(taskId);
    addAuditEvent({
      skillId,
      eventType: 'suggestion_ignored',
      category: 'system',
      source: 'Skill Panel',
      result: 'completed',
      taskId,
      note: reason
    });
    return { ok: true, taskId, skillId };
  }

  function archiveSkill(skillId, reason = '手动归档') {
    const asset = getAssetRaw(skillId);
    if (!asset || asset.lifecycleStatus === 'archived') return null;
    const instances = getState().instances.filter(i => i.skillId === skillId);
    const primary = instances.find(i => i.isPrimary) || instances[0];
    asset.lifecycleStatus = 'archived';
    asset.updatedAt = $now();
    if (primary) {
      getState().archiveRecords.push(normalizeArchiveRecord({
        id: uuid(),
        skillId,
        originalPath: primary.skillFilePath,
        archivePath: primary.skillFilePath,
        archivedAt: $now(),
        reason,
        snapshotStatus: 'available'
      }));
    }
    // Full package snapshot per instance (does not delete Formal Index files).
    // Use one createdAt so multi-instance archive snaps share a stable sort key
    // (avoids later instances sorting ahead when $now() ticks between iterations).
    const packageSnaps = [];
    const archiveSnapAt = $now();
    // Prefer primary first so equal-timestamp stable sort keeps it ahead of siblings.
    const archiveTargets = instances.slice().sort((a, b) =>
      (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)
    );
    archiveTargets.forEach(inst => {
      const snap = createPackageSnapshotForInstance(inst.id, {
        note: '归档前包快照 · ' + (inst.hostType || ''),
        source: 'pre-archive',
        retained: true,
        createdAt: archiveSnapAt
      });
      if (snap) {
        getState().snapshots.push(snap);
        packageSnaps.push(snap);
      }
    });
    if (packageSnaps.length > 1) {
      getState().snapshots.push(normalizeSnapshot({
        id: uuid(),
        skillId,
        instanceId: null,
        type: 'batch',
        createdAt: archiveSnapAt,
        note: '归档前批量包快照',
        source: 'pre-archive',
        retained: true,
        files: [],
        checkpointData: {
          instanceGroups: packageSnaps.map(s => ({
            instanceId: s.instanceId,
            snapshotId: s.id,
            fileCount: s.fileCount || (s.files || []).length,
            packageSizeBytes: s.packageSizeBytes || 0
          }))
        },
        fileCount: packageSnaps.reduce((n, s) => n + (s.fileCount || 0), 0),
        packageSizeBytes: packageSnaps.reduce((n, s) => n + (s.packageSizeBytes || 0), 0)
      }));
    }
    resolveSkillTasks(skillId, 'archive_candidate');
    addAuditEvent({
      skillId, eventType: 'archive', category: 'archive', source: 'Skill Panel', result: 'completed',
      note: reason + ' · 实例 ' + instances.length + ' · 包快照 ' + packageSnaps.length
    });
    saveState();
    return getSkill(skillId);
  }

  function restoreSkill(skillId, targetLocationId, conflictOption = 'rename') {
    const asset = getAssetRaw(skillId);
    if (!asset || asset.lifecycleStatus !== 'archived') return null;
    // Restore Asset lifecycle only. Do not overwrite instance files or clear Missing.
    const instances = getState().instances.filter(i => i.skillId === skillId);
    const allMissing = instances.length > 0 && instances.every(i => i.lifecycleStatus === 'missing');
    asset.lifecycleStatus = allMissing ? 'missing' : 'available';
    asset.updatedAt = $now();
    const idx = getState().archiveRecords.findIndex(r => r.skillId === skillId);
    if (idx >= 0) getState().archiveRecords.splice(idx, 1);
    addAuditEvent({
      skillId, eventType: 'restore_archive', category: 'archive', source: 'Skill Panel', result: 'completed',
      note: '从归档恢复（未覆盖实例文件 · Missing 保持）'
    });
    saveState();
    return getSkill(skillId);
  }

  function ignoreSkill(skillId, reason = '') {
    const asset = getAssetRaw(skillId);
    if (!asset || asset.lifecycleStatus === 'archived' || asset.lifecycleStatus === 'deleted') return null;
    // In v3 'ignored' is not an asset lifecycle; it is tracked only via IgnoreRule.
    asset.updatedAt = $now();
    const primary = getState().instances.find(i => i.skillId === skillId && i.isPrimary);
    const primaryFile = primary ? getState().files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md') : null;
    const existingRule = getState().ignoreRules.find(r => r.skillId === skillId);
    if (!existingRule) {
      createIgnoreRule({ skillId, path: primary?.skillFilePath, contentHash: primaryFile?.contentHash, reason });
    }
    addAuditEvent({ skillId, eventType: 'ignore', category: 'lifecycle', source: 'Skill Panel', result: 'completed', note: reason || '忽略 Skill' });
    saveState();
    return getSkill(skillId);
  }

  function unignoreSkill(skillId) {
    const asset = getAssetRaw(skillId);
    if (!asset) return null;
    // In v3 unignore only removes the IgnoreRule; lifecycle stays unchanged.
    asset.updatedAt = $now();
    const idx = getState().ignoreRules.findIndex(r => r.skillId === skillId);
    if (idx < 0) return null;
    getState().ignoreRules.splice(idx, 1);
    addAuditEvent({ skillId, eventType: 'unignore', category: 'lifecycle', source: 'Skill Panel', result: 'completed', note: '取消忽略' });
    saveState();
    return getSkill(skillId);
  }

  function deleteSkill(skillId) {
    const asset = getAssetRaw(skillId);
    if (!asset) return null;
    // snapshot before delete
    const primary = getState().instances.find(i => i.skillId === skillId && i.isPrimary);
    const primaryFile = primary ? getState().files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md') : null;
    if (primaryFile) {
      getState().snapshots.push(normalizeSnapshot({
        id: uuid(),
        skillId,
        instanceId: primary.id,
        type: 'package',
        createdAt: $now(),
        note: '删除前快照',
        source: 'pre-delete',
        files: [{ relativePath: 'SKILL.md', content: primaryFile.content, contentHash: primaryFile.contentHash }],
        retained: true
      }));
    }
    asset.lifecycleStatus = 'deleted';
    asset.updatedAt = $now();
    // remove instances and files
    getState().instances = getState().instances.filter(i => i.skillId !== skillId);
    getState().files = getState().files.filter(f => f.skillId !== skillId);
    getState().drafts = getState().drafts.filter(d => d.skillId !== skillId);
    addAuditEvent({ skillId, eventType: 'delete', category: 'lifecycle', source: 'Skill Panel', result: 'completed', note: '永久删除' });
    saveState();
    return true;
  }

  function saveDraft(skillId, content) {
    const asset = getAssetRaw(skillId);
    if (!asset) return null;
    const primary = getState().instances.find(i => i.skillId === skillId && i.isPrimary);
    const primaryFile = primary ? getState().files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md') : null;
    let d = getState().drafts.find(x => x.skillId === skillId);
    if (!d) {
      d = normalizeDraft({ id: uuid(), skillId, instanceId: primary?.id, fileId: primaryFile?.id, content, createdAt: $now(), updatedAt: $now(), baseContentHash: primaryFile?.contentHash || '', baseFileModifiedAt: primaryFile?.modifiedAt || $now(), status: 'modified', lastAutosaveResult: 'ok' });
      getState().drafts.push(d);
    } else {
      d.content = content;
      d.updatedAt = $now();
      d.instanceId = primary?.id;
      d.fileId = primaryFile?.id;
      d.status = 'modified';
      d.lastAutosaveResult = 'ok';
    }
    saveState();
    return toDraftSummary(d);
  }

  function applyChanges(skillId, content, opts = {}) {
    const asset = getAssetRaw(skillId);
    if (!asset) return { ok: false, error: 'Skill not found' };
    const primary = getState().instances.find(i => i.skillId === skillId && i.isPrimary);
    const primaryFile = primary ? getState().files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md') : null;
    if (!primaryFile) return { ok: false, error: 'No SKILL.md file' };

    // Check external conflict unless skipped
    const hasConflict = primary.localModificationStatus === 'conflict' || getState().pendingTasks.some(t => t.skillId === skillId && t.taskType === 'external_conflict' && t.status === 'open');
    if (hasConflict && !opts.skipConflict && !opts.force) {
      return { ok: false, conflict: true };
    }

    // Snapshot before apply
    getState().snapshots.push(normalizeSnapshot({
      id: uuid(),
      skillId,
      instanceId: primary.id,
      type: 'package',
      createdAt: $now(),
      note: '应用更改前快照',
      source: 'manual',
      files: [{ relativePath: 'SKILL.md', content: primaryFile.content, contentHash: primaryFile.contentHash }]
    }));

    primaryFile.content = content;
    primaryFile.contentHash = $hash(content);
    primaryFile.modifiedAt = $now();
    primaryFile.sizeBytes = content.length;
    primaryFile.tokenCount = $tokenApprox(content);
    primary.contentHash = primaryFile.contentHash;
    primary.packageSizeBytes = primaryFile.sizeBytes;
    primary.localModificationStatus = 'clean';
    asset.updatedAt = $now();

    // Remove matching draft
    const draftIdx = getState().drafts.findIndex(d => d.skillId === skillId);
    if (draftIdx >= 0) getState().drafts.splice(draftIdx, 1);

    resolveSkillTasks(skillId, 'external_conflict', 'failed_operation', 'unfinished_draft');
    addAuditEvent({ skillId, eventType: 'apply_change', category: 'edit', source: 'Skill Panel', result: 'completed', snapshotId: getState().snapshots[getState().snapshots.length - 1].id, note: '应用更改后写回 SKILL.md' });
    saveState();
    return { ok: true };
  }

  function forceApply(skillId, content) {
    const asset = getAssetRaw(skillId);
    if (asset) asset._forceOverriddenAt = $now();
    return applyChanges(skillId, content, { force: true });
  }

  function createSkill(opts = {}) {
    const assetId = uuid();
    const instanceId = uuid();
    const fileId = uuid();
    const host = getState().hosts.find(h => h.id === (opts.storageLocationId || 'claude')) || getState().hosts[0];
    const now = $now();
    const content = opts.content || buildContent({ id: assetId, name: opts.name, displayName: opts.displayName || opts.name, version: opts.version || '0.1.0', cat: opts.category || '工程', tags: opts.tags || [], desc: opts.description || '' });

    getState().assets.push(normalizeAsset({
      id: assetId,
      name: opts.name,
      displayName: opts.displayName || opts.name,
      description: opts.description || '',
      categoryIds: opts.category ? [catId(opts.category)] : [],
      tagIds: tagIds(opts.tags || []),
      lifecycleStatus: 'available',
      primaryInstanceId: instanceId,
      supportedHosts: [host.hostType],
      createdAt: now,
      updatedAt: now
    }));

    getState().instances.push(normalizeInstance({
      id: instanceId,
      skillId: assetId,
      hostType: host.hostType,
      rootPath: `${host.path}/${opts.name}`,
      skillFilePath: `${host.path}/${opts.name}/SKILL.md`,
      lifecycleStatus: 'available',
      permissionMode: 'managed',
      installedVersion: opts.version || '0.1.0',
      healthStatuses: ['normal'],
      isPrimary: true,
      lastSeenAt: now,
      contentHash: $hash(content),
      fileCount: 1,
      packageSizeBytes: content.length
    }));

    getState().files.push(normalizeFile({
      id: fileId,
      instanceId,
      skillId: assetId,
      relativePath: 'SKILL.md',
      fileType: 'text',
      mimeType: 'text/markdown',
      sizeBytes: content.length,
      content,
      contentHash: $hash(content),
      modifiedAt: now,
      tokenCount: $tokenApprox(content),
      tokenCountMode: 'estimated'
    }));

    getState().permissionGrants.push(normalizePermissionGrant({
      id: uuid(),
      scopeType: 'instance',
      scopeId: instanceId,
      readAccess: true,
      writeAccess: true,
      status: 'active'
    }));

    addAuditEvent({ skillId: assetId, eventType: 'create', category: 'edit', source: 'Skill Panel', result: 'completed', note: '新建 Skill' });
    saveState();
    return getSkill(assetId);
  }

  function toast(message) {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('toast');
      if (el) {
        el.textContent = String(message ?? '');
        el.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => el.classList.remove('show'), 1800);
        return;
      }
    }
    if (typeof Toast === 'function') new Toast(message).show();
    else console.log('[toast]', message);
  }

  /* ---------- theme & language ---------- */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'light') root.classList.remove('dark');
    else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) root.classList.add('dark'); else root.classList.remove('dark');
    }
  }
  function applyLanguage(lang) {
    let resolved = lang;
    if (lang === 'system' || lang == null || lang === '') {
      resolved = (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('zh')) ? 'zh' : 'en';
    } else {
      resolved = lang === 'en' ? 'en' : 'zh';
    }
    SP.lang = resolved;
    if (typeof document === 'undefined') return;
    document.documentElement.lang = resolved === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const val = t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.setAttribute('placeholder', val);
        if ('placeholder' in el) el.placeholder = val;
      } else {
        el.textContent = val;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const val = t(key);
      el.setAttribute('placeholder', val);
      if ('placeholder' in el) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (!key) return;
      el.setAttribute('aria-label', t(key));
    });
  }

  /* ---------- Phase C: Library query / view models ---------- */
  const LIBRARY_DEFAULT_COLUMNS = ['select', 'skill', 'status', 'category', 'instances', 'source', 'version', 'lastUsed', 'actions'];
  const LIBRARY_ALL_COLUMNS = ['select', 'skill', 'status', 'category', 'instances', 'source', 'version', 'lastUsed', 'lastModified', 'usage', 'token', 'actions'];

  function defaultLibraryViewState() {
    return {
      section: 'all',
      viewMode: 'table',
      search: '',
      filters: {},
      sort: 'recent',
      visibleColumns: LIBRARY_DEFAULT_COLUMNS.slice(),
      page: 1,
      pageSize: 20,
      selectedAssetId: null,
      expandedAssetIds: [],
      expandedTreeNodes: [],
      scrollTop: 0,
      detailOpen: false,
      source: null,
      selectedId: null
    };
  }

  function getLibraryViewState() {
    const vs = getViewState('library') || {};
    const base = defaultLibraryViewState();
    const merged = Object.assign({}, base, vs);
    if (!Array.isArray(merged.visibleColumns) || !merged.visibleColumns.length) {
      merged.visibleColumns = LIBRARY_DEFAULT_COLUMNS.slice();
    }
    // Keep legacy selectedId in sync with selectedAssetId
    if (merged.selectedAssetId && !merged.selectedId) merged.selectedId = merged.selectedAssetId;
    if (merged.selectedId && !merged.selectedAssetId) merged.selectedAssetId = merged.selectedId;
    merged.expandedAssetIds = $coerceArray(merged.expandedAssetIds);
    merged.expandedTreeNodes = $coerceArray(merged.expandedTreeNodes);
    merged.filters = merged.filters && typeof merged.filters === 'object' ? merged.filters : {};
    return JSON.parse(JSON.stringify(merged));
  }

  function setLibraryViewState(patch) {
    const current = getLibraryViewState();
    const next = Object.assign({}, current, patch || {});
    if (patch && patch.selectedAssetId != null) next.selectedId = patch.selectedAssetId;
    if (patch && patch.selectedId != null && patch.selectedAssetId == null) next.selectedAssetId = patch.selectedId;
    if (Array.isArray(next.visibleColumns)) {
      // Skill column is fixed; keep at least skill + one info column
      if (!next.visibleColumns.includes('skill')) next.visibleColumns.unshift('skill');
      const infoCols = next.visibleColumns.filter(c => c !== 'select' && c !== 'actions' && c !== 'skill');
      if (!infoCols.length) next.visibleColumns.push('status');
    }
    setViewState('library', next);
    return getLibraryViewState();
  }

  function getCategories() {
    return getState().categories.map(c => normalizeCategory(c));
  }

  function getTags() {
    return getState().tags.map(t => normalizeTag(t));
  }

  function _hostLabel(hostType) {
    const map = { 'claude-code': 'Claude Code', codex: 'Codex', custom: '自定义', archive: '归档', cursor: 'Cursor', warp: 'Warp' };
    return map[hostType] || hostType || '—';
  }

  function _categoryNames(asset, state) {
    return (asset.categoryIds || []).map(cid => state.categories.find(c => c.id === cid)?.name).filter(Boolean);
  }

  function _tagNames(asset, state) {
    return (asset.tagIds || []).map(tid => state.tags.find(t => t.id === tid)?.name).filter(Boolean);
  }

  function _instanceSummary(instances) {
    const total = instances.length;
    const missing = instances.filter(i => i.lifecycleStatus === 'missing').length;
    const available = instances.filter(i => i.lifecycleStatus === 'available').length;
    const readOnly = instances.filter(i => i.permissionMode === 'read-only').length;
    const managed = instances.filter(i => i.permissionMode === 'managed').length;
    const locallyModified = instances.filter(i => i.localModificationStatus && i.localModificationStatus !== 'clean').length;
    const conflict = instances.filter(i => (i.localModificationStatus || '').includes('conflict') || (i.healthStatuses || []).includes('external-changed')).length;
    const hosts = [...new Set(instances.map(i => i.hostType))];
    return { total, missing, available, readOnly, managed, locallyModified, conflict, hosts, missingScope: missing === 0 ? 'none' : (missing === total ? 'all' : 'partial') };
  }

  function getAssetStatusSummary(assetId) {
    const state = getState();
    const rid = resolveAssetId(assetId);
    const asset = rid ? state.assets.find(a => a.id === rid) : null;
    if (!asset) return null;
    const instances = state.instances.filter(i => i.skillId === asset.id);
    const primary = instances.find(i => i.isPrimary) || instances[0];
    const binding = asset.sourceBindingId ? state.sourceBindings.find(b => b.id === asset.sourceBindingId) : state.sourceBindings.find(b => b.skillId === asset.id);
    const instSum = _instanceSummary(instances);
    const health = [];
    instances.forEach(i => (i.healthStatuses || []).forEach(h => { if (h && h !== 'normal' && !health.includes(h)) health.push(h); }));
    const updateStatus = binding ? binding.updateStatus : 'unbound';
    const permission = primary ? primary.permissionMode : 'read-only';
    const localMod = primary ? (primary.localModificationStatus || 'clean') : 'clean';

    let attention = 'normal';
    let attentionLabel = '正常';
    if (instSum.conflict || health.includes('permission-denied') || health.includes('permission_denied')) {
      attention = 'conflict'; attentionLabel = '冲突 / 权限拒绝';
    } else if (asset.lifecycleStatus === 'missing' || instSum.missingScope === 'all') {
      attention = 'missing-all'; attentionLabel = '全部 Missing';
    } else if (health.some(h => ['yaml-error', 'yaml_error', 'install-error', 'empty-content', 'empty_content'].includes(h))) {
      attention = 'health'; attentionLabel = '健康异常';
    } else if (updateStatus === 'available') {
      attention = 'update'; attentionLabel = '可更新';
    } else if (instSum.missingScope === 'partial') {
      attention = 'missing-partial'; attentionLabel = '部分 Missing';
    } else if (localMod !== 'clean' || instSum.locallyModified) {
      attention = 'local-mod'; attentionLabel = '本地修改';
    } else if (asset.lifecycleStatus === 'archived') {
      attention = 'archived'; attentionLabel = '已归档';
    }

    const priorityRank = { conflict: 0, 'missing-all': 1, health: 2, update: 3, 'missing-partial': 4, 'local-mod': 5, archived: 6, normal: 7 }[attention] ?? 7;

    return {
      assetId: asset.id,
      lifecycle: asset.lifecycleStatus,
      health,
      updateStatus,
      permission,
      localModification: localMod,
      instances: instSum,
      attention,
      attentionLabel,
      priorityRank,
      isFavorite: !!asset.isFavorite,
      unboundSource: !binding
    };
  }

  function getAssetSummary(assetId) {
    const state = getState();
    const rid = resolveAssetId(assetId);
    if (!rid) return null;
    const asset = state.assets.find(a => a.id === rid);
    if (!asset || asset.lifecycleStatus === 'deleted') return null;
    const instances = state.instances.filter(i => i.skillId === asset.id).map(i => normalizeInstance(i));
    const primary = instances.find(i => i.isPrimary) || instances[0] || null;
    const files = state.files.filter(f => f.skillId === asset.id);
    const binding = asset.sourceBindingId
      ? state.sourceBindings.find(b => b.id === asset.sourceBindingId)
      : state.sourceBindings.find(b => b.skillId === asset.id);
    const status = getAssetStatusSummary(asset.id);
    const usageEvents = getCanonicalUsageEvents(asset.id, state);
    const usage30 = usageEvents.filter(e => new Date(e.occurredAt) > new Date(Date.now() - 30 * 86400000)).reduce((s, e) => s + (e.callCount || 0), 0);
    const lastUsedAt = usageEvents.length ? usageEvents.reduce((latest, e) => (!latest || e.occurredAt > latest ? e.occurredAt : latest), null) : null;
    const lastManagedAt = state.auditEvents.filter(e => e.skillId === asset.id).reduce((latest, e) => (!latest || e.time > latest ? e.time : latest), null);
    const skillMd = primary ? state.files.find(f => f.instanceId === primary.id && f.relativePath === 'SKILL.md') : null;
    const packageSizeBytes = files.reduce((s, f) => s + (f.sizeBytes || 0), 0);
    const pendingTasks = state.pendingTasks.filter(t => t.skillId === asset.id && t.status === 'open').map(t => normalizePendingTask(t));
    const recentActivity = getRecentActivityAt(asset, primary, skillMd, lastUsedAt, lastManagedAt);

    return JSON.parse(JSON.stringify({
      id: asset.id,
      name: asset.name,
      displayName: asset.displayName || asset.name,
      description: asset.description || '',
      lifecycleStatus: asset.lifecycleStatus,
      isFavorite: !!asset.isFavorite,
      categoryIds: asset.categoryIds.slice(),
      categories: _categoryNames(asset, state),
      tagIds: asset.tagIds.slice(),
      tags: _tagNames(asset, state),
      invocation: asset.invocation || ('/' + asset.name),
      primaryInstanceId: primary ? primary.id : null,
      primaryHost: primary ? primary.hostType : null,
      primaryHostLabel: primary ? _hostLabel(primary.hostType) : '—',
      primaryPath: primary ? primary.skillFilePath : null,
      version: primary ? primary.installedVersion : '',
      instanceCount: instances.length,
      instances,
      instanceSummary: status ? status.instances : _instanceSummary(instances),
      status,
      sourceBinding: binding ? normalizeSourceBinding(binding) : null,
      updateStatus: binding ? binding.updateStatus : 'unbound',
      remoteVersion: binding ? binding.remoteVersion : null,
      remoteCommit: binding ? binding.remoteCommit : null,
      fileCount: files.length,
      packageSizeBytes,
      documentTokenCount: skillMd && skillMd.tokenCountMode !== 'unavailable' ? skillMd.tokenCount : null,
      usage30: hasUsageAdapter(asset, primary, state) ? usage30 : null,
      hasUsageData: hasUsageAdapter(asset, primary, state),
      lastUsedAt,
      lastModifiedAt: skillMd ? skillMd.modifiedAt : asset.updatedAt,
      installedAt: primary ? primary.lastSeenAt : asset.createdAt,
      recentActivityAt: recentActivity,
      pendingTasks,
      contentPreview: (function () {
        if (!skillMd || !primary) return '';
        const perm = getInstancePermission(primary.id);
        if (!perm || !perm.readAccess || perm.contentAccessStatus !== 'readable') return '';
        return String(skillMd.content || '').slice(0, 400);
      })(),
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    }));
  }

  function hasUsageAdapter(asset, primary, state) {
    if (!asset) return false;
    const st = state || getState();
    const events = getCanonicalUsageEvents(asset.id, st);
    if (events.length) return true;
    const canonicalId = resolveCanonicalAssetId(asset.id);
    const relatedInstances = st.instances.filter(i =>
      i.skillId === canonicalId || resolveCanonicalAssetId(i.skillId) === canonicalId
    );
    if (relatedInstances.some(inst =>
      st.usageAdapters.some(a => a.hostTypes.includes(inst.hostType) && a.supportsCalls)
    )) return true;
    if (primary && st.usageAdapters.some(a => a.hostTypes.includes(primary.hostType) && a.supportsCalls)) return true;
    return false;
  }

  function getRecentActivityAt(asset, primary, skillMd, lastUsedAt, lastManagedAt) {
    // Recent = max of usage / modify / install-or-discover / management audit — not usage-only.
    const candidates = [
      lastUsedAt,
      skillMd ? skillMd.modifiedAt : null,
      asset.updatedAt,
      primary ? primary.lastSeenAt : null,
      asset.createdAt,
      lastManagedAt
    ].filter(Boolean);
    if (!candidates.length) return null;
    return candidates.slice().sort((a, b) => b.localeCompare(a))[0];
  }

  function getAssetInstances(assetId) {
    const rid = resolveAssetId(assetId);
    if (!rid) return [];
    return getState().instances.filter(i => i.skillId === rid).map(i => normalizeInstance(i));
  }

  function getAssetFiles(assetId) {
    const rid = resolveAssetId(assetId);
    if (!rid) return [];
    return getFilesRawInternal({ skillId: rid }).map(f => toFileMetadata(f));
  }

  function _fileSearchHits(assetId, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const files = getFilesRawInternal({ skillId: assetId }).filter(f => f.fileType === 'text');
    const hits = [];
    files.forEach(f => {
      const nameHit = (f.relativePath || '').toLowerCase().includes(q);
      const perm = getInstancePermission(f.instanceId);
      const canReadBody = perm && perm.readAccess && perm.contentAccessStatus === 'readable';
      let idx = -1;
      let content = '';
      let lower = '';
      if (canReadBody) {
        content = String(f.content || '');
        lower = content.toLowerCase();
        idx = lower.indexOf(q);
      }
      if (!nameHit && idx < 0) return;
      let snippet = '';
      if (idx >= 0) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(content.length, idx + q.length + 60);
        snippet = (start > 0 ? '…' : '') + content.slice(start, end).replace(/\s+/g, ' ') + (end < content.length ? '…' : '');
      } else {
        snippet = '文件名匹配';
      }
      hits.push({
        fileId: f.id,
        relativePath: f.relativePath,
        matchCount: idx >= 0 ? (lower.split(q).length - 1) : 1,
        snippet
      });
    });
    return hits;
  }

  function _matchesLibraryFilters(summary, filters) {
    const f = filters || {};
    if (f.lifecycle && f.lifecycle.length) {
      const life = summary.lifecycleStatus === 'available' ? 'available' : summary.lifecycleStatus;
      const aliases = life === 'available' ? ['available', 'active'] : [life];
      if (!f.lifecycle.some(x => aliases.includes(x))) return false;
    }
    if (f.category && f.category.length && !f.category.some(c => summary.categories.includes(c) || summary.categoryIds.includes(c))) return false;
    if (f.categoryId && f.categoryId.length && !f.categoryId.some(c => summary.categoryIds.includes(c))) return false;
    if (f.tags && f.tags.length && !f.tags.some(t => summary.tags.includes(t) || summary.tagIds.includes(t))) return false;
    if (f.host && f.host.length) {
      const hosts = summary.instanceSummary.hosts || [];
      const normalized = f.host.map(h => h === 'claude' ? 'claude-code' : h);
      if (!normalized.some(h => hosts.includes(h))) return false;
    }
    if (f.health && f.health.length) {
      const hs = (summary.status && summary.status.health) || [];
      if (!f.health.some(h => hs.includes(h) || hs.includes(h.replace(/_/g, '-')))) return false;
    }
    if (f.permission && f.permission.length) {
      if (!f.permission.includes(summary.status?.permission)) return false;
    }
    if (f.updateStatus && f.updateStatus.length) {
      if (!f.updateStatus.includes(summary.updateStatus)) return false;
    }
    if (f.localModification && f.localModification.length) {
      if (!f.localModification.includes(summary.status?.localModification)) return false;
    }
    if (f.sourceType && f.sourceType.length) {
      const st = summary.sourceBinding ? summary.sourceBinding.sourceType : 'none';
      if (!f.sourceType.includes(st)) return false;
    }
    if (f.favorite === true && !summary.isFavorite) return false;
    if (f.hasUsageData === true && !summary.hasUsageData) return false;
    if (f.hasUsageData === false && summary.hasUsageData) return false;
    if (f.missingScope === 'all' && summary.instanceSummary.missingScope !== 'all') return false;
    if (f.missingScope === 'partial' && summary.instanceSummary.missingScope !== 'partial') return false;
    if (f.instanceCount === 'multi' && summary.instanceCount < 2) return false;
    if (f.instanceCount === 'single' && summary.instanceCount !== 1) return false;
    if (f.userCreated === true) {
      const primary = summary.instances.find(i => i.isPrimary) || summary.instances[0];
      if (!primary || primary.hostType !== 'custom') return false;
    }
    return true;
  }

  function _sectionFilter(summaries, section, categoryId) {
    switch (section) {
      case 'favorites':
        return summaries.filter(s => s.isFavorite);
      case 'recent':
        // Activity-ranked list (usage / edit / install-discover / audit), not usage-only.
        return summaries
          .filter(s => s.lifecycleStatus !== 'archived' && s.lifecycleStatus !== 'deleted')
          .slice()
          .sort((a, b) => (b.recentActivityAt || '').localeCompare(a.recentActivityAt || '') || a.name.localeCompare(b.name))
          .slice(0, 50);
      case 'updates':
        return summaries.filter(s => s.updateStatus === 'available');
      case 'missing':
        return summaries.filter(s => s.instanceSummary.missingScope === 'all' || s.instanceSummary.missingScope === 'partial' || s.lifecycleStatus === 'missing');
      case 'archive':
        return summaries.filter(s => s.lifecycleStatus === 'archived');
      case 'categories':
        if (!categoryId) return summaries.filter(s => s.lifecycleStatus !== 'archived' && s.lifecycleStatus !== 'deleted');
        if (categoryId === '__uncategorized__') return summaries.filter(s => !s.categoryIds.length && s.lifecycleStatus !== 'archived');
        return summaries.filter(s => s.categoryIds.includes(categoryId) && s.lifecycleStatus !== 'archived');
      case 'scan-changes':
        return [];
      case 'all':
      default:
        return summaries.filter(s => s.lifecycleStatus !== 'archived' && s.lifecycleStatus !== 'deleted');
    }
  }

  function _sortLibrary(summaries, sortKey) {
    const copy = summaries.slice();
    const stableName = (a, b) => a.name.localeCompare(b.name);
    switch (sortKey) {
      case 'name':
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'edited':
      case 'lastModified':
        return copy.sort((a, b) => (b.lastModifiedAt || '').localeCompare(a.lastModifiedAt || '') || stableName(a, b));
      case 'usage':
        return copy.sort((a, b) => {
          const av = a.usage30 == null ? -1 : a.usage30;
          const bv = b.usage30 == null ? -1 : b.usage30;
          return bv - av || stableName(a, b);
        });
      case 'doctoken':
      case 'token':
        return copy.sort((a, b) => (b.documentTokenCount || 0) - (a.documentTokenCount || 0) || stableName(a, b));
      case 'instances':
        return copy.sort((a, b) => b.instanceCount - a.instanceCount || stableName(a, b));
      case 'priority':
      case 'status':
        return copy.sort((a, b) => (a.status?.priorityRank ?? 9) - (b.status?.priorityRank ?? 9) || stableName(a, b));
      case 'updated':
        return copy.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || stableName(a, b));
      case 'lastUsed':
        return copy.sort((a, b) => (b.lastUsedAt || '').localeCompare(a.lastUsedAt || '') || stableName(a, b));
      case 'recent':
      default:
        return copy.sort((a, b) => (b.recentActivityAt || '').localeCompare(a.recentActivityAt || '') || stableName(a, b));
    }
  }

  function searchLibrary(query, filters) {
    return queryLibraryAssets({ search: query, filters, section: 'all', page: 1, pageSize: 10000 });
  }

  function queryLibraryAssets(options = {}) {
    const state = getState();
    const section = options.section || 'all';
    const categoryId = options.categoryId || null;
    const search = (options.search || '').trim();
    const filters = options.filters || {};
    const sort = options.sort || 'recent';
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.max(1, options.pageSize || 20);

    let summaries = state.assets
      .filter(a => a.lifecycleStatus !== 'deleted')
      .map(a => getAssetSummary(a.id))
      .filter(Boolean);

    summaries = _sectionFilter(summaries, section, categoryId);
    summaries = summaries.filter(s => _matchesLibraryFilters(s, filters));

    const q = search.toLowerCase();
    let results = summaries.map(s => {
      const fileHits = q ? _fileSearchHits(s.id, q) : [];
      let metaHit = false;
      if (q) {
        const blob = [
          s.name, s.displayName, s.description, s.invocation,
          ...s.categories, ...s.tags,
          s.primaryHost, s.primaryHostLabel, s.primaryPath,
          ...(s.instances || []).map(i => [i.hostType, i.skillFilePath, i.rootPath].join(' ')),
          s.sourceBinding ? [s.sourceBinding.sourceType, s.sourceBinding.repository, s.sourceBinding.remoteVersion].join(' ') : ''
        ].join(' ').toLowerCase();
        metaHit = blob.includes(q);
        // Also search SKILL.md via file hits
        if (!metaHit && !fileHits.length) return null;
        if (!metaHit && fileHits.length) metaHit = false;
      }
      if (q && !metaHit && !fileHits.length) return null;
      return Object.assign({}, s, {
        searchMetaHit: !q || metaHit,
        fileHits,
        fileHitCount: fileHits.reduce((n, h) => n + (h.matchCount || 1), 0)
      });
    }).filter(Boolean);

    // Deduplicate: one row per asset (already unique)
    results = _sortLibrary(results, sort);
    const total = results.length;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);

    return {
      items: JSON.parse(JSON.stringify(items)),
      total,
      page,
      pageSize,
      section,
      search,
      filters: JSON.parse(JSON.stringify(filters)),
      sort
    };
  }

  function getPendingChangeSetSummary() {
    const state = getState();
    const pending = state.changeSets.filter(c => c.status === 'pending');
    const items = pending.flatMap(cs => state.changeItems.filter(i => i.changeSetId === cs.id));
    const lastSession = state.scanSessions.slice().reverse().find(Boolean);
    const counts = {
      added: items.filter(i => i.changeType === 'added' || i.changeType === 'rebind-candidate').length,
      changed: items.filter(i => ['content-changed', 'path-changed', 'instance-changed', 'health-changed', 'update-available', 'duplicate-changed'].includes(i.changeType)).length,
      missing: items.filter(i => i.changeType === 'missing' || i.changeType === 'file-deleted').length,
      anomalous: items.filter(i => ['health-changed', 'duplicate-changed'].includes(i.changeType)).length,
      pendingItems: items.filter(i => i.status === 'pending').length
    };
    return {
      pendingChangeSetCount: pending.length,
      lastScanAt: lastSession ? (lastSession.finishedAt || lastSession.startedAt) : null,
      activeScanStatus: getActiveScanSession()?.status || null,
      counts,
      changeSetIds: pending.map(c => c.id)
    };
  }

  function getLibraryCounts() {
    const state = getState();
    const all = state.assets.filter(a => a.lifecycleStatus !== 'deleted');
    const summaries = all.map(a => getAssetSummary(a.id)).filter(Boolean);
    const scan = getPendingChangeSetSummary();
    const active = getActiveScanSession();
    return {
      all: summaries.filter(s => s.lifecycleStatus !== 'archived').length,
      favorites: summaries.filter(s => s.isFavorite).length,
      recent: Math.min(50, summaries.filter(s => s.lifecycleStatus !== 'archived').length),
      updates: summaries.filter(s => s.updateStatus === 'available').length,
      missing: summaries.filter(s => s.instanceSummary.missingScope !== 'none' || s.lifecycleStatus === 'missing').length,
      missingAll: summaries.filter(s => s.instanceSummary.missingScope === 'all' || s.lifecycleStatus === 'missing').length,
      missingPartial: summaries.filter(s => s.instanceSummary.missingScope === 'partial').length,
      archive: summaries.filter(s => s.lifecycleStatus === 'archived').length,
      scanChanges: scan.pendingChangeSetCount,
      conflicts: summaries.filter(s => s.status?.attention === 'conflict').length,
      duplicates: getDuplicateGroups().length,
      installErrors: summaries.filter(s => (s.status?.health || []).some(h => h.includes('install'))).length,
      scanning: !!(active && active.status === 'scanning'),
      paused: !!(active && active.status === 'paused'),
      categories: getCategories().map(c => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        count: summaries.filter(s => s.categoryIds.includes(c.id) && s.lifecycleStatus !== 'archived').length
      })),
      uncategorized: summaries.filter(s => !s.categoryIds.length && s.lifecycleStatus !== 'archived').length
    };
  }

  function toggleFavorite(assetId, value) {
    const asset = getAssetRaw(assetId);
    if (!asset) return null;
    asset.isFavorite = value == null ? !asset.isFavorite : !!value;
    asset.updatedAt = $now();
    saveState();
    return getAssetSummary(asset.id);
  }

  function addAssetCategories(assetId, categoryIds) {
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, error: 'Asset not found' };
    const ids = $coerceArray(categoryIds);
    ids.forEach(cid => { if (!asset.categoryIds.includes(cid)) asset.categoryIds.push(cid); });
    asset.updatedAt = $now();
    saveState();
    return { ok: true, assetId: asset.id, categoryIds: asset.categoryIds.slice() };
  }

  function addAssetTags(assetId, tagIdsOrNames) {
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, error: 'Asset not found' };
    const state = getState();
    $coerceArray(tagIdsOrNames).forEach(t => {
      let id = t;
      const byName = state.tags.find(x => x.name === t || x.id === t);
      if (byName) id = byName.id;
      else {
        id = uuid();
        state.tags.push(normalizeTag({ id, name: String(t) }));
      }
      if (!asset.tagIds.includes(id)) asset.tagIds.push(id);
    });
    asset.updatedAt = $now();
    saveState();
    return { ok: true, assetId: asset.id, tagIds: asset.tagIds.slice() };
  }

  function ignoreMissingHint(assetId) {
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, error: 'Asset not found' };
    // Resolve related PendingTasks only. Do NOT change Asset/Instance lifecycle,
    // create IgnoreRule, or permanently exclude the Skill from future scans.
    const beforeLife = asset.lifecycleStatus;
    const instanceSnapshots = getState().instances
      .filter(i => i.skillId === asset.id)
      .map(i => ({ id: i.id, lifecycleStatus: i.lifecycleStatus }));
    const tasks = getState().pendingTasks.filter(t =>
      t.skillId === asset.id &&
      t.status === 'open' &&
      ['path_missing', 'path-missing', 'missing', 'archive_candidate'].includes(t.taskType)
    );
    tasks.forEach(t => { t.status = 'resolved'; t.resolvedAt = $now(); });
    addAuditEvent({
      eventType: 'missing_hint_ignored',
      category: 'system',
      source: 'Skill Panel',
      result: 'completed',
      note: '忽略提示（仅关闭相关 PendingTask，生命周期未变）',
      skillId: asset.id
    });
    saveState();
    return {
      ok: true,
      assetId: asset.id,
      lifecycleStatus: asset.lifecycleStatus,
      unchangedLifecycle: asset.lifecycleStatus === beforeLife,
      instanceLifecycles: instanceSnapshots,
      resolvedTaskCount: tasks.length,
      ignoreRuleCreated: false
    };
  }

  function batchLibraryAction(action, assetIds, payload = {}) {
    const ids = $coerceArray(assetIds);
    const results = [];
    ids.forEach(id => {
      try {
        let res;
        switch (action) {
          case 'favorite':
            res = toggleFavorite(id, true);
            results.push({ assetId: id, ok: !!res, error: res ? null : 'Asset not found' });
            break;
          case 'unfavorite':
            res = toggleFavorite(id, false);
            results.push({ assetId: id, ok: !!res, error: res ? null : 'Asset not found' });
            break;
          case 'add-category':
            res = addAssetCategories(id, payload.categoryIds || payload.categoryId);
            results.push({ assetId: id, ok: !!res.ok, error: res.error || null });
            break;
          case 'add-tag':
            res = addAssetTags(id, payload.tagIds || payload.tags || payload.tag);
            results.push({ assetId: id, ok: !!res.ok, error: res.error || null });
            break;
          case 'archive': {
            const asset = getAssetRaw(id);
            if (!asset) { results.push({ assetId: id, ok: false, error: 'Asset not found' }); break; }
            if (asset.lifecycleStatus === 'archived') { results.push({ assetId: id, ok: false, error: 'Already archived' }); break; }
            if (asset.lifecycleStatus === 'deleted') { results.push({ assetId: id, ok: false, error: 'Deleted assets cannot be archived' }); break; }
            archiveSkill(id, payload.reason || '批量归档');
            results.push({ assetId: id, ok: true, error: null });
            break;
          }
          case 'restore': {
            const asset = getAssetRaw(id);
            if (!asset) { results.push({ assetId: id, ok: false, error: 'Asset not found' }); break; }
            if (asset.lifecycleStatus !== 'archived') { results.push({ assetId: id, ok: false, error: 'Not archived' }); break; }
            restoreSkill(id, payload.targetLocationId, payload.conflictOption || 'rename');
            results.push({ assetId: id, ok: true, error: null });
            break;
          }
          case 'ignore-hint':
            res = ignoreMissingHint(id);
            results.push({ assetId: id, ok: !!res.ok, error: res.error || null });
            break;
          case 'export':
            results.push({ assetId: id, ok: true, error: null, exported: true });
            break;
          default:
            results.push({ assetId: id, ok: false, error: 'Unknown action: ' + action });
        }
      } catch (e) {
        results.push({ assetId: id, ok: false, error: e.message || String(e) });
      }
    });
    const success = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    return { action, results, success, failed, total: results.length };
  }

  /* ---------- Phase D: Detail query / permission / relink ---------- */
  function defaultDetailViewState() {
    return {
      assetId: null,
      tab: 'overview',
      selectedInstanceId: null,
      selectedFileId: null,
      expandedFileNodes: [],
      activityFilter: 'all',
      snapshotFilter: 'all',
      scrollTop: 0,
      fileViewMode: 'preview'
    };
  }

  function getDetailViewState() {
    const vs = getViewState('detail') || {};
    const merged = Object.assign({}, defaultDetailViewState(), vs);
    merged.expandedFileNodes = $coerceArray(merged.expandedFileNodes);
    return JSON.parse(JSON.stringify(merged));
  }

  function setDetailViewState(patch) {
    const next = Object.assign({}, getDetailViewState(), patch || {});
    next.expandedFileNodes = $coerceArray(next.expandedFileNodes);
    setViewState('detail', next);
    return getDetailViewState();
  }

  function getInstancePermission(instanceId) {
    const state = getState();
    const inst = state.instances.find(i => i.id === instanceId);
    if (!inst) return null;
    const host = state.hosts.find(h => h.hostType === inst.hostType);
    const health = $coerceArray(inst.healthStatuses);
    const deniedHealth = health.some(h => h === 'permission-denied' || h === 'permission_denied');
    const hostReadOk = host ? host.permissionStatus === 'granted' : false;
    const isMissing = inst.lifecycleStatus === 'missing';

    const grants = state.permissionGrants.filter(g =>
      g.status === 'active' && (
        (g.scopeType === 'instance' && g.scopeId === instanceId) ||
        (g.scopeType === 'directory' && g.scopePath && $pathInScope(inst.rootPath || inst.skillFilePath, g.scopePath))
      )
    );
    const hasReadGrant = grants.some(g => !!g.readAccess);
    const hasWriteGrant = grants.some(g => !!g.writeAccess);

    let readAccess = false;
    let writeAccess = false;
    let contentAccessStatus = 'denied';

    if (isMissing) {
      readAccess = false;
      writeAccess = false;
      contentAccessStatus = 'historical-metadata';
    } else if (!hostReadOk) {
      readAccess = false;
      writeAccess = false;
      contentAccessStatus = 'host-denied';
    } else if (deniedHealth && !hasReadGrant) {
      readAccess = false;
      writeAccess = false;
      contentAccessStatus = 'permission-denied';
    } else {
      readAccess = hasReadGrant;
      writeAccess = hasReadGrant && (hasWriteGrant || (inst.permissionMode === 'managed' && hasWriteGrant));
      // managed alone does not grant write without an active write grant
      writeAccess = hasReadGrant && hasWriteGrant;
      contentAccessStatus = readAccess ? 'readable' : 'denied';
    }

    return JSON.parse(JSON.stringify({
      instanceId,
      permissionMode: writeAccess ? 'managed' : (readAccess ? (inst.permissionMode || 'read-only') : 'denied'),
      readAccess: !!readAccess,
      writeAccess: !!writeAccess,
      contentAccessStatus,
      isMissing,
      hostPermissionStatus: host ? host.permissionStatus : 'unknown',
      grants: grants.map(g => normalizePermissionGrant(g)),
      scopePaths: grants.map(g => g.scopePath || inst.rootPath)
    }));
  }

  function getInstanceDetail(instanceId) {
    const state = getState();
    const inst = state.instances.find(i => i.id === instanceId);
    if (!inst) return null;
    const asset = state.assets.find(a => a.id === inst.skillId);
    const files = state.files.filter(f => f.instanceId === instanceId);
    const perm = getInstancePermission(instanceId);
    const binding = inst.sourceBindingId
      ? state.sourceBindings.find(b => b.id === inst.sourceBindingId)
      : (asset && asset.sourceBindingId ? state.sourceBindings.find(b => b.id === asset.sourceBindingId) : null);
    return JSON.parse(JSON.stringify({
      ...normalizeInstance(inst),
      hostLabel: _hostLabel(inst.hostType),
      assetId: inst.skillId,
      assetName: asset ? asset.name : null,
      permission: perm,
      fileCount: files.length,
      packageSizeBytes: files.reduce((s, f) => s + (f.sizeBytes || 0), 0),
      textFileCount: files.filter(f => f.fileType === 'text').length,
      binaryFileCount: files.filter(f => f.fileType === 'binary').length,
      nestedSkillCount: files.filter(f => f.isNestedSkillMarker).length,
      sourceBinding: binding ? normalizeSourceBinding(binding) : null,
      readAccess: perm ? perm.readAccess : false,
      writeAccess: perm ? perm.writeAccess : false,
      contentAccessStatus: perm ? perm.contentAccessStatus : 'denied'
    }));
  }

  function getInstanceFiles(instanceId) {
    return getFilesRawInternal({ instanceId }).map(f => toFileMetadata(f));
  }

  function buildFileTree(instanceId) {
    const files = getInstanceFiles(instanceId);
    const root = { name: '', path: '', type: 'dir', children: [] };
    function ensureDir(parts) {
      let node = root;
      let acc = '';
      parts.forEach(part => {
        if (!part) return;
        acc = acc ? acc + '/' + part : part;
        let child = node.children.find(c => c.type === 'dir' && c.name === part);
        if (!child) {
          child = { name: part, path: acc, type: 'dir', children: [] };
          node.children.push(child);
        }
        node = child;
      });
      return node;
    }
    files.forEach(f => {
      const parts = String(f.relativePath || '').split('/');
      const fileName = parts.pop();
      const dir = ensureDir(parts);
      dir.children.push({
        name: fileName,
        path: f.relativePath,
        type: 'file',
        fileId: f.id,
        fileType: f.fileType,
        mimeType: f.mimeType,
        isNestedSkillMarker: !!f.isNestedSkillMarker,
        indexStatus: f.indexStatus,
        sizeBytes: f.sizeBytes
      });
    });
    function sortNode(n) {
      if (!n.children) return;
      n.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      n.children.forEach(sortNode);
    }
    sortNode(root);
    return JSON.parse(JSON.stringify(root.children));
  }

  function getFileDetail(fileId) {
    const f = getFileRawInternal(fileId);
    if (!f) return null;
    const inst = getState().instances.find(i => i.id === f.instanceId);
    const perm = inst ? getInstancePermission(inst.id) : null;
    const isBinary = f.fileType === 'binary';
    const meta = toFileMetadata(f);
    if (!inst) {
      return JSON.parse(JSON.stringify({
        ...meta, content: null, contentForView: null, instance: null, hostLabel: '—',
        isBinary, contentAccessStatus: 'denied', readAccess: false
      }));
    }
    if (isBinary) {
      const status = perm && perm.readAccess
        ? 'binary-metadata'
        : (perm && perm.contentAccessStatus) || 'permission-denied';
      return JSON.parse(JSON.stringify({
        ...meta, content: null, contentForView: null,
        instance: normalizeInstance(inst), hostLabel: _hostLabel(inst.hostType),
        isBinary: true, contentAccessStatus: status, readAccess: !!(perm && perm.readAccess)
      }));
    }
    if (perm && perm.isMissing) {
      return JSON.parse(JSON.stringify({
        ...meta, content: null, contentForView: null,
        instance: normalizeInstance(inst), hostLabel: _hostLabel(inst.hostType),
        isBinary: false, contentAccessStatus: 'historical-metadata', readAccess: false
      }));
    }
    const canReadContent = perm && perm.readAccess && perm.contentAccessStatus === 'readable';
    if (!canReadContent) {
      const status = (perm && perm.contentAccessStatus === 'permission-denied')
        ? 'permission-denied'
        : ((perm && perm.contentAccessStatus) || 'permission-denied');
      return JSON.parse(JSON.stringify({
        ...meta, content: null, contentForView: null,
        instance: normalizeInstance(inst), hostLabel: _hostLabel(inst.hostType),
        isBinary: false, contentAccessStatus: status, readAccess: false
      }));
    }
    return JSON.parse(JSON.stringify({
      ...meta,
      content: String(f.content || ''),
      contentForView: String(f.content || ''),
      instance: normalizeInstance(inst),
      hostLabel: _hostLabel(inst.hostType),
      isBinary: false,
      contentAccessStatus: 'readable',
      readAccess: true
    }));
  }

  function toSnapshotSummary(snap) {
    const files = $coerceArray(snap.files);
    const fileCount = snap.fileCount != null ? snap.fileCount : files.length;
    const packageSizeBytes = snap.packageSizeBytes != null
      ? snap.packageSizeBytes
      : files.reduce((n, f) => n + (f.sizeBytes != null ? f.sizeBytes : 0), 0);
    return {
      id: snap.id,
      skillId: snap.skillId,
      instanceId: snap.instanceId,
      type: snap.type,
      createdAt: snap.createdAt,
      note: snap.note,
      source: snap.source,
      retained: !!snap.retained,
      fileCount,
      packageSizeBytes,
      contentCaptureStatus: snap.contentCaptureStatus || null,
      capturedFileCount: snap.capturedFileCount != null ? snap.capturedFileCount : null,
      metadataOnlyFileCount: snap.metadataOnlyFileCount != null ? snap.metadataOnlyFileCount : null,
      checkpointSummary: snap.checkpointData
        ? {
            instanceGroupCount: $coerceArray(snap.checkpointData.instanceGroups).length,
            hasCheckpoint: true
          }
        : null
    };
  }

  function getAssetSnapshots(assetId, options = {}) {
    const rid = resolveAssetId(assetId);
    if (!rid) return [];
    let snaps = getState().snapshots.filter(s => s.skillId === rid && s.source !== 'session-baseline');
    if (options.type && options.type !== 'all') snaps = snaps.filter(s => s.type === options.type);
    return snaps.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(s =>
      JSON.parse(JSON.stringify(toSnapshotSummary(s)))
    );
  }

  function getSnapshotDetail(snapshotId) {
    const snap = getState().snapshots.find(s => s.id === snapshotId);
    if (!snap) return null;
    const summary = toSnapshotSummary(snap);
    const files = $coerceArray(snap.files).map(f => ({
      relativePath: f.relativePath,
      fileType: f.fileType || 'text',
      mimeType: f.mimeType || '',
      sizeBytes: f.sizeBytes || 0,
      contentHash: f.contentHash || '',
      modifiedAt: f.modifiedAt || null,
      indexStatus: f.indexStatus || 'indexed',
      contentCaptureStatus: f.contentCaptureStatus || (f.content != null && f.content !== '' ? 'full' : 'metadata-only')
    }));
    return JSON.parse(JSON.stringify({ ...summary, files }));
  }

  function getSnapshotFileDetail(snapshotId, relativePath) {
    const snap = getState().snapshots.find(s => s.id === snapshotId);
    if (!snap) return null;
    const file = $coerceArray(snap.files).find(f => f.relativePath === relativePath);
    if (!file) return null;
    const meta = {
      snapshotId,
      relativePath: file.relativePath,
      fileType: file.fileType || 'text',
      mimeType: file.mimeType || '',
      sizeBytes: file.sizeBytes || 0,
      contentHash: file.contentHash || '',
      modifiedAt: file.modifiedAt || null,
      indexStatus: file.indexStatus || 'indexed',
      contentCaptureStatus: file.contentCaptureStatus || (file.content != null ? 'full' : 'metadata-only')
    };
    const isBinary = file.fileType === 'binary';
    const inst = snap.instanceId ? getInstanceRaw(snap.instanceId) : null;
    const perm = inst ? getInstancePermission(inst.id) : null;
    const canRead = perm && perm.readAccess && perm.contentAccessStatus === 'readable' && !perm.isMissing;
    if (isBinary || !canRead || file.content == null) {
      let status = 'permission-denied';
      if (isBinary) status = 'binary-metadata';
      else if (perm && perm.isMissing) status = 'historical-metadata';
      else if (perm && perm.contentAccessStatus) status = perm.contentAccessStatus;
      else if (!inst) status = 'denied';
      return JSON.parse(JSON.stringify({
        ...meta, content: null, contentForView: null, readAccess: false, contentAccessStatus: status
      }));
    }
    return JSON.parse(JSON.stringify({
      ...meta,
      content: String(file.content),
      contentForView: String(file.content),
      readAccess: true,
      contentAccessStatus: 'readable'
    }));
  }

  function getAssetSourceBinding(assetId) {
    const rid = resolveAssetId(assetId);
    if (!rid) return null;
    const asset = getState().assets.find(a => a.id === rid);
    const binding = asset && asset.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === asset.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === rid);
    if (!binding) {
      return JSON.parse(JSON.stringify({
        bound: false,
        updateStatus: 'unbound',
        message: '未绑定来源'
      }));
    }
    return JSON.parse(JSON.stringify({
      bound: true,
      ...normalizeSourceBinding(binding),
      message: null
    }));
  }

  function getAssetUsageSummary(assetId) {
    const rid = resolveAssetId(assetId);
    if (!rid) return null;
    const canonicalId = resolveCanonicalAssetId(rid);
    const state = getState();
    const asset = state.assets.find(a => a.id === canonicalId) || state.assets.find(a => a.id === rid);
    const primary = state.instances.find(i => i.skillId === canonicalId && i.isPrimary)
      || state.instances.find(i => i.skillId === canonicalId)
      || state.instances.find(i => i.skillId === rid && i.isPrimary)
      || state.instances.find(i => i.skillId === rid);
    const events = getCanonicalUsageEvents(rid, state);
    const adapterOk = hasUsageAdapter(asset, primary, state) || events.length > 0;
    if (!adapterOk) {
      return JSON.parse(JSON.stringify({
        supported: false,
        dataStatus: 'unsupported',
        displayCalls: null,
        displayLabel: '暂无数据',
        attributionLevel: 'no-data',
        calls: null, sessions: null,
        inputTokens: null, outputTokens: null, totalTokens: null,
        attributionRatio: null, coverage: null, sampleSize: 0,
        lastSync: null, adapterStatus: 'unsupported',
        trend: [], sourceHost: primary ? primary.hostType : null
      }));
    }
    if (!events.length) {
      return JSON.parse(JSON.stringify({
        supported: true,
        dataStatus: 'zero',
        displayCalls: 0,
        displayLabel: '0',
        attributionLevel: 'accurate',
        calls: 0, sessions: 0,
        inputTokens: 0, outputTokens: 0, totalTokens: 0,
        attributionRatio: 1, coverage: 1, sampleSize: 0,
        lastSync: $daysAgo(0), adapterStatus: 'ok',
        trend: Array.from({ length: 14 }, () => 0),
        sourceHost: primary ? primary.hostType : null
      }));
    }
    const levels = events.map(e => e.attributionLevel || 'accurate');
    let attributionLevel = 'accurate';
    if (levels.some(l => l === 'unattributed')) attributionLevel = 'unattributed';
    else if (levels.some(l => l === 'partial')) attributionLevel = 'partial';
    const sessions = new Set(events.map(e => e.sessionId).filter(Boolean)).size;
    const calls = events.reduce((s, e) => s + (e.callCount || 0), 0);
    const inputTokens = events.reduce((s, e) => s + (e.inputTokens || 0), 0);
    const outputTokens = events.reduce((s, e) => s + (e.outputTokens || 0), 0);
    const totalTokens = events.reduce((s, e) => s + (e.totalTokens || e.tokenCount || 0), 0);
    const lastUsed = events.reduce((latest, e) => (!latest || e.occurredAt > latest ? e.occurredAt : latest), null);
    const trend = [];
    for (let d = 13; d >= 0; d--) {
      const day = $dateOnly($daysAgo(d));
      trend.push(events.filter(e => $dateOnly(e.occurredAt) === day).reduce((s, e) => s + (e.callCount || 0), 0));
    }
    const attributed = events.filter(e => (e.attributionLevel || 'accurate') === 'accurate').length;
    return JSON.parse(JSON.stringify({
      supported: true,
      dataStatus: calls === 0 ? 'zero' : 'has-data',
      displayCalls: calls,
      displayLabel: String(calls),
      attributionLevel,
      calls, sessions,
      inputTokens, outputTokens, totalTokens,
      attributionRatio: events.length ? attributed / events.length : 1,
      coverage: 1,
      sampleSize: events.length,
      lastUsedAt: lastUsed,
      lastSync: $daysAgo(0),
      adapterStatus: 'ok',
      trend,
      sourceHost: primary ? primary.hostType : null
    }));
  }

  function getAssetAuditEvents(assetId, options = {}) {
    const rid = resolveAssetId(assetId);
    if (!rid) return [];
    const filter = options.filter || 'all';
    let events = getState().auditEvents.filter(e => e.skillId === rid);
    // Exclude ordinary usage calls
    events = events.filter(e => e.eventType !== 'call' && e.category !== 'usage');
    if (options.instanceId) events = events.filter(e => e.instanceId === options.instanceId);
    if (filter && filter !== 'all') events = events.filter(e => e.category === filter || e.eventType === filter);
    return events.sort((a, b) => b.time.localeCompare(a.time)).map(e => _freezeCopy(e));
  }

  function getAssetDetail(assetId) {
    const rid = resolveAssetId(assetId) || assetId;
    const raw = rid ? getState().assets.find(a => a.id === rid) : null;
    if (raw && raw.lifecycleStatus === 'deleted' && raw.mergedIntoAssetId) {
      return JSON.parse(JSON.stringify({
        mergedAway: true,
        canonicalAssetId: resolveCanonicalAssetId(raw.id),
        assetId: rid,
        id: rid
      }));
    }
    const summary = getAssetSummary(assetId);
    if (!summary) return null;
    const instances = getAssetInstances(assetId);
    const files = getAssetFiles(assetId);
    const source = getAssetSourceBinding(assetId);
    const usage = getAssetUsageSummary(assetId);
    const tasks = getState().pendingTasks
      .filter(t => t.skillId === summary.id && t.status === 'open')
      .map(t => normalizePendingTask(t));
    const textFiles = files.filter(f => f.fileType === 'text');
    const binaryFiles = files.filter(f => f.fileType === 'binary');
    const nested = files.filter(f => f.isNestedSkillMarker);
    const indexedFail = files.filter(f => f.indexStatus && f.indexStatus !== 'indexed');
    return JSON.parse(JSON.stringify({
      ...summary,
      instances,
      files,
      source,
      usage,
      pendingTasks: tasks,
      fileSummary: {
        total: files.length,
        text: textFiles.length,
        binary: binaryFiles.length,
        packageSizeBytes: files.reduce((s, f) => s + (f.sizeBytes || 0), 0),
        indexed: files.filter(f => f.indexStatus === 'indexed' || !f.indexStatus).length,
        indexFailed: indexedFail.length,
        nestedSkillCount: nested.length
      },
      instanceSummary: summary.instanceSummary,
      snapshots: getAssetSnapshots(assetId),
      auditPreview: getAssetAuditEvents(assetId).slice(0, 8)
    }));
  }

  function setPrimaryInstance(assetId, instanceId) {
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, error: 'Asset not found' };
    const inst = getState().instances.find(i => i.id === instanceId && i.skillId === asset.id);
    if (!inst) return { ok: false, error: 'Instance not found on asset' };
    if (inst.lifecycleStatus === 'missing') return { ok: false, error: 'Cannot set Missing instance as primary' };
    getState().instances.filter(i => i.skillId === asset.id).forEach(i => { i.isPrimary = i.id === instanceId; });
    asset.primaryInstanceId = instanceId;
    asset.updatedAt = $now();
    addAuditEvent({
      skillId: asset.id, instanceId, eventType: 'set_primary_instance', category: 'system',
      source: 'Skill Panel', result: 'completed', note: '设置主实例 · ' + inst.hostType
    });
    saveState();
    return { ok: true, assetId: asset.id, primaryInstanceId: instanceId };
  }

  function requestWritePermission(options = {}) {
    const instanceId = options.instanceId;
    const scopeType = options.scopeType || 'instance';
    if (scopeType !== 'instance' && scopeType !== 'directory') {
      return { ok: false, error: 'Invalid scopeType', code: 'invalid_scope_type' };
    }
    const inst = getState().instances.find(i => i.id === instanceId);
    if (!inst) return { ok: false, error: 'Instance not found' };
    if (inst.lifecycleStatus === 'missing') return { ok: false, error: 'Missing instance cannot receive write permission' };
    const scopePath = scopeType === 'directory' ? (options.scopePath || inst.rootPath) : (inst.skillFilePath || inst.rootPath);
    const wantRead = options.readAccess !== false;
    const wantWrite = options.writeAccess !== false;
    const affected = scopeType === 'directory'
      ? getState().instances.filter(i => $pathInScope(i.rootPath || i.skillFilePath, scopePath))
      : [inst];
    const grant = normalizePermissionGrant({
      id: uuid(),
      scopeType,
      scopeId: scopeType === 'instance' ? instanceId : null,
      scopePath,
      readAccess: wantRead,
      writeAccess: wantWrite,
      grantedAt: $now(),
      status: 'active',
      source: 'user',
      purpose: options.purpose || (wantWrite ? '编辑与应用更改' : '授予读取权限')
    });
    getState().permissionGrants.push(grant);
    affected.forEach(i => {
      if (wantWrite) i.permissionMode = 'managed';
      if (wantRead) {
        i.healthStatuses = $coerceArray(i.healthStatuses).filter(h => h !== 'permission-denied' && h !== 'permission_denied');
        if (!i.healthStatuses.length) i.healthStatuses = ['normal'];
      }
    });
    addAuditEvent({
      skillId: inst.skillId, instanceId, eventType: 'permission_grant', category: 'system',
      source: 'Skill Panel', result: 'completed',
      note: '授予权限 · ' + scopeType + ' · read=' + wantRead + ' write=' + wantWrite + ' · 影响 ' + affected.length + ' 个实例 · ' + affected.map(a => a.id).join(',')
    });
    saveState();
    return {
      ok: true,
      grant: normalizePermissionGrant(grant),
      affectedInstanceIds: affected.map(i => i.id)
    };
  }

  function revokeWritePermission(grantId) {
    const grant = getState().permissionGrants.find(g => g.id === grantId);
    if (!grant) return { ok: false, error: 'Grant not found' };
    grant.status = 'revoked';
    grant.revokedAt = $now();
    grant.writeAccess = false;
    grant.readAccess = false;
    let affected = [];
    if (grant.scopeType === 'instance' && grant.scopeId) {
      const inst = getState().instances.find(i => i.id === grant.scopeId);
      if (inst) {
        inst.permissionMode = 'read-only';
        const still = getInstancePermission(inst.id);
        if (still.writeAccess) inst.permissionMode = 'managed';
        affected = [inst.id];
        addAuditEvent({
          skillId: inst.skillId, instanceId: inst.id, eventType: 'permission_revoke', category: 'system',
          source: 'Skill Panel', result: 'completed',
          note: '撤销权限 · affected=' + inst.id
        });
      }
    } else if (grant.scopeType === 'directory' && grant.scopePath) {
      affected = getState().instances.filter(i => $pathInScope(i.rootPath || i.skillFilePath, grant.scopePath)).map(i => {
        i.permissionMode = 'read-only';
        const still = getInstancePermission(i.id);
        if (still.writeAccess) i.permissionMode = 'managed';
        return i.id;
      });
      addAuditEvent({
        eventType: 'permission_revoke', category: 'system', source: 'Skill Panel', result: 'completed',
        note: '撤销目录权限 · ' + grant.scopePath + ' · affected=' + affected.join(',')
      });
    }
    saveState();
    return { ok: true, grantId, affectedInstanceIds: affected };
  }

  function _resolveRelinkCandidate(options, instanceId) {
    const cands = getRelinkCandidates(instanceId);
    if (options.candidateId) {
      const byId = cands.find(c => c.id === options.candidateId);
      if (byId) return byId;
    }
    if (options.candidate && typeof options.candidate === 'object') {
      const c = options.candidate;
      const byPath = cands.find(x => $normalizePath(x.path) === $normalizePath(c.path));
      if (byPath && (!c.id || c.id === byPath.id)) return byPath;
    }
    return null;
  }

  function relinkInstance(options = {}) {
    const instanceId = options.instanceId;
    const mode = options.mode || 'rebind';
    const inst = getInstanceRaw(instanceId);
    if (!inst) return { ok: false, error: 'Instance not found' };
    if (options.userConfirmed !== true) {
      return { ok: false, error: 'User confirmation required', code: 'not_confirmed' };
    }
    const candidate = _resolveRelinkCandidate(options, instanceId);
    if (!candidate) {
      return { ok: false, error: 'Valid scanned candidate required', code: 'candidate_required' };
    }
    const confidence = candidate.confidence || 'low';
    const evidence = candidate.evidence || {
      nameMatch: !!candidate.nameMatch,
      skillMdHashMatch: !!candidate.skillMdHashMatch,
      packageHashMatch: !!candidate.packageHashMatch,
      sourceBindingMatch: !!candidate.sourceBindingMatch,
      structureMatch: !!candidate.structureMatch
    };
    if (mode === 'rebind') {
      if (confidence === 'low') {
        return { ok: false, error: 'Low confidence cannot rebind', code: 'low_confidence' };
      }
      if (confidence === 'medium' && options.extraConfirmed !== true) {
        return { ok: false, error: 'Medium confidence requires extra confirmation', code: 'medium_needs_confirm' };
      }
    }
    const newPath = candidate.path;
    if (!newPath) return { ok: false, error: 'Candidate path missing' };

    const conflict = getState().instances.find(i =>
      i.id !== instanceId &&
      i.lifecycleStatus !== 'missing' &&
      i.lifecycleStatus !== 'deleted' &&
      ($normalizePath(i.skillFilePath) === $normalizePath(newPath) ||
        $normalizePath(i.rootPath) === $normalizePath(String(newPath).replace(/\/SKILL\.md$/, '')))
    );
    if (conflict) return { ok: false, error: 'Path already bound to another valid instance', code: 'path_conflict' };

    const assetId = inst.skillId;
    const assetUuid = assetId;
    const instanceUuid = inst.id;
    const evidenceNote = 'confidence=' + confidence +
      ' name=' + !!evidence.nameMatch +
      ' skillMdHash=' + !!evidence.skillMdHashMatch +
      ' packageHash=' + !!evidence.packageHashMatch +
      ' source=' + !!evidence.sourceBindingMatch +
      ' structure=' + !!evidence.structureMatch;

    if (mode === 'rebind') {
      inst.skillFilePath = String(newPath).endsWith('SKILL.md') ? newPath : String(newPath).replace(/\/?$/, '/') + 'SKILL.md';
      inst.rootPath = inst.skillFilePath.replace(/\/SKILL\.md$/, '');
      inst.lifecycleStatus = 'available';
      inst.missingSince = null;
      inst.lastSeenAt = $now();
      if (candidate.hostType) inst.hostType = candidate.hostType;
      reconcileAssetLifecycle(assetId);
      addAuditEvent({
        skillId: assetId, instanceId, eventType: 'relink', category: 'system',
        source: 'Skill Panel', result: 'completed', targetPath: inst.skillFilePath,
        note: '重新绑定 Instance · 保留 UUID · ' + evidenceNote
      });
      saveState();
      return {
        ok: true, mode: 'rebind',
        assetId: assetUuid, instanceId: instanceUuid,
        path: inst.skillFilePath,
        confidence, evidence
      };
    }

    const newId = uuid();
    const skillFilePath = String(newPath).endsWith('SKILL.md') ? newPath : String(newPath).replace(/\/?$/, '/') + 'SKILL.md';
    const rootPath = skillFilePath.replace(/\/SKILL\.md$/, '');
    const candFiles = $coerceArray(candidate.files);
    let packageSizeBytes = candFiles.reduce((n, f) => n + (f.sizeBytes || 0), 0);

    getState().instances.push(normalizeInstance({
      id: newId,
      skillId: assetId,
      hostType: candidate.hostType || inst.hostType,
      rootPath,
      skillFilePath,
      lifecycleStatus: 'available',
      permissionMode: 'read-only',
      installedVersion: candidate.installedVersion || inst.installedVersion,
      healthStatuses: ['normal'],
      localModificationStatus: 'clean',
      isPrimary: false,
      lastSeenAt: $now(),
      contentHash: candidate.contentHash || (candFiles[0] && candFiles[0].contentHash) || '',
      fileCount: candFiles.length || 0,
      packageSizeBytes
    }));

    if (candFiles.length) {
      candFiles.forEach(cf => {
        const isBinary = cf.fileType === 'binary';
        getState().files.push(normalizeFile({
          id: uuid(),
          instanceId: newId,
          skillId: assetId,
          relativePath: cf.relativePath,
          fileType: cf.fileType || 'text',
          mimeType: cf.mimeType || 'text/markdown',
          sizeBytes: cf.sizeBytes || (cf.content ? String(cf.content).length : 0),
          content: isBinary ? '' : String(cf.content || ''),
          contentHash: cf.contentHash || $hash(cf.content || ''),
          modifiedAt: cf.modifiedAt || $now(),
          tokenCount: isBinary ? null : $tokenApprox(cf.content || ''),
          tokenCountMode: isBinary ? 'unavailable' : 'estimated',
          indexStatus: cf.indexStatus || 'indexed'
        }));
      });
    } else {
      getState().files.push(normalizeFile({
        id: uuid(),
        instanceId: newId,
        skillId: assetId,
        relativePath: 'SKILL.md',
        fileType: 'text',
        mimeType: 'text/markdown',
        sizeBytes: 0,
        content: '',
        contentHash: $hash(''),
        modifiedAt: $now(),
        tokenCount: null,
        tokenCountMode: 'unavailable',
        indexStatus: 'pending-rescan',
        skipReason: 'awaiting-rescan'
      }));
      const newInst = getState().instances.find(i => i.id === newId);
      if (newInst) {
        newInst.fileCount = 1;
        newInst.packageSizeBytes = 0;
      }
    }

    getState().permissionGrants.push(normalizePermissionGrant({
      id: uuid(), scopeType: 'instance', scopeId: newId, scopePath: skillFilePath,
      readAccess: true, writeAccess: false, status: 'active'
    }));
    reconcileAssetLifecycle(assetId);
    addAuditEvent({
      skillId: assetId, instanceId: newId, eventType: 'relink_add_instance', category: 'system',
      source: 'Skill Panel', result: 'completed', targetPath: skillFilePath,
      note: '作为新 Instance 添加 · Asset UUID 保留 · 原 Missing 保留 · ' + evidenceNote +
        (candFiles.length ? ' · files=' + candFiles.length : ' · pending-rescan')
    });
    saveState();
    return {
      ok: true, mode: 'add-new',
      assetId: assetUuid,
      originalInstanceId: instanceUuid,
      newInstanceId: newId,
      path: skillFilePath,
      confidence, evidence,
      indexStatus: candFiles.length ? 'indexed' : 'pending-rescan',
      fileCount: candFiles.length || 1
    };
  }

  function detachInstance(instanceId) {
    const inst = getInstanceRaw(instanceId);
    if (!inst) return { ok: false, error: 'Instance not found' };
    const assetId = inst.skillId;
    const wasPrimary = !!inst.isPrimary;
    getState().files = getState().files.filter(f => f.instanceId !== instanceId);
    getState().permissionGrants = getState().permissionGrants.filter(g => !(g.scopeType === 'instance' && g.scopeId === instanceId));
    getState().instances = getState().instances.filter(i => i.id !== instanceId);
    const remaining = getState().instances.filter(i => i.skillId === assetId);
    const asset = getAssetRaw(assetId);
    if (asset) {
      if (!remaining.length) {
        asset.lifecycleStatus = 'missing';
        asset.primaryInstanceId = null;
      } else if (wasPrimary) {
        const next = remaining.find(i => i.lifecycleStatus === 'available') || remaining[0];
        remaining.forEach(i => { i.isPrimary = i.id === next.id; });
        asset.primaryInstanceId = next.id;
      }
      asset.updatedAt = $now();
    }
    addAuditEvent({
      skillId: assetId, instanceId, eventType: 'detach_instance', category: 'system',
      source: 'Skill Panel', result: 'completed',
      note: '解除管理（仅移除索引，未删除宿主文件）'
    });
    saveState();
    return { ok: true, assetId, instanceId, remainingCount: remaining.length };
  }

  function getRelinkCandidates(instanceId) {
    const inst = getInstanceRaw(instanceId);
    if (!inst) return [];
    const asset = getAssetRaw(inst.skillId) || {};
    const name = asset.name || 'skill';
    const base = inst.rootPath || '~/Skills/unknown';
    const restoredContent = '---\nname: ' + name + '\n---\n# Restored ' + name + '\n\nCandidate scan content (not copied from missing instance).\nPHASE_D1_CANDIDATE_MARKER\n';
    const highPath = $normalizePath(base.replace(/[^/]+$/, name + '-restored') + '/SKILL.md');
    const medPath = $normalizePath('~/Downloads/' + name + '/SKILL.md');
    const lowPath = $normalizePath('~/Desktop/maybe-' + name + '/SKILL.md');
    return [
      {
        id: seedUuid('relink-cand-high-' + String(instanceId).slice(-8)),
        path: highPath,
        hostType: inst.hostType,
        nameMatch: true,
        skillMdHashMatch: true,
        packageHashMatch: false,
        sourceBindingMatch: !!inst.sourceBindingId,
        structureMatch: true,
        evidence: {
          nameMatch: true,
          skillMdHashMatch: true,
          packageHashMatch: false,
          sourceBindingMatch: !!inst.sourceBindingId,
          structureMatch: true
        },
        confidence: 'high',
        files: [
          {
            relativePath: 'SKILL.md',
            fileType: 'text',
            mimeType: 'text/markdown',
            sizeBytes: restoredContent.length,
            contentHash: $hash(restoredContent),
            content: restoredContent,
            modifiedAt: $now(),
            indexStatus: 'indexed'
          }
        ]
      },
      {
        id: seedUuid('relink-cand-med-' + String(instanceId).slice(-8)),
        path: medPath,
        hostType: 'custom',
        nameMatch: true,
        skillMdHashMatch: false,
        packageHashMatch: false,
        sourceBindingMatch: false,
        structureMatch: true,
        evidence: {
          nameMatch: true,
          skillMdHashMatch: false,
          packageHashMatch: false,
          sourceBindingMatch: false,
          structureMatch: true
        },
        confidence: 'medium',
        files: [
          {
            relativePath: 'SKILL.md',
            fileType: 'text',
            mimeType: 'text/markdown',
            sizeBytes: 40,
            contentHash: $hash('medium-candidate-only'),
            content: '# Medium candidate only\n',
            modifiedAt: $now(),
            indexStatus: 'indexed'
          }
        ]
      },
      {
        id: seedUuid('relink-cand-low-' + String(instanceId).slice(-8)),
        path: lowPath,
        hostType: 'custom',
        nameMatch: true,
        skillMdHashMatch: false,
        packageHashMatch: false,
        sourceBindingMatch: false,
        structureMatch: false,
        evidence: {
          nameMatch: true,
          skillMdHashMatch: false,
          packageHashMatch: false,
          sourceBindingMatch: false,
          structureMatch: false
        },
        confidence: 'low',
        files: []
      }
    ];
  }

  /* ========== Phase E.0 + Editor / Conflict APIs ========== */

  function isDevNavigationBypass() {
    try {
      if (typeof location !== 'undefined') {
        const q = new URLSearchParams(location.search || '');
        if (q.get('dev') === '1') {
          try { if (typeof localStorage !== 'undefined') localStorage.setItem('sp-dev', '1'); } catch (_) { /* ignore */ }
          return true;
        }
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem('sp-dev') === '1') return true;
    } catch (_) { /* ignore */ }
    return false;
  }
  function isTestMode() {
    try {
      if (typeof location === 'undefined') return false;
      const q = new URLSearchParams(location.search || '');
      return q.get('dev') === '1';
    } catch (_) { return false; }
  }
  function isDevMode() { return isDevNavigationBypass(); }

  function toDraftSummary(d) {
    if (!d) return null;
    return {
      id: d.id,
      skillId: d.skillId,
      instanceId: d.instanceId,
      fileId: d.fileId,
      sessionId: d.sessionId || null,
      relativePath: d.relativePath || null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      baseContentHash: d.baseContentHash,
      baseFileModifiedAt: d.baseFileModifiedAt,
      status: d.status,
      lastAutosaveResult: d.lastAutosaveResult,
      hasContent: d.content != null && String(d.content).length > 0,
      contentLength: d.content != null ? String(d.content).length : 0
    };
  }

  function toSafeConflictView(c) {
    if (!c) return null;
    return {
      id: c.id,
      sessionId: c.sessionId || null,
      assetId: c.assetId || null,
      instanceId: c.instanceId || null,
      status: c.status || null,
      scope: c.scope || 'file',
      reason: c.reason || null,
      globalReason: c.globalReason || null,
      createdAt: c.createdAt || null,
      snapshotId: c.snapshotId || null,
      diffViewed: !!c.diffViewed,
      files: (c.files || []).map(f => ({
        fileId: f.fileId || null,
        relativePath: f.relativePath || null,
        kind: f.kind || null,
        deleted: !!f.deleted,
        isPackageAdded: !!f.isPackageAdded,
        baseHash: f.baseHash || null,
        currentHash: f.currentHash || null,
        hasDraft: f.draftContent != null || f.hasDraft === true
      }))
    };
  }

  function toSafeScanDiscoveryView(d) {
    if (!d) return null;
    return {
      id: d.id,
      scanSessionId: d.scanSessionId || null,
      candidateSkillId: d.candidateSkillId || null,
      path: d.path || null,
      hostType: d.hostType || null,
      skillName: d.skillName || null,
      fileCount: d.fileCount || (d.files || []).length || 0,
      packageSizeBytes: d.packageSizeBytes || 0,
      discoveredAt: d.discoveredAt || null,
      status: d.status || null,
      permissionStatus: d.permissionStatus || null,
      healthIssues: Array.isArray(d.healthIssues) ? d.healthIssues.slice() : [],
      isNew: !!d.isNew,
      isDuplicate: !!d.isDuplicate,
      evidence: d.evidence ? JSON.parse(JSON.stringify(d.evidence)) : null,
      contentSummary: {
        hasSkillFile: !!(d.skillFileContent && String(d.skillFileContent).length),
        skillFileBytes: d.skillFileContent ? String(d.skillFileContent).length : 0,
        skillFileHash: d.skillFileContent ? $hash(String(d.skillFileContent)) : null
      },
      files: (d.files || []).map(f => ({
        relativePath: f.relativePath || null,
        sizeBytes: f.sizeBytes || 0,
        contentHash: f.contentHash || null,
        fileType: f.fileType || null
      }))
    };
  }

  function toSafeOperationView(op) {
    if (!op) return null;
    const copy = JSON.parse(JSON.stringify(op));
    // Never expose prepared bodies / draft bodies / file contents on operations
    delete copy.preparedFileBodies;
    delete copy.draftContents;
    delete copy.fileContents;
    delete copy.remoteContents;
    delete copy._remoteContents;
    delete copy.localContents;
    delete copy.baseContents;
    delete copy._checkpoint;
    delete copy._entityCheckpoint;
    delete copy._instanceCheckpoints;
    delete copy._rebindCheckpoint;
    delete copy._confirmationPayload;
    if (Array.isArray(copy.draftStates)) {
      copy.draftStates = copy.draftStates.map(d => ({
        draftId: d.draftId, fileId: d.fileId, relativePath: d.relativePath,
        contentHash: d.contentHash, updatedAt: d.updatedAt, baseContentHash: d.baseContentHash, status: d.status
      }));
    }
    if (Array.isArray(copy.remoteContentStates)) {
      copy.remoteContentStates = copy.remoteContentStates.map(s => ({
        relativePath: s.relativePath, exists: !!s.exists, fileType: s.fileType || null,
        contentHash: s.contentHash || null, sizeBytes: s.sizeBytes != null ? s.sizeBytes : 0
      }));
    }
    if (Array.isArray(copy.remoteAdds)) {
      copy.remoteAdds = copy.remoteAdds.map(a => (typeof a === 'string' ? { relativePath: a } : {
        relativePath: a.relativePath,
        exists: a.exists != null ? !!a.exists : true,
        fileType: a.fileType || null,
        contentHash: a.contentHash || null,
        sizeBytes: a.sizeBytes != null ? a.sizeBytes : 0
      }));
    }
    return copy;
  }

  function stripBodyFieldsDeep(value, depth) {
    if (value == null || depth > 12) return value;
    if (Array.isArray(value)) return value.map(v => stripBodyFieldsDeep(v, depth + 1));
    if (typeof value !== 'object') return value;
    const out = {};
    const banned = new Set([
      'content', 'contentForView', 'skillFileContent', 'baseContent', 'currentContent', 'draftContent',
      'draftBackup', '_baseContent', 'remoteContent', 'localContent', 'mergedContent', 'checkpointData'
    ]);
    Object.keys(value).forEach(k => {
      if (banned.has(k)) return;
      out[k] = stripBodyFieldsDeep(value[k], depth + 1);
    });
    return out;
  }

  function toSafeStateView(state) {
    const copy = stripBodyFieldsDeep(state, 0);
    copy.files = (state.files || []).map(f => toFileMetadata(f));
    copy.snapshots = (state.snapshots || []).map(s => toSnapshotSummary(s));
    copy.drafts = (state.drafts || []).map(d => toDraftSummary(d));
    copy.conflicts = (state.conflicts || []).map(c => toSafeConflictView(c));
    copy.scanDiscoveries = (state.scanDiscoveries || []).map(d => toSafeScanDiscoveryView(d));
    copy.applyOperations = (state.applyOperations || []).map(o => toSafeOperationView(o));
    copy.forceApplyOperations = (state.forceApplyOperations || []).map(o => toSafeOperationView(o));
    copy.installOperations = (state.installOperations || []).map(o => toSafeOperationView(o));
    copy.updateOperations = (state.updateOperations || []).map(o => toSafeOperationView(o));
    copy.uninstallOperations = (state.uninstallOperations || []).map(o => toSafeOperationView(o));
    copy.duplicateResolutionOperations = (state.duplicateResolutionOperations || []).map(o => toSafeOperationView(o));
    return copy;
  }

  function getPublicState() {
    return toSafeStateView(getState());
  }

  function ensureEditorCollections() {
    const state = getState();
    if (!state.editorSessions) state.editorSessions = [];
    if (!state.conflicts) state.conflicts = [];
    if (!state.applyOperations) state.applyOperations = [];
    if (!state.forceApplyOperations) state.forceApplyOperations = [];
    if (!state.installOperations) state.installOperations = [];
    if (!state.updateOperations) state.updateOperations = [];
    if (!state.uninstallOperations) state.uninstallOperations = [];
    if (!state.compareSessions) state.compareSessions = [];
    if (!state.editorSim) {
      state.editorSim = {
        autosaveFail: false,
        applyFailRelativePath: null,
        rollbackFail: false,
        externalChangeCase: null,
        forceDiffViewed: {}
      };
    }
    if (!state.viewStates.editor) {
      state.viewStates.editor = {
        assetId: null, instanceId: null, sessionId: null, selectedFileId: null,
        expandedFileNodes: [], rightPanel: 'preview', previewMode: 'rendered',
        diffMode: 'current-draft', search: '', scrollTop: 0, cursorPositions: {},
        filesPanelWidth: 240, rightPanelWidth: 360, narrowPane: 'editor'
      };
    }
    if (!state.viewStates.conflict) {
      state.viewStates.conflict = {
        conflictId: null, selectedFileId: null, diffMode: 'three-way', scrollTop: 0
      };
    }
  }

  function getEditorViewState() {
    ensureEditorCollections();
    return JSON.parse(JSON.stringify(getState().viewStates.editor));
  }
  function setEditorViewState(patch) {
    ensureEditorCollections();
    Object.assign(getState().viewStates.editor, patch || {});
    saveState();
    return getEditorViewState();
  }
  function getConflictViewState() {
    ensureEditorCollections();
    return JSON.parse(JSON.stringify(getState().viewStates.conflict));
  }
  function setConflictViewState(patch) {
    ensureEditorCollections();
    Object.assign(getState().viewStates.conflict, patch || {});
    saveState();
    return getConflictViewState();
  }

  const EDITABLE_EXTS = ['.md', '.txt', '.json', '.yaml', '.yml', '.js', '.ts', '.py', '.sh'];
  const MAX_EDIT_BYTES = 200000;

  function isTextEditableFile(file) {
    if (!file) return { ok: false, reason: '文件不存在' };
    if (file.fileType === 'binary') return { ok: false, reason: '二进制文件不可内置编辑' };
    if (file.indexStatus === 'missing' || file.indexStatus === 'failed') return { ok: false, reason: '文件索引不可用' };
    const path = String(file.relativePath || '');
    const lower = path.toLowerCase();
    const hasExt = EDITABLE_EXTS.some(ext => lower.endsWith(ext)) || lower === 'skill.md' || !path.includes('.');
    if (!hasExt && file.fileType !== 'text') return { ok: false, reason: '未知类型，不自动编辑' };
    if ((file.sizeBytes || 0) > MAX_EDIT_BYTES) return { ok: false, reason: '文件超过编辑大小阈值' };
    return { ok: true, reason: null };
  }

  function packageHashForInstance(instanceId) {
    const files = getFilesRawInternal({ instanceId }).slice().sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return $hash(files.map(f => f.relativePath + ':' + (f.contentHash || '')).join('|'));
  }

  function sessionToPublic(session) {
    if (!session) return null;
    return JSON.parse(JSON.stringify({
      id: session.id,
      assetId: session.assetId,
      instanceId: session.instanceId,
      mode: session.mode,
      readAccess: session.readAccess,
      writeAccess: session.writeAccess,
      openedAt: session.openedAt,
      basePackageHash: session.basePackageHash,
      baseSnapshotId: session.baseSnapshotId || null,
      baseFileStates: session.baseFileStates,
      editableFileIds: session.editableFileIds,
      status: session.status,
      blockedReason: session.blockedReason || null
    }));
  }

  function getEditorSession(sessionId) {
    ensureEditorCollections();
    const s = getState().editorSessions.find(x => x.id === sessionId);
    return sessionToPublic(s);
  }

  function getEditorSessionRaw(sessionId) {
    ensureEditorCollections();
    return getState().editorSessions.find(x => x.id === sessionId) || null;
  }

  function refreshSessionPermissions(session) {
    if (!session) return null;
    const inst = getInstanceRaw(session.instanceId);
    if (!inst || inst.lifecycleStatus === 'missing') {
      session.status = 'expired';
      session.readAccess = false;
      session.writeAccess = false;
      session.blockedReason = 'Instance is missing';
      return session;
    }
    const perm = getInstancePermission(inst.id);
    session.readAccess = !!(perm && perm.readAccess);
    session.writeAccess = !!(perm && perm.writeAccess);
    if (!session.readAccess) {
      session.status = 'denied';
      session.blockedReason = 'No read access';
    } else if (session.mode === 'editable' && !session.writeAccess) {
      session.status = 'read-only-degraded';
      session.mode = 'read-only';
      session.blockedReason = 'Write permission revoked';
      session.editableFileIds = [];
    } else if (session.status === 'denied' || session.status === 'expired') {
      session.status = 'active';
      session.blockedReason = null;
    }
    return session;
  }

  const APPLY_OP_TTL_MS = 10 * 60 * 1000;
  const FORCE_OP_TTL_MS = 10 * 60 * 1000;

  function capturePreparedFileState(file) {
    if (!file) return null;
    return {
      fileId: file.id,
      relativePath: file.relativePath,
      contentHash: file.contentHash || '',
      modifiedAt: file.modifiedAt || null,
      sizeBytes: file.sizeBytes || 0,
      exists: true
    };
  }

  function captureDraftState(d) {
    return {
      draftId: d.id,
      fileId: d.fileId,
      relativePath: d.relativePath,
      contentHash: $hash(String(d.content || '')),
      updatedAt: d.updatedAt || null,
      baseContentHash: d.baseContentHash || '',
      status: d.status
    };
  }

  function fingerprintDraftStates(drafts) {
    return $hash(JSON.stringify((drafts || []).map(captureDraftState).sort((a, b) => String(a.fileId).localeCompare(String(b.fileId)))));
  }

  function fingerprintDiff(allDiff) {
    return $hash(JSON.stringify(allDiff || {}));
  }

  function fingerprintValidation(validation) {
    return $hash(JSON.stringify({
      blocksApply: !!(validation && validation.blocksApply),
      problems: ((validation && validation.problems) || []).map(p => ({ code: p.code, fileId: p.fileId, severity: p.severity }))
    }));
  }

  function assetHasSourceBinding(assetId) {
    const state = getState();
    const asset = getAssetRaw(assetId);
    if (asset && asset.sourceBindingId) return true;
    return (state.sourceBindings || []).some(b => b.skillId === assetId);
  }

  function getBaselineSnapshot(session) {
    if (!session || !session.baseSnapshotId) return null;
    return getState().snapshots.find(s => s.id === session.baseSnapshotId) || null;
  }

  function getBaselineFileContent(session, fileId, relativePath) {
    const snap = getBaselineSnapshot(session);
    if (!snap || !Array.isArray(snap.files)) return null;
    const rec = snap.files.find(f => f.fileId === fileId)
      || snap.files.find(f => f.relativePath === relativePath);
    if (!rec) return null;
    if (rec.content != null) return String(rec.content);
    return null;
  }

  function createSessionBaselineSnapshot(session) {
    const snap = createPackageSnapshotForInstance(session.instanceId, {
      note: 'Session baseline (internal)',
      source: 'session-baseline',
      retained: false
    });
    if (!snap) return null;
    getState().snapshots.push(snap);
    session.baseSnapshotId = snap.id;
    return snap;
  }

  function resolveTasksForApply(assetId, types) {
    const wanted = new Set(types || []);
    getState().pendingTasks.forEach(t => {
      if (t.skillId === assetId && t.status === 'open' && wanted.has(t.taskType)) {
        t.status = 'resolved';
        t.resolvedAt = $now();
      }
    });
  }

  function updateInstanceAfterWrite(inst) {
    if (!inst) return;
    const files = getFilesRawInternal({ instanceId: inst.id });
    const skillMd = files.find(f => f.relativePath === 'SKILL.md');
    if (skillMd) inst.contentHash = skillMd.contentHash;
    inst.packageSizeBytes = files.reduce((n, f) => n + (f.sizeBytes || 0), 0);
    inst.fileCount = files.length;
    inst.lastModifiedAt = $now();
    const asset = getAssetRaw(inst.skillId);
    if (asset) asset.updatedAt = $now();
    if (assetHasSourceBinding(inst.skillId)) {
      inst.localModificationStatus = 'modified';
    } else {
      inst.localModificationStatus = 'clean-local';
    }
  }

  function refreshSessionBaseAfterApply(session) {
    session.baseFileStates = getFilesRawInternal({ instanceId: session.instanceId }).map(f => ({
      fileId: f.id,
      relativePath: f.relativePath,
      contentHash: f.contentHash || '',
      modifiedAt: f.modifiedAt || null,
      sizeBytes: f.sizeBytes || 0
    }));
    session.basePackageHash = packageHashForInstance(session.instanceId);
    createSessionBaselineSnapshot(session);
  }

  function compareFormalToPrepared(preparedFileStates, instanceId, preparedPackageHash) {
    const changes = [];
    const files = getFilesRawInternal({ instanceId });
    const currentPkg = packageHashForInstance(instanceId);
    if ((preparedPackageHash || '') !== (currentPkg || '')) {
      changes.push({ fileId: null, relativePath: null, kind: 'package-hash-changed' });
    }
    (preparedFileStates || []).forEach(prep => {
      const cur = getFileRawInternal(prep.fileId);
      if (!prep.exists) {
        if (cur) changes.push({ fileId: prep.fileId, relativePath: prep.relativePath, kind: 'added' });
        return;
      }
      if (!cur) {
        changes.push({ fileId: prep.fileId, relativePath: prep.relativePath, kind: 'deleted' });
        return;
      }
      if ((cur.contentHash || '') !== (prep.contentHash || '')
        || (cur.modifiedAt || '') !== (prep.modifiedAt || '')
        || (cur.sizeBytes || 0) !== (prep.sizeBytes || 0)) {
        changes.push({ fileId: cur.id, relativePath: cur.relativePath, kind: 'content-changed' });
      }
    });
    files.forEach(f => {
      if (!(preparedFileStates || []).some(p => p.fileId === f.id)) {
        changes.push({ fileId: f.id, relativePath: f.relativePath, kind: 'added' });
      }
    });
    return changes;
  }

  function draftsUnchanged(op, sessionId) {
    const drafts = getState().drafts.filter(d => d.sessionId === sessionId);
    const nowHash = fingerprintDraftStates(drafts);
    return nowHash === op.draftStatesHash;
  }

  function cancelApplyOperation(operationId) {
    ensureEditorCollections();
    const op = getState().applyOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'not_found' };
    if (op.status === 'prepared') {
      op.status = 'cancelled';
      op.cancelledAt = $now();
      saveState();
    }
    return { ok: true, operationId, status: op.status };
  }

  function cancelForceApplyOperation(forceOperationId) {
    ensureEditorCollections();
    const op = getState().forceApplyOperations.find(o => o.id === forceOperationId);
    if (!op) return { ok: false, code: 'not_found' };
    if (op.status === 'prepared') {
      op.status = 'cancelled';
      op.cancelledAt = $now();
      saveState();
    }
    return { ok: true, forceOperationId, status: op.status };
  }

  // Replace D.2 stub with full session creation
  function openEditorSession(options = {}) {
    ensureEditorCollections();
    const assetId = resolveAssetId(options.assetId) || options.assetId;
    const instanceId = options.instanceId;
    const mode = options.mode || 'read-only';
    if (!assetId) {
      return { ok: false, mode, assetId: null, instanceId: null, readAccess: false, writeAccess: false, editableFileIds: [], blockedReason: 'Asset not found', code: 'not_found' };
    }
    const inst = instanceId
      ? getInstanceRaw(instanceId)
      : getState().instances.find(i => i.skillId === assetId && i.isPrimary) || getState().instances.find(i => i.skillId === assetId);
    if (!inst || (instanceId && inst.id !== instanceId)) {
      return { ok: false, mode, assetId, instanceId: instanceId || null, readAccess: false, writeAccess: false, editableFileIds: [], blockedReason: 'Instance not found', code: 'not_found' };
    }
    if (inst.skillId !== assetId) {
      return { ok: false, mode, assetId, instanceId: inst.id, readAccess: false, writeAccess: false, editableFileIds: [], blockedReason: 'Instance not on asset', code: 'mismatch' };
    }
    if (inst.lifecycleStatus === 'missing') {
      return { ok: false, mode, assetId, instanceId: inst.id, readAccess: false, writeAccess: false, editableFileIds: [], blockedReason: 'Instance is missing', code: 'missing' };
    }
    if (!(inst.skillFilePath || inst.rootPath)) {
      return { ok: false, mode, assetId, instanceId: inst.id, readAccess: false, writeAccess: false, editableFileIds: [], blockedReason: 'No valid path', code: 'no_path' };
    }
    const perm = getInstancePermission(inst.id);
    if (!perm || !perm.readAccess) {
      return { ok: false, mode, assetId, instanceId: inst.id, readAccess: false, writeAccess: false, editableFileIds: [], blockedReason: 'No read access', code: 'permission-denied' };
    }
    if (mode === 'editable' && !perm.writeAccess) {
      return { ok: false, mode: 'editable', assetId, instanceId: inst.id, readAccess: true, writeAccess: false, editableFileIds: [], blockedReason: 'No write access', code: 'read-only' };
    }
    if (mode !== 'editable' && mode !== 'read-only') {
      return { ok: false, mode, assetId, instanceId: inst.id, readAccess: perm.readAccess, writeAccess: perm.writeAccess, editableFileIds: [], blockedReason: 'Invalid mode', code: 'invalid_mode' };
    }
    const files = getFilesRawInternal({ instanceId: inst.id });
    const editableFileIds = (mode === 'editable' && perm.writeAccess)
      ? files.filter(f => isTextEditableFile(f).ok).map(f => f.id)
      : [];
    const baseFileStates = files.map(f => ({
      fileId: f.id,
      relativePath: f.relativePath,
      contentHash: f.contentHash || '',
      modifiedAt: f.modifiedAt || null,
      sizeBytes: f.sizeBytes || 0
    }));
    const session = {
      id: uuid(),
      assetId,
      instanceId: inst.id,
      mode,
      readAccess: true,
      writeAccess: !!(mode === 'editable' && perm.writeAccess),
      openedAt: $now(),
      basePackageHash: packageHashForInstance(inst.id),
      baseFileStates,
      editableFileIds,
      status: 'active',
      blockedReason: null
    };
    const baseline = createSessionBaselineSnapshot(session);
    if (!baseline) {
      return { ok: false, mode, assetId, instanceId: inst.id, readAccess: true, writeAccess: !!(mode === 'editable' && perm.writeAccess), editableFileIds, blockedReason: 'Baseline snapshot failed', code: 'snapshot_failed' };
    }
    getState().editorSessions.push(session);
    setEditorViewState({
      assetId, instanceId: inst.id, sessionId: session.id,
      selectedFileId: (files.find(f => f.relativePath === 'SKILL.md') || files[0] || {}).id || null
    });
    addAuditEvent({
      skillId: assetId, instanceId: inst.id, eventType: 'editor_session_opened', category: 'edit',
      source: 'Skill Panel', result: 'completed', note: '打开 Editor · ' + mode
    });
    saveState();
    return Object.assign({ ok: true, blockedReason: null, code: null }, sessionToPublic(session));
  }

  function restoreEditorSession(sessionId) {
    const session = getEditorSessionRaw(sessionId);
    if (!session) return { ok: false, code: 'expired', blockedReason: 'Editor Session 已过期或不存在' };
    refreshSessionPermissions(session);
    saveState();
    if (session.status === 'expired' || session.status === 'denied') {
      return { ok: false, code: session.status, blockedReason: session.blockedReason, session: sessionToPublic(session) };
    }
    return { ok: true, session: sessionToPublic(session) };
  }

  function requireEditorSession(sessionId, opts = {}) {
    const session = getEditorSessionRaw(sessionId);
    if (!session) return { ok: false, error: 'Session not found', code: 'expired' };
    refreshSessionPermissions(session);
    if (session.status === 'expired') return { ok: false, error: session.blockedReason, code: 'expired', session };
    if (!session.readAccess) return { ok: false, error: 'No read access', code: 'permission-denied', session };
    if (opts.requireWrite && (session.mode !== 'editable' || !session.writeAccess)) {
      return { ok: false, error: 'No write access', code: 'read-only', session };
    }
    return { ok: true, session };
  }

  function getDraftSummaries(assetId) {
    const rid = resolveAssetId(assetId);
    if (!rid) return [];
    return getState().drafts.filter(d => d.skillId === rid).map(d => toDraftSummary(d));
  }

  function findDraftForFile(sessionId, fileId) {
    return getState().drafts.find(d => d.sessionId === sessionId && d.fileId === fileId)
      || getState().drafts.find(d => d.fileId === fileId && (!d.sessionId || d.sessionId === sessionId));
  }

  function getEditorFileContent(sessionId, fileId) {
    const session = getEditorSessionRaw(sessionId);
    if (!session) return { ok: false, code: 'expired', error: 'Session not found', content: null, contentForView: null };
    refreshSessionPermissions(session);
    const gate = { ok: true, session, code: null, error: null };
    if (!session.readAccess) {
      const draftOnly = findDraftForFile(sessionId, fileId);
      if (!draftOnly) {
        return { ok: false, code: 'permission-denied', error: 'No read access (re-grant required for formal files; local drafts remain manageable when present)', content: null, contentForView: null, draftPolicy: 'local-draft-allowed-if-present' };
      }
    }
    const file = getFileRawInternal(fileId);
    if (!file || file.instanceId !== gate.session.instanceId) {
      return { ok: false, code: 'mismatch', error: 'File not in session instance', content: null, contentForView: null };
    }
    const edit = isTextEditableFile(file);
    const meta = toFileMetadata(file);
    if (file.fileType === 'binary') {
      return JSON.parse(JSON.stringify({
        ok: true, ...meta, content: null, contentForView: null, editable: false,
        reason: edit.reason, isBinary: true, draftStatus: null
      }));
    }
    if (!edit.ok) {
      return JSON.parse(JSON.stringify({
        ok: true, ...meta, content: null, contentForView: null, editable: false,
        reason: edit.reason, isBinary: false, draftStatus: null
      }));
    }
    const draft = findDraftForFile(sessionId, fileId);
    const content = draft ? String(draft.content) : String(file.content || '');
    return JSON.parse(JSON.stringify({
      ok: true, ...meta,
      content, contentForView: content,
      editable: gate.session.mode === 'editable' && gate.session.writeAccess && gate.session.editableFileIds.includes(fileId),
      reason: null, isBinary: false,
      draftStatus: draft ? draft.status : 'clean',
      draftId: draft ? draft.id : null,
      baseContentHash: draft ? draft.baseContentHash : file.contentHash
    }));
  }

  function getEditorDraft(sessionId, fileId) {
    const session = getEditorSessionRaw(sessionId);
    if (!session) return null;
    refreshSessionPermissions(session);
    const draft = findDraftForFile(sessionId, fileId);
    if (!draft) return null;
    if (draft.skillId !== session.assetId || draft.instanceId !== session.instanceId) return null;
    const file = getFileRawInternal(fileId);
    if (file && file.instanceId !== session.instanceId) return null;
    return JSON.parse(JSON.stringify({
      ...toDraftSummary(draft),
      content: String(draft.content || ''),
      contentForView: String(draft.content || ''),
      permissionNote: session.readAccess ? null : 'Formal file read denied; showing local draft only'
    }));
  }

  function saveEditorDraft(sessionId, fileId, content) {
    ensureEditorCollections();
    const gate = requireEditorSession(sessionId, { requireWrite: true });
    if (!gate.ok) return { ok: false, code: gate.code, error: gate.error };
    const file = getFileRawInternal(fileId);
    if (!file || file.instanceId !== gate.session.instanceId) return { ok: false, code: 'mismatch', error: 'File not in session' };
    if (!isTextEditableFile(file).ok) return { ok: false, code: 'not_editable', error: 'File not editable' };
    if (getState().editorSim && getState().editorSim.autosaveFail) {
      return { ok: false, code: 'autosave_failed', error: '自动保存失败（演示）', retainedInMemory: true };
    }
    let d = findDraftForFile(sessionId, fileId);
    const base = gate.session.baseFileStates.find(b => b.fileId === fileId) || {
      contentHash: file.contentHash, modifiedAt: file.modifiedAt
    };
    if (!d) {
      d = normalizeDraft({
        id: uuid(),
        skillId: gate.session.assetId,
        instanceId: gate.session.instanceId,
        fileId,
        sessionId,
        relativePath: file.relativePath,
        content: String(content),
        createdAt: $now(),
        updatedAt: $now(),
        baseContentHash: base.contentHash || file.contentHash || '',
        baseFileModifiedAt: base.modifiedAt || file.modifiedAt || $now(),
        status: 'saved',
        lastAutosaveResult: 'ok'
      });
      getState().drafts.push(d);
    } else {
      d.content = String(content);
      d.updatedAt = $now();
      d.sessionId = sessionId;
      d.relativePath = file.relativePath;
      d.status = 'saved';
      d.lastAutosaveResult = 'ok';
    }
    const openTask = getState().pendingTasks.find(t =>
      t.skillId === gate.session.assetId && t.taskType === 'unfinished_draft' && t.status === 'open');
    if (!openTask) {
      createPendingTask({
        skillId: gate.session.assetId, instanceId: gate.session.instanceId,
        taskType: 'unfinished_draft', priority: 'normal', status: 'open',
        note: '未应用草稿 · ' + file.relativePath
      });
    }
    const auditKey = d.id + '|' + $hash(String(d.content || ''));
    if (d._lastDraftAuditKey !== auditKey) {
      // Aggregate: one audit per distinct draft content version, not every keystroke
      d._lastDraftAuditKey = auditKey;
      addAuditEvent({
        skillId: gate.session.assetId, instanceId: gate.session.instanceId,
        eventType: 'draft_saved', category: 'edit', source: 'Skill Panel', result: 'completed',
        note: '保存草稿 · ' + file.relativePath
      });
    }
    saveState();
    return { ok: true, draft: toDraftSummary(d) };
  }

  function discardEditorDraft(sessionId, fileId) {
    const session = getEditorSessionRaw(sessionId);
    if (!session) return { ok: false, code: 'expired', error: 'Session not found' };
    refreshSessionPermissions(session);
    // Discard does not write host files — write permission not required.
    if (!session.readAccess && session.status === 'denied') {
      // Local drafts remain manageable when permission was revoked after open;
      // still require session to exist and draft ownership.
    }
    let idx = getState().drafts.findIndex(d => d.sessionId === sessionId && d.fileId === fileId);
    if (idx < 0) {
      idx = getState().drafts.findIndex(d =>
        d.fileId === fileId && d.instanceId === session.instanceId && d.skillId === session.assetId);
    }
    if (idx < 0) return { ok: false, code: 'not_found', error: 'Draft not found' };
    const removed = getState().drafts[idx];
    if (removed.skillId !== session.assetId || removed.instanceId !== session.instanceId) {
      return { ok: false, code: 'mismatch', error: 'Draft does not belong to session asset/instance' };
    }
    getState().drafts.splice(idx, 1);
    addAuditEvent({
      skillId: session.assetId, instanceId: session.instanceId,
      eventType: 'draft_discarded', category: 'edit', source: 'Skill Panel', result: 'completed',
      note: '放弃草稿 · ' + (removed.relativePath || fileId)
    });
    saveState();
    return { ok: true };
  }

  function validateFileContent(file, content) {
    const problems = [];
    const text = String(content == null ? '' : content);
    const path = file.relativePath || '';
    const lower = path.toLowerCase();
    if (!text.trim()) {
      problems.push({
        severity: 'warning', code: 'empty_file', fileId: file.id, line: 1, column: 1,
        message: '文件内容为空', blocksApply: false
      });
    }
    if (/^<<<<<<<|^=======|^>>>>>>>/m.test(text)) {
      problems.push({
        severity: 'error', code: 'conflict_markers', fileId: file.id, line: 1, column: 1,
        message: '检测到冲突标记残留', blocksApply: true
      });
    }
    if ((text.length) > MAX_EDIT_BYTES) {
      problems.push({
        severity: 'error', code: 'too_large', fileId: file.id, line: 1, column: 1,
        message: '文件过大', blocksApply: true
      });
    }
    if (lower.endsWith('.json')) {
      try { JSON.parse(text); }
      catch (e) {
        problems.push({
          severity: 'error', code: 'json_parse', fileId: file.id, line: 1, column: 1,
          message: 'JSON 解析失败：' + (e.message || ''), blocksApply: true
        });
      }
    }
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
      const y = $parseYaml('---\n' + text.replace(/^---\n?/, '').replace(/\n---\s*$/, '') + '\n---\n');
      if (!y || (typeof y === 'object' && !Object.keys(y).length && text.includes(':'))) {
        /* soft */
      }
    }
    if (path === 'SKILL.md' || lower.endsWith('/skill.md')) {
      if (!text.startsWith('---')) {
        problems.push({
          severity: 'error', code: 'frontmatter_missing', fileId: file.id, line: 1, column: 1,
          message: '缺少 YAML frontmatter', blocksApply: true
        });
      } else {
        const yaml = $parseYaml(text);
        if (!yaml || typeof yaml !== 'object') {
          problems.push({
            severity: 'error', code: 'yaml_parse', fileId: file.id, line: 2, column: 1,
            message: 'Frontmatter 无法解析', blocksApply: true
          });
        } else {
          if (!yaml.name) {
            problems.push({
              severity: 'error', code: 'required_name', fileId: file.id, line: 2, column: 1,
              message: '缺少必填字段 name', blocksApply: true
            });
          } else if (!/^[a-z0-9][a-z0-9_-]*$/i.test(String(yaml.name))) {
            problems.push({
              severity: 'error', code: 'name_format', fileId: file.id, line: 2, column: 1,
              message: 'name 格式不合法', blocksApply: true
            });
          }
          if (yaml.version != null && !/^\d+(\.\d+){0,3}([.-][A-Za-z0-9]+)*$/.test(String(yaml.version))) {
            problems.push({
              severity: 'warning', code: 'version_format', fileId: file.id, line: 3, column: 1,
              message: 'version 格式可能不合法', blocksApply: false
            });
          }
          if (yaml.tags != null && typeof yaml.tags !== 'string' && !Array.isArray(yaml.tags)) {
            problems.push({
              severity: 'warning', code: 'tags_format', fileId: file.id, line: 4, column: 1,
              message: 'tags 格式异常', blocksApply: false
            });
          }
        }
      }
      if (file.isNestedSkillMarker) {
        problems.push({
          severity: 'warning', code: 'nested_skill', fileId: file.id, line: 1, column: 1,
          message: '这是嵌套 SKILL.md，请确认是否为有意编辑', blocksApply: false
        });
      }
    }
    return problems;
  }

  function validateEditorSession(sessionId, options = {}) {
    const gate = requireEditorSession(sessionId);
    if (!gate.ok) return { ok: false, code: gate.code, problems: [], blocksApply: true };
    const drafts = getState().drafts.filter(d => d.sessionId === sessionId || (d.instanceId === gate.session.instanceId && d.skillId === gate.session.assetId));
    let problems = [];
    drafts.forEach(d => {
      const file = getFileRawInternal(d.fileId);
      if (!file) return;
      problems = problems.concat(validateFileContent(file, d.content));
    });
    const blocksApply = problems.some(p => p.blocksApply);
    // Pure query: do not write AuditEvent unless explicitly requested (user click).
    if (options.recordAudit && blocksApply) {
      const draftKey = fingerprintDraftStates(drafts) + '|' + fingerprintValidation({ blocksApply, problems });
      if (gate.session._lastValidationAuditKey !== draftKey) {
        gate.session._lastValidationAuditKey = draftKey;
        addAuditEvent({
          skillId: gate.session.assetId, instanceId: gate.session.instanceId,
          eventType: 'validation_failed', category: 'edit', source: 'Skill Panel', result: 'failed',
          note: '校验失败 · ' + problems.filter(p => p.blocksApply).length + ' 个阻塞错误'
        });
        saveState();
      }
    }
    return JSON.parse(JSON.stringify({
      ok: true, problems, blocksApply,
      errorCount: problems.filter(p => p.severity === 'error').length,
      warningCount: problems.filter(p => p.severity === 'warning').length
    }));
  }

  function lineDiffSafe(a, b) {
    const left = String(a || '').split('\n');
    const right = String(b || '').split('\n');
    const max = Math.min(Math.max(left.length, right.length), 400);
    const lines = [];
    for (let i = 0; i < max; i++) {
      const L = left[i]; const R = right[i];
      if (L === R) lines.push({ type: 'same', text: L == null ? '' : L, line: i + 1 });
      else {
        if (L != null) lines.push({ type: 'del', text: L, line: i + 1 });
        if (R != null) lines.push({ type: 'add', text: R, line: i + 1 });
      }
    }
    if (Math.max(left.length, right.length) > 400) {
      lines.push({ type: 'meta', text: '… Diff 已截断（超过 400 行）', line: null });
    }
    return lines;
  }

  function getEditorDiff(sessionId, fileId) {
    const gate = requireEditorSession(sessionId);
    if (!gate.ok) return null;
    const file = getFileRawInternal(fileId);
    if (!file || file.instanceId !== gate.session.instanceId) return null;
    const draft = findDraftForFile(sessionId, fileId);
    const baseState = gate.session.baseFileStates.find(b => b.fileId === fileId);
    const current = file.fileType === 'binary' ? null : String(file.content || '');
    const draftContent = draft ? String(draft.content || '') : current;
    const baseContent = getBaselineFileContent(gate.session, fileId, file.relativePath);
    if (file.fileType === 'binary') {
      return JSON.parse(JSON.stringify({
        fileId, relativePath: file.relativePath, kind: 'binary',
        baseHash: baseState ? baseState.contentHash : null,
        currentHash: file.contentHash,
        draftHash: null,
        lines: [],
        metaOnly: true
      }));
    }
    return JSON.parse(JSON.stringify({
      fileId, relativePath: file.relativePath, kind: 'text',
      baseHash: baseState ? baseState.contentHash : null,
      currentHash: file.contentHash,
      draftHash: $hash(draftContent || ''),
      lines: lineDiffSafe(baseContent != null ? baseContent : current, draftContent),
      mode: 'base-draft',
      metaOnly: false
    }));
  }

  function getEditorAllDiff(sessionId) {
    const gate = requireEditorSession(sessionId);
    if (!gate.ok) return { ok: false, groups: [] };
    const drafts = getState().drafts.filter(d =>
      d.sessionId === sessionId || (d.instanceId === gate.session.instanceId && d.skillId === gate.session.assetId));
    const groups = drafts.map(d => {
      const file = getFileRawInternal(d.fileId);
      if (!file) return null;
      const formal = String(file.content || '');
      const draft = String(d.content || '');
      let change = 'unchanged';
      if (file.fileType === 'binary') change = 'binary-meta';
      else if (formal !== draft) change = 'modified';
      return {
        fileId: d.fileId,
        relativePath: file.relativePath,
        change,
        diff: file.fileType === 'binary' ? null : lineDiffSafe(formal, draft)
      };
    }).filter(Boolean);
    return JSON.parse(JSON.stringify({ ok: true, groups }));
  }

  function createPackageSnapshot(options = {}) {
    ensureEditorCollections();
    const assetId = resolveAssetId(options.assetId) || options.assetId;
    const instanceId = options.instanceId;
    if (!instanceId) return { ok: false, error: 'instanceId required' };
    const snap = createPackageSnapshotForInstance(instanceId, {
      note: options.note || '包快照',
      source: options.source || 'manual',
      retained: options.retained
    });
    if (!snap) return { ok: false, error: 'Unable to create snapshot', code: 'snapshot_failed' };
    if (assetId && snap.skillId !== assetId) return { ok: false, error: 'Asset/instance mismatch' };
    getState().snapshots.push(snap);
    addAuditEvent({
      skillId: snap.skillId, instanceId: snap.instanceId,
      eventType: 'snapshot_created', category: 'system', source: 'Skill Panel', result: 'completed',
      snapshotId: snap.id, note: snap.note
    });
    saveState();
    return { ok: true, snapshot: toSnapshotSummary(snap), snapshotId: snap.id };
  }

  function createFileSnapshot(options = {}) {
    const fileId = options.fileId;
    const file = getFileRawInternal(fileId);
    if (!file) return { ok: false, error: 'File not found' };
    const perm = getInstancePermission(file.instanceId);
    if (!perm || !perm.readAccess) return { ok: false, error: 'No read access', code: 'permission-denied' };
    const capture = perm.contentAccessStatus === 'readable' && file.fileType !== 'binary';
    const snap = normalizeSnapshot({
      id: uuid(),
      skillId: file.skillId,
      instanceId: file.instanceId,
      type: 'file',
      createdAt: $now(),
      note: options.note || ('文件快照 · ' + file.relativePath),
      source: options.source || 'manual',
      files: [$snapshotFileRecord(file, { captureContent: capture })],
      retained: !!options.retained,
      contentCaptureStatus: capture ? 'full' : 'metadata-only',
      capturedFileCount: capture ? 1 : 0,
      metadataOnlyFileCount: capture ? 0 : 1
    });
    getState().snapshots.push(snap);
    addAuditEvent({
      skillId: file.skillId, instanceId: file.instanceId,
      eventType: 'snapshot_created', category: 'system', source: 'Skill Panel', result: 'completed',
      snapshotId: snap.id, note: snap.note
    });
    saveState();
    return { ok: true, snapshot: toSnapshotSummary(snap), snapshotId: snap.id };
  }

  function detectExternalChanges(sessionId, options = {}) {
    const gate = requireEditorSession(sessionId);
    if (!gate.ok) return { ok: false, code: gate.code, changes: [] };
    const session = gate.session;
    const sim = getState().editorSim || {};
    const changes = [];
    const files = getFilesRawInternal({ instanceId: session.instanceId });
    const mutateSim = options.mutateSim !== false;

    if (mutateSim && sim.externalChangeCase === 'content-changed') {
      const skill = files.find(f => f.relativePath === 'SKILL.md');
      if (skill) {
        const injected = String(skill.content || '') + '\n\n<!-- EXTERNAL_CHANGE_MARKER -->\n';
        skill.content = injected;
        skill.contentHash = $hash(injected);
        skill.modifiedAt = $now();
        skill.sizeBytes = injected.length;
        changes.push({ fileId: skill.id, relativePath: 'SKILL.md', kind: 'content-changed' });
      }
      sim.externalChangeCase = null;
    } else if (mutateSim && sim.externalChangeCase === 'file-deleted') {
      const target = files.find(f => f.relativePath === 'references/checklist.md') || files.find(f => f.relativePath !== 'SKILL.md');
      if (target) {
        changes.push({ fileId: target.id, relativePath: target.relativePath, kind: 'deleted' });
        getState().files = getState().files.filter(f => f.id !== target.id);
      }
      sim.externalChangeCase = null;
    } else if (mutateSim && sim.externalChangeCase === 'permission-revoked') {
      getState().permissionGrants.filter(g => g.scopeId === session.instanceId).forEach(g => {
        g.writeAccess = false;
        // Keep readAccess so existing Draft remains viewable; write is blocked.
        g.status = g.readAccess ? 'limited' : 'revoked';
      });
      changes.push({ fileId: null, relativePath: null, kind: 'permission-revoked', scope: 'permission' });
      sim.externalChangeCase = null;
    } else if (mutateSim && sim.externalChangeCase === 'instance-missing') {
      const inst = getInstanceRaw(session.instanceId);
      if (inst) inst.lifecycleStatus = 'missing';
      changes.push({ fileId: null, relativePath: null, kind: 'instance-missing', scope: 'instance' });
      sim.externalChangeCase = null;
    } else if (mutateSim && sim.externalChangeCase === 'package-added') {
      const newFile = normalizeFile({
        id: uuid(), instanceId: session.instanceId, skillId: session.assetId,
        relativePath: 'references/external-added.md', fileType: 'text', mimeType: 'text/markdown',
        sizeBytes: 20, content: '# added\n', contentHash: $hash('# added\n'), modifiedAt: $now(),
        tokenCount: 2, tokenCountMode: 'estimated', indexStatus: 'indexed'
      });
      getState().files.push(newFile);
      changes.push({ fileId: newFile.id, relativePath: newFile.relativePath, kind: 'added', scope: 'package' });
      sim.externalChangeCase = null;
    } else {
      session.baseFileStates.forEach(base => {
        const cur = getFileRawInternal(base.fileId);
        if (!cur) {
          changes.push({ fileId: base.fileId, relativePath: base.relativePath, kind: 'deleted' });
        } else if ((cur.contentHash || '') !== (base.contentHash || '')) {
          changes.push({ fileId: cur.id, relativePath: cur.relativePath, kind: 'content-changed' });
        } else if ((cur.modifiedAt || '') !== (base.modifiedAt || '')) {
          changes.push({ fileId: cur.id, relativePath: cur.relativePath, kind: 'content-changed' });
        }
      });
      files.forEach(f => {
        if (!session.baseFileStates.some(b => b.fileId === f.id)) {
          changes.push({ fileId: f.id, relativePath: f.relativePath, kind: 'added', scope: 'package' });
        }
      });
    }

    refreshSessionPermissions(session);
    if (changes.length) {
      getState().drafts.filter(d => d.sessionId === sessionId).forEach(d => { d.status = 'conflict'; });
      createPendingTask({
        skillId: session.assetId, instanceId: session.instanceId,
        taskType: 'external_conflict', priority: 'high', status: 'open',
        note: '检测到外部变化'
      });
      addAuditEvent({
        skillId: session.assetId, instanceId: session.instanceId,
        eventType: 'external_change_detected', category: 'edit', source: 'Skill Panel', result: 'completed',
        note: '外部变化 · ' + changes.map(c => c.kind).join(',')
      });
    }
    saveState();
    return JSON.parse(JSON.stringify({ ok: true, changes }));
  }

  function openConflictFromSession(sessionId, changes) {
    ensureEditorCollections();
    const session = getEditorSessionRaw(sessionId);
    if (!session) return { ok: false, error: 'Session not found' };
    const kinds = (changes || []).map(c => c.kind);
    let scope = 'file';
    if (kinds.includes('permission-revoked')) scope = 'permission';
    else if (kinds.includes('instance-missing')) scope = 'instance';
    else if (kinds.includes('added') && !(changes || []).some(c => c.kind === 'content-changed' || c.kind === 'deleted')) scope = 'package';
    else if ((changes || []).some(c => c.scope === 'package')) scope = 'package';

    const fileChanges = (changes || []).filter(c => c.fileId);
    const conflictFiles = fileChanges.map(c => {
      const file = getFileRawInternal(c.fileId);
      const draft = findDraftForFile(sessionId, c.fileId);
      const base = session.baseFileStates.find(b => b.fileId === c.fileId);
      const baseContent = getBaselineFileContent(session, c.fileId, c.relativePath || (file && file.relativePath));
      return {
        fileId: c.fileId,
        relativePath: c.relativePath || (file && file.relativePath) || '',
        kind: c.kind,
        baseContent,
        currentContent: file && file.fileType !== 'binary' ? String(file.content || '') : null,
        draftContent: draft ? String(draft.content || '') : null,
        baseHash: base ? base.contentHash : null,
        currentHash: file ? file.contentHash : null,
        deleted: c.kind === 'deleted',
        isPackageAdded: c.kind === 'added'
      };
    });
    const conflict = {
      id: uuid(),
      sessionId,
      assetId: session.assetId,
      instanceId: session.instanceId,
      createdAt: $now(),
      status: 'open',
      scope,
      reason: (changes || []).map(c => c.kind).join(','),
      globalReason: scope === 'permission' ? '权限已撤销'
        : scope === 'instance' ? 'Instance Missing'
        : scope === 'package' ? '包内出现新增或结构变化'
        : null,
      files: conflictFiles,
      permission: getInstancePermission(session.instanceId),
      snapshotId: null,
      diffViewed: false,
      diffViewedFileIds: [],
      diffHash: null
    };
    getState().conflicts.push(conflict);
    setConflictViewState({ conflictId: conflict.id, selectedFileId: conflictFiles[0] ? conflictFiles[0].fileId : null });
    addAuditEvent({
      skillId: session.assetId, instanceId: session.instanceId,
      eventType: 'conflict_opened', category: 'edit', source: 'Skill Panel', result: 'completed',
      note: '打开冲突页 · ' + conflict.reason
    });
    saveState();
    return { ok: true, conflictId: conflict.id };
  }

  function getConflict(conflictId) {
    ensureEditorCollections();
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return null;
    const asset = getAsset(c.assetId);
    const inst = getInstance(c.instanceId);
    return JSON.parse(JSON.stringify({
      id: c.id,
      sessionId: c.sessionId,
      assetId: c.assetId,
      assetName: asset ? (asset.displayName || asset.name) : c.assetId,
      instanceId: c.instanceId,
      instance: inst,
      status: c.status,
      scope: c.scope || 'file',
      reason: c.reason,
      globalReason: c.globalReason || null,
      createdAt: c.createdAt,
      files: (c.files || []).map(f => ({
        fileId: f.fileId,
        relativePath: f.relativePath,
        kind: f.kind,
        deleted: !!f.deleted,
        isPackageAdded: !!f.isPackageAdded,
        baseHash: f.baseHash,
        currentHash: f.currentHash,
        hasDraft: f.draftContent != null
      })),
      permission: getInstancePermission(c.instanceId),
      snapshotId: c.snapshotId,
      diffViewed: !!c.diffViewed,
      diffViewedFileIds: c.diffViewedFileIds || [],
      canForce: !!(c.scope !== 'permission' && c.scope !== 'instance'),
      canMerge: !!(c.scope !== 'permission' && c.scope !== 'instance'),
      canApply: false
    }));
  }

  function getConflictFileDetail(conflictId, fileId) {
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return null;
    if (c.scope === 'permission' || c.scope === 'instance') {
      return JSON.parse(JSON.stringify({
        fileId: null,
        relativePath: null,
        scope: c.scope,
        globalReason: c.globalReason,
        baseContent: null,
        currentContent: null,
        draftContent: null,
        twoWayDiff: [],
        threeWayDiff: { base: null, current: null, draft: null, baseToCurrent: [], baseToDraft: [], currentToDraft: [] }
      }));
    }
    const f = c.files.find(x => x.fileId === fileId);
    if (!f) return null;
    const session = getEditorSessionRaw(c.sessionId);
    let baseContent = f.baseContent;
    if (session) {
      const fromSnap = getBaselineFileContent(session, f.fileId, f.relativePath);
      if (fromSnap != null) baseContent = fromSnap;
    }
    const twoWay = lineDiffSafe(f.currentContent || '', f.draftContent || '');
    const threeWay = {
      base: baseContent,
      current: f.currentContent,
      draft: f.draftContent,
      baseToCurrent: lineDiffSafe(baseContent || '', f.currentContent || ''),
      baseToDraft: lineDiffSafe(baseContent || '', f.draftContent || ''),
      currentToDraft: twoWay
    };
    return JSON.parse(JSON.stringify({
      ...f,
      baseContent,
      twoWayDiff: twoWay,
      threeWayDiff: threeWay
    }));
  }

  function markConflictDiffViewed(conflictId, options = {}) {
    // Explicit acknowledgment only — loading a page must not call this without options.
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false };
    if (!options.userAcknowledged) {
      return { ok: false, code: 'ack_required', error: '需要明确确认已查看差异' };
    }
    const overwriteFiles = (c.files || []).filter(f => f.draftContent != null && !f.isPackageAdded);
    if (options.fileId) {
      c.diffViewedFileIds = Array.from(new Set([...(c.diffViewedFileIds || []), options.fileId]));
    } else {
      c.diffViewedFileIds = overwriteFiles.map(f => f.fileId);
    }
    const allViewed = overwriteFiles.every(f => (c.diffViewedFileIds || []).includes(f.fileId));
    c.diffViewed = allViewed || overwriteFiles.length === 0;
    c.diffHash = $hash(JSON.stringify((c.files || []).map(f => ({
      fileId: f.fileId, currentHash: f.currentHash, draft: $hash(String(f.draftContent || ''))
    }))));
    saveState();
    return { ok: true, diffViewed: c.diffViewed, diffViewedFileIds: c.diffViewedFileIds };
  }

  function prepareApplyChanges(sessionId) {
    ensureEditorCollections();
    const gate = requireEditorSession(sessionId, { requireWrite: true });
    if (!gate.ok) return { ok: false, code: gate.code, error: gate.error };
    const session = gate.session;
    refreshSessionPermissions(session);
    if (!session.writeAccess || session.mode !== 'editable') {
      return { ok: false, code: 'permission-denied', error: '写权限已失效，无法应用' };
    }
    const detected = detectExternalChanges(sessionId);
    if (detected.changes && detected.changes.length) {
      const opened = openConflictFromSession(sessionId, detected.changes);
      return { ok: false, code: 'conflict', conflictId: opened.conflictId, changes: detected.changes };
    }
    const validation = validateEditorSession(sessionId);
    if (validation.blocksApply) {
      const draftKey = fingerprintDraftStates(getState().drafts.filter(d => d.sessionId === sessionId))
        + '|' + fingerprintValidation(validation);
      if (session._lastValidationAuditKey !== draftKey) {
        session._lastValidationAuditKey = draftKey;
        addAuditEvent({
          skillId: session.assetId, instanceId: session.instanceId,
          eventType: 'validation_failed', category: 'edit', source: 'Skill Panel', result: 'failed',
          note: 'Prepare Apply 阻塞 · 校验失败'
        });
        saveState();
      }
      return { ok: false, code: 'validation', problems: validation.problems, error: '存在阻塞校验错误' };
    }
    const drafts = getState().drafts.filter(d => d.sessionId === sessionId);
    if (!drafts.length) return { ok: false, code: 'no_changes', error: '没有可应用的草稿' };
    for (const d of drafts) {
      const file = getFileRawInternal(d.fileId);
      if (!file) {
        const opened = openConflictFromSession(sessionId, [{ fileId: d.fileId, relativePath: d.relativePath, kind: 'deleted' }]);
        return { ok: false, code: 'conflict', conflictId: opened.conflictId };
      }
      if ((file.contentHash || '') !== (d.baseContentHash || '')) {
        const opened = openConflictFromSession(sessionId, [{ fileId: d.fileId, relativePath: file.relativePath, kind: 'content-changed' }]);
        return { ok: false, code: 'conflict', conflictId: opened.conflictId };
      }
    }
    const snapRes = createPackageSnapshot({
      assetId: session.assetId, instanceId: session.instanceId,
      source: 'pre-apply', note: '应用更改前包快照', retained: true
    });
    if (!snapRes.ok) {
      return { ok: false, code: 'snapshot_failed', error: snapRes.error || '快照创建失败' };
    }
    const allDiff = getEditorAllDiff(sessionId);
    const preparedFileStates = getFilesRawInternal({ instanceId: session.instanceId }).map(capturePreparedFileState);
    const draftStates = drafts.map(captureDraftState);
    const preparedAt = $now();
    const op = {
      id: uuid(),
      sessionId,
      assetId: session.assetId,
      instanceId: session.instanceId,
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + APPLY_OP_TTL_MS).toISOString(),
      snapshotId: snapRes.snapshotId,
      basePackageHash: session.basePackageHash,
      preparedPackageHash: packageHashForInstance(session.instanceId),
      preparedFileStates,
      draftStates,
      draftStatesHash: fingerprintDraftStates(drafts),
      diffHash: fingerprintDiff(allDiff),
      validationHash: fingerprintValidation(validation),
      confirmedAt: null,
      completedAt: null
    };
    getState().applyOperations.push(op);
    const inst = getInstanceRaw(session.instanceId);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      snapshot: snapRes.snapshot,
      snapshotId: snapRes.snapshotId,
      instanceId: session.instanceId,
      targetPath: inst ? (inst.skillFilePath || inst.rootPath) : null,
      files: drafts.map(d => {
        const f = getFileRawInternal(d.fileId);
        return { fileId: d.fileId, relativePath: f ? f.relativePath : d.relativePath, status: 'pending' };
      }),
      diff: allDiff,
      validation: { blocksApply: false, problems: validation.problems },
      problems: validation.problems
    }));
  }

  function confirmApplyChanges(operationId, options = {}) {
    ensureEditorCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed', error: '需要用户确认' };
    const op = getState().applyOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found', error: 'ApplyOperation 不存在' };
    if (op.status === 'completed' || op.status === 'cancelled' || op.status === 'expired' || op.status === 'conflict') {
      return { ok: false, code: 'operation_invalid', error: 'ApplyOperation 不可重复确认', status: op.status };
    }
    if (op.status !== 'prepared') {
      return { ok: false, code: 'operation_invalid', error: 'ApplyOperation 状态无效', status: op.status };
    }
    if (op.expiresAt && Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired';
      saveState();
      return { ok: false, code: 'operation_expired', error: 'ApplyOperation 已过期' };
    }
    const gate = requireEditorSession(op.sessionId, { requireWrite: true });
    if (!gate.ok) return { ok: false, code: gate.code, error: gate.error, operationId };
    const session = gate.session;
    if (session.assetId !== op.assetId || session.instanceId !== op.instanceId) {
      return { ok: false, code: 'mismatch', error: 'Session/Asset/Instance 不匹配' };
    }
    if (!session.writeAccess || session.mode !== 'editable') {
      return { ok: false, code: 'permission-denied', error: '写权限已失效' };
    }
    const snap = getState().snapshots.find(s => s.id === op.snapshotId);
    if (!snap) return { ok: false, code: 'snapshot_missing', error: 'Snapshot 不存在' };
    if (snap.skillId !== op.assetId || snap.instanceId !== op.instanceId) {
      return { ok: false, code: 'snapshot_mismatch', error: 'Snapshot 不属于当前 Asset/Instance' };
    }
    if (snap.source !== 'pre-apply') {
      return { ok: false, code: 'snapshot_source', error: 'Snapshot 来源必须是 pre-apply' };
    }

    // Re-check Formal Index before write (takes priority over Diff hash — external disk change → Conflict)
    const drafts = getState().drafts.filter(d => d.sessionId === op.sessionId);
    const diskChanges = compareFormalToPrepared(op.preparedFileStates, op.instanceId, op.preparedPackageHash);
    drafts.forEach(d => {
      const file = getFileRawInternal(d.fileId);
      if (!file) diskChanges.push({ fileId: d.fileId, relativePath: d.relativePath, kind: 'deleted' });
      else if ((file.contentHash || '') !== (d.baseContentHash || '')) {
        diskChanges.push({ fileId: d.fileId, relativePath: file.relativePath, kind: 'content-changed' });
      }
    });
    if (diskChanges.length) {
      op.status = 'conflict';
      const opened = openConflictFromSession(op.sessionId, diskChanges);
      saveState();
      return {
        ok: false,
        code: 'conflict',
        conflictId: opened.conflictId,
        operationId: op.id
      };
    }

    if (!draftsUnchanged(op, op.sessionId)) {
      op.status = 'cancelled';
      saveState();
      return { ok: false, code: 'draft_changed', error: '准备后 Draft 已变化，请重新准备' };
    }
    const allDiff = getEditorAllDiff(op.sessionId);
    if (fingerprintDiff(allDiff) !== op.diffHash) {
      op.status = 'cancelled';
      saveState();
      return { ok: false, code: 'diff_changed', error: '准备后 Diff 已变化，请重新准备' };
    }

    op.confirmedAt = $now();
    addAuditEvent({
      skillId: session.assetId, instanceId: session.instanceId,
      eventType: 'apply_started', category: 'edit', source: 'Skill Panel', result: 'completed',
      snapshotId: op.snapshotId, note: '开始应用更改'
    });

    const sim = getState().editorSim || {};
    const preImages = {};
    drafts.forEach(d => {
      const f = getFileRawInternal(d.fileId);
      if (f) preImages[d.fileId] = { content: f.content, contentHash: f.contentHash, modifiedAt: f.modifiedAt, sizeBytes: f.sizeBytes, tokenCount: f.tokenCount };
    });
    const results = [];
    let failed = false;
    for (const d of drafts) {
      const file = getFileRawInternal(d.fileId);
      if (!file) {
        results.push({ fileId: d.fileId, relativePath: d.relativePath, status: 'failed', errorCode: 'missing', message: '文件不存在', rollbackStatus: null });
        failed = true;
        break;
      }
      if (sim.applyFailRelativePath && file.relativePath === sim.applyFailRelativePath) {
        results.push({ fileId: file.id, relativePath: file.relativePath, status: 'failed', errorCode: 'write_failed', message: '模拟写入失败', rollbackStatus: null });
        failed = true;
        break;
      }
      file.content = String(d.content);
      file.contentHash = $hash(file.content);
      file.modifiedAt = $now();
      file.sizeBytes = file.content.length;
      file.tokenCount = $tokenApprox(file.content);
      file.tokenCountMode = 'estimated';
      results.push({ fileId: file.id, relativePath: file.relativePath, status: 'completed', errorCode: null, message: null, rollbackStatus: null });
    }

    if (failed) {
      let rollbackFailed = false;
      results.forEach(r => {
        if (r.status !== 'completed') return;
        if (sim.rollbackFail) {
          r.rollbackStatus = 'rollback-failed';
          rollbackFailed = true;
          return;
        }
        const img = preImages[r.fileId];
        const file = getFileRawInternal(r.fileId);
        if (file && img) {
          file.content = img.content;
          file.contentHash = img.contentHash;
          file.modifiedAt = img.modifiedAt;
          file.sizeBytes = img.sizeBytes;
          file.tokenCount = img.tokenCount;
          r.rollbackStatus = 'rolled-back';
          r.status = 'rolled-back';
        }
      });
      drafts.forEach(d => { d.status = 'apply-failed'; });
      createPendingTask({
        skillId: session.assetId, instanceId: session.instanceId,
        taskType: rollbackFailed ? 'rollback_failed' : 'apply_failed',
        priority: 'high', status: 'open', note: '应用失败'
      });
      addAuditEvent({
        skillId: session.assetId, instanceId: session.instanceId,
        eventType: rollbackFailed ? 'rollback_failed' : 'rollback_completed',
        category: 'edit', source: 'Skill Panel',
        result: rollbackFailed ? 'failed' : 'completed',
        snapshotId: op.snapshotId,
        note: '应用失败后回滚'
      });
      addAuditEvent({
        skillId: session.assetId, instanceId: session.instanceId,
        eventType: 'apply_failed', category: 'edit', source: 'Skill Panel', result: 'failed',
        snapshotId: op.snapshotId, note: '应用更改失败'
      });
      op.status = rollbackFailed ? 'rollback-failed' : 'rolled-back';
      op.completedAt = $now();
      saveState();
      return JSON.parse(JSON.stringify({
        ok: false,
        operationId: op.id,
        status: op.status,
        snapshotId: op.snapshotId,
        results
      }));
    }

    const inst = getInstanceRaw(session.instanceId);
    updateInstanceAfterWrite(inst);
    getState().drafts = getState().drafts.filter(d => d.sessionId !== op.sessionId);
    resolveTasksForApply(session.assetId, ['unfinished_draft', 'apply_failed', 'external_conflict']);
    refreshSessionBaseAfterApply(session);
    op.status = 'completed';
    op.completedAt = $now();
    addAuditEvent({
      skillId: session.assetId, instanceId: session.instanceId,
      eventType: 'apply_completed', category: 'edit', source: 'Skill Panel', result: 'completed',
      snapshotId: op.snapshotId, note: '应用更改完成 · ' + results.length + ' 个文件'
    });
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      status: 'completed',
      snapshotId: op.snapshotId,
      results
    }));
  }

  function resolveConflictKeepDraft(conflictId) {
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false, error: 'Conflict not found' };
    c.status = 'kept-draft';
    getState().drafts.filter(d => d.sessionId === c.sessionId).forEach(d => { d.status = 'conflict'; });
    saveState();
    return { ok: true, returnTo: 'editor', sessionId: c.sessionId };
  }

  function resolveConflictDiscard(conflictId, fileId) {
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false, error: 'Conflict not found' };
    if (fileId) {
      const discarded = discardEditorDraft(c.sessionId, fileId);
      if (!discarded.ok) return { ok: false, code: discarded.code, error: discarded.error || '放弃草稿失败' };
    } else {
      const drafts = getState().drafts.filter(d => d.sessionId === c.sessionId);
      for (const d of drafts) {
        const discarded = discardEditorDraft(c.sessionId, d.fileId);
        if (!discarded.ok) return { ok: false, code: discarded.code, error: discarded.error || '放弃草稿失败' };
      }
    }
    c.status = 'discarded';
    saveState();
    return { ok: true, returnTo: 'editor', sessionId: c.sessionId };
  }

  function resolveConflictReload(conflictId, fileId, options = {}) {
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false, error: 'Conflict not found' };
    if (c.scope === 'permission' || c.scope === 'instance') {
      return { ok: false, code: 'scope_blocked', error: '当前冲突范围不允许重新加载' };
    }
    const f = c.files.find(x => x.fileId === fileId);
    if (!f) return { ok: false, error: 'File not found' };
    if (!options.userConfirmed) {
      return { ok: false, code: 'confirm_required', error: '重新加载将替换编辑基线，需确认是否保留旧草稿副本' };
    }
    const file = getFileRawInternal(fileId);
    if (options.keepDraftCopy && f.draftContent != null) {
      f.draftBackup = f.draftContent;
    }
    if (file && f.currentContent != null) {
      const d = findDraftForFile(c.sessionId, fileId);
      if (d) {
        d.content = String(file.content || '');
        d.baseContentHash = file.contentHash;
        d.baseFileModifiedAt = file.modifiedAt;
        d.status = 'saved';
      }
      const session = getEditorSessionRaw(c.sessionId);
      if (session) {
        const st = session.baseFileStates.find(b => b.fileId === fileId);
        if (st) {
          st.contentHash = file.contentHash;
          st.modifiedAt = file.modifiedAt;
          st.sizeBytes = file.sizeBytes;
        }
      }
    }
    c.status = 'reloaded';
    saveState();
    return { ok: true, returnTo: 'editor', sessionId: c.sessionId };
  }

  function resolveConflictMerge(conflictId, fileId, mergedContent) {
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false, error: 'Conflict not found' };
    if (c.scope === 'permission' || c.scope === 'instance') {
      return { ok: false, code: 'scope_blocked', error: '当前冲突范围不允许合并' };
    }
    const gate = requireEditorSession(c.sessionId, { requireWrite: true });
    if (!gate.ok) return { ok: false, code: gate.code, error: gate.error };
    const file = getFileRawInternal(fileId);
    if (!file) return { ok: false, error: 'File missing' };
    const detail = getConflictFileDetail(conflictId, fileId);
    const content = mergedContent != null ? String(mergedContent) : [
      '<<<<<<< Base',
      (detail && detail.baseContent) || '',
      '=======',
      (detail && detail.currentContent) || '',
      '>>>>>>> Draft',
      (detail && detail.draftContent) || ''
    ].join('\n');
    const saved = saveEditorDraft(c.sessionId, fileId, content);
    if (!saved.ok) return saved;
    const d = findDraftForFile(c.sessionId, fileId);
    if (d) d.status = 'modified';
    addAuditEvent({
      skillId: c.assetId, instanceId: c.instanceId,
      eventType: 'merge_draft_created', category: 'edit', source: 'Skill Panel', result: 'completed',
      note: '创建合并草稿 · ' + file.relativePath
    });
    c.status = 'merged-draft';
    saveState();
    return { ok: true, returnTo: 'editor', sessionId: c.sessionId, note: '已创建合并草稿，需重新校验并应用' };
  }

  function resolveConflictSaveCopy(conflictId, fileId) {
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false, error: 'Conflict not found' };
    if (c.scope === 'permission' || c.scope === 'instance') {
      return { ok: false, code: 'scope_blocked', error: '当前冲突范围不允许写入' };
    }
    const gate = requireEditorSession(c.sessionId, { requireWrite: true });
    if (!gate.ok) return { ok: false, code: gate.code, error: gate.error };
    const f = c.files.find(x => x.fileId === fileId);
    const file = getFileRawInternal(fileId);
    if (!f || !file) return { ok: false, error: 'File not found' };
    const base = (file.relativePath || 'file.md').replace(/(\.[^.]+)?$/, '');
    const ext = (file.relativePath.match(/(\.[^.]+)$/) || ['.md'])[0];
    let copyPath = base + '.copy' + ext;
    let n = 2;
    while (getFilesRawInternal({ instanceId: c.instanceId }).some(x => x.relativePath === copyPath)) {
      copyPath = base + '.copy' + n + ext;
      n += 1;
    }
    const content = f.draftContent != null ? f.draftContent : String(file.content || '');
    const newFile = normalizeFile({
      id: uuid(),
      instanceId: c.instanceId,
      skillId: c.assetId,
      relativePath: copyPath,
      fileType: 'text',
      mimeType: file.mimeType || 'text/plain',
      sizeBytes: content.length,
      content,
      contentHash: $hash(content),
      modifiedAt: $now(),
      tokenCount: $tokenApprox(content),
      tokenCountMode: 'estimated',
      indexStatus: 'indexed'
    });
    getState().files.push(newFile);
    addAuditEvent({
      skillId: c.assetId, instanceId: c.instanceId,
      eventType: 'save_as_copy', category: 'edit', source: 'Skill Panel', result: 'completed',
      note: '另存副本 · ' + copyPath
    });
    createFileSnapshot({ fileId: newFile.id, note: '另存副本快照', source: 'save-as-copy' });
    saveState();
    return { ok: true, newFileId: newFile.id, relativePath: copyPath, returnTo: 'editor', sessionId: c.sessionId };
  }

  function prepareForceOverwrite(conflictId) {
    ensureEditorCollections();
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false, error: 'Conflict not found' };
    if (c.scope === 'permission') return { ok: false, code: 'permission-denied', error: '权限已撤销，不能强制覆盖' };
    if (c.scope === 'instance') return { ok: false, code: 'missing', error: 'Instance Missing，不能强制覆盖' };
    const session = getEditorSessionRaw(c.sessionId);
    if (session) refreshSessionPermissions(session);
    const perm = getInstancePermission(c.instanceId);
    if (!perm || !perm.writeAccess) return { ok: false, code: 'permission-denied', error: '无写权限，不能强制覆盖' };
    const inst = getInstanceRaw(c.instanceId);
    if (!inst || inst.lifecycleStatus === 'missing') return { ok: false, code: 'missing', error: 'Instance Missing' };

    const overwriteFiles = (c.files || []).filter(f => f.draftContent != null && !f.isPackageAdded);
    if (!c.diffViewed) {
      return { ok: false, code: 'diff_required', error: '请先确认已查看所有将被覆盖文件的差异' };
    }
    const currentDiffHash = $hash(JSON.stringify((c.files || []).map(f => ({
      fileId: f.fileId, currentHash: f.currentHash, draft: $hash(String(f.draftContent || ''))
    }))));
    if (c.diffHash && c.diffHash !== currentDiffHash) {
      c.diffViewed = false;
      c.diffViewedFileIds = [];
      saveState();
      return { ok: false, code: 'diff_stale', error: 'Diff 已变化，请重新查看' };
    }

    const snapRes = createPackageSnapshot({
      assetId: c.assetId, instanceId: c.instanceId,
      source: 'pre-force-apply', note: '强制覆盖前包快照', retained: true
    });
    if (!snapRes.ok) return { ok: false, code: 'snapshot_failed', error: '快照失败，禁止强制覆盖' };
    const snap = getState().snapshots.find(s => s.id === snapRes.snapshotId);
    if (!snap || snap.type !== 'package' || snap.source !== 'pre-force-apply') {
      return { ok: false, code: 'snapshot_failed', error: '快照不符合强制覆盖要求' };
    }
    if (snap.contentCaptureStatus === 'metadata-only' && (snap.capturedFileCount || 0) === 0) {
      return { ok: false, code: 'snapshot_failed', error: '快照内容捕获不足，无法回滚' };
    }

    const drafts = getState().drafts.filter(d => d.sessionId === c.sessionId);
    const currentFileStates = getFilesRawInternal({ instanceId: c.instanceId }).map(capturePreparedFileState);
    const preparedAt = $now();
    const forceOp = {
      id: uuid(),
      conflictId,
      sessionId: c.sessionId,
      assetId: c.assetId,
      instanceId: c.instanceId,
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + FORCE_OP_TTL_MS).toISOString(),
      snapshotId: snapRes.snapshotId,
      currentFileStates,
      preparedPackageHash: packageHashForInstance(c.instanceId),
      draftStates: drafts.map(captureDraftState),
      draftStatesHash: fingerprintDraftStates(drafts),
      diffHash: currentDiffHash,
      diffViewedAt: $now(),
      riskConfirmedAt: null,
      confirmedAt: null,
      completedAt: null
    };
    getState().forceApplyOperations.push(forceOp);
    c.snapshotId = snapRes.snapshotId;
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      forceOperationId: forceOp.id,
      snapshotId: snapRes.snapshotId,
      snapshot: snapRes.snapshot,
      files: overwriteFiles.map(f => ({
        fileId: f.fileId,
        relativePath: f.relativePath,
        willLoseExternal: f.currentContent !== f.draftContent,
        externalPreview: (f.currentContent || '').slice(0, 200)
      })),
      warning: '强制覆盖将丢失磁盘上的外部修改'
    }));
  }

  function confirmForceOverwrite(forceOperationId, options = {}) {
    ensureEditorCollections();
    if (!options.userConfirmed || !options.secondConfirmed) {
      return { ok: false, code: 'not_confirmed', error: '需要二次确认' };
    }
    const forceOp = getState().forceApplyOperations.find(o => o.id === forceOperationId);
    if (!forceOp) return { ok: false, code: 'operation_not_found', error: '未调用 Prepare，不能直接 Confirm' };
    if (forceOp.status !== 'prepared') {
      return { ok: false, code: 'operation_invalid', error: 'ForceApplyOperation 不可重复使用', status: forceOp.status };
    }
    if (forceOp.expiresAt && Date.parse(forceOp.expiresAt) < Date.now()) {
      forceOp.status = 'expired';
      saveState();
      return { ok: false, code: 'operation_expired', error: 'ForceApplyOperation 已过期' };
    }
    const c = getState().conflicts.find(x => x.id === forceOp.conflictId);
    if (!c) return { ok: false, error: 'Conflict not found' };
    if (c.scope === 'permission' || c.scope === 'instance') {
      return { ok: false, code: 'scope_blocked', error: '当前冲突范围不允许强制覆盖' };
    }

    const session = getEditorSessionRaw(forceOp.sessionId);
    if (session) refreshSessionPermissions(session);
    const perm = getInstancePermission(forceOp.instanceId);
    if (!perm || !perm.writeAccess) return { ok: false, code: 'permission-denied', error: '无写权限' };
    const inst = getInstanceRaw(forceOp.instanceId);
    if (!inst || inst.lifecycleStatus === 'missing') return { ok: false, code: 'missing', error: 'Instance Missing' };

    const snap = getState().snapshots.find(s => s.id === forceOp.snapshotId);
    if (!snap) return { ok: false, code: 'snapshot_missing', error: 'Snapshot 不存在' };
    if (snap.skillId !== forceOp.assetId || snap.instanceId !== forceOp.instanceId) {
      return { ok: false, code: 'snapshot_mismatch', error: 'Snapshot 不属于当前 Asset/Instance' };
    }
    if (snap.type !== 'package' || snap.source !== 'pre-force-apply') {
      return { ok: false, code: 'snapshot_invalid', error: 'Snapshot 类型或来源无效' };
    }

    const drafts = getState().drafts.filter(d => d.sessionId === forceOp.sessionId);
    if (fingerprintDraftStates(drafts) !== forceOp.draftStatesHash) {
      forceOp.status = 'invalidated';
      saveState();
      return { ok: false, code: 'draft_changed', error: 'Draft 已变化，请重新准备' };
    }
    const currentDiffHash = $hash(JSON.stringify((c.files || []).map(f => ({
      fileId: f.fileId, currentHash: getFileRawInternal(f.fileId) ? getFileRawInternal(f.fileId).contentHash : f.currentHash,
      draft: $hash(String(f.draftContent || ''))
    }))));
    // Refresh current hashes on conflict files for comparison
    (c.files || []).forEach(cf => {
      const file = getFileRawInternal(cf.fileId);
      if (file) cf.currentHash = file.contentHash;
    });
    const diskChanges = compareFormalToPrepared(forceOp.currentFileStates, forceOp.instanceId, forceOp.preparedPackageHash);
    if (diskChanges.length || currentDiffHash !== forceOp.diffHash) {
      forceOp.status = 'invalidated';
      c.diffViewed = false;
      c.diffViewedFileIds = [];
      c.diffHash = null;
      saveState();
      return {
        ok: false,
        code: 'stale',
        error: '准备强制覆盖后磁盘再次变化，原 Operation 已失效，请重新查看 Diff 并准备',
        forceOperationId: forceOp.id
      };
    }

    forceOp.riskConfirmedAt = $now();
    forceOp.confirmedAt = $now();
    const sim = getState().editorSim || {};
    const results = [];
    let anyFailed = false;
    let anyCompleted = false;
    const written = [];

    const targets = (c.files || []).filter(cf => cf.draftContent != null && !cf.isPackageAdded);
    for (const cf of targets) {
      if (cf.deleted) {
        results.push({ fileId: cf.fileId, relativePath: cf.relativePath, status: 'skipped', message: '目标已删除', rollbackStatus: null });
        continue;
      }
      const file = getFileRawInternal(cf.fileId);
      if (!file) {
        results.push({ fileId: cf.fileId, relativePath: cf.relativePath, status: 'failed', errorCode: 'missing', rollbackStatus: null });
        anyFailed = true;
        continue;
      }
      if (sim.applyFailRelativePath && file.relativePath === sim.applyFailRelativePath) {
        results.push({ fileId: file.id, relativePath: file.relativePath, status: 'failed', errorCode: 'write_failed', message: '模拟写入失败', rollbackStatus: null });
        anyFailed = true;
        continue;
      }
      file.content = String(cf.draftContent);
      file.contentHash = $hash(file.content);
      file.modifiedAt = $now();
      file.sizeBytes = file.content.length;
      file.tokenCount = $tokenApprox(file.content);
      written.push(file.id);
      results.push({ fileId: file.id, relativePath: file.relativePath, status: 'completed', rollbackStatus: null });
      anyCompleted = true;
      const d = findDraftForFile(c.sessionId, cf.fileId);
      if (d) {
        d.status = 'applied';
        d.baseContentHash = file.contentHash;
        d.content = file.content;
      }
    }

    if (anyFailed) {
      // Rollback written files from pre-force package snapshot
      let rollbackFailed = false;
      results.forEach(r => {
        if (r.status !== 'completed') return;
        if (sim.rollbackFail) {
          r.status = 'rollback-failed';
          r.rollbackStatus = 'rollback-failed';
          rollbackFailed = true;
          return;
        }
        const snapFile = (snap.files || []).find(sf => sf.fileId === r.fileId || sf.relativePath === r.relativePath);
        const file = getFileRawInternal(r.fileId);
        if (file && snapFile && snapFile.content != null) {
          file.content = String(snapFile.content);
          file.contentHash = snapFile.contentHash || $hash(file.content);
          file.modifiedAt = snapFile.modifiedAt || file.modifiedAt;
          file.sizeBytes = snapFile.sizeBytes != null ? snapFile.sizeBytes : file.content.length;
          r.status = 'rolled-back';
          r.rollbackStatus = 'rolled-back';
        } else {
          r.status = 'rollback-failed';
          r.rollbackStatus = 'rollback-failed';
          rollbackFailed = true;
        }
      });
      // Restore drafts that were marked applied
      getState().drafts.filter(d => d.sessionId === c.sessionId && d.status === 'applied').forEach(d => {
        d.status = 'conflict';
      });
      const status = rollbackFailed ? 'rollback-failed' : (anyCompleted ? 'rolled-back' : 'failed');
      forceOp.status = status;
      forceOp.completedAt = $now();
      addAuditEvent({
        skillId: c.assetId, instanceId: c.instanceId,
        eventType: 'apply_failed', category: 'edit', source: 'Skill Panel', result: 'failed',
        snapshotId: forceOp.snapshotId, note: '强制覆盖失败'
      });
      addAuditEvent({
        skillId: c.assetId, instanceId: c.instanceId,
        eventType: rollbackFailed ? 'rollback_failed' : 'rollback_completed',
        category: 'edit', source: 'Skill Panel',
        result: rollbackFailed ? 'failed' : 'completed',
        snapshotId: forceOp.snapshotId, note: '强制覆盖回滚'
      });
      // Do not mark conflict fully resolved
      if (c.status === 'open') c.status = 'force-failed';
      saveState();
      return JSON.parse(JSON.stringify({
        ok: false,
        status,
        forceOperationId: forceOp.id,
        snapshotId: forceOp.snapshotId,
        results,
        returnTo: 'conflict',
        conflictId: c.id
      }));
    }

    // Success: clear applied drafts from active unfinished set
    getState().drafts = getState().drafts.filter(d => !(d.sessionId === c.sessionId && d.status === 'applied'));
    updateInstanceAfterWrite(inst);
    resolveTasksForApply(c.assetId, ['unfinished_draft', 'external_conflict']);
    if (session) refreshSessionBaseAfterApply(session);
    c.status = 'force-applied';
    forceOp.status = 'completed';
    forceOp.completedAt = $now();
    addAuditEvent({
      skillId: c.assetId, instanceId: c.instanceId,
      eventType: 'force_apply', category: 'edit', source: 'Skill Panel', result: 'completed',
      snapshotId: forceOp.snapshotId,
      note: '强制覆盖 · ' + results.filter(r => r.status === 'completed').length + ' 文件'
    });
    saveState();
    const overall = results.some(r => r.status === 'failed')
      ? 'partially-completed'
      : 'completed';
    return JSON.parse(JSON.stringify({
      ok: true,
      status: overall,
      forceOperationId: forceOp.id,
      snapshotId: forceOp.snapshotId,
      results,
      returnTo: 'editor',
      sessionId: c.sessionId
    }));
  }

  function returnToEditorFromConflict(conflictId) {
    const c = getState().conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false };
    setEditorViewState({ sessionId: c.sessionId, assetId: c.assetId, instanceId: c.instanceId });
    return { ok: true, sessionId: c.sessionId, assetId: c.assetId };
  }

  function loadEditorDemoCase(caseId) {
    ensureEditorCollections();
    const sim = getState().editorSim;
    sim.autosaveFail = false;
    sim.applyFailRelativePath = null;
    sim.rollbackFail = false;
    sim.externalChangeCase = null;
    switch (caseId) {
      case 'autosave-fail': sim.autosaveFail = true; break;
      case 'external-content': sim.externalChangeCase = 'content-changed'; break;
      case 'external-delete': sim.externalChangeCase = 'file-deleted'; break;
      case 'permission-revoked': sim.externalChangeCase = 'permission-revoked'; break;
      case 'instance-missing': sim.externalChangeCase = 'instance-missing'; break;
      case 'package-added': sim.externalChangeCase = 'package-added'; break;
      case 'apply-partial-fail': sim.applyFailRelativePath = 'references/checklist.md'; break;
      case 'rollback-fail': sim.applyFailRelativePath = 'references/checklist.md'; sim.rollbackFail = true; break;
      case 'clear': break;
      default: return { ok: false, error: 'Unknown case' };
    }
    saveState();
    return { ok: true, caseId, editorSim: JSON.parse(JSON.stringify(sim)) };
  }


  function discardScanSession(sessionId) {
    const state = getState();
    const idx = state.scanSessions.findIndex(x => x.id === sessionId);
    if (idx < 0) return { ok: false, error: 'not found' };
    const session = state.scanSessions[idx];
    const discoveryIds = new Set((state.scanDiscoveries || []).filter(d => d.scanSessionId === sessionId).map(d => d.id));
    // Remove unconfirmed change sets linked to this scan session
    const removeSetIds = new Set((state.changeSets || []).filter(cs => {
      if (cs.scanSessionId === sessionId) return true;
      if (cs.status === 'pending' || cs.status === 'cancelled') {
        const items = (state.changeItems || []).filter(i => i.changeSetId === cs.id);
        return items.some(i => discoveryIds.has(i.discoveryId));
      }
      return false;
    }).map(cs => cs.id));
    state.changeItems = (state.changeItems || []).filter(i => !removeSetIds.has(i.changeSetId));
    state.changeSets = (state.changeSets || []).filter(cs => !removeSetIds.has(cs.id));
    state.scanDiscoveries = (state.scanDiscoveries || []).filter(d => d.scanSessionId !== sessionId);
    state.scanSessions.splice(idx, 1);
    const decision = state.onboardingDecision;
    let onboarding = null;
    if (!state.initialized || !decision || decision === 'scan-started' || decision === 'scan-in-progress') {
      onboarding = markOnboardingComplete('skip');
    }
    saveState();
    return { ok: true, formalIndexUnchanged: true, onboardingDecision: onboarding || decision };
  }

  function getOnboardingDecision() {
    const state = getState();
    return {
      initialized: !!state.initialized,
      onboardingDecision: state.onboardingDecision || null
    };
  }

  function resolveActivityEvent(eventId) {
    const ev = getState().auditEvents.find(e => e.id === eventId) || getState().activityEvents && getState().activityEvents.find(e => e.id === eventId);
    // prototype: activity uses audit-like events; mark via note only if present on pending
    return { ok: true };
  }

  function resolveDuplicateTasksByGroup(groupId) {
    getState().pendingTasks.filter(t => t.groupId === groupId && t.taskType === 'duplicate_candidate').forEach(t => {
      t.status = 'resolved';
      t.resolvedAt = $now();
    });
    saveState();
    return { ok: true };
  }

  /* ---------- Phase F Compare APIs ---------- */
  function ensureCompareCollections() {
    ensureEditorCollections();
    const state = getState();
    if (!state.compareSessions) state.compareSessions = [];
    return state;
  }

  function toSafeCompareSessionView(session) {
    if (!session) return null;
    return JSON.parse(JSON.stringify({
      id: session.id,
      candidateIds: $coerceArray(session.candidateIds),
      groupId: session.groupId || null,
      status: session.status || 'open',
      createdAt: session.createdAt,
      resolvedAt: session.resolvedAt || null,
      resolution: session.resolution || null,
      primaryAssetId: session.primaryAssetId || null,
      evidence: session.evidence || null
    }));
  }

  function resolveCompareCandidateIds(candidateIdsOrSessionId) {
    if (candidateIdsOrSessionId == null) return [];
    if (Array.isArray(candidateIdsOrSessionId)) {
      return candidateIdsOrSessionId.map(id => resolveAssetId(id) || id).filter(Boolean);
    }
    const sid = String(candidateIdsOrSessionId);
    const session = ensureCompareCollections().compareSessions.find(s => s.id === sid);
    if (session) return $coerceArray(session.candidateIds).slice();
    const group = resolveDuplicateGroup(sid);
    if (group) return $coerceArray(group.skillIds).map(id => resolveAssetId(id) || id).filter(Boolean);
    const rid = resolveAssetId(sid);
    return rid ? [rid] : [];
  }

  function buildCompareCandidateOverview(assetId) {
    const rid = resolveAssetId(assetId) || assetId;
    const asset = getAssetRaw(rid);
    if (!asset) return null;
    const state = getState();
    const instances = state.instances.filter(i => i.skillId === rid);
    const primary = instances.find(i => i.isPrimary) || instances[0] || null;
    const files = primary ? getFilesRawInternal({ instanceId: primary.id }) : [];
    const skillMd = files.find(f => String(f.relativePath || '').toLowerCase() === 'skill.md') || null;
    const binding = asset.sourceBindingId
      ? state.sourceBindings.find(b => b.id === asset.sourceBindingId)
      : (primary && primary.sourceBindingId ? state.sourceBindings.find(b => b.id === primary.sourceBindingId) : null);
    const perm = primary ? getInstancePermission(primary.id) : null;
    const usage = getAssetUsageSummary(rid);
    const packageHash = primary ? packageHashForInstance(primary.id) : null;
    const fileTree = files.map(f => ({
      id: f.id,
      relativePath: f.relativePath,
      fileType: f.fileType,
      sizeBytes: f.sizeBytes,
      contentHash: f.contentHash,
      indexStatus: f.indexStatus
    })).sort((a, b) => String(a.relativePath).localeCompare(String(b.relativePath)));

    return {
      candidateId: rid,
      assetId: rid,
      name: asset.name,
      displayName: asset.displayName || asset.name,
      description: asset.description || '',
      lifecycleStatus: asset.lifecycleStatus,
      version: primary ? (primary.installedVersion || '') : '',
      source: binding
        ? {
            bound: true,
            sourceType: binding.sourceType,
            repository: binding.repository || null,
            updateStatus: binding.updateStatus || null,
            trustPolicy: binding.trustPolicy || null
          }
        : { bound: false, sourceType: null, repository: null, updateStatus: 'unbound', trustPolicy: null },
      repository: binding ? (binding.repository || null) : null,
      instance: primary
        ? {
            id: primary.id,
            hostType: primary.hostType,
            hostLabel: _hostLabel(primary.hostType),
            rootPath: primary.rootPath,
            skillFilePath: primary.skillFilePath,
            lifecycleStatus: primary.lifecycleStatus,
            isPrimary: !!primary.isPrimary,
            permissionMode: primary.permissionMode
          }
        : null,
      instances: instances.map(i => ({
        id: i.id,
        hostType: i.hostType,
        hostLabel: _hostLabel(i.hostType),
        rootPath: i.rootPath,
        skillFilePath: i.skillFilePath,
        lifecycleStatus: i.lifecycleStatus,
        isPrimary: !!i.isPrimary
      })),
      host: primary ? primary.hostType : null,
      hostLabel: primary ? _hostLabel(primary.hostType) : '—',
      fileStructure: fileTree,
      fileCount: files.length,
      packageHash,
      skillMdHash: skillMd ? skillMd.contentHash : null,
      skillMdFileId: skillMd ? skillMd.id : null,
      packageSizeBytes: files.reduce((n, f) => n + (f.sizeBytes || 0), 0),
      permission: perm
        ? {
            readAccess: !!perm.readAccess,
            writeAccess: !!perm.writeAccess,
            contentAccessStatus: perm.contentAccessStatus,
            isMissing: !!perm.isMissing
          }
        : { readAccess: false, writeAccess: false, contentAccessStatus: 'denied', isMissing: true },
      usageCredibility: usage
        ? {
            supported: !!usage.supported,
            dataStatus: usage.dataStatus,
            attributionLevel: usage.attributionLevel,
            displayLabel: usage.displayLabel,
            displayCalls: usage.displayCalls,
            hasUsageData: !!usage.supported && usage.dataStatus !== 'unsupported'
          }
        : { supported: false, dataStatus: 'unsupported', attributionLevel: 'no-data', displayLabel: '暂无数据', displayCalls: null, hasUsageData: false }
    };
  }

  function openCompareSession(candidateIds, options = {}) {
    ensureCompareCollections();
    const ids = $coerceArray(candidateIds).map(id => resolveAssetId(id) || id).filter(Boolean);
    const unique = [];
    ids.forEach(id => { if (!unique.includes(id)) unique.push(id); });
    if (unique.length < 2) {
      return { ok: false, error: 'Need at least 2 candidates', session: null };
    }
    let groupId = options.groupId || null;
    if (!groupId) {
      const group = getState().duplicateGroups.find(g =>
        unique.every(id => $safeIncludes(g.skillIds, id)) ||
        unique.some(id => $safeIncludes(g.skillIds, id))
      );
      if (group) groupId = group.id;
    }
    const evidence = groupId
      ? (resolveDuplicateGroup(groupId)?.evidence || DUP_CONTENT[resolveDuplicateGroup(groupId)?.name] || null)
      : (options.evidence || null);
    const session = {
      id: options.id || uuid(),
      candidateIds: unique,
      groupId,
      status: 'open',
      createdAt: $now(),
      resolvedAt: null,
      resolution: null,
      primaryAssetId: options.primaryAssetId || unique[0],
      evidence: evidence ? JSON.parse(JSON.stringify(evidence)) : null
    };
    getState().compareSessions.push(session);
    saveState();
    return { ok: true, session: toSafeCompareSessionView(session) };
  }

  function getCompareSession(sessionId) {
    if (!sessionId) return null;
    ensureCompareCollections();
    const session = getState().compareSessions.find(s => s.id === sessionId);
    return toSafeCompareSessionView(session);
  }

  function getCompareOverview(candidateIdsOrSessionId) {
    ensureCompareCollections();
    let session = null;
    let candidateIds = [];
    if (typeof candidateIdsOrSessionId === 'string') {
      session = getState().compareSessions.find(s => s.id === candidateIdsOrSessionId);
      if (session) candidateIds = $coerceArray(session.candidateIds).slice();
      else candidateIds = resolveCompareCandidateIds(candidateIdsOrSessionId);
    } else {
      candidateIds = resolveCompareCandidateIds(candidateIdsOrSessionId);
    }
    const candidates = candidateIds.map(buildCompareCandidateOverview).filter(Boolean);
    const hashes = candidates.map(c => c.skillMdHash).filter(Boolean);
    const packageHashes = candidates.map(c => c.packageHash).filter(Boolean);
    const allSkillMdReadable = candidates.every(c => c.permission && c.permission.readAccess && c.permission.contentAccessStatus === 'readable' && c.skillMdFileId);
    return JSON.parse(JSON.stringify({
      sessionId: session ? session.id : null,
      session: session ? toSafeCompareSessionView(session) : null,
      groupId: session ? session.groupId : null,
      evidence: session ? session.evidence : null,
      candidateCount: candidates.length,
      candidates,
      comparison: {
        skillMdHashMatch: hashes.length >= 2 && hashes.every(h => h === hashes[0]),
        packageHashMatch: packageHashes.length >= 2 && packageHashes.every(h => h === packageHashes[0]),
        nameOverlap: (() => {
          const names = candidates.map(c => String(c.name || '').toLowerCase());
          return names.length >= 2 && names.some((n, i) => names.some((m, j) => i !== j && (n.includes(m) || m.includes(n))));
        })(),
        allSkillMdReadable,
        structureOverlap: (() => {
          if (candidates.length < 2) return 0;
          const sets = candidates.map(c => new Set((c.fileStructure || []).map(f => f.relativePath)));
          const base = sets[0];
          let shared = 0;
          base.forEach(p => { if (sets.every(s => s.has(p))) shared++; });
          const union = new Set();
          sets.forEach(s => s.forEach(p => union.add(p)));
          return union.size ? Math.round((shared / union.size) * 100) : 0;
        })()
      }
    }));
  }

  function getCompareFileSummary(sessionId) {
    ensureCompareCollections();
    const session = getState().compareSessions.find(s => s.id === sessionId);
    if (!session) return null;
    const overview = getCompareOverview(sessionId);
    const pathMap = {};
    (overview.candidates || []).forEach(c => {
      (c.fileStructure || []).forEach(f => {
        const key = f.relativePath;
        if (!pathMap[key]) pathMap[key] = { relativePath: key, fileType: f.fileType, byCandidate: {} };
        pathMap[key].byCandidate[c.candidateId] = {
          fileId: f.id,
          contentHash: f.contentHash,
          sizeBytes: f.sizeBytes,
          indexStatus: f.indexStatus,
          readAccess: !!(c.permission && c.permission.readAccess)
        };
      });
    });
    const files = Object.values(pathMap).map(row => {
      const hashes = Object.values(row.byCandidate).map(x => x.contentHash).filter(Boolean);
      const presentIn = Object.keys(row.byCandidate);
      return {
        relativePath: row.relativePath,
        fileType: row.fileType,
        presentIn,
        missingIn: (overview.candidates || []).map(c => c.candidateId).filter(id => !row.byCandidate[id]),
        hashMatch: hashes.length >= 2 && hashes.every(h => h === hashes[0]),
        byCandidate: row.byCandidate
      };
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return JSON.parse(JSON.stringify({
      sessionId,
      candidateIds: $coerceArray(session.candidateIds),
      files,
      skillMd: files.find(f => String(f.relativePath).toLowerCase() === 'skill.md') || null
    }));
  }

  function getCompareFileDetail(compareSessionId, candidateId, fileId) {
    ensureCompareCollections();
    const session = getState().compareSessions.find(s => s.id === compareSessionId);
    if (!session) return { ok: false, error: 'Compare session not found', content: null };
    const rid = resolveAssetId(candidateId) || candidateId;
    if (!$safeIncludes(session.candidateIds, rid)) {
      return { ok: false, error: 'Candidate not in session', content: null };
    }
    const detail = getFileDetail(fileId);
    if (!detail) return { ok: false, error: 'File not found', content: null };
    if (detail.skillId && detail.skillId !== rid) {
      const inst = getInstanceRaw(detail.instanceId || (detail.instance && detail.instance.id));
      if (!inst || inst.skillId !== rid) {
        return { ok: false, error: 'File does not belong to candidate', content: null };
      }
    }
    const canRead = !!detail.readAccess && detail.contentAccessStatus === 'readable' && !detail.isBinary;
    return JSON.parse(JSON.stringify({
      ok: true,
      sessionId: compareSessionId,
      candidateId: rid,
      fileId: detail.id,
      relativePath: detail.relativePath,
      fileType: detail.fileType,
      sizeBytes: detail.sizeBytes,
      contentHash: detail.contentHash,
      indexStatus: detail.indexStatus,
      isBinary: !!detail.isBinary,
      readAccess: !!detail.readAccess,
      contentAccessStatus: detail.contentAccessStatus,
      content: canRead ? String(detail.content || '') : null,
      contentForView: canRead ? String(detail.contentForView || detail.content || '') : null,
      instance: detail.instance || null,
      hostLabel: detail.hostLabel || null
    }));
  }

  function resolveDuplicateTasksForCandidates(candidateIds, groupId) {
    const state = getState();
    const ids = new Set(candidateIds);
    let count = 0;
    state.pendingTasks.forEach(t => {
      if (t.status !== 'open' || t.taskType !== 'duplicate_candidate') return;
      const matchGroup = groupId && t.groupId === groupId;
      const matchSkill = ids.has(t.skillId);
      if (matchGroup || matchSkill) {
        t.status = 'resolved';
        t.resolvedAt = $now();
        count++;
      }
    });
    if (groupId) {
      const g = state.duplicateGroups.find(x => x.id === groupId);
      if (g) g.status = 'resolved';
    }
    return count;
  }

  function mergeCandidatesAsMultiInstance(primaryAssetId, otherIds, options = {}) {
    const primary = getAssetRaw(primaryAssetId);
    if (!primary) return { ok: false, error: 'Primary asset not found' };
    const preservedUuid = primary.id;
    const movedInstanceIds = [];
    const deletedAssetIds = [];
    otherIds.forEach(oid => {
      if (oid === primaryAssetId) return;
      const other = getAssetRaw(oid);
      if (!other) return;
      const movedFromThis = [];
      getState().instances.filter(i => i.skillId === oid).forEach(inst => {
        inst.skillId = primaryAssetId;
        inst.isPrimary = false;
        movedInstanceIds.push(inst.id);
        movedFromThis.push(inst.id);
      });
      getState().files.filter(f => f.skillId === oid).forEach(f => { f.skillId = primaryAssetId; });
      getState().sourceBindings.filter(b => b.skillId === oid).forEach(b => {
        b.skillId = primaryAssetId;
        // Other asset-level bindings → instance-level divergence
        if (!b.scope || b.scope === 'asset') {
          const instId = movedFromThis[0] || null;
          b.scope = 'instance';
          b.instanceId = instId;
          b.sourceDivergence = true;
          if (instId) {
            const inst = getInstanceRaw(instId);
            if (inst) inst.sourceBindingId = b.id;
          }
        }
      });
      getState().pendingTasks.filter(t => t.skillId === oid).forEach(t => { t.skillId = primaryAssetId; });
      getState().drafts.filter(d => d.skillId === oid).forEach(d => { d.skillId = primaryAssetId; });
      getState().snapshots.filter(s => s.skillId === oid).forEach(s => { s.skillId = primaryAssetId; });
      if (Array.isArray(getState().permissionGrants)) {
        getState().permissionGrants.forEach(g => {
          if (g.scopeType === 'asset' && g.scopeId === oid) g.scopeId = primaryAssetId;
        });
      }
      if (Array.isArray(getState().editorSessions)) {
        getState().editorSessions.forEach(s => {
          if (s.assetId === oid || s.skillId === oid) {
            s.assetId = primaryAssetId;
            if (s.skillId === oid) s.skillId = primaryAssetId;
          }
        });
      }
      if (Array.isArray(getState().conflicts)) {
        getState().conflicts.forEach(c => {
          if (c.assetId === oid || c.skillId === oid) {
            c.assetId = primaryAssetId;
            if (c.skillId === oid) c.skillId = primaryAssetId;
          }
        });
      }
      other.lifecycleStatus = 'deleted';
      other.mergedIntoAssetId = primaryAssetId;
      other.primaryInstanceId = null;
      other.updatedAt = $now();
      deletedAssetIds.push(other.id);
    });
    const instances = getState().instances.filter(i => i.skillId === primaryAssetId);
    if (!instances.some(i => i.isPrimary) && instances.length) {
      const next = instances.find(i => i.lifecycleStatus === 'available') || instances[0];
      instances.forEach(i => { i.isPrimary = i.id === next.id; });
      primary.primaryInstanceId = next.id;
    }
    reconcileOfficialSourceBinding(primaryAssetId);
    primary.updatedAt = $now();
    if (!options.skipInvalidate) {
      invalidateOpenOperationsForAssets(deletedAssetIds.concat([primaryAssetId]), primaryAssetId);
    }
    return {
      ok: true,
      preservedAssetId: preservedUuid,
      movedInstanceIds,
      deletedAssetIds,
      instanceCount: instances.length
    };
  }

  function reconcileOfficialSourceBinding(assetId) {
    const asset = getAssetRaw(assetId);
    const bindings = getState().sourceBindings.filter(b => b.skillId === assetId);
    const assetLevel = bindings.filter(b => (!b.scope || b.scope === 'asset'));

    let official = null;
    if (asset && asset.sourceBindingId) {
      const cur = bindings.find(b => b.id === asset.sourceBindingId);
      if (cur && (!cur.scope || cur.scope === 'asset') && isGithubLikeSourceType(cur.sourceType)) {
        official = cur;
      }
    }
    if (!official) {
      official = assetLevel.find(b => isGithubLikeSourceType(b.sourceType) && !b.sourceDivergence) || null;
    }
    if (!official) {
      official = assetLevel.find(b => !isLocalSourceType(b.sourceType) && !b.sourceDivergence) || null;
    }
    if (!official) {
      official = assetLevel.find(b => !b.sourceDivergence) || assetLevel[0] || null;
    }
    // Local must not overwrite github official — if official is local and a github exists, prefer github
    const githubOfficial = assetLevel.find(b => isGithubLikeSourceType(b.sourceType));
    if (official && isLocalSourceType(official.sourceType) && githubOfficial) {
      official = githubOfficial;
    }

    assetLevel.forEach(b => {
      if (official && b.id === official.id) {
        b.scope = 'asset';
        b.instanceId = null;
        b.sourceDivergence = false;
        return;
      }
      const inst = getState().instances.find(i => i.skillId === assetId && i.sourceBindingId === b.id)
        || getState().instances.find(i => i.skillId === assetId && !i.isPrimary)
        || getState().instances.find(i => i.skillId === assetId);
      b.scope = 'instance';
      b.instanceId = inst ? inst.id : null;
      b.sourceDivergence = true;
      if (inst) inst.sourceBindingId = b.id;
    });

    if (asset) asset.sourceBindingId = official ? official.id : null;
  }

  function invalidateOpenOperationsForAssets(assetIds, canonicalAssetId) {
    ensurePhaseFCollections();
    const idSet = new Set($coerceArray(assetIds));
    if (!idSet.size) return;
    // Only invalidate prepared (not yet confirmed) ops — never the in-flight applying op
    const openStatuses = new Set(['prepared']);

    function touchOp(op, references) {
      if (!op || !openStatuses.has(op.status)) return;
      if (!references) return;
      op.status = 'invalidated';
      op.invalidatedReason = 'asset_merged';
      op.canonicalAssetId = canonicalAssetId;
      op.completedAt = $now();
    }

    (getState().installOperations || []).forEach(op => {
      const refs = idSet.has(op.existingAssetId) ||
        (op.source && idSet.has(op.source.assetId)) ||
        idSet.has(op.existingAssetId);
      touchOp(op, refs);
    });
    (getState().updateOperations || []).forEach(op => {
      touchOp(op, op.source && idSet.has(op.source.assetId));
    });
    (getState().uninstallOperations || []).forEach(op => {
      touchOp(op, op.source && idSet.has(op.source.assetId));
    });
    (getState().applyOperations || []).forEach(op => {
      touchOp(op, idSet.has(op.assetId) || idSet.has(op.skillId));
    });
    (getState().forceApplyOperations || []).forEach(op => {
      touchOp(op, idSet.has(op.assetId) || idSet.has(op.skillId));
    });
    (getState().duplicateResolutionOperations || []).forEach(op => {
      const refs = $coerceArray(op.candidateIds).some(id => idSet.has(id)) ||
        idSet.has(op.primaryAssetId) || idSet.has(op.archiveAssetId);
      touchOp(op, refs);
    });

    // Migrate editorSessions / conflicts to canonical (keep instance/file ids)
    (getState().editorSessions || []).forEach(s => {
      if (idSet.has(s.assetId) || idSet.has(s.skillId)) {
        if (idSet.has(s.assetId)) s.assetId = canonicalAssetId;
        if (idSet.has(s.skillId)) s.skillId = canonicalAssetId;
      }
    });
    (getState().conflicts || []).forEach(c => {
      if (idSet.has(c.assetId) || idSet.has(c.skillId)) {
        if (idSet.has(c.assetId)) c.assetId = canonicalAssetId;
        if (idSet.has(c.skillId)) c.skillId = canonicalAssetId;
      }
    });
  }

  function createMergedAssetFromCandidates(candidateIds, options = {}) {
    const ids = candidateIds.slice();
    if (ids.length < 2) return { ok: false, error: 'Need at least 2 candidates' };
    const sources = ids.map(id => getAssetRaw(id)).filter(Boolean);
    if (!sources.length) return { ok: false, error: 'No assets found' };
    const name = options.name || (sources[0].name + '-merged');
    const newId = uuid();
    const primarySrc = sources[0];
    const firstInst = getState().instances.find(i => i.skillId === primarySrc.id && i.isPrimary)
      || getState().instances.find(i => i.skillId === primarySrc.id);
    const categoryIds = Array.from(new Set(sources.flatMap(s => $coerceArray(s.categoryIds))));
    const tagIds = Array.from(new Set(sources.flatMap(s => $coerceArray(s.tagIds))));

    // Pick official binding from candidates before move (prefer github/git of primary)
    let preferredOfficial = null;
    const primaryBinding = primarySrc.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === primarySrc.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === primarySrc.id && (!b.scope || b.scope === 'asset'));
    if (primaryBinding && isGithubLikeSourceType(primaryBinding.sourceType)) preferredOfficial = primaryBinding;
    if (!preferredOfficial) {
      for (const src of sources) {
        const b = src.sourceBindingId
          ? getState().sourceBindings.find(x => x.id === src.sourceBindingId)
          : getState().sourceBindings.find(x => x.skillId === src.id && (!x.scope || x.scope === 'asset') && isGithubLikeSourceType(x.sourceType));
        if (b && isGithubLikeSourceType(b.sourceType)) { preferredOfficial = b; break; }
      }
    }

    getState().assets.push(normalizeAsset({
      id: newId,
      name,
      displayName: options.displayName || (primarySrc.displayName + ' (合并)'),
      description: primarySrc.description || '',
      categoryIds,
      tagIds,
      lifecycleStatus: 'available',
      isFavorite: sources.some(s => !!s.isFavorite),
      primaryInstanceId: null,
      createdAt: $now(),
      updatedAt: $now()
    }));
    if (options._trackOp) trackDuplicateCreatedEntity(options._trackOp, 'asset', newId);
    const moved = [];
    const movedBySource = {};
    ids.forEach(oid => {
      movedBySource[oid] = [];
      getState().instances.filter(i => i.skillId === oid).forEach(inst => {
        inst.skillId = newId;
        inst.isPrimary = false;
        moved.push(inst.id);
        movedBySource[oid].push(inst.id);
      });
      getState().files.filter(f => f.skillId === oid).forEach(f => { f.skillId = newId; });
      getState().sourceBindings.filter(b => b.skillId === oid).forEach(b => {
        b.skillId = newId;
        const isOfficial = preferredOfficial && b.id === preferredOfficial.id;
        if (!isOfficial && (!b.scope || b.scope === 'asset')) {
          const instId = (movedBySource[oid] && movedBySource[oid][0]) || null;
          b.scope = 'instance';
          b.instanceId = instId;
          b.sourceDivergence = true;
          if (instId) {
            const inst = getInstanceRaw(instId);
            if (inst) inst.sourceBindingId = b.id;
          }
        }
      });
      getState().drafts.filter(d => d.skillId === oid).forEach(d => { d.skillId = newId; });
      getState().snapshots.filter(s => s.skillId === oid).forEach(s => { s.skillId = newId; });
      getState().pendingTasks.filter(t => t.skillId === oid).forEach(t => { t.skillId = newId; });
      if (Array.isArray(getState().permissionGrants)) {
        getState().permissionGrants.forEach(g => {
          if (g.scopeType === 'asset' && g.scopeId === oid) g.scopeId = newId;
        });
      }
      if (Array.isArray(getState().editorSessions)) {
        getState().editorSessions.forEach(s => {
          if (s.assetId === oid || s.skillId === oid) {
            s.assetId = newId;
            if (s.skillId === oid) s.skillId = newId;
          }
        });
      }
      if (Array.isArray(getState().conflicts)) {
        getState().conflicts.forEach(c => {
          if (c.assetId === oid || c.skillId === oid) {
            c.assetId = newId;
            if (c.skillId === oid) c.skillId = newId;
          }
        });
      }
      const other = getAssetRaw(oid);
      if (other) {
        other.lifecycleStatus = 'deleted';
        other.mergedIntoAssetId = newId;
        other.primaryInstanceId = null;
        other.updatedAt = $now();
      }
    });
    const instances = getState().instances.filter(i => i.skillId === newId);
    if (instances.length) {
      const prefer = (firstInst && instances.find(i => i.id === firstInst.id)) || instances[0];
      instances.forEach(i => { i.isPrimary = i.id === prefer.id; });
      getAssetRaw(newId).primaryInstanceId = prefer.id;
    }
    reconcileOfficialSourceBinding(newId);
    const newAsset = getAssetRaw(newId);
    if (!options.skipInvalidate) {
      invalidateOpenOperationsForAssets(ids, newId);
    }
    return {
      ok: true,
      newAssetId: newId,
      movedInstanceIds: moved,
      name,
      officialSourceBindingId: newAsset && newAsset.sourceBindingId ? newAsset.sourceBindingId : null
    };
  }

  function resolveDuplicateComparison(options = {}) {
    ensureCompareCollections();
    const action = options.action || options.resolution;
    if (!action) return { ok: false, error: 'Missing action' };

    const session = options.sessionId
      ? getState().compareSessions.find(s => s.id === options.sessionId)
      : null;
    const candidateIds = session
      ? $coerceArray(session.candidateIds).slice()
      : $coerceArray(options.candidateIds).map(id => resolveAssetId(id) || id).filter(Boolean);
    const groupId = options.groupId || (session && session.groupId) || null;

    let result = { ok: true, action, ignoreRuleCreated: false };
    const beforeIgnoreCount = (getState().ignoreRules || []).length;

    if (action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance') {
      const primaryAssetId = resolveAssetId(options.primaryAssetId) || options.primaryAssetId || candidateIds[0];
      const others = candidateIds.filter(id => id !== primaryAssetId);
      const merge = mergeCandidatesAsMultiInstance(primaryAssetId, others);
      if (!merge.ok) return merge;
      const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
      addAuditEvent({
        skillId: primaryAssetId,
        eventType: 'compare_confirm_multi_instance',
        category: 'system',
        source: 'Skill Panel',
        result: 'completed',
        note: '确认为同一 Asset 多实例 · 保留 UUID ' + primaryAssetId + ' · 并入实例 ' + merge.movedInstanceIds.length
      });
      result = {
        ...result,
        ...merge,
        preservedAssetId: merge.preservedAssetId,
        resolvedTaskCount: resolved
      };
    } else if (action === 'keep-independent' || action === 'keep_independent' || action === 'keep-both') {
      const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
      addAuditEvent({
        eventType: 'compare_keep_independent',
        category: 'system',
        source: 'Skill Panel',
        result: 'completed',
        note: '保持独立 Asset · UUID 未变 · 候选 ' + candidateIds.join(',')
      });
      result = { ...result, candidateIds: candidateIds.slice(), resolvedTaskCount: resolved, uuidsUnchanged: true };
    } else if (action === 'archive') {
      const archiveAssetId = resolveAssetId(options.archiveAssetId) || options.archiveAssetId;
      const archiveInstanceId = options.archiveInstanceId || null;
      if (archiveInstanceId) {
        const inst = getInstanceRaw(archiveInstanceId);
        if (!inst) return { ok: false, error: 'Instance not found' };
        const siblings = getState().instances.filter(i => i.skillId === inst.skillId);
        if (siblings.length <= 1) {
          archiveSkill(inst.skillId, options.reason || 'Compare 归档');
          result.archivedAssetId = inst.skillId;
        } else {
          const det = detachInstance(archiveInstanceId);
          result.detachedInstanceId = archiveInstanceId;
          result.detach = det;
        }
      } else if (archiveAssetId) {
        archiveSkill(archiveAssetId, options.reason || 'Compare 归档');
        result.archivedAssetId = archiveAssetId;
      } else {
        return { ok: false, error: 'archiveAssetId or archiveInstanceId required' };
      }
      const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
      result.resolvedTaskCount = resolved;
      addAuditEvent({
        skillId: result.archivedAssetId || null,
        instanceId: archiveInstanceId || null,
        eventType: 'compare_archive',
        category: 'archive',
        source: 'Skill Panel',
        result: 'completed',
        note: 'Compare 归档候选'
      });
    } else if (action === 'ignore' || action === 'ignore-duplicate' || action === 'ignore_suggestion') {
      const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
      addAuditEvent({
        eventType: 'compare_ignore_duplicate',
        category: 'system',
        source: 'Skill Panel',
        result: 'completed',
        note: '忽略本次重复建议（仅关闭 Duplicate PendingTask，未创建 Skill 级 IgnoreRule）'
      });
      result = {
        ...result,
        resolvedTaskCount: resolved,
        ignoreRuleCreated: false,
        skillIgnoreRuleCreated: false
      };
    } else if (action === 'merge-new' || action === 'merge_new') {
      const merged = createMergedAssetFromCandidates(candidateIds, options);
      if (!merged.ok) return merged;
      const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
      addAuditEvent({
        skillId: merged.newAssetId,
        eventType: 'compare_merge_new',
        category: 'system',
        source: 'Skill Panel',
        result: 'completed',
        note: '人工合并为新 Asset · ' + merged.name
      });
      result = { ...result, ...merged, resolvedTaskCount: resolved };
    } else {
      return { ok: false, error: 'Unknown action: ' + action };
    }

    const afterIgnoreCount = (getState().ignoreRules || []).length;
    if (afterIgnoreCount > beforeIgnoreCount && (action === 'ignore' || action === 'ignore-duplicate' || action === 'ignore_suggestion')) {
      const extras = getState().ignoreRules.slice(beforeIgnoreCount).filter(r => r.ruleType === 'skill_id');
      extras.forEach(r => {
        const idx = getState().ignoreRules.findIndex(x => x.id === r.id);
        if (idx >= 0) getState().ignoreRules.splice(idx, 1);
      });
    }
    result.ignoreRuleCreated = false;

    if (session) {
      session.status = 'resolved';
      session.resolvedAt = $now();
      session.resolution = {
        action,
        at: session.resolvedAt,
        primaryAssetId: result.preservedAssetId || result.newAssetId || options.primaryAssetId || null,
        archivedAssetId: result.archivedAssetId || null
      };
    }
    saveState();
    return JSON.parse(JSON.stringify(result));
  }

  /* ========== Phase F: Install / Update / Uninstall ========== */
  const PHASE_F_OP_TTL_MS = 15 * 60 * 1000;

  const INSTALL_CATALOG = {
    'github:acme/hello-skill': {
      sourceType: 'github', sourceUrl: 'https://github.com/acme/hello-skill',
      repository: 'acme/hello-skill', branch: 'main', version: '1.2.0', commit: 'abc1234',
      skillName: 'hello-skill', displayName: 'Hello Skill',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: hello-skill\nversion: 1.2.0\n---\n# Hello Skill\n\nSimulated install.\n' },
        { relativePath: 'references/guide.md', fileType: 'text', content: '# Guide\n' },
        { relativePath: 'scripts/setup.sh', fileType: 'text', content: '#!/bin/sh\necho setup\n', executable: true },
        { relativePath: 'assets/icon.bin', fileType: 'binary', content: null, sizeBytes: 128 }
      ],
      nestedSkill: false, trustPolicy: 'untrusted-until-reviewed'
    },
    'git:https://example.com/skills/world.git': {
      sourceType: 'git-url', sourceUrl: 'https://example.com/skills/world.git',
      repository: 'example/world', branch: 'main', version: '0.9.0', commit: 'def5678',
      skillName: 'world-skill', displayName: 'World Skill',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: world-skill\nversion: 0.9.0\n---\n# World\n' },
        { relativePath: 'nested/SKILL.md', fileType: 'text', content: '---\nname: nested-world\n---\n# Nested\n', nested: true }
      ],
      nestedSkill: true, trustPolicy: 'untrusted-until-reviewed'
    },
    'zip-url:https://example.com/pkg.zip': {
      sourceType: 'zip-url', sourceUrl: 'https://example.com/pkg.zip',
      repository: null, branch: null, version: '2.0.0', commit: 'zip0001',
      skillName: 'zip-pkg', displayName: 'Zip Package',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: zip-pkg\nversion: 2.0.0\n---\n# Zip\n' }
      ],
      nestedSkill: false, trustPolicy: 'untrusted-until-reviewed'
    },
    'local-directory:~/Skills/local-demo': {
      sourceType: 'local-directory', sourceUrl: '~/Skills/local-demo',
      repository: null, branch: null, version: '0.1.0', commit: null,
      skillName: 'local-demo', displayName: 'Local Demo',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: local-demo\nversion: 0.1.0\n---\n# Local\n' }
      ],
      nestedSkill: false, trustPolicy: 'local-unreviewed'
    },
    'local-zip:~/Downloads/local-demo.zip': {
      sourceType: 'local-zip', sourceUrl: '~/Downloads/local-demo.zip',
      repository: null, branch: null, version: '0.1.1', commit: null,
      skillName: 'local-zip-demo', displayName: 'Local Zip Demo',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: local-zip-demo\nversion: 0.1.1\n---\n# Local Zip\n' }
      ],
      nestedSkill: false, trustPolicy: 'local-unreviewed'
    }
  };

  function ensurePhaseFCollections() {
    ensureEditorCollections();
    const state = getState();
    if (!state.installOperations) state.installOperations = [];
    if (!state.updateOperations) state.updateOperations = [];
    if (!state.uninstallOperations) state.uninstallOperations = [];
    if (!state.duplicateResolutionOperations) state.duplicateResolutionOperations = [];
    if (!state.installSim) {
      state.installSim = {
        failTargetHost: null,
        updateFailRelativePath: null,
        updateFailInstanceId: null,
        updateRollbackFailInstanceId: null,
        uninstallFailInstanceId: null,
        uninstallRollbackFailInstanceId: null,
        rebindFailAfterFileWrite: null,
        rebindFailOnFileIndex: null,
        failRebindAfterDelete: false,
        duplicateFailAfterCreate: false,
        remoteBinaryChanges: null
      };
    } else {
      if (!('updateFailInstanceId' in state.installSim)) state.installSim.updateFailInstanceId = null;
      if (!('updateRollbackFailInstanceId' in state.installSim)) state.installSim.updateRollbackFailInstanceId = null;
      if (!('uninstallFailInstanceId' in state.installSim)) state.installSim.uninstallFailInstanceId = null;
      if (!('uninstallRollbackFailInstanceId' in state.installSim)) state.installSim.uninstallRollbackFailInstanceId = null;
      if (!('rebindFailAfterFileWrite' in state.installSim)) state.installSim.rebindFailAfterFileWrite = null;
      if (!('rebindFailOnFileIndex' in state.installSim)) state.installSim.rebindFailOnFileIndex = null;
      if (!('failRebindAfterDelete' in state.installSim)) state.installSim.failRebindAfterDelete = false;
      if (!('duplicateFailAfterCreate' in state.installSim)) state.installSim.duplicateFailAfterCreate = false;
      if (!('remoteBinaryChanges' in state.installSim)) state.installSim.remoteBinaryChanges = null;
    }
  }

  function fileListHashForInstance(instanceId) {
    const files = getFilesRawInternal({ instanceId }).slice().sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return $hash(files.map(f => f.relativePath).join('|'));
  }

  function isAssetInstallable(asset) {
    if (!asset) return false;
    if (asset.lifecycleStatus === 'deleted') return false;
    if (asset.mergedIntoAssetId) return false;
    return true;
  }

  function listInstallableAssets() {
    ensurePhaseFCollections();
    return getState().assets
      .filter(isAssetInstallable)
      .map(a => ({
        id: a.id,
        name: a.name,
        displayName: a.displayName || a.name,
        lifecycleStatus: a.lifecycleStatus,
        primaryInstanceId: a.primaryInstanceId || null,
        sourceBindingId: a.sourceBindingId || null,
        instanceCount: getState().instances.filter(i => i.skillId === a.id).length
      }));
  }

  function sourceKeyOf(src) {
    if (!src) return '';
    return String(src.sourceType || '') + '::' + String(src.repository || src.sourceUrl || '');
  }

  function isLocalSourceType(sourceType) {
    return sourceType === 'local-directory' || sourceType === 'local-zip';
  }

  function isGithubLikeSourceType(sourceType) {
    return sourceType === 'github' || sourceType === 'git-url';
  }

  function validateInstallHost(hostId) {
    const host = getState().hosts.find(h => h.id === hostId);
    if (!host) return { ok: false, code: 'host_not_found', error: 'Host 不存在: ' + hostId, host: null };
    if (host.enabled === false) return { ok: false, code: 'host_disabled', error: 'Host 已禁用: ' + hostId, host };
    if (!host.path) return { ok: false, code: 'host_not_found', error: 'Host 无有效路径: ' + hostId, host };
    if (host.permissionStatus !== 'granted') {
      return { ok: false, code: 'permission-denied', error: '目标 Host 无权限', host };
    }
    return { ok: true, host };
  }

  function resolveInstallSource(input) {
    ensurePhaseFCollections();
    const raw = String(input || '').trim();
    let key = raw;
    if (/^https:\/\/github\.com\//i.test(raw)) {
      const m = raw.match(/github\.com\/([^\/]+\/[^\/#?]+)/i);
      key = 'github:' + (m ? m[1].replace(/\.git$/, '') : 'acme/hello-skill');
    } else if (/^git(@|\+|https?:)/i.test(raw) || /\.git$/i.test(raw)) {
      key = 'git:https://example.com/skills/world.git';
    } else if (/\.zip$/i.test(raw) && /^https?:/i.test(raw)) {
      key = 'zip-url:https://example.com/pkg.zip';
    } else if (/\.zip$/i.test(raw)) {
      key = 'local-zip:~/Downloads/local-demo.zip';
    } else if (raw.startsWith('~/') || raw.startsWith('/')) {
      key = Object.keys(INSTALL_CATALOG).find(k => k.startsWith('local-directory')) || 'local-directory:~/Skills/local-demo';
    } else if (!INSTALL_CATALOG[key]) {
      key = Object.keys(INSTALL_CATALOG).find(k => INSTALL_CATALOG[k].skillName === raw) || 'github:acme/hello-skill';
    }
    const cat = INSTALL_CATALOG[key];
    if (!cat) return { ok: false, error: 'Unknown source', code: 'unknown_source' };
    const textCount = cat.files.filter(f => f.fileType === 'text').length;
    const binaryCount = cat.files.filter(f => f.fileType === 'binary').length;
    const risks = [];
    if (cat.files.some(f => f.executable)) risks.push({ code: 'executable', severity: 'high', message: '包含可执行脚本（不会执行）' });
    if (cat.nestedSkill) risks.push({ code: 'nested_skill', severity: 'medium', message: '包含 Nested SKILL.md' });
    if (cat.trustPolicy !== 'trusted') risks.push({ code: 'untrusted', severity: 'medium', message: '来源未自动信任' });
    return JSON.parse(JSON.stringify({
      ok: true,
      catalogKey: key,
      sourceType: cat.sourceType,
      sourceUrl: cat.sourceUrl,
      repository: cat.repository,
      branch: cat.branch,
      version: cat.version,
      commit: cat.commit,
      skillName: cat.skillName,
      displayName: cat.displayName,
      fileTree: cat.files.map(f => ({
        relativePath: f.relativePath, fileType: f.fileType,
        sizeBytes: f.sizeBytes != null ? f.sizeBytes : (f.content ? f.content.length : 0),
        nested: !!f.nested, executable: !!f.executable
      })),
      counts: { text: textCount, binary: binaryCount, total: cat.files.length, nested: cat.files.filter(f => f.nested).length },
      risks,
      trustPolicy: cat.trustPolicy,
      simulated: true,
      note: '确定性模拟解析，无真实网络请求'
    }));
  }

  function analyzeInstallConflicts(resolved, hostId) {
    const validated = validateInstallHost(hostId);
    if (!validated.ok) {
      return {
        host: null,
        targetPath: null,
        issues: [{ code: validated.code, severity: 'high', message: validated.error }],
        sameNameAssets: [],
        hostError: validated
      };
    }
    const host = validated.host;
    const sameName = getState().assets.filter(a => a.name === resolved.skillName && isAssetInstallable(a));
    const targetPath = (host.path || '~/.skills') + '/' + resolved.skillName + '/SKILL.md';
    const pathClash = getState().instances.find(i =>
      i.skillFilePath === targetPath &&
      i.lifecycleStatus !== 'deleted' &&
      i.lifecycleStatus !== 'stopped' &&
      i.lifecycleStatus !== 'removed-from-host-simulated' &&
      i.lifecycleStatus !== 'missing'
    );
    const issues = [];
    if (sameName.length) issues.push({ code: 'same_name_asset', severity: 'medium', assetIds: sameName.map(a => a.id), message: '存在同名 Asset' });
    if (pathClash) issues.push({ code: 'path_conflict', severity: 'high', instanceId: pathClash.id, message: '目标路径已有 Instance' });
    return { host, targetPath, issues, sameNameAssets: sameName.map(a => ({ id: a.id, name: a.name })) };
  }

  function emptyInstallDelta() {
    return {
      createdAssetIds: [],
      createdInstanceIds: [],
      createdFileIds: [],
      createdBindingIds: [],
      createdSnapshotIds: []
    };
  }

  function rollbackInstallDelta(delta) {
    if (!delta) return;
    const state = getState();
    const fileIds = new Set(delta.createdFileIds || []);
    const instIds = new Set(delta.createdInstanceIds || []);
    const bindingIds = new Set(delta.createdBindingIds || []);
    const snapIds = new Set(delta.createdSnapshotIds || []);
    const assetIds = new Set(delta.createdAssetIds || []);
    state.files = state.files.filter(f => !fileIds.has(f.id));
    state.instances = state.instances.filter(i => !instIds.has(i.id));
    state.sourceBindings = state.sourceBindings.filter(b => !bindingIds.has(b.id));
    state.snapshots = state.snapshots.filter(s => !snapIds.has(s.id));
    state.assets = state.assets.filter(a => !assetIds.has(a.id));
  }

  function prepareInstall(options = {}) {
    ensurePhaseFCollections();
    const resolved = options.resolved || resolveInstallSource(options.source || options.sourceInput || 'github:acme/hello-skill');
    if (!resolved.ok) return resolved;
    const hostIds = $coerceArray(options.hostIds || options.targets || [(options.hostId || 'claude')]);
    if (!hostIds.length) return { ok: false, code: 'no_target', error: '未选择目标 Host' };
    const mode = options.mode || 'new-asset'; // new-asset | add-instance | rebind | cancel
    if (mode === 'cancel') return { ok: false, code: 'cancelled', error: '用户取消' };

    const existingAssetId = resolveAssetId(options.existingAssetId) || options.existingAssetId || null;
    const existingInstanceId = options.existingInstanceId || null;

    if (mode === 'add-instance') {
      if (!existingAssetId) return { ok: false, code: 'asset_required', error: '作为现有 Asset 的新 Instance 需要 existingAssetId' };
      const asset = getAssetRaw(existingAssetId);
      if (!asset || !isAssetInstallable(asset)) {
        return { ok: false, code: 'asset_not_found', error: '目标 Asset 不存在或已合并/删除' };
      }
    }
    if (mode === 'rebind') {
      if (!existingAssetId || !existingInstanceId) {
        return { ok: false, code: 'rebind_required', error: 'rebind 需要 existingAssetId 与 existingInstanceId' };
      }
      const asset = getAssetRaw(existingAssetId);
      if (!asset || !isAssetInstallable(asset)) {
        return { ok: false, code: 'asset_not_found', error: '目标 Asset 不存在或已合并/删除' };
      }
      const inst = getInstanceRaw(existingInstanceId);
      if (!inst || inst.skillId !== existingAssetId) {
        return { ok: false, code: 'instance_not_found', error: '目标 Instance 不存在或不属于该 Asset' };
      }
      if (inst.lifecycleStatus !== 'missing' && inst.lifecycleStatus !== 'stopped') {
        return { ok: false, code: 'rebind_not_allowed', error: '仅 Missing / Stopped Instance 允许 rebind' };
      }
    }

    const targets = [];
    const allIssues = [];
    for (const hid of hostIds) {
      const analysis = analyzeInstallConflicts(resolved, hid);
      if (analysis.hostError) {
        return {
          ok: false,
          code: analysis.hostError.code,
          error: analysis.hostError.error,
          issues: analysis.issues,
          resolved
        };
      }
      // For rebind, ignore path clash against the same instance being rebound
      const issues = (analysis.issues || []).filter(i => {
        if (mode === 'rebind' && i.code === 'path_conflict' && i.instanceId === existingInstanceId) return false;
        return true;
      });
      allIssues.push(...issues.map(i => Object.assign({ hostId: hid }, i)));
      targets.push({
        hostId: hid,
        hostName: analysis.host ? analysis.host.name : hid,
        hostType: analysis.host ? analysis.host.hostType : null,
        targetPath: analysis.targetPath,
        permissionOk: !(issues || []).some(i => i.code === 'permission-denied'),
        pathConflict: (issues || []).some(i => i.code === 'path_conflict')
      });
    }

    if (allIssues.some(i => i.code === 'path_conflict')) {
      return { ok: false, code: 'path_conflict', error: '同路径冲突被阻止', issues: allIssues, resolved, targets };
    }
    if (allIssues.some(i => i.code === 'permission-denied')) {
      return { ok: false, code: 'permission-denied', error: '目标权限不足', issues: allIssues, resolved, targets };
    }
    if (mode === 'rebind' && targets.length !== 1) {
      return { ok: false, code: 'rebind_single_target', error: 'rebind 仅支持单个目标 Host' };
    }

    const preparedAt = $now();
    const catalog = INSTALL_CATALOG[resolved.catalogKey];
    const confirmationHash = $hash(JSON.stringify({
      catalogKey: resolved.catalogKey, mode, existingAssetId, existingInstanceId, targets: targets.map(t => t.targetPath)
    }));
    const op = {
      id: uuid(),
      type: 'install',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      source: {
        catalogKey: resolved.catalogKey,
        sourceType: resolved.sourceType,
        sourceUrl: resolved.sourceUrl,
        repository: resolved.repository,
        branch: resolved.branch,
        version: resolved.version,
        commit: resolved.commit,
        skillName: resolved.skillName,
        displayName: resolved.displayName,
        trustPolicy: resolved.trustPolicy
      },
      mode,
      existingAssetId,
      existingInstanceId,
      targets,
      issues: allIssues,
      fileManifest: (catalog.files || []).map(f => ({
        relativePath: f.relativePath, fileType: f.fileType,
        contentHash: f.content ? $hash(f.content) : null,
        executable: !!f.executable, nested: !!f.nested
      })),
      checkpointId: null,
      snapshotIds: [],
      confirmationHash,
      results: [],
      confirmedAt: null,
      completedAt: null
    };
    op.checkpointId = uuid();
    op._checkpoint = {
      id: op.checkpointId,
      deltas: []
    };
    getState().installOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      stage: 'confirmation',
      resolved,
      targets,
      issues: allIssues,
      mode,
      existingAssetId,
      existingInstanceId,
      risks: resolved.risks,
      confirmationHash,
      simulated: true
    }));
  }

  function writeInstallFiles(assetId, instanceId, catalog, now, delta, options = {}) {
    const failOnFileIndex = options.failOnFileIndex;
    catalog.files.forEach((f, idx) => {
      if (failOnFileIndex != null && idx === failOnFileIndex) {
        throw new Error('sim_rebind_file_write_fail');
      }
      const fid = uuid();
      getState().files.push(normalizeFile({
        id: fid, instanceId, skillId: assetId,
        relativePath: f.relativePath,
        fileType: f.fileType || 'text',
        mimeType: f.fileType === 'binary' ? 'application/octet-stream' : 'text/markdown',
        sizeBytes: f.content ? f.content.length : (f.sizeBytes || 0),
        content: f.fileType === 'binary' ? null : String(f.content || ''),
        contentHash: f.content ? $hash(f.content) : ('bin-' + (f.sizeBytes || 0)),
        modifiedAt: now,
        tokenCount: f.content ? $tokenApprox(f.content) : 0,
        tokenCountMode: 'estimated',
        indexStatus: 'indexed',
        isNestedSkillMarker: !!f.nested
      }));
      delta.createdFileIds.push(fid);
    });
  }

  function restoreRebindCheckpoint(op, delta) {
    const cp = op._rebindCheckpoint;
    if (!cp || !cp.instance) return false;
    try {
      // Remove newly created entities from this attempt first
      rollbackInstallDelta(delta);
      const iid = cp.instance.id;
      const aid = cp.asset ? cp.asset.id : (cp.instance.skillId || null);

      // Restore instance with original id/fields
      let inst = getInstanceRaw(iid);
      if (!inst) {
        getState().instances.push(JSON.parse(JSON.stringify(cp.instance)));
      } else {
        Object.keys(cp.instance).forEach(k => { inst[k] = cp.instance[k]; });
      }

      // Restore files with original IDs
      getState().files = getState().files.filter(f => f.instanceId !== iid);
      (cp.files || []).forEach(f => {
        if (!getFileRawInternal(f.id)) {
          getState().files.push(JSON.parse(JSON.stringify(f)));
        } else {
          const cur = getFileRawInternal(f.id);
          Object.keys(f).forEach(k => { cur[k] = f[k]; });
        }
      });

      // Restore bindings: drop any created by delta already removed; upsert checkpoint ones
      (cp.sourceBindings || []).forEach(b => {
        const cur = getState().sourceBindings.find(x => x.id === b.id);
        if (!cur) getState().sourceBindings.push(JSON.parse(JSON.stringify(b)));
        else Object.keys(b).forEach(k => { cur[k] = b[k]; });
      });

      // Restore permission grants
      (cp.permissionGrants || []).forEach(g => {
        if (!getState().permissionGrants) getState().permissionGrants = [];
        const cur = getState().permissionGrants.find(x => x.id === g.id);
        if (!cur) getState().permissionGrants.push(JSON.parse(JSON.stringify(g)));
        else Object.keys(g).forEach(k => { cur[k] = g[k]; });
      });

      // Restore asset fields
      if (cp.asset && aid) {
        const asset = getAssetRaw(aid);
        if (asset) Object.keys(cp.asset).forEach(k => { asset[k] = cp.asset[k]; });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function ensureInstallSourceBinding(op, assetId, instanceId, snapId, now, delta, mode) {
    const asset = getAssetRaw(assetId);
    const existingAssetBinding = asset && asset.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === asset.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === assetId && (!b.scope || b.scope === 'asset'));
    const incomingKey = sourceKeyOf(op.source);
    const existingKey = sourceKeyOf(existingAssetBinding);
    const sameSource = !!existingAssetBinding && incomingKey === existingKey;

    if (mode === 'new-asset') {
      if (existingAssetBinding) return existingAssetBinding;
      const binding = normalizeSourceBinding({
        id: uuid(),
        skillId: assetId,
        instanceId: null,
        scope: 'asset',
        sourceType: op.source.sourceType,
        sourceUrl: op.source.sourceUrl,
        repository: op.source.repository,
        branch: op.source.branch,
        baselineVersion: op.source.version,
        baselineCommit: op.source.commit,
        baselineSnapshotId: snapId || null,
        trustPolicy: op.source.trustPolicy,
        lastCheckedAt: now,
        updateStatus: 'up-to-date',
        remoteVersion: op.source.version,
        remoteCommit: op.source.commit,
        sourceDivergence: false
      });
      getState().sourceBindings.push(binding);
      delta.createdBindingIds.push(binding.id);
      if (asset) asset.sourceBindingId = binding.id;
      return binding;
    }

    // add-instance / rebind
    if (sameSource && existingAssetBinding) {
      return existingAssetBinding;
    }

    // Local must not overwrite existing GitHub asset binding
    if (existingAssetBinding && isGithubLikeSourceType(existingAssetBinding.sourceType) && isLocalSourceType(op.source.sourceType)) {
      const binding = normalizeSourceBinding({
        id: uuid(),
        skillId: assetId,
        instanceId,
        scope: 'instance',
        sourceType: op.source.sourceType,
        sourceUrl: op.source.sourceUrl,
        repository: op.source.repository,
        branch: op.source.branch,
        baselineVersion: op.source.version,
        baselineCommit: op.source.commit,
        baselineSnapshotId: snapId || null,
        trustPolicy: op.source.trustPolicy,
        lastCheckedAt: now,
        updateStatus: 'up-to-date',
        remoteVersion: op.source.version,
        remoteCommit: op.source.commit,
        sourceDivergence: true
      });
      getState().sourceBindings.push(binding);
      delta.createdBindingIds.push(binding.id);
      const inst = getInstanceRaw(instanceId);
      if (inst) inst.sourceBindingId = binding.id;
      return binding;
    }

    if (existingAssetBinding && !sameSource) {
      const binding = normalizeSourceBinding({
        id: uuid(),
        skillId: assetId,
        instanceId,
        scope: 'instance',
        sourceType: op.source.sourceType,
        sourceUrl: op.source.sourceUrl,
        repository: op.source.repository,
        branch: op.source.branch,
        baselineVersion: op.source.version,
        baselineCommit: op.source.commit,
        baselineSnapshotId: snapId || null,
        trustPolicy: op.source.trustPolicy,
        lastCheckedAt: now,
        updateStatus: 'up-to-date',
        remoteVersion: op.source.version,
        remoteCommit: op.source.commit,
        sourceDivergence: true
      });
      getState().sourceBindings.push(binding);
      delta.createdBindingIds.push(binding.id);
      const inst = getInstanceRaw(instanceId);
      if (inst) inst.sourceBindingId = binding.id;
      // do NOT overwrite asset.sourceBindingId
      return binding;
    }

    // no existing binding — create asset-level
    const binding = normalizeSourceBinding({
      id: uuid(),
      skillId: assetId,
      instanceId: null,
      scope: 'asset',
      sourceType: op.source.sourceType,
      sourceUrl: op.source.sourceUrl,
      repository: op.source.repository,
      branch: op.source.branch,
      baselineVersion: op.source.version,
      baselineCommit: op.source.commit,
      baselineSnapshotId: snapId || null,
      trustPolicy: op.source.trustPolicy,
      lastCheckedAt: now,
      updateStatus: 'up-to-date',
      remoteVersion: op.source.version,
      remoteCommit: op.source.commit,
      sourceDivergence: false
    });
    getState().sourceBindings.push(binding);
    delta.createdBindingIds.push(binding.id);
    if (asset && !asset.sourceBindingId) asset.sourceBindingId = binding.id;
    return binding;
  }

  function confirmInstall(operationId, options = {}) {
    ensurePhaseFCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed', error: '需要用户确认' };
    const op = getState().installOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    if (Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired'; saveState();
      return { ok: false, code: 'operation_expired' };
    }

    for (const t of op.targets) {
      const clash = getState().instances.find(i =>
        i.skillFilePath === t.targetPath &&
        i.lifecycleStatus !== 'deleted' &&
        i.lifecycleStatus !== 'stopped' &&
        i.lifecycleStatus !== 'removed-from-host-simulated' &&
        i.lifecycleStatus !== 'missing' &&
        !(op.mode === 'rebind' && i.id === op.existingInstanceId)
      );
      if (clash) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: 'path_conflict', error: '确认前再次检查发现路径冲突', operationId };
      }
      const hv = validateInstallHost(t.hostId);
      if (!hv.ok) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: hv.code, error: hv.error, operationId };
      }
    }

    if (op.mode === 'add-instance') {
      const asset = getAssetRaw(op.existingAssetId);
      if (!asset || !isAssetInstallable(asset)) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: 'asset_not_found', error: '目标 Asset 不存在或已合并/删除', operationId };
      }
    }
    if (op.mode === 'rebind') {
      const asset = getAssetRaw(op.existingAssetId);
      const inst = getInstanceRaw(op.existingInstanceId);
      if (!asset || !isAssetInstallable(asset) || !inst || inst.skillId !== op.existingAssetId) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: 'asset_not_found', error: 'rebind 目标无效', operationId };
      }
    }

    op.confirmedAt = $now();
    op.status = 'installing';
    const catalog = INSTALL_CATALOG[op.source.catalogKey];
    const results = [];
    const sim = getState().installSim || {};
    const allDeltas = [];
    let sharedAssetId = null;
    let sharedAssetCreated = false;
    let sharedBindingId = null;
    let anyOk = false;
    let anyFail = false;

    if (op.mode === 'new-asset') {
      sharedAssetId = uuid();
      const now = $now();
      getState().assets.push(normalizeAsset({
        id: sharedAssetId,
        name: op.source.skillName,
        displayName: op.source.displayName || catalog.displayName || op.source.skillName,
        description: 'Installed via simulated source',
        categoryIds: [], tagIds: [],
        lifecycleStatus: 'available',
        primaryInstanceId: null,
        supportedHosts: [],
        createdAt: now, updatedAt: now
      }));
      sharedAssetCreated = true;
    } else if (op.mode === 'add-instance' || op.mode === 'rebind') {
      sharedAssetId = op.existingAssetId;
    }

    op.targets.forEach((t, targetIndex) => {
      const delta = emptyInstallDelta();
      // NOTE: shared new-asset UUID is NOT part of per-target rollback delta.
      // It is only deleted when ALL targets fail.

      if (sim.failTargetHost && sim.failTargetHost === t.hostId) {
        results.push({ hostId: t.hostId, targetPath: t.targetPath, status: 'failed', errorCode: 'sim_fail', message: '模拟安装失败' });
        anyFail = true;
        allDeltas.push({ hostId: t.hostId, delta, success: false });
        return;
      }

      try {
        const now = $now();
        const host = getState().hosts.find(h => h.id === t.hostId);
        const hostType = host ? host.hostType : 'claude-code';
        let assetId = sharedAssetId;
        let instanceId = null;

        if (op.mode === 'rebind') {
          instanceId = op.existingInstanceId;
          const inst = getInstanceRaw(instanceId);
          const assetForCp = getAssetRaw(assetId);
          // Capture private checkpoint BEFORE deleting old files
          op._rebindCheckpoint = {
            asset: assetForCp ? JSON.parse(JSON.stringify(assetForCp)) : null,
            instance: JSON.parse(JSON.stringify(inst)),
            files: getFilesRawInternal({ instanceId }).map(f => JSON.parse(JSON.stringify(f))),
            sourceBindings: getState().sourceBindings.filter(b =>
              b.skillId === assetId || b.instanceId === instanceId
            ).map(b => JSON.parse(JSON.stringify(b))),
            permissionGrants: (getState().permissionGrants || []).filter(g =>
              (g.scopeType === 'instance' && g.scopeId === instanceId) ||
              (g.scopeType === 'asset' && g.scopeId === assetId)
            ).map(g => JSON.parse(JSON.stringify(g)))
          };

          // Create Package Snapshot first (pre-rebind)
          const preSnap = createPackageSnapshotForInstance(instanceId, {
            note: 'Rebind 前 Package Snapshot', source: 'pre-rebind', retained: true
          });
          if (preSnap) {
            getState().snapshots.push(preSnap);
            op.snapshotIds.push(preSnap.id);
            delta.createdSnapshotIds.push(preSnap.id);
          }

          // Keep missing/stopped until all writes succeed
          const priorLifecycle = inst.lifecycleStatus;

          // remove old files for this instance
          getState().files = getState().files.filter(f => f.instanceId !== instanceId);
          if (sim.failRebindAfterDelete) {
            throw new Error('sim_fail_rebind_after_delete');
          }

          inst.hostType = hostType;
          inst.rootPath = t.targetPath.replace(/\/SKILL\.md$/, '');
          inst.skillFilePath = t.targetPath;
          // do NOT set available yet
          inst.lifecycleStatus = priorLifecycle;
          inst.permissionMode = 'managed';
          inst.installedVersion = op.source.version || '0.1.0';
          inst.healthStatuses = ['normal'];
          inst.lastSeenAt = now;
          inst.contentHash = $hash((catalog.files.find(f => f.relativePath === 'SKILL.md') || {}).content || '');
          inst.fileCount = catalog.files.length;
          inst.packageSizeBytes = catalog.files.reduce((n, f) => n + (f.content ? f.content.length : (f.sizeBytes || 0)), 0);
          inst.localModificationStatus = 'clean';

          let failOnFileIndex = null;
          if (sim.rebindFailAfterFileWrite != null) failOnFileIndex = sim.rebindFailAfterFileWrite;
          else if (sim.rebindFailOnFileIndex != null) failOnFileIndex = sim.rebindFailOnFileIndex;
          writeInstallFiles(assetId, instanceId, catalog, now, delta, { failOnFileIndex });

          // Only set available AFTER all writes succeed
          inst.lifecycleStatus = 'available';
        } else {
          instanceId = uuid();
          const hasPrimary = getState().instances.some(i => i.skillId === assetId && i.isPrimary && i.lifecycleStatus === 'available');
          getState().instances.push(normalizeInstance({
            id: instanceId, skillId: assetId, hostType,
            rootPath: t.targetPath.replace(/\/SKILL\.md$/, ''),
            skillFilePath: t.targetPath,
            lifecycleStatus: 'available', permissionMode: 'managed',
            installedVersion: op.source.version || '0.1.0',
            healthStatuses: ['normal'],
            isPrimary: !hasPrimary,
            lastSeenAt: now,
            contentHash: $hash((catalog.files.find(f => f.relativePath === 'SKILL.md') || {}).content || ''),
            fileCount: catalog.files.length,
            packageSizeBytes: catalog.files.reduce((n, f) => n + (f.content ? f.content.length : (f.sizeBytes || 0)), 0),
            localModificationStatus: 'clean'
          }));
          delta.createdInstanceIds.push(instanceId);
          writeInstallFiles(assetId, instanceId, catalog, now, delta);
        }

        const asset = getAssetRaw(assetId);
        if (asset) {
          const hosts = normalizeSupportedHosts(asset.supportedHosts);
          if (hostType && !hosts.includes(hostType)) hosts.push(hostType);
          asset.supportedHosts = hosts;
          if (!asset.primaryInstanceId) {
            const primary = getState().instances.find(i => i.skillId === assetId && i.isPrimary) || getInstanceRaw(instanceId);
            asset.primaryInstanceId = primary ? primary.id : instanceId;
          }
          asset.updatedAt = now;
        }

        const snap = createPackageSnapshotForInstance(instanceId, {
          note: op.mode === 'rebind' ? 'Rebind 基线 Package Snapshot' : '安装基线 Package Snapshot',
          source: op.mode === 'rebind' ? 'install-rebind' : 'install-baseline',
          retained: true
        });
        let snapId = null;
        if (snap) {
          getState().snapshots.push(snap);
          op.snapshotIds.push(snap.id);
          delta.createdSnapshotIds.push(snap.id);
          snapId = snap.id;
        }

        // ONE asset-level binding for new-asset (shared); add-instance may diverge
        let binding = null;
        if (op.mode === 'new-asset') {
          if (!sharedBindingId) {
            binding = ensureInstallSourceBinding(op, assetId, instanceId, snapId, now, delta, 'new-asset');
            sharedBindingId = binding.id;
          } else {
            binding = getState().sourceBindings.find(b => b.id === sharedBindingId);
          }
        } else {
          binding = ensureInstallSourceBinding(op, assetId, instanceId, snapId, now, delta, op.mode);
        }

        addAuditEvent({
          skillId: assetId, instanceId,
          eventType: op.mode === 'rebind' ? 'install_rebind' : 'install_completed',
          category: 'install',
          source: 'Skill Panel', result: 'completed', snapshotId: snapId,
          note: (op.mode === 'rebind' ? '模拟 Rebind · ' : '模拟安装 · ') + op.source.skillName + ' → ' + t.targetPath
        });
        results.push({
          hostId: t.hostId, hostType, targetPath: t.targetPath, status: 'completed',
          assetId, instanceId, snapshotId: snapId, bindingId: binding ? binding.id : null
        });
        anyOk = true;
        allDeltas.push({ hostId: t.hostId, delta, success: true });
      } catch (e) {
        let rollbackStatus = 'failed';
        if (op.mode === 'rebind' && op._rebindCheckpoint) {
          const restored = restoreRebindCheckpoint(op, delta);
          rollbackStatus = restored ? 'rolled-back' : 'rollback-failed';
        } else {
          rollbackInstallDelta(delta);
        }
        results.push({
          hostId: t.hostId, targetPath: t.targetPath,
          status: rollbackStatus === 'failed' ? 'failed' : rollbackStatus,
          errorCode: 'exception',
          message: String(e.message || e),
          rollbackStatus
        });
        anyFail = true;
        allDeltas.push({ hostId: t.hostId, delta: emptyInstallDelta(), success: false });
      }
    });

    op._checkpoint.deltas = allDeltas;

    if (anyFail && !anyOk) {
      // ALL targets failed — delete created Asset and all its created entities
      const union = emptyInstallDelta();
      allDeltas.forEach(d => {
        (d.delta.createdAssetIds || []).forEach(id => union.createdAssetIds.push(id));
        (d.delta.createdInstanceIds || []).forEach(id => union.createdInstanceIds.push(id));
        (d.delta.createdFileIds || []).forEach(id => union.createdFileIds.push(id));
        (d.delta.createdBindingIds || []).forEach(id => union.createdBindingIds.push(id));
        (d.delta.createdSnapshotIds || []).forEach(id => union.createdSnapshotIds.push(id));
      });
      if (sharedAssetCreated) {
        // also sweep by asset id in case delta missed
        const aid = sharedAssetId;
        getState().files = getState().files.filter(f => f.skillId !== aid);
        getState().instances = getState().instances.filter(i => i.skillId !== aid);
        getState().sourceBindings = getState().sourceBindings.filter(b => b.skillId !== aid);
        getState().snapshots = getState().snapshots.filter(s => s.skillId !== aid);
        getState().assets = getState().assets.filter(a => a.id !== aid);
      } else {
        rollbackInstallDelta(union);
      }
      const rebindRollback = results.find(r => r.rollbackStatus === 'rolled-back' || r.rollbackStatus === 'rollback-failed');
      op.status = rebindRollback
        ? (results.some(r => r.rollbackStatus === 'rollback-failed') ? 'rollback-failed' : 'rolled-back')
        : 'failed';
      op.results = results;
      op.completedAt = $now();
      addAuditEvent({
        eventType: 'install_failed', category: 'install', source: 'Skill Panel', result: 'failed',
        note: op.mode === 'rebind'
          ? ('Rebind 失败并' + (op.status === 'rollback-failed' ? '回滚失败' : (op.status === 'rolled-back' ? '回滚' : '中止')))
          : '安装失败，已清理半成品'
      });
      saveState();
      return JSON.parse(JSON.stringify({ ok: false, status: op.status, operationId, results }));
    }

    // Partial fail: successful instances kept; failed targets already rolled back at exception path.
    // Sim-fail path created no entities for that target (except possibly shared asset which is kept if anyOk).
    if (sharedAssetCreated && anyOk) {
      const asset = getAssetRaw(sharedAssetId);
      if (asset) {
        const hosts = results.filter(r => r.status === 'completed').map(r => {
          if (r.hostType) return r.hostType;
          const h = getState().hosts.find(x => x.id === r.hostId);
          return h ? h.hostType : r.hostId;
        });
        asset.supportedHosts = normalizeSupportedHosts(hosts);
        const primaries = getState().instances.filter(i => i.skillId === sharedAssetId && i.isPrimary);
        if (primaries.length > 1) {
          primaries.slice(1).forEach(i => { i.isPrimary = false; });
        }
        if (!getState().instances.some(i => i.skillId === sharedAssetId && i.isPrimary)) {
          const first = getState().instances.find(i => i.skillId === sharedAssetId);
          if (first) {
            first.isPrimary = true;
            asset.primaryInstanceId = first.id;
          }
        } else {
          asset.primaryInstanceId = getState().instances.find(i => i.skillId === sharedAssetId && i.isPrimary).id;
        }
      }
    }

    op.status = (anyFail && anyOk) ? 'partially-completed' : 'completed';
    op.results = results;
    op.completedAt = $now();
    saveState();
    return JSON.parse(JSON.stringify({
      ok: !anyFail,
      status: op.status,
      operationId,
      results,
      assetId: sharedAssetId,
      snapshotIds: op.snapshotIds
    }));
  }

  function getInstallOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().installOperations.find(o => o.id === operationId);
    return op ? toSafeOperationView(op) : null;
  }

  function loadInstallDemoCase(caseId) {
    ensurePhaseFCollections();
    const sim = getState().installSim;
    sim.failTargetHost = null;
    sim.rebindFailAfterFileWrite = null;
    sim.rebindFailOnFileIndex = null;
    sim.failRebindAfterDelete = false;
    sim.uninstallRollbackFailInstanceId = null;
    sim.duplicateFailAfterCreate = false;
    if (caseId === 'fail-codex') sim.failTargetHost = 'codex';
    else if (caseId === 'rebind-fail-after-delete') {
      sim.rebindFailAfterFileWrite = 1; // fail when writing the 2nd file (index 1)
    }
    else if (caseId === 'uninstall-rollback-fail') {
      /* caller sets uninstallFailInstanceId + uninstallRollbackFailInstanceId */
    }
    else if (caseId === 'clear') { /* noop */ }
    else return { ok: false, error: 'Unknown case' };
    saveState();
    return { ok: true, caseId };
  }

  function openInstallPage(context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const q = new URLSearchParams();
    if (context.source) q.set('source', context.source);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'install.html' + (q.toString() ? ('?' + q.toString()) : '');
  }

  /* ----- Update ----- */
  function checkForUpdates(assetIdOrInstanceId) {
    ensurePhaseFCollections();
    const assetId = resolveAssetId(assetIdOrInstanceId) || (getInstanceRaw(assetIdOrInstanceId) || {}).skillId;
    if (!assetId) return { ok: false, code: 'not_found' };
    const asset = getAssetRaw(assetId);
    const binding = asset && asset.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === asset.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === assetId);
    if (!binding) {
      return { ok: true, updateStatus: 'no-source', message: '本地 Skill 无 SourceBinding，无法检查更新' };
    }
    const sim = getState().installSim || {};
    const remoteVersion = sim.remoteVersion || binding.remoteVersion || bumpVersion(binding.baselineVersion || '1.0.0');
    const remoteCommit = sim.remoteCommit || ('r' + $hash(remoteVersion).slice(0, 7));
    const available = sim.forceUpdateAvailable || (remoteVersion !== binding.baselineVersion);
    binding.lastCheckedAt = $now();
    binding.remoteVersion = remoteVersion;
    binding.remoteCommit = remoteCommit;
    binding.updateStatus = available ? 'update-available' : 'up-to-date';
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      assetId,
      updateStatus: binding.updateStatus,
      baselineVersion: binding.baselineVersion,
      baselineCommit: binding.baselineCommit,
      remoteVersion,
      remoteCommit,
      baselineSnapshotId: binding.baselineSnapshotId,
      trustPolicy: binding.trustPolicy
    }));
  }

  function bumpVersion(v) {
    const parts = String(v || '1.0.0').split('.').map(n => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    parts[2] += 1;
    return parts.join('.');
  }

  function buildRemoteCandidateFiles(assetId, binding) {
    const inst = getState().instances.find(i => i.skillId === assetId && i.isPrimary) || getState().instances.find(i => i.skillId === assetId);
    if (!inst) return [];
    const files = getFilesRawInternal({ instanceId: inst.id });
    const sim = getState().installSim || {};
    const binaryChanges = sim.remoteBinaryChanges || {};
    return files.map(f => {
      if (f.fileType === 'binary') {
        const override = binaryChanges[f.relativePath];
        if (override) {
          return {
            fileId: f.id,
            relativePath: f.relativePath,
            fileType: 'binary',
            content: null,
            contentHash: override.contentHash != null ? override.contentHash : f.contentHash,
            changed: !!override.changed,
            sizeBytes: override.sizeBytes != null ? override.sizeBytes : (f.sizeBytes || 0)
          };
        }
        return {
          fileId: f.id,
          relativePath: f.relativePath,
          fileType: 'binary',
          content: null,
          contentHash: f.contentHash,
          changed: false,
          sizeBytes: f.sizeBytes || 0
        };
      }
      let content = String(f.content || '');
      if (f.relativePath === 'SKILL.md') {
        content = content.replace(/version:\s*[^\n]+/, 'version: ' + (binding.remoteVersion || '9.9.9'));
        if (!/REMOTE_UPDATE_MARKER/.test(content)) content += '\n\n<!-- REMOTE_UPDATE_MARKER -->\n';
      } else if (f.relativePath.indexOf('references/') === 0) {
        content = content + '\n\n<!-- remote ref update -->\n';
      }
      return {
        fileId: f.id, relativePath: f.relativePath, fileType: 'text',
        content, contentHash: $hash(content),
        changed: content !== String(f.content || ''),
        sizeBytes: content.length
      };
    });
  }

  function plannedRemoteAddContent(relativePath) {
    return '# ' + relativePath + '\n\n<!-- REMOTE_ADD_CANDIDATE -->\n';
  }

  function buildPreviewInstanceStates(targets, relativePath) {
    const states = (targets || []).map(i => {
      const file = getFilesRawInternal({ instanceId: i.id }).find(f => f.relativePath === relativePath);
      return {
        instanceId: i.id,
        localExists: !!file,
        localHash: file ? file.contentHash : null,
        localSize: file ? (file.sizeBytes || 0) : 0,
        localModificationStatus: i.localModificationStatus || 'clean',
        differsFromOtherInstances: false
      };
    });
    const signatures = states.map(s =>
      String(!!s.localExists) + '|' + String(s.localHash || '') + '|' + String(s.localSize || 0)
    );
    const allSame = signatures.length <= 1 || signatures.every(sig => sig === signatures[0]);
    states.forEach(s => { s.differsFromOtherInstances = !allSame; });
    return states;
  }

  function getUpdatePlanPreview(options = {}) {
    ensurePhaseFCollections();
    const assetId = resolveAssetId(options.assetId) || options.assetId;
    if (!assetId) return { ok: false, code: 'not_found' };
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, code: 'not_found' };
    const binding = asset.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === asset.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === assetId);
    if (!binding) {
      return { ok: true, updateStatus: 'no-source', assetId, files: [], instances: [], message: '无 SourceBinding' };
    }
    const sim = getState().installSim || {};
    const remoteVersion = sim.remoteVersion || binding.remoteVersion || bumpVersion(binding.baselineVersion || '1.0.0');
    const remoteCommit = sim.remoteCommit || binding.remoteCommit || ('r' + $hash(remoteVersion).slice(0, 7));
    const available = sim.forceUpdateAvailable || (remoteVersion !== binding.baselineVersion);
    if (!available) {
      return JSON.parse(JSON.stringify({
        ok: true, assetId, updateStatus: 'up-to-date',
        baselineVersion: binding.baselineVersion, remoteVersion, remoteCommit,
        files: [], remoteAdds: [], remoteDeletes: [], instances: []
      }));
    }

    const instanceIds = $coerceArray(options.instanceIds);
    const allInst = getState().instances.filter(i =>
      i.skillId === assetId && i.lifecycleStatus !== 'missing' && i.lifecycleStatus !== 'deleted'
    );
    const targets = instanceIds.length ? allInst.filter(i => instanceIds.includes(i.id)) : allInst;
    const primary = targets.find(i => i.isPrimary) || targets[0] || allInst[0];
    const bindingForRemote = Object.assign({}, binding, { remoteVersion, remoteCommit });
    const remoteFiles = buildRemoteCandidateFiles(assetId, bindingForRemote);

    const files = [];
    remoteFiles.forEach(rf => {
      const local = primary
        ? getFilesRawInternal({ instanceId: primary.id }).find(f => f.relativePath === rf.relativePath)
        : null;
      const isBinary = rf.fileType === 'binary';
      const localMod = !!(local && primary && primary.localModificationStatus &&
        primary.localModificationStatus !== 'clean' && rf.relativePath === 'SKILL.md');
      if (isBinary) {
        const localHash = local ? local.contentHash : null;
        const remoteHash = rf.contentHash;
        const localSize = local ? (local.sizeBytes || 0) : 0;
        const remoteSize = rf.sizeBytes || 0;
        const hashDiff = remoteHash != null && localHash != null && remoteHash !== localHash;
        const sizeDiff = Number(remoteSize) !== Number(localSize);
        if (!(rf.changed === true || hashDiff || sizeDiff)) return;
        files.push({
          relativePath: rf.relativePath,
          changeType: 'binary-changed',
          fileType: 'binary',
          isBinary: true,
          localHash,
          remoteHash: remoteHash || null,
          localSize,
          remoteSize,
          hasLocalModification: false,
          allowedStrategies: ['use-remote', 'keep-local', 'defer'],
          instanceStates: buildPreviewInstanceStates(targets, rf.relativePath)
        });
        return;
      }
      if (!rf.changed) return;
      files.push({
        relativePath: rf.relativePath,
        changeType: 'modified',
        fileType: 'text',
        isBinary: false,
        localHash: local ? local.contentHash : null,
        remoteHash: rf.contentHash,
        localSize: local ? (local.sizeBytes || 0) : 0,
        remoteSize: rf.sizeBytes || 0,
        hasLocalModification: localMod || !!(local && local.contentHash && rf.contentHash && local.contentHash !== rf.contentHash &&
          String(local.content || '').indexOf('REMOTE_UPDATE_MARKER') < 0),
        allowedStrategies: ['use-remote', 'keep-local', 'manual-merge', 'defer'],
        instanceStates: buildPreviewInstanceStates(targets, rf.relativePath)
      });
    });

    // Planned remote add (metadata only — no body)
    const addPath = 'NEW_REMOTE.md';
    if (!files.some(f => f.relativePath === addPath)) {
      files.push({
        relativePath: addPath,
        changeType: 'added',
        fileType: 'text',
        isBinary: false,
        localHash: null,
        remoteHash: $hash(plannedRemoteAddContent(addPath)),
        localSize: 0,
        remoteSize: plannedRemoteAddContent(addPath).length,
        hasLocalModification: false,
        allowedStrategies: ['use-remote', 'manual-merge', 'defer'],
        instanceStates: buildPreviewInstanceStates(targets, addPath)
      });
    }

    // Planned remote delete: pick a non-SKILL text reference if present
    let deletePath = null;
    if (primary) {
      const cand = getFilesRawInternal({ instanceId: primary.id }).find(f =>
        f.relativePath !== 'SKILL.md' && f.fileType !== 'binary' && f.relativePath.indexOf('references/') === 0
      );
      if (cand) deletePath = cand.relativePath;
    }
    if (deletePath) {
      for (let i = files.length - 1; i >= 0; i--) {
        if (files[i].relativePath === deletePath) files.splice(i, 1);
      }
      const local = getFilesRawInternal({ instanceId: primary.id }).find(f => f.relativePath === deletePath);
      files.push({
        relativePath: deletePath,
        changeType: 'deleted',
        fileType: 'text',
        isBinary: false,
        localHash: local ? local.contentHash : null,
        remoteHash: null,
        localSize: local ? (local.sizeBytes || 0) : 0,
        remoteSize: 0,
        hasLocalModification: false,
        allowedStrategies: ['use-remote', 'keep-local', 'defer'],
        instanceStates: buildPreviewInstanceStates(targets, deletePath)
      });
    }

    const instances = targets.map(i => {
      const perm = getInstancePermission(i.id) || {};
      return {
        id: i.id,
        hostType: i.hostType,
        hostLabel: _hostLabel(i.hostType),
        path: i.skillFilePath || i.rootPath,
        lifecycleStatus: i.lifecycleStatus,
        readAccess: !!perm.readAccess,
        writeAccess: !!perm.writeAccess,
        permissionMode: perm.permissionMode || i.permissionMode || 'read-only',
        contentAccessStatus: perm.contentAccessStatus || null,
        scopePaths: perm.scopePaths || [],
        localModificationStatus: i.localModificationStatus || 'clean'
      };
    });

    return JSON.parse(JSON.stringify({
      ok: true,
      assetId,
      updateStatus: 'update-available',
      baselineVersion: binding.baselineVersion,
      baselineCommit: binding.baselineCommit,
      remoteVersion,
      remoteCommit,
      trustPolicy: binding.trustPolicy,
      files,
      remoteAdds: files.filter(f => f.changeType === 'added'),
      remoteDeletes: files.filter(f => f.changeType === 'deleted'),
      instances
    }));
  }

  function cancelUpdateOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().updateOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    op.status = 'cancelled';
    op.completedAt = $now();
    saveState();
    return { ok: true, operationId, status: 'cancelled' };
  }

  function buildUpdateConfirmationPayload(fields) {
    return {
      targets: fields.targets,
      selectedRelativePaths: fields.selectedRelativePaths,
      fileStrategies: fields.fileStrategies,
      remoteAdds: fields.remoteAdds,
      remoteDeletes: fields.remoteDeletes,
      remoteContentStates: fields.remoteContentStates,
      remoteVersion: fields.remoteVersion,
      remoteCommit: fields.remoteCommit,
      snapshotIds: fields.snapshotIds
    };
  }

  function buildUpdateRemoteContentStates(_remoteContents, remoteFiles, remoteAdds, remoteDeletes) {
    const states = [];
    const seen = new Set();
    const deleteSet = new Set($coerceArray(remoteDeletes).map(d => typeof d === 'string' ? d : d.relativePath));
    const addsList = $coerceArray(remoteAdds);

    (remoteFiles || []).forEach(f => {
      if (deleteSet.has(f.relativePath)) return;
      const body = _remoteContents[f.relativePath];
      const isBinary = f.fileType === 'binary';
      states.push({
        relativePath: f.relativePath,
        exists: true,
        fileType: f.fileType || 'text',
        contentHash: isBinary ? (f.contentHash || null) : $hash(String(body != null ? body : '')),
        sizeBytes: isBinary ? (f.sizeBytes || 0) : String(body != null ? body : '').length
      });
      seen.add(f.relativePath);
    });

    addsList.forEach(add => {
      const rel = typeof add === 'string' ? add : add.relativePath;
      if (seen.has(rel)) return;
      const body = _remoteContents[rel];
      const fileType = (typeof add === 'object' && add.fileType) || 'text';
      const isBinary = fileType === 'binary';
      states.push({
        relativePath: rel,
        exists: true,
        fileType,
        contentHash: isBinary
          ? ((typeof add === 'object' && add.contentHash) || null)
          : $hash(String(body != null ? body : '')),
        sizeBytes: isBinary
          ? ((typeof add === 'object' && add.sizeBytes) || 0)
          : String(body != null ? body : '').length
      });
      seen.add(rel);
    });

    deleteSet.forEach(rel => {
      states.push({ relativePath: rel, exists: false, fileType: null, contentHash: null, sizeBytes: 0 });
    });

    return states;
  }

  function remoteAddsMetadataOnly(remoteAdds, remoteContentStates) {
    const stateByPath = {};
    (remoteContentStates || []).forEach(s => { stateByPath[s.relativePath] = s; });
    return $coerceArray(remoteAdds).map(add => {
      const rel = typeof add === 'string' ? add : add.relativePath;
      const st = stateByPath[rel];
      if (st) {
        return {
          relativePath: st.relativePath,
          exists: !!st.exists,
          fileType: st.fileType || null,
          contentHash: st.contentHash || null,
          sizeBytes: st.sizeBytes != null ? st.sizeBytes : 0
        };
      }
      return {
        relativePath: rel,
        exists: true,
        fileType: (typeof add === 'object' && add.fileType) || 'text',
        contentHash: null,
        sizeBytes: 0
      };
    });
  }

  function verifyUpdateRemoteContentIntegrity(op) {
    const expectedHash = $hash(JSON.stringify(buildUpdateConfirmationPayload({
      targets: op.targets,
      selectedRelativePaths: op.selectedRelativePaths,
      fileStrategies: op.fileStrategies,
      remoteAdds: op.remoteAdds,
      remoteDeletes: op.remoteDeletes,
      remoteContentStates: op.remoteContentStates,
      remoteVersion: op.remoteVersion,
      remoteCommit: op.remoteCommit,
      snapshotIds: op.snapshotIds
    })));
    if (!op.confirmationHash || expectedHash !== op.confirmationHash) {
      return { ok: false, code: 'operation_tampered', error: 'Operation 内容已变化', operationId: op.id };
    }
    for (const st of op.remoteContentStates || []) {
      if (!st.exists) continue;
      if (!op._remoteContents || !Object.prototype.hasOwnProperty.call(op._remoteContents, st.relativePath)) {
        return { ok: false, code: 'operation_tampered', error: '缺少远程内容: ' + st.relativePath, operationId: op.id };
      }
      const body = op._remoteContents[st.relativePath];
      const isBinary = st.fileType === 'binary';
      const actualHash = isBinary ? st.contentHash : $hash(String(body != null ? body : ''));
      const actualSize = isBinary
        ? (st.sizeBytes || 0)
        : String(body != null ? body : '').length;
      if (actualHash !== st.contentHash || actualSize !== st.sizeBytes) {
        return { ok: false, code: 'operation_tampered', error: '远程内容校验失败: ' + st.relativePath, operationId: op.id };
      }
    }
    return { ok: true };
  }

  function createRemoteBaselineSnapshot(op) {
    const assetId = op.source && op.source.assetId;
    if (!assetId) return null;
    const deleteSet = new Set($coerceArray(op.remoteDeletes).map(d => typeof d === 'string' ? d : d.relativePath));
    const records = (op.remoteContentStates || [])
      .filter(s => s.exists && !deleteSet.has(s.relativePath))
      .map(s => {
        const body = op._remoteContents && op._remoteContents[s.relativePath];
        const isBinary = s.fileType === 'binary';
        const rec = {
          relativePath: s.relativePath,
          fileType: s.fileType || 'text',
          mimeType: isBinary ? 'application/octet-stream' : 'text/markdown',
          sizeBytes: s.sizeBytes || 0,
          contentHash: s.contentHash,
          modifiedAt: $now(),
          indexStatus: 'indexed',
          contentCaptureStatus: isBinary || body == null ? 'metadata-only' : 'full'
        };
        if (!isBinary && body != null) rec.content = String(body);
        return rec;
      });
    let capturedFileCount = 0;
    let metadataOnlyFileCount = 0;
    records.forEach(r => {
      if (r.contentCaptureStatus === 'full') capturedFileCount += 1;
      else metadataOnlyFileCount += 1;
    });
    const contentCaptureStatus = metadataOnlyFileCount === 0
      ? 'full'
      : (capturedFileCount === 0 ? 'metadata-only' : 'partial');
    const snap = normalizeSnapshot({
      id: uuid(),
      skillId: assetId,
      instanceId: null,
      type: 'package',
      createdAt: $now(),
      note: 'Remote baseline · v' + (op.remoteVersion || '') + ' · ' + (op.remoteCommit || ''),
      source: 'remote-baseline',
      files: records,
      retained: true,
      fileCount: records.length,
      packageSizeBytes: records.reduce((n, f) => n + (f.sizeBytes || 0), 0),
      contentCaptureStatus,
      capturedFileCount,
      metadataOnlyFileCount,
      remoteVersion: op.remoteVersion,
      remoteCommit: op.remoteCommit
    });
    getState().snapshots.push(snap);
    return snap;
  }

  function computeUpdateInstanceLocalModStatus(fileResults) {
    if (fileResults.some(r => r.status === 'manual-merge')) return 'pending-merge';
    if (fileResults.some(r => r.status === 'kept-local')) return 'modified';
    return 'clean';
  }

  function normalizeUpdatePathClassification(selectedRelativePaths, remoteAdds, remoteDeletes) {
    const addPaths = new Set();
    $coerceArray(remoteAdds).forEach(a => {
      const p = typeof a === 'string' ? a : (a && a.relativePath);
      if (p) addPaths.add(p);
    });
    const deletePaths = new Set();
    $coerceArray(remoteDeletes).forEach(d => {
      const p = typeof d === 'string' ? d : (d && d.relativePath);
      if (p) deletePaths.add(p);
    });
    for (const p of addPaths) {
      if (deletePaths.has(p)) {
        return {
          ok: false,
          code: 'invalid_path_classification',
          error: 'path in both remoteAdds and remoteDeletes: ' + p
        };
      }
    }
    const selected = new Set();
    $coerceArray(selectedRelativePaths).forEach(p => {
      if (!p) return;
      if (addPaths.has(p) || deletePaths.has(p)) return;
      selected.add(p);
    });
    return {
      ok: true,
      selectedRelativePaths: [...selected],
      remoteAddPaths: [...addPaths],
      remoteDeletePaths: [...deletePaths]
    };
  }

  function ensureUpdateManualMergeArtifacts(op, instanceId, relativePath, file, remoteContent) {
    if (remoteContent == null) return;
    const drafts = getState().drafts;
    const existingDraft = drafts.find(d =>
      d.sourceOperationId === op.id &&
      d.instanceId === instanceId &&
      d.relativePath === relativePath &&
      d.status === 'update-manual-merge'
    );
    if (!existingDraft) {
      drafts.push(normalizeDraft({
        id: uuid(),
        skillId: op.source.assetId,
        instanceId,
        fileId: file ? file.id : null,
        relativePath,
        content: String(remoteContent),
        createdAt: $now(),
        updatedAt: $now(),
        baseContentHash: file ? file.contentHash : null,
        baseFileModifiedAt: file ? file.modifiedAt : null,
        status: 'update-manual-merge',
        sourceOperationId: op.id
      }));
    }
    const existingTask = getState().pendingTasks.find(t =>
      t.sourceOperationId === op.id &&
      t.instanceId === instanceId &&
      t.relativePath === relativePath &&
      t.taskType === 'update_manual_merge' &&
      t.status === 'open'
    );
    if (!existingTask) {
      getState().pendingTasks.push(normalizePendingTask({
        id: uuid(),
        skillId: op.source.assetId,
        instanceId,
        taskType: 'update_manual_merge',
        priority: 'normal',
        status: 'open',
        createdAt: $now(),
        sourceOperationId: op.id,
        relativePath,
        note: '更新需手动合并 · ' + relativePath
      }));
    }
  }

  function applyConfirmUpdateInstanceState(op, instanceId, fileResults) {
    const files = fileResults || [];
    const checkpoint = op._instanceCheckpoints && op._instanceCheckpoints[instanceId];
    const hasManualMerge = files.some(x => x.status === 'manual-merge');
    const hasKeepLocal = files.some(x => x.status === 'kept-local');
    const fullyApplied = files.length > 0 && files.every(x => x.status === 'completed');

    let localModificationStatus;
    if (hasManualMerge) {
      localModificationStatus = 'pending-merge';
    } else if (hasKeepLocal) {
      localModificationStatus = 'modified';
    } else if (fullyApplied) {
      localModificationStatus = 'clean';
    } else {
      localModificationStatus = (checkpoint && checkpoint.instance)
        ? checkpoint.instance.localModificationStatus
        : 'clean';
    }

    const inst = getInstanceRaw(instanceId);
    if (inst) {
      const fileList = getFilesRawInternal({ instanceId });
      inst.fileCount = fileList.length;
      inst.packageSizeBytes = fileList.reduce((n, f) => n + (f.sizeBytes || 0), 0);
      inst.contentHash = (fileList.find(f => f.relativePath === 'SKILL.md') || {}).contentHash || inst.contentHash;
      inst.localModificationStatus = localModificationStatus;
      if (fullyApplied) {
        inst.installedVersion = op.remoteVersion;
      } else if (checkpoint && checkpoint.instance && checkpoint.instance.installedVersion != null) {
        inst.installedVersion = checkpoint.instance.installedVersion;
      }
      // All-defer: restore package identity from checkpoint to guarantee hash parity
      const allDeferred = files.length > 0 && files.every(x => x.status === 'deferred');
      if (allDeferred && checkpoint && checkpoint.instance) {
        inst.contentHash = checkpoint.instance.contentHash;
        inst.fileCount = checkpoint.instance.fileCount;
        inst.packageSizeBytes = checkpoint.instance.packageSizeBytes;
        inst.localModificationStatus = checkpoint.instance.localModificationStatus;
        inst.installedVersion = checkpoint.instance.installedVersion;
      }
      inst.lastSeenAt = $now();
    }
    return { localModificationStatus, fullyApplied, hasManualMerge, hasKeepLocal };
  }

  function captureUpdateInstanceCheckpoint(instanceId) {
    const inst = getInstanceRaw(instanceId);
    const files = getFilesRawInternal({ instanceId });
    return {
      instance: inst ? {
        id: inst.id,
        contentHash: inst.contentHash,
        fileCount: inst.fileCount,
        packageSizeBytes: inst.packageSizeBytes,
        localModificationStatus: inst.localModificationStatus,
        installedVersion: inst.installedVersion
      } : null,
      packageHash: packageHashForInstance(instanceId),
      files: files.map(f => ({
        id: f.id,
        instanceId: f.instanceId,
        skillId: f.skillId,
        relativePath: f.relativePath,
        fileType: f.fileType,
        mimeType: f.mimeType,
        content: f.content != null ? String(f.content) : null,
        contentHash: f.contentHash,
        modifiedAt: f.modifiedAt,
        sizeBytes: f.sizeBytes,
        tokenCount: f.tokenCount,
        tokenCountMode: f.tokenCountMode,
        indexStatus: f.indexStatus,
        skipReason: f.skipReason || null,
        isNestedSkillMarker: !!f.isNestedSkillMarker
      }))
    };
  }

  function prepareUpdate(options = {}) {
    ensurePhaseFCollections();
    const assetId = resolveAssetId(options.assetId) || options.assetId;
    if (!assetId) return { ok: false, code: 'not_found' };
    const check = checkForUpdates(assetId);
    if (check.updateStatus === 'up-to-date' && !options.force) {
      return { ok: true, updateStatus: 'up-to-date', wrote: false, message: '无更新，不创建写入 Operation' };
    }
    if (check.updateStatus === 'no-source') return check;
    const asset = getAssetRaw(assetId);
    const binding = getState().sourceBindings.find(b => b.id === (asset && asset.sourceBindingId)) ||
      getState().sourceBindings.find(b => b.skillId === assetId);
    if (!binding) return { ok: false, code: 'no-source' };

    const instanceIds = $coerceArray(options.instanceIds);
    const allInst = getState().instances.filter(i => i.skillId === assetId && i.lifecycleStatus !== 'missing');
    const targets = (instanceIds.length ? allInst.filter(i => instanceIds.includes(i.id)) : allInst).map(i => ({
      instanceId: i.id, hostType: i.hostType, path: i.skillFilePath
    }));
    if (!targets.length) return { ok: false, code: 'no_target' };

    for (const t of targets) {
      const perm = getInstancePermission(t.instanceId);
      if (!perm || !perm.writeAccess) return { ok: false, code: 'permission-denied', error: '无写权限' };
    }

    const remoteFiles = buildRemoteCandidateFiles(assetId, binding);
    const fileStrategies = Object.assign({}, options.fileStrategies || {});
    let selectedPaths = options.selectedRelativePaths
      ? $coerceArray(options.selectedRelativePaths)
      : (Object.keys(fileStrategies).length
        ? Object.keys(fileStrategies).filter(p => fileStrategies[p] === 'use-remote' || fileStrategies[p] === 'manual-merge')
        : remoteFiles.filter(f => f.changed).map(f => f.relativePath));

    // default strategies for selected paths
    selectedPaths.forEach(p => {
      if (!fileStrategies[p]) fileStrategies[p] = 'use-remote';
    });

    let remoteAdds = $coerceArray(options.remoteAdds);
    let remoteDeletes = $coerceArray(options.remoteDeletes);

    const classified = normalizeUpdatePathClassification(selectedPaths, remoteAdds, remoteDeletes);
    if (!classified.ok) {
      return { ok: false, code: classified.code, error: classified.error };
    }
    selectedPaths = classified.selectedRelativePaths;
    remoteAdds = classified.remoteAddPaths.map(relativePath => {
      const raw = $coerceArray(options.remoteAdds).find(a =>
        (typeof a === 'string' ? a : a.relativePath) === relativePath
      );
      if (raw && typeof raw === 'object') return Object.assign({}, raw, { relativePath });
      return { relativePath };
    });
    remoteDeletes = classified.remoteDeletePaths.slice();

    const _remoteContents = remoteFiles.reduce((m, f) => {
      m[f.relativePath] = f.content;
      return m;
    }, {});
    remoteAdds.forEach(add => {
      const rel = typeof add === 'string' ? add : add.relativePath;
      let content = (typeof add === 'object' && add.content != null)
        ? String(add.content)
        : (_remoteContents[rel] != null ? String(_remoteContents[rel]) : '');
      if (!content) content = plannedRemoteAddContent(rel);
      _remoteContents[rel] = content;
    });
    // Ensure strategies cover remote add/delete paths from options
    remoteAdds.forEach(add => {
      const rel = typeof add === 'string' ? add : add.relativePath;
      if (!fileStrategies[rel]) fileStrategies[rel] = 'use-remote';
    });
    remoteDeletes.forEach(del => {
      const rel = typeof del === 'string' ? del : del.relativePath;
      if (!fileStrategies[rel]) fileStrategies[rel] = 'use-remote';
    });
    const remoteContentStates = buildUpdateRemoteContentStates(_remoteContents, remoteFiles, remoteAdds, remoteDeletes);
    const remoteAddsMeta = remoteAddsMetadataOnly(remoteAdds, remoteContentStates);

    // Freeze full package checkpoints BEFORE any writes (prepare creates snapshots only)
    const _instanceCheckpoints = {};
    targets.forEach(t => {
      _instanceCheckpoints[t.instanceId] = captureUpdateInstanceCheckpoint(t.instanceId);
    });

    const snapIds = [];
    const snapshotIdByInstanceId = {};
    targets.forEach(t => {
      const snap = createPackageSnapshotForInstance(t.instanceId, {
        note: '更新前 Package Snapshot', source: 'pre-update', retained: true
      });
      if (snap) {
        getState().snapshots.push(snap);
        snapIds.push(snap.id);
        snapshotIdByInstanceId[t.instanceId] = snap.id;
      }
    });
    if (!snapIds.length) return { ok: false, code: 'snapshot_failed' };

    const preparedAt = $now();
    const preparedFileStates = targets.map(t => {
      const inst = getInstanceRaw(t.instanceId);
      const files = getFilesRawInternal({ instanceId: t.instanceId });
      return {
        instanceId: t.instanceId,
        packageHash: packageHashForInstance(t.instanceId),
        fileListHash: fileListHashForInstance(t.instanceId),
        fileCount: files.length,
        sourceBindingId: (inst && inst.sourceBindingId) || (asset && asset.sourceBindingId) || binding.id,
        lifecycleStatus: inst ? inst.lifecycleStatus : null,
        path: inst ? inst.skillFilePath : null,
        files: files.map(f => ({
          fileId: f.id,
          relativePath: f.relativePath,
          exists: true,
          contentHash: f.contentHash,
          modifiedAt: f.modifiedAt,
          sizeBytes: f.sizeBytes
        }))
      };
    });

    const remoteFilesMeta = remoteFiles.map(f => ({
      fileId: f.fileId, relativePath: f.relativePath, fileType: f.fileType,
      contentHash: f.contentHash, changed: f.changed, sizeBytes: f.sizeBytes
    }));
    const confirmationPayload = buildUpdateConfirmationPayload({
      targets,
      selectedRelativePaths: selectedPaths,
      fileStrategies,
      remoteAdds: remoteAddsMeta,
      remoteDeletes,
      remoteContentStates,
      remoteVersion: binding.remoteVersion,
      remoteCommit: binding.remoteCommit,
      snapshotIds: snapIds
    });

    const op = {
      id: uuid(),
      type: 'update',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      source: { assetId, bindingId: binding.id },
      targets,
      selectedRelativePaths: selectedPaths,
      fileStrategies,
      remoteAdds: remoteAddsMeta,
      remoteDeletes,
      remoteFiles: remoteFilesMeta,
      remoteContentStates,
      _remoteContents,
      _instanceCheckpoints,
      _confirmationPayload: confirmationPayload,
      baselineSnapshotId: binding.baselineSnapshotId,
      snapshotIds: snapIds,
      snapshotIdByInstanceId,
      preparedFileStates,
      preparedBindingSnapshot: {
        id: binding.id,
        baselineSnapshotId: binding.baselineSnapshotId,
        remoteVersion: binding.remoteVersion,
        remoteCommit: binding.remoteCommit,
        updateStatus: binding.updateStatus
      },
      confirmationHash: $hash(JSON.stringify(confirmationPayload)),
      remoteVersion: binding.remoteVersion,
      remoteCommit: binding.remoteCommit,
      results: [],
      confirmedAt: null,
      completedAt: null
    };
    getState().updateOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      updateStatus: 'update-available',
      targets,
      selectedRelativePaths: selectedPaths,
      fileStrategies,
      remoteAdds: remoteAddsMeta,
      remoteDeletes,
      remoteContentStates,
      preparedFileStates: op.preparedFileStates,
      confirmationHash: op.confirmationHash,
      fileSummary: remoteFiles.map(f => ({ relativePath: f.relativePath, changed: f.changed, fileType: f.fileType })),
      snapshotIds: snapIds,
      remoteVersion: binding.remoteVersion,
      baselineVersion: binding.baselineVersion
    }));
  }

  function getUpdateThreeWayDiff(operationId, fileIdOrPath) {
    const op = getState().updateOperations.find(o => o.id === operationId);
    if (!op) return null;
    const instId = op.targets[0] && op.targets[0].instanceId;
    const file = getFilesRawInternal({ instanceId: instId }).find(f => f.id === fileIdOrPath || f.relativePath === fileIdOrPath);
    if (!file) return null;
    const baseSnap = getState().snapshots.find(s => s.id === op.baselineSnapshotId);
    const baseRec = baseSnap && (baseSnap.files || []).find(f => f.relativePath === file.relativePath);
    const base = baseRec && baseRec.content != null ? String(baseRec.content) : String(file.content || '');
    const local = file.fileType === 'binary' ? null : String(file.content || '');
    const remote = op._remoteContents ? op._remoteContents[file.relativePath] : null;
    return JSON.parse(JSON.stringify({
      relativePath: file.relativePath,
      base, local, remote,
      baseToLocal: lineDiffSafe(base || '', local || ''),
      localToRemote: lineDiffSafe(local || '', remote || ''),
      baseToRemote: lineDiffSafe(base || '', remote || '')
    }));
  }

  function recheckUpdatePrepared(op) {
    const binding = getState().sourceBindings.find(b => b.id === op.source.bindingId);
    if (!binding) return { ok: false, code: 'conflict', error: 'SourceBinding 已变化' };
    const prepB = op.preparedBindingSnapshot || {};
    if (binding.id !== prepB.id) return { ok: false, code: 'conflict', error: 'SourceBinding 已变化' };
    if (binding.baselineSnapshotId !== prepB.baselineSnapshotId) return { ok: false, code: 'conflict', error: 'Baseline Snapshot 已变化' };
    if (binding.remoteVersion !== prepB.remoteVersion || binding.remoteCommit !== prepB.remoteCommit) {
      return { ok: false, code: 'conflict', error: 'Remote Version/Commit 已变化' };
    }
    if (op.remoteVersion !== binding.remoteVersion || op.remoteCommit !== binding.remoteCommit) {
      return { ok: false, code: 'conflict', error: 'Operation 与当前 Remote 不一致' };
    }

    for (const group of op.preparedFileStates) {
      const inst = getInstanceRaw(group.instanceId);
      if (!inst || inst.lifecycleStatus === 'missing') {
        return { ok: false, code: 'conflict', error: 'Instance 缺失' };
      }
      if (group.lifecycleStatus && inst.lifecycleStatus !== group.lifecycleStatus) {
        return { ok: false, code: 'conflict', error: 'Instance 生命周期已变化' };
      }
      if (group.path && inst.skillFilePath !== group.path) {
        return { ok: false, code: 'conflict', error: 'Instance 路径已变化' };
      }
      const curBindingId = inst.sourceBindingId || (getAssetRaw(op.source.assetId) || {}).sourceBindingId || binding.id;
      if (group.sourceBindingId && curBindingId !== group.sourceBindingId) {
        return { ok: false, code: 'conflict', error: 'Instance SourceBinding 已变化' };
      }
      const perm = getInstancePermission(group.instanceId);
      if (!perm || !perm.writeAccess) return { ok: false, code: 'permission-denied' };

      const curFiles = getFilesRawInternal({ instanceId: group.instanceId });
      const curPaths = curFiles.map(f => f.relativePath).slice().sort().join('|');
      const prepPaths = group.files.map(f => f.relativePath).slice().sort().join('|');
      if (curPaths !== prepPaths) {
        return { ok: false, code: 'conflict', error: '文件列表已变化（新增/删除/重命名）' };
      }
      if (fileListHashForInstance(group.instanceId) !== group.fileListHash) {
        return { ok: false, code: 'conflict', error: '文件列表 Hash 已变化' };
      }
      if (packageHashForInstance(group.instanceId) !== group.packageHash) {
        return { ok: false, code: 'conflict', error: 'Package Hash 已变化' };
      }
      if (curFiles.length !== group.fileCount) {
        return { ok: false, code: 'conflict', error: '文件数量已变化' };
      }
      for (const prep of group.files) {
        const cur = getFileRawInternal(prep.fileId);
        if (!cur || !prep.exists) {
          return { ok: false, code: 'conflict', error: '确认前文件状态已变化' };
        }
        if (cur.contentHash !== prep.contentHash || cur.modifiedAt !== prep.modifiedAt || cur.sizeBytes !== prep.sizeBytes) {
          return { ok: false, code: 'conflict', error: '确认前文件状态已变化' };
        }
        if (cur.relativePath !== prep.relativePath) {
          return { ok: false, code: 'conflict', error: '文件路径已变化' };
        }
      }
    }
    return { ok: true };
  }

  function restoreInstanceFromUpdateSnapshot(op, instanceId) {
    const sim = getState().installSim || {};
    if (sim.updateRollbackFailInstanceId && sim.updateRollbackFailInstanceId === instanceId) {
      return { ok: false, code: 'rollback_failed', files: [{ relativePath: '*', status: 'rollback-failed' }] };
    }
    const cp = op._instanceCheckpoints && op._instanceCheckpoints[instanceId];
    if (!cp || !cp.files) {
      return { ok: false, code: 'checkpoint_missing', files: [{ relativePath: '*', status: 'rollback-failed' }] };
    }
    const prepGroup = (op.preparedFileStates || []).find(g => g.instanceId === instanceId);
    const expectedHash = (cp.packageHash != null) ? cp.packageHash : (prepGroup && prepGroup.packageHash);
    const inst = getInstanceRaw(instanceId);
    const fileResults = [];
    const beforeIds = new Set(getFilesRawInternal({ instanceId }).map(f => f.id));
    const checkpointIds = new Set(cp.files.map(f => f.id));
    const checkpointPaths = new Set(cp.files.map(f => f.relativePath));

    getFilesRawInternal({ instanceId }).forEach(f => {
      if (!checkpointIds.has(f.id) && !checkpointPaths.has(f.relativePath)) {
        fileResults.push({ relativePath: f.relativePath, fileId: f.id, status: 'removed-added-file' });
      }
    });
    getState().files = getState().files.filter(f => f.instanceId !== instanceId);

    cp.files.forEach(sf => {
      const existedBefore = beforeIds.has(sf.id);
      getState().files.push(normalizeFile({
        id: sf.id,
        instanceId: sf.instanceId || instanceId,
        skillId: sf.skillId,
        relativePath: sf.relativePath,
        fileType: sf.fileType || 'text',
        mimeType: sf.mimeType || 'text/markdown',
        content: sf.content,
        contentHash: sf.contentHash,
        modifiedAt: sf.modifiedAt,
        sizeBytes: sf.sizeBytes,
        tokenCount: sf.tokenCount,
        tokenCountMode: sf.tokenCountMode,
        indexStatus: sf.indexStatus || 'indexed',
        skipReason: sf.skipReason,
        isNestedSkillMarker: !!sf.isNestedSkillMarker
      }));
      fileResults.push({
        relativePath: sf.relativePath,
        fileId: sf.id,
        status: existedBefore ? 'restored' : 'recreated'
      });
    });

    if (inst && cp.instance) {
      inst.contentHash = cp.instance.contentHash;
      inst.fileCount = cp.instance.fileCount;
      inst.packageSizeBytes = cp.instance.packageSizeBytes;
      inst.localModificationStatus = cp.instance.localModificationStatus;
      if (cp.instance.installedVersion != null) inst.installedVersion = cp.instance.installedVersion;
    }

    const curHash = packageHashForInstance(instanceId);
    if (expectedHash != null && curHash !== expectedHash) {
      fileResults.push({ relativePath: '*', status: 'rollback-failed', error: 'package_hash_mismatch' });
      return { ok: false, code: 'package_hash_mismatch', files: fileResults, packageHash: curHash, expectedHash };
    }
    const failed = fileResults.some(r => r.status === 'rollback-failed');
    return { ok: !failed, files: fileResults, packageHash: curHash };
  }

  function confirmUpdate(operationId, options = {}) {
    ensurePhaseFCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed' };
    const forbidden = ['instanceIds', 'selectedRelativePaths', 'fileStrategies', 'remoteAdds', 'remoteDeletes',
      'remoteVersion', 'remoteCommit', 'snapshotId', 'snapshotIds', 'content', 'files'];
    for (const k of forbidden) {
      if (Object.prototype.hasOwnProperty.call(options, k) && options[k] != null) {
        return { ok: false, code: 'operation_tampered', error: 'Confirm 不得覆盖 Prepare 内容: ' + k };
      }
    }
    const op = getState().updateOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status === 'cancelled') return { ok: false, code: 'operation_invalid', status: 'cancelled' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    if (Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired'; saveState();
      return { ok: false, code: 'operation_expired' };
    }

    const integrity = verifyUpdateRemoteContentIntegrity(op);
    if (!integrity.ok) {
      return JSON.parse(JSON.stringify(integrity));
    }

    const recheck = recheckUpdatePrepared(op);
    if (!recheck.ok) {
      op.status = recheck.code === 'permission-denied' ? 'failed' : 'conflict';
      saveState();
      return { ok: false, code: recheck.code, error: recheck.error, operationId, status: op.status };
    }

    op.confirmedAt = $now();
    const sim = getState().installSim || {};
    const results = [];
    const writtenInstanceIds = [];
    let failOccurred = false;
    let failMessage = null;

    const normalizedRemoteAdds = [];
    const seenAdd = new Set();
    $coerceArray(op.remoteAdds).forEach(a => {
      const p = typeof a === 'string' ? a : a.relativePath;
      if (!p || seenAdd.has(p)) return;
      seenAdd.add(p);
      normalizedRemoteAdds.push(typeof a === 'string' ? { relativePath: a } : Object.assign({}, a, { relativePath: p }));
    });
    const normalizedRemoteDeletes = [];
    const seenDel = new Set();
    $coerceArray(op.remoteDeletes).forEach(d => {
      const p = typeof d === 'string' ? d : d.relativePath;
      if (!p || seenDel.has(p)) return;
      seenDel.add(p);
      normalizedRemoteDeletes.push(p);
    });
    const addPaths = new Set(normalizedRemoteAdds.map(item => item.relativePath));
    const deletePaths = new Set(normalizedRemoteDeletes);
    const existingPaths = [...new Set(op.selectedRelativePaths || [])].filter(path =>
      !addPaths.has(path) && !deletePaths.has(path)
    );

    for (const t of op.targets) {
      if (failOccurred) break;
      const resultByPath = new Map();
      const strategies = op.fileStrategies || {};

      if (sim.updateFailInstanceId && sim.updateFailInstanceId === t.instanceId) {
        failOccurred = true;
        failMessage = 'sim_fail_instance';
        results.push({ instanceId: t.instanceId, files: [{ relativePath: '*', status: 'failed', errorCode: 'sim_fail' }], status: 'failed' });
        break;
      }

      // Delete → Add → Existing; one path enters only one chain
      deletePaths.forEach(relPath => {
        const strategy = strategies[relPath] || 'use-remote';
        if (strategy === 'keep-local') {
          resultByPath.set(relPath, { relativePath: relPath, status: 'kept-local', strategy });
          return;
        }
        if (strategy === 'defer') {
          resultByPath.set(relPath, { relativePath: relPath, status: 'deferred', strategy });
          return;
        }
        if (strategy === 'manual-merge') {
          const file = getFilesRawInternal({ instanceId: t.instanceId }).find(f => f.relativePath === relPath);
          const remote = op._remoteContents ? op._remoteContents[relPath] : null;
          ensureUpdateManualMergeArtifacts(op, t.instanceId, relPath, file, remote);
          resultByPath.set(relPath, { relativePath: relPath, status: 'manual-merge', strategy });
          return;
        }
        getState().files = getState().files.filter(f => !(f.instanceId === t.instanceId && f.relativePath === relPath));
        resultByPath.set(relPath, { relativePath: relPath, status: 'completed', strategy });
      });

      normalizedRemoteAdds.forEach(add => {
        const rel = add.relativePath;
        if (resultByPath.has(rel)) return;
        const strategy = strategies[rel] || 'use-remote';
        if (strategy === 'keep-local') {
          resultByPath.set(rel, { relativePath: rel, status: 'kept-local', strategy });
          return;
        }
        if (strategy === 'defer') {
          resultByPath.set(rel, { relativePath: rel, status: 'deferred', strategy });
          return;
        }
        if (strategy === 'manual-merge') {
          const file = getFilesRawInternal({ instanceId: t.instanceId }).find(f => f.relativePath === rel);
          const remote = op._remoteContents ? op._remoteContents[rel] : null;
          ensureUpdateManualMergeArtifacts(op, t.instanceId, rel, file, remote);
          resultByPath.set(rel, { relativePath: rel, status: 'manual-merge', strategy });
          return;
        }
        const content = (op._remoteContents && op._remoteContents[rel] != null)
          ? String(op._remoteContents[rel])
          : '';
        const now = $now();
        getState().files.push(normalizeFile({
          id: uuid(), instanceId: t.instanceId, skillId: op.source.assetId,
          relativePath: rel, fileType: 'text', mimeType: 'text/markdown',
          sizeBytes: content.length, content, contentHash: $hash(content),
          modifiedAt: now, tokenCount: $tokenApprox(content), tokenCountMode: 'estimated',
          indexStatus: 'indexed'
        }));
        resultByPath.set(rel, { relativePath: rel, status: 'completed', strategy });
      });

      for (const rel of existingPaths) {
        if (resultByPath.has(rel)) continue;
        const strategy = strategies[rel] || 'use-remote';
        if (strategy === 'keep-local') {
          resultByPath.set(rel, { relativePath: rel, status: 'kept-local', strategy });
          continue;
        }
        if (strategy === 'defer') {
          resultByPath.set(rel, { relativePath: rel, status: 'deferred', strategy });
          continue;
        }
        if (strategy === 'manual-merge') {
          const file = getFilesRawInternal({ instanceId: t.instanceId }).find(f => f.relativePath === rel);
          const remote = op._remoteContents ? op._remoteContents[rel] : null;
          ensureUpdateManualMergeArtifacts(op, t.instanceId, rel, file, remote);
          resultByPath.set(rel, { relativePath: rel, status: 'manual-merge', strategy });
          continue;
        }
        if (sim.updateFailRelativePath && rel === sim.updateFailRelativePath) {
          resultByPath.set(rel, { relativePath: rel, status: 'failed', errorCode: 'write_failed' });
          failOccurred = true;
          failMessage = 'write_failed';
          break;
        }
        const file = getFilesRawInternal({ instanceId: t.instanceId }).find(f => f.relativePath === rel);
        if (!file) {
          resultByPath.set(rel, { relativePath: rel, status: 'skipped', strategy, message: 'missing-local' });
          continue;
        }
        if (file.fileType === 'binary') {
          resultByPath.set(rel, { relativePath: rel, status: 'completed', strategy, message: 'binary meta-only' });
          continue;
        }
        const remote = op._remoteContents[rel];
        if (remote == null) {
          resultByPath.set(rel, { relativePath: rel, status: 'skipped', strategy, message: 'missing-remote' });
          continue;
        }
        file.content = String(remote);
        file.contentHash = $hash(file.content);
        file.modifiedAt = $now();
        file.sizeBytes = file.content.length;
        file.tokenCount = $tokenApprox(file.content);
        file.tokenCountMode = 'estimated';
        resultByPath.set(rel, { relativePath: rel, status: 'completed', strategy });
      }

      const targetResults = [...resultByPath.values()];
      const outcome = applyConfirmUpdateInstanceState(op, t.instanceId, targetResults);
      writtenInstanceIds.push(t.instanceId);
      results.push({
        instanceId: t.instanceId,
        files: targetResults,
        localModificationStatus: outcome.localModificationStatus,
        status: targetResults.some(x => x.status === 'failed') ? 'failed' : 'completed'
      });
      if (failOccurred) break;
    }

    if (failOccurred) {
      let rollbackFailed = false;
      writtenInstanceIds.forEach(iid => {
        const retainedDrafts = getState().drafts.filter(d =>
          d.instanceId === iid && d.sourceOperationId === op.id && d.status === 'update-manual-merge'
        );
        const rb = restoreInstanceFromUpdateSnapshot(op, iid);
        const entry = results.find(r => r.instanceId === iid);
        if (!rb.ok) {
          rollbackFailed = true;
          if (entry) {
            entry.status = 'rollback-failed';
            entry.rollbackStatus = 'rollback-failed';
            entry.files = (rb.files && rb.files.length) ? rb.files : (entry.files || []).map(f =>
              f.status === 'completed' || f.status === 'added' || f.status === 'deleted'
                ? Object.assign({}, f, { status: 'rollback-failed', rollbackStatus: 'rollback-failed' })
                : f
            );
          }
        } else if (entry) {
          entry.status = 'rolled-back';
          entry.rollbackStatus = 'rolled-back';
          entry.files = (rb.files && rb.files.length) ? rb.files : (entry.files || []);
          if (retainedDrafts.length) {
            entry.draftRetainedAfterRollback = true;
            entry['draft-retained-after-rollback'] = true;
            retainedDrafts.forEach(d => {
              ensureUpdateManualMergeArtifacts(op, iid, d.relativePath || '', null, d.content);
              const task = getState().pendingTasks.find(t =>
                t.sourceOperationId === op.id && t.instanceId === iid &&
                t.relativePath === d.relativePath && t.taskType === 'update_manual_merge' && t.status === 'open'
              );
              if (task) task.note = 'Formal 回滚后保留 Manual Merge Draft · ' + (d.relativePath || '');
            });
            addAuditEvent({
              skillId: op.source.assetId, instanceId: iid,
              eventType: 'update_draft_retained_after_rollback', category: 'update',
              source: 'Skill Panel', result: 'completed',
              snapshotId: (op.snapshotIdByInstanceId && op.snapshotIdByInstanceId[iid]) || op.snapshotIds[0],
              note: 'Formal rollback · Draft retained · ' + retainedDrafts.length
            });
          }
        }
      });
      op.results = results;
      op.status = rollbackFailed ? 'rollback-failed' : (writtenInstanceIds.length ? 'rolled-back' : 'failed');
      op.completedAt = $now();
      addAuditEvent({
        skillId: op.source.assetId, eventType: 'update_failed', category: 'update',
        source: 'Skill Panel', result: 'failed', snapshotId: op.snapshotIds[0],
        note: '更新失败并' + (rollbackFailed ? '回滚失败' : (writtenInstanceIds.length ? '回滚' : '中止')) + (failMessage ? (' · ' + failMessage) : '')
      });
      saveState();
      return JSON.parse(JSON.stringify({
        ok: false,
        status: op.status,
        operationId,
        results,
        snapshotIds: op.snapshotIds
      }));
    }

    // ALL succeed — update SourceBinding with remote baseline (never local instance snapshot)
    const binding = getState().sourceBindings.find(b => b.id === op.source.bindingId);
    let hasLocalModifications = false;
    let hasManualMerge = false;
    let hasDeferred = false;
    const keptLocalKeys = new Set();
    const deferredKeys = new Set();
    const mergeKeys = new Set();
    results.forEach(r => {
      (r.files || []).forEach(f => {
        const key = r.instanceId + '::' + f.relativePath;
        if (f.status === 'kept-local') {
          hasLocalModifications = true;
          keptLocalKeys.add(key);
        }
        if (f.status === 'deferred') {
          hasDeferred = true;
          deferredKeys.add(key);
        }
        if (f.status === 'manual-merge') {
          hasManualMerge = true;
          mergeKeys.add(key);
        }
      });
      if (r.localModificationStatus === 'modified') hasLocalModifications = true;
      if (r.localModificationStatus === 'pending-merge') hasManualMerge = true;
    });
    const keptLocalCount = keptLocalKeys.size;
    const deferredCount = deferredKeys.size;
    const mergeCount = mergeKeys.size;
    const unresolvedMergeCount = mergeCount;

    if (binding) {
      binding.baselineVersion = op.remoteVersion;
      binding.baselineCommit = op.remoteCommit;
      binding.remoteVersion = op.remoteVersion;
      binding.remoteCommit = op.remoteCommit;
      binding.lastCheckedAt = $now();
      if (hasManualMerge) {
        binding.updateStatus = 'merge-required';
      } else if (hasDeferred) {
        binding.updateStatus = 'update-available';
      } else if (hasLocalModifications) {
        binding.updateStatus = 'local-modified';
      } else {
        binding.updateStatus = 'up-to-date';
      }
      const snap = createRemoteBaselineSnapshot(op);
      if (snap) {
        binding.baselineSnapshotId = snap.id;
        op.snapshotIds.push(snap.id);
      }
      let eventType = 'update_completed';
      let auditResult = 'completed';
      let note = '更新完成 · ' + op.remoteVersion;
      if (hasManualMerge) {
        eventType = 'update_awaiting_merge';
        auditResult = 'pending';
        note = '更新待合并 · ' + op.remoteVersion + ' · 未合并 ' + mergeCount;
      } else if (hasDeferred) {
        eventType = 'update_partially_completed';
        auditResult = 'partial';
        note = '更新部分完成 · ' + op.remoteVersion + ' · 暂缓 ' + deferredCount +
          (keptLocalCount ? (' · 保留本地 ' + keptLocalCount) : '');
      } else if (hasLocalModifications) {
        eventType = 'update_completed_with_local_modifications';
        auditResult = 'completed';
        note = '更新完成（保留本地） · ' + op.remoteVersion + ' · 保留本地文件 ' + keptLocalCount;
      }
      addAuditEvent({
        skillId: op.source.assetId, eventType, category: 'update',
        source: 'Skill Panel', result: auditResult, snapshotId: binding.baselineSnapshotId,
        note
      });
    }

    op.results = results;
    op.hasLocalModifications = hasLocalModifications;
    if (hasManualMerge) {
      op.status = 'awaiting-merge';
      op.unresolvedMergeCount = unresolvedMergeCount;
    } else if (hasDeferred) {
      op.status = 'partially-completed';
    } else {
      op.status = 'completed';
    }
    op.completedAt = $now();
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      status: op.status,
      operationId,
      results,
      snapshotIds: op.snapshotIds,
      hasLocalModifications,
      unresolvedMergeCount
    }));
  }

  function getUpdateOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().updateOperations.find(o => o.id === operationId);
    return op ? toSafeOperationView(op) : null;
  }

  function loadUpdateDemoCase(caseId) {
    ensurePhaseFCollections();
    const sim = getState().installSim;
    sim.forceUpdateAvailable = false;
    sim.remoteVersion = null;
    sim.updateFailRelativePath = null;
    sim.updateFailInstanceId = null;
    sim.updateRollbackFailInstanceId = null;
    sim.remoteBinaryChanges = null;
    if (caseId === 'update-available') {
      sim.forceUpdateAvailable = true;
      sim.remoteVersion = '9.9.9';
    } else if (caseId === 'update-partial-fail') {
      sim.forceUpdateAvailable = true;
      sim.remoteVersion = '9.9.8';
      sim.updateFailRelativePath = 'references/checklist.md';
    } else if (caseId === 'update-rollback-fail') {
      sim.forceUpdateAvailable = true;
      sim.remoteVersion = '9.9.7';
      sim.updateFailRelativePath = 'references/checklist.md';
      // updateRollbackFailInstanceId set by caller/tests against a concrete instance
    } else if (caseId === 'clear') {
      /* noop */
    } else return { ok: false, error: 'Unknown case' };
    saveState();
    return { ok: true, caseId };
  }

  function openUpdatePage(assetId, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const rid = resolveAssetId(assetId) || assetId;
    const q = new URLSearchParams();
    if (rid) q.set('skill', rid);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'update.html?' + q.toString();
  }

  /* ----- Uninstall ----- */
  function prepareUninstall(options = {}) {
    ensurePhaseFCollections();
    const assetId = resolveAssetId(options.assetId) || options.assetId;
    if (!assetId) return { ok: false, code: 'not_found' };
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, code: 'not_found' };
    const mode = options.mode || 'stop-managing'; // stop-managing | remove-from-host | delete-local-copy | detach-source
    const deleteFiles = !!options.deleteFiles;
    const requiresSecondConfirm = mode === 'delete-local-copy' || deleteFiles === true;

    let targets = [];
    if (mode === 'detach-source') {
      targets = [];
    } else {
      const instanceIds = $coerceArray(options.instanceIds);
      const all = getState().instances.filter(i => i.skillId === assetId);
      targets = (instanceIds.length ? all.filter(i => instanceIds.includes(i.id)) : all).map(i => ({
        instanceId: i.id,
        hostType: i.hostType,
        path: i.skillFilePath,
        fileCount: getFilesRawInternal({ instanceId: i.id }).length,
        packageHash: packageHashForInstance(i.id),
        lifecycleStatus: i.lifecycleStatus,
        isPrimary: !!i.isPrimary,
        sourceBindingId: i.sourceBindingId || null
      }));
      if (!targets.length) return { ok: false, code: 'no_target' };
    }

    const snapIds = [];
    const snapshotIdByInstanceId = {};
    targets.forEach(t => {
      const snap = createPackageSnapshotForInstance(t.instanceId, {
        note: '卸载前 Package Snapshot', source: 'pre-uninstall', retained: true
      });
      if (snap) {
        getState().snapshots.push(snap);
        snapIds.push(snap.id);
        snapshotIdByInstanceId[t.instanceId] = snap.id;
      }
    });

    const preparedAt = $now();
    const assetBinding = asset.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === asset.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === assetId && (!b.scope || b.scope === 'asset'));

    const op = {
      id: uuid(),
      type: 'uninstall',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      source: { assetId },
      mode,
      deleteFiles,
      detachSource: mode === 'detach-source' || !!options.detachSource,
      targets,
      snapshotIds: snapIds,
      snapshotIdByInstanceId,
      preparedAssetState: {
        lifecycleStatus: asset.lifecycleStatus,
        primaryInstanceId: asset.primaryInstanceId || null,
        sourceBindingId: asset.sourceBindingId || null
      },
      preparedBindingIds: getState().sourceBindings.filter(b => b.skillId === assetId).map(b => b.id),
      confirmationHash: $hash(JSON.stringify({ assetId, mode, targets: targets.map(t => t.instanceId), deleteFiles })),
      impact: {
        assetId,
        instanceCount: targets.length,
        remainingInstances: getState().instances.filter(i => i.skillId === assetId).length - targets.length,
        draftCount: getState().drafts.filter(d => d.skillId === assetId).length,
        hasSourceBinding: !!assetBinding,
        mode
      },
      requiresSecondConfirm,
      results: [],
      confirmedAt: null,
      completedAt: null,
      _checkpoint: {
        asset: JSON.parse(JSON.stringify(asset)),
        instances: {},
        files: [],
        bindings: [],
        primaryByInstance: {}
      }
    };
    targets.forEach(t => {
      const inst = getInstanceRaw(t.instanceId);
      if (inst) op._checkpoint.instances[t.instanceId] = JSON.parse(JSON.stringify(inst));
      op._checkpoint.files.push(...getFilesRawInternal({ instanceId: t.instanceId }).map(f => JSON.parse(JSON.stringify(f))));
    });
    op._checkpoint.bindings = getState().sourceBindings.filter(b => b.skillId === assetId).map(b => JSON.parse(JSON.stringify(b)));

    getState().uninstallOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      mode,
      targets,
      impact: op.impact,
      snapshotIds: snapIds,
      requiresSecondConfirm,
      simulated: true,
      note: '原型不会真实删除宿主文件系统文件'
    }));
  }

  function recheckUninstallPrepared(op) {
    const assetId = op.source.assetId;
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, code: 'operation_invalid', error: 'Asset 不存在' };
    const prepA = op.preparedAssetState || {};
    if (prepA.lifecycleStatus && asset.lifecycleStatus !== prepA.lifecycleStatus) {
      return { ok: false, code: 'operation_invalid', error: 'Asset 生命周期已变化' };
    }
    if ((prepA.primaryInstanceId || null) !== (asset.primaryInstanceId || null)) {
      return { ok: false, code: 'operation_invalid', error: '主 Instance 已变化' };
    }
    if ((prepA.sourceBindingId || null) !== (asset.sourceBindingId || null)) {
      return { ok: false, code: 'operation_invalid', error: 'SourceBinding 已变化' };
    }
    const curBindingIds = getState().sourceBindings.filter(b => b.skillId === assetId).map(b => b.id).slice().sort().join('|');
    const prepBindingIds = $coerceArray(op.preparedBindingIds).slice().sort().join('|');
    if (curBindingIds !== prepBindingIds) {
      return { ok: false, code: 'operation_invalid', error: 'SourceBinding 集合已变化' };
    }
    for (const t of op.targets) {
      const inst = getInstanceRaw(t.instanceId);
      if (!inst || inst.skillId !== assetId) {
        return { ok: false, code: 'operation_invalid', error: 'Instance 不属于该 Asset 或不存在' };
      }
      if (inst.lifecycleStatus !== t.lifecycleStatus) {
        return { ok: false, code: 'operation_invalid', error: 'Instance 生命周期已变化' };
      }
      if (inst.skillFilePath !== t.path) {
        return { ok: false, code: 'operation_invalid', error: 'Instance 路径已变化' };
      }
      if (getFilesRawInternal({ instanceId: t.instanceId }).length !== t.fileCount) {
        return { ok: false, code: 'operation_invalid', error: '文件数量已变化' };
      }
      if (t.packageHash && packageHashForInstance(t.instanceId) !== t.packageHash) {
        return { ok: false, code: 'operation_invalid', error: 'Package Hash 已变化' };
      }
      const snapId = op.snapshotIdByInstanceId && op.snapshotIdByInstanceId[t.instanceId];
      if (snapId) {
        const snap = getState().snapshots.find(s => s.id === snapId);
        if (!snap || snap.instanceId !== t.instanceId) {
          return { ok: false, code: 'operation_invalid', error: 'Snapshot 无效' };
        }
      }
    }
    return { ok: true };
  }

  function restoreUninstallCheckpoint(op) {
    const cp = op._checkpoint;
    if (!cp) return false;
    const assetId = op.source.assetId;
    if (cp.asset) {
      const asset = getAssetRaw(assetId);
      if (asset) {
        Object.keys(cp.asset).forEach(k => { asset[k] = cp.asset[k]; });
      }
    }
    Object.keys(cp.instances || {}).forEach(iid => {
      const snap = cp.instances[iid];
      let inst = getInstanceRaw(iid);
      if (!inst) {
        getState().instances.push(JSON.parse(JSON.stringify(snap)));
      } else {
        Object.keys(snap).forEach(k => { inst[k] = snap[k]; });
      }
    });
    // restore files: put back any missing
    (cp.files || []).forEach(f => {
      if (!getFileRawInternal(f.id)) getState().files.push(JSON.parse(JSON.stringify(f)));
    });
    // restore bindings
    (cp.bindings || []).forEach(b => {
      if (!getState().sourceBindings.find(x => x.id === b.id)) {
        getState().sourceBindings.push(JSON.parse(JSON.stringify(b)));
      }
    });
    return true;
  }

  function confirmUninstall(operationId, options = {}) {
    ensurePhaseFCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed' };
    const op = getState().uninstallOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    if (Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired'; saveState();
      return { ok: false, code: 'operation_expired' };
    }

    const requiresSecond = op.requiresSecondConfirm || op.mode === 'delete-local-copy' || !!op.deleteFiles;
    if (requiresSecond && !options.secondConfirmed) {
      return { ok: false, code: 'second_confirm_required', error: '删除本地副本需要二次确认' };
    }

    const recheck = recheckUninstallPrepared(op);
    if (!recheck.ok) {
      op.status = 'invalidated';
      saveState();
      return { ok: false, code: recheck.code, error: recheck.error, operationId };
    }

    op.confirmedAt = $now();
    const assetId = op.source.assetId;
    const results = [];
    const sim = getState().installSim || {};
    const appliedInstanceIds = [];
    let failOccurred = false;

    // Capture pre-apply checkpoint deltas for atomic rollback (refresh)
    op._checkpoint.asset = JSON.parse(JSON.stringify(getAssetRaw(assetId)));
    op.targets.forEach(t => {
      const inst = getInstanceRaw(t.instanceId);
      if (inst) op._checkpoint.instances[t.instanceId] = JSON.parse(JSON.stringify(inst));
    });
    op._checkpoint.files = [];
    op.targets.forEach(t => {
      op._checkpoint.files.push(...getFilesRawInternal({ instanceId: t.instanceId }).map(f => JSON.parse(JSON.stringify(f))));
    });
    op._checkpoint.bindings = getState().sourceBindings.filter(b => b.skillId === assetId).map(b => JSON.parse(JSON.stringify(b)));

    if (op.mode === 'detach-source' || (op.detachSource && !op.targets.length)) {
      // ONLY remove bindings — no instance/asset lifecycle, no file/draft delete
      getState().sourceBindings = getState().sourceBindings.filter(b => b.skillId !== assetId);
      const asset = getAssetRaw(assetId);
      if (asset) asset.sourceBindingId = null;
      getState().instances.filter(i => i.skillId === assetId).forEach(i => { i.sourceBindingId = null; });
      results.push({ scope: 'source-binding', status: 'completed', message: '已解除 SourceBinding，未删除文件，未改变生命周期' });
      addAuditEvent({
        skillId: assetId, eventType: 'source_detached', category: 'uninstall',
        source: 'Skill Panel', result: 'completed', note: '解除来源绑定'
      });
      op.results = results;
      op.status = 'completed';
      op.completedAt = $now();
      saveState();
      return JSON.parse(JSON.stringify({
        ok: true, status: 'completed', operationId, results,
        assetStatus: asset ? asset.lifecycleStatus : null,
        note: 'detach-source：仅解除绑定'
      }));
    }

    for (const t of op.targets) {
      if (sim.uninstallFailInstanceId && sim.uninstallFailInstanceId === t.instanceId) {
        results.push({ instanceId: t.instanceId, status: 'failed', errorCode: 'sim_fail' });
        failOccurred = true;
        break;
      }
      const inst = getInstanceRaw(t.instanceId);
      if (!inst) {
        results.push({ instanceId: t.instanceId, status: 'failed', errorCode: 'missing' });
        failOccurred = true;
        break;
      }

      const snapId = (op.snapshotIdByInstanceId && op.snapshotIdByInstanceId[t.instanceId]) || op.snapshotIds[0] || null;

      if (op.mode === 'stop-managing') {
        inst.lifecycleStatus = 'stopped';
        inst.isPrimary = false;
        results.push({
          instanceId: t.instanceId, status: 'completed', filesDeleted: false,
          message: '已停止管理，未删除文件'
        });
      } else if (op.mode === 'remove-from-host') {
        inst.lifecycleStatus = 'removed-from-host-simulated';
        inst.isPrimary = false;
        results.push({
          instanceId: t.instanceId, status: 'completed', filesDeleted: false,
          message: '已从宿主移除（模拟）· 真实宿主文件未被删除'
        });
      } else if (op.mode === 'delete-local-copy') {
        getState().files = getState().files.filter(f => f.instanceId !== t.instanceId);
        inst.lifecycleStatus = 'deleted';
        inst.isPrimary = false;
        results.push({
          instanceId: t.instanceId, status: 'completed', filesDeleted: true,
          message: '已删除 Formal Index 副本记录（模拟）'
        });
      } else {
        // fallback treat as stop-managing
        inst.lifecycleStatus = 'stopped';
        inst.isPrimary = false;
        results.push({ instanceId: t.instanceId, status: 'completed', filesDeleted: false });
      }

      if (op.deleteFiles && op.mode !== 'delete-local-copy') {
        getState().files = getState().files.filter(f => f.instanceId !== t.instanceId);
        results[results.length - 1].filesDeleted = true;
        results[results.length - 1].message = '已从 Formal Index 移除文件记录（非真实磁盘删除）';
      }

      addAuditEvent({
        skillId: assetId, instanceId: t.instanceId,
        eventType: 'uninstall_instance', category: 'uninstall', source: 'Skill Panel', result: 'completed',
        snapshotId: snapId,
        note: op.mode + ' · ' + (t.path || '')
      });
      appliedInstanceIds.push(t.instanceId);
    }

    if (failOccurred) {
      // Keep original completed audit events; append per-instance rollback audits
      let rollbackFailed = false;
      appliedInstanceIds.forEach(iid => {
        const snapId = (op.snapshotIdByInstanceId && op.snapshotIdByInstanceId[iid]) || op.snapshotIds[0] || null;
        const entry = results.find(r => r.instanceId === iid);
        if (sim.uninstallRollbackFailInstanceId && sim.uninstallRollbackFailInstanceId === iid) {
          rollbackFailed = true;
          if (entry) {
            entry.status = 'rollback-failed';
            entry.rollbackStatus = 'rollback-failed';
          }
          addAuditEvent({
            skillId: assetId, instanceId: iid,
            eventType: 'uninstall_rollback_failed', category: 'uninstall',
            source: 'Skill Panel', result: 'failed', snapshotId: snapId,
            note: '卸载回滚失败'
          });
          return;
        }
        // Restore this instance from checkpoint
        const cpInst = op._checkpoint && op._checkpoint.instances && op._checkpoint.instances[iid];
        if (cpInst) {
          let inst = getInstanceRaw(iid);
          if (!inst) getState().instances.push(JSON.parse(JSON.stringify(cpInst)));
          else Object.keys(cpInst).forEach(k => { inst[k] = cpInst[k]; });
        }
        getState().files = getState().files.filter(f => f.instanceId !== iid);
        ((op._checkpoint && op._checkpoint.files) || []).filter(f => f.instanceId === iid).forEach(f => {
          if (!getFileRawInternal(f.id)) getState().files.push(JSON.parse(JSON.stringify(f)));
        });
        if (entry && entry.status === 'completed') {
          entry.status = 'rolled-back';
          entry.rollbackStatus = 'rolled-back';
        }
        addAuditEvent({
          skillId: assetId, instanceId: iid,
          eventType: 'uninstall_rollback_completed', category: 'uninstall',
          source: 'Skill Panel', result: 'completed', snapshotId: snapId,
          note: '卸载回滚完成'
        });
      });
      // Restore asset + bindings if overall rollback succeeded for restored instances
      if (op._checkpoint && op._checkpoint.asset) {
        const asset = getAssetRaw(assetId);
        if (asset) Object.keys(op._checkpoint.asset).forEach(k => { asset[k] = op._checkpoint.asset[k]; });
      }
      ((op._checkpoint && op._checkpoint.bindings) || []).forEach(b => {
        if (!getState().sourceBindings.find(x => x.id === b.id)) {
          getState().sourceBindings.push(JSON.parse(JSON.stringify(b)));
        }
      });
      op.results = results;
      op.status = rollbackFailed ? 'rollback-failed' : 'rolled-back';
      op.completedAt = $now();
      saveState();
      return JSON.parse(JSON.stringify({
        ok: false, status: op.status, operationId, results,
        note: rollbackFailed ? '卸载部分失败，回滚失败' : '卸载部分失败，已原子回滚'
      }));
    }

    // Asset lifecycle if last active instance gone
    const remaining = getState().instances.filter(i =>
      i.skillId === assetId &&
      i.lifecycleStatus !== 'stopped' &&
      i.lifecycleStatus !== 'deleted' &&
      i.lifecycleStatus !== 'missing' &&
      i.lifecycleStatus !== 'removed-from-host-simulated'
    );
    const asset = getAssetRaw(assetId);
    if (asset && remaining.length === 0 && op.targets.length) {
      asset.lifecycleStatus = 'archived';
      asset.updatedAt = $now();
      asset.primaryInstanceId = null;
    } else if (asset && remaining.length) {
      if (!remaining.some(i => i.isPrimary)) remaining[0].isPrimary = true;
      asset.primaryInstanceId = remaining.find(i => i.isPrimary).id;
    }

    op.results = results;
    op.status = 'completed';
    op.completedAt = $now();
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      status: op.status,
      operationId,
      results,
      assetStatus: asset ? asset.lifecycleStatus : null,
      note: '原型不声称完成真实文件系统删除'
    }));
  }

  function getUninstallOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().uninstallOperations.find(o => o.id === operationId);
    return op ? toSafeOperationView(op) : null;
  }

  function openUninstallPage(assetId, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const rid = resolveAssetId(assetId) || assetId;
    const q = new URLSearchParams();
    if (rid) q.set('skill', rid);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'uninstall.html?' + q.toString();
  }

  /* ----- Duplicate Resolution Operation (Compare destructive) ----- */
  function buildDuplicateImpactPreview(action, candidateIds, primaryAssetId, archiveAssetId) {
    const candidates = candidateIds.map(id => getAssetRaw(id)).filter(Boolean);
    const primary = primaryAssetId ? getAssetRaw(primaryAssetId) : null;
    const mergedAway = action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance'
      ? candidateIds.filter(id => id !== primaryAssetId)
      : (action === 'merge-new' || action === 'merge_new' ? candidateIds.slice() : []);
    const movedInstances = [];
    mergedAway.forEach(oid => {
      getState().instances.filter(i => i.skillId === oid).forEach(i => movedInstances.push(i.id));
    });
    if (action === 'merge-new' || action === 'merge_new') {
      // all instances move
    }
    const draftCount = candidateIds.reduce((n, id) => n + getState().drafts.filter(d => d.skillId === id).length, 0);
    const snapshotCount = candidateIds.reduce((n, id) => n + getState().snapshots.filter(s => s.skillId === id).length, 0);
    const pendingTaskCount = candidateIds.reduce((n, id) => n + getState().pendingTasks.filter(t => t.skillId === id && t.status === 'open').length, 0);
    const editorSessions = (getState().editorSessions || []).filter(s => candidateIds.includes(s.assetId) || candidateIds.includes(s.skillId)).map(s => s.id);
    const conflicts = (getState().conflicts || []).filter(c => candidateIds.includes(c.assetId) || candidateIds.includes(c.skillId)).map(c => c.id);
    const categoryDiff = {};
    const tagDiff = {};
    const favoriteDiff = {};
    candidates.forEach(a => {
      categoryDiff[a.id] = $coerceArray(a.categoryIds);
      tagDiff[a.id] = $coerceArray(a.tagIds);
      favoriteDiff[a.id] = !!a.isFavorite;
    });
    const bindings = getState().sourceBindings.filter(b => candidateIds.includes(b.skillId));
    return {
      preservedAssetId: (action === 'merge-new' || action === 'merge_new') ? null : (primaryAssetId || null),
      newAssetWillBeCreated: action === 'merge-new' || action === 'merge_new',
      mergedAwayAssets: mergedAway,
      movedInstances,
      sourceBindingImpact: bindings.map(b => ({ id: b.id, skillId: b.skillId, sourceType: b.sourceType, scope: b.scope || 'asset' })),
      draftCount,
      snapshotCount,
      pendingTaskCount,
      editorSessions,
      conflicts,
      categoryDiff,
      tagDiff,
      favoriteDiff,
      archiveAssetId: archiveAssetId || null
    };
  }

  function buildDuplicateCandidateFingerprint(candidateIds) {
    return candidateIds.map(id => {
      const a = getAssetRaw(id);
      const insts = getState().instances.filter(i => i.skillId === id).slice().sort((x, y) => String(x.id).localeCompare(String(y.id)));
      return {
        id,
        lifecycleStatus: a ? a.lifecycleStatus : null,
        instanceIds: insts.map(i => i.id),
        instanceLifecycles: insts.map(i => ({ id: i.id, lifecycleStatus: i.lifecycleStatus })),
        bindingIds: getState().sourceBindings.filter(b => b.skillId === id).map(b => b.id).slice().sort(),
        bindingScopes: getState().sourceBindings.filter(b => b.skillId === id).map(b => ({
          id: b.id, scope: b.scope || 'asset', instanceId: b.instanceId || null, sourceDivergence: !!b.sourceDivergence
        })).sort((x, y) => String(x.id).localeCompare(String(y.id)))
      };
    });
  }

  function captureActiveOperationsForAssets(assetIds, excludeOpId) {
    ensurePhaseFCollections();
    const idSet = new Set($coerceArray(assetIds));
    const out = [];
    const specs = [
      ['installOperations', op => idSet.has(op.existingAssetId) || (op.source && idSet.has(op.source.assetId))],
      ['updateOperations', op => op.source && idSet.has(op.source.assetId)],
      ['uninstallOperations', op => op.source && idSet.has(op.source.assetId)],
      ['applyOperations', op => idSet.has(op.assetId) || idSet.has(op.skillId)],
      ['forceApplyOperations', op => idSet.has(op.assetId) || idSet.has(op.skillId)],
      ['duplicateResolutionOperations', op =>
        $coerceArray(op.candidateIds).some(id => idSet.has(id)) ||
        idSet.has(op.primaryAssetId) || idSet.has(op.archiveAssetId)]
    ];
    specs.forEach(([collection, refs]) => {
      (getState()[collection] || []).forEach(op => {
        if (!op || op.id === excludeOpId) return;
        if (op.status !== 'prepared') return;
        if (!refs(op)) return;
        out.push({
          collection,
          id: op.id,
          status: op.status,
          invalidatedReason: op.invalidatedReason || null,
          canonicalAssetId: op.canonicalAssetId || null,
          completedAt: op.completedAt || null
        });
      });
    });
    return out;
  }

  function captureDuplicateEntityCheckpoint(candidateIds) {
    const state = getState();
    const ids = new Set(candidateIds);
    return {
      assets: state.assets.filter(a => ids.has(a.id)).map(a => JSON.parse(JSON.stringify(a))),
      instances: state.instances.filter(i => ids.has(i.skillId)).map(i => JSON.parse(JSON.stringify(i))),
      files: state.files.filter(f => ids.has(f.skillId)).map(f => JSON.parse(JSON.stringify(f))),
      bindings: state.sourceBindings.filter(b => ids.has(b.skillId)).map(b => JSON.parse(JSON.stringify(b))),
      drafts: state.drafts.filter(d => ids.has(d.skillId)).map(d => JSON.parse(JSON.stringify(d))),
      snapshots: state.snapshots.filter(s => ids.has(s.skillId)).map(s => ({
        id: s.id, skillId: s.skillId, instanceId: s.instanceId, type: s.type, note: s.note, source: s.source, retained: s.retained
      })),
      pendingTasks: state.pendingTasks.filter(t => ids.has(t.skillId)).map(t => JSON.parse(JSON.stringify(t))),
      permissionGrants: (state.permissionGrants || []).filter(g =>
        (g.scopeType === 'asset' && ids.has(g.scopeId)) ||
        (g.scopeType === 'instance' && state.instances.some(i => i.id === g.scopeId && ids.has(i.skillId)))
      ).map(g => JSON.parse(JSON.stringify(g))),
      editorSessions: (state.editorSessions || []).filter(s => ids.has(s.assetId) || ids.has(s.skillId)).map(s => JSON.parse(JSON.stringify(s))),
      conflicts: (state.conflicts || []).filter(c => ids.has(c.assetId) || ids.has(c.skillId)).map(c => JSON.parse(JSON.stringify(c))),
      activeOperations: captureActiveOperationsForAssets(candidateIds),
      assetIds: candidateIds.slice(),
      createdEntityIds: []
    };
  }

  function trackDuplicateCreatedEntity(op, type, id) {
    if (!op || !op._entityCheckpoint) return;
    if (!op._entityCheckpoint.createdEntityIds) op._entityCheckpoint.createdEntityIds = [];
    op._entityCheckpoint.createdEntityIds.push({ type, id });
  }

  function restoreDuplicateEntityCheckpoint(cp) {
    if (!cp) return false;
    const state = getState();
    const idSet = new Set(cp.assetIds || []);
    const knownAssetIds = new Set((cp.assets || []).map(a => a.id));
    const knownInstanceIds = new Set((cp.instances || []).map(i => i.id));
    const knownFileIds = new Set((cp.files || []).map(f => f.id));
    const knownBindingIds = new Set((cp.bindings || []).map(b => b.id));
    const knownDraftIds = new Set((cp.drafts || []).map(d => d.id));

    // Delete all entities created during this operation (NO name-based detection)
    (cp.createdEntityIds || []).forEach(ref => {
      if (!ref || !ref.id) return;
      if (ref.type === 'asset') state.assets = state.assets.filter(a => a.id !== ref.id);
      else if (ref.type === 'instance') state.instances = state.instances.filter(i => i.id !== ref.id);
      else if (ref.type === 'file') state.files = state.files.filter(f => f.id !== ref.id);
      else if (ref.type === 'binding') state.sourceBindings = state.sourceBindings.filter(b => b.id !== ref.id);
      else if (ref.type === 'snapshot') state.snapshots = state.snapshots.filter(s => s.id !== ref.id);
      else if (ref.type === 'draft') state.drafts = state.drafts.filter(d => d.id !== ref.id);
      else if (ref.type === 'pendingTask') state.pendingTasks = state.pendingTasks.filter(t => t.id !== ref.id);
      else if (ref.type === 'archiveRecord') state.archiveRecords = (state.archiveRecords || []).filter(r => r.id !== ref.id);
      else if (ref.type === 'permissionGrant') state.permissionGrants = (state.permissionGrants || []).filter(g => g.id !== ref.id);
    });

    // Drop entities tied to candidate assets that are not in the known checkpoint set
    state.assets = state.assets.filter(a => knownAssetIds.has(a.id) || !idSet.has(a.id));
    state.instances = state.instances.filter(i => knownInstanceIds.has(i.id) || !idSet.has(i.skillId));
    state.files = state.files.filter(f => knownFileIds.has(f.id) || !idSet.has(f.skillId));
    state.sourceBindings = state.sourceBindings.filter(b => knownBindingIds.has(b.id) || !idSet.has(b.skillId));
    state.drafts = state.drafts.filter(d => knownDraftIds.has(d.id) || !idSet.has(d.skillId));

    (cp.snapshots || []).forEach(ref => {
      const s = state.snapshots.find(x => x.id === ref.id);
      if (s) {
        s.skillId = ref.skillId;
        s.instanceId = ref.instanceId;
      }
    });

    function upsert(list, item, key) {
      const cur = list.find(x => x[key] === item[key]);
      if (!cur) list.push(JSON.parse(JSON.stringify(item)));
      else Object.keys(item).forEach(k => { cur[k] = item[k]; });
    }
    (cp.assets || []).forEach(a => upsert(state.assets, a, 'id'));
    (cp.instances || []).forEach(i => upsert(state.instances, i, 'id'));
    (cp.files || []).forEach(f => upsert(state.files, f, 'id'));
    (cp.bindings || []).forEach(b => upsert(state.sourceBindings, b, 'id'));
    (cp.drafts || []).forEach(d => upsert(state.drafts, d, 'id'));
    (cp.pendingTasks || []).forEach(t => upsert(state.pendingTasks, t, 'id'));
    (cp.permissionGrants || []).forEach(g => upsert(state.permissionGrants || (state.permissionGrants = []), g, 'id'));
    (cp.editorSessions || []).forEach(s => upsert(state.editorSessions || (state.editorSessions = []), s, 'id'));
    (cp.conflicts || []).forEach(c => upsert(state.conflicts || (state.conflicts = []), c, 'id'));
    (cp.activeOperations || []).forEach(ref => {
      const list = state[ref.collection];
      if (!list) return;
      const op = list.find(o => o.id === ref.id);
      if (!op) return;
      op.status = ref.status;
      op.invalidatedReason = ref.invalidatedReason;
      op.canonicalAssetId = ref.canonicalAssetId;
      op.completedAt = ref.completedAt;
    });
    return true;
  }

  function recheckDuplicatePrepared(op) {
    const candidateIds = $coerceArray(op.candidateIds);
    for (const id of candidateIds) {
      if (!getAssetRaw(id)) return { ok: false, code: 'operation_stale', error: '候选 Asset 不存在' };
    }
    const current = buildDuplicateCandidateFingerprint(candidateIds);
    const prepared = op.preparedCandidateFingerprint;
    if (!prepared) return { ok: false, code: 'operation_stale', error: '缺少 Prepare Fingerprint' };
    if (JSON.stringify(current) !== JSON.stringify(prepared)) {
      return { ok: false, code: 'operation_stale', error: '候选生命周期/Instance/Binding 已变化' };
    }
    return { ok: true };
  }

  function prepareDuplicateResolution(options = {}) {
    ensurePhaseFCollections();
    ensureCompareCollections();
    const action = options.action || options.resolution;
    if (!action) return { ok: false, error: 'Missing action' };
    const destructive = (
      action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance' ||
      action === 'merge-new' || action === 'merge_new' ||
      action === 'archive'
    );
    if (!destructive) {
      return { ok: false, code: 'not_destructive', error: '非破坏性动作请直接使用 resolveDuplicateComparison' };
    }

    const session = options.sessionId
      ? getState().compareSessions.find(s => s.id === options.sessionId)
      : null;
    const candidateIds = session
      ? $coerceArray(session.candidateIds).slice()
      : $coerceArray(options.candidateIds).map(id => resolveAssetId(id) || id).filter(Boolean);
    if (!candidateIds.length) return { ok: false, code: 'no_candidates' };
    const groupId = options.groupId || (session && session.groupId) || null;
    const primaryAssetId = resolveAssetId(options.primaryAssetId) || options.primaryAssetId || candidateIds[0];
    const archiveAssetId = resolveAssetId(options.archiveAssetId) || options.archiveAssetId || null;
    const archiveInstanceId = options.archiveInstanceId || null;

    const impact = buildDuplicateImpactPreview(action, candidateIds, primaryAssetId, archiveAssetId);
    const preparedAt = $now();
    const preparedCandidateFingerprint = buildDuplicateCandidateFingerprint(candidateIds);
    const op = {
      id: uuid(),
      type: 'duplicate-resolution',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      action,
      sessionId: session ? session.id : (options.sessionId || null),
      groupId,
      candidateIds,
      primaryAssetId,
      archiveAssetId,
      archiveInstanceId,
      options: {
        name: options.name || null,
        displayName: options.displayName || null,
        reason: options.reason || null
      },
      impact,
      checkpointId: uuid(),
      preparedCandidateFingerprint,
      _entityCheckpoint: captureDuplicateEntityCheckpoint(candidateIds),
      confirmationHash: $hash(JSON.stringify({ action, candidateIds, primaryAssetId, archiveAssetId })),
      results: null,
      confirmedAt: null,
      completedAt: null
    };
    getState().duplicateResolutionOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      action,
      impact,
      candidateIds,
      primaryAssetId,
      archiveAssetId,
      requiresConfirm: true
    }));
  }

  function confirmDuplicateResolution(operationId, options = {}) {
    ensurePhaseFCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed' };
    const op = getState().duplicateResolutionOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    if (Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired'; saveState();
      return { ok: false, code: 'operation_expired' };
    }

    const recheck = recheckDuplicatePrepared(op);
    if (!recheck.ok) {
      op.status = 'invalidated';
      saveState();
      return { ok: false, code: recheck.code, error: recheck.error, operationId };
    }

    op.confirmedAt = $now();
    op.status = 'applying';
    const action = op.action;
    const candidateIds = op.candidateIds.slice();
    const groupId = op.groupId;
    let result = { ok: true, action };

    try {
      if (action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance') {
        const primaryAssetId = op.primaryAssetId || candidateIds[0];
        const others = candidateIds.filter(id => id !== primaryAssetId);
        const merge = mergeCandidatesAsMultiInstance(primaryAssetId, others, { skipInvalidate: true });
        if (!merge.ok) throw new Error(merge.error || 'merge failed');
        const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
        addAuditEvent({
          skillId: primaryAssetId,
          eventType: 'compare_confirm_multi_instance',
          category: 'system',
          source: 'Skill Panel',
          result: 'completed',
          note: '确认为同一 Asset 多实例 · 保留 UUID ' + primaryAssetId + ' · 并入实例 ' + merge.movedInstanceIds.length
        });
        result = { ...result, ...merge, preservedAssetId: merge.preservedAssetId, resolvedTaskCount: resolved };
      } else if (action === 'archive') {
        const archiveAssetId = op.archiveAssetId;
        const archiveInstanceId = op.archiveInstanceId;
        const beforeArchiveCount = (getState().archiveRecords || []).length;
        const beforeSnapCount = getState().snapshots.length;
        if (archiveInstanceId) {
          const inst = getInstanceRaw(archiveInstanceId);
          if (!inst) throw new Error('Instance not found');
          const siblings = getState().instances.filter(i => i.skillId === inst.skillId);
          if (siblings.length <= 1) {
            archiveSkill(inst.skillId, (op.options && op.options.reason) || 'Compare 归档');
            result.archivedAssetId = inst.skillId;
          } else {
            const det = detachInstance(archiveInstanceId);
            result.detachedInstanceId = archiveInstanceId;
            result.detach = det;
          }
        } else if (archiveAssetId) {
          archiveSkill(archiveAssetId, (op.options && op.options.reason) || 'Compare 归档');
          result.archivedAssetId = archiveAssetId;
        } else {
          throw new Error('archiveAssetId or archiveInstanceId required');
        }
        (getState().archiveRecords || []).slice(beforeArchiveCount).forEach(r => trackDuplicateCreatedEntity(op, 'archiveRecord', r.id));
        getState().snapshots.slice(beforeSnapCount).forEach(s => trackDuplicateCreatedEntity(op, 'snapshot', s.id));
        result.resolvedTaskCount = resolveDuplicateTasksForCandidates(candidateIds, groupId);
        addAuditEvent({
          skillId: result.archivedAssetId || null,
          instanceId: archiveInstanceId || null,
          eventType: 'compare_archive',
          category: 'archive',
          source: 'Skill Panel',
          result: 'completed',
          note: 'Compare 归档候选'
        });
      } else if (action === 'merge-new' || action === 'merge_new') {
        const simDup = getState().installSim || {};
        const merged = createMergedAssetFromCandidates(candidateIds, Object.assign({}, op.options || {}, { _trackOp: op, skipInvalidate: true }));
        if (!merged.ok) throw new Error(merged.error || 'merge-new failed');
        if (simDup.duplicateFailAfterCreate) throw new Error('sim_fail_merge_new');
        const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
        addAuditEvent({
          skillId: merged.newAssetId,
          eventType: 'compare_merge_new',
          category: 'system',
          source: 'Skill Panel',
          result: 'completed',
          note: '人工合并为新 Asset · ' + merged.name
        });
        result = { ...result, ...merged, resolvedTaskCount: resolved };
      } else {
        throw new Error('Unknown action: ' + action);
      }

      // Ensure no active instances point at deleted candidate assets
      candidateIds.forEach(cid => {
        const a = getAssetRaw(cid);
        if (a && a.lifecycleStatus === 'deleted') {
          const dangling = getState().instances.filter(i => i.skillId === cid && i.lifecycleStatus === 'available');
          if (dangling.length) throw new Error('Active instance points at deleted asset: ' + dangling[0].id);
        }
      });

      if (op.sessionId) {
        const session = getState().compareSessions.find(s => s.id === op.sessionId);
        if (session) {
          session.status = 'resolved';
          session.resolvedAt = $now();
          session.resolution = {
            action,
            at: session.resolvedAt,
            primaryAssetId: result.preservedAssetId || result.newAssetId || op.primaryAssetId || null,
            archivedAssetId: result.archivedAssetId || null,
            operationId: op.id
          };
        }
      }

      const canonicalAssetId = result.preservedAssetId || result.newAssetId || op.primaryAssetId || candidateIds[0];
      invalidateOpenOperationsForAssets(candidateIds, canonicalAssetId);

      op.results = result;
      op.status = 'completed';
      op.completedAt = $now();
      saveState();
      return JSON.parse(JSON.stringify({ ok: true, status: 'completed', operationId, ...result }));
    } catch (e) {
      restoreDuplicateEntityCheckpoint(op._entityCheckpoint);
      op.status = 'failed';
      op.completedAt = $now();
      op.results = { ok: false, error: String(e.message || e) };
      saveState();
      return JSON.parse(JSON.stringify({ ok: false, status: 'failed', operationId, error: String(e.message || e) }));
    }
  }

  function getDuplicateResolutionOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().duplicateResolutionOperations.find(o => o.id === operationId);
    return op ? toSafeOperationView(op) : null;
  }

  /* ---------- expose ---------- */
  const SP = {
    version: STATE_VERSION,
    lang: 'zh',
    t(key) { return (i18n[this.lang] || i18n.zh)[key] || key; },

    // utils
    $now, $daysAgo, $hoursAgo, $clamp, $escape, $tokenApprox, $hash, $dateOnly, $timeAgo, $formatTime, $simpleMd, $lineDiff, $parseYaml, $buildYaml,
    $safeJoin, $safeIncludes, $safeSlice, $safeLocale, $safeToLower, $coerceArray,
    $normalizePath, $pathInScope,
    lineDiffSafe,

    // state (no raw getters / no production saveState)
    getState: getPublicState, resetState,
    getSettings, setSetting, resetSettingsToDefaults, clearArchiveRecords, clearUsageEvents, setAdapterStatus,
    getIgnoreRules,
    getViewState, setViewState,
    saveOrigin, getOrigin, clearOrigin,
    applyTheme, applyLanguage, applyLang: applyLanguage,
    t,

    // v3 entity API
    getAssets, getAsset, resolveAssetId, resolveCanonicalAssetId, getCanonicalUsageEvents,
    getInstances, getInstance,
    getFiles, getFile,
    getSourceBindings, getSourceBinding,
    getPermissionGrants,
    getHosts, getHost, updateHost, computeHostSkillCount,
    getScanSessions, getScanSession, getActiveScanSession, getScanDiscoveries,
    getChangeSets, getChangeItems, getPendingChangeSetCount,
    resolveDuplicateGroup, resolveDuplicateTasksByGroup,
    openCompareSession, getCompareOverview, getCompareFileSummary, getCompareFileDetail,
    resolveDuplicateComparison, getCompareSession,
    prepareDuplicateResolution, confirmDuplicateResolution, getDuplicateResolutionOperation,
    resolveInstallSource, prepareInstall, confirmInstall, getInstallOperation, loadInstallDemoCase, openInstallPage, listInstallableAssets,
    checkForUpdates, getUpdatePlanPreview, prepareUpdate, confirmUpdate, cancelUpdateOperation, getUpdateOperation, getUpdateThreeWayDiff, loadUpdateDemoCase, openUpdatePage,
    prepareUninstall, confirmUninstall, getUninstallOperation, openUninstallPage,

    // v2 compatibility API
    getSkills, getSkill, getActiveSkills, getArchivedSkills, getIgnoredSkills,
    getStorageLocations, getStorageLocation, getAdapters,
    hasUsageData, isIgnored,
    getMainStatus, getStatusClass, getStatusLabel, getTaskLabel,
    getPendingTasks, getDraft, getDraftSummaries, getSnapshots, getArchiveRecord,
    getSkillEvents, getRecentEvents, getActivityEvents, getAuditEvents,
    getOpenPendingActivityEvents, getOpenPendingTaskCount,

    // navigation
    openSkillDetail, openSkillEditor, openConflictPage, openCompare, openScan, openScanChanges, returnToOrigin, appendTestModeParam,
    redirectToOnboardingIfNeeded, markOnboardingComplete, getOnboardingDecision,

    // insights
    getArchiveCandidates, getDuplicateGroups, getFileIssues,
    getUnfinishedDrafts, getTokenAttentions, getRecentMaintenance,

    // filters / sort
    filterSkills, sortSkills,

    // Phase C Library API
    queryLibraryAssets, getAssetSummary, getAssetInstances, getAssetFiles,
    searchLibrary, getLibraryCounts, getPendingChangeSetSummary, getAssetStatusSummary,
    getLibraryViewState, setLibraryViewState, getCategories, getTags,
    toggleFavorite, addAssetCategories, addAssetTags, ignoreMissingHint, batchLibraryAction,
    LIBRARY_DEFAULT_COLUMNS, LIBRARY_ALL_COLUMNS,

    // Phase D Detail API
    getDetailViewState, setDetailViewState,
    getAssetDetail, getInstanceDetail, getInstanceFiles, buildFileTree, getFileDetail,
    getAssetSourceBinding, getInstancePermission, getAssetUsageSummary,
    getAssetAuditEvents, getAssetSnapshots, getSnapshotDetail, getSnapshotFileDetail,
    openEditorSession, getEditorSession, restoreEditorSession,
    getEditorViewState, setEditorViewState, getConflictViewState, setConflictViewState,
    getEditorFileContent, getEditorDraft, saveEditorDraft, discardEditorDraft,
    validateEditorSession, getEditorDiff, getEditorAllDiff,
    prepareApplyChanges, confirmApplyChanges, cancelApplyOperation,
    detectExternalChanges, getConflict, getConflictFileDetail, markConflictDiffViewed,
    resolveConflictKeepDraft, resolveConflictDiscard, resolveConflictReload,
    resolveConflictMerge, resolveConflictSaveCopy,
    prepareForceOverwrite, confirmForceOverwrite, cancelForceApplyOperation, returnToEditorFromConflict,
    loadEditorDemoCase,
    setPrimaryInstance, requestWritePermission, revokeWritePermission,
    relinkInstance, detachInstance, getRelinkCandidates,
    setSnapshotRetained, createPackageSnapshot, createFileSnapshot,

    // mutations
    updateSkill, createSnapshot,
    addAuditEvent, addUsageEvent,
    startScan, getScanStatus, getScanResult,
    createScanSession, pauseScan, resumeScan, cancelScan, discardScanSession, scanTick,
    createChangeSet, acceptChangeItem, ignoreChangeItem, deferChangeItem, applyChangeSet, reconcileAssetLifecycle,
    restoreChangeSetCheckpoint, convertRebindToAdd, loadDemoScanScenario,
    resolveTask, resolveSkillTasks, createPendingTask,
    createIgnoreRule, removeIgnoreRule, ignorePendingSuggestion,
    archiveSkill, restoreSkill, deleteSkill,
    saveDraft, applyChanges, forceApply, createSkill,

    toast,
    uuid, seedUuid,
    isDevNavigationBypass, isTestMode, isDevMode
  };

  window.SP = SP;

  if (isTestMode()) {
    SP.__test = {
      getRawState() { return getState(); },
      patchRawState(mutator) {
        if (typeof mutator === 'function') mutator(getState());
        saveState();
      },
      saveState,
      getAssetRaw, getInstanceRaw, getHostRaw,
      createPackageSnapshotForInstance,
      loadEditorDemoCase
    };
  }

  // First-launch routing guard: redirect any non-exempt main page to onboarding when not initialized.
  redirectToOnboardingIfNeeded();

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const settings = getSettings();
    const theme = settings.theme || 'system';
    const lang = settings.language === 'system' ? (navigator.language.startsWith('zh') ? 'zh' : 'en') : settings.language;
    applyTheme(theme);
    applyLanguage(lang);
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      setSetting('theme', next);
      applyTheme(next);
    });
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) langBtn.addEventListener('click', () => {
      const next = SP.lang === 'zh' ? 'en' : 'zh';
      setSetting('language', next);
      applyLanguage(next);
      if (typeof render === 'function') render();
    });
  });
})();
