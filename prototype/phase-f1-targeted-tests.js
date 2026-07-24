/**
 * Phase F.1 targeted tests — Install/Update/Uninstall/Compare consistency & rollback
 * Strict assertions; no `|| true` fake passes.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { chromiumLaunchOptions } = require('./chrome-launch');

const BASE = 'http://localhost:8081';
const ROOT = __dirname;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }

let browser, context, page;
async function freshPage() {
  if (page) await page.close();
  page = await context.newPage();
}
async function resetState() {
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('sp-dev', '1'); });
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.__test);
  await page.evaluate(() => SP.resetState());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.__test);
}
async function evalSP(fn, ...args) { return page.evaluate(fn, ...args); }

function isUuid(id) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

// 1–2 Multi-host new install → one Asset, multiple Instances
test('F1-1/2 Multi-host new-asset creates one Asset and multiple Instances', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const before = SP.__test.getRawState().assets.map(a => a.id);
    const prep = SP.prepareInstall({ source: 'github:acme/hello-skill', hostIds: ['claude', 'codex'], mode: 'new-asset' });
    if (!prep.ok) return { step: 'prep', prep };
    const done = SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const created = SP.__test.getRawState().assets.filter(a => !before.includes(a.id) && a.lifecycleStatus !== 'deleted');
    const assetId = created[0] && created[0].id;
    const insts = SP.__test.getRawState().instances.filter(i => i.skillId === assetId && i.lifecycleStatus === 'available');
    const primaries = insts.filter(i => i.isPrimary);
    const bindings = SP.__test.getRawState().sourceBindings.filter(b => b.skillId === assetId && (!b.scope || b.scope === 'asset'));
    return {
      createdCount: created.length,
      assetId,
      instanceCount: insts.length,
      primaryCount: primaries.length,
      supportedHosts: (created[0] && created[0].supportedHosts) || [],
      bindingCount: bindings.length,
      allSameAsset: (done.results || []).filter(x => x.status === 'completed').every(x => x.assetId === assetId),
      status: done.status
    };
  });
  assert(r.createdCount === 1, 'expected 1 asset: ' + JSON.stringify(r));
  assert(r.instanceCount === 2, 'expected 2 instances: ' + JSON.stringify(r));
  assert(r.primaryCount === 1, JSON.stringify(r));
  assert(r.bindingCount === 1, 'one shared asset binding: ' + JSON.stringify(r));
  assert(r.allSameAsset, JSON.stringify(r));
  assert(isUuid(r.assetId), r.assetId);
  const hosts = r.supportedHosts || [];
  assert(hosts.includes('claude-code') && hosts.includes('codex'), 'supportedHosts must be host types: ' + JSON.stringify(hosts));
  assert(!hosts.includes('claude'), 'legacy host id claude must be normalized: ' + JSON.stringify(hosts));
  assert(hosts.every(h => ['claude-code', 'codex', 'custom', 'cursor', 'warp', 'archive'].includes(h)), JSON.stringify(hosts));
});

// 3 Add Instance asset_not_found
test('F1-3 Add-instance rejects missing Asset', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => SP.prepareInstall({
    source: 'local-directory:~/Skills/local-demo',
    hostIds: ['custom'],
    mode: 'add-instance',
    existingAssetId: '00000000-0000-4000-8000-000000000099'
  }));
  assert(r.ok === false && r.code === 'asset_not_found', JSON.stringify(r));
});

// 4 Host not found
test('F1-4 Unknown host rejected', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => SP.prepareInstall({
    source: 'github:acme/hello-skill',
    hostIds: ['not-a-real-host'],
    mode: 'new-asset'
  }));
  assert(r.ok === false && r.code === 'host_not_found', JSON.stringify(r));
});

// 5 Rebind keeps Asset + Instance UUID
test('F1-5 Rebind preserves Asset and Instance UUID', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing') || SP.resolveAssetId('pr-review');
    let inst = SP.__test.getRawState().instances.find(i => i.skillId === id && (i.lifecycleStatus === 'missing' || i.lifecycleStatus === 'stopped'));
    if (!inst) {
      inst = SP.__test.getRawState().instances.find(i => i.skillId === id);
      inst.lifecycleStatus = 'missing';
      SP.__test.saveState();
    }
    const assetId = inst.skillId;
    const instanceId = inst.id;
    const prep = SP.prepareInstall({
      source: 'local-directory:~/Skills/local-demo',
      hostIds: ['custom'],
      mode: 'rebind',
      existingAssetId: assetId,
      existingInstanceId: instanceId
    });
    if (!prep.ok) return { step: 'prep', prep };
    const done = SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const after = SP.__test.getRawState().instances.find(i => i.id === instanceId);
    return {
      done,
      sameAsset: after && after.skillId === assetId,
      sameInstance: !!after,
      life: after && after.lifecycleStatus,
      path: after && after.skillFilePath
    };
  });
  assert(r.done && r.done.ok !== false && r.sameAsset && r.sameInstance && r.life === 'available', JSON.stringify(r));
});

// 6 Existing Asset binding not overwritten by local source
test('F1-6 Local source does not overwrite GitHub asset SourceBinding', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    let b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id && (!x.instanceId || x.scope === 'asset'));
    if (!b) {
      b = {
        id: SP.uuid(), skillId: id, scope: 'asset', instanceId: null, sourceDivergence: false,
        sourceType: 'github', sourceUrl: 'https://github.com/demo/pr-review', repository: 'demo/pr-review',
        branch: 'main', baselineVersion: '1.0.0', baselineCommit: 'aaa', baselineSnapshotId: null,
        trustPolicy: 'untrusted', lastCheckedAt: null, updateStatus: 'unknown', remoteVersion: '1.0.0', remoteCommit: 'aaa'
      };
      SP.__test.getRawState().sourceBindings.push(b);
      SP.__test.getRawState().assets.find(a => a.id === id).sourceBindingId = b.id;
      SP.__test.saveState();
    }
    const beforeBindingId = b.id;
    const beforeType = b.sourceType;
    const prep = SP.prepareInstall({
      source: 'local-directory:~/Skills/local-demo',
      hostIds: ['custom'],
      mode: 'add-instance',
      existingAssetId: id
    });
    if (!prep.ok) return { step: 'prep', prep };
    const done = SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const asset = SP.__test.getRawState().assets.find(a => a.id === id);
    const main = SP.__test.getRawState().sourceBindings.find(x => x.id === beforeBindingId);
    const newInst = (done.results || []).find(x => x.status === 'completed');
    const diverged = newInst
      ? SP.__test.getRawState().sourceBindings.find(x => x.instanceId === newInst.instanceId)
      : null;
    return {
      assetBindingId: asset.sourceBindingId,
      beforeBindingId,
      beforeType,
      mainType: main && main.sourceType,
      diverged: diverged && diverged.sourceDivergence === true,
      ok: done.ok
    };
  });
  assert(r.assetBindingId === r.beforeBindingId && r.mainType === 'github' && r.diverged === true, JSON.stringify(r));
});

// 7 Single-target exception leaves no half-baked
test('F1-7 Single-target failure leaves no half-baked entities', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    SP.loadInstallDemoCase('fail-codex');
    // only fail host = force all fail by installing only codex with fail
    const before = {
      assets: SP.__test.getRawState().assets.map(a => a.id),
      instances: SP.__test.getRawState().instances.map(i => i.id),
      files: SP.__test.getRawState().files.map(f => f.id),
      bindings: SP.__test.getRawState().sourceBindings.map(b => b.id),
      snaps: SP.__test.getRawState().snapshots.map(s => s.id)
    };
    const prep = SP.prepareInstall({ source: 'github:acme/hello-skill', hostIds: ['codex'], mode: 'new-asset' });
    const done = SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const after = SP.__test.getRawState();
    const newAssets = after.assets.filter(a => !before.assets.includes(a.id));
    const newInst = after.instances.filter(i => !before.instances.includes(i.id));
    const newFiles = after.files.filter(f => !before.files.includes(f.id));
    const newBind = after.sourceBindings.filter(b => !before.bindings.includes(b.id));
    const newSnap = after.snapshots.filter(s => !before.snaps.includes(s.id) && (s.source || '').indexOf('install') >= 0);
    return {
      status: done.status,
      newAssets: newAssets.length,
      newInst: newInst.length,
      newFiles: newFiles.length,
      newBind: newBind.length,
      newSnap: newSnap.length,
      results: done.results
    };
  });
  assert(r.status === 'failed' || (r.results && r.results.every(x => x.status === 'failed')), JSON.stringify(r));
  assert(r.newAssets === 0 && r.newInst === 0 && r.newFiles === 0 && r.newBind === 0, JSON.stringify(r));
});

// 8 Update confirm uses same operationId
test('F1-8 Update confirm uses original operationId (no silent re-prepare)', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f1' }));
    const prep = SP.prepareUpdate({ assetId: id, selectedRelativePaths: ['SKILL.md'], instanceIds: [SP.getAssetInstances(id)[0].id] });
    if (!prep.ok) return { step: 'prep', prep };
    const opId = prep.operationId;
    const done = SP.confirmUpdate(opId, { userConfirmed: true });
    return { opId, doneOp: done.operationId, status: done.status, same: done.operationId === opId };
  });
  assert(r.same && r.status === 'completed', JSON.stringify(r));
});

// 9–12 Confirm-time conflicts
test('F1-9 Prepare then add file → Conflict', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f1' });
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    SP.__test.getRawState().files.push({
      id: SP.uuid(), instanceId: inst.id, skillId: id, relativePath: 'NEW_AFTER_PREP.md',
      fileType: 'text', content: 'x', contentHash: 'x', sizeBytes: 1, modifiedAt: new Date().toISOString(),
      tokenCount: 1, tokenCountMode: 'estimated', indexStatus: 'indexed'
    });
    SP.__test.saveState();
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'conflict', JSON.stringify(r));
});

test('F1-10 Prepare then delete file → Conflict', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f1' });
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    const files = SP.__test.getRawState().files.filter(f => f.instanceId === inst.id && f.relativePath !== 'SKILL.md');
    if (files[0]) {
      SP.__test.getRawState().files = SP.__test.getRawState().files.filter(f => f.id !== files[0].id);
      SP.__test.saveState();
    }
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'conflict', JSON.stringify(r));
});

test('F1-11 Prepare then only modifiedAt change → Conflict', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f1' });
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    const f = SP.__test.getRawState().files.find(x => x.instanceId === inst.id && x.relativePath === 'SKILL.md');
    f.modifiedAt = new Date(Date.now() + 60000).toISOString();
    SP.__test.saveState();
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'conflict', JSON.stringify(r));
});

test('F1-12 Prepare then SourceBinding change → Conflict', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f1' });
    let b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id);
    if (!b) {
      b = { id: SP.uuid(), skillId: id, sourceType: 'github', sourceUrl: 'x', repository: 'x', branch: 'main', baselineVersion: '1', baselineCommit: '1', baselineSnapshotId: null, trustPolicy: 'untrusted', lastCheckedAt: null, updateStatus: 'update-available', remoteVersion: '9.9.9', remoteCommit: 'zzz' };
      SP.__test.getRawState().sourceBindings.push(b);
      SP.__test.getRawState().assets.find(a => a.id === id).sourceBindingId = b.id;
      SP.__test.saveState();
    }
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    b.remoteCommit = 'CHANGED_AFTER_PREP';
    SP.__test.saveState();
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'conflict', JSON.stringify(r));
});

// 13–15 Atomic rollback
test('F1-13 Second instance write fail rolls back first', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    // ensure 2 instances
    let insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    if (insts.length < 2) {
      const prepI = SP.prepareInstall({ source: 'local-directory:~/Skills/local-demo', hostIds: ['custom'], mode: 'add-instance', existingAssetId: id });
      SP.confirmInstall(prepI.operationId, { userConfirmed: true });
      insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    }
    const a = insts[0];
    const b = insts[1];
    SP.requestWritePermission({ instanceId: a.id, purpose: 'f1' });
    SP.requestWritePermission({ instanceId: b.id, purpose: 'f1' });
    SP.loadUpdateDemoCase('update-available');
    const beforeHash = SP.__test.getRawState().files.find(f => f.instanceId === a.id && f.relativePath === 'SKILL.md').contentHash;
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [a.id, b.id],
      selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': 'use-remote' }
    });
    SP.__test.getRawState().installSim.updateFailInstanceId = b.id;
    SP.__test.saveState();
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const afterHash = SP.__test.getRawState().files.find(f => f.instanceId === a.id && f.relativePath === 'SKILL.md').contentHash;
    const binding = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id);
    return {
      status: done.status,
      results: done.results,
      beforeHash,
      afterHash,
      baselineUnchanged: binding ? binding.updateStatus !== 'up-to-date' || binding.baselineVersion !== '9.9.9' : true
    };
  });
  assert(r.status === 'rolled-back' || r.status === 'failed', JSON.stringify(r));
  assert(r.beforeHash === r.afterHash, 'first instance must be restored: ' + JSON.stringify(r));
  const first = (r.results || []).find(x => x.status === 'rolled-back' || x.rollbackStatus === 'rolled-back');
  assert(!!first || r.status === 'failed', JSON.stringify(r));
});

test('F1-14 Rollback restores full file metadata', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    let insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    if (insts.length < 2) {
      const prepI = SP.prepareInstall({
        source: 'local-directory:~/Skills/local-demo',
        hostIds: ['custom'],
        mode: 'add-instance',
        existingAssetId: id
      });
      SP.confirmInstall(prepI.operationId, { userConfirmed: true });
      insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    }
    const a = insts[0];
    const b = insts[1];
    SP.requestWritePermission({ instanceId: a.id, purpose: 'f1' });
    SP.requestWritePermission({ instanceId: b.id, purpose: 'f1' });
    SP.loadUpdateDemoCase('update-available');
    const file = SP.__test.getRawState().files.find(f => f.instanceId === a.id && f.relativePath === 'SKILL.md');
    const before = {
      content: file.content, contentHash: file.contentHash, modifiedAt: file.modifiedAt,
      sizeBytes: file.sizeBytes, tokenCount: file.tokenCount, tokenCountMode: file.tokenCountMode
    };
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [a.id, b.id],
      selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': 'use-remote' }
    });
    SP.__test.getRawState().installSim.updateFailInstanceId = b.id;
    SP.__test.saveState();
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const after = SP.__test.getRawState().files.find(f => f.instanceId === a.id && f.relativePath === 'SKILL.md');
    return {
      status: done.status,
      before,
      after: {
        content: after.content, contentHash: after.contentHash, modifiedAt: after.modifiedAt,
        sizeBytes: after.sizeBytes, tokenCount: after.tokenCount, tokenCountMode: after.tokenCountMode
      }
    };
  });
  assert(r.status === 'rolled-back', JSON.stringify({ status: r.status }));
  assert(r.before.contentHash === r.after.contentHash, JSON.stringify(r));
  assert(r.before.modifiedAt === r.after.modifiedAt, JSON.stringify(r));
  assert(r.before.sizeBytes === r.after.sizeBytes, JSON.stringify(r));
  assert(r.before.tokenCount === r.after.tokenCount, JSON.stringify(r));
  assert(r.before.tokenCountMode === r.after.tokenCountMode, JSON.stringify(r));
  assert(r.before.content === r.after.content, 'content restored');
});

test('F1-15 Rollback failure returns rollback-failed', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f1' });
    SP.loadUpdateDemoCase('update-available');
    SP.__test.getRawState().files.push({
      id: SP.uuid(), instanceId: inst.id, skillId: id, relativePath: 'references/y.md',
      fileType: 'text', content: 'y', contentHash: 'y', sizeBytes: 1, modifiedAt: new Date().toISOString(),
      tokenCount: 1, tokenCountMode: 'estimated', indexStatus: 'indexed'
    });
    SP.__test.saveState();
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id],
      selectedRelativePaths: ['SKILL.md', 'references/y.md'],
      fileStrategies: { 'SKILL.md': 'use-remote', 'references/y.md': 'use-remote' }
    });
    SP.__test.getRawState().installSim.updateFailRelativePath = 'references/y.md';
    SP.__test.getRawState().installSim.updateRollbackFailInstanceId = inst.id;
    SP.__test.saveState();
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.status === 'rollback-failed', JSON.stringify(r));
});

// 16–19 Uninstall
test('F1-16 Detach Source does not stop Instances', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    let b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id);
    if (!b) {
      b = { id: SP.uuid(), skillId: id, sourceType: 'github', sourceUrl: 'x', repository: 'x', branch: 'main', baselineVersion: '1', baselineCommit: '1', baselineSnapshotId: null, trustPolicy: 'untrusted', lastCheckedAt: null, updateStatus: 'unknown', remoteVersion: '1', remoteCommit: '1' };
      SP.__test.getRawState().sourceBindings.push(b);
      SP.__test.getRawState().assets.find(a => a.id === id).sourceBindingId = b.id;
      SP.__test.saveState();
    }
    const beforeInst = SP.__test.getRawState().instances.filter(i => i.skillId === id).map(i => ({ id: i.id, life: i.lifecycleStatus, primary: i.isPrimary }));
    const beforeAsset = SP.__test.getRawState().assets.find(a => a.id === id);
    const beforePrimary = beforeAsset.primaryInstanceId;
    const beforeLife = beforeAsset.lifecycleStatus;
    const prep = SP.prepareUninstall({ assetId: id, mode: 'detach-source' });
    const done = SP.confirmUninstall(prep.operationId, { userConfirmed: true });
    const afterInst = SP.__test.getRawState().instances.filter(i => i.skillId === id).map(i => ({ id: i.id, life: i.lifecycleStatus, primary: i.isPrimary }));
    const afterAsset = SP.__test.getRawState().assets.find(a => a.id === id);
    return {
      targetsLen: (prep.targets || []).length,
      done,
      beforeInst, afterInst,
      beforePrimary, afterPrimary: afterAsset.primaryInstanceId,
      beforeLife, afterLife: afterAsset.lifecycleStatus,
      stillBound: SP.__test.getRawState().sourceBindings.some(x => x.skillId === id)
    };
  });
  assert(r.targetsLen === 0 && r.done.ok && !r.stillBound, JSON.stringify(r));
  assert(r.beforeLife === r.afterLife && r.beforePrimary === r.afterPrimary, JSON.stringify(r));
  assert(JSON.stringify(r.beforeInst) === JSON.stringify(r.afterInst), JSON.stringify(r));
});

test('F1-17 Delete Local Copy always requires second confirm even if deleteFiles false', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-codex');
    const inst = SP.getAssetInstances(id)[0];
    const prep = SP.prepareUninstall({ assetId: id, mode: 'delete-local-copy', instanceIds: [inst.id], deleteFiles: false });
    const no = SP.confirmUninstall(prep.operationId, { userConfirmed: true });
    const yes = SP.confirmUninstall(prep.operationId, { userConfirmed: true, secondConfirmed: true });
    return { requires: prep.requiresSecondConfirm, no, yes };
  });
  assert(r.requires === true && r.no.code === 'second_confirm_required' && r.yes.ok, JSON.stringify(r));
});

test('F1-18 Uninstall confirm invalidated when Instance changes', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id)[0];
    const prep = SP.prepareUninstall({ assetId: id, mode: 'stop-managing', instanceIds: [inst.id] });
    SP.__test.getRawState().instances.find(i => i.id === inst.id).lifecycleStatus = 'stopped';
    SP.__test.saveState();
    return SP.confirmUninstall(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && (r.code === 'conflict' || r.code === 'stale' || r.code === 'operation_invalid' || r.code === 'precheck_failed'), JSON.stringify(r));
});

test('F1-19 Uninstall second target fail rolls back first', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    let insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    if (insts.length < 2) {
      const prepI = SP.prepareInstall({ source: 'local-directory:~/Skills/local-demo', hostIds: ['custom'], mode: 'add-instance', existingAssetId: id });
      SP.confirmInstall(prepI.operationId, { userConfirmed: true });
      insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    }
    const a = insts[0];
    const b = insts[1];
    const beforeA = a.lifecycleStatus;
    const prep = SP.prepareUninstall({ assetId: id, mode: 'stop-managing', instanceIds: [a.id, b.id] });
    SP.__test.getRawState().installSim.uninstallFailInstanceId = b.id;
    SP.__test.saveState();
    const done = SP.confirmUninstall(prep.operationId, { userConfirmed: true });
    const afterA = SP.__test.getRawState().instances.find(i => i.id === a.id);
    return { status: done.status, beforeA, afterA: afterA.lifecycleStatus, results: done.results };
  });
  assert(r.afterA === r.beforeA, 'first must roll back: ' + JSON.stringify(r));
  assert(r.status === 'rolled-back' || r.status === 'rollback-failed' || r.status === 'failed', JSON.stringify(r));
});

// 20–24 Compare
test('F1-20 Compare real Diff non-empty with readable bodies', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    // ensure contents differ
    const li = SP.getAssetInstances(left)[0];
    const ri = SP.getAssetInstances(right)[0];
    const lf = SP.__test.getRawState().files.find(f => f.instanceId === li.id && f.relativePath === 'SKILL.md');
    const rf = SP.__test.getRawState().files.find(f => f.instanceId === ri.id && f.relativePath === 'SKILL.md');
    if (lf && rf && lf.content === rf.content) {
      rf.content = String(rf.content || '') + '\n## Diff Marker B\n';
      rf.contentHash = SP.$hash(rf.content);
      SP.__test.saveState();
    }
    const opened = SP.openCompareSession([left, right]);
    const sessionId = opened.session.id;
    const dL = SP.getCompareFileDetail(sessionId, left, lf.id);
    const dR = SP.getCompareFileDetail(sessionId, right, rf.id);
    const lines = (typeof SP.lineDiffSafe === 'function' ? SP.lineDiffSafe : SP.$lineDiff)(dL.content || '', dR.content || '');
    const hasAddOrDel = (lines || []).some(l => l.type === 'add' || l.type === 'del' || l.t === 'add' || l.t === 'del');
    return {
      readable: !!(dL && dL.content && dR && dR.content),
      nonEmpty: (lines || []).length > 0,
      hasAddOrDel,
      skillContentNull: SP.getSkill(left).content == null
    };
  });
  assert(r.readable && r.nonEmpty && r.hasAddOrDel && r.skillContentNull, JSON.stringify(r));
});

test('F1-21 Compare merge keeps primary UUID', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    const done = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    return {
      preserved: done.preservedAssetId || done.primaryAssetId,
      left,
      ok: done.ok,
      mergedInto: (SP.__test.getRawState().assets.find(a => a.id === right) || {}).mergedIntoAssetId
    };
  });
  assert(r.ok && r.preserved === r.left && r.mergedInto === r.left, JSON.stringify(r));
});

test('F1-22 After merge no active dangling refs to deleted Asset', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('release-notes');
    const right = SP.resolveAssetId('changelog-zh');
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const deleted = SP.__test.getRawState().assets.filter(a => a.id === right);
    const danglingInst = SP.__test.getRawState().instances.filter(i => i.skillId === right && i.lifecycleStatus === 'available');
    const danglingDraft = SP.__test.getRawState().drafts.filter(d => d.skillId === right);
    return { deletedLife: deleted[0] && deleted[0].lifecycleStatus, danglingInst: danglingInst.length, danglingDraft: danglingDraft.length };
  });
  assert(r.deletedLife === 'deleted' && r.danglingInst === 0, JSON.stringify(r));
});

test('F1-23 Merge-new SourceBinding/Draft/Snapshot ownership', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    // seed a draft on left
    const inst = SP.getAssetInstances(left)[0];
    const file = SP.__test.getRawState().files.find(f => f.instanceId === inst.id && f.relativePath === 'SKILL.md');
    SP.__test.getRawState().drafts.push({
      id: SP.uuid(), skillId: left, instanceId: inst.id, fileId: file.id, relativePath: 'SKILL.md',
      content: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      baseContentHash: file.contentHash, status: 'modified'
    });
    const beforeSnaps = SP.__test.getRawState().snapshots.filter(s => s.skillId === left || s.skillId === right);
    // ensure at least one snapshot on left
    if (!beforeSnaps.length) {
      const snap = SP.__test.createPackageSnapshotForInstance(inst.id, { note: 'pre-merge', source: 'f1-test', retained: true });
      SP.__test.getRawState().snapshots.push(snap);
      SP.__test.saveState();
    }
    const snapCountBefore = SP.__test.getRawState().snapshots.filter(s => s.skillId === left || s.skillId === right).length;
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'merge-new',
      candidateIds: [left, right],
      name: 'merged-f1'
    });
    const done = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const newId = done.newAssetId;
    const drafts = SP.__test.getRawState().drafts.filter(d => d.skillId === newId);
    const snapsAfter = SP.__test.getRawState().snapshots.filter(s => s.skillId === newId || s.skillId === left || s.skillId === right);
    const snapsOnCanonical = SP.__test.getRawState().snapshots.filter(s => s.skillId === newId);
    const danglingSnap = SP.__test.getRawState().snapshots.filter(s => {
      const a = SP.__test.getRawState().assets.find(x => x.id === s.skillId);
      return !a || (a.lifecycleStatus === 'deleted' && !a.mergedIntoAssetId);
    });
    const oldLeft = SP.__test.getRawState().assets.find(a => a.id === left);
    return {
      ok: done.ok,
      newId,
      uuid: /^[0-9a-f-]{36}$/i.test(newId || ''),
      drafts: drafts.length,
      snapCountBefore,
      snapsOnCanonical: snapsOnCanonical.length,
      snapTotal: snapsAfter.length,
      danglingSnap: danglingSnap.length,
      mergedInto: oldLeft && oldLeft.mergedIntoAssetId === newId
    };
  });
  assert(r.ok && r.uuid && r.drafts >= 1 && r.mergedInto, JSON.stringify(r));
  assert(r.snapCountBefore >= 1 && r.snapsOnCanonical >= 1 && r.danglingSnap === 0, JSON.stringify(r));
});

test('F1-24 Duplicate Operation cannot confirm twice', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('prompt-lint');
    const right = SP.resolveAssetId('prompt-check');
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'keep-independent'.replace('keep-independent', 'archive'),
      archiveAssetId: right,
      candidateIds: [left, right]
    });
    // archive is destructive
    const first = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const second = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    return { firstOk: first.ok, second };
  });
  assert(r.firstOk && r.second.ok === false && r.second.code === 'operation_invalid', JSON.stringify(r));
});

test('F1 pages avoid Raw/saveState and silent re-prepare on confirm', async () => {
  const updateSrc = fs.readFileSync(path.join(ROOT, 'update-app.js'), 'utf8');
  assert(!/confirmUpdate\([\s\S]*prepareUpdate/.test(updateSrc.replace(/\/\/.*$/gm, '')), 'update confirm must not call prepareUpdate');
  // more precise: btn-confirm handler should not call prepareUpdate
  const confirmBlock = updateSrc.split("btn-confirm')")[1] || updateSrc.split('btn-confirm')[1] || '';
  assert(!/prepareUpdate/.test(confirmBlock.slice(0, 800)), 'confirm handler prepares again');
  ['install-app.js', 'update-app.js', 'uninstall-app.js', 'compare-app.js'].forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert(!/getAssetRaw|getInstanceRaw|SP\.saveState/.test(src), f);
  });
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let passed = 0, failed = 0;
  console.log('=== Phase F.1 Targeted Tests ===\n');
  for (const t of tests) {
    try {
      await t.fn();
      console.log('✅', t.name);
      passed++;
    } catch (e) {
      console.log('❌', t.name + ':', e.message);
      failed++;
    }
  }
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
