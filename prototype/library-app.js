/* Phase C Library page controller — depends on window.SP */
(function () {
  const SECTION_TITLES = {
    all: '全部 Skill', categories: '分类', favorites: '收藏', recent: '最近',
    updates: '可更新', missing: 'Missing', archive: 'Archive', 'scan-changes': '扫描变化'
  };
  const COL_LABELS = {
    select: '选择', skill: 'Skill', status: '状态', category: '分类', instances: '实例',
    source: '来源', version: '版本', lastUsed: '最近使用', lastModified: '最近修改',
    usage: '使用次数', token: 'Token', actions: '操作'
  };

  let vs = SP.getLibraryViewState();
  let checked = new Set();
  let categoryId = vs.categoryId || null;
  let pendingBatch = null;
  let restoringScroll = false;

  function persist(patch) {
    // Only send the delta. setLibraryViewState already merges with the
    // authoritative viewState in storage — spreading the in-memory `vs`
    // would clobber newer fields (e.g. scrollTop set via SP API).
    vs = SP.setLibraryViewState(patch || {});
    if (Object.prototype.hasOwnProperty.call(vs, 'categoryId')) categoryId = vs.categoryId || null;
    return vs;
  }

  function syncUrl() {
    const params = new URLSearchParams();
    // Preserve non-library flags (e.g. ?dev=1) while mirroring viewState.
    const cur = new URLSearchParams(location.search);
    if (cur.get('dev')) params.set('dev', cur.get('dev'));
    if (vs.section && vs.section !== 'all') params.set('section', vs.section);
    if (vs.viewMode && vs.viewMode !== 'table') params.set('view', vs.viewMode);
    if (vs.search) params.set('q', vs.search);
    if (vs.selectedAssetId) params.set('select', vs.selectedAssetId);
    if (categoryId) params.set('cat', categoryId);
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  function readUrlOnce() {
    // Single source of truth: viewStates.library (localStorage).
    // URL is a writable mirror via syncUrl. Bootstrap from URL at most once per tab
    // so stale ?q= after reset/reload cannot overwrite a cleared viewState.
    const params = new URLSearchParams(location.search);
    const patch = {};
    const bootKey = 'sp-library-url-boot';
    const allowBootstrap = !sessionStorage.getItem(bootKey);
    if (allowBootstrap) {
      if (params.get('section')) patch.section = params.get('section');
      if (params.get('view')) patch.viewMode = params.get('view');
      if (params.get('q') != null && params.get('q') !== '') patch.search = params.get('q');
      if (params.get('cat')) {
        categoryId = params.get('cat');
        patch.categoryId = categoryId;
      }
      sessionStorage.setItem(bootKey, '1');
    }
    // Deep-link selection always applies.
    if (params.get('select')) {
      patch.selectedAssetId = params.get('select');
      patch.detailOpen = true;
    }
    if (Object.keys(patch).length) persist(patch);
  }

  function currentFilters() {
    const f = Object.assign({}, vs.filters || {});
    // host filters from sidebar merge
    return f;
  }

  function queryOpts() {
    return {
      section: vs.section || 'all',
      categoryId: vs.section === 'categories' ? categoryId : null,
      search: vs.search || '',
      filters: currentFilters(),
      sort: vs.sort || 'recent',
      page: vs.page || 1,
      pageSize: vs.pageSize || 20
    };
  }

  function statusClass(summary) {
    const a = summary.status && summary.status.attention;
    if (a === 'conflict' || a === 'missing-all') return 'danger';
    if (a && a !== 'normal') return 'attn';
    return '';
  }

  function statusText(summary) {
    if (!summary.status) return '—';
    if (summary.instanceSummary && summary.instanceSummary.missingScope === 'partial') return '部分 Missing';
    if (summary.instanceSummary && summary.instanceSummary.missingScope === 'all') return '全部 Missing';
    return summary.status.attentionLabel || '正常';
  }

  function renderSidebar() {
    const counts = SP.getLibraryCounts();
    document.getElementById('nav-lib-count').textContent = counts.all;
    document.getElementById('nav-ins-count').textContent = SP.getArchiveCandidates().length + SP.getDuplicateGroups().length + SP.getFileIssues().length;
    document.getElementById('nav-act-count').textContent = SP.getState().pendingTasks.filter(t => t.status === 'open').length;
    document.getElementById('cnt-all').textContent = counts.all;
    document.getElementById('cnt-fav').textContent = counts.favorites;
    document.getElementById('cnt-recent').textContent = Math.min(50, counts.recent);
    document.getElementById('cnt-updates').textContent = counts.updates;
    document.getElementById('cnt-missing').textContent = counts.missing;
    document.getElementById('cnt-archive').textContent = counts.archive;
    document.getElementById('cnt-scan').textContent = counts.scanChanges;
    document.getElementById('cnt-cats').textContent = counts.categories.length;

    document.querySelectorAll('.lib-side a.sec').forEach(a => {
      a.classList.toggle('active', a.dataset.section === vs.section);
    });

    const catList = document.getElementById('cat-list');
    const showCats = vs.section === 'categories';
    catList.hidden = !showCats;
    if (showCats) {
      const cats = SP.getCategories().filter(c => !c.parentId || true);
      catList.innerHTML = [
        `<a href="#" data-cat="__uncategorized__" class="${categoryId === '__uncategorized__' ? 'active' : ''}">未分类<span>${counts.uncategorized}</span></a>`,
        ...counts.categories.map(c => `<a href="#" data-cat="${SP.$escape(c.id)}" class="${categoryId === c.id ? 'active' : ''}">${SP.$escape(c.name)}<span>${c.count}</span></a>`)
      ].join('');
    }

    // host sidebar checkboxes reflect filters.host
    const hosts = (vs.filters && vs.filters.host) || [];
    document.querySelectorAll('[data-host-filter]').forEach(inp => {
      inp.checked = hosts.includes(inp.dataset.hostFilter);
    });

    const scan = SP.getPendingChangeSetSummary();
    document.getElementById('scan-time').textContent = scan.lastScanAt ? SP.$timeAgo(scan.lastScanAt) : '尚未扫描';
  }

  function renderStatusStrip() {
    const strip = document.getElementById('status-strip');
    const counts = SP.getLibraryCounts();
    const scan = SP.getPendingChangeSetSummary();
    const chips = [];
    if (counts.scanning) chips.push({ cls: 'accent', key: 'scanning', label: '扫描进行中' });
    else if (counts.paused) chips.push({ cls: 'warn', key: 'paused', label: '扫描已暂停' });
    if (counts.scanChanges) chips.push({ cls: 'accent', key: 'scan-changes', label: `待确认变化 ${counts.scanChanges}` });
    if (scan.activeScanStatus === 'partial-failure') chips.push({ cls: 'warn', key: 'partial', label: '部分扫描失败' });
    if (counts.updates) chips.push({ cls: '', key: 'updates', label: `可更新 ${counts.updates}` });
    if (counts.missing) chips.push({ cls: 'warn', key: 'missing', label: `Missing ${counts.missing}` });
    if (counts.conflicts) chips.push({ cls: 'danger', key: 'conflicts', label: `冲突 ${counts.conflicts}` });
    strip.innerHTML = chips.slice(0, 4).map(c => `<button type="button" class="status-chip ${c.cls}" data-chip="${c.key}">${SP.$escape(c.label)}</button>`).join('');
  }

  function renderActiveFilters() {
    const box = document.getElementById('active-filters');
    const f = vs.filters || {};
    const chips = [];
    (f.lifecycle || []).forEach(v => chips.push({ key: 'lifecycle', value: v, label: '生命周期: ' + v }));
    (f.host || []).forEach(v => chips.push({ key: 'host', value: v, label: '宿主: ' + v }));
    (f.updateStatus || []).forEach(v => chips.push({ key: 'updateStatus', value: v, label: '更新: ' + v }));
    (f.health || []).forEach(v => chips.push({ key: 'health', value: v, label: '健康: ' + v }));
    if (f.favorite) chips.push({ key: 'favorite', value: '1', label: '已收藏' });
    if (f.instanceCount) chips.push({ key: 'instanceCount', value: f.instanceCount, label: '实例: ' + f.instanceCount });
    if (f.missingScope) chips.push({ key: 'missingScope', value: f.missingScope, label: 'Missing: ' + f.missingScope });
    if (f.hasUsageData === true) chips.push({ key: 'hasUsageData', value: 'has', label: '有使用数据' });
    if (f.hasUsageData === false) chips.push({ key: 'hasUsageData', value: 'no', label: '暂无使用数据' });
    box.innerHTML = chips.map(c => `<span class="filter-chip">${SP.$escape(c.label)}<button type="button" data-rm-filter="${c.key}" data-rm-value="${SP.$escape(String(c.value))}" aria-label="移除">×</button></span>`).join('')
      + (chips.length ? `<button type="button" class="btn btn-ghost btn-sm" id="clear-chips">清除筛选</button>` : '');
  }

  function renderColsPanel() {
    const panel = document.getElementById('col-settings-panel');
    const visible = vs.visibleColumns || SP.LIBRARY_DEFAULT_COLUMNS.slice();
    panel.innerHTML = '<h4>显示列</h4>' + SP.LIBRARY_ALL_COLUMNS.filter(c => c !== 'select' && c !== 'actions').map(c => {
      const locked = c === 'skill';
      return `<label><input type="checkbox" value="${c}" ${visible.includes(c) ? 'checked' : ''} ${locked ? 'disabled' : ''}/> ${COL_LABELS[c] || c}${locked ? '（固定）' : ''}</label>`;
    }).join('') + '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-primary" id="btn-save-cols">保存</button></div>';
  }

  function highlight(text, q) {
    const raw = String(text || '');
    if (!q) return SP.$escape(raw);
    const lower = raw.toLowerCase();
    const idx = lower.indexOf(q.toLowerCase());
    if (idx < 0) return SP.$escape(raw);
    return SP.$escape(raw.slice(0, idx)) + '<mark>' + SP.$escape(raw.slice(idx, idx + q.length)) + '</mark>' + SP.$escape(raw.slice(idx + q.length));
  }

  function fileHitHtml(item) {
    if (!item.fileHits || !item.fileHits.length) return '';
    const h = item.fileHits[0];
    return `<div class="file-hit"><code>${SP.$escape(h.relativePath)}</code> · ${SP.$escape(h.snippet)} · ${h.matchCount || 1} 处</div>`;
  }

  function renderTable(items) {
    const cols = (vs.visibleColumns || SP.LIBRARY_DEFAULT_COLUMNS.slice()).filter(Boolean);
    const order = ['select', ...cols.filter(c => c !== 'select' && c !== 'actions'), 'actions'].filter((c, i, a) => a.indexOf(c) === i && (c === 'select' || c === 'actions' || cols.includes(c) || c === 'skill'));
    // ensure skill present
    if (!order.includes('skill')) order.splice(1, 0, 'skill');

    const thead = document.getElementById('thead');
    thead.innerHTML = '<tr>' + order.map(c => {
      if (c === 'select') return '<th class="check-col"><input type="checkbox" id="check-all" aria-label="全选" /></th>';
      return `<th data-col="${c}">${COL_LABELS[c] || c}</th>`;
    }).join('') + '</tr>';

    const tbody = document.getElementById('tbody');
    const q = vs.search || '';
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="${order.length}"><div class="empty-block"><h3>${q ? '当前搜索无匹配' : '当前筛选无结果'}</h3><p>${q ? '试试其他关键词，或清除搜索' : '调整筛选条件或切换二级入口'}</p></div></td></tr>`;
      return;
    }

    const expanded = new Set(vs.expandedAssetIds || []);
    const rows = [];
    items.forEach(item => {
      const cells = order.map(c => {
        if (c === 'select') return `<td class="check-col"><input type="checkbox" data-check="${SP.$escape(item.id)}" ${checked.has(item.id) ? 'checked' : ''} aria-label="选择" /></td>`;
        if (c === 'skill') return `<td><div class="name-cell"><strong>${item.isFavorite ? '<span class="star">★</span>' : ''}<button type="button" class="expand-btn" data-expand="${SP.$escape(item.id)}" aria-label="展开实例">${expanded.has(item.id) ? '▾' : '▸'}</button>${highlight(item.displayName || item.name, q)}</strong><span class="desc">${highlight(item.description || '', q)}</span><span class="path">${SP.$escape(item.primaryHostLabel || '')} · ${item.instanceCount} 实例</span>${fileHitHtml(item)}</div></td>`;
        if (c === 'status') return `<td><span class="status-label ${statusClass(item)}">${SP.$escape(statusText(item))}</span></td>`;
        if (c === 'category') return `<td>${SP.$escape((item.categories || []).join(', ') || '—')}</td>`;
        if (c === 'instances') return `<td>${item.instanceCount}（正常 ${item.instanceSummary.available} / Missing ${item.instanceSummary.missing}）</td>`;
        if (c === 'source') return `<td><span class="src-tag">${SP.$escape(item.primaryHostLabel || '—')}</span></td>`;
        if (c === 'version') return `<td>${SP.$escape(item.version || '—')}${item.updateStatus === 'available' ? ' · 可更新' : ''}</td>`;
        if (c === 'lastUsed') return `<td>${item.hasUsageData && item.lastUsedAt ? SP.$timeAgo(item.lastUsedAt) : '<span class="na">暂无数据</span>'}</td>`;
        if (c === 'lastModified') return `<td>${item.lastModifiedAt ? SP.$timeAgo(item.lastModifiedAt) : '—'}</td>`;
        if (c === 'usage') return `<td>${item.hasUsageData ? (item.usage30 ?? 0) : '<span class="na">暂无数据</span>'}</td>`;
        if (c === 'token') return `<td>${item.documentTokenCount != null ? item.documentTokenCount : '—'}</td>`;
        if (c === 'actions') return `<td><div class="row-actions"><button type="button" class="btn btn-ghost btn-sm act-detail" data-id="${SP.$escape(item.id)}">详情</button><button type="button" class="btn btn-ghost btn-sm act-edit" data-id="${SP.$escape(item.id)}">编辑</button></div></td>`;
        return '<td>—</td>';
      }).join('');
      rows.push(`<tr data-id="${SP.$escape(item.id)}" class="${vs.selectedAssetId === item.id ? 'selected' : ''}">${cells}</tr>`);
      if (expanded.has(item.id)) {
        (item.instances || []).forEach(inst => {
          rows.push(`<tr class="instance-row" data-asset="${SP.$escape(item.id)}"><td></td><td colspan="${order.length - 1}"><strong>${SP.$escape(inst.hostType)}</strong> ${inst.isPrimary ? '· 主实例' : ''} · ${SP.$escape(inst.lifecycleStatus)} · ${SP.$escape(inst.permissionMode)} · v${SP.$escape(inst.installedVersion || '')}<div class="inst-path">${SP.$escape(inst.skillFilePath || '')}</div></td></tr>`);
        });
      }
    });
    tbody.innerHTML = rows.join('');
  }

  function renderCards(items) {
    const grid = document.getElementById('cards-grid');
    if (!items.length) {
      grid.innerHTML = `<div class="empty-block"><h3>无结果</h3></div>`;
      return;
    }
    grid.innerHTML = items.map(item => `
      <div class="lib-card ${vs.selectedAssetId === item.id ? 'selected' : ''}" data-id="${SP.$escape(item.id)}">
        <label class="card-check"><input type="checkbox" data-check="${SP.$escape(item.id)}" ${checked.has(item.id) ? 'checked' : ''} /></label>
        <h3>${item.isFavorite ? '<span class="star">★</span>' : ''}${SP.$escape(item.displayName || item.name)}</h3>
        <div class="desc">${SP.$escape(item.description || '')}</div>
        <div><span class="status-label ${statusClass(item)}">${SP.$escape(statusText(item))}</span></div>
        <div class="meta">
          <span>${SP.$escape((item.categories || [])[0] || '未分类')}</span>
          <span>${item.instanceCount} 实例</span>
          <span>${SP.$escape(item.primaryHostLabel || '')}</span>
          <span>${SP.$escape(item.version || '')}</span>
        </div>
        ${fileHitHtml(item)}
      </div>`).join('');
  }

  function renderTree(items) {
    const root = document.getElementById('tree-root');
    const byCat = {};
    items.forEach(item => {
      // One skill node under its primary/first category to keep 1:1 with table/cards.
      const cat = (item.categories && item.categories[0]) || '未分类';
      (byCat[cat] ||= []).push(item);
    });
    let expanded = new Set(vs.expandedTreeNodes || []);
    const catNodeIds = Object.keys(byCat).map(cat => 'cat:' + cat);
    // First visit to tree (no prior tree interaction): expand categories so skills are visible.
    // Use a sentinel so collapsing every category does not re-expand on next render.
    let shouldPersistExpand = false;
    if (!expanded.has('__tree_init__')) {
      expanded.add('__tree_init__');
      catNodeIds.forEach(id => expanded.add(id));
      shouldPersistExpand = true;
    }
    const html = Object.keys(byCat).sort().map(cat => {
      const nodeId = 'cat:' + cat;
      const open = expanded.has(nodeId);
      const skills = byCat[cat];
      return `<div class="tree-node">
        <div class="tree-row" data-tree-toggle="${SP.$escape(nodeId)}"><span>${open ? '▾' : '▸'}</span><strong>${SP.$escape(cat)}</strong><span style="color:var(--meta);margin-left:auto">${skills.length}</span></div>
        <div class="tree-children" ${open ? '' : 'hidden'}>
          ${skills.map(item => {
            const sid = 'skill:' + item.id;
            const sOpen = expanded.has(sid);
            return `<div class="tree-node tree-skill" data-id="${SP.$escape(item.id)}">
              <div class="tree-row ${vs.selectedAssetId === item.id ? 'selected' : ''}" data-select="${SP.$escape(item.id)}" data-tree-toggle="${SP.$escape(sid)}"><span>${sOpen ? '▾' : '▸'}</span>${SP.$escape(item.displayName || item.name)}<span style="color:var(--meta);margin-left:auto">${item.instanceCount}</span></div>
              <div class="tree-children" ${sOpen ? '' : 'hidden'}>
                ${(item.instances || []).map(inst => {
                  const iid = 'inst:' + inst.id;
                  const iOpen = expanded.has(iid);
                  const files = SP.getAssetFiles(item.id).filter(f => f.instanceId === inst.id).slice(0, 5);
                  return `<div class="tree-node">
                    <div class="tree-row" data-tree-toggle="${SP.$escape(iid)}"><span>${iOpen ? '▾' : '▸'}</span>${SP.$escape(inst.hostType)} · ${SP.$escape(inst.lifecycleStatus)}</div>
                    <div class="tree-children" ${iOpen ? '' : 'hidden'}>${files.map(f => `<div class="tree-file">${SP.$escape(f.relativePath)} · ${f.sizeBytes || 0} B</div>`).join('')}</div>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
    root.innerHTML = html || `<div class="empty-block"><h3>无结果</h3></div>`;
    if (shouldPersistExpand) {
      // Persist after DOM write to avoid re-entrant render state mutation.
      vs = SP.setLibraryViewState({ expandedTreeNodes: [...expanded] });
    }
  }

  function renderScanChanges() {
    const panel = document.getElementById('scan-changes-panel');
    const summary = SP.getPendingChangeSetSummary();
    panel.hidden = false;
    if (!summary.pendingChangeSetCount) {
      panel.innerHTML = `<h2>没有待确认的扫描变化</h2><p>完成扫描后，变化会在此汇总等待确认。</p><div style="margin-top:12px"><button type="button" class="btn btn-primary" id="btn-start-scan">开始扫描</button></div>`;
      return;
    }
    panel.innerHTML = `<h2>扫描变化</h2>
      <p>待确认 ChangeSet：<strong>${summary.pendingChangeSetCount}</strong> · 最近扫描 ${summary.lastScanAt ? SP.$timeAgo(summary.lastScanAt) : '—'}</p>
      <div class="stats">
        <div class="stat"><div class="v">${summary.counts.added}</div><div class="l">新增</div></div>
        <div class="stat"><div class="v">${summary.counts.changed}</div><div class="l">变更</div></div>
        <div class="stat"><div class="v">${summary.counts.missing}</div><div class="l">Missing</div></div>
        <div class="stat"><div class="v">${summary.counts.anomalous}</div><div class="l">异常</div></div>
      </div>
      <button type="button" class="btn btn-primary" id="btn-open-changes">查看变化中心</button>`;
  }

  function archiveConfirmBody(ids) {
    const assets = ids.map(id => SP.getAssetSummary(id)).filter(Boolean);
    const totalInstances = assets.reduce((n, a) => n + (a.instanceCount || 0), 0);
    const lines = [
      '归档后，Skill 将从普通 Library 中移除，并保留实例、使用记录、草稿和快照。当前原型不会删除本地文件。',
      '本次操作作用于整个 Asset，当前阶段不支持单实例归档。将文件移动到归档目录属于后续生命周期流程，本次不会执行。'
    ];
    if (assets.length === 1) {
      const a = assets[0];
      lines.push(`将归档「${a.displayName || a.name}」（1 个 Asset · ${a.instanceCount} 个实例）。`);
    } else {
      lines.push(`将归档 ${assets.length} 个 Asset，合计 ${totalInstances} 个实例。`);
    }
    return lines.map(t => `<p>${SP.$escape(t)}</p>`).join('');
  }

  function syncDetailDrawerChrome() {
    const detail = document.getElementById('detail');
    const overlay = document.getElementById('detail-overlay');
    const narrow = window.matchMedia('(max-width:1100px)').matches;
    if (!narrow) {
      detail.classList.remove('drawer-open');
      overlay.classList.remove('show');
      overlay.hidden = true;
      return;
    }
    const open = !!(vs.detailOpen && vs.selectedAssetId);
    detail.classList.toggle('drawer-open', open);
    overlay.classList.toggle('show', open);
    overlay.hidden = !open;
  }

  function closeDetailDrawer() {
    persist({ detailOpen: false });
    syncDetailDrawerChrome();
    renderDetail();
  }

  function renderDetail() {
    const empty = document.getElementById('detail-empty');
    const body = document.getElementById('detail-body');
    const detail = document.getElementById('detail');
    const id = vs.selectedAssetId;
    if (!id) {
      empty.hidden = false; body.hidden = true;
      syncDetailDrawerChrome();
      return;
    }
    const s = SP.getAssetSummary(id);
    if (!s) { empty.hidden = false; body.hidden = true; syncDetailDrawerChrome(); return; }
    empty.hidden = true; body.hidden = false;
    syncDetailDrawerChrome();

    document.getElementById('d-name').textContent = s.displayName || s.name;
    document.getElementById('d-path').textContent = s.primaryPath || '—';
    document.getElementById('d-props').innerHTML = [
      ['生命周期', s.lifecycleStatus],
      ['状态', statusText(s)],
      ['分类', (s.categories || []).join(', ') || '未分类'],
      ['标签', (s.tags || []).join(', ') || '—'],
      ['主实例', (s.primaryHostLabel || '') + ' · ' + (s.version || '')],
      ['来源更新', s.updateStatus + (s.remoteVersion ? ' → ' + s.remoteVersion : '')],
      ['权限', s.status ? s.status.permission : '—'],
      ['文件', s.fileCount + ' · ' + (s.packageSizeBytes || 0) + ' B'],
      ['使用', s.hasUsageData ? (`近30天 ${s.usage30 ?? 0}`) : '暂无数据'],
      ['调用', s.invocation || '']
    ].map(([k, v]) => `<div class="prop"><dt>${SP.$escape(k)}</dt><dd>${SP.$escape(String(v))}</dd></div>`).join('');

    document.getElementById('d-instances').innerHTML = (s.instances || []).map(i => `
      <div class="inst-item"><strong>${SP.$escape(i.hostType)}</strong> ${i.isPrimary ? '· 主' : ''} · ${SP.$escape(i.lifecycleStatus)} · ${SP.$escape(i.permissionMode)}
      <div class="p">${SP.$escape(i.skillFilePath || '')}</div></div>`).join('') || '<div class="na">无实例</div>';

    const tasks = s.pendingTasks || [];
    document.getElementById('d-tasks').innerHTML = tasks.length
      ? `<strong style="font-size:12px;color:var(--meta)">待处理</strong><ul>${tasks.map(t => `<li>${SP.$escape(t.taskType)}</li>`).join('')}</ul>`
      : '';

    const actions = [];
    actions.push(`<button type="button" class="btn btn-sm btn-primary" id="d-open">打开详情</button>`);
    actions.push(`<button type="button" class="btn btn-sm" id="d-edit">编辑</button>`);
    actions.push(`<button type="button" class="btn btn-sm" id="d-fav">${s.isFavorite ? '取消收藏' : '收藏'}</button>`);
    actions.push(`<button type="button" class="btn btn-sm" id="d-copy">复制调用</button>`);
    actions.push(`<button type="button" class="btn btn-sm" id="d-folder">在 Finder 中显示</button>`);
    if (s.updateStatus === 'available') actions.push(`<button type="button" class="btn btn-sm" id="d-update">查看更新</button>`);
    if (s.instanceSummary && s.instanceSummary.missingScope !== 'none') {
      actions.push(`<button type="button" class="btn btn-sm" id="d-relink">查找新位置</button>`);
      actions.push(`<button type="button" class="btn btn-sm" id="d-ignore-hint">忽略提示</button>`);
    }
    if (s.lifecycleStatus === 'archived') actions.push(`<button type="button" class="btn btn-sm" id="d-restore">恢复</button>`);
    else actions.push(`<button type="button" class="btn btn-sm" id="d-archive">归档</button>`);
    document.getElementById('d-actions').innerHTML = actions.join('');
  }

  function renderPager(total) {
    const page = vs.page || 1;
    const size = vs.pageSize || 20;
    const pages = Math.max(1, Math.ceil(total / size));
    const start = total ? (page - 1) * size + 1 : 0;
    const end = Math.min(total, page * size);
    document.getElementById('page-range').textContent = total ? `${start}–${end} / ${total}` : '0';
    document.getElementById('page-label').textContent = `${page} / ${pages}`;
    document.getElementById('prev').disabled = page <= 1;
    document.getElementById('next').disabled = page >= pages;
    document.getElementById('page-size').value = String(size);
  }

  function updateBatch() {
    const bar = document.getElementById('batch-bar');
    document.getElementById('selected-count').textContent = String(checked.size);
    bar.classList.toggle('show', checked.size > 0);
  }

  function setViewModeUI() {
    ['table', 'cards', 'tree'].forEach(m => {
      const btn = document.getElementById('view-' + m);
      const on = vs.viewMode === m;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.getElementById('table-wrap').hidden = vs.viewMode !== 'table';
    document.getElementById('cards-grid').hidden = vs.viewMode !== 'cards';
    document.getElementById('tree-root').hidden = vs.viewMode !== 'tree';
    document.getElementById('btn-cols').style.display = vs.viewMode === 'table' ? '' : 'none';
  }

  function render() {
    renderSidebar();
    renderStatusStrip();
    renderActiveFilters();
    document.getElementById('section-title').textContent = SECTION_TITLES[vs.section] || 'Library';
    document.getElementById('search').value = vs.search || '';
    document.getElementById('sort').value = vs.sort || 'recent';
    setViewModeUI();

    const scanPanel = document.getElementById('scan-changes-panel');
    if (vs.section === 'scan-changes') {
      document.getElementById('table-wrap').hidden = true;
      document.getElementById('cards-grid').hidden = true;
      document.getElementById('tree-root').hidden = true;
      renderScanChanges();
      document.getElementById('result-count').textContent = String(SP.getPendingChangeSetSummary().pendingChangeSetCount);
      renderDetail();
      updateBatch();
      syncUrl();
      return;
    }
    scanPanel.hidden = true;

    const result = SP.queryLibraryAssets(queryOpts());
    document.getElementById('result-count').textContent = String(result.total);
    if (vs.viewMode === 'table') renderTable(result.items);
    else if (vs.viewMode === 'cards') renderCards(result.items);
    else renderTree(result.items);
    renderPager(result.total);
    renderDetail();
    updateBatch();
    syncUrl();

    const pane = document.getElementById('list-pane');
    if (typeof vs.scrollTop === 'number') {
      restoringScroll = true;
      pane.scrollTop = vs.scrollTop;
      // Ignore scroll events caused by programmatic restore / browser clamping.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { restoringScroll = false; });
      });
    }
  }

  function showBatchResults(res) {
    document.getElementById('batch-results-summary').textContent = `成功 ${res.success} · 失败 ${res.failed} · 共 ${res.total}`;
    document.getElementById('batch-results-list').innerHTML = res.results.map(r => {
      const name = (SP.getAssetSummary(r.assetId) || {}).name || r.assetId;
      return `<div class="${r.ok ? 'ok' : 'fail'}">${SP.$escape(name)} — ${r.ok ? '成功' : SP.$escape(r.error || '失败')}</div>`;
    }).join('');
    document.getElementById('batch-results-modal').classList.add('show');
  }

  function collectFiltersFromPanel() {
    const f = {};
    const life = [...document.querySelectorAll('[data-filter-life]:checked')].map(i => i.dataset.filterLife);
    const host = [...document.querySelectorAll('[data-filter-host]:checked')].map(i => i.dataset.filterHost);
    const update = [...document.querySelectorAll('[data-filter-update]:checked')].map(i => i.dataset.filterUpdate);
    const health = [...document.querySelectorAll('[data-filter-health]:checked')].map(i => i.dataset.filterHealth);
    const inst = [...document.querySelectorAll('[data-filter-inst]:checked')].map(i => i.dataset.filterInst);
    const mscope = [...document.querySelectorAll('[data-filter-mscope]:checked')].map(i => i.dataset.filterMscope);
    if (life.length) f.lifecycle = life;
    if (host.length) f.host = host;
    if (update.length) f.updateStatus = update;
    if (health.length) f.health = health;
    if (inst.length === 1) f.instanceCount = inst[0];
    if (mscope.length === 1) f.missingScope = mscope[0];
    if (document.querySelector('[data-filter-fav]:checked')) f.favorite = true;
    const usage = document.querySelector('[data-filter-usage]:checked');
    if (usage) f.hasUsageData = usage.dataset.filterUsage === 'has';
    // merge sidebar hosts
    const sideHosts = [...document.querySelectorAll('[data-host-filter]:checked')].map(i => i.dataset.hostFilter);
    if (sideHosts.length) f.host = [...new Set([...(f.host || []), ...sideHosts])];
    return f;
  }

  function bind() {
    document.getElementById('search').addEventListener('input', e => {
      persist({ search: e.target.value, page: 1 });
      render();
    });
    document.getElementById('sort').addEventListener('change', e => {
      persist({ sort: e.target.value, page: 1 });
      render();
    });
    document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
      persist({ viewMode: btn.dataset.view });
      render();
    }));
    document.querySelectorAll('.lib-side a.sec').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      categoryId = null;
      persist({ section: a.dataset.section, page: 1, selectedAssetId: null });
      render();
    }));
    document.getElementById('cat-list').addEventListener('click', e => {
      const a = e.target.closest('[data-cat]');
      if (!a) return;
      e.preventDefault();
      categoryId = a.dataset.cat;
      persist({ section: 'categories', categoryId, page: 1 });
      render();
    });
    document.getElementById('host-filters').addEventListener('change', () => {
      const f = Object.assign({}, vs.filters || {});
      const hosts = [...document.querySelectorAll('[data-host-filter]:checked')].map(i => i.dataset.hostFilter);
      if (hosts.length) f.host = hosts; else delete f.host;
      persist({ filters: f, page: 1 });
      render();
    });
    document.getElementById('btn-filter').addEventListener('click', () => {
      document.getElementById('filter-panel').classList.toggle('open');
    });
    document.getElementById('btn-apply-filters').addEventListener('click', () => {
      persist({ filters: collectFiltersFromPanel(), page: 1 });
      document.getElementById('filter-panel').classList.remove('open');
      render();
    });
    document.getElementById('btn-clear-filters').addEventListener('click', () => {
      persist({ filters: {}, page: 1 });
      document.querySelectorAll('#filter-panel input').forEach(i => { i.checked = false; });
      document.getElementById('filter-panel').classList.remove('open');
      render();
    });
    document.getElementById('active-filters').addEventListener('click', e => {
      if (e.target.id === 'clear-chips') { persist({ filters: {}, page: 1 }); render(); return; }
      const btn = e.target.closest('[data-rm-filter]');
      if (!btn) return;
      const f = Object.assign({}, vs.filters || {});
      const key = btn.dataset.rmFilter;
      const val = btn.dataset.rmValue;
      if (Array.isArray(f[key])) f[key] = f[key].filter(x => x !== val);
      else delete f[key];
      if (key === 'hasUsageData') delete f.hasUsageData;
      if (key === 'favorite') delete f.favorite;
      persist({ filters: f, page: 1 });
      render();
    });
    document.getElementById('btn-cols').addEventListener('click', () => {
      renderColsPanel();
      document.getElementById('col-settings-panel').classList.toggle('open');
    });
    document.getElementById('col-settings-panel').addEventListener('click', e => {
      if (e.target.id !== 'btn-save-cols') return;
      const cols = ['select', 'skill'];
      document.querySelectorAll('#col-settings-panel input[type=checkbox]').forEach(inp => {
        if (inp.checked && !cols.includes(inp.value)) cols.push(inp.value);
      });
      cols.push('actions');
      persist({ visibleColumns: cols });
      document.getElementById('col-settings-panel').classList.remove('open');
      render();
    });
    document.getElementById('btn-more').addEventListener('click', () => document.getElementById('more-menu').classList.toggle('open'));
    document.getElementById('btn-install').addEventListener('click', () => document.getElementById('install-modal').classList.add('show'));
    document.getElementById('install-close').addEventListener('click', () => document.getElementById('install-modal').classList.remove('show'));
    document.getElementById('btn-rescan').addEventListener('click', () => SP.openScan());
    document.getElementById('prev').addEventListener('click', () => { persist({ page: Math.max(1, (vs.page || 1) - 1) }); render(); });
    document.getElementById('next').addEventListener('click', () => { persist({ page: (vs.page || 1) + 1 }); render(); });
    document.getElementById('page-size').addEventListener('change', e => { persist({ pageSize: parseInt(e.target.value, 10) || 20, page: 1 }); render(); });
    document.getElementById('list-pane').addEventListener('scroll', () => {
      if (restoringScroll) return;
      const pane = document.getElementById('list-pane');
      const top = pane.scrollTop;
      // Keep intended scrollTop when the pane cannot currently overflow
      // (e.g. filtered cards view). Avoid clobbering restore state with 0.
      if (top === 0 && (vs.scrollTop || 0) > 0 && pane.scrollHeight <= pane.clientHeight + 1) return;
      persist({ scrollTop: top });
    });

    document.getElementById('list-pane').addEventListener('click', e => {
      if (e.target.id === 'btn-start-scan') { SP.openScan(); return; }
      if (e.target.id === 'btn-open-changes') {
        const id = SP.getPendingChangeSetSummary().changeSetIds[0];
        if (id) SP.openScanChanges(id);
        return;
      }
      const exp = e.target.closest('[data-expand]');
      if (exp) {
        const id = exp.dataset.expand;
        const set = new Set(vs.expandedAssetIds || []);
        if (set.has(id)) set.delete(id); else set.add(id);
        persist({ expandedAssetIds: [...set] });
        render();
        return;
      }
      const toggle = e.target.closest('[data-tree-toggle]');
      if (toggle && e.target.closest('#tree-root')) {
        const id = toggle.dataset.treeToggle;
        const set = new Set(vs.expandedTreeNodes || []);
        if (set.has(id)) set.delete(id); else set.add(id);
        persist({ expandedTreeNodes: [...set] });
        if (toggle.dataset.select) persist({ selectedAssetId: toggle.dataset.select, detailOpen: true });
        render();
        return;
      }
      const check = e.target.closest('[data-check]');
      if (check && e.target.matches('input')) {
        e.stopPropagation();
        if (check.checked) checked.add(check.dataset.check); else checked.delete(check.dataset.check);
        updateBatch();
        return;
      }
      if (e.target.id === 'check-all') {
        const result = SP.queryLibraryAssets(queryOpts());
        if (e.target.checked) result.items.forEach(i => checked.add(i.id));
        else result.items.forEach(i => checked.delete(i.id));
        render();
        return;
      }
      if (e.target.closest('.act-detail')) {
        const id = e.target.closest('.act-detail').dataset.id;
        SP.openSkillDetail(id, { originPage: 'index.html', originSelectedId: id, originSearch: vs.search });
        return;
      }
      if (e.target.closest('.act-edit')) {
        const id = e.target.closest('.act-edit').dataset.id;
        SP.openSkillEditor(id, { originPage: 'index.html', originSelectedId: id, originSearch: vs.search });
        return;
      }
      const row = e.target.closest('tr[data-id], .lib-card[data-id], .tree-skill[data-id]');
      if (row) {
        persist({ selectedAssetId: row.dataset.id, detailOpen: true });
        render();
      }
    });

    document.getElementById('status-strip').addEventListener('click', e => {
      const chip = e.target.closest('[data-chip]');
      if (!chip) return;
      const key = chip.dataset.chip;
      if (key === 'scan-changes' || key === 'scanning' || key === 'paused' || key === 'partial') {
        persist({ section: 'scan-changes' }); render(); return;
      }
      if (key === 'updates') { persist({ section: 'updates', page: 1 }); render(); return; }
      if (key === 'missing') { persist({ section: 'missing', page: 1 }); render(); return; }
      if (key === 'conflicts') {
        const f = Object.assign({}, vs.filters || {}, { health: ['permission-denied'] });
        persist({ section: 'all', filters: f, page: 1 }); render();
      }
    });

    document.getElementById('detail').addEventListener('click', e => {
      const id = vs.selectedAssetId;
      if (!id) return;
      if (e.target.id === 'd-open') SP.openSkillDetail(id, { originPage: 'index.html', originSelectedId: id, originSearch: vs.search });
      if (e.target.id === 'd-edit') SP.openSkillEditor(id, { originPage: 'index.html', originSelectedId: id });
      if (e.target.id === 'd-fav') { SP.toggleFavorite(id); render(); }
      if (e.target.id === 'd-copy') {
        const s = SP.getAssetSummary(id);
        navigator.clipboard?.writeText(s.invocation || s.name);
        SP.toast('已复制调用方式');
      }
      if (e.target.id === 'd-folder') SP.toast('已在 Finder 中显示（原型模拟）');
      if (e.target.id === 'd-update') SP.toast('更新流程将在后续阶段提供');
      if (e.target.id === 'd-relink') SP.toast('Relink 流程将在 Detail 阶段提供');
      if (e.target.id === 'd-ignore-hint') { SP.ignoreMissingHint(id); SP.toast('已忽略 Missing 提示'); render(); }
      if (e.target.id === 'd-archive') {
        pendingBatch = { action: 'archive', ids: [id] };
        document.getElementById('archive-body').innerHTML = archiveConfirmBody([id]);
        document.getElementById('archive-modal').classList.add('show');
      }
      if (e.target.id === 'd-restore') {
        pendingBatch = { action: 'restore', ids: [id] };
        document.getElementById('restore-body').textContent = '将恢复所选已归档 Skill。';
        document.getElementById('restore-modal').classList.add('show');
      }
    });

    document.getElementById('batch-bar').addEventListener('click', e => {
      const btn = e.target.closest('[data-batch]');
      if (!btn) return;
      const action = btn.dataset.batch;
      const ids = [...checked];
      if (!ids.length) return;
      if (action === 'archive') {
        pendingBatch = { action, ids };
        document.getElementById('archive-body').innerHTML = archiveConfirmBody(ids);
        document.getElementById('archive-modal').classList.add('show');
        return;
      }
      if (action === 'restore') {
        pendingBatch = { action, ids };
        document.getElementById('restore-body').textContent = `将恢复 ${ids.length} 个 Skill。`;
        document.getElementById('restore-modal').classList.add('show');
        return;
      }
      if (action === 'add-category') {
        const cats = SP.getCategories();
        const cid = cats[0] && cats[0].id;
        const res = SP.batchLibraryAction('add-category', ids, { categoryIds: [cid] });
        showBatchResults(res); checked.clear(); render(); return;
      }
      if (action === 'add-tag') {
        const res = SP.batchLibraryAction('add-tag', ids, { tags: ['library-batch'] });
        showBatchResults(res); checked.clear(); render(); return;
      }
      const res = SP.batchLibraryAction(action, ids);
      showBatchResults(res);
      checked.clear();
      render();
    });

    document.getElementById('archive-ok').addEventListener('click', () => {
      document.getElementById('archive-modal').classList.remove('show');
      if (!pendingBatch) return;
      const res = SP.batchLibraryAction(pendingBatch.action, pendingBatch.ids);
      showBatchResults(res); pendingBatch = null; checked.clear(); render();
    });
    document.getElementById('archive-cancel').addEventListener('click', () => document.getElementById('archive-modal').classList.remove('show'));
    document.getElementById('restore-ok').addEventListener('click', () => {
      document.getElementById('restore-modal').classList.remove('show');
      if (!pendingBatch) return;
      const res = SP.batchLibraryAction(pendingBatch.action, pendingBatch.ids);
      showBatchResults(res); pendingBatch = null; checked.clear(); render();
    });
    document.getElementById('restore-cancel').addEventListener('click', () => document.getElementById('restore-modal').classList.remove('show'));
    document.getElementById('batch-results-close').addEventListener('click', () => document.getElementById('batch-results-modal').classList.remove('show'));

    document.getElementById('d-close').addEventListener('click', () => closeDetailDrawer());
    document.getElementById('detail-overlay').addEventListener('click', () => closeDetailDrawer());
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const narrow = window.matchMedia('(max-width:1100px)').matches;
      if (narrow && vs.detailOpen && vs.selectedAssetId) closeDetailDrawer();
    });

    document.addEventListener('click', e => {
      // Keep filter/col/more panels open when interacting inside them.
      if (!e.target.closest('.filter-pop') && !e.target.closest('#filter-panel')) {
        document.getElementById('filter-panel').classList.remove('open');
      }
      if (!e.target.closest('.col-pop') && !e.target.closest('#col-settings-panel')) {
        document.getElementById('col-settings-panel').classList.remove('open');
      }
      if (!e.target.closest('.more-pop') && !e.target.closest('#more-menu')) {
        document.getElementById('more-menu').classList.remove('open');
      }
    });

    document.getElementById('more-menu').addEventListener('click', e => {
      if (e.target.id === 'install-placeholder-source' || e.target.closest('#install-placeholder-source')) {
        e.preventDefault();
        SP.toast('来源安装将在后续阶段提供');
      }
    });
    const installSrc = document.getElementById('install-placeholder-source');
    if (installSrc) installSrc.addEventListener('click', e => { e.preventDefault(); SP.toast('来源安装将在后续阶段提供'); });

    window.addEventListener('resize', () => {
      syncDetailDrawerChrome();
      renderDetail();
    });
  }

  readUrlOnce();
  vs = SP.getLibraryViewState();
  categoryId = vs.categoryId || categoryId;
  // Ensure library chrome is written once so seed + viewState survive refresh
  // even when the user never mutates filters/search.
  persist({
    section: vs.section || 'all',
    viewMode: vs.viewMode || 'table',
    search: vs.search || '',
    filters: vs.filters || {},
    sort: vs.sort || 'recent',
    page: vs.page || 1,
    pageSize: vs.pageSize || 20
  });
  bind();
  render();
})();
