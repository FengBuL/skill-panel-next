/**
 * Phase F.4.1 — path classification, instance version/status, binary real change, instanceStates.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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

function assertUniquePaths(files, label) {
  const paths = (files || []).map(f => f.relativePath);
  assert(paths.length === new Set(paths).size, label + ' duplicate paths: ' + paths.join(','));
}

function assertDisjoint(selected, adds, deletes) {
  const s = new Set(selected || []);
  const a = new Set((adds || []).map(x => typeof x === 'string' ? x : x.relativePath));
  const d = new Set((deletes || []).map(x => typeof x === 'string' ? x : x.relativePath));
  for (const p of s) assert(!a.has(p) && !d.has(p), 'selected intersects add/delete: ' + p);
  for (const p of a) assert(!d.has(p), 'add intersects delete: ' + p);
}

async function grantWrites(assetId) {
  await evalSP((id) => {
    SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f41' }));
  }, assetId);
}

async function prepConfirm(strategies) {
  return evalSP((strats) => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f41' }));
    const preview = SP.getUpdatePlanPreview({ assetId: id });
    const files = preview.files || [];
    const fileStrategies = {};
    files.forEach(f => { fileStrategies[f.relativePath] = strats[f.relativePath] || strats['*'] || 'use-remote'; });
    Object.keys(strats).forEach(k => { if (k !== '*') fileStrategies[k] = strats[k]; });

    const selectedPaths = new Set();
    const addPaths = new Set();
    const deletePaths = new Set();
    files.forEach(f => {
      if (!fileStrategies[f.relativePath]) return;
      if (f.changeType === 'added') addPaths.add(f.relativePath);
      else if (f.changeType === 'deleted') deletePaths.add(f.relativePath);
      else if (f.changeType === 'modified' || f.changeType === 'binary-changed') selectedPaths.add(f.relativePath);
    });
    const instIds = SP.getAssetInstances(id).filter(i => i.lifecycleStatus !== 'missing').map(i => i.id);
    const before = instIds.map(iid => {
      const inst = SP.__test.getRawState().instances.find(x => x.id === iid);
      return {
        id: iid,
        installedVersion: inst.installedVersion,
        packageHash: SP.__test.packageHashForInstance
          ? SP.__test.packageHashForInstance(iid)
          : null,
        localModificationStatus: inst.localModificationStatus
      };
    });
    // packageHash via checkpoint after prepare
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: instIds,
      selectedRelativePaths: [...selectedPaths],
      remoteAdds: [...addPaths].map(relativePath => ({ relativePath })),
      remoteDeletes: [...deletePaths],
      fileStrategies
    });
    if (!prep.ok) return { ok: false, prep };
    const beforeExact = prep.targets.map(t => {
      const cp = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId)._instanceCheckpoints[t.instanceId];
      return {
        id: t.instanceId,
        installedVersion: cp.instance.installedVersion,
        packageHash: cp.packageHash,
        localModificationStatus: cp.instance.localModificationStatus
      };
    });
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    const binding = SP.__test.getRawState().sourceBindings.find(b => b.skillId === id || b.id === (op && op.source && op.source.bindingId));
    return {
      ok: true,
      prep,
      done,
      op,
      binding,
      before: beforeExact,
      after: prep.targets.map(t => {
        const inst = SP.__test.getRawState().instances.find(x => x.id === t.instanceId);
        const cp = op._instanceCheckpoints[t.instanceId];
        return {
          id: t.instanceId,
          installedVersion: inst.installedVersion,
          packageHash: (() => {
            const files = SP.__test.getRawState().files.filter(f => f.instanceId === t.instanceId)
              .slice().sort((a, b) => a.relativePath.localeCompare(b.relativePath));
            // recompute same as packageHashForInstance via public if available
            return cp ? null : null;
          })(),
          localModificationStatus: inst.localModificationStatus,
          packageHashNow: null
        };
      }),
      checkpoints: op._instanceCheckpoints
    };
  }, strategies);
}

test('F41-1 Remote Add not in selectedRelativePaths', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f41' }));
    const preview = SP.getUpdatePlanPreview({ assetId: id });
    const add = preview.files.find(f => f.changeType === 'added');
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'use-remote'; });
    const selectedPaths = [];
    const remoteAdds = [];
    const remoteDeletes = [];
    preview.files.forEach(f => {
      if (f.changeType === 'added') remoteAdds.push({ relativePath: f.relativePath });
      else if (f.changeType === 'deleted') remoteDeletes.push(f.relativePath);
      else selectedPaths.push(f.relativePath);
    });
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [SP.getAssetInstances(id)[0].id],
      selectedRelativePaths: selectedPaths.concat([add.relativePath]),
      remoteAdds,
      remoteDeletes,
      fileStrategies: strategies
    });
    return {
      add: add.relativePath,
      selected: prep.selectedRelativePaths,
      adds: (prep.remoteAdds || []).map(a => a.relativePath),
      deletes: prep.remoteDeletes
    };
  });
  assert(!r.selected.includes(r.add), JSON.stringify(r));
  assert(r.adds.includes(r.add), JSON.stringify(r));
  assertDisjoint(r.selected, r.adds, r.deletes);
});

test('F41-2 Remote Delete not in selectedRelativePaths', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f41' }));
    const preview = SP.getUpdatePlanPreview({ assetId: id });
    const del = preview.files.find(f => f.changeType === 'deleted');
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'use-remote'; });
    const selectedPaths = preview.files.filter(f => f.changeType === 'modified' || f.changeType === 'binary-changed').map(f => f.relativePath);
    const remoteAdds = preview.files.filter(f => f.changeType === 'added').map(f => ({ relativePath: f.relativePath }));
    const remoteDeletes = [del.relativePath];
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [SP.getAssetInstances(id)[0].id],
      selectedRelativePaths: selectedPaths.concat([del.relativePath]),
      remoteAdds,
      remoteDeletes,
      fileStrategies: strategies
    });
    return { del: del.relativePath, selected: prep.selectedRelativePaths, deletes: prep.remoteDeletes, adds: (prep.remoteAdds || []).map(a => a.relativePath) };
  });
  assert(!r.selected.includes(r.del), JSON.stringify(r));
  assert(r.deletes.includes(r.del), JSON.stringify(r));
  assertDisjoint(r.selected, r.adds, r.deletes);
});

test('F41-3 Modified only enters selectedRelativePaths', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f41' }));
    const preview = SP.getUpdatePlanPreview({ assetId: id });
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'use-remote'; });
    const selectedPaths = preview.files.filter(f => f.changeType === 'modified' || f.changeType === 'binary-changed').map(f => f.relativePath);
    const remoteAdds = preview.files.filter(f => f.changeType === 'added').map(f => ({ relativePath: f.relativePath }));
    const remoteDeletes = preview.files.filter(f => f.changeType === 'deleted').map(f => f.relativePath);
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [SP.getAssetInstances(id)[0].id],
      selectedRelativePaths: selectedPaths,
      remoteAdds,
      remoteDeletes,
      fileStrategies: strategies
    });
    return {
      selected: prep.selectedRelativePaths,
      adds: (prep.remoteAdds || []).map(a => a.relativePath),
      deletes: prep.remoteDeletes,
      modified: preview.files.filter(f => f.changeType === 'modified').map(f => f.relativePath)
    };
  });
  r.modified.forEach(p => assert(r.selected.includes(p), 'missing modified ' + p));
  r.modified.forEach(p => assert(!r.adds.includes(p) && !r.deletes.includes(p), 'modified leaked ' + p));
  assertDisjoint(r.selected, r.adds, r.deletes);
});

test('F41-4 Remote Add one final result per Instance', async () => {
  await freshPage(); await resetState();
  const r = await prepConfirm({ '*': 'use-remote' });
  assert(r.ok, JSON.stringify(r.prep));
  r.done.results.forEach(res => {
    assertUniquePaths(res.files, res.instanceId);
    const adds = res.files.filter(f => f.relativePath === 'NEW_REMOTE.md');
    assert(adds.length === 1, JSON.stringify(adds));
    assert(adds[0].status === 'completed', JSON.stringify(adds[0]));
  });
});

test('F41-5 Remote Delete one final result per Instance', async () => {
  await freshPage(); await resetState();
  const r = await prepConfirm({ '*': 'use-remote' });
  assert(r.ok);
  const delPath = (r.prep.remoteDeletes || [])[0];
  assert(delPath, 'no delete path');
  r.done.results.forEach(res => {
    assertUniquePaths(res.files, res.instanceId);
    const dels = res.files.filter(f => f.relativePath === delPath);
    assert(dels.length === 1, JSON.stringify(dels));
  });
});

test('F41-6 Add Defer one deferred per Instance', async () => {
  await freshPage(); await resetState();
  const r = await prepConfirm({ '*': 'defer', 'NEW_REMOTE.md': 'defer' });
  assert(r.ok);
  r.done.results.forEach(res => {
    assertUniquePaths(res.files, res.instanceId);
    const adds = res.files.filter(f => f.relativePath === 'NEW_REMOTE.md');
    assert(adds.length === 1 && adds[0].status === 'deferred', JSON.stringify(adds));
  });
});

test('F41-7 Delete Keep Local one kept-local per Instance', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f41' }));
    const preview = SP.getUpdatePlanPreview({ assetId: id });
    const del = preview.files.find(f => f.changeType === 'deleted');
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'use-remote'; });
    strategies[del.relativePath] = 'keep-local';
    const selectedPaths = preview.files.filter(f => f.changeType === 'modified' || f.changeType === 'binary-changed').map(f => f.relativePath);
    const remoteAdds = preview.files.filter(f => f.changeType === 'added').map(f => ({ relativePath: f.relativePath }));
    const instIds = SP.getAssetInstances(id).filter(i => i.lifecycleStatus !== 'missing').map(i => i.id);
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: instIds, selectedRelativePaths: selectedPaths,
      remoteAdds, remoteDeletes: [del.relativePath], fileStrategies: strategies
    });
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    return { del: del.relativePath, results: done.results };
  });
  r.results.forEach(res => {
    assertUniquePaths(res.files, res.instanceId);
    const kept = res.files.filter(f => f.relativePath === r.del);
    assert(kept.length === 1 && kept[0].status === 'kept-local', JSON.stringify(kept));
  });
});

test('F41-8 Single Instance Add Manual Merge creates exactly 1 Draft', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id).find(i => i.isPrimary) || SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f41' });
    const preview = SP.getUpdatePlanPreview({ assetId: id, instanceIds: [inst.id] });
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'defer'; });
    strategies['NEW_REMOTE.md'] = 'manual-merge';
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id],
      selectedRelativePaths: [],
      remoteAdds: [{ relativePath: 'NEW_REMOTE.md' }],
      remoteDeletes: [],
      fileStrategies: strategies
    });
    const before = SP.__test.getRawState().drafts.filter(d => d.status === 'update-manual-merge').length;
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const drafts = SP.__test.getRawState().drafts.filter(d =>
      d.sourceOperationId === prep.operationId && d.instanceId === inst.id && d.relativePath === 'NEW_REMOTE.md' && d.status === 'update-manual-merge'
    );
    return { draftCount: drafts.length, before, status: done.status, files: done.results[0].files };
  });
  assert(r.draftCount === 1, JSON.stringify(r));
  assertUniquePaths(r.files, 'merge-add');
});

test('F41-9 Single Instance Add Manual Merge creates exactly 1 PendingTask', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id).find(i => i.isPrimary) || SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f41' });
    const strategies = { 'NEW_REMOTE.md': 'manual-merge' };
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id],
      selectedRelativePaths: [],
      remoteAdds: [{ relativePath: 'NEW_REMOTE.md' }],
      remoteDeletes: [],
      fileStrategies: strategies
    });
    SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const tasks = SP.__test.getRawState().pendingTasks.filter(t =>
      t.sourceOperationId === prep.operationId && t.instanceId === inst.id &&
      t.relativePath === 'NEW_REMOTE.md' && t.taskType === 'update_manual_merge' && t.status === 'open'
    );
    return { taskCount: tasks.length, keys: tasks.map(t => [t.sourceOperationId, t.instanceId, t.relativePath]) };
  });
  assert(r.taskCount === 1, JSON.stringify(r));
});

test('F41-10 Result file count equals unique change paths per Instance', async () => {
  await freshPage(); await resetState();
  const r = await prepConfirm({ '*': 'use-remote' });
  assert(r.ok);
  const expected = new Set([
    ...(r.prep.selectedRelativePaths || []),
    ...(r.prep.remoteAdds || []).map(a => a.relativePath),
    ...(r.prep.remoteDeletes || [])
  ]);
  r.done.results.forEach(res => {
    assertUniquePaths(res.files, res.instanceId);
    assert(res.files.length === expected.size, JSON.stringify({ got: res.files.length, expected: expected.size, files: res.files }));
  });
});

test('F41-11 All Defer keeps installedVersion', async () => {
  await freshPage(); await resetState();
  const r = await prepConfirm({ '*': 'defer' });
  assert(r.ok, JSON.stringify(r.prep));
  assert(r.done.status === 'partially-completed', r.done.status);
  const check = await evalSP((payload) => payload.before.map(b => {
    const inst = SP.__test.getRawState().instances.find(x => x.id === b.id);
    return {
      id: b.id,
      before: b.installedVersion,
      after: inst.installedVersion,
      same: b.installedVersion === inst.installedVersion,
      localBefore: b.localModificationStatus,
      localAfter: inst.localModificationStatus
    };
  }), r);
  check.forEach(c => assert(c.same, JSON.stringify(c)));
  check.forEach(c => assert(c.localBefore === c.localAfter, JSON.stringify(c)));
});

test('F41-12 All Defer keeps Package Hash', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const instIds = SP.getAssetInstances(id).filter(i => i.lifecycleStatus !== 'missing').map(i => i.id);
    instIds.forEach(i => SP.requestWritePermission({ instanceId: i, purpose: 'f41' }));
    const preview = SP.getUpdatePlanPreview({ assetId: id });
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'defer'; });
    const selectedPaths = preview.files.filter(f => f.changeType === 'modified' || f.changeType === 'binary-changed').map(f => f.relativePath);
    const remoteAdds = preview.files.filter(f => f.changeType === 'added').map(f => ({ relativePath: f.relativePath }));
    const remoteDeletes = preview.files.filter(f => f.changeType === 'deleted').map(f => f.relativePath);
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: instIds, selectedRelativePaths: selectedPaths,
      remoteAdds, remoteDeletes, fileStrategies: strategies
    });
    const beforeHashes = {};
    prep.targets.forEach(t => {
      beforeHashes[t.instanceId] = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId)
        ._instanceCheckpoints[t.instanceId].packageHash;
    });
    SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const after = {};
    prep.targets.forEach(t => {
      const files = SP.__test.getRawState().files.filter(f => f.instanceId === t.instanceId)
        .slice().sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      const cp = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId)._instanceCheckpoints[t.instanceId];
      const beforeFiles = (cp.files || []).slice().sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      const toSig = (arr) => arr.map(f => f.relativePath + ':' + f.contentHash + ':' + (f.sizeBytes || 0)).join('|');
      const beforeSig = toSig(beforeFiles);
      const afterSig = toSig(files);
      after[t.instanceId] = { beforeHash: beforeHashes[t.instanceId], beforeSig, afterSig, same: beforeSig === afterSig };
    });
    return after;
  });
  Object.values(r).forEach(v => assert(v.same, JSON.stringify(v)));
});

test('F41-13 All Defer is partially-completed', async () => {
  await freshPage(); await resetState();
  const r = await prepConfirm({ '*': 'defer' });
  assert(r.done.status === 'partially-completed', r.done.status);
  const binding = await evalSP((opId) => {
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === opId);
    const b = SP.__test.getRawState().sourceBindings.find(x => x.id === op.source.bindingId);
    return b && b.updateStatus;
  }, r.prep.operationId);
  assert(binding === 'update-available', String(binding));
});

test('F41-14 Keep Local + Defer is partially-completed', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id).find(i => i.isPrimary) || SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f41' });
    const preview = SP.getUpdatePlanPreview({ assetId: id, instanceIds: [inst.id] });
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'defer'; });
    strategies['SKILL.md'] = 'keep-local';
    const selectedPaths = preview.files.filter(f => f.changeType === 'modified' || f.changeType === 'binary-changed').map(f => f.relativePath);
    const remoteAdds = preview.files.filter(f => f.changeType === 'added').map(f => ({ relativePath: f.relativePath }));
    const remoteDeletes = preview.files.filter(f => f.changeType === 'deleted').map(f => f.relativePath);
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: selectedPaths,
      remoteAdds, remoteDeletes, fileStrategies: strategies
    });
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const b = SP.__test.getRawState().sourceBindings.find(x => x.id === SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId).source.bindingId);
    const audits = SP.__test.getRawState().auditEvents.filter(e => e.skillId === id && e.eventType && e.eventType.indexOf('update_') === 0);
    const partial = audits.filter(e => e.eventType === 'update_partially_completed');
    return {
      status: done.status,
      hasLocal: !!done.hasLocalModifications,
      binding: b.updateStatus,
      partialCount: partial.length,
      partialResult: partial.length ? partial[partial.length - 1].result : null
    };
  });
  assert(r.status === 'partially-completed', JSON.stringify(r));
});

test('F41-15 Keep Local + Defer hasLocalModifications true', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id).find(i => i.isPrimary) || SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f41' });
    const preview = SP.getUpdatePlanPreview({ assetId: id, instanceIds: [inst.id] });
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'defer'; });
    strategies['SKILL.md'] = 'keep-local';
    const selectedPaths = preview.files.filter(f => f.changeType === 'modified' || f.changeType === 'binary-changed').map(f => f.relativePath);
    const remoteAdds = preview.files.filter(f => f.changeType === 'added').map(f => ({ relativePath: f.relativePath }));
    const remoteDeletes = preview.files.filter(f => f.changeType === 'deleted').map(f => f.relativePath);
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: selectedPaths,
      remoteAdds, remoteDeletes, fileStrategies: strategies
    });
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.hasLocalModifications === true, JSON.stringify(r));
  assert(r.status === 'partially-completed', r.status);
});

test('F41-16 Keep Local + Defer Binding update-available', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id).find(i => i.isPrimary) || SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f41' });
    const preview = SP.getUpdatePlanPreview({ assetId: id, instanceIds: [inst.id] });
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'defer'; });
    strategies['SKILL.md'] = 'keep-local';
    const selectedPaths = preview.files.filter(f => f.changeType === 'modified' || f.changeType === 'binary-changed').map(f => f.relativePath);
    const remoteAdds = preview.files.filter(f => f.changeType === 'added').map(f => ({ relativePath: f.relativePath }));
    const remoteDeletes = preview.files.filter(f => f.changeType === 'deleted').map(f => f.relativePath);
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: selectedPaths,
      remoteAdds, remoteDeletes, fileStrategies: strategies
    });
    SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    return SP.__test.getRawState().sourceBindings.find(b => b.id === op.source.bindingId).updateStatus;
  });
  assert(r === 'update-available', String(r));
});

test('F41-17 Keep Local + Defer one partial AuditEvent', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id).find(i => i.isPrimary) || SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f41' });
    const preview = SP.getUpdatePlanPreview({ assetId: id, instanceIds: [inst.id] });
    const strategies = {};
    preview.files.forEach(f => { strategies[f.relativePath] = 'defer'; });
    strategies['SKILL.md'] = 'keep-local';
    const selectedPaths = preview.files.filter(f => f.changeType === 'modified' || f.changeType === 'binary-changed').map(f => f.relativePath);
    const remoteAdds = preview.files.filter(f => f.changeType === 'added').map(f => ({ relativePath: f.relativePath }));
    const remoteDeletes = preview.files.filter(f => f.changeType === 'deleted').map(f => f.relativePath);
    const before = SP.__test.getRawState().auditEvents.length;
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: selectedPaths,
      remoteAdds, remoteDeletes, fileStrategies: strategies
    });
    SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const added = SP.__test.getRawState().auditEvents.slice(before).filter(e =>
      e.eventType === 'update_partially_completed' || e.eventType === 'update_completed' ||
      e.eventType === 'update_completed_with_local_modifications' || e.eventType === 'update_awaiting_merge'
    );
    return { count: added.length, type: added[0] && added[0].eventType, result: added[0] && added[0].result };
  });
  assert(r.count === 1, JSON.stringify(r));
  assert(r.type === 'update_partially_completed' && r.result === 'partial', JSON.stringify(r));
});

test('F41-18 All Use Remote upgrades installedVersion', async () => {
  await freshPage(); await resetState();
  const r = await prepConfirm({ '*': 'use-remote' });
  assert(r.ok);
  assert(r.done.status === 'completed', r.done.status);
  // if any non-completed file, skip — require all completed
  const allCompleted = r.done.results.every(res => res.files.every(f => f.status === 'completed'));
  assert(allCompleted, JSON.stringify(r.done.results));
  const check = await evalSP((payload) => payload.before.map(b => {
    const inst = SP.__test.getRawState().instances.find(x => x.id === b.id);
    const op = SP.__test.getRawState().updateOperations.slice(-1)[0];
    return { before: b.installedVersion, after: inst.installedVersion, remote: op.remoteVersion, upgraded: inst.installedVersion === op.remoteVersion };
  }), r);
  check.forEach(c => assert(c.upgraded, JSON.stringify(c)));
});

test('F41-19 Skipped keeps installedVersion', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id).find(i => i.isPrimary) || SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f41' });
    const beforeVer = inst.installedVersion;
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [inst.id],
      selectedRelativePaths: ['__missing_for_skip__.md'],
      remoteAdds: [],
      remoteDeletes: [],
      fileStrategies: { '__missing_for_skip__.md': 'use-remote' }
    });
    // inject remote content missing so skipped
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    op._remoteContents = op._remoteContents || {};
    delete op._remoteContents['__missing_for_skip__.md'];
    // rebuild confirmation hash would fail integrity — instead remove local and keep remote missing
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const after = SP.__test.getRawState().instances.find(x => x.id === inst.id);
    return {
      beforeVer,
      afterVer: after.installedVersion,
      files: done.results[0] && done.results[0].files,
      status: done.status,
      ok: done.ok
    };
  });
  const skipped = (r.files || []).filter(f => f.status === 'skipped');
  assert(skipped.length === 1, JSON.stringify(r));
  assert(r.afterVer === r.beforeVer, JSON.stringify(r));
});

test('F41-20 Identical Binary not in Preview', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.__test.getRawState().installSim.remoteBinaryChanges = null;
    SP.__test.saveState();
    const preview = SP.getUpdatePlanPreview({ assetId: id });
    const bins = (preview.files || []).filter(f => f.changeType === 'binary-changed');
    return { count: bins.length, paths: bins.map(b => b.relativePath) };
  });
  assert(r.count === 0, 'unchanged binary must not appear: ' + JSON.stringify(r));
});

test('F41-21 Real Binary change returns binary-changed', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.__test.getRawState().installSim.remoteBinaryChanges = {
      'assets/icon.png': { changed: true, contentHash: 'remote-binary-hash-f41', sizeBytes: 4096 }
    };
    SP.__test.saveState();
    const preview = SP.getUpdatePlanPreview({ assetId: id });
    const bin = (preview.files || []).find(f => f.relativePath === 'assets/icon.png');
    return bin && {
      changeType: bin.changeType,
      remoteHash: bin.remoteHash,
      remoteSize: bin.remoteSize,
      localHash: bin.localHash,
      localSize: bin.localSize
    };
  });
  assert(r && r.changeType === 'binary-changed', JSON.stringify(r));
  assert(r.remoteHash === 'remote-binary-hash-f41', JSON.stringify(r));
  assert(r.remoteSize === 4096, JSON.stringify(r));
});

test('F41-22 Multi-instance Preview returns full instanceStates', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const instIds = SP.getAssetInstances(id).filter(i => i.lifecycleStatus !== 'missing').map(i => i.id);
    const preview = SP.getUpdatePlanPreview({ assetId: id, instanceIds: instIds });
    const file = preview.files.find(f => f.relativePath === 'SKILL.md') || preview.files[0];
    return {
      instCount: instIds.length,
      states: file.instanceStates,
      stateCount: (file.instanceStates || []).length,
      ids: (file.instanceStates || []).map(s => s.instanceId).sort(),
      expected: instIds.slice().sort()
    };
  });
  assert(r.stateCount === r.instCount, JSON.stringify(r));
  assert(JSON.stringify(r.ids) === JSON.stringify(r.expected), JSON.stringify(r));
  r.states.forEach(s => {
    assert('localExists' in s && 'localHash' in s && 'localSize' in s, JSON.stringify(s));
    assert('localModificationStatus' in s && 'differsFromOtherInstances' in s, JSON.stringify(s));
  });
});

test('F41-23 Second Instance hash difference shows UI hint', async () => {
  await freshPage(); await resetState();
  const assetId = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const insts = SP.getAssetInstances(id).filter(i => i.lifecycleStatus !== 'missing');
    if (insts.length < 2) throw new Error('need 2 instances');
    const secondary = insts.find(i => !i.isPrimary) || insts[1];
    const file = SP.__test.getRawState().files.find(f => f.instanceId === secondary.id && f.relativePath === 'SKILL.md');
    file.content = String(file.content || '') + '\n<!-- F41_SECONDARY_DIFF -->\n';
    file.contentHash = 'f41-secondary-' + Date.now();
    file.sizeBytes = file.content.length;
    SP.__test.saveState();
    return id;
  });
  await grantWrites(assetId);
  await page.goto(BASE + '/update.html?skill=' + encodeURIComponent(assetId) + '&dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getUpdatePlanPreview);
  if (await page.$('#btn-force')) {
    await page.click('#btn-force');
  }
  await page.waitForSelector('[data-instance-difference="SKILL.md"]', { timeout: 10000 });
  const text = await page.locator('[data-instance-difference="SKILL.md"]').innerText();
  assert(/存在差异/.test(text), text);
  const summary = await page.locator('[data-instance-summary="SKILL.md"]').innerText();
  assert(/存在于/.test(summary), summary);
});

test('F41-24 phase-f4 original 22 tests still pass', async () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'phase-f4-targeted-tests.js')], {
    cwd: ROOT, env: process.env, encoding: 'utf8'
  });
  const out = (result.stdout || '') + (result.stderr || '');
  const m = out.match(/(\d+)\s+passed,\s*(\d+)\s+failed/);
  assert(result.status === 0, 'F4 suite failed:\n' + out.slice(-2000));
  assert(m && Number(m[1]) === 22 && Number(m[2]) === 0, 'expected 22 passed: ' + (m && m[0]));
});

test('F41-25 Phase A–F.3 suites remain wired', async () => {
  const runner = fs.readFileSync(path.join(ROOT, 'run-all-tests.js'), 'utf8');
  const required = [
    'e2e-test.js', 'walkthrough-test.js', 'phase1-targeted-tests.js', 'phase2-targeted-tests.js',
    'phase-b1-targeted-tests.js', 'phase-c-targeted-tests.js', 'phase-c1-targeted-tests.js',
    'phase-d-targeted-tests.js', 'phase-d1-targeted-tests.js', 'phase-d2-targeted-tests.js',
    'phase-e-targeted-tests.js', 'phase-e1-targeted-tests.js', 'phase-f0-targeted-tests.js',
    'phase-f-targeted-tests.js', 'phase-f1-targeted-tests.js', 'phase-f2-targeted-tests.js',
    'phase-f3-targeted-tests.js', 'phase-f4-targeted-tests.js', 'phase-f41-targeted-tests.js',
    'phase-g-targeted-tests.js'
  ];
  required.forEach(f => {
    assert(runner.includes("'" + f + "'"), 'missing suite in run-all-tests: ' + f);
    assert(fs.existsSync(path.join(ROOT, f)), 'missing file: ' + f);
  });
  const suites = runner.match(/suites = \[([\s\S]*?)\];/)[1].match(/'[^']+\.js'/g);
  assert(suites && suites.length === 20, 'expected 20 suites, got ' + (suites && suites.length));
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext();
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('✅ ' + t.name);
      passed += 1;
    } catch (e) {
      console.log('❌ ' + t.name);
      console.log('   ' + (e && e.message ? e.message : e));
      failed += 1;
    }
  }
  await browser.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
