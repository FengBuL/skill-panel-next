/* Phase D Skill Detail page controller — depends on window.SP */
(function () {
  'use strict';

  const TABS = ['overview', 'files', 'instances', 'source', 'permissions', 'usage', 'activity', 'snapshots'];
  const ATTR_LABELS = {
    accurate: '精确归因',
    partial: '部分归因',
    unattributed: '无法归因',
    'no-data': '无数据'
  };
  const SNAP_TYPE_LABELS = {
    package: '包快照',
    file: '文件快照',
    'pre-apply': '应用前',
    'pre-archive': '归档前',
    manual: '手动'
  };

  let assetId = null;
  let detail = null;
  let vs = SP.getDetailViewState();
  let relinkInstanceId = null;
  let selectedCandidate = null;
  let permPending = null;
  let detachPendingId = null;
  let filesMobileMode = 'tree'; // tree | viewer under 1100px
  let restoringScroll = false;

  /* ---------- toast (DOM + SP) ---------- */
  function toast(msg) {
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(() => el.classList.remove('show'), 2200);
    }
    try { SP.toast(msg); } catch (_) { /* ignore */ }
  }

  /* ---------- view state ---------- */
  function persist(patch) {
    vs = SP.setDetailViewState(patch || {});
    return vs;
  }

  function syncUrl() {
    const params = new URLSearchParams(location.search);
    const skill = params.get('skill') || assetId;
    const next = new URLSearchParams();
    if (skill) next.set('skill', skill);
    if (params.get('dev')) next.set('dev', params.get('dev'));
    const qs = next.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  /* ---------- helpers ---------- */
  function hostLabel(hostType) {
    const map = {
      'claude-code': 'Claude Code',
      codex: 'Codex',
      custom: '自定义',
      archive: '归档',
      cursor: 'Cursor',
      warp: 'Warp'
    };
    return map[hostType] || hostType || '—';
  }

  function fmtBytes(n) {
    if (n == null || Number.isNaN(n)) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function pillClass(attention) {
    if (attention === 'conflict' || attention === 'missing-all') return 'danger';
    if (attention === 'archived') return 'arch';
    if (attention && attention !== 'normal') return 'warn';
    return 'ok';
  }

  function hasWriteAccess(instanceId) {
    const perm = SP.getInstancePermission(instanceId);
    return !!(perm && perm.writeAccess);
  }

  function hasReadAccess(instanceId) {
    const perm = SP.getInstancePermission(instanceId);
    return !!(perm && perm.readAccess);
  }

  function primaryInstance() {
    if (!detail || !detail.instances) return null;
    return detail.instances.find(i => i.isPrimary) || detail.instances[0] || null;
  }

  function selectedInstance() {
    if (!detail) return null;
    const id = vs.selectedInstanceId;
    if (id) {
      const found = detail.instances.find(i => i.id === id);
      if (found) return found;
    }
    return primaryInstance();
  }

  function closeAllModals() {
    ['relink-modal', 'perm-modal', 'arch-modal', 'restore-modal', 'detach-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
  }

  function showModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
  }

  /* ---------- sidebar ---------- */
  function updateSidebar() {
    try {
      const counts = SP.getLibraryCounts ? SP.getLibraryCounts() : null;
      const lib = document.getElementById('nav-lib-count');
      const ins = document.getElementById('nav-ins-count');
      const act = document.getElementById('nav-act-count');
      if (counts) {
        if (lib) lib.textContent = counts.all;
        if (ins) {
          const insightOpen =
            (SP.getArchiveCandidates().length) +
            (SP.getDuplicateGroups().length) +
            (SP.getFileIssues().length);
          ins.textContent = insightOpen;
        }
      } else if (lib) {
        lib.textContent = SP.getActiveSkills().length;
      }
      if (act) {
        const openPending =
          (SP.getArchiveCandidates ? SP.getArchiveCandidates().length : 0) +
          (SP.getDuplicateGroups ? SP.getDuplicateGroups().length : 0) +
          (SP.getFileIssues ? SP.getFileIssues().length : 0) +
          (SP.getUnfinishedDrafts ? SP.getUnfinishedDrafts().length : 0) +
          (SP.getTokenAttentions ? SP.getTokenAttentions().length : 0);
        act.textContent = openPending;
      }
    } catch (_) { /* ignore */ }
  }

  /* ---------- reload detail ---------- */
  function reloadDetail() {
    detail = SP.getAssetDetail(assetId);
    if (!detail) return false;
    // Ensure selected instance still exists
    if (vs.selectedInstanceId && !detail.instances.some(i => i.id === vs.selectedInstanceId)) {
      const p = primaryInstance();
      persist({ selectedInstanceId: p ? p.id : null, selectedFileId: null });
    }
    if (!vs.selectedInstanceId) {
      const p = primaryInstance();
      if (p) persist({ selectedInstanceId: p.id });
    }
    return true;
  }

  /* ---------- header ---------- */
  function renderHeader() {
    document.getElementById('title').textContent = detail.displayName || detail.name;
    document.getElementById('tech-name').textContent = detail.name + (detail.invocation ? ' · ' + detail.invocation : '');
    const pathEl = document.getElementById('path-text');
    if (pathEl) pathEl.textContent = detail.primaryPath || '—';
    document.getElementById('desc').textContent = detail.description || '';

    const status = detail.status || {};
    const row = document.getElementById('status-row');
    const pills = [];
    pills.push(`<span class="sd-pill ${pillClass(status.attention)}"><i></i>${SP.$escape(status.attentionLabel || '正常')}</span>`);
    pills.push(`<span class="sd-pill"><i></i>${SP.$escape(detail.lifecycleStatus || '—')}</span>`);
    if (detail.instanceCount > 1) {
      pills.push(`<span class="sd-pill"><i></i>${detail.instanceCount} 个实例</span>`);
    }
    if (detail.updateStatus === 'available') {
      pills.push(`<span class="sd-pill warn"><i></i>可更新</span>`);
    }
    if (detail.isFavorite) {
      pills.push(`<span class="sd-pill ok"><i></i>已收藏</span>`);
    }
    row.innerHTML = pills.join('');

    const favBtn = document.getElementById('btn-fav');
    favBtn.textContent = detail.isFavorite ? '★ 已收藏' : '☆ 收藏';

    const primary = primaryInstance();
    const editBtn = document.getElementById('btn-edit');
    const folderBtn = document.getElementById('btn-folder');
    if (!primary) {
      editBtn.textContent = '需要读取权限';
      editBtn.disabled = true;
      editBtn.title = '没有可用实例';
      if (folderBtn) {
        folderBtn.disabled = true;
        folderBtn.title = '没有可用实例';
      }
    } else if (primary.lifecycleStatus === 'missing') {
      editBtn.textContent = '需要读取权限';
      editBtn.disabled = true;
      editBtn.title = '实例 Missing，请先 Relink';
      if (folderBtn) {
        folderBtn.disabled = true;
        folderBtn.title = 'Missing 实例无法在 Finder 中显示';
      }
    } else if (!hasReadAccess(primary.id)) {
      editBtn.textContent = '需要读取权限';
      editBtn.disabled = true;
      editBtn.title = '当前实例不可读';
      // Prototype policy: Permission Denied may still request Finder open, but never claim success.
      if (folderBtn) {
        const pathOk = !!(primary.skillFilePath || primary.rootPath);
        folderBtn.disabled = !pathOk;
        folderBtn.title = pathOk
          ? 'Permission Denied：仅请求打开，不保证成功'
          : '没有有效路径';
      }
    } else {
      const canWrite = hasWriteAccess(primary.id);
      editBtn.textContent = canWrite ? '编辑' : '编辑（只读）';
      editBtn.disabled = false;
      editBtn.title = canWrite ? '打开可编辑 Editor' : '打开只读 Editor';
      if (folderBtn) {
        const pathOk = !!(primary.skillFilePath || primary.rootPath);
        folderBtn.disabled = !pathOk;
        folderBtn.title = pathOk ? '请求在 Finder 中显示' : '没有有效路径';
      }
    }

    const isArchived = detail.lifecycleStatus === 'archived';
    const hasMissing = (detail.instanceSummary && detail.instanceSummary.missing > 0) ||
      detail.instances.some(i => i.lifecycleStatus === 'missing');
    const updateAvail = detail.updateStatus === 'available';

    document.getElementById('btn-update').hidden = !updateAvail;
    document.getElementById('btn-relink').hidden = !hasMissing || isArchived;
    document.getElementById('btn-archive').hidden = isArchived;
    document.getElementById('btn-restore-top').hidden = !isArchived;
    const btnRestore = document.getElementById('btn-restore');
    if (btnRestore) btnRestore.hidden = !isArchived;
    // Prefer single visible restore control
    if (btnRestore) document.getElementById('btn-restore-top').hidden = true;
    if (!isArchived && btnRestore) btnRestore.hidden = true;

    document.getElementById('more-update').hidden = !updateAvail;
    document.getElementById('more-relink').hidden = !hasMissing || isArchived;
    document.getElementById('more-archive').hidden = isArchived;
    document.getElementById('more-restore').hidden = !isArchived;
  }

  /* ---------- tabs ---------- */
  function setTab(tab) {
    if (!TABS.includes(tab)) tab = 'overview';
    persist({ tab });
    document.querySelectorAll('#detail-tabs [data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      const match = panel.dataset.panel === tab;
      panel.hidden = !match;
    });
    renderActivePanel();
  }

  function renderActivePanel() {
    const tab = vs.tab || 'overview';
    switch (tab) {
      case 'overview': renderOverview(); break;
      case 'files': renderFiles(); break;
      case 'instances': renderInstances(); break;
      case 'source': renderSource(); break;
      case 'permissions': renderPermissions(); break;
      case 'usage': renderUsage(); break;
      case 'activity': renderActivity(); break;
      case 'snapshots': renderSnapshots(); break;
      default: renderOverview();
    }
  }

  /* ---------- overview ---------- */
  function renderOverview() {
    const status = detail.status || {};
    const inst = detail.instanceSummary || {};
    const files = detail.fileSummary || {};
    const source = detail.source || {};
    const usage = detail.usage || {};
    const primary = primaryInstance();

    document.getElementById('ov-status').innerHTML = [
      prop('生命周期', detail.lifecycleStatus),
      prop('关注项', status.attentionLabel || '正常'),
      prop('健康', (status.health && status.health.length) ? status.health.join('、') : '正常'),
      prop('本地修改', status.localModification || 'clean'),
      prop('权限模式', status.permission || '—')
    ].join('');

    const primaryEl = document.getElementById('ov-primary');
    if (!primary) {
      primaryEl.innerHTML = prop('主实例', '无');
    } else {
      primaryEl.innerHTML = [
        prop('宿主', hostLabel(primary.hostType)),
        prop('路径', primary.skillFilePath || primary.rootPath || '—', true),
        prop('状态', primary.lifecycleStatus || '—'),
        prop('角色', primary.isPrimary ? '主实例' : '实例'),
        prop('版本', primary.installedVersion || '—')
      ].join('');
    }

    const sourceVal = source.bound
      ? (source.sourceType || 'bound')
      : '未绑定';
    document.getElementById('ov-source').innerHTML = [
      prop('绑定状态', source.bound ? '已绑定' : '未绑定'),
      prop('来源类型', sourceVal),
      prop('更新状态', source.updateStatus || '—'),
      prop('远端版本', source.remoteVersion || '—'),
      prop('仓库', source.repository || source.sourceUrl || '—')
    ].join('');

    const permPrimary = primary ? SP.getInstancePermission(primary.id) : null;
    document.getElementById('ov-permission').innerHTML = [
      prop('模式', (permPrimary && permPrimary.permissionMode) || status.permission || '—'),
      prop('读权限', permPrimary ? (permPrimary.readAccess ? '可读' : '不可读') : '—'),
      prop('写权限', permPrimary ? (permPrimary.writeAccess ? '可写' : '只读') : '—'),
      prop('内容访问', (permPrimary && permPrimary.contentAccessStatus) || '—')
    ].join('');

    const tasksEl = document.getElementById('ov-tasks');
    const tasks = detail.pendingTasks || [];
    if (!tasks.length) {
      tasksEl.innerHTML = '<div class="file-empty">无待处理任务</div>';
    } else {
      tasksEl.innerHTML = tasks.map(t => {
        const label = SP.getTaskLabel(t.taskType) || t.taskType;
        const reason = (t.reasonCodes || []).join('，') || t.reason || '';
        return `<div class="task-row" data-task-id="${SP.$escape(t.id)}">
          <div class="grow">
            <strong>${SP.$escape(label)}</strong>
            <div class="reason">${SP.$escape(reason)}</div>
          </div>
          <button type="button" class="btn" data-resolve-task="${SP.$escape(t.id)}">标记已处理</button>
        </div>`;
      }).join('');
    }

    document.getElementById('ov-instances').innerHTML = [
      prop('实例总数', String(inst.total || 0)),
      prop('可用', String(inst.available || 0)),
      prop('Missing', String(inst.missing || 0)),
      prop('只读 / 可写', `${inst.readOnly || 0} / ${inst.managed || 0}`),
      prop('宿主', (inst.hosts || []).map(hostLabel).join('、') || '—')
    ].join('');

    document.getElementById('ov-files').innerHTML = [
      prop('文件总数', String(files.total || 0)),
      prop('文本 / 二进制', `${files.text || 0} / ${files.binary || 0}`),
      prop('包大小', fmtBytes(files.packageSizeBytes)),
      prop('嵌套 SKILL.md', String(files.nestedSkillCount || 0)),
      prop('索引失败', String(files.indexFailed || 0))
    ].join('');

    let usageDisplay = usage.displayLabel || '—';
    if (usage.dataStatus === 'unsupported') usageDisplay = '暂无数据';
    else if (usage.dataStatus === 'zero') usageDisplay = '0';
    document.getElementById('ov-usage').innerHTML = [
      prop('调用次数', usageDisplay),
      prop('归因级别', ATTR_LABELS[usage.attributionLevel] || usage.attributionLevel || '—'),
      prop('会话数', usage.sessions != null ? String(usage.sessions) : '—'),
      prop('Token', usage.totalTokens != null ? SP.$safeLocale(usage.totalTokens) : '—')
    ].join('');
  }

  function prop(label, value, mono) {
    const v = String(value == null ? '—' : value);
    return `<div class="sd-prop"><span class="label">${SP.$escape(label)}</span><span class="value${mono ? ' mono' : ''}">${SP.$escape(v)}</span></div>`;
  }

  function block(label, value) {
    return `<div class="sd-block"><div class="label">${SP.$escape(label)}</div><div class="value">${SP.$escape(String(value == null ? '—' : value))}</div></div>`;
  }

  /* ---------- files ---------- */
  function renderFiles() {
    const sel = document.getElementById('instance-switch');
    const instances = detail.instances || [];
    const currentId = (selectedInstance() || {}).id;

    sel.innerHTML = instances.map(inst => {
      const label = `${hostLabel(inst.hostType)}${inst.isPrimary ? ' · 主实例' : ''}${inst.lifecycleStatus === 'missing' ? ' · Missing' : ''}`;
      return `<option value="${SP.$escape(inst.id)}" ${inst.id === currentId ? 'selected' : ''}>${SP.$escape(label)}</option>`;
    }).join('');

    renderFileTree();
    renderFileViewer();
    applyFilesMobileLayout();
  }

  function renderFileTree() {
    const inst = selectedInstance();
    const treeEl = document.getElementById('file-tree');
    if (!inst) {
      treeEl.innerHTML = '<div class="file-empty">无实例</div>';
      return;
    }
    const tree = SP.buildFileTree(inst.id);
    const expanded = new Set(vs.expandedFileNodes || []);
    // Ensure parents of selected file are expanded for visibility
    if (vs.selectedFileId) {
      const files = SP.getInstanceFiles(inst.id);
      const sel = files.find(f => f.id === vs.selectedFileId);
      if (sel && sel.relativePath) {
        const parts = String(sel.relativePath).split('/');
        parts.pop();
        let acc = '';
        parts.forEach(p => {
          acc = acc ? acc + '/' + p : p;
          expanded.add(acc);
        });
      }
    }
    if (!tree.length) {
      treeEl.innerHTML = '<div class="file-empty">此实例无文件</div>';
      return;
    }
    treeEl.innerHTML = '';
    tree.forEach(node => treeEl.appendChild(renderTreeNode(node, 0, expanded)));
  }

  function renderTreeNode(node, depth, expanded) {
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'node';
    if (node.type === 'file' && node.fileId === vs.selectedFileId) row.classList.add('selected');
    row.style.paddingLeft = (8 + depth * 14) + 'px';
    if (node.type === 'file' && node.fileId) row.dataset.fileId = node.fileId;
    if (node.path) row.dataset.path = node.path;
    if (node.isNestedSkillMarker) row.dataset.nested = '1';

    const twisty = document.createElement('button');
    twisty.type = 'button';
    twisty.className = 'twisty' + (node.type === 'dir' ? '' : ' empty');
    const isOpen = node.type === 'dir' && expanded.has(node.path);
    twisty.textContent = node.type === 'dir' ? (isOpen ? '▾' : '▸') : '';
    if (node.type === 'dir') {
      twisty.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpand(node.path);
      });
    }

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = node.type === 'dir' ? '▸' : (node.fileType === 'binary' ? '◆' : '·');

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = node.name;

    row.appendChild(twisty);
    row.appendChild(icon);
    row.appendChild(name);

    if (node.isNestedSkillMarker) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '嵌套';
      row.appendChild(badge);
    }

    if (node.type === 'file') {
      row.addEventListener('click', () => selectFile(node.fileId));
    } else {
      row.addEventListener('click', () => toggleExpand(node.path));
    }

    wrap.appendChild(row);

    if (node.type === 'dir' && node.children && node.children.length) {
      const kids = document.createElement('div');
      kids.className = 'children' + (isOpen ? ' open' : '');
      node.children.forEach(child => kids.appendChild(renderTreeNode(child, depth + 1, expanded)));
      wrap.appendChild(kids);
    }
    return wrap;
  }

  function toggleExpand(path) {
    const set = new Set(vs.expandedFileNodes || []);
    if (set.has(path)) set.delete(path);
    else set.add(path);
    persist({ expandedFileNodes: Array.from(set) });
    renderFileTree();
  }

  function selectFile(fileId) {
    persist({ selectedFileId: fileId });
    if (window.matchMedia('(max-width: 1100px)').matches) {
      filesMobileMode = 'viewer';
      applyFilesMobileLayout();
    }
    renderFileTree();
    renderFileViewer();
  }

  function renderFileViewer() {
    const meta = document.getElementById('file-meta');
    const sourceEl = document.getElementById('file-view-source');
    const previewEl = document.getElementById('file-view-preview');
    const mode = vs.fileViewMode || 'preview';

    document.getElementById('file-view-source-btn').classList.toggle('active', mode === 'source');
    document.getElementById('file-view-preview-btn').classList.toggle('active', mode === 'preview');

    const fileId = vs.selectedFileId;
    if (!fileId) {
      meta.textContent = '选择文件';
      sourceEl.hidden = true;
      previewEl.hidden = false;
      previewEl.textContent = '';
      previewEl.innerHTML = '<div class="file-empty">从左侧选择文件查看</div>';
      return;
    }

    const file = SP.getFileDetail(fileId);
    if (!file) {
      meta.textContent = '文件不存在';
      sourceEl.textContent = '';
      previewEl.textContent = '';
      previewEl.innerHTML = '<div class="file-empty">文件不存在或已移除</div>';
      return;
    }

    const bits = [
      file.relativePath,
      file.fileType,
      fmtBytes(file.sizeBytes),
      file.mimeType || '',
      file.isNestedSkillMarker ? '嵌套 SKILL.md' : '',
      file.contentAccessStatus || ''
    ].filter(Boolean);
    meta.textContent = bits.join(' · ');

    const access = file.contentAccessStatus || 'denied';
    const isBinaryMeta = access === 'binary-metadata' || file.isBinary || file.fileType === 'binary';

    function renderMetaOnly(message) {
      sourceEl.hidden = true;
      previewEl.hidden = false;
      previewEl.textContent = '';
      const info = document.createElement('div');
      info.className = 'file-empty';
      info.style.textAlign = 'left';
      const lines = [
        message,
        '路径：' + (file.relativePath || '—'),
        '类型：' + (file.fileType || '—'),
        'MIME：' + (file.mimeType || '—'),
        '大小：' + fmtBytes(file.sizeBytes),
        '哈希：' + (file.contentHash || '—'),
        '索引：' + (file.indexStatus || '—'),
        '访问：' + (access || '—')
      ];
      lines.forEach(line => {
        const p = document.createElement('div');
        p.textContent = line;
        p.style.marginBottom = '4px';
        info.appendChild(p);
      });
      previewEl.appendChild(info);
    }

    if (access !== 'readable' && !isBinaryMeta) {
      let msg = '无读取权限';
      if (access === 'historical-metadata') msg = '仅历史元数据（Missing）';
      else if (access === 'permission-denied' || access === 'host-denied') msg = '无读取权限';
      else if (access === 'denied') msg = '无读取权限';
      renderMetaOnly(msg);
      return;
    }

    if (isBinaryMeta) {
      renderMetaOnly('二进制文件，仅显示元数据。');
      return;
    }

    const content = file.contentForView || '';
    sourceEl.textContent = content;

    if (mode === 'source') {
      sourceEl.hidden = false;
      previewEl.hidden = true;
      previewEl.textContent = '';
    } else {
      sourceEl.hidden = true;
      previewEl.hidden = false;
      // $simpleMd escapes all text nodes — safe for innerHTML
      previewEl.innerHTML = SP.$simpleMd(content) || '<div class="file-empty">（空文件）</div>';
    }
  }

  function applyFilesMobileLayout() {
    const layout = document.getElementById('files-layout');
    const narrow = window.matchMedia('(max-width: 1100px)').matches;
    layout.classList.remove('show-tree', 'show-viewer');
    if (!narrow) return;
    layout.classList.add(filesMobileMode === 'viewer' ? 'show-viewer' : 'show-tree');
  }

  /* ---------- instances ---------- */
  function renderInstances() {
    const list = document.getElementById('instances-list');
    const instances = detail.instances || [];
    if (!instances.length) {
      list.innerHTML = '<div class="file-empty">无实例</div>';
      return;
    }
    list.innerHTML = instances.map(inst => {
      const detailInst = SP.getInstanceDetail(inst.id) || inst;
      const perm = detailInst.permission || SP.getInstancePermission(inst.id);
      const write = perm && perm.writeAccess;
      const missing = inst.lifecycleStatus === 'missing';
      return `<div class="sd-row" data-instance-id="${SP.$escape(inst.id)}">
        <div class="grow">
          <div><strong>${SP.$escape(hostLabel(inst.hostType))}</strong>
            ${inst.isPrimary ? ' <span class="sd-pill ok"><i></i>主实例</span>' : ''}
            ${missing ? ' <span class="sd-pill danger"><i></i>Missing</span>' : ''}
            ${write ? ' <span class="sd-pill ok"><i></i>可写</span>' : ' <span class="sd-pill"><i></i>只读</span>'}
          </div>
          <div class="meta">${SP.$escape(inst.skillFilePath || inst.rootPath || '—')}</div>
          <div class="sub" style="font-size:11px;color:var(--meta);margin-top:2px">
            文件 ${detailInst.fileCount || 0} · ${fmtBytes(detailInst.packageSizeBytes)} · ${SP.$escape(inst.installedVersion || '—')}
          </div>
        </div>
        <div class="row-actions">
          ${!inst.isPrimary && !missing ? `<button type="button" class="btn" data-set-primary="${SP.$escape(inst.id)}">设为主实例</button>` : ''}
          <button type="button" class="btn" data-view-files="${SP.$escape(inst.id)}">查看文件</button>
          ${!write && !missing ? `<button type="button" class="btn" data-req-write="${SP.$escape(inst.id)}">申请写权限</button>` : ''}
          ${missing ? `<button type="button" class="btn" data-open-relink="${SP.$escape(inst.id)}">重新绑定</button>` : ''}
          <button type="button" class="btn" data-detach="${SP.$escape(inst.id)}">解除管理</button>
        </div>
      </div>`;
    }).join('');
  }

  /* ---------- source ---------- */
  function renderSource() {
    const body = document.getElementById('source-body');
    const source = SP.getAssetSourceBinding(assetId) || detail.source || {};
    if (!source.bound) {
      body.innerHTML = `
        <div class="sd-block">
          <div class="label">来源绑定</div>
          <div class="value">未绑定</div>
          <div class="sub">${SP.$escape(source.message || '此 Skill 没有来源仓库绑定。')}</div>
        </div>`;
      return;
    }
    const updateAvail = source.updateStatus === 'available';
    body.innerHTML = `
      <div class="sd-grid">
        ${block('绑定状态', '已绑定')}
        ${block('来源类型', source.sourceType || '—')}
        ${block('仓库', source.repository || '—')}
        ${block('来源 URL', source.sourceUrl || '—')}
        ${block('已安装版本', source.installedVersion || detail.version || '—')}
        ${block('远端版本', source.remoteVersion || '—')}
        ${block('远端 Commit', source.remoteCommit || '—')}
        ${block('更新状态', source.updateStatus || '—')}
        ${block('上次检查', source.lastCheckedAt ? SP.$timeAgo(source.lastCheckedAt) : '—')}
      </div>
      ${updateAvail ? `<div style="margin-top:14px"><button type="button" class="btn btn-primary" id="btn-view-update">查看更新</button>
        <span style="font-size:12px;color:var(--muted);margin-left:8px">原型仅展示，不执行应用</span></div>` : ''}`;

    const btn = document.getElementById('btn-view-update');
    if (btn) {
      btn.addEventListener('click', () => toast('已打开更新预览（原型 · 未应用）'));
    }
  }

  /* ---------- permissions ---------- */
  function renderPermissions() {
    const list = document.getElementById('perm-list');
    const instances = detail.instances || [];
    const rows = [];

    instances.forEach(inst => {
      const perm = SP.getInstancePermission(inst.id);
      if (!perm) return;
      const grants = perm.grants || [];
      if (!grants.length) {
        rows.push(`<div class="sd-row">
          <div class="grow">
            <div><strong>${SP.$escape(hostLabel(inst.hostType))}</strong> · 无有效授权</div>
            <div class="meta">${SP.$escape(inst.rootPath || '—')} · 模式 ${SP.$escape(perm.permissionMode)}</div>
          </div>
          <div class="row-actions">
            ${inst.lifecycleStatus !== 'missing' ? `<button type="button" class="btn" data-req-write="${SP.$escape(inst.id)}">申请写权限</button>` : ''}
          </div>
        </div>`);
        return;
      }
      grants.forEach(g => {
        rows.push(`<div class="sd-row" data-grant-id="${SP.$escape(g.id)}">
          <div class="grow">
            <div><strong>${SP.$escape(hostLabel(inst.hostType))}</strong>
              · ${SP.$escape(g.scopeType === 'directory' ? '目录' : '实例')}
              · ${g.writeAccess ? '读写' : '只读'}
            </div>
            <div class="meta">${SP.$escape(g.scopePath || inst.skillFilePath || '—')}</div>
            <div style="font-size:11px;color:var(--meta);margin-top:2px">
              授予于 ${g.grantedAt ? SP.$timeAgo(g.grantedAt) : '—'}
              ${g.purpose ? ' · ' + SP.$escape(g.purpose) : ''}
            </div>
          </div>
          <div class="row-actions">
            ${g.writeAccess && g.status === 'active' ? `<button type="button" class="btn" data-revoke="${SP.$escape(g.id)}">撤销写权限</button>` : ''}
          </div>
        </div>`);
      });
    });

    list.innerHTML = rows.length ? rows.join('') : '<div class="file-empty">暂无权限记录</div>';
  }

  /* ---------- usage ---------- */
  function renderUsage() {
    const body = document.getElementById('usage-body');
    const usage = SP.getAssetUsageSummary(assetId) || detail.usage || {};

    let statusLine = '';
    if (usage.dataStatus === 'unsupported' || !usage.supported) {
      statusLine = '暂无数据（当前宿主无可靠使用适配器）';
    } else if (usage.dataStatus === 'zero') {
      statusLine = '0 次调用（适配器可用，窗口内无记录）';
    } else {
      statusLine = `有数据 · ${usage.displayLabel || usage.calls || 0} 次调用`;
    }

    const trend = usage.trend || [];
    const max = Math.max(...trend, 1);
    const bars = trend.length
      ? `<div class="trend-bars" aria-hidden="true">${trend.map(v => `<i style="height:${Math.max(2, (v / max) * 100)}%"></i>`).join('')}</div>`
      : '<div class="file-empty">无趋势数据</div>';

    body.innerHTML = `
      <div class="sd-grid" style="margin-bottom:16px">
        ${block('状态', statusLine)}
        ${block('调用次数', usage.displayLabel != null ? String(usage.displayLabel) : '—')}
        ${block('会话数', usage.sessions != null ? String(usage.sessions) : '—')}
        ${block('归因级别', ATTR_LABELS[usage.attributionLevel] || usage.attributionLevel || '—')}
        ${block('归因比例', usage.attributionRatio != null ? Math.round(usage.attributionRatio * 100) + '%' : '—')}
        ${block('输入 / 输出 Token', usage.inputTokens != null ? `${SP.$safeLocale(usage.inputTokens)} / ${SP.$safeLocale(usage.outputTokens || 0)}` : '—')}
        ${block('总 Token', usage.totalTokens != null ? SP.$safeLocale(usage.totalTokens) : '—')}
        ${block('来源宿主', hostLabel(usage.sourceHost))}
      </div>
      <div class="sd-section">
        <h3>近 14 天趋势</h3>
        ${bars}
        <div style="font-size:11px;color:var(--meta);margin-top:6px">柱高表示当日调用次数 · 只读展示</div>
      </div>`;
  }

  /* ---------- activity ---------- */
  function renderActivity() {
    const filter = vs.activityFilter || 'all';
    document.querySelectorAll('#activity-filters [data-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    const events = SP.getAssetAuditEvents(assetId, { filter });
    const list = document.getElementById('activity-list');
    if (!events.length) {
      list.innerHTML = '<div class="file-empty">暂无活动记录</div>';
      return;
    }
    list.innerHTML = events.map(e => {
      const typeLabel = e.eventType || '—';
      const note = e.note || '';
      return `<div class="sd-row">
        <div class="grow">
          <div><strong>${SP.$escape(typeLabel)}</strong>
            <span class="sd-pill" style="margin-left:6px">${SP.$escape(e.category || '—')}</span>
            ${e.result ? `<span class="sd-pill" style="margin-left:4px">${SP.$escape(e.result)}</span>` : ''}
          </div>
          <div style="font-size:12px;color:var(--fg-2);margin-top:2px">${SP.$escape(note)}</div>
          <div class="meta">${SP.$escape(e.source || '')} · ${e.time ? SP.$timeAgo(e.time) : '—'}</div>
        </div>
      </div>`;
    }).join('');
  }

  /* ---------- snapshots ---------- */
  function renderSnapshots() {
    const filter = vs.snapshotFilter || 'all';
    document.querySelectorAll('#snapshot-filters [data-type]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === filter);
    });

    const snaps = SP.getAssetSnapshots(assetId, { type: filter === 'all' ? undefined : filter });
    const list = document.getElementById('snap-list');
    if (!snaps.length) {
      list.innerHTML = '<div class="file-empty">尚无快照</div>';
      return;
    }
    list.innerHTML = snaps.map(sn => {
      const typeLabel = SNAP_TYPE_LABELS[sn.type] || sn.type || '快照';
      return `<div class="sd-row" data-snap-id="${SP.$escape(sn.id)}">
        <div class="grow">
          <div><strong>${SP.$escape(sn.note || typeLabel)}</strong>
            <span class="sd-pill" style="margin-left:6px">${SP.$escape(typeLabel)}</span>
            ${sn.retained ? '<span class="sd-pill ok" style="margin-left:4px"><i></i>保留</span>' : ''}
          </div>
          <div class="meta">${sn.createdAt ? SP.$timeAgo(sn.createdAt) : '—'} · ${sn.fileCount || 0} 文件 · ${fmtBytes(sn.packageSizeBytes)} · ${SP.$escape(sn.source || '')}</div>
        </div>
        <div class="row-actions">
          <button type="button" class="btn" data-toggle-retain="${SP.$escape(sn.id)}" data-retained="${sn.retained ? '1' : '0'}">${sn.retained ? '取消保留' : '标记保留'}</button>
          <button type="button" class="btn" data-restore-snap="${SP.$escape(sn.id)}">恢复…</button>
        </div>
      </div>`;
    }).join('');
  }

  /* ---------- full render ---------- */
  function render() {
    if (!reloadDetail()) {
      document.getElementById('not-found').hidden = false;
      document.getElementById('detail-content').hidden = true;
      return;
    }
    document.getElementById('not-found').hidden = true;
    document.getElementById('detail-content').hidden = false;
    updateSidebar();
    renderHeader();
    setTab(vs.tab || 'overview');

    if (vs.scrollTop && !restoringScroll) {
      restoringScroll = true;
      requestAnimationFrame(() => {
        const sc = document.getElementById('detail-scroll');
        if (sc) sc.scrollTop = vs.scrollTop || 0;
        restoringScroll = false;
      });
    }
  }

  /* ---------- actions ---------- */
  function openEdit() {
    const primary = primaryInstance();
    if (!primary || primary.lifecycleStatus === 'missing') {
      toast('没有可用实例，请先 Relink');
      return;
    }
    if (!hasReadAccess(primary.id)) {
      toast('需要读取权限');
      return;
    }
    const canWrite = hasWriteAccess(primary.id);
    const mode = canWrite ? 'editable' : 'read-only';
    const session = SP.openEditorSession({ assetId, instanceId: primary.id, mode });
    if (!session || !session.ok) {
      toast((session && session.blockedReason) || '无法打开 Editor');
      return;
    }
    if (!canWrite) toast('只读');
    SP.openSkillEditor(assetId, { instanceId: primary.id, mode: session.mode });
  }

  function requestShowInFinder() {
    const primary = primaryInstance();
    const folderBtn = document.getElementById('btn-folder');
    if (folderBtn && folderBtn.disabled) {
      toast('无法请求打开 Finder');
      return;
    }
    if (!primary || primary.lifecycleStatus === 'missing') {
      toast('Missing 实例无法在 Finder 中显示');
      return;
    }
    const path = primary.skillFilePath || primary.rootPath;
    if (!path) {
      toast('没有有效路径');
      return;
    }
    // Prototype only: never claim the real Finder already opened.
    toast('已请求打开');
  }

  function copyInvocation() {
    const text = detail.invocation || ('/' + detail.name);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('已复制调用名')).catch(() => toast(text));
    } else {
      toast(text);
    }
  }

  function openRelink(instanceId) {
    const inst = detail.instances.find(i => i.id === instanceId) ||
      detail.instances.find(i => i.lifecycleStatus === 'missing');
    if (!inst) {
      toast('没有可重新绑定的 Missing 实例');
      return;
    }
    relinkInstanceId = inst.id;
    selectedCandidate = null;
    window.__relinkExtraConfirmed = false;
    document.getElementById('relink-orig-path').textContent = inst.skillFilePath || inst.rootPath || '—';
    const cands = SP.getRelinkCandidates(inst.id);
    const list = document.getElementById('relink-candidates');
    if (!cands.length) {
      list.innerHTML = '<div class="file-empty">无候选路径</div>';
    } else {
      list.innerHTML = cands.map((c, idx) => {
        const ev = c.evidence || {};
        const evParts = [
          ev.nameMatch ? '名称匹配' : null,
          ev.skillMdHashMatch ? 'SKILL.md 哈希匹配' : null,
          ev.packageHashMatch ? '包哈希匹配' : null,
          ev.sourceBindingMatch ? '来源匹配' : null,
          ev.structureMatch ? '结构匹配' : null
        ].filter(Boolean);
        return `<div class="cand-item" data-cand-idx="${idx}" role="button" tabindex="0">
          <div class="path">${SP.$escape(c.path)}</div>
          <div class="ev">${SP.$escape(hostLabel(c.hostType))} · 置信度 ${SP.$escape(c.confidence || '—')} · ${SP.$escape(evParts.join(' · ') || '无证据')}</div>
        </div>`;
      }).join('');
      list.querySelectorAll('.cand-item').forEach(el => {
        el.addEventListener('click', () => {
          list.querySelectorAll('.cand-item').forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
          selectedCandidate = cands[Number(el.dataset.candIdx)];
          window.__relinkExtraConfirmed = false;
          updateRelinkControls();
        });
      });
    }
    updateRelinkControls();
    showModal('relink-modal');
  }

  function evidenceHint(candidate) {
    if (!candidate) return '请选择候选路径';
    const conf = candidate.confidence || 'low';
    const ev = candidate.evidence || {};
    const parts = [
      ev.nameMatch ? '名称' : null,
      ev.skillMdHashMatch ? 'SKILL.md 哈希' : null,
      ev.packageHashMatch ? '包哈希' : null,
      ev.sourceBindingMatch ? '来源' : null,
      ev.structureMatch ? '结构' : null
    ].filter(Boolean);
    const confLabel = conf === 'high' ? '高' : conf === 'medium' ? '中' : '低';
    let action = '';
    if (conf === 'high') action = '可重新绑定或作为新实例添加';
    else if (conf === 'medium') action = window.__relinkExtraConfirmed
      ? '已确认 · 可重新绑定或作为新实例添加'
      : '中等置信度需再次确认后才能重新绑定；可作为新实例添加';
    else action = '低置信度仅允许作为新实例添加';
    return `置信度 ${confLabel} · 证据：${parts.join('、') || '无'} · ${action}`;
  }

  function updateRelinkControls() {
    const rebindBtn = document.getElementById('relink-rebind');
    const addBtn = document.getElementById('relink-add-new');
    const hint = document.getElementById('relink-hint');
    const cand = selectedCandidate;
    const conf = cand ? (cand.confidence || 'low') : null;
    const hasEvidence = !!(cand && cand.evidence);

    if (hint) hint.textContent = evidenceHint(cand);

    if (!cand) {
      if (rebindBtn) rebindBtn.disabled = true;
      if (addBtn) addBtn.disabled = true;
      return;
    }

    if (addBtn) addBtn.disabled = false;

    if (!hasEvidence || conf === 'low') {
      if (rebindBtn) rebindBtn.disabled = true;
    } else if (conf === 'medium') {
      if (rebindBtn) rebindBtn.disabled = false;
      if (rebindBtn) rebindBtn.textContent = window.__relinkExtraConfirmed ? '重新绑定' : '确认并重新绑定';
    } else {
      if (rebindBtn) {
        rebindBtn.disabled = false;
        rebindBtn.textContent = '重新绑定';
      }
    }
    if (conf !== 'medium' && rebindBtn) rebindBtn.textContent = '重新绑定';
  }

  function doRelink(mode) {
    if (!relinkInstanceId) return;
    if (!selectedCandidate || !selectedCandidate.id) {
      toast('请先选择候选路径');
      return;
    }

    if (mode === 'rebind') {
      const conf = selectedCandidate.confidence || 'low';
      if (conf === 'low' || !selectedCandidate.evidence) {
        toast('低置信度或不含证据，无法重新绑定');
        return;
      }
      if (conf === 'medium' && !window.__relinkExtraConfirmed) {
        const ok = window.confirm('中等置信度重新绑定需额外确认。是否继续？');
        if (!ok) return;
        window.__relinkExtraConfirmed = true;
        updateRelinkControls();
      }
    }

    const res = SP.relinkInstance({
      instanceId: relinkInstanceId,
      mode,
      candidateId: selectedCandidate.id,
      candidate: selectedCandidate,
      evidence: selectedCandidate.evidence,
      confidence: selectedCandidate.confidence,
      userConfirmed: true,
      extraConfirmed: mode === 'rebind' && selectedCandidate.confidence === 'medium' ? !!window.__relinkExtraConfirmed : undefined
    });
    closeAllModals();
    window.__relinkExtraConfirmed = false;
    if (res && res.ok) {
      toast(mode === 'rebind' ? '已重新绑定（UUID 保留）' : '已添加新实例（原 Missing 保留）');
      if (res.newInstanceId) persist({ selectedInstanceId: res.newInstanceId });
      render();
    } else {
      toast((res && res.error) || '重新绑定失败');
    }
  }

  function openPermModal(instanceId, scopeType) {
    const inst = detail.instances.find(i => i.id === instanceId) || selectedInstance();
    if (!inst) {
      toast('请选择实例');
      return;
    }
    if (inst.lifecycleStatus === 'missing') {
      toast('Missing 实例无法授予写权限');
      return;
    }
    permPending = { instanceId: inst.id, scopeType: scopeType || 'instance' };
    document.getElementById('perm-title').textContent =
      scopeType === 'directory' ? '申请目录写权限' : '申请实例写权限';
    document.getElementById('perm-desc').textContent =
      scopeType === 'directory'
        ? '将对该目录下所有匹配实例授予写权限。'
        : '仅对所选实例授予写权限。';
    document.getElementById('perm-body').innerHTML = `
      <p>实例：<strong>${SP.$escape(hostLabel(inst.hostType))}</strong></p>
      <p class="mono" style="font-size:12px">${SP.$escape(inst.rootPath || inst.skillFilePath || '—')}</p>
      <p style="margin-top:8px;font-size:12px;color:var(--muted)">范围：${scopeType === 'directory' ? '目录' : '实例'}</p>`;
    showModal('perm-modal');
  }

  function confirmPerm() {
    if (!permPending) return;
    const res = SP.requestWritePermission({
      instanceId: permPending.instanceId,
      scopeType: permPending.scopeType,
      purpose: '编辑与应用更改'
    });
    closeAllModals();
    permPending = null;
    if (res && res.ok) {
      toast('已授予写权限');
      render();
    } else {
      toast((res && res.error) || '授权失败');
    }
  }

  function openArchive() {
    const count = (detail.instances || []).length;
    document.getElementById('arch-body').innerHTML = `
      <p><strong>${SP.$escape(detail.displayName || detail.name)}</strong></p>
      <ul>
        <li>将归档整个 Asset（含全部 ${count} 个实例的管理记录）</li>
        <li>技术名：${SP.$escape(detail.name)}</li>
        <li>主路径：${SP.$escape(detail.primaryPath || '—')}</li>
        <li>不会删除宿主上的实际文件</li>
        <li>归档只改管理状态：不移动宿主文件；创建完整 Package Snapshot；可从 Library → 已归档 恢复管理生命周期</li>
      </ul>`;
    showModal('arch-modal');
  }

  function openRestoreModal() {
    document.getElementById('restore-body').innerHTML = `
      <p>Skill：<strong>${SP.$escape(detail.displayName || detail.name)}</strong></p>
      <ul style="margin-top:10px;font-size:13px;line-height:1.55;color:var(--fg-2)">
        <li>不移动宿主文件</li>
        <li>不覆盖实例内容</li>
        <li>Missing 保持 Missing</li>
        <li>有可用实例 → Available</li>
        <li>全部 Missing → 仍 Missing</li>
      </ul>`;
    showModal('restore-modal');
  }

  function openDetach(instanceId) {
    const inst = detail.instances.find(i => i.id === instanceId);
    if (!inst) return;
    detachPendingId = instanceId;
    document.getElementById('detach-body').innerHTML = `
      <p>将解除对以下实例的管理：</p>
      <p><strong>${SP.$escape(hostLabel(inst.hostType))}</strong></p>
      <p class="mono" style="font-size:12px;margin-top:6px">${SP.$escape(inst.skillFilePath || inst.rootPath || '—')}</p>
      <p style="margin-top:10px;color:var(--warn-text);font-size:13px">不会删除宿主文件，仅移除 Skill Panel 索引与关联文件记录。</p>`;
    showModal('detach-modal');
  }

  /* ---------- event wiring ---------- */
  function bindEvents() {
    document.getElementById('btn-back').addEventListener('click', e => {
      e.preventDefault();
      SP.returnToOrigin('index.html');
    });

    document.getElementById('btn-edit').addEventListener('click', openEdit);
    document.getElementById('btn-fav').addEventListener('click', () => {
      const summary = SP.toggleFavorite(assetId);
      toast(summary && summary.isFavorite ? '已收藏' : '已取消收藏');
      render();
    });
    document.getElementById('btn-folder').addEventListener('click', requestShowInFinder);
    document.getElementById('btn-copy-inv').addEventListener('click', copyInvocation);
    document.getElementById('btn-update').addEventListener('click', () => toast('已打开更新预览（原型 · 未应用）'));
    document.getElementById('btn-relink').addEventListener('click', () => openRelink(null));
    document.getElementById('btn-archive').addEventListener('click', openArchive);
    document.getElementById('btn-restore-top').addEventListener('click', openRestoreModal);
    const btnRestoreBind = document.getElementById('btn-restore');
    if (btnRestoreBind) btnRestoreBind.addEventListener('click', openRestoreModal);

    document.getElementById('btn-more').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('more-panel').classList.toggle('open');
    });
    document.addEventListener('click', () => {
      document.getElementById('more-panel').classList.remove('open');
    });
    document.querySelectorAll('#more-panel button').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'copy-inv') copyInvocation();
        else if (act === 'update') toast('已打开更新预览（原型 · 未应用）');
        else if (act === 'relink') openRelink(null);
        else if (act === 'archive') openArchive();
        else if (act === 'restore') openRestoreModal();
      });
    });

    document.querySelectorAll('#detail-tabs [data-tab]').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    // Overview task resolve (delegated)
    document.getElementById('panel-overview').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-resolve-task]');
      if (!btn) return;
      const id = btn.dataset.resolveTask;
      SP.resolveTask(id);
      toast('已标记处理');
      render();
    });

    // Files
    document.getElementById('instance-switch').addEventListener('change', (e) => {
      persist({ selectedInstanceId: e.target.value, selectedFileId: null });
      renderFiles();
    });
    document.getElementById('files-mobile-toggle').addEventListener('click', () => {
      filesMobileMode = filesMobileMode === 'tree' ? 'viewer' : 'tree';
      applyFilesMobileLayout();
    });
    document.getElementById('file-view-source-btn').addEventListener('click', () => {
      persist({ fileViewMode: 'source' });
      renderFileViewer();
    });
    document.getElementById('file-view-preview-btn').addEventListener('click', () => {
      persist({ fileViewMode: 'preview' });
      renderFileViewer();
    });
    document.getElementById('btn-copy-path').addEventListener('click', () => {
      const file = vs.selectedFileId ? SP.getFileDetail(vs.selectedFileId) : null;
      const path = file ? (file.relativePath || '') : '';
      if (!path) { toast('未选择文件'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(path).then(() => toast('路径已复制')).catch(() => toast(path));
      } else toast(path);
    });
    document.getElementById('btn-copy-content').addEventListener('click', () => {
      const file = vs.selectedFileId ? SP.getFileDetail(vs.selectedFileId) : null;
      if (!file) { toast('未选择文件'); return; }
      if (file.isBinary || file.fileType === 'binary') { toast('二进制文件无可复制文本'); return; }
      const content = file.contentForView || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(() => toast('内容已复制')).catch(() => toast('复制失败'));
      } else toast('复制失败');
    });

    // Instances panel delegated
    document.getElementById('panel-instances').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.setPrimary) {
        const res = SP.setPrimaryInstance(assetId, t.dataset.setPrimary);
        toast(res && res.ok ? '已设为主实例' : ((res && res.error) || '设置失败'));
        render();
      } else if (t.dataset.viewFiles) {
        persist({ selectedInstanceId: t.dataset.viewFiles, tab: 'files', selectedFileId: null });
        setTab('files');
      } else if (t.dataset.reqWrite) {
        openPermModal(t.dataset.reqWrite, 'instance');
      } else if (t.dataset.openRelink) {
        openRelink(t.dataset.openRelink);
      } else if (t.dataset.detach) {
        openDetach(t.dataset.detach);
      }
    });

    // Permissions panel
    document.getElementById('btn-req-inst-write').addEventListener('click', () => {
      const inst = selectedInstance();
      openPermModal(inst ? inst.id : null, 'instance');
    });
    document.getElementById('btn-req-dir-write').addEventListener('click', () => {
      const inst = selectedInstance();
      openPermModal(inst ? inst.id : null, 'directory');
    });
    document.getElementById('panel-permissions').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.reqWrite) openPermModal(t.dataset.reqWrite, 'instance');
      if (t.dataset.revoke) {
        const res = SP.revokeWritePermission(t.dataset.revoke);
        toast(res && res.ok ? '已撤销写权限' : ((res && res.error) || '撤销失败'));
        render();
      }
    });

    // Activity filters
    document.getElementById('activity-filters').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      persist({ activityFilter: btn.dataset.filter });
      renderActivity();
    });

    // Snapshot filters + actions
    document.getElementById('snapshot-filters').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      persist({ snapshotFilter: btn.dataset.type });
      renderSnapshots();
    });
    document.getElementById('panel-snapshots').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.toggleRetain) {
        const next = t.dataset.retained !== '1';
        SP.setSnapshotRetained(t.dataset.toggleRetain, next);
        toast(next ? '已标记保留' : '已取消保留');
        renderSnapshots();
      } else if (t.dataset.restoreSnap) {
        toast('快照恢复为占位（原型 · 未执行）');
      }
    });

    // Modals
    document.getElementById('relink-cancel').addEventListener('click', closeAllModals);
    document.getElementById('relink-rebind').addEventListener('click', () => doRelink('rebind'));
    document.getElementById('relink-add-new').addEventListener('click', () => doRelink('add-new'));

    document.getElementById('perm-cancel').addEventListener('click', closeAllModals);
    document.getElementById('perm-confirm').addEventListener('click', confirmPerm);

    document.getElementById('arch-cancel').addEventListener('click', closeAllModals);
    document.getElementById('arch-confirm').addEventListener('click', () => {
      SP.archiveSkill(assetId, '手动归档');
      closeAllModals();
      toast('已归档');
      setTimeout(() => SP.returnToOrigin('index.html'), 600);
    });

    document.getElementById('restore-cancel').addEventListener('click', closeAllModals);
    document.getElementById('restore-ok').addEventListener('click', () => {
      const res = SP.restoreSkill(assetId);
      closeAllModals();
      if (res) {
        reloadDetail();
        const life = detail ? detail.lifecycleStatus : (res.lifecycleStatus || '—');
        const avail = detail && detail.instanceSummary ? detail.instanceSummary.available : '—';
        const missing = detail && detail.instanceSummary ? detail.instanceSummary.missing : '—';
        toast(`已恢复 · 生命周期 ${life} · 可用 ${avail} · Missing ${missing}`);
        render();
      } else {
        toast('恢复失败');
      }
    });

    document.getElementById('detach-cancel').addEventListener('click', closeAllModals);
    document.getElementById('detach-confirm').addEventListener('click', () => {
      if (!detachPendingId) return;
      const res = SP.detachInstance(detachPendingId);
      detachPendingId = null;
      closeAllModals();
      if (res && res.ok) {
        toast('已解除管理（文件未删除）');
        if (res.remainingCount === 0) {
          setTimeout(() => SP.returnToOrigin('index.html'), 600);
        } else {
          render();
        }
      } else {
        toast((res && res.error) || '解除失败');
      }
    });

    // Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });

    // Click backdrop to close
    ['relink-modal', 'perm-modal', 'arch-modal', 'restore-modal', 'detach-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        if (e.target === el) closeAllModals();
      });
    });

    // Scroll persist
    const sc = document.getElementById('detail-scroll');
    let scrollTimer = null;
    sc.addEventListener('scroll', () => {
      if (restoringScroll) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        persist({ scrollTop: sc.scrollTop });
      }, 120);
    });

    // Resize: reset files layout when wide
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!window.matchMedia('(max-width: 1100px)').matches) {
          filesMobileMode = 'tree';
          document.getElementById('files-layout').classList.remove('show-tree', 'show-viewer');
        } else {
          applyFilesMobileLayout();
        }
      }, 100);
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    updateSidebar();
    const params = new URLSearchParams(location.search);
    const raw = params.get('skill');
    if (!raw) {
      document.getElementById('not-found').hidden = false;
      document.getElementById('detail-content').hidden = true;
      return;
    }

    const resolved = SP.resolveAssetId(raw) || raw;
    assetId = resolved;
    detail = SP.getAssetDetail(assetId);

    if (!detail) {
      document.getElementById('not-found').hidden = false;
      document.getElementById('detail-content').hidden = true;
      return;
    }

    // Bootstrap view state for this asset
    const patch = { assetId };
    if (!vs.assetId || vs.assetId !== assetId) {
      // Switching assets: keep tab if same session intent, reset file selection when asset changes
      patch.selectedFileId = null;
      patch.expandedFileNodes = [];
      patch.scrollTop = 0;
    }
    if (!vs.tab || !TABS.includes(vs.tab)) patch.tab = 'overview';
    if (!vs.selectedInstanceId || !detail.instances.some(i => i.id === vs.selectedInstanceId)) {
      const p = detail.instances.find(i => i.isPrimary) || detail.instances[0];
      patch.selectedInstanceId = p ? p.id : null;
    }
    if (!vs.fileViewMode) patch.fileViewMode = 'preview';
    persist(patch);
    syncUrl();

    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
