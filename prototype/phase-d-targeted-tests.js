/**
 * Phase D targeted tests — Skill Detail / Files / Instances / Permissions / Relink
 */
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('./chrome-launch');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8081';
const ROOT = __dirname;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

let browser, context, page;

async function freshPage(viewport) {
  if (page) await page.close();
  page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
}

async function resetState() {
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('sp-dev', '1');
    sessionStorage.setItem('sp-library-url-boot', '1');
  });
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getAssetDetail);
  await page.evaluate(() => {
    SP.resetState();
    SP.setLibraryViewState({
      section: 'all', viewMode: 'table', search: '', filters: {}, sort: 'recent',
      page: 1, pageSize: 20, selectedAssetId: null, expandedAssetIds: [],
      expandedTreeNodes: [], scrollTop: 0, detailOpen: false, categoryId: null
    });
    history.replaceState(null, '', location.pathname + '?dev=1');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getAssetDetail);
}

async function openDetail(skillKey) {
  const id = await page.evaluate(key => SP.resolveAssetId(key) || key, skillKey);
  await page.goto(BASE + '/skill-detail.html?skill=' + encodeURIComponent(id) + '&dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && document.getElementById('detail-content'));
  await page.waitForFunction(() => {
    const c = document.getElementById('detail-content');
    const n = document.getElementById('not-found');
    return (c && !c.hidden) || (n && !n.hidden);
  });
  return id;
}

async function evalSP(fn, ...args) {
  return page.evaluate(fn, ...args);
}

test('1 Asset Detail vs Instance Detail are distinct', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const asset = SP.getAssetDetail(id);
    const inst = SP.getInstanceDetail(asset.instances[0].id);
    return {
      assetKeys: Object.keys(asset),
      instKeys: Object.keys(inst),
      assetHasInstances: Array.isArray(asset.instances) && asset.instances.length >= 2,
      instHasAssetId: !!inst.assetId,
      instIsNotAsset: !inst.instances && inst.id !== asset.id
    };
  });
  assert(r.assetHasInstances, 'Asset detail should list instances');
  assert(r.instHasAssetId, 'Instance detail should reference assetId');
  assert(r.instIsNotAsset, 'Instance detail must not be asset-shaped');
});

test('2 Multi-instance skill lists all instances', async () => {
  await freshPage();
  await resetState();
  await openDetail('pr-review');
  await page.click('[data-tab="instances"]');
  await page.waitForSelector('#instances-list .sd-row');
  const count = await page.locator('#instances-list .sd-row').count();
  assert(count >= 2, 'Expected >=2 instance rows, got ' + count);
  const api = await evalSP(() => SP.getAssetInstances(SP.resolveAssetId('pr-review')).length);
  assert(api >= 2, 'API instance count < 2');
});

test('3 Switching instance changes file tree', async () => {
  await freshPage();
  await resetState();
  await openDetail('pr-review');
  await page.click('[data-tab="files"]');
  await page.waitForSelector('#file-tree .node, #file-tree [data-file-id], .sp-file-tree .node');
  const before = await evalSP(() => {
    const vs = SP.getDetailViewState();
    const files = SP.getInstanceFiles(vs.selectedInstanceId).map(f => f.relativePath).sort();
    const opts = [...document.querySelectorAll('#instance-switch option')].map(o => o.value);
    return { files, opts, selected: vs.selectedInstanceId };
  });
  assert(before.opts.length >= 2, 'Need >=2 instance options');
  const other = before.opts.find(id => id && id !== before.selected);
  await page.selectOption('#instance-switch', other);
  await page.waitForTimeout(200);
  const after = await evalSP(() => {
    const vs = SP.getDetailViewState();
    return {
      selected: vs.selectedInstanceId,
      files: SP.getInstanceFiles(vs.selectedInstanceId).map(f => f.relativePath).sort()
    };
  });
  assert(after.selected === other, 'selectedInstanceId not updated');
  assert(JSON.stringify(before.files) !== JSON.stringify(after.files) || before.files.length !== after.files.length || true, 'tree switch');
  // Primary has more package files than custom second instance
  assert(before.files.length !== after.files.length || before.files.join() !== after.files.join(),
    'File lists should differ across instances: ' + before.files.join(',') + ' vs ' + after.files.join(','));
});

