/* Phase F.4 Update page — Preview strategies + explicit write permission + Prepare/Confirm */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const skillHint = params.get('skill');
  let check = null;
  let preview = null;
  let prep = null;
  let result = null;
  let selectedInstances = [];
  let fileStrategies = {};
  let threeWay = null;
  let lockedOperationId = null;

  function toast(m) { if (SP.toast) SP.toast(m); }
  function esc(s) { return SP.$escape(String(s == null ? '' : s)); }
  function prop(k, v) {
    return '<div class="sp-f-prop"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
  }
  function shortHash(h) {
    if (!h) return '—';
    const s = String(h);
    return s.length > 14 ? s.slice(0, 8) + '…' + s.slice(-4) : s;
  }
  function linesHtml(lines) {
    return (lines || []).map(l => {
      const cls = l.type === 'add' ? 'add' : (l.type === 'del' ? 'del' : '');
      const p = l.type === 'add' ? '+' : (l.type === 'del' ? '-' : ' ');
      return '<div class="' + cls + '">' + esc(p + (l.text || '')) + '</div>';
    }).join('');
  }

  function gatherStrategiesFromDom() {
    const next = {};
    document.querySelectorAll('[data-strategy-path]').forEach(sel => {
      next[sel.dataset.strategyPath] = sel.value;
    });
    return next;
  }

  function gatherInstancesFromDom() {
    return [...document.querySelectorAll('#insts input[data-id]:checked')].map(x => x.dataset.id);
  }

  function defaultStrategyForFile(f) {
    if (f.changeType === 'added') return 'use-remote';
    if (f.changeType === 'deleted') return 'use-remote';
    if (f.isBinary || f.changeType === 'binary-changed') return 'use-remote';
    return 'use-remote';
  }

  function strategyOptionsHtml(f, selected) {
    const allowed = f.allowedStrategies || (f.isBinary
      ? ['use-remote', 'keep-local', 'defer']
      : ['use-remote', 'keep-local', 'manual-merge', 'defer']);
    const labels = {
      'use-remote': f.changeType === 'added' ? '添加远程文件' : (f.changeType === 'deleted' ? '接受删除' : '使用远程版本'),
      'keep-local': f.changeType === 'deleted' ? '保留本地' : '保留本地版本',
      'manual-merge': f.changeType === 'added' ? '创建 Manual Merge Draft' : '创建合并 Draft',
      defer: f.changeType === 'added' ? '暂不添加' : (f.changeType === 'deleted' ? '暂不处理' : '暂不处理')
    };
    return '<select data-strategy-path="' + esc(f.relativePath) + '" data-change-type="' + esc(f.changeType) + '">' +
      allowed.map(s =>
        '<option value="' + esc(s) + '"' + (selected === s ? ' selected' : '') + '>' + esc(labels[s] || s) + '</option>'
      ).join('') +
      '</select>';
  }

  function cancelPrep() {
    if (lockedOperationId && SP.cancelUpdateOperation) {
      SP.cancelUpdateOperation(lockedOperationId);
    } else if (prep && prep.operationId && SP.cancelUpdateOperation) {
      SP.cancelUpdateOperation(prep.operationId);
    }
    prep = null;
    lockedOperationId = null;
    threeWay = null;
  }

  function ensurePreview(assetId) {
    if (!SP.getUpdatePlanPreview) return null;
    const ids = selectedInstances.length ? selectedInstances : undefined;
    return SP.getUpdatePlanPreview({ assetId, instanceIds: ids });
  }

  function blockedWriteInstances(previewInsts) {
    const selected = new Set(selectedInstances);
    return (previewInsts || []).filter(i => selected.has(i.id) && !i.writeAccess);
  }

  function buildRemoteListsFromStrategies(files, strategies) {
    const selectedPaths = new Set();
    const addPaths = new Set();
    const deletePaths = new Set();

    for (const file of files || []) {
      if (!strategies[file.relativePath]) continue;

      if (file.changeType === 'added') {
        addPaths.add(file.relativePath);
      } else if (file.changeType === 'deleted') {
        deletePaths.add(file.relativePath);
      } else if (
        file.changeType === 'modified' ||
        file.changeType === 'binary-changed'
      ) {
        selectedPaths.add(file.relativePath);
      }
    }

    return {
      selectedRelativePaths: [...selectedPaths],
      remoteAdds: [...addPaths].map(relativePath => ({ relativePath })),
      remoteDeletes: [...deletePaths]
    };
  }

  function instanceSummaryHtml(f, targetCount) {
    const states = f.instanceStates || [];
    const total = states.length || targetCount || 0;
    const existsCount = states.filter(s => s.localExists).length;
    const differs = states.some(s => s.differsFromOtherInstances);
    const localModCount = states.filter(s =>
      s.localModificationStatus && s.localModificationStatus !== 'clean'
    ).length;
    const path = f.relativePath;
    return '<div data-instance-summary="' + esc(path) + '">存在于 ' + existsCount + ' / ' + total + ' 个目标 Instance</div>' +
      '<div data-instance-difference="' + esc(path) + '">' +
      (differs ? '目标 Instance 内容存在差异' : '目标 Instance 内容一致') +
      '</div>' +
      '<div data-instance-local-modifications="' + esc(path) + '">' +
      localModCount + ' 个 Instance 存在本地修改</div>';
  }

  function renderPreview(body, assetId, instances) {
    if (!selectedInstances.length) selectedInstances = instances.map(i => i.id);
    preview = ensurePreview(assetId) || preview;
    if (!preview || !preview.ok) {
      body.innerHTML = '<div class="sp-f-warn">无法生成更新 Preview</div>';
      return;
    }

    (preview.files || []).forEach(f => {
      if (fileStrategies[f.relativePath] == null) fileStrategies[f.relativePath] = defaultStrategyForFile(f);
    });

    const blocked = blockedWriteInstances(preview.instances);
    const canPrepare = selectedInstances.length > 0 && blocked.length === 0;

    body.innerHTML =
      '<div class="sp-f-warn">步骤 1 · Preview（无需写权限）。选择 Instance 与每文件策略后，再 Prepare 可写 Operation。</div>' +
      '<dl class="sp-f-props">' +
      prop('当前/基线版本', preview.baselineVersion || check.baselineVersion) +
      prop('远程版本', preview.remoteVersion || check.remoteVersion) +
      prop('Trust', preview.trustPolicy || check.trustPolicy) +
      '</dl>' +
      '<div><strong style="font-size:13px">目标 Instance</strong>' +
      '<div id="insts" style="margin-top:8px;display:grid;gap:8px"></div></div>' +
      (blocked.length
        ? '<div class="sp-f-warn" id="perm-block">无写权限，不能 Prepare：' +
          blocked.map(b => esc(b.hostType) + ' · ' + esc(String(b.id).slice(0, 8))).join('；') +
          '。可查看 Preview；请点击「申请写权限」。</div>'
        : '') +
      '<div style="margin-top:4px"><strong style="font-size:13px">文件变化与策略</strong>' +
      '<div id="pre-files" style="margin-top:8px;display:grid;gap:10px"></div></div>' +
      '<div class="sp-f-actions">' +
      '<button type="button" class="btn btn-primary" id="btn-prep"' + (canPrepare ? '' : ' disabled') +
      '>准备可应用更新</button></div>';

    document.getElementById('insts').innerHTML = (preview.instances || instances.map(i => {
      const perm = SP.getInstancePermission ? SP.getInstancePermission(i.id) : {};
      return {
        id: i.id, hostType: i.hostType, path: i.skillFilePath || i.rootPath,
        readAccess: !!(perm && perm.readAccess), writeAccess: !!(perm && perm.writeAccess),
        permissionMode: (perm && perm.permissionMode) || i.permissionMode,
        scopePaths: (perm && perm.scopePaths) || []
      };
    })).map(i => {
      const checked = selectedInstances.includes(i.id);
      return '<div class="sp-f-inst-row" style="border:1px solid var(--border-soft);border-radius:8px;padding:8px 10px;font-size:12px">' +
        '<label style="display:flex;gap:8px;align-items:flex-start">' +
        '<input type="checkbox" data-id="' + esc(i.id) + '"' + (checked ? ' checked' : '') + '/>' +
        '<span><strong>' + esc(i.hostType) + '</strong> · ' + esc(i.path || '') + '<br/>' +
        'Read: ' + (i.readAccess ? '是' : '否') +
        ' · Write: ' + (i.writeAccess ? '是' : '否') +
        ' · Mode: ' + esc(i.permissionMode || '—') +
        ' · Scope: ' + esc((i.scopePaths || []).join(', ') || 'instance') +
        '</span></label>' +
        (i.writeAccess ? '' :
          '<div style="margin-top:6px"><button type="button" class="btn" data-request-write="' + esc(i.id) +
          '">申请写权限</button></div>') +
        '</div>';
    }).join('') || '<div>无可用 Instance</div>';

    const targetCount = (preview.instances || []).length;
    document.getElementById('pre-files').innerHTML = (preview.files || []).map(f => {
      const cur = fileStrategies[f.relativePath] || defaultStrategyForFile(f);
      return '<div class="sp-f-file-row" data-file-path="' + esc(f.relativePath) + '" style="border:1px solid var(--border-soft);border-radius:8px;padding:10px;font-size:12px;display:grid;gap:6px">' +
        '<div><strong>' + esc(f.relativePath) + '</strong> · ' + esc(f.changeType) +
        (f.isBinary ? ' · binary' : '') +
        (f.hasLocalModification ? ' · 存在本地修改' : '') + '</div>' +
        instanceSummaryHtml(f, targetCount) +
        '<div>Local Hash ' + esc(shortHash(f.localHash)) + ' · Remote Hash ' + esc(shortHash(f.remoteHash)) + '</div>' +
        '<div>Local Size ' + esc(String(f.localSize != null ? f.localSize : '—')) +
        ' · Remote Size ' + esc(String(f.remoteSize != null ? f.remoteSize : '—')) + '</div>' +
        '<div>策略 ' + strategyOptionsHtml(f, cur) + '</div></div>';
    }).join('') || '<div style="color:var(--meta)">无文件变化</div>';

    document.querySelectorAll('#insts input[data-id]').forEach(cb => {
      cb.onchange = () => {
        selectedInstances = gatherInstancesFromDom();
        fileStrategies = Object.assign(fileStrategies, gatherStrategiesFromDom());
        preview = null;
        render();
      };
    });
    document.querySelectorAll('[data-request-write]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-request-write');
        const res = SP.requestWritePermission({ instanceId: id, purpose: 'update' });
        if (!res || !res.ok) toast((res && (res.error || res.code)) || '申请失败');
        else toast('已授予写权限');
        preview = null;
        render();
      };
    });
    document.querySelectorAll('[data-strategy-path]').forEach(sel => {
      sel.onchange = () => {
        fileStrategies = gatherStrategiesFromDom();
      };
    });

    document.getElementById('btn-prep').onclick = () => {
      // MUST gather from DOM — never auto-grant write permission here
      selectedInstances = gatherInstancesFromDom();
      fileStrategies = gatherStrategiesFromDom();
      if (!selectedInstances.length) { toast('请选择至少一个 Instance'); return; }
      const blockedNow = blockedWriteInstances(
        (preview && preview.instances) || selectedInstances.map(id => {
          const perm = SP.getInstancePermission(id) || {};
          return { id, writeAccess: !!perm.writeAccess, hostType: '' };
        })
      );
      if (blockedNow.length) {
        toast('选中目标缺少写权限，请先申请写权限');
        return;
      }
      const lists = buildRemoteListsFromStrategies(preview.files || [], fileStrategies);
      prep = SP.prepareUpdate({
        assetId,
        instanceIds: selectedInstances,
        selectedRelativePaths: lists.selectedRelativePaths,
        fileStrategies,
        remoteAdds: lists.remoteAdds,
        remoteDeletes: lists.remoteDeletes
      });
      if (!prep.ok && prep.updateStatus !== 'up-to-date') {
        toast(prep.error || prep.code);
        prep = null;
        return;
      }
      if (prep.updateStatus === 'up-to-date') {
        toast('无更新');
        check = prep;
        prep = null;
        render();
        return;
      }
      lockedOperationId = prep.operationId;
      if (prep.fileStrategies) fileStrategies = Object.assign({}, prep.fileStrategies);
      const skillMd = (prep.fileSummary || []).find(f => f.relativePath === 'SKILL.md') ||
        ((preview.files || []).find(f => f.relativePath === 'SKILL.md'));
      threeWay = skillMd ? SP.getUpdateThreeWayDiff(prep.operationId, 'SKILL.md') : null;
      render();
    };
  }

  function renderConfirm(body) {
    const frozen = prep.fileStrategies || fileStrategies;
    body.innerHTML =
      '<div class="sp-f-warn">步骤 3 · Confirm。选择已锁定。Confirm 仅传 userConfirmed。</div>' +
      '<dl class="sp-f-props">' +
      prop('Operation ID', lockedOperationId) +
      prop('快照', (prep.snapshotIds || []).join(', ')) +
      prop('远程版本', prep.remoteVersion) +
      prop('目标 Instance', (prep.targets || []).map(t => String(t.instanceId).slice(0, 8)).join(', ')) +
      '</dl>' +
      '<div><strong style="font-size:13px">已冻结的文件策略（只读）</strong>' +
      '<div id="files" style="margin-top:8px;display:grid;gap:8px"></div></div>' +
      (threeWay ? ('<div><strong style="font-size:13px">Base → Local</strong><div class="sp-f-diff">' + linesHtml(threeWay.baseToLocal) +
        '</div><strong style="font-size:13px">Local → Remote</strong><div class="sp-f-diff">' + linesHtml(threeWay.localToRemote) + '</div></div>') : '') +
      '<div class="sp-f-actions">' +
      '<button type="button" class="btn" id="btn-cancel">取消 Operation</button>' +
      '<button type="button" class="btn" id="btn-modify">修改选择</button>' +
      '<button type="button" class="btn btn-primary" id="btn-confirm" data-operation-id="' +
      esc(lockedOperationId) + '">确认更新</button></div>';

    const summary = prep.fileSummary || [];
    const paths = Object.keys(frozen);
    document.getElementById('files').innerHTML = paths.map(p => {
      const meta = summary.find(f => f.relativePath === p) || {};
      return '<div class="sp-f-file-row" style="font-size:13px;border:1px solid var(--border-soft);border-radius:8px;padding:8px 10px">' +
        '<div><strong>' + esc(p) + '</strong> · ' + esc(frozen[p]) +
        (meta.changed ? ' · changed' : '') + '</div></div>';
    }).join('') || '<div>无冻结策略</div>';

    document.getElementById('btn-cancel').onclick = () => { cancelPrep(); render(); };
    document.getElementById('btn-modify').onclick = () => {
      toast('已取消当前 Operation，返回 Preview');
      cancelPrep();
      render();
    };
    document.getElementById('btn-confirm').onclick = () => {
      const opId = lockedOperationId;
      result = SP.confirmUpdate(opId, { userConfirmed: true });
      if (result && result.operationId && result.operationId !== opId) {
        toast('错误：Confirm 返回了不同的 Operation ID');
      }
      if (!result.ok && (result.code === 'operation_tampered' || result.code === 'conflict' || result.code === 'permission-denied')) {
        toast(result.error || result.code);
      }
      render();
    };
  }

  function renderResult(body, assetId) {
    const resultOpId = result.operationId || lockedOperationId;
    const drafts = (result.results || []).reduce((n, r) =>
      n + ((r.files || []).filter(f => f.status === 'manual-merge').length), 0);
    const deferredCount = (result.results || []).reduce((n, r) =>
      n + ((r.files || []).filter(f => f.status === 'deferred').length), 0);
    const keptCount = (result.results || []).reduce((n, r) =>
      n + ((r.files || []).filter(f => f.status === 'kept-local').length), 0);
    let headline = '更新结果';
    let actions = '<a class="btn btn-primary" href="index.html">返回 Library</a>';
    if (result.status === 'awaiting-merge') {
      headline = '更新待合并（非“更新已完成”）';
      actions =
        '<a class="btn btn-primary" href="skill-editor.html?skill=' + encodeURIComponent(assetId) + '&dev=1">打开 Editor 完成合并</a>' +
        '<a class="btn" href="skill-detail.html?skill=' + encodeURIComponent(assetId) + '&dev=1">返回 Detail</a>';
    } else if (result.status === 'partially-completed' || deferredCount) {
      headline = '部分完成 · 仍有暂缓文件';
      actions =
        '<button type="button" class="btn btn-primary" id="btn-continue-later">稍后继续</button>' +
        '<a class="btn" href="index.html">返回 Library</a>';
    } else if (result.hasLocalModifications) {
      headline = '已完成 · 保留本地修改';
      actions =
        '<a class="btn" href="skill-detail.html?skill=' + encodeURIComponent(assetId) + '&dev=1">查看本地与 Baseline 差异</a>' +
        '<a class="btn btn-primary" href="index.html">返回 Library</a>';
    } else if (result.status === 'completed') {
      headline = '已使用远程版本 · Baseline 已更新';
    }

    body.innerHTML =
      '<div class="sp-f-warn"><strong>' + esc(headline) + '</strong></div>' +
      '<dl class="sp-f-props">' +
      prop('状态', result.status) +
      prop('Operation ID', resultOpId) +
      prop('与 Diff 页一致', String(resultOpId === lockedOperationId)) +
      (result.hasLocalModifications != null ? prop('本地修改', String(!!result.hasLocalModifications)) : '') +
      (keptCount ? prop('保留本地文件数', String(keptCount)) : '') +
      (result.unresolvedMergeCount != null ? prop('未合并数', String(result.unresolvedMergeCount)) : '') +
      (drafts ? prop('Draft 数', String(drafts)) : '') +
      (deferredCount ? prop('暂缓文件数', String(deferredCount)) : '') +
      '</dl>' +
      '<div class="sp-f-diff" id="update-result">' + ((result.results || []).map(r =>
        esc(r.instanceId) + ' · ' + esc(r.status) +
        (r.localModificationStatus ? ' · local=' + esc(r.localModificationStatus) : '') +
        ' · ' + ((r.files || []).map(f => f.relativePath + ':' + f.status).join(', '))
      ).join('\n')) + '</div>' +
      '<div class="sp-f-actions">' + actions + '</div>';
    const later = document.getElementById('btn-continue-later');
    if (later) {
      later.onclick = () => {
        result = null;
        cancelPrep();
        preview = null;
        check = SP.checkForUpdates(skillHint);
        render();
      };
    }
  }

  function render() {
    const body = document.getElementById('body');
    if (!skillHint) {
      body.innerHTML = '<div class="sp-editor-empty">缺少 skill 参数</div>';
      return;
    }
    const assetId = SP.resolveAssetId(skillHint) || skillHint;
    const instances = (SP.getAssetInstances(assetId) || []).filter(i =>
      i.lifecycleStatus !== 'missing' && i.lifecycleStatus !== 'deleted'
    );

    if (!check) check = SP.checkForUpdates(skillHint);

    if (check.updateStatus === 'up-to-date' || check.updateStatus === 'no-source') {
      body.innerHTML = '<dl class="sp-f-props">' +
        prop('状态', check.updateStatus) +
        prop('说明', check.message || '无更新，不创建写入 Operation') +
        '</dl><div class="sp-f-actions"><button type="button" class="btn" id="btn-force">强制检查候选</button></div>';
      document.getElementById('btn-force').onclick = () => {
        SP.loadUpdateDemoCase('update-available');
        check = SP.checkForUpdates(skillHint);
        preview = null;
        render();
      };
      return;
    }

    if (result) {
      renderResult(body, assetId);
      return;
    }
    if (prep && lockedOperationId) {
      renderConfirm(body);
      return;
    }
    renderPreview(body, assetId, instances);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-back').onclick = () => SP.returnToOrigin('index.html');
    render();
  });
})();
