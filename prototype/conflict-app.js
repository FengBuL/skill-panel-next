/* Phase E Conflict page — SP conflict APIs; never claim real FS writes */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  let conflictId = params.get('conflict') || null;
  const sessionHint = params.get('session') || null;
  const skillHint = params.get('skill') || null;

  let conflict = null;
  let selectedFileId = null;
  let fileDetail = null;
  let diffMode = 'two-way';
  let forcePrep = null;

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
    const label = el.querySelector('span:not(.sp-status-dot)');
    if (label) label.textContent = text;
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

  function filesList() {
    return (conflict && conflict.files) || [];
  }

  function updateHeader() {
    if (!conflict) return;
    document.getElementById('conflict-skill-name').textContent =
      conflict.assetName || skillHint || '外部冲突';
    const inst = conflict.instance || {};
    const path = inst.skillFilePath || inst.rootPath || '—';
    const host = inst.hostType || '—';
    document.getElementById('conflict-instance-path').textContent = host + ' · ' + path;
    const scope = conflict.scope || 'file';
    setPill('conflict-badge', scope === 'permission' ? '权限已撤销' : (scope === 'instance' ? 'Instance Missing' : '外部已修改'), 'danger');
    setPill('conflict-file-count', filesList().length + ' 个文件', '');

    const banner = document.getElementById('conflict-global-banner');
    const panels = document.getElementById('conflict-three-panels');
    const tabs = document.getElementById('diff-tabs');
    const isGlobal = scope === 'permission' || scope === 'instance';
    if (banner) {
      if (isGlobal || (conflict.globalReason && !filesList().length)) {
        banner.style.display = 'block';
        banner.textContent = conflict.globalReason ||
          (scope === 'permission'
            ? '权限已撤销：禁止 Apply / Merge / Force。可保留或放弃本地 Draft。'
            : 'Instance Missing：禁止写入。请返回 Detail 或 Relink。');
      } else if (scope === 'package') {
        banner.style.display = 'block';
        banner.textContent = conflict.globalReason || '包内出现新增文件；新增项不是既有文件正文冲突。';
      } else {
        banner.style.display = 'none';
      }
    }
    if (panels) panels.style.display = isGlobal ? 'none' : '';
    if (tabs) tabs.style.display = isGlobal ? 'none' : '';

    const canWriteActions = conflict.canForce !== false && conflict.canMerge !== false && !isGlobal;
    document.getElementById('btn-reload').disabled = isGlobal;
    document.getElementById('btn-merge').disabled = !canWriteActions;
    document.getElementById('btn-save-copy').disabled = !canWriteActions;
    updateForceButton();
  }

  function updateForceButton() {
    const ack = document.getElementById('diff-viewed-ack');
    const btn = document.getElementById('btn-force');
    if (!btn) return;
    const isGlobal = conflict && (conflict.scope === 'permission' || conflict.scope === 'instance');
    btn.disabled = !ack || !ack.checked || isGlobal || (conflict && conflict.canForce === false);
  }

  function renderFileList() {
    const list = document.getElementById('conflict-file-list');
    const files = filesList();
    if (!files.length) {
      list.innerHTML = '<div class="sp-editor-empty" style="padding:16px">' +
        ((conflict && conflict.scope === 'permission') ? '权限冲突（无文件级条目）'
          : (conflict && conflict.scope === 'instance') ? 'Instance Missing（无文件级条目）'
          : '无冲突文件') + '</div>';
      return;
    }
    if (!selectedFileId) selectedFileId = files[0].fileId;
    list.innerHTML = '';
    files.forEach(f => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-conflict-file-item' + (f.fileId === selectedFileId ? ' active' : '');
      btn.innerHTML =
        '<span class="path">' + esc(f.relativePath || f.fileId) + '</span>' +
        '<span class="meta">' + esc(f.kind || (f.deleted ? 'deleted' : 'conflict')) +
        (f.isPackageAdded ? ' · 新增' : '') +
        (f.hasDraft ? ' · 有草稿' : '') + '</span>';
      btn.addEventListener('click', () => {
        selectedFileId = f.fileId;
        if (need('setConflictViewState')) {
          SP.setConflictViewState({ selectedFileId: selectedFileId });
        }
        renderFileList();
        loadFileDetail();
      });
      list.appendChild(btn);
    });
  }

  function loadFileDetail() {
    if (!selectedFileId || !need('getConflictFileDetail')) {
      fileDetail = null;
      renderPanels();
      renderDiff();
      return;
    }
    if (conflict && (conflict.scope === 'permission' || conflict.scope === 'instance')) {
      fileDetail = null;
      renderPanels();
      renderDiff();
      return;
    }
    fileDetail = SP.getConflictFileDetail(conflictId, selectedFileId);
    // Opening a file does NOT mark diff as viewed.
    renderPanels();
    renderDiff();
  }

  function renderPanels() {
    const baseEl = document.getElementById('panel-base');
    const curEl = document.getElementById('panel-current');
    const draftEl = document.getElementById('panel-draft');
    if (!fileDetail) {
      baseEl.textContent = '—';
      curEl.textContent = '—';
      draftEl.textContent = '—';
      return;
    }
    if (fileDetail.deleted) {
      baseEl.textContent = fileDetail.baseContent != null ? String(fileDetail.baseContent) : '（基线）';
      curEl.textContent = '（磁盘文件已删除）';
      draftEl.textContent = fileDetail.draftContent != null ? String(fileDetail.draftContent) : '（无草稿）';
      return;
    }
    baseEl.textContent = fileDetail.baseContent != null
      ? String(fileDetail.baseContent)
      : '（无官方基线正文，仅有哈希 ' + (fileDetail.baseHash || '—') + '）';
    curEl.textContent = fileDetail.currentContent != null
      ? String(fileDetail.currentContent)
      : '（无磁盘正文）';
    draftEl.textContent = fileDetail.draftContent != null
      ? String(fileDetail.draftContent)
      : '（无草稿）';
  }

  function renderDiff() {
    const el = document.getElementById('conflict-diff');
    if (!fileDetail) {
      el.innerHTML = '<div class="sp-editor-empty">选择冲突文件</div>';
      return;
    }
    if (diffMode === 'three-way') {
      const tw = fileDetail.threeWayDiff || {};
      el.innerHTML =
        '<div style="margin-bottom:8px;font-weight:600">基线 → 磁盘</div>' +
        '<div class="sp-diff">' + renderDiffLines(tw.baseToCurrent || []) + '</div>' +
        '<div style="margin:14px 0 8px;font-weight:600">磁盘 → 草稿</div>' +
        '<div class="sp-diff">' + renderDiffLines(tw.currentToDraft || fileDetail.twoWayDiff || []) + '</div>';
      return;
    }
    el.innerHTML = renderDiffLines(fileDetail.twoWayDiff || []);
  }

  function goEditor(res) {
    const sessionId = (res && res.sessionId) || (conflict && conflict.sessionId) || sessionHint;
    const assetId = (res && res.assetId) || (conflict && conflict.assetId) || skillHint;
    if (need('returnToEditorFromConflict') && conflictId) {
      const nav = SP.returnToEditorFromConflict(conflictId);
      const q = new URLSearchParams();
      const sid = (nav && nav.sessionId) || sessionId;
      const aid = (nav && nav.assetId) || assetId;
      if (aid) q.set('skill', aid);
      if (sid) q.set('session', sid);
      if (params.get('dev') === '1') q.set('dev', '1');
      location.href = 'skill-editor.html?' + q.toString();
      return;
    }
    const q = new URLSearchParams();
    if (assetId) q.set('skill', assetId);
    if (sessionId) q.set('session', sessionId);
    location.href = 'skill-editor.html?' + q.toString();
  }

  function afterResolve(res, okMsg) {
    if (!res) return;
    if (res.ok === false) {
      toast(res.error || res.message || '操作失败');
      return;
    }
    toast((okMsg || res.note || res.message || '已处理') + '（原型模拟，未真实写盘）');
    if (res.returnTo === 'editor' || res.sessionId) {
      goEditor(res);
      return;
    }
    loadConflict();
  }

  function onReload() {
    if (!need('resolveConflictReload')) return;
    if (!confirm('重新加载将用磁盘版本替换草稿基线。是否继续？')) return;
    afterResolve(
      SP.resolveConflictReload(conflictId, selectedFileId, { userConfirmed: true, keepDraftCopy: true }),
      '已重新加载磁盘版本'
    );
  }

  function onKeep() {
    if (!need('resolveConflictKeepDraft')) return;
    afterResolve(SP.resolveConflictKeepDraft(conflictId), '已保留草稿');
  }

  function onMerge() {
    if (!need('resolveConflictMerge')) return;
    afterResolve(SP.resolveConflictMerge(conflictId, selectedFileId), '已创建合并草稿');
  }

  function onSaveCopy() {
    if (!need('resolveConflictSaveCopy')) return;
    afterResolve(SP.resolveConflictSaveCopy(conflictId, selectedFileId), '已另存为副本');
  }

  function onDiscard() {
    if (!need('resolveConflictDiscard')) return;
    if (!confirm('确定放弃冲突相关草稿？')) return;
    afterResolve(SP.resolveConflictDiscard(conflictId, selectedFileId), '已放弃草稿');
  }

  function openForceModal() {
    if (!need('prepareForceOverwrite')) return;
    const ack = document.getElementById('diff-viewed-ack');
    if (!ack || !ack.checked) {
      toast('请先勾选：我已查看所有将被覆盖文件的差异');
      return;
    }
    if (need('markConflictDiffViewed')) {
      const marked = SP.markConflictDiffViewed(conflictId, { userAcknowledged: true });
      if (!marked || marked.ok === false) {
        toast((marked && marked.error) || '未能记录 Diff 查看');
        return;
      }
    }
    forcePrep = SP.prepareForceOverwrite(conflictId);
    const summary = document.getElementById('force-summary');
    const diffEl = document.getElementById('force-diff');
    const riskAck = document.getElementById('force-ack');
    const confirmBtn = document.getElementById('force-confirm');
    riskAck.checked = false;
    confirmBtn.disabled = true;

    if (!forcePrep || forcePrep.ok === false) {
      summary.textContent = (forcePrep && forcePrep.error) || '无法准备强制覆盖';
      diffEl.innerHTML = '';
      document.getElementById('force-modal').classList.add('show');
      return;
    }

    const files = forcePrep.files || [];
    const inst = conflict.instance || {};
    summary.innerHTML =
      '<div>目标路径：' + esc(inst.skillFilePath || inst.rootPath || '—') + '</div>' +
      '<div>影响文件：' + files.length + '</div>' +
      '<div>Force 操作：' + esc(forcePrep.forceOperationId || '—') + '</div>' +
      '<div>快照：' + esc(forcePrep.snapshotId || '—') + '</div>' +
      '<div style="margin-top:6px;color:var(--danger-text)">' +
      esc(forcePrep.warning || '强制覆盖将丢失磁盘上的外部修改（原型模拟）。') +
      '</div>';
    diffEl.innerHTML = files.map(f =>
      '<div style="margin-bottom:8px"><strong>' + esc(f.relativePath) + '</strong>' +
      (f.willLoseExternal ? ' · 将丢失外部修改' : '') +
      '<div class="sp-diff">' + esc(f.externalPreview || '') + '</div></div>'
    ).join('') || '<div class="sp-editor-empty">无文件</div>';
    document.getElementById('force-modal').classList.add('show');
  }

  function confirmForce() {
    if (!document.getElementById('force-ack').checked) {
      toast('请先确认风险');
      return;
    }
    if (!forcePrep || !forcePrep.ok || !forcePrep.forceOperationId || !need('confirmForceOverwrite')) return;
    const res = SP.confirmForceOverwrite(forcePrep.forceOperationId, {
      userConfirmed: true,
      secondConfirmed: true
    });
    document.getElementById('force-modal').classList.remove('show');
    afterResolve(res, '已强制覆盖');
  }

  function bind() {
    document.getElementById('btn-back').addEventListener('click', () => goEditor());
    document.getElementById('btn-reload').addEventListener('click', onReload);
    document.getElementById('btn-keep').addEventListener('click', onKeep);
    document.getElementById('btn-merge').addEventListener('click', onMerge);
    document.getElementById('btn-save-copy').addEventListener('click', onSaveCopy);
    document.getElementById('btn-discard').addEventListener('click', onDiscard);
    document.getElementById('btn-force').addEventListener('click', openForceModal);

    document.getElementById('diff-viewed-ack').addEventListener('change', updateForceButton);

    document.getElementById('force-cancel').addEventListener('click', () => {
      if (forcePrep && forcePrep.forceOperationId && need('cancelForceApplyOperation')) {
        SP.cancelForceApplyOperation(forcePrep.forceOperationId);
      }
      forcePrep = null;
      document.getElementById('force-modal').classList.remove('show');
    });
    document.getElementById('force-confirm').addEventListener('click', confirmForce);
    document.getElementById('force-ack').addEventListener('change', e => {
      const blocked = !forcePrep || forcePrep.ok === false;
      document.getElementById('force-confirm').disabled = !e.target.checked || blocked;
    });

    document.querySelectorAll('#diff-tabs button').forEach(b => {
      b.addEventListener('click', () => {
        diffMode = b.dataset.mode;
        document.querySelectorAll('#diff-tabs button').forEach(x => {
          x.classList.toggle('active', x === b);
        });
        if (need('setConflictViewState')) SP.setConflictViewState({ diffMode: diffMode });
        renderDiff();
      });
    });
  }

  function loadConflict() {
    if (!conflictId) {
      const vs = typeof SP.getConflictViewState === 'function' ? SP.getConflictViewState() : null;
      if (vs && vs.conflictId) conflictId = vs.conflictId;
    }
    if (!conflictId) {
      document.getElementById('conflict-layout').innerHTML =
        '<div class="sp-editor-empty" style="padding:48px">缺少 conflict 参数</div>';
      return;
    }
    if (!need('getConflict')) return;
    conflict = SP.getConflict(conflictId);
    if (!conflict) {
      document.getElementById('conflict-layout').innerHTML =
        '<div class="sp-editor-empty" style="padding:48px">冲突记录不存在</div>';
      return;
    }
    const vs = typeof SP.getConflictViewState === 'function' ? SP.getConflictViewState() : {};
    if (vs.selectedFileId) selectedFileId = vs.selectedFileId;
    if (vs.diffMode) {
      diffMode = vs.diffMode;
      document.querySelectorAll('#diff-tabs button').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === diffMode);
      });
    }
    if (need('setConflictViewState')) {
      SP.setConflictViewState({ conflictId: conflictId, selectedFileId: selectedFileId, diffMode: diffMode });
    }
    updateHeader();
    renderFileList();
    loadFileDetail();
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateSidebar();
    bind();
    loadConflict();
  });
})();