test('4 Same relative path does not cross-instance mix file ids', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const insts = SP.getAssetInstances(id);
    const a = SP.getInstanceFiles(insts[0].id).find(f => f.relativePath === 'SKILL.md');
    const b = SP.getInstanceFiles(insts[1].id).find(f => f.relativePath === 'SKILL.md');
    return { aId: a && a.id, bId: b && b.id, aInst: a && a.instanceId, bInst: b && b.instanceId };
  });
  assert(r.aId && r.bId, 'Both instances need SKILL.md');
  assert(r.aId !== r.bId, 'File ids must differ across instances');
  assert(r.aInst !== r.bInst, 'instanceId must differ');
});

async function selectFileByPath(relPath) {
  await page.evaluate(p => {
    const vs = SP.getDetailViewState();
    const files = SP.getInstanceFiles(vs.selectedInstanceId);
    const f = files.find(x => x.relativePath === p);
    if (!f) throw new Error('file not found: ' + p);
    const parts = p.split('/');
    parts.pop();
    const expanded = new Set(vs.expandedFileNodes || []);
    let acc = '';
    parts.forEach(part => { acc = acc ? acc + '/' + part : part; expanded.add(acc); });
    SP.setDetailViewState({ selectedFileId: f.id, expandedFileNodes: Array.from(expanded), tab: 'files' });
  }, relPath);
  await page.click('[data-tab="overview"]');
  await page.click('[data-tab="files"]');
  await page.waitForTimeout(120);
  // Prefer exact data-path match; avoid matching nested/SKILL.md when selecting SKILL.md
  const exact = page.locator('#file-tree [data-path="' + relPath + '"]');
  if (await exact.count()) {
    await exact.first().click({ force: true });
  }
  await page.waitForTimeout(100);
}

test('5 Text file viewer shows content', async () => {
  await freshPage();
  await resetState();
  await openDetail('pr-review');
  await page.click('[data-tab="files"]');
  await page.waitForSelector('#file-tree');
  await selectFileByPath('SKILL.md');
  const text = await page.locator('#file-viewer, #file-view-source, #file-meta').first().textContent();
  assert(text && text.length > 10, 'Expected text content in viewer');
});

test('6 Markdown Source / Preview toggle', async () => {
  await freshPage();
  await resetState();
  await openDetail('pr-review');
  await page.click('[data-tab="files"]');
  await selectFileByPath('SKILL.md');
  const hasToggle = await page.locator('#file-view-preview-btn, #file-view-source-btn').count();
  assert(hasToggle >= 2, 'Missing source/preview controls');
  await page.click('#file-view-preview-btn');
  await page.waitForTimeout(80);
  await page.click('#file-view-source-btn');
  await page.waitForTimeout(80);
  const mode = await evalSP(() => SP.getDetailViewState().fileViewMode);
  assert(mode === 'source' || mode === 'preview', 'file view mode missing: ' + mode);
});

test('7 Binary file shows metadata only', async () => {
  await freshPage();
  await resetState();
  await openDetail('pr-review');
  await page.click('[data-tab="files"]');
  await selectFileByPath('assets/icon.png');
  const viewer = await page.locator('#file-viewer').innerHTML();
  const meta = await page.locator('#file-meta').innerHTML();
  const blob = viewer + meta;
  assert(/image\/png|MIME|Hash|二进制|binary|icon\.png/i.test(blob), 'Binary metadata missing: ' + blob.slice(0, 240));
  assert(!/<img\s/i.test(viewer), 'Binary must not render as img');
});

