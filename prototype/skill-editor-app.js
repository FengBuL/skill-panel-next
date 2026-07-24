/* Phase E Skill Editor — session APIs only; never getState().files / getSkill().content */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  let assetId = params.get('skill') || null;
  let sessionId = params.get('session') || null;
  let session = null;
  let selectedFileId = null;
  let currentFile = null;
  let memoryDraft = null; // { fileId, text } when autosave fails
  let autosaveTimer = null;
  let applyPrep = null;
  let narrowPane = 'editor';
  let expandedNodes = new Set();

  function toast(msg) {
    if (typeof SP.toast === 'function') SP.toast(msg);
  }

  function need(name) {
    if (typeof SP[name] !== 'function') {
      toast('缺少 API：' + name);
      return false;
    }
    return true;
  }

  function esc(s) {
    return SP.$escape(String(s == null ? '' : s));
  }

  function safeMarkdown(md) {
    if (!md) return '';
    let html = '';
    let inCode = false;
    let codeBuf = '';
    const flush = () => {
      if (codeBuf) html += '<pre><code>' + esc(codeBuf) + '</code></pre>';
      codeBuf = '';
    };
    String(md).split('\n').forEach(line => {
      if (line.startsWith('```')) {
        if (inCode) { flush(); inCode = false; }
        else inCode = true;
        return;
      }
      if (inCode) { codeBuf += line + '\n'; return; }
      if (line.startsWith('# ')) html += '<h1>' + esc(line.slice(2)) + '</h1>';
      else if (line.startsWith('## ')) html += '<h2>' + esc(line.slice(3)) + '</h2>';
      else if (line.startsWith('### ')) html += '<h3>' + esc(line.slice(4)) + '</h3>';
      else if (/^\d+\.\s/.test(line)) html += '<li>' + esc(line.replace(/^\d+\.\s/, '')) + '</li>';
      else if (line.startsWith('- ') || line.startsWith('* ')) html += '<li>' + esc(line.slice(2)) + '</li>';
      else if (line.trim() === '') html += '<br>';
      else html += '<p>' + esc(line) + '</p>';
    });
    if (inCode) flush();
    return html.replace(/(<li>.*?<\/li>)+/g, m => '<ul>' + m + '</ul>');
  }

  function renderDiffLines(lines) {
    if (!lines || !lines.length) return '<div class="sp-editor-empty">无差异</div>';
    return lines.map(l => {
      const cls = l.type === 'add' ? 'add' : (l.type === 'del' ? 'del' : (l.type === 'meta' ? 'meta' : ''));
      const prefix = l.type === 'add' ? '+' : (l.type === 'del' ? '-' : '');
      const text = prefix ? (prefix + (l.text || '')) : (l.text || '');
      return '<div class="' + cls + '">' + esc(text) + '</div>';
    }).join('');
  }

  function setPill(id, text, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'sd-pill' + (tone ? ' ' + tone : '');
    let span = el.querySelector('span:last-of-type');
    if (!span || span.classList.contains('sp-status-dot')) {
      span = document.createElement('span');
      el.appendChild(span);
    }
    // Prefer dedicated label span when present
    const label = el.querySelector('#' + id.replace(/-status$|-chip$|-count$/, '') + '-label') ||
      el.querySelector('span:not(.sp-status-dot)');
    if (id === 'mode-chip') {
      const ml = document.getElementById('mode-label');
      if (ml) { ml.textContent = text; return; }
    }
    if (label) label.textContent = text;
    else span.textContent = text;
  }

  function canEditSession() {
    return !!(session && session.mode === 'editable' && session.writeAccess);
  }

  function canEditFile() {
    return canEditSession() && currentFile && currentFile.editable && !currentFile.isBinary;
  }

  function persistView(patch) {
    if (!need('setEditorViewState')) return;
    SP.setEditorViewState(Object.assign({
      assetId: assetId,
      instanceId: session && session.instanceId,
      sessionId: sessionId,
      selectedFileId: selectedFileId,
      narrowPane: narrowPane,
      expandedFileNodes: Array.from(expandedNodes)
    }, patch || {}));
  }

  function syncUrl() {
    const url = new URL(location.href);
    if (assetId) url.searchParams.set('skill', assetId);
    if (sessionId) url.searchParams.set('session', sessionId);
    if (params.get('dev') === '1') url.searchParams.set('dev', '1');
    history.replaceState({}, '', url.toString());
  }

  function updateSidebar() {
    try {
      const counts = SP.getLibraryCounts ? SP.getLibraryCounts() : null;
      const lib = document.getElementById('nav-lib-count');
      const ins = document.getElementById('nav-ins-count');
      const act = document.getElementById('nav-act-count');
      if (counts && lib) lib.textContent = counts.all != null ? counts.all : 0;
      if (ins) {
        ins.textContent =
          (SP.getArchiveCandidates ? SP.getArchiveCandidates().length : 0) +
          (SP.getDuplicateGroups ? SP.getDuplicateGroups().length : 0) +
          (SP.getFileIssues ? SP.getFileIssues().length : 0);
      }
      if (act && SP.getUnfinishedDrafts) act.textContent = (SP.getUnfinishedDrafts() || []).length;
    } catch (_) { /* ignore */ }
  }

  function draftSummaries() {
    if (!need('getDraftSummaries') || !assetId) return [];
    return SP.getDraftSummaries(assetId) || [];
  }

  function updateHeader() {
    // Metadata only — never read skill content
    const asset = typeof SP.getAsset === 'function' ? SP.getAsset(assetId) : null;
    const inst = session && typeof SP.getInstance === 'function' ? SP.getInstance(session.instanceId) : null;
    document.getElementById('skill-name').textContent =
      (asset && (asset.displayName || asset.name)) || assetId || '—';
    document.getElementById('instance-path').textContent = inst
      ? ((inst.hostType || '') + ' · ' + (inst.skillFilePath || inst.rootPath || '—'))
      : '—';

    setPill('mode-chip', canEditSession() ? '可编辑' : '只读', canEditSession() ? '' : 'warn');

    const drafts = draftSummaries().filter(d => !session || d.instanceId === session.instanceId);
    const conflictDraft = drafts.some(d => d.status === 'conflict');
    setPill('draft-status', drafts.length ? ('草稿 ' + drafts.length) : '无草稿', drafts.length ? 'warn' : '');
    setPill('external-status', conflictDraft ? '外部已修改' : '磁盘已同步', conflictDraft ? 'danger' : '');

    let errorCount = 0;
    if (sessionId && need('validateEditorSession')) {
      const v = SP.validateEditorSession(sessionId);
      errorCount = (v && v.errorCount) || 0;
    }
    setPill('validation-count', '问题 ' + errorCount, errorCount ? 'danger' : '');

    document.getElementById('btn-apply').disabled = !canEditSession();
    // Discard is local-only — allowed after write revoke while session still exists.
    document.getElementById('btn-discard').disabled = !session || !drafts.length;
    const ed = document.getElementById('editor');
    ed.disabled = !canEditFile();
    ed.readOnly = !canEditFile();
  }

  function updateLineNumbers(text) {
    const n = Math.max(1, String(text || '').split('\n').length);
    let out = '';
    for (let i = 1; i <= n; i++) out += i + (i < n ? '\n' : '');
    document.getElementById('line-numbers').textContent = out;
  }

  function renderTree() {
    const treeEl = document.getElementById('file-tree');
    if (!session || !need('buildFileTree')) {
      treeEl.innerHTML = '<div class="sp-editor-empty">无文件树</div>';
      return;
    }
    const tree = SP.buildFileTree(session.instanceId) || [];
    const drafts = draftSummaries().filter(d => d.instanceId === session.instanceId);
    const draftIds = new Set(drafts.map(d => d.fileId));

    if (selectedFileId && need('getInstanceFiles')) {
      const files = SP.getInstanceFiles(session.instanceId) || [];
      const sel = files.find(f => f.id === selectedFileId);
      if (sel && sel.relativePath) {
        const parts = String(sel.relativePath).split('/');
        parts.pop();
        let acc = '';
        parts.forEach(p => {
          acc = acc ? acc + '/' + p : p;
          expandedNodes.add(acc);
        });
      }
    }

    function renderNodes(nodes, depth) {
      return (nodes || []).map(node => {
        if (node.type === 'dir') {
          const open = expandedNodes.has(node.path);
          return '<div>' +
            '<div class="node" data-dir="' + esc(node.path) + '" style="padding-left:' + (8 + depth * 14) + 'px">' +
            '<button type="button" class="twisty">' + (open ? '▾' : '▸') + '</button>' +
            '<span class="icon">▸</span>' +
            '<span class="name">' + esc(node.name) + '</span>' +
            '</div>' +
            '<div class="children' + (open ? ' open' : '') + '">' + renderNodes(node.children || [], depth + 1) + '</div>' +
            '</div>';
        }
        const selected = node.fileId === selectedFileId ? ' selected' : '';
        let badges = '';
        if (node.isNestedSkillMarker) badges += '<span class="badge">嵌套</span>';
        if (node.fileType === 'binary') badges += '<span class="badge">二进制</span>';
        if (draftIds.has(node.fileId)) badges += '<span class="badge">草稿</span>';
        return '<div class="node' + selected + '" data-file="' + esc(node.fileId) + '" style="padding-left:' + (8 + depth * 14) + 'px">' +
          '<span class="twisty empty"></span>' +
          '<span class="icon">' + (node.fileType === 'binary' ? '◆' : '·') + '</span>' +
          '<span class="name">' + esc(node.name) + '</span>' + badges +
          '</div>';
      }).join('');
    }

    treeEl.innerHTML = renderNodes(tree, 0) || '<div class="sp-editor-empty">无文件</div>';
    treeEl.querySelectorAll('[data-dir]').forEach(el => {
      el.addEventListener('click', () => {
        const path = el.getAttribute('data-dir');
        if (expandedNodes.has(path)) expandedNodes.delete(path);
        else expandedNodes.add(path);
        persistView();
        renderTree();
      });
    });
    treeEl.querySelectorAll('[data-file]').forEach(el => {
      el.addEventListener('click', () => selectFile(el.getAttribute('data-file')));
    });
  }

  function flushDraft() {
    if (!canEditFile() || !selectedFileId) return true;
    if (!need('saveEditorDraft')) return false;
    const ed = document.getElementById('editor');
    const res = SP.saveEditorDraft(sessionId, selectedFileId, ed.value);
    if (!res || !res.ok) {
      memoryDraft = { fileId: selectedFileId, text: ed.value };
      toast((res && res.error) || '自动保存失败，已保留内存内容');
      return false;
    }
    memoryDraft = null;
    return true;
  }

  function selectFile(fileId) {
    if (!fileId) return;
    if (selectedFileId && selectedFileId !== fileId) {
      if (canEditFile()) flushDraft();
    }
    selectedFileId = fileId;
    persistView({ selectedFileId: fileId });
    if (window.matchMedia('(max-width: 1100px)').matches) {
      narrowPane = 'editor';
      applyNarrow();
    }
    loadFile(fileId);
  }

  function loadFile(fileId) {
    if (!need('getEditorFileContent')) return;
    currentFile = SP.getEditorFileContent(sessionId, fileId);
    const wrap = document.getElementById('editor-wrap');
    const ed = document.getElementById('editor');
    const pathEl = document.getElementById('current-file-path');
    const metaEl = document.getElementById('current-file-meta');
    const binaryMeta = document.getElementById('binary-meta');

    if (!currentFile || !currentFile.ok) {
      wrap.classList.remove('binary-mode');
      pathEl.textContent = '无法加载';
      metaEl.textContent = (currentFile && currentFile.error) || '—';
      ed.value = '';
      ed.disabled = true;
      updateLineNumbers('');
      renderRight();
      updateHeader();
      renderTree();
      return;
    }

    pathEl.textContent = currentFile.relativePath || '—';
    metaEl.textContent = [
      currentFile.fileType || '',
      currentFile.mimeType || '',
      currentFile.sizeBytes != null ? (currentFile.sizeBytes + ' B') : '',
      currentFile.draftStatus && currentFile.draftStatus !== 'clean' ? ('草稿:' + currentFile.draftStatus) : ''
    ].filter(Boolean).join(' · ');

    const binary = !!(currentFile.isBinary || currentFile.fileType === 'binary' ||
      (currentFile.content == null && !currentFile.editable));
    wrap.classList.toggle('binary-mode', binary);

    if (binary) {
      binaryMeta.innerHTML =
        '<div style="text-align:left">' +
        '<div style="font-weight:600;margin-bottom:8px">' + esc(currentFile.reason || '二进制 / 不可编辑，仅元数据') + '</div>' +
        '<div>路径：' + esc(currentFile.relativePath || '—') + '</div>' +
        '<div>类型：' + esc(currentFile.fileType || '—') + '</div>' +
        '<div>MIME：' + esc(currentFile.mimeType || '—') + '</div>' +
        '<div>大小：' + esc(currentFile.sizeBytes != null ? currentFile.sizeBytes + ' B' : '—') + '</div>' +
        '<div>哈希：' + esc(currentFile.contentHash || '—') + '</div>' +
        '</div>';
      ed.value = '';
      ed.disabled = true;
      updateLineNumbers('');
    } else {
      let text = currentFile.content || '';
      if (memoryDraft && memoryDraft.fileId === fileId) text = memoryDraft.text;
      ed.value = text;
      ed.disabled = !canEditFile();
      ed.readOnly = !canEditFile();
      updateLineNumbers(text);
    }

    updateHeader();
    renderTree();
    renderRight();
  }

  function renderRight() {
    const vs = need('getEditorViewState') ? (SP.getEditorViewState() || {}) : {};
    const tab = vs.rightPanel || 'preview';
    document.querySelectorAll('#right-tabs button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.sp-editor-tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + tab);
    if (panel) panel.classList.add('active');

    const text = document.getElementById('editor-wrap').classList.contains('binary-mode')
      ? ''
      : document.getElementById('editor').value;

    if (tab === 'preview') {
      document.getElementById('panel-preview').innerHTML =
        binaryOrEmpty() || safeMarkdown(text) || '<div class="sp-editor-empty">（空）</div>';
    } else if (tab === 'structure') {
      if (binaryOrEmpty()) {
        document.getElementById('panel-structure').innerHTML = binaryOrEmpty();
      } else {
        const yaml = SP.$parseYaml(text || '') || {};
        const rows = Object.keys(yaml).map(k =>
          '<div class="row"><span>' + esc(k) + '</span><span class="mono">' + esc(String(yaml[k])) + '</span></div>'
        ).join('') || '<div class="sp-editor-empty">无 frontmatter</div>';
        document.getElementById('panel-structure').innerHTML = '<h4>YAML</h4>' + rows;
      }
    } else if (tab === 'metadata') {
      if (!currentFile) {
        document.getElementById('panel-metadata').innerHTML = '<div class="sp-editor-empty">无文件</div>';
      } else {
        document.getElementById('panel-metadata').innerHTML =
          '<h4>文件元数据</h4>' +
          metaRow('路径', currentFile.relativePath) +
          metaRow('类型', currentFile.fileType) +
          metaRow('MIME', currentFile.mimeType) +
          metaRow('大小', currentFile.sizeBytes != null ? currentFile.sizeBytes + ' B' : '—') +
          metaRow('哈希', currentFile.contentHash) +
          metaRow('草稿', currentFile.draftStatus || 'clean') +
          metaRow('可编辑', currentFile.editable ? '是' : '否');
      }
    } else if (tab === 'diff') {
      const diff = need('getEditorDiff') ? SP.getEditorDiff(sessionId, selectedFileId) : null;
      const el = document.getElementById('file-diff');
      if (!diff) el.innerHTML = '<div class="sp-editor-empty">无 Diff</div>';
      else if (diff.metaOnly) {
        el.innerHTML = '<div class="sp-editor-empty">二进制仅比较元数据<br>base ' +
          esc(diff.baseHash || '') + ' → current ' + esc(diff.currentHash || '') + '</div>';
      } else {
        el.innerHTML = renderDiffLines(diff.lines);
      }
    } else if (tab === 'problems') {
      const v = need('validateEditorSession') ? SP.validateEditorSession(sessionId) : { problems: [] };
      const list = (v.problems || []).map(p => {
        const sev = p.severity === 'error' ? 'danger' : 'warn';
        return '<div class="row ' + sev + '"><span>' + esc(p.message || '') +
          (p.code ? (' · ' + esc(p.code)) : '') + '</span></div>';
      }).join('') || '<div class="sp-editor-empty">无问题</div>';
      document.getElementById('panel-problems').innerHTML = '<h4>校验问题</h4>' + list;
    }
  }

  function metaRow(k, v) {
    return '<div class="row"><span>' + esc(k) + '</span><span class="mono">' + esc(v == null ? '—' : v) + '</span></div>';
  }

  function binaryOrEmpty() {
    if (!currentFile) return '<div class="sp-editor-empty">选择文件</div>';
    if (currentFile.isBinary || currentFile.fileType === 'binary' ||
      document.getElementById('editor-wrap').classList.contains('binary-mode')) {
      return '<div class="sp-editor-empty">二进制 / 不可编辑文件无 Preview</div>';
    }
    return '';
  }

  function applyNarrow() {
    const layout = document.getElementById('editor-layout');
    const tabs = document.getElementById('narrow-tabs');
    const narrow = window.matchMedia('(max-width: 1100px)').matches;
    tabs.hidden = !narrow;
    layout.classList.remove('show-tree', 'show-editor', 'show-right');
    if (!narrow) {
      layout.removeAttribute('data-narrow');
      return;
    }
    const pane = narrowPane || 'editor';
    layout.classList.add('show-' + pane);
    layout.setAttribute('data-narrow', pane);
    tabs.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.pane === pane);
    });
  }

  function navigateConflict(conflictId) {
    if (typeof SP.openConflictPage === 'function') {
      SP.openConflictPage(conflictId, { sessionId: sessionId, assetId: assetId });
      return;
    }
    const q = new URLSearchParams();
    q.set('conflict', conflictId);
    if (sessionId) q.set('session', sessionId);
    if (assetId) q.set('skill', assetId);
    if (params.get('dev') === '1') q.set('dev', '1');
    location.href = 'conflict.html?' + q.toString();
  }

  function openAllDiff() {
    if (!need('getEditorAllDiff')) return;
    const all = SP.getEditorAllDiff(sessionId);
    const html = ((all && all.groups) || []).map(g =>
      '<div style="margin-bottom:14px"><strong>' + esc(g.relativePath) + '</strong> · ' + esc(g.change) +
      '<div class="sp-diff">' + renderDiffLines(g.diff || []) + '</div></div>'
    ).join('') || '<div class="sp-editor-empty">无修改</div>';
    document.getElementById('all-diff-body').innerHTML = html;
    document.getElementById('all-diff-modal').classList.add('show');
  }

  function openApply() {
    if (!canEditSession()) {
      toast('当前为只读模式');
      return;
    }
    if (!need('prepareApplyChanges')) return;
    flushDraft();
    const prep = SP.prepareApplyChanges(sessionId);
    if (!prep) {
      toast('准备应用失败');
      return;
    }
    if (!prep.ok && prep.code === 'conflict' && prep.conflictId) {
      navigateConflict(prep.conflictId);
      return;
    }
    const errEl = document.getElementById('apply-error');
    const summary = document.getElementById('apply-summary');
    const diffEl = document.getElementById('apply-diff');
    const confirmBtn = document.getElementById('apply-confirm');
    if (!prep.ok) {
      errEl.textContent = prep.error || prep.code || '无法应用';
      summary.textContent = '';
      diffEl.innerHTML = '';
      confirmBtn.disabled = true;
      document.getElementById('apply-modal').classList.add('show');
      return;
    }
    applyPrep = prep;
    errEl.textContent = '';
    confirmBtn.disabled = false;
    summary.textContent =
      '目标：' + (prep.targetPath || '—') +
      ' · 操作 ' + (prep.operationId || '—') +
      ' · 快照 ' + (prep.snapshotId || '—') +
      ' · 文件 ' + ((prep.files || []).length) +
      '（原型模拟，非真实磁盘写入）';
    const groups = (prep.diff && prep.diff.groups) || [];
    diffEl.innerHTML = groups.map(g =>
      '<div style="margin-bottom:12px"><strong>' + esc(g.relativePath) + '</strong> · ' + esc(g.change) +
      '<div class="sp-diff">' + renderDiffLines(g.diff || []) + '</div></div>'
    ).join('') || '<div class="sp-editor-empty">无变更</div>';
    document.getElementById('apply-modal').classList.add('show');
  }

  function confirmApply() {
    if (!applyPrep || !applyPrep.operationId || !need('confirmApplyChanges')) return;
    const res = SP.confirmApplyChanges(applyPrep.operationId, {
      userConfirmed: true
    });
    document.getElementById('apply-modal').classList.remove('show');
    if (!res) {
      toast('应用失败');
      return;
    }
    if ((!res.ok && res.code === 'conflict') || res.conflictId) {
      navigateConflict(res.conflictId);
      return;
    }
    if (res.status === 'completed') {
      toast('应用完成（原型模拟）· ' + ((res.results || []).length) + ' 文件');
    } else {
      toast('应用结果：' + (res.status || res.error || res.code || '未知'));
    }
    applyPrep = null;
    memoryDraft = null;
    if (selectedFileId) loadFile(selectedFileId);
    updateHeader();
    renderTree();
  }

  function createSnapshot() {
    if (!session || !need('createPackageSnapshot')) return;
    const res = SP.createPackageSnapshot({
      assetId: assetId,
      instanceId: session.instanceId,
      note: 'Editor 包快照',
      source: 'manual'
    });
    if (!res || !res.ok) {
      toast((res && res.error) || '创建快照失败');
      return;
    }
    toast('已创建包快照（原型）');
  }

  function bind() {
    const ed = document.getElementById('editor');
    ed.addEventListener('input', () => {
      updateLineNumbers(ed.value);
      if (!canEditFile()) return;
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        if (!need('saveEditorDraft')) return;
        const res = SP.saveEditorDraft(sessionId, selectedFileId, ed.value);
        if (!res || !res.ok) {
          memoryDraft = { fileId: selectedFileId, text: ed.value };
          toast((res && res.error) || '自动保存失败');
        } else {
          memoryDraft = null;
          toast('草稿已自动保存');
        }
        updateHeader();
        renderTree();
        const vs = SP.getEditorViewState() || {};
        if (vs.rightPanel === 'diff' || vs.rightPanel === 'problems' || vs.rightPanel === 'preview') {
          renderRight();
        }
      }, 600);
    });
    ed.addEventListener('scroll', () => {
      document.getElementById('line-numbers').scrollTop = ed.scrollTop;
    });

    document.getElementById('btn-apply').addEventListener('click', openApply);
    document.getElementById('btn-all-diff').addEventListener('click', openAllDiff);
    document.getElementById('btn-snapshot').addEventListener('click', createSnapshot);
    document.getElementById('btn-discard').addEventListener('click', () => {
      document.getElementById('discard-summary').textContent =
        '将放弃当前文件草稿：' + ((currentFile && currentFile.relativePath) || selectedFileId || '—');
      document.getElementById('discard-modal').classList.add('show');
    });

    document.getElementById('apply-cancel').addEventListener('click', () => {
      if (applyPrep && applyPrep.operationId && need('cancelApplyOperation')) {
        SP.cancelApplyOperation(applyPrep.operationId);
      }
      applyPrep = null;
      document.getElementById('apply-modal').classList.remove('show');
    });
    document.getElementById('apply-confirm').addEventListener('click', confirmApply);
    document.getElementById('discard-cancel').addEventListener('click', () => {
      document.getElementById('discard-modal').classList.remove('show');
    });
    document.getElementById('discard-confirm').addEventListener('click', () => {
      if (!need('discardEditorDraft')) return;
      SP.discardEditorDraft(sessionId, selectedFileId);
      document.getElementById('discard-modal').classList.remove('show');
      memoryDraft = null;
      toast('已放弃草稿');
      if (selectedFileId) loadFile(selectedFileId);
    });
    document.getElementById('all-diff-close').addEventListener('click', () => {
      document.getElementById('all-diff-modal').classList.remove('show');
    });

    document.querySelectorAll('#right-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        persistView({ rightPanel: btn.dataset.tab });
        renderRight();
      });
    });
    document.querySelectorAll('#narrow-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        narrowPane = btn.dataset.pane;
        persistView({ narrowPane: narrowPane });
        applyNarrow();
      });
    });

    document.getElementById('btn-back').addEventListener('click', e => {
      e.preventDefault();
      if (typeof SP.returnToOrigin === 'function') {
        SP.returnToOrigin('skill-detail.html?skill=' + encodeURIComponent(assetId || ''));
      } else {
        location.href = 'skill-detail.html?skill=' + encodeURIComponent(assetId || '');
      }
    });

    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        openApply();
      }
    });
    window.addEventListener('resize', applyNarrow);
    window.addEventListener('beforeunload', () => {
      if (canEditFile()) flushDraft();
    });
  }

  function initSession() {
    assetId = (typeof SP.resolveAssetId === 'function' ? SP.resolveAssetId(assetId) : null) || assetId;
    if (!assetId) {
      document.querySelector('.sp-editor-main').innerHTML =
        '<div class="sp-editor-empty" style="padding:48px">缺少 skill 参数</div>';
      return false;
    }

    const vs = need('getEditorViewState') ? (SP.getEditorViewState() || {}) : {};
    if (vs.expandedFileNodes) expandedNodes = new Set(vs.expandedFileNodes);
    if (vs.narrowPane) narrowPane = vs.narrowPane;
    if (!sessionId) sessionId = vs.sessionId || null;
    if (vs.selectedFileId) selectedFileId = vs.selectedFileId;

    if (sessionId && need('restoreEditorSession')) {
      const restored = SP.restoreEditorSession(sessionId);
      if (restored && restored.ok && restored.session) {
        session = restored.session;
      } else {
        toast((restored && restored.blockedReason) || 'Session 已过期，重新打开');
        sessionId = null;
        session = null;
      }
    }

    if (!sessionId) {
      if (!need('openEditorSession')) return false;
      let instanceId = vs.instanceId || null;
      try {
        const origin = SP.getOrigin && SP.getOrigin();
        if (origin && origin.instanceId) instanceId = origin.instanceId;
      } catch (_) { /* ignore */ }
      if (!instanceId && typeof SP.getAssetInstances === 'function') {
        const instances = SP.getAssetInstances(assetId) || [];
        const primary = instances.find(i => i.isPrimary) || instances[0];
        if (primary) instanceId = primary.id;
      }
      const perm = instanceId && SP.getInstancePermission
        ? SP.getInstancePermission(instanceId)
        : null;
      const preferEditable = params.get('mode') === 'editable' ||
        (!params.get('mode') && perm && perm.writeAccess);

      let opened = SP.openEditorSession({
        assetId: assetId,
        instanceId: instanceId,
        mode: preferEditable ? 'editable' : 'read-only'
      });
      if ((!opened || !opened.ok) && preferEditable) {
        opened = SP.openEditorSession({
          assetId: assetId,
          instanceId: instanceId,
          mode: 'read-only'
        });
        if (opened && opened.ok) toast('以只读模式打开');
      }
      if (!opened || !opened.ok) {
        document.querySelector('.sp-editor-main').innerHTML =
          '<div class="sp-editor-empty" style="padding:48px">无法打开 Editor：' +
          esc((opened && opened.blockedReason) || '未知原因') + '</div>';
        return false;
      }
      session = opened;
      sessionId = opened.id;
    } else if (!session && need('getEditorSession')) {
      session = SP.getEditorSession(sessionId);
      if (!session) {
        toast('Session 不存在');
        return false;
      }
    }

    assetId = assetId || (session && session.assetId);
    syncUrl();
    persistView({});

    if (!selectedFileId && need('getInstanceFiles')) {
      const files = SP.getInstanceFiles(session.instanceId) || [];
      selectedFileId = (files.find(f => f.relativePath === 'SKILL.md') || files[0] || {}).id || null;
    }

    renderTree();
    applyNarrow();
    updateHeader();
    if (selectedFileId) loadFile(selectedFileId);
    else {
      document.getElementById('panel-preview').innerHTML =
        '<div class="sp-editor-empty">从左侧选择文件</div>';
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateSidebar();
    bind();
    initSession();
  });
})();
