/* Phase F Compare page — SP compare APIs only; no skill body via getSkill; no Raw; no saveState */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  let sessionId = params.get('session') || null;
  const groupParam = params.get('group') || null;
  const leftParam = params.get('left') || null;
  const rightParam = params.get('right') || null;

  let overview = null;
  let fileSummary = null;
  let session = null;
  let primaryCandidateId = null;
  let diffBaseId = null;
  let diffTargetId = null;
  let skillDetails = {};

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

  function shortHash(h) {
    if (!h) return '—';
    const s = String(h);
    return s.length > 12 ? s.slice(0, 8) + '…' + s.slice(-4) : s;
  }

  function fmtBytes(n) {
    if (n == null || Number.isNaN(n)) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
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

  function goBack() {
    if (need('returnToOrigin')) SP.returnToOrigin('insights.html');
  }

  function showNotFound(msg) {
    const nf = document.getElementById('not-found');
    const body = document.getElementById('compare-body');
    if (nf) {
      nf.hidden = false;
      const p = nf.querySelector('p');
      if (p && msg) p.textContent = msg;
    }
    if (body) body.hidden = true;
  }

  function ensureSession() {
    if (!need('openCompareSession') || !need('getCompareOverview') || !need('getCompareSession')) return false;

    if (sessionId) {
      session = SP.getCompareSession(sessionId);
      if (session) return true;
    }

    let ids = [];
    if (leftParam && rightParam) {
      ids = [leftParam, rightParam];
      if (params.get('c')) {
        params.getAll('c').forEach(id => { if (id && !ids.includes(id)) ids.push(id); });
      }
    } else if (groupParam && SP.resolveDuplicateGroup) {
      const g = SP.resolveDuplicateGroup(groupParam);
      if (g && g.skillIds) ids = g.skillIds.slice();
    }

    if (ids.length < 2) {
      showNotFound('比较参数无效，需要至少两个候选 Asset。');
      return false;
    }

    const opened = SP.openCompareSession(ids, { groupId: groupParam || null });
    if (!opened.ok || !opened.session) {
      showNotFound(opened.error || '无法创建比较会话。');
      return false;
    }
    sessionId = opened.session.id;
    session = opened.session;
    try {
      const next = new URLSearchParams(location.search);
      next.set('session', sessionId);
      history.replaceState(null, '', location.pathname + '?' + next.toString());
    } catch (_) { /* ignore */ }
    return true;
  }

  function loadOverview() {
    overview = SP.getCompareOverview(sessionId);
    if (!overview || !overview.candidates || overview.candidates.length < 2) {
      showNotFound('候选 Skill 不存在或已停止管理。');
      return false;
    }
    fileSummary = need('getCompareFileSummary') ? SP.getCompareFileSummary(sessionId) : null;
    if (!primaryCandidateId) {
      primaryCandidateId = (session && session.primaryAssetId) || overview.candidates[0].candidateId;
    }
    if (!diffBaseId) diffBaseId = overview.candidates[0].candidateId;
    if (!diffTargetId) {
      diffTargetId = (overview.candidates.find(c => c.candidateId !== diffBaseId) || overview.candidates[1]).candidateId;
    }
    return true;
  }

  function loadSkillMdBodies() {
    skillDetails = {};
    if (!need('getCompareFileDetail')) return;
    (overview.candidates || []).forEach(c => {
      if (!c.skillMdFileId) {
        skillDetails[c.candidateId] = { ok: false, content: null, contentAccessStatus: 'missing', readAccess: false };
        return;
      }
      const detail = SP.getCompareFileDetail(sessionId, c.candidateId, c.skillMdFileId);
      skillDetails[c.candidateId] = detail || { ok: false, content: null, contentAccessStatus: 'denied', readAccess: false };
    });
  }

  function lineDiffLines(a, b) {
    if (typeof SP.lineDiffSafe === 'function') return SP.lineDiffSafe(a, b);
    const left = String(a || '').split('\n');
    const right = String(b || '').split('\n');
    const max = Math.min(Math.max(left.length, right.length), 400);
    const lines = [];
    for (let i = 0; i < max; i++) {
      const L = left[i];
      const R = right[i];
      if (L === R) lines.push({ type: 'same', text: L == null ? '' : L });
      else {
        if (L != null) lines.push({ type: 'del', text: L });
        if (R != null) lines.push({ type: 'add', text: R });
      }
    }
    if (Math.max(left.length, right.length) > 400) {
      lines.push({ type: 'meta', text: '… Diff 已截断（超过 400 行）' });
    }
    return lines;
  }

  function renderDiffHtml(lines) {
    if (!lines || !lines.length) return '<div class="sp-compare-empty">无差异</div>';
    return lines.map(l => {
      const cls = l.type === 'add' ? 'add' : (l.type === 'del' ? 'del' : (l.type === 'meta' ? 'meta' : ''));
      const prefix = l.type === 'add' ? '+' : (l.type === 'del' ? '-' : ' ');
      return '<div class="' + cls + '">' + esc(prefix + (l.text || '')) + '</div>';
    }).join('');
  }

  function renderEvidence() {
    const el = document.getElementById('compare-evidence');
    if (!el || !overview) return;
    const ev = overview.evidence || {};
    const cmp = overview.comparison || {};
    const pills = [];
    if (ev.reason) pills.push(esc(ev.reason));
    if (ev.similarity != null) pills.push('内容相似 ' + ev.similarity + '%');
    if (ev.nameSim != null) pills.push('名称相似 ' + ev.nameSim + '%');
    if (cmp.skillMdHashMatch) pills.push('SKILL.md Hash 一致');
    else pills.push('SKILL.md Hash 不同');
    if (cmp.packageHashMatch) pills.push('Package Hash 一致');
    if (cmp.structureOverlap != null) pills.push('结构重叠 ' + cmp.structureOverlap + '%');
    el.innerHTML = pills.map(p => '<span class="sp-compare-pill">' + p + '</span>').join('');
  }

  function renderCandidates() {
    const grid = document.getElementById('compare-grid');
    if (!grid || !overview) return;
    const n = overview.candidates.length;
    grid.style.setProperty('--compare-cols', String(Math.min(n, 3)));
    // Keep #compare wrapper for legacy selectors (#compare .col h2)
    grid.innerHTML = '<div id="compare" class="sp-compare-compat-root" style="display:contents"></div>';
    const root = document.getElementById('compare') || grid;

    overview.candidates.forEach(c => {
      const card = document.createElement('article');
      card.className = 'col sp-compare-card' + (c.candidateId === primaryCandidateId ? ' is-primary' : '');
      card.dataset.candidateId = c.candidateId;

      const usage = c.usageCredibility || {};
      const perm = c.permission || {};
      const src = c.source || {};
      const inst = c.instance || {};
      const detail = skillDetails[c.candidateId] || {};
      const canRead = detail.readAccess && detail.contentAccessStatus === 'readable' && detail.content != null;

      const tree = (c.fileStructure || []).slice(0, 12).map(f =>
        '<li><span class="path">' + esc(f.relativePath) + '</span>' +
        '<span class="hash">' + esc(shortHash(f.contentHash)) + '</span></li>'
      ).join('') + ((c.fileStructure || []).length > 12
        ? '<li class="more">… 另有 ' + ((c.fileStructure || []).length - 12) + ' 个文件</li>' : '');

      card.innerHTML =
        '<header>' +
          '<h2>' + esc(c.displayName || c.name) + '</h2>' +
          '<div class="path">' + esc(inst.skillFilePath || '—') + '</div>' +
          (c.candidateId === primaryCandidateId ? '<span class="sp-compare-badge">主 Asset</span>' : '') +
        '</header>' +
        '<dl class="sp-compare-props">' +
          '<div><dt>名称</dt><dd>' + esc(c.name) + '</dd></div>' +
          '<div><dt>版本</dt><dd class="mono">' + esc(c.version || '—') + '</dd></div>' +
          '<div><dt>Host</dt><dd>' + esc(c.hostLabel || c.host || '—') + '</dd></div>' +
          '<div><dt>Instance</dt><dd class="mono">' + esc(inst.id ? inst.id.slice(0, 8) + '…' : '—') + '</dd></div>' +
          '<div><dt>来源</dt><dd>' + esc(src.bound ? (src.sourceType || 'bound') : '未绑定') + '</dd></div>' +
          '<div><dt>Repository</dt><dd class="mono">' + esc(c.repository || src.repository || '—') + '</dd></div>' +
          '<div><dt>Package Hash</dt><dd class="mono">' + esc(shortHash(c.packageHash)) + '</dd></div>' +
          '<div><dt>SKILL.md Hash</dt><dd class="mono">' + esc(shortHash(c.skillMdHash)) + '</dd></div>' +
          '<div><dt>读取权限</dt><dd>' + esc(perm.contentAccessStatus || (perm.readAccess ? 'readable' : 'denied')) + '</dd></div>' +
          '<div><dt>使用数据</dt><dd>' + esc(usage.displayLabel || '暂无数据') +
            (usage.attributionLevel ? ' · ' + esc(usage.attributionLevel) : '') + '</dd></div>' +
          '<div><dt>包大小</dt><dd class="mono">' + esc(fmtBytes(c.packageSizeBytes)) + '</dd></div>' +
        '</dl>' +
        '<div class="sp-compare-tree-wrap">' +
          '<h3>文件结构</h3>' +
          '<ul class="sp-compare-tree">' + (tree || '<li class="more">无文件元数据</li>') + '</ul>' +
        '</div>' +
        '<div class="sp-compare-preview">' +
          '<h3>SKILL.md</h3>' +
          (canRead
            ? '<pre class="sp-compare-md">' + esc(String(detail.content).slice(0, 1200)) +
              (String(detail.content).length > 1200 ? '\n…' : '') + '</pre>'
            : '<div class="sp-compare-empty">无读取权限 — 仅显示元数据（Hash：' +
              esc(shortHash(c.skillMdHash)) + '）</div>') +
        '</div>' +
        '<footer class="sp-compare-card-actions">' +
          '<button type="button" class="btn" data-act="primary" data-id="' + esc(c.candidateId) + '">设为主 Asset</button>' +
          '<button type="button" class="btn" data-act="archive" data-id="' + esc(c.candidateId) + '">归档此 Asset</button>' +
          '<button type="button" class="btn" data-act="detail" data-id="' + esc(c.candidateId) + '">查看详情</button>' +
          '<button type="button" class="btn" data-act="diff-base" data-id="' + esc(c.candidateId) + '">Diff 左侧</button>' +
          '<button type="button" class="btn" data-act="diff-target" data-id="' + esc(c.candidateId) + '">Diff 右侧</button>' +
        '</footer>';

      root.appendChild(card);
    });

    root.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if (act === 'primary') {
          primaryCandidateId = id;
          renderAll();
        } else if (act === 'archive') {
          runResolve({ action: 'archive', archiveAssetId: id });
        } else if (act === 'detail' && SP.openSkillDetail) {
          SP.openSkillDetail(id, { originParams: location.search });
        } else if (act === 'diff-base') {
          diffBaseId = id;
          renderDiff();
          renderDiffSelectors();
        } else if (act === 'diff-target') {
          diffTargetId = id;
          renderDiff();
          renderDiffSelectors();
        }
      });
    });
  }

  function renderDiffSelectors() {
    const baseSel = document.getElementById('diff-base');
    const targetSel = document.getElementById('diff-target');
    if (!baseSel || !targetSel || !overview) return;
    const opts = overview.candidates.map(c =>
      '<option value="' + esc(c.candidateId) + '">' + esc(c.displayName || c.name) + '</option>'
    ).join('');
    baseSel.innerHTML = opts;
    targetSel.innerHTML = opts;
    baseSel.value = diffBaseId;
    targetSel.value = diffTargetId;
  }

  function renderDiff() {
    const el = document.getElementById('compare-diff');
    const meta = document.getElementById('compare-diff-meta');
    if (!el) return;
    const left = skillDetails[diffBaseId];
    const right = skillDetails[diffTargetId];
    const leftOk = left && left.readAccess && left.content != null;
    const rightOk = right && right.readAccess && right.content != null;

    if (meta) {
      const lc = (overview.candidates || []).find(c => c.candidateId === diffBaseId);
      const rc = (overview.candidates || []).find(c => c.candidateId === diffTargetId);
      meta.textContent =
        (lc ? (lc.displayName || lc.name) : 'A') + '  ↔  ' +
        (rc ? (rc.displayName || rc.name) : 'B');
    }

    if (!leftOk || !rightOk) {
      el.innerHTML = '<div class="sp-compare-empty">' +
        (!leftOk && !rightOk
          ? '两侧均无读取权限，无法展示 SKILL.md Diff（仅元数据可用）。'
          : (!leftOk ? '左侧无读取权限，无法生成 Diff。' : '右侧无读取权限，无法生成 Diff。')) +
        '</div>';
      return;
    }
    el.innerHTML = renderDiffHtml(lineDiffLines(left.content, right.content));
  }

  function renderFileSummary() {
    const el = document.getElementById('compare-file-summary');
    if (!el) return;
    if (!fileSummary || !fileSummary.files) {
      el.innerHTML = '<div class="sp-compare-empty">无文件摘要</div>';
      return;
    }
    el.innerHTML = '<table class="sp-compare-ftable"><thead><tr>' +
      '<th>路径</th><th>出现</th><th>Hash</th></tr></thead><tbody>' +
      fileSummary.files.map(f =>
        '<tr>' +
          '<td class="mono">' + esc(f.relativePath) + '</td>' +
          '<td>' + esc((f.presentIn || []).length + '/' + (overview.candidates || []).length) + '</td>' +
          '<td>' + (f.hashMatch ? '一致' : '不同/缺失') + '</td>' +
        '</tr>'
      ).join('') +
      '</tbody></table>';
  }

  function renderAll() {
    document.getElementById('not-found').hidden = true;
    document.getElementById('compare-body').hidden = false;
    const title = document.getElementById('compare-title');
    if (title) {
      title.textContent = '比较重复 Skill · ' + overview.candidates.length + ' 个候选';
    }
    renderEvidence();
    renderCandidates();
    renderDiffSelectors();
    renderDiff();
    renderFileSummary();
  }

  function isDestructiveAction(action) {
    return (
      action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance' ||
      action === 'merge-new' || action === 'merge_new' ||
      action === 'archive'
    );
  }

  function impactLines(impact) {
    if (!impact) return '无影响预览';
    const lines = [];
    if (impact.preservedAssetId) lines.push('保留 Asset UUID：' + impact.preservedAssetId);
    if (impact.newAssetId) lines.push('新 Asset UUID：' + impact.newAssetId);
    if (impact.mergedAwayAssets && impact.mergedAwayAssets.length) {
      lines.push('将被合并的 Asset：' + impact.mergedAwayAssets.join(', '));
    }
    if (impact.movedInstances && impact.movedInstances.length) {
      lines.push('将移动的 Instance：' + impact.movedInstances.length + ' 个');
    }
    if (impact.archivedAssetId) lines.push('将归档 Asset：' + impact.archivedAssetId);
    lines.push('Draft：' + (impact.draftCount != null ? impact.draftCount : '—'));
    lines.push('Snapshot：' + (impact.snapshotCount != null ? impact.snapshotCount : '—'));
    lines.push('PendingTask：' + (impact.pendingTaskCount != null ? impact.pendingTaskCount : '—'));
    lines.push('EditorSession：' + (impact.editorSessionCount != null ? impact.editorSessionCount : '—'));
    lines.push('Conflict：' + (impact.conflictCount != null ? impact.conflictCount : '—'));
    if (impact.sourceBindingImpact) lines.push('SourceBinding：' + JSON.stringify(impact.sourceBindingImpact));
    if (impact.categoryTagFavorite) lines.push('分类/标签/收藏差异：' + JSON.stringify(impact.categoryTagFavorite));
    return lines.join('\n');
  }

  function runResolve(opts) {
    const payload = Object.assign({
      sessionId: sessionId,
      groupId: (session && session.groupId) || groupParam || null,
      primaryAssetId: primaryCandidateId,
      candidateIds: (overview && overview.candidates || []).map(c => c.candidateId)
    }, opts);

    const messages = {
      'confirm-multi-instance': '已确认为同一 Asset 多实例（UUID 已保留）',
      'confirm_same_asset': '已确认为同一 Asset 多实例（UUID 已保留）',
      'multi-instance': '已确认为同一 Asset 多实例（UUID 已保留）',
      'keep-independent': '已保持独立 Asset',
      'keep_independent': '已保持独立 Asset',
      'keep-both': '已保持独立 Asset',
      archive: '已归档',
      ignore: '已忽略本次重复建议（未创建 Skill 级 IgnoreRule）',
      'ignore-duplicate': '已忽略本次重复建议（未创建 Skill 级 IgnoreRule）',
      ignore_suggestion: '已忽略本次重复建议（未创建 Skill 级 IgnoreRule）',
      'merge-new': '已合并为新 Asset',
      merge_new: '已合并为新 Asset'
    };

    if (isDestructiveAction(opts.action)) {
      if (!need('prepareDuplicateResolution') || !need('confirmDuplicateResolution')) return;
      const prep = SP.prepareDuplicateResolution(payload);
      if (!prep || !prep.ok) {
        toast((prep && (prep.error || prep.code)) || 'Prepare 失败');
        return;
      }
      const ok = confirm(
        '破坏性合并确认\n\n' + impactLines(prep.impact) +
        '\n\n确认前已创建 Batch Checkpoint。确定继续？'
      );
      if (!ok) {
        toast('已取消（Operation 保持 prepared，未写入）');
        return;
      }
      const res = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
      if (!res || !res.ok) {
        const code = res && res.code;
        toast(
          code === 'operation_stale'
            ? 'Operation 已过期（候选状态变化），请重新 Prepare'
            : ((res && (res.error || res.code)) || '确认失败')
        );
        return;
      }
      toast(messages[opts.action] || '已处理');
      setTimeout(goBack, 650);
      return;
    }

    if (!need('resolveDuplicateComparison')) return;
    const res = SP.resolveDuplicateComparison(payload);
    if (!res || !res.ok) {
      toast((res && res.error) || '操作失败');
      return;
    }
    if (res.ignoreRuleCreated) toast('警告：不应创建 IgnoreRule');
    toast(messages[opts.action] || '已处理');
    setTimeout(goBack, 650);
  }

  function bindActions() {
    document.getElementById('btn-back')?.addEventListener('click', goBack);
    document.getElementById('act-multi')?.addEventListener('click', () => {
      runResolve({ action: 'confirm-multi-instance', primaryAssetId: primaryCandidateId });
    });
    document.getElementById('act-independent')?.addEventListener('click', () => {
      runResolve({ action: 'keep-independent' });
    });
    document.getElementById('act-ignore')?.addEventListener('click', () => {
      runResolve({ action: 'ignore' });
    });
    document.getElementById('act-merge-new')?.addEventListener('click', () => {
      runResolve({ action: 'merge-new' });
    });
    document.getElementById('act-archive-left')?.addEventListener('click', () => {
      const leftId =
        (leftParam && SP.resolveAssetId ? (SP.resolveAssetId(leftParam) || leftParam) : null) ||
        diffBaseId ||
        (overview && overview.candidates[0] && overview.candidates[0].candidateId) ||
        primaryCandidateId;
      if (!leftId) {
        toast('无法确定左侧候选');
        return;
      }
      runResolve({ action: 'archive', archiveAssetId: leftId });
    });
    document.getElementById('diff-base')?.addEventListener('change', e => {
      diffBaseId = e.target.value;
      renderDiff();
    });
    document.getElementById('diff-target')?.addEventListener('change', e => {
      diffTargetId = e.target.value;
      renderDiff();
    });
  }

  function init() {
    updateSidebar();
    bindActions();
    if (!ensureSession()) return;
    if (!loadOverview()) return;
    loadSkillMdBodies();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