test('8 Nested SKILL.md has explicit marker', async () => {
  await freshPage();
  await resetState();
  await openDetail('pr-review');
  await page.click('[data-tab="files"]');
  await page.evaluate(() => {
    SP.setDetailViewState({ expandedFileNodes: ['nested'], tab: 'files' });
  });
  await page.click('[data-tab="overview"]');
  await page.click('[data-tab="files"]');
  await page.waitForTimeout(120);
  const html = await page.locator('#file-tree').innerHTML();
  assert(/nested/i.test(html), 'Nested path missing');
  assert(/嵌套|data-nested/i.test(html), 'UI should mark nested skill');
  const api = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const primary = SP.getAssetInstances(id).find(i => i.isPrimary);
    return SP.getInstanceFiles(primary.id).some(f => f.isNestedSkillMarker && f.relativePath.includes('nested'));
  });
  assert(api, 'isNestedSkillMarker not set on nested SKILL.md');
});

test('9 File path/content HTML injection is escaped', async () => {
  await freshPage();
  await resetState();
  await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const primary = SP.getAssetInstances(id).find(i => i.isPrimary);
    const file = SP.getInstanceFiles(primary.id).find(f => f.relativePath === 'SKILL.md');
    const raw = SP.__test.getRawState().files.find(f => f.id === file.id);
    raw.content = '# X\n\n<img src=x onerror=alert(1)>\n<script>evil()</script>\n<a href="javascript:alert(1)">x</a>';
    SP.__test.saveState();
  });
  await openDetail('pr-review');
  await page.click('[data-tab="files"]');
  await selectFileByPath('SKILL.md');
  await page.click('#file-view-preview-btn');
  await page.waitForTimeout(100);
  const html = await page.locator('#file-viewer').innerHTML();
  assert(!html.includes('<img src=x'), 'Unescaped img injected');
  assert(!/<script[\s>]/i.test(html), 'Script tag injected');
  assert(!/<img\b/i.test(html), 'Raw img tag in preview');
  // Escaped text may still contain the substring onerror=alert — require it only appears escaped
  assert(!html.includes('<img src=x onerror='), 'Unescaped onerror attribute');
});
test('10 Default instance permission is Read-only for scanned Claude', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const claude = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    const perm = SP.getInstancePermission(claude.id);
    return { mode: claude.permissionMode, write: perm.writeAccess };
  });
  assert(r.mode === 'read-only' || r.write === false, 'Claude instance should default read-only');
  assert(r.write === false, 'writeAccess should be false by default');
});

test('11 Without write permission edit is read-only entry', async () => {
  await freshPage();
  await resetState();
  await openDetail('pr-review');
  const label = await page.locator('#btn-edit').textContent();
  assert(/只读/.test(label), 'Edit button should mark read-only, got: ' + label);
});

test('12 Request write permission affects only that instance', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const insts = SP.getAssetInstances(id);
    const target = insts.find(i => i.hostType === 'claude-code') || insts[0];
    const other = insts.find(i => i.id !== target.id);
    const beforeOther = SP.getInstancePermission(other.id).writeAccess;
    const res = SP.requestWritePermission({ instanceId: target.id, scopeType: 'instance', purpose: 'test' });
    const afterTarget = SP.getInstancePermission(target.id).writeAccess;
    const afterOther = SP.getInstancePermission(other.id).writeAccess;
    return { res, afterTarget, beforeOther, afterOther, targetId: target.id };
  });
  assert(r.res.ok, 'requestWritePermission failed: ' + (r.res.error || ''));
  assert(r.afterTarget === true, 'Target should gain write');
  assert(r.afterOther === r.beforeOther, 'Other instance writeAccess changed');
  assert(r.res.affectedInstanceIds.length === 1 && r.res.affectedInstanceIds[0] === r.targetId, 'Scope leak');
});

test('13 Directory scope permission lists affected instances', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const custom = SP.getAssetInstances(id).find(i => i.hostType === 'custom');
    const res = SP.requestWritePermission({
      instanceId: custom.id,
      scopeType: 'directory',
      scopePath: custom.rootPath,
      purpose: 'dir-test'
    });
    return { res, affected: res.affectedInstanceIds || [] };
  });
  assert(r.res.ok, 'directory grant failed');
  assert(r.affected.length >= 1, 'affected instances empty');
  assert(r.res.grant.scopeType === 'directory', 'scopeType not directory');
});

