/* Phase F.1 Uninstall page — four modes strictly separated */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const skillHint = params.get('skill');
  let mode = 'stop-managing';
  let selected = [];
  let deleteFiles = false;
  let prep = null;
  let result = null;
  let needSecondUi = false;

  function toast(m) { if (SP.toast) SP.toast(m); }
  function esc(s) { return SP.$escape(String(s == null ? '' : s)); }
  function prop(k, v) { return '<div class="sp-f-prop"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; }

  const MODE_HELP = {
    'stop-managing': 'Instance → stopped。保留 Formal Index 文件记录。不声称删除磁盘文件。',
    'remove-from-host': '标记为 removed-from-host-simulated。真实宿主文件未被删除。与 Stop Managing 分开建模。',
    'delete-local-copy': '高风险：移除 Formal Index 文件记录，Instance → deleted。自动进入二次确认。当前仍不声称真实磁盘删除。',
    'detach-source': '只解除 Asset / Instance SourceBinding。不修改 Instance / Asset 生命周期，不删除文件或草稿，保留历史 Baseline Snapshot。'
  };

  function render() {
    const body = document.getElementById('body');
    if (!skillHint) {
      body.innerHTML = '<div>缺少 skill 参数</div>';
      return;
    }
    const assetId = SP.resolveAssetId(skillHint) || skillHint;
    const instances = SP.getAssetInstances(assetId) || [];

    if (!prep && !result) {
      body.innerHTML =
        '<div class="sp-f-warn">四种模式严格分离。默认不删除宿主文件。Delete Local Copy 自动进入二次确认保护。</div>' +
        '<div><strong style="font-size:13px">模式</strong><div style="margin-top:8px;display:grid;gap:8px">' +
        Object.keys(MODE_HELP).map(m =>
          '<label style="display:grid;gap:2px"><span><input type="radio" name="mode" value="' + m + '" ' +
          (mode === m ? 'checked' : '') + '/> <strong>' + esc(m) + '</strong></span>' +
          '<span style="font-size:12px;color:var(--meta);padding-left:22px">' + esc(MODE_HELP[m]) + '</span></label>'
        ).join('') +
        '</div></div>' +
        '<div id="inst-wrap"><strong style="font-size:13px">Instance 范围</strong><div id="inst" style="margin-top:8px;display:grid;gap:4px"></div></div>' +
        '<div class="sp-f-actions"><button type="button" class="btn btn-primary" id="btn-prep">准备</button></div>';

      function paintInst() {
        const wrap = document.getElementById('inst-wrap');
        if (mode === 'detach-source') {
          wrap.innerHTML = '<div class="sp-f-warn">Detach Source 不显示 Instance 删除范围：不会停止或删除任何 Instance。</div>';
          return;
        }
        wrap.innerHTML = '<strong style="font-size:13px">Instance 范围</strong><div id="inst" style="margin-top:8px;display:grid;gap:6px"></div>';
        document.getElementById('inst').innerHTML = instances.map(i =>
          '<label><input type="checkbox" data-id="' + esc(i.id) + '" checked/> ' +
          esc(i.hostType) + ' · ' + esc(i.lifecycleStatus) + ' · ' + esc(i.skillFilePath || i.rootPath) +
          ' · files ' + esc(i.fileCount) + '</label>'
        ).join('') || '<div>无 Instance</div>';
      }

      document.querySelectorAll('input[name="mode"]').forEach(r => {
        r.onchange = () => { mode = r.value; paintInst(); };
      });
      paintInst();

      document.getElementById('btn-prep').onclick = () => {
        mode = (document.querySelector('input[name="mode"]:checked') || {}).value || 'stop-managing';
        selected = mode === 'detach-source'
          ? []
          : [...document.querySelectorAll('#inst input:checked')].map(x => x.dataset.id);
        deleteFiles = mode === 'delete-local-copy';
        needSecondUi = mode === 'delete-local-copy' || deleteFiles;
        prep = SP.prepareUninstall({
          assetId,
          mode,
          instanceIds: selected,
          deleteFiles
        });
        if (!prep.ok) { toast(prep.error || prep.code); prep = null; return; }
        render();
      };
      return;
    }

    if (prep && !result) {
      body.innerHTML =
        '<dl class="sp-f-props">' +
        prop('Operation', prep.operationId) +
        prop('模式', prep.mode) +
        prop('影响 Instance', mode === 'detach-source' ? 0 : prep.impact.instanceCount) +
        prop('剩余 Instance', prep.impact.remainingInstances) +
        prop('草稿', prep.impact.draftCount) +
        prop('快照', (prep.snapshotIds || []).join(', ') || '—') +
        prop('需二次确认', prep.requiresSecondConfirm ? '是' : '否') +
        '</dl>' +
        (prep.requiresSecondConfirm
          ? '<div class="sp-f-warn">高风险：Delete Local Copy / 删除文件记录。将展示影响并要求二次确认。未二次确认不得修改数据。</div>' +
            '<div class="sp-f-tree">' + ((prep.targets || []).map(t =>
              esc(t.instanceId) + ' · ' + esc(t.path) + ' · files ' + esc(t.fileCount)
            ).join('<br>') || '无目标') + '</div>'
          : '') +
        (mode === 'detach-source'
          ? '<div class="sp-f-warn">仅解除 SourceBinding。Asset / Instance 生命周期保持不变。</div>'
          : '') +
        '<div class="sp-f-actions">' +
        '<button type="button" class="btn" id="btn-cancel">取消</button>' +
        '<button type="button" class="btn btn-primary" id="btn-confirm">' +
        (prep.requiresSecondConfirm ? '确认（将二次确认）' : '确认') + '</button></div>';
      document.getElementById('btn-cancel').onclick = () => { prep = null; render(); };
      document.getElementById('btn-confirm').onclick = () => {
        const opts = { userConfirmed: true };
        if (prep.requiresSecondConfirm) {
          if (!confirm('二次确认：将删除 Formal Index 中的本地副本记录（非真实磁盘删除）。确定继续？')) return;
          opts.secondConfirmed = true;
        }
        result = SP.confirmUninstall(prep.operationId, opts);
        render();
      };
      return;
    }

    body.innerHTML =
      '<dl class="sp-f-props">' +
      prop('状态', result.status) +
      prop('Operation', result.operationId || (prep && prep.operationId) || '—') +
      prop('Asset', result.assetStatus) +
      '</dl>' +
      ((result.status === 'rolled-back' || result.status === 'rollback-failed')
        ? '<div class="sp-f-warn">多 Instance 失败时会追加 uninstall_rollback_completed / uninstall_rollback_failed 审计，不删除已完成事件。</div>'
        : '') +
      '<div>' + ((result.results || []).map(r =>
        '<div style="font-size:12px;font-family:var(--font-mono)">' + esc(JSON.stringify(r)) + '</div>'
      ).join('')) + '</div>' +
      '<div class="sp-f-actions"><a class="btn btn-primary" href="index.html">返回 Library</a></div>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-back').onclick = () => SP.returnToOrigin('index.html');
    render();
  });
})();
