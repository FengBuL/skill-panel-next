/* Phase F.1 Install page — single Asset multi-Instance, Rebind, Existing Asset picker */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const STEPS = ['source-input', 'resolving', 'validated', 'target-selection', 'conflict-check', 'confirmation', 'installing', 'verifying', 'completed'];
  let stage = 'source-input';
  let resolved = null;
  let prep = null;
  let selectedHosts = ['claude'];
  let mode = 'new-asset';
  let existingAssetId = null;
  let existingInstanceId = null;
  let result = null;

  function toast(m) { if (SP.toast) SP.toast(m); }
  function esc(s) { return SP.$escape(String(s == null ? '' : s)); }
  function prop(k, v) {
    return '<div class="sp-f-prop"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
  }

  function renderSteps() {
    document.getElementById('steps').innerHTML = STEPS.map(s =>
      '<span class="' + (s === stage ? 'active' : '') + '">' + esc(s) + '</span>'
    ).join('');
  }

  function assetOptionsHtml() {
    const list = typeof SP.listInstallableAssets === 'function'
      ? SP.listInstallableAssets()
      : (SP.getAssets ? SP.getAssets().filter(a => a.lifecycleStatus !== 'deleted' && a.lifecycleStatus !== 'archived') : []);
    return '<option value="">选择 Existing Asset…</option>' + list.map(a =>
      '<option value="' + esc(a.id) + '"' + (existingAssetId === a.id ? ' selected' : '') + '>' +
      esc(a.displayName || a.name) + ' · ' + esc(String(a.id).slice(0, 8)) + '</option>'
    ).join('');
  }

  function rebindInstanceOptionsHtml(assetId) {
    if (!assetId || !SP.getAssetInstances) return '<option value="">先选择 Asset</option>';
    const insts = (SP.getAssetInstances(assetId) || []).filter(i =>
      i.lifecycleStatus === 'missing' || i.lifecycleStatus === 'stopped'
    );
    if (!insts.length) return '<option value="">无可 Rebind 的 Missing/Stopped Instance</option>';
    return '<option value="">选择 Instance…</option>' + insts.map(i =>
      '<option value="' + esc(i.id) + '"' + (existingInstanceId === i.id ? ' selected' : '') + '>' +
      esc(i.hostType) + ' · ' + esc(i.lifecycleStatus) + ' · ' + esc(i.skillFilePath || i.rootPath || i.id) +
      '</option>'
    ).join('');
  }

  function render() {
    renderSteps();
    const body = document.getElementById('body');
    if (stage === 'source-input' || stage === 'resolving') {
      body.innerHTML =
        '<label style="display:grid;gap:6px;font-size:13px">来源（GitHub / Git URL / ZIP URL / Local）' +
        '<input class="input" id="source-input" value="' + esc(params.get('source') || 'github:acme/hello-skill') + '" /></label>' +
        '<div class="sp-f-actions"><button type="button" class="btn btn-primary" id="btn-resolve">解析来源</button></div>' +
        '<p style="font-size:12px;color:var(--meta)">确定性模拟，不发起真实网络请求，不执行脚本或依赖安装。</p>';
      document.getElementById('btn-resolve').onclick = () => {
        stage = 'resolving'; renderSteps();
        resolved = SP.resolveInstallSource(document.getElementById('source-input').value);
        stage = resolved.ok ? 'validated' : 'source-input';
        if (!resolved.ok) toast(resolved.error || '解析失败');
        render();
      };
      return;
    }

    if (stage === 'validated' || stage === 'target-selection' || stage === 'conflict-check') {
      const r = resolved;
      body.innerHTML =
        '<dl class="sp-f-props">' +
        prop('来源类型', r.sourceType) + prop('Repository / URL', r.repository || r.sourceUrl) +
        prop('Branch / Version / Commit', [r.branch, r.version, r.commit].filter(Boolean).join(' · ') || '—') +
        prop('Trust Policy', r.trustPolicy) +
        prop('文件', r.counts.total + '（文本 ' + r.counts.text + ' · 二进制 ' + r.counts.binary + ' · Nested ' + r.counts.nested + '）') +
        '</dl>' +
        '<div class="sp-f-tree">' + r.fileTree.map(f => esc(f.relativePath) + (f.executable ? ' · exec' : '') + (f.nested ? ' · nested' : '')).join('<br>') + '</div>' +
        '<div class="sp-f-warn"><strong>风险</strong><ul>' + (r.risks || []).map(x => '<li>' + esc(x.message) + '</li>').join('') + '</ul></div>' +
        '<div><strong style="font-size:13px">目标 Host / 目录</strong><div id="hosts" style="margin-top:8px;display:grid;gap:6px"></div></div>' +
        '<div style="margin-top:12px"><strong style="font-size:13px">安装决策</strong>' +
        '<div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">' +
        '<label><input type="radio" name="mode" value="new-asset" ' + (mode === 'new-asset' ? 'checked' : '') + '/> 新 Asset（多 Host → 同一 UUID 多 Instance）</label>' +
        '<label><input type="radio" name="mode" value="add-instance" ' + (mode === 'add-instance' ? 'checked' : '') + '/> 现有 Asset 新 Instance</label>' +
        '<label><input type="radio" name="mode" value="rebind" ' + (mode === 'rebind' ? 'checked' : '') + '/> Rebind Missing/Stopped</label>' +
        '</div>' +
        '<div id="mode-extra" style="margin-top:10px;display:grid;gap:8px"></div></div>' +
        '<div class="sp-f-actions">' +
        '<button type="button" class="btn" id="btn-back-src">返回</button>' +
        '<button type="button" class="btn btn-primary" id="btn-prepare">检查并准备安装</button></div>';

      const hosts = SP.getHosts().filter(h => h.enabled !== false && h.hostType !== 'archive');
      document.getElementById('hosts').innerHTML = hosts.map(h =>
        '<label><input type="checkbox" data-host="' + esc(h.id) + '" ' + (selectedHosts.includes(h.id) ? 'checked' : '') + '/> ' +
        esc(h.name) + ' · <span class="mono">' + esc(h.path) + '</span> · 权限 ' + esc(h.permissionStatus) + '</label>'
      ).join('');

      function paintModeExtra() {
        const box = document.getElementById('mode-extra');
        if (mode === 'new-asset') {
          box.innerHTML = '<p style="font-size:12px;color:var(--meta);margin:0">多 Host 将聚合为一个 Asset；成功目标各创建一个 Instance；共享同一官方 SourceBinding。</p>';
          return;
        }
        box.innerHTML =
          '<label style="display:grid;gap:4px;font-size:13px">Existing Asset<select class="input" id="existing-asset">' + assetOptionsHtml() + '</select></label>' +
          (mode === 'rebind'
            ? '<label style="display:grid;gap:4px;font-size:13px">Rebind Instance<select class="input" id="existing-instance">' +
              rebindInstanceOptionsHtml(existingAssetId) + '</select></label>' +
              '<p style="font-size:12px;color:var(--meta);margin:0">保留 Asset UUID 与 Instance UUID，仅更新路径 / Host / 文件索引。</p>'
            : '<p style="font-size:12px;color:var(--meta);margin:0">新来源若与主 Asset 不同，将创建 Instance 级 Binding 并标记 sourceDivergence，不覆盖官方来源。</p>');
        const sel = document.getElementById('existing-asset');
        if (sel) {
          sel.onchange = () => {
            existingAssetId = sel.value || null;
            existingInstanceId = null;
            paintModeExtra();
          };
        }
        const isel = document.getElementById('existing-instance');
        if (isel) isel.onchange = () => { existingInstanceId = isel.value || null; };
      }

      document.querySelectorAll('input[name="mode"]').forEach(rdo => {
        rdo.onchange = () => { mode = rdo.value; paintModeExtra(); };
      });
      paintModeExtra();

      document.getElementById('btn-back-src').onclick = () => { stage = 'source-input'; render(); };
      document.getElementById('btn-prepare').onclick = () => {
        selectedHosts = [...document.querySelectorAll('#hosts input:checked')].map(x => x.dataset.host);
        mode = (document.querySelector('input[name="mode"]:checked') || {}).value || 'new-asset';
        const ea = document.getElementById('existing-asset');
        existingAssetId = ea ? (ea.value || null) : existingAssetId;
        const ei = document.getElementById('existing-instance');
        existingInstanceId = ei ? (ei.value || null) : existingInstanceId;
        stage = 'conflict-check';
        prep = SP.prepareInstall({
          resolved,
          hostIds: selectedHosts,
          mode,
          existingAssetId,
          existingInstanceId
        });
        if (!prep.ok) {
          toast(prep.error || prep.code);
          stage = 'target-selection';
          render();
          return;
        }
        stage = 'confirmation';
        render();
      };
      return;
    }

    if (stage === 'confirmation') {
      const sameAssetNote = mode === 'new-asset' && (prep.targets || []).length > 1
        ? '多 Host 将写入<strong>同一个</strong> Asset UUID，下挂多个 Instance。'
        : '';
      body.innerHTML =
        '<div class="sp-f-warn">确认前不会修改 Formal Index。安装为原型模拟，不执行脚本。' +
        (sameAssetNote ? '<br>' + sameAssetNote : '') + '</div>' +
        '<dl class="sp-f-props">' +
        prop('Operation', prep.operationId) +
        prop('模式', mode) +
        prop('Existing Asset', existingAssetId || '—') +
        prop('Rebind Instance', existingInstanceId || '—') +
        prop('目标', (prep.targets || []).map(t => t.hostName + ' → ' + t.targetPath).join('；')) +
        prop('问题', (prep.issues || []).length ? prep.issues.map(i => i.message || i.code).join('；') : '无') +
        '</dl>' +
        '<div class="sp-f-actions">' +
        '<button type="button" class="btn" id="btn-cancel">取消</button>' +
        '<button type="button" class="btn btn-primary" id="btn-confirm">确认安装</button></div>';
      document.getElementById('btn-cancel').onclick = () => { stage = 'validated'; prep = null; render(); };
      document.getElementById('btn-confirm').onclick = () => {
        stage = 'installing'; renderSteps();
        result = SP.confirmInstall(prep.operationId, { userConfirmed: true });
        stage = 'completed';
        render();
      };
      return;
    }

    const assetIds = [...new Set(((result && result.results) || []).map(r => r.assetId).filter(Boolean))];
    body.innerHTML =
      '<dl class="sp-f-props">' +
      prop('结果', (result && result.status) || '—') +
      prop('Operation', (result && result.operationId) || (prep && prep.operationId) || '—') +
      prop('Asset 数（本操作）', String(assetIds.length)) +
      prop('Asset UUID', assetIds.join(', ') || '—') +
      '</dl>' +
      '<div class="sp-f-tree">' + ((result && result.results) || []).map(r =>
        esc(r.hostId || r.scope || '') + ' · ' + esc(r.status) +
        (r.assetId ? ' · asset ' + esc(String(r.assetId).slice(0, 8)) : '') +
        (r.instanceId ? ' · inst ' + esc(String(r.instanceId).slice(0, 8)) : '') +
        (r.snapshotId ? ' · snap ' + esc(String(r.snapshotId).slice(0, 8)) : '') +
        (r.sourceDivergence ? ' · sourceDivergence' : '') +
        (r.rollbackStatus ? ' · rollback ' + esc(r.rollbackStatus) : '') +
        (r.message ? ' · ' + esc(r.message) : '')
      ).join('<br>') + '</div>' +
      (mode === 'rebind'
        ? '<div class="sp-f-warn">Rebind 失败时完整回滚 Instance / 文件 / Binding / 权限；不保留半成品。</div>'
        : '') +
      '<div class="sp-f-actions"><a class="btn btn-primary" href="index.html">返回 Library</a></div>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-back').onclick = () => SP.returnToOrigin('index.html');
    render();
  });
})();