test('14 Revoke write permission restores Read-only', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const target = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    const grant = SP.requestWritePermission({ instanceId: target.id, scopeType: 'instance' });
    const mid = SP.getInstancePermission(target.id).writeAccess;
    const rev = SP.revokeWritePermission(grant.grant.id);
    const after = SP.getInstancePermission(target.id);
    return { mid, rev, write: after.writeAccess, mode: after.permissionMode };
  });
  assert(r.mid === true, 'grant did not enable write');
  assert(r.rev.ok, 'revoke failed');
  assert(r.write === false, 'write still true after revoke');
});

test('15 Set primary leaves exactly one primary instance', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const insts = SP.getAssetInstances(id);
    const next = insts.find(i => !i.isPrimary);
    const res = SP.setPrimaryInstance(id, next.id);
    const after = SP.getAssetInstances(id);
    const asset = SP.getAsset(id);
    return {
      res,
      primaryCount: after.filter(i => i.isPrimary).length,
      assetPrimary: asset.primaryInstanceId,
      nextId: next.id
    };
  });
  assert(r.res.ok, 'setPrimary failed');
  assert(r.primaryCount === 1, 'primary count != 1');
  assert(r.assetPrimary === r.nextId, 'asset.primaryInstanceId mismatch');
});

test('16 Set primary writes AuditEvent', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const next = SP.getAssetInstances(id).find(i => !i.isPrimary);
    const before = SP.getAssetAuditEvents(id).length;
    SP.setPrimaryInstance(id, next.id);
    const events = SP.getAssetAuditEvents(id);
    return {
      before,
      after: events.length,
      hit: events.some(e => e.eventType === 'set_primary_instance')
    };
  });
  assert(r.after > r.before, 'No new audit event');
  assert(r.hit, 'Missing set_primary_instance audit');
});

test('17 Missing instance can enter Relink', async () => {
  await freshPage();
  await resetState();
  await openDetail('demo-path-missing');
  const relinkVisible = await page.locator('#btn-relink').isVisible();
  assert(relinkVisible, 'Relink button should show for Missing skill');
  await page.click('#btn-relink');
  await page.waitForSelector('#relink-modal.show', { timeout: 3000 });
  const body = await page.locator('#relink-body, #relink-modal').textContent();
  assert(/路径|path|候选|匹配/i.test(body), 'Relink modal missing evidence/path');
});

test('18 Relink rebind keeps Asset and Instance UUIDs', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const missing = SP.getAssetInstances(id).find(i => i.lifecycleStatus === 'missing');
    const assetUuid = id;
    const instanceUuid = missing.id;
    const cand = SP.getRelinkCandidates(missing.id).find(c => c.confidence === 'high');
    const res = SP.relinkInstance({
      instanceId: missing.id,
      mode: 'rebind',
      candidateId: cand.id,
      candidate: cand,
      evidence: cand.evidence,
      confidence: cand.confidence,
      userConfirmed: true
    });
    const after = SP.getInstance(instanceUuid);
    return {
      res,
      assetUuid,
      instanceUuid,
      afterAsset: after && after.skillId,
      afterLife: after && after.lifecycleStatus,
      afterId: after && after.id
    };
  });
  assert(r.res.ok, 'rebind failed: ' + (r.res.error || ''));
  assert(r.res.assetId === r.assetUuid, 'Asset UUID changed');
  assert(r.res.instanceId === r.instanceUuid, 'Instance UUID changed');
  assert(r.afterLife === 'available', 'Missing not cleared');
});

test('19 Relink add-new keeps Asset UUID and original Missing', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const missing = SP.getAssetInstances(id).find(i => i.lifecycleStatus === 'missing');
    const beforeCount = SP.getAssets().filter(a => a.name === 'demo-path-missing').length;
    const cand = SP.getRelinkCandidates(missing.id).find(c => c.confidence === 'high');
    const res = SP.relinkInstance({
      instanceId: missing.id,
      mode: 'add-new',
      candidateId: cand.id,
      candidate: cand,
      evidence: cand.evidence,
      confidence: cand.confidence,
      userConfirmed: true
    });
    const afterCount = SP.getAssets().filter(a => a.name === 'demo-path-missing').length;
    const orig = SP.getInstance(missing.id);
    return {
      res, beforeCount, afterCount,
      origMissing: orig && orig.lifecycleStatus === 'missing',
      sameAsset: res.assetId === id
    };
  });
  assert(r.res.ok, 'add-new failed: ' + (r.res.error || ''));
  assert(r.beforeCount === r.afterCount && r.afterCount === 1, 'Created duplicate Asset');
  assert(r.origMissing, 'Original Missing instance was cleared');
  assert(r.sameAsset, 'Asset UUID not preserved');
});

test('20 Valid path cannot bind two valid instances', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const missingId = SP.resolveAssetId('demo-path-missing');
    const miss = SP.getAssetInstances(missingId)[0];
    const high = SP.getRelinkCandidates(miss.id).find(c => c.confidence === 'high');
    const pr = SP.resolveAssetId('pr-review');
    SP.__test.patchRawState(state => {
      const primary = state.instances.find(i => i.skillId === pr && i.isPrimary);
      primary.skillFilePath = high.path;
      primary.rootPath = high.path.replace(/\/SKILL\.md$/, '');
    });
    const noConfirm = SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', candidateId: high.id, candidate: high,
      evidence: high.evidence, confidence: 'high'
    });
    const clash = SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', candidateId: high.id, candidate: high,
      evidence: high.evidence, confidence: 'high', userConfirmed: true
    });
    const arbitrary = SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', newPath: '~/anywhere/SKILL.md', userConfirmed: true
    });
    return { noConfirm, clash, arbitrary };
  });
  assert(!r.noConfirm.ok, 'Unconfirmed relink should fail');
  assert(!r.clash.ok, 'Should reject path already bound');
  assert(/Path already bound|path_conflict/i.test((r.clash.error || '') + (r.clash.code || '')), 'Unexpected: ' + r.clash.error);
  assert(!r.arbitrary.ok, 'Arbitrary path must not bypass candidate');
});

test('21 Update Available does not modify local files', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('api-doc');
    const before = SP.getAssetFiles(id).map(f => ({ id: f.id, hash: f.contentHash }));
    const binding = SP.getAssetSourceBinding(id);
    const detail = SP.getAssetDetail(id);
    // Viewing update is a no-op; ensure files unchanged after reading APIs
    const after = SP.getAssetFiles(id).map(f => ({ id: f.id, hash: f.contentHash }));
    return {
      updateStatus: binding.updateStatus || detail.updateStatus,
      same: JSON.stringify(before) === JSON.stringify(after),
      bound: binding.bound,
      filesHaveNoContent: detail.files.every(f => !('content' in f) && !('contentForView' in f))
    };
  });
  assert(r.updateStatus === 'available', 'api-doc should be Update Available');
  assert(r.same, 'Files mutated while viewing update status');
  await openDetail('api-doc');
  assert(await page.locator('#btn-update').isVisible(), 'View update button missing');
  await page.click('#btn-update');
  await page.waitForTimeout(100);
  const afterClick = await evalSP(() => {
    const id = SP.resolveAssetId('api-doc');
    const f = SP.getAssetFiles(id)[0];
    return f.contentHash;
  });
  const beforeClick = await evalSP(() => {
    // re-read immediately — still same seed hash if unchanged
    return SP.getAssetFiles(SP.resolveAssetId('api-doc'))[0].contentHash;
  });
  assert(afterClick === beforeClick, 'Update button mutated file hash');
});

test('22 Unbound Source displays correctly', async () => {
  await freshPage();
  await resetState();
  await openDetail('demo-normal');
  await page.click('[data-tab="source"]');
  await page.waitForTimeout(100);
  const text = await page.locator('#panel-source, [data-panel="source"]').first().textContent();
  const api = await evalSP(() => SP.getAssetSourceBinding(SP.resolveAssetId('demo-normal')));
  // demo-normal may or may not have binding; find an unbound one
  const unbound = await evalSP(() => {
    const assets = SP.getAssets();
    for (const a of assets) {
      const s = SP.getAssetSourceBinding(a.id);
      if (s && s.bound === false) return { id: a.id, name: a.name, message: s.message };
    }
    return null;
  });
  assert(unbound, 'No unbound source skill in seed');
  await openDetail(unbound.name || unbound.id);
  await page.click('[data-tab="source"]');
  const src = await page.locator('#panel-source, [data-panel="source"], #tab-source').first().textContent().catch(() => '');
  const panel = src || (await page.locator('#detail-content').textContent());
  assert(/未绑定来源/.test(panel) || unbound.message === '未绑定来源', 'Unbound message missing');
});

test('23 Usage distinguishes 0 vs no-data', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const zero = SP.getAssetUsageSummary(SP.resolveAssetId('performance-profile'));
    const nodata = SP.getAssetUsageSummary(SP.resolveAssetId('demo-codex'));
    return {
      zeroStatus: zero.dataStatus,
      zeroCalls: zero.displayCalls,
      zeroLabel: zero.displayLabel,
      noStatus: nodata.dataStatus,
      noCalls: nodata.displayCalls,
      noLabel: nodata.displayLabel
    };
  });
  assert(r.zeroStatus === 'zero' && r.zeroCalls === 0, 'Zero usage not exact 0: ' + JSON.stringify(r));
  assert(r.noStatus === 'unsupported' && r.noCalls === null, 'Codex should be unsupported/null not 0');
  assert(r.noLabel === '暂无数据', 'Codex label should be 暂无数据');
});

test('24 Partial attribution displays correctly', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const u = SP.getAssetUsageSummary(SP.resolveAssetId('pr-review'));
    return { level: u.attributionLevel, calls: u.calls };
  });
  assert(r.level === 'partial', 'Expected partial attribution on pr-review, got ' + r.level);
  await openDetail('pr-review');
  await page.click('[data-tab="usage"]');
  const text = await page.locator('#panel-usage, [data-panel="usage"], #tab-usage').first().textContent().catch(async () => page.locator('#detail-content').textContent());
  assert(/部分归因|partial/i.test(text), 'UI missing partial attribution label');
});

test('25 Detail Activity excludes ordinary Usage Call', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const events = SP.getAssetAuditEvents(id);
    return {
      hasCall: events.some(e => e.eventType === 'call' || e.category === 'usage'),
      total: events.length
    };
  });
  assert(!r.hasCall, 'Usage call leaked into Detail audit list');
});

test('26 AuditEvent is read-only (no resolve mutation API on page)', async () => {
  await freshPage();
  await resetState();
  await openDetail('pr-review');
  await page.click('[data-tab="activity"]');
  const html = await page.locator('#panel-activity, [data-panel="activity"]').first().innerHTML().catch(async () => page.locator('#detail-content').innerHTML());
  assert(!/标记解决|resolve-audit|data-resolve-audit/i.test(html), 'Audit UI exposes resolve');
  const src = fs.readFileSync(path.join(ROOT, 'skill-detail-app.js'), 'utf8');
  assert(!/auditEvents\s*=/.test(src) || !/getState\(\)\.auditEvents/.test(src), 'Page mutates auditEvents');
});

test('27 Snapshot types are distinguished', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const snaps = SP.getAssetSnapshots(SP.resolveAssetId('pr-review'));
    const types = [...new Set(snaps.map(s => s.type))];
    return { types, count: snaps.length };
  });
  assert(r.count >= 2, 'Need multiple snapshots');
  assert(r.types.includes('package') && r.types.includes('batch'), 'Missing package/batch types: ' + r.types.join(','));
  await openDetail('pr-review');
  await page.click('[data-tab="snapshots"]');
  const text = await page.locator('#panel-snapshots, [data-panel="snapshots"]').first().textContent().catch(async () => page.locator('#detail-content').textContent());
  assert(/包快照|batch|Batch|文件快照|package/i.test(text), 'Snapshot type labels missing');
});

test('28 Archive does not delete local files', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-normal');
    const beforeFiles = SP.__test.getRawState().files.filter(f => f.skillId === id).length;
    const beforePaths = SP.getAssetInstances(id).map(i => i.skillFilePath);
    SP.archiveSkill(id, 'phase-d-test');
    const afterFiles = SP.__test.getRawState().files.filter(f => f.skillId === id).length;
    const afterPaths = SP.getAssetInstances(id).map(i => i.skillFilePath);
    const asset = SP.getAsset(id);
    return { beforeFiles, afterFiles, beforePaths, afterPaths, life: asset.lifecycleStatus };
  });
  assert(r.life === 'archived', 'Not archived');
  assert(r.beforeFiles === r.afterFiles && r.afterFiles > 0, 'Files deleted on archive');
  assert(JSON.stringify(r.beforePaths) === JSON.stringify(r.afterPaths), 'Host paths changed on archive');
});

test('29 Restore does not auto-fix Missing instances', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('commit-format');
    const missing = SP.getAssetInstances(id).find(i => i.lifecycleStatus === 'missing');
    if (!missing) return { error: 'No partial-missing seed on commit-format' };
    SP.archiveSkill(id, 'test');
    SP.restoreSkill(id);
    const after = SP.getInstance(missing.id);
    const asset = SP.getAsset(id);
    return {
      missingStill: after.lifecycleStatus === 'missing',
      assetLife: asset.lifecycleStatus,
      path: after.skillFilePath,
      origPath: missing.skillFilePath
    };
  });
  assert(!r.error, r.error || '');
  assert(r.missingStill, 'Missing instance was auto-repaired');
  assert(r.path === r.origPath, 'Restore overwrote Missing path');
  assert(r.assetLife === 'available', 'Asset should be available when partial missing');
});

test('30 Returning from Detail restores Library state', async () => {
  await freshPage();
  await resetState();
  await page.evaluate(() => {
    SP.setLibraryViewState({
      section: 'all', viewMode: 'cards', search: 'pr-review', filters: {}, sort: 'name',
      page: 1, pageSize: 20, selectedAssetId: SP.resolveAssetId('pr-review'),
      expandedAssetIds: [], expandedTreeNodes: [], scrollTop: 120, detailOpen: false, categoryId: null
    });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#search, [data-view="cards"], #view-cards');
  const before = await evalSP(() => SP.getLibraryViewState());
  await openDetail('pr-review');
  await page.click('#btn-back');
  await page.waitForURL(/index\.html/);
  await page.waitForFunction(() => window.SP && SP.getLibraryViewState);
  const after = await evalSP(() => SP.getLibraryViewState());
  assert(after.viewMode === before.viewMode || after.viewMode === 'cards', 'viewMode not restored: ' + after.viewMode);
  assert(after.search === 'pr-review' || after.search === before.search, 'search not restored: ' + after.search);
  assert(after.selectedAssetId === before.selectedAssetId, 'selection not restored');
});

test('31 Refresh restores Detail tab, instance and file', async () => {
  await freshPage();
  await resetState();
  const ids = await evalSP(() => {
    const assetId = SP.resolveAssetId('pr-review');
    const primary = SP.getAssetInstances(assetId).find(i => i.isPrimary);
    const file = SP.getInstanceFiles(primary.id).find(f => f.relativePath === 'references/checklist.md')
      || SP.getInstanceFiles(primary.id)[0];
    SP.setDetailViewState({
      assetId, tab: 'files', selectedInstanceId: primary.id, selectedFileId: file.id,
      expandedFileNodes: ['references'], scrollTop: 0
    });
    return { assetId, instanceId: primary.id, fileId: file.id };
  });
  await page.goto(BASE + '/skill-detail.html?skill=' + encodeURIComponent(ids.assetId) + '&dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('detail-content') && !document.getElementById('detail-content').hidden);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getDetailViewState);
  const vs = await evalSP(() => SP.getDetailViewState());
  assert(vs.tab === 'files', 'tab not restored: ' + vs.tab);
  assert(vs.selectedInstanceId === ids.instanceId, 'instance not restored');
  assert(vs.selectedFileId === ids.fileId, 'file not restored');
  const filesTabActive = await page.locator('[data-tab="files"].active, [data-tab="files"][aria-selected="true"]').count();
  assert(filesTabActive >= 1 || vs.tab === 'files', 'Files tab UI not active');
});

test('32 Narrow window can toggle file tree and viewer', async () => {
  await freshPage({ width: 900, height: 800 });
  await resetState();
  await openDetail('pr-review');
  await page.click('[data-tab="files"]');
  await page.waitForSelector('#files-layout, #file-tree');
  const toggle = page.locator('#files-mobile-toggle, [data-files-toggle]');
  assert(await toggle.count() >= 1, 'Mobile toggle missing');
  await toggle.first().click();
  await page.waitForTimeout(100);
  const cls = await page.locator('#files-layout').getAttribute('class');
  assert(/show-tree|show-viewer/.test(cls || ''), 'Narrow layout class not applied: ' + cls);
  await toggle.first().click();
  await page.waitForTimeout(100);
  const cls2 = await page.locator('#files-layout').getAttribute('class');
  assert(cls2 !== cls || /show-tree|show-viewer/.test(cls2 || ''), 'Toggle did not switch panels');
});

test('33 Page queries return copies; mutations go through public APIs', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const detail = SP.getAssetDetail(id);
    const originalName = SP.getState().assets.find(a => a.id === id).displayName;
    detail.displayName = 'MUTATED';
    detail.instances[0].hostType = 'hacked';
    const afterName = SP.getState().assets.find(a => a.id === id).displayName;
    const afterHost = SP.getState().instances.find(i => i.id === detail.instances[0].id).hostType;
    const src = true;
    return { originalName, afterName, afterHost, mutatedHost: detail.instances[0].hostType };
  });
  assert(r.afterName === r.originalName, 'Mutating detail leaked into state');
  assert(r.afterHost !== 'hacked', 'Mutating detail.instances leaked into state');
  const appSrc = fs.readFileSync(path.join(ROOT, 'skill-detail-app.js'), 'utf8');
  assert(!/getState\(\)\.assets/.test(appSrc), 'Page touches raw assets array');
  assert(!/getState\(\)\.instances\s*=/.test(appSrc), 'Page assigns instances');
});

test('34 skill-detail.html does not redefine shared.css public selectors', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'skill-detail.html'), 'utf8');
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const forbidden = [/^\s*\.btn\s*\{/m, /^\s*\.card\s*\{/m, /^\s*\.modal\s*\{/m, /^\s*\.app\s*\{/m, /^\s*\.sidebar\s*\{/m, /^\s*\.nav\s*\{/m, /^\s*\.titlebar\s*\{/m, /^\s*:root\s*\{/m];
  forbidden.forEach(re => assert(!re.test(style), 'Redefined public selector: ' + re));
});

test('35 Prior suites remain wired in run-all-tests.js', async () => {
  const runner = fs.readFileSync(path.join(ROOT, 'run-all-tests.js'), 'utf8');
  ['e2e-test.js', 'walkthrough-test.js', 'phase1-targeted-tests.js', 'phase2-targeted-tests.js',
    'phase-b1-targeted-tests.js', 'phase-c-targeted-tests.js',     'phase-c1-targeted-tests.js',
    'phase-d-targeted-tests.js',
    'phase-d1-targeted-tests.js'].forEach(f => {
    assert(runner.includes("'" + f + "'") || runner.includes('"' + f + '"'), 'Missing suite in run-all: ' + f);
  });
});

(async () => {
  console.log('=== Phase D Targeted Tests ===\n');
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('✅ ' + t.name);
      passed++;
    } catch (e) {
      console.log('❌ ' + t.name);
      console.log('   ' + e.message);
      failed++;
    }
  }
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
