/**
 * Phase F.2 targeted tests — Update immutability, full package rollback,
 * Rebind rollback, Canonical Asset / Usage, Duplicate checkpoint, Uninstall audit.
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

async function ensureTwoWritableInstances(assetKey) {
  return evalSP((key) => {
    const id = SP.resolveAssetId(key);
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
    insts.forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f2' }));
    SP.loadUpdateDemoCase('update-available');
    return { id, a: insts[0].id, b: insts[1].id };
  }, assetKey);
}

// 1 Confirm cannot override fileStrategies
test('F2-1 Confirm cannot override fileStrategies', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f2' });
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': 'use-remote' }
    });
    return SP.confirmUpdate(prep.operationId, {
      userConfirmed: true,
      fileStrategies: { 'SKILL.md': 'keep-local' }
    });
  });
  assert(r.ok === false && r.code === 'operation_tampered', JSON.stringify(r));
});

// 2 Confirm cannot pass remoteAdds
test('F2-2 Confirm cannot pass remoteAdds', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f2' });
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    return SP.confirmUpdate(prep.operationId, {
      userConfirmed: true,
      remoteAdds: [{ relativePath: 'evil.md', content: 'x' }]
    });
  });
  assert(r.ok === false && r.code === 'operation_tampered', JSON.stringify(r));
});

// 3 Confirm cannot pass remoteDeletes
test('F2-3 Confirm cannot pass remoteDeletes', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f2' });
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    return SP.confirmUpdate(prep.operationId, {
      userConfirmed: true,
      remoteDeletes: ['SKILL.md']
    });
  });
  assert(r.ok === false && r.code === 'operation_tampered', JSON.stringify(r));
});

// 4 Operation tamper after prepare
test('F2-4 Mutating prepared Operation returns operation_tampered', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f2' });
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    op.fileStrategies['SKILL.md'] = 'keep-local';
    SP.__test.saveState();
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'operation_tampered', JSON.stringify(r));
});

// 5 Update page Prepare/Confirm/Result same Operation ID
test('F2-5 Update UI Prepare/Confirm/Result share one Operation ID', async () => {
  await freshPage(); await resetState();
  const assetId = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f2' }));
    return id;
  });
  await page.goto(BASE + '/update.html?skill=' + encodeURIComponent(assetId) + '&dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.prepareUpdate);
  // force update-available so selection UI shows
  await evalSP(() => SP.loadUpdateDemoCase('update-available'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.prepareUpdate);
  await page.click('#btn-force').catch(() => {});
  // if still no prep button, click force then wait
  if (!(await page.$('#btn-prep'))) {
    if (await page.$('#btn-force')) await page.click('#btn-force');
  }
  await page.waitForSelector('#btn-prep', { timeout: 10000 });
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const prepId = await page.locator('#btn-confirm').getAttribute('data-operation-id');
  assert(prepId && prepId.length > 10, 'missing prepare op id');
  const confirmIds = await page.evaluate(async (expected) => {
    const opId = expected;
    const result = SP.confirmUpdate(opId, { userConfirmed: true });
    return { prepareId: opId, confirmId: result.operationId, status: result.status, same: result.operationId === opId };
  }, prepId);
  assert(confirmIds.same && confirmIds.status === 'completed', JSON.stringify(confirmIds));
  // Full UI path: Prepare → Confirm button → Result shows same ID
  await page.goto(BASE + '/update.html?skill=' + encodeURIComponent(assetId) + '&dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.prepareUpdate);
  await evalSP(() => SP.loadUpdateDemoCase('update-available'));
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await page.$('#btn-prep'))) {
    if (await page.$('#btn-force')) await page.click('#btn-force');
  }
  await page.waitForSelector('#btn-prep', { timeout: 10000 });
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const uiPrepId = await page.locator('#btn-confirm').getAttribute('data-operation-id');
  await page.click('#btn-confirm');
  await page.waitForFunction((id) => document.body.innerText.includes(id), uiPrepId);
  const resultText = await page.locator('body').innerText();
  assert(resultText.includes(uiPrepId), 'result page must show same Operation ID: ' + uiPrepId + ' / ' + resultText.slice(0, 400));
  assert(/与 Diff 页一致\s*true/i.test(resultText.replace(/\s+/g, ' ')) || resultText.includes('与 Diff 页一致') && resultText.includes('true'),
    'result must claim Diff consistency: ' + resultText.slice(0, 500));
});

// 6 Delete then fail → full rollback with original File ID
test('F2-6/9 Delete file then fail fully rolls back File ID', async () => {
  await freshPage(); await resetState();
  const ids = await ensureTwoWritableInstances('pr-review');
  const r = await evalSP(({ id, a, b }) => {
    const delPath = 'references/checklist.md';
    let fileA = SP.__test.getRawState().files.find(f => f.instanceId === a && f.relativePath === delPath);
    if (!fileA) {
      const skill = SP.__test.getRawState().files.find(f => f.instanceId === a && f.relativePath === 'SKILL.md');
      fileA = {
        id: SP.uuid(), instanceId: a, skillId: id, relativePath: delPath,
        fileType: 'text', mimeType: 'text/markdown', content: 'CHECKLIST_ORIG',
        contentHash: SP.$hash('CHECKLIST_ORIG'), modifiedAt: '2020-01-01T00:00:00.000Z',
        sizeBytes: 14, tokenCount: 2, tokenCountMode: 'estimated', indexStatus: 'indexed'
      };
      SP.__test.getRawState().files.push(fileA);
      SP.__test.saveState();
    }
    const origId = fileA.id;
    const origHash = fileA.contentHash;
    const origMod = fileA.modifiedAt;
    const prepHash = SP.getUpdateOperation
      ? null
      : null;
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [a, b],
      selectedRelativePaths: [],
      remoteDeletes: [delPath],
      fileStrategies: { [delPath]: 'use-remote' }
    });
    const expectedPkg = prep.preparedFileStates.find(g => g.instanceId === a).packageHash;
    SP.__test.getRawState().installSim.updateFailInstanceId = b;
    SP.__test.saveState();
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const restored = SP.__test.getRawState().files.find(f => f.instanceId === a && f.relativePath === delPath);
    const filesNow = SP.__test.getRawState().files.filter(f => f.instanceId === a).slice()
      .sort((x, y) => x.relativePath.localeCompare(y.relativePath));
    const pkgNow = SP.$hash(filesNow.map(f => f.relativePath + ':' + (f.contentHash || '')).join('|'));
    return {
      status: done.status,
      restoredId: restored && restored.id,
      origId,
      sameId: restored && restored.id === origId,
      sameHash: restored && restored.contentHash === origHash,
      sameMod: restored && restored.modifiedAt === origMod,
      pkgMatch: pkgNow === expectedPkg,
      entry: (done.results || []).find(x => x.instanceId === a)
    };
  }, ids);
  assert(r.status === 'rolled-back', JSON.stringify(r));
  assert(r.sameId && r.sameHash && r.sameMod && r.pkgMatch, JSON.stringify(r));
});

// 7 Add then fail → added file gone
test('F2-7 Add file then fail removes added file', async () => {
  await freshPage(); await resetState();
  const ids = await ensureTwoWritableInstances('pr-review');
  const r = await evalSP(({ id, a, b }) => {
    const addPath = 'NEW_FROM_REMOTE.md';
    const before = SP.__test.getRawState().files.filter(f => f.instanceId === a).map(f => f.id).sort();
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [a, b],
      selectedRelativePaths: [],
      remoteAdds: [{ relativePath: addPath, content: 'ADDED_BODY' }],
      fileStrategies: { [addPath]: 'use-remote' }
    });
    const expectedPkg = prep.preparedFileStates.find(g => g.instanceId === a).packageHash;
    SP.__test.getRawState().installSim.updateFailInstanceId = b;
    SP.__test.saveState();
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const still = SP.__test.getRawState().files.find(f => f.instanceId === a && f.relativePath === addPath);
    const after = SP.__test.getRawState().files.filter(f => f.instanceId === a).map(f => f.id).sort();
    const filesNow = SP.__test.getRawState().files.filter(f => f.instanceId === a).slice()
      .sort((x, y) => x.relativePath.localeCompare(y.relativePath));
    const pkgNow = SP.$hash(filesNow.map(f => f.relativePath + ':' + (f.contentHash || '')).join('|'));
    const entry = (done.results || []).find(x => x.instanceId === a);
    const removed = (entry && entry.files || []).some(f => f.status === 'removed-added-file' || f.relativePath === addPath);
    return {
      status: done.status,
      still: !!still,
      idsEqual: JSON.stringify(before) === JSON.stringify(after),
      pkgMatch: pkgNow === expectedPkg,
      removedFlag: removed || !still
    };
  }, ids);
  assert(r.status === 'rolled-back' && !r.still && r.idsEqual && r.pkgMatch, JSON.stringify(r));
});

// 8 Rename (delete+add) then fail → only old path
test('F2-8 Rename then fail restores only old path', async () => {
  await freshPage(); await resetState();
  const ids = await ensureTwoWritableInstances('pr-review');
  const r = await evalSP(({ id, a, b }) => {
    const oldPath = 'OLD_NAME.md';
    const newPath = 'NEW_NAME.md';
    const file = {
      id: SP.uuid(), instanceId: a, skillId: id, relativePath: oldPath,
      fileType: 'text', mimeType: 'text/markdown', content: 'OLD_BODY',
      contentHash: SP.$hash('OLD_BODY'), modifiedAt: '2021-01-01T00:00:00.000Z',
      sizeBytes: 8, tokenCount: 1, tokenCountMode: 'estimated', indexStatus: 'indexed'
    };
    SP.__test.getRawState().files.push(file);
    // mirror on b so prepare fingerprint consistent for both
    SP.__test.getRawState().files.push(Object.assign({}, file, { id: SP.uuid(), instanceId: b }));
    SP.__test.saveState();
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [a, b],
      selectedRelativePaths: [],
      remoteDeletes: [oldPath],
      remoteAdds: [{ relativePath: newPath, content: 'NEW_BODY' }],
      fileStrategies: { [oldPath]: 'use-remote', [newPath]: 'use-remote' }
    });
    SP.__test.getRawState().installSim.updateFailInstanceId = b;
    SP.__test.saveState();
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const oldF = SP.__test.getRawState().files.find(f => f.instanceId === a && f.relativePath === oldPath);
    const newF = SP.__test.getRawState().files.find(f => f.instanceId === a && f.relativePath === newPath);
    return {
      status: done.status,
      oldId: oldF && oldF.id,
      origId: file.id,
      hasOld: !!oldF,
      hasNew: !!newF
    };
  }, ids);
  assert(r.status === 'rolled-back' && r.hasOld && !r.hasNew && r.oldId === r.origId, JSON.stringify(r));
});

// 10 Package hash after rollback
test('F2-10 Rollback restores exact Package Hash', async () => {
  await freshPage(); await resetState();
  const ids = await ensureTwoWritableInstances('pr-review');
  const r = await evalSP(({ id, a, b }) => {
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [a, b],
      selectedRelativePaths: ['SKILL.md']
    });
    const expected = prep.preparedFileStates.find(g => g.instanceId === a).packageHash;
    SP.__test.getRawState().installSim.updateFailInstanceId = b;
    SP.__test.saveState();
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const filesNow = SP.__test.getRawState().files.filter(f => f.instanceId === a).slice()
      .sort((x, y) => x.relativePath.localeCompare(y.relativePath));
    const pkgNow = SP.$hash(filesNow.map(f => f.relativePath + ':' + (f.contentHash || '')).join('|'));
    return { status: done.status, expected, pkgNow, match: expected === pkgNow };
  }, ids);
  assert(r.status === 'rolled-back' && r.match, JSON.stringify(r));
});

// 11 Manual merge draft retained after rollback
test('F2-11 Manual Merge Draft retained after formal rollback', async () => {
  await freshPage(); await resetState();
  const ids = await ensureTwoWritableInstances('pr-review');
  const r = await evalSP(({ id, a, b }) => {
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [a, b],
      selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': 'manual-merge' }
    });
    SP.__test.getRawState().installSim.updateFailInstanceId = b;
    SP.__test.saveState();
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const drafts = SP.__test.getRawState().drafts.filter(d =>
      d.instanceId === a && d.sourceOperationId === prep.operationId
    );
    const entry = (done.results || []).find(x => x.instanceId === a);
    const tasks = SP.__test.getRawState().pendingTasks.filter(t =>
      t.instanceId === a && t.taskType === 'update_manual_merge' && t.status === 'open'
    );
    const audits = SP.__test.getRawState().auditEvents.filter(e =>
      e.eventType === 'update_draft_retained_after_rollback'
    );
    return {
      status: done.status,
      draftCount: drafts.length,
      retained: !!(entry && (entry.draftRetainedAfterRollback || entry['draft-retained-after-rollback'])),
      tasks: tasks.length,
      audits: audits.length,
      notApplied: !((entry && entry.files) || []).some(f => f.status === 'completed' && f.strategy === 'manual-merge' && f.applied)
    };
  }, ids);
  assert(r.status === 'rolled-back' && r.draftCount >= 1 && r.retained && r.tasks >= 1 && r.audits >= 1, JSON.stringify(r));
});

// 12 Rebind mid-write fail restores old files/paths
test('F2-12 Rebind mid-fail restores old files and path', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing') || SP.resolveAssetId('pr-review');
    let inst = SP.__test.getRawState().instances.find(i =>
      i.skillId === id && (i.lifecycleStatus === 'missing' || i.lifecycleStatus === 'stopped')
    );
    if (!inst) {
      inst = SP.__test.getRawState().instances.find(i => i.skillId === id);
      inst.lifecycleStatus = 'missing';
      SP.__test.saveState();
    }
    const beforePath = inst.skillFilePath;
    const beforeHost = inst.hostType;
    const beforeFiles = SP.__test.getRawState().files.filter(f => f.instanceId === inst.id).map(f => ({
      id: f.id, relativePath: f.relativePath, contentHash: f.contentHash
    }));
    SP.loadInstallDemoCase('rebind-fail-after-delete');
    const prep = SP.prepareInstall({
      source: 'github:acme/hello-skill',
      hostIds: ['claude'],
      mode: 'rebind',
      existingAssetId: id,
      existingInstanceId: inst.id
    });
    if (!prep.ok) return { step: 'prep', prep };
    const done = SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const after = SP.__test.getRawState().instances.find(i => i.id === inst.id);
    const afterFiles = SP.__test.getRawState().files.filter(f => f.instanceId === inst.id).map(f => ({
      id: f.id, relativePath: f.relativePath, contentHash: f.contentHash
    }));
    return {
      status: done.status,
      life: after.lifecycleStatus,
      path: after.skillFilePath,
      host: after.hostType,
      beforePath,
      beforeHost,
      beforeFiles,
      afterFiles,
      pathSame: after.skillFilePath === beforePath,
      hostSame: after.hostType === beforeHost,
      filesSame: JSON.stringify(beforeFiles.sort((x, y) => x.id.localeCompare(y.id))) ===
        JSON.stringify(afterFiles.sort((x, y) => x.id.localeCompare(y.id)))
    };
  });
  assert(
    (r.status === 'rolled-back' || r.status === 'rollback-failed' || r.status === 'failed') &&
    r.pathSame && r.filesSame && (r.life === 'missing' || r.life === 'stopped'),
    JSON.stringify(r)
  );
});

// 13 supportedHosts host types only
test('F2-13 supportedHosts are canonical Host Types', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const before = SP.__test.getRawState().assets.map(a => a.id);
    const prep = SP.prepareInstall({ source: 'github:acme/hello-skill', hostIds: ['claude', 'codex'], mode: 'new-asset' });
    SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const created = SP.__test.getRawState().assets.find(a => !before.includes(a.id) && a.lifecycleStatus !== 'deleted');
    return { hosts: (created && created.supportedHosts) || [] };
  });
  assert(r.hosts.includes('claude-code') && r.hosts.includes('codex'), JSON.stringify(r));
  assert(!r.hosts.includes('claude'), JSON.stringify(r));
});

// 14–15 Usage aggregation after merge
test('F2-14/15 Usage aggregates to canonical; history keeps original IDs', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    // clear prior usage so assertion is exact 10+20
    SP.__test.getRawState().usageEvents = SP.__test.getRawState().usageEvents.filter(e => e.skillId !== left && e.skillId !== right);
    SP.__test.saveState();
    for (let i = 0; i < 10; i++) {
      SP.addUsageEvent({ skillId: left, callCount: 1, attributionLevel: 'accurate', totalTokens: 1 });
    }
    for (let i = 0; i < 20; i++) {
      SP.addUsageEvent({ skillId: right, callCount: 1, attributionLevel: 'accurate', totalTokens: 1 });
    }
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const summary = SP.getAssetUsageSummary(left);
    const rawRight = SP.__test.getRawState().usageEvents.filter(e => e.skillId === right);
    const lib = SP.getAssets().filter(a => a.lifecycleStatus !== 'deleted' && a.lifecycleStatus !== 'archived').some(a => a.id === right);
    const deleted = SP.__test.getRawState().assets.find(a => a.id === right);
    return {
      calls: summary && summary.calls,
      rightEvents: rawRight.length,
      libShowsRight: lib,
      rightLife: deleted && deleted.lifecycleStatus,
      mergedInto: deleted && deleted.mergedIntoAssetId,
      canonical: SP.resolveCanonicalAssetId(right)
    };
  });
  assert(r.calls === 30, JSON.stringify(r));
  assert(r.rightEvents === 20, JSON.stringify(r));
  assert(!r.libShowsRight && r.rightLife === 'deleted' && r.canonical === r.mergedInto, JSON.stringify(r));
});

// 16 Unconfirmed UpdateOperation invalidated on merge
test('F2-16 Open UpdateOperation invalidated after asset merge', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(left)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f2' });
    const up = SP.prepareUpdate({ assetId: left, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === up.operationId);
    return {
      status: op && op.status,
      reason: op && op.invalidatedReason,
      canonical: op && op.canonicalAssetId
    };
  });
  assert(r.status === 'invalidated' && r.reason === 'asset_merged', JSON.stringify(r));
});

// 17 EditorSession + Conflict migrate to Canonical
test('F2-17 EditorSession and Conflict point to Canonical Asset', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    const inst = SP.getAssetInstances(right)[0];
    const file = SP.__test.getRawState().files.find(f => f.instanceId === inst.id);
    const session = SP.openEditorSession({ assetId: right, instanceId: inst.id });
    if (!session.ok) {
      SP.requestWritePermission({ instanceId: inst.id, purpose: 'f2' });
      // re-open read-only
    }
    const openedSession = session.ok ? session : SP.openEditorSession({ assetId: right, instanceId: inst.id });
    SP.__test.getRawState().conflicts.push({
      id: SP.uuid(),
      assetId: right,
      skillId: right,
      instanceId: inst.id,
      fileId: file && file.id,
      status: 'open',
      createdAt: new Date().toISOString()
    });
    SP.__test.saveState();
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const sessId = openedSession.id || (openedSession.session && openedSession.session.id);
    const sess = SP.__test.getRawState().editorSessions.find(s => s.id === sessId);
    const conf = SP.__test.getRawState().conflicts.find(c => c.instanceId === inst.id);
    return {
      sessOk: openedSession.ok,
      sessAsset: sess && (sess.assetId || sess.skillId),
      confAsset: conf && (conf.assetId || conf.skillId),
      left,
      sameInst: sess && sess.instanceId === inst.id
    };
  });
  assert(r.sessOk && r.sessAsset === r.left && r.confAsset === r.left && r.sameInst, JSON.stringify(r));
});

// 18–19 One official asset binding; secondary → instance divergence
test('F2-18/19 Single official SourceBinding; secondary becomes instance divergence', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    // ensure both have asset-level bindings
    [left, right].forEach(aid => {
      let b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === aid && (!x.scope || x.scope === 'asset'));
      if (!b) {
        b = {
          id: SP.uuid(), skillId: aid, scope: 'asset', sourceType: 'github',
          sourceUrl: 'https://github.com/acme/' + aid, repository: 'acme/' + aid,
          branch: 'main', baselineVersion: '1.0.0', baselineCommit: 'abc',
          trustPolicy: 'untrusted', updateStatus: 'up-to-date', sourceDivergence: false
        };
        SP.__test.getRawState().sourceBindings.push(b);
        SP.__test.getRawState().assets.find(a => a.id === aid).sourceBindingId = b.id;
      } else {
        b.scope = 'asset';
        b.sourceType = 'github';
        b.sourceDivergence = false;
      }
    });
    SP.__test.saveState();
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const assetLevel = SP.__test.getRawState().sourceBindings.filter(b =>
      b.skillId === left && (!b.scope || b.scope === 'asset') && !b.sourceDivergence
    );
    const diverged = SP.__test.getRawState().sourceBindings.filter(b =>
      b.skillId === left && b.scope === 'instance' && b.sourceDivergence
    );
    const asset = SP.__test.getRawState().assets.find(a => a.id === left);
    return {
      assetLevel: assetLevel.length,
      diverged: diverged.length,
      officialId: asset && asset.sourceBindingId,
      officialMatches: assetLevel[0] && asset.sourceBindingId === assetLevel[0].id
    };
  });
  assert(r.assetLevel === 1 && r.diverged >= 1 && r.officialMatches, JSON.stringify(r));
});

// 20 Duplicate Operation stale rejects confirm
test('F2-20 Duplicate Operation stale rejects confirm', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('prompt-lint');
    const right = SP.resolveAssetId('prompt-check');
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'archive',
      archiveAssetId: right,
      candidateIds: [left, right]
    });
    const rawInst = SP.__test.getRawState().instances.find(i => i.skillId === right);
    if (!rawInst) return { ok: true, error: 'no-inst-to-mutate' };
    rawInst.lifecycleStatus = 'stopped';
    // also mutate binding scope to force stale
    const b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === right);
    if (b) b.sourceDivergence = !b.sourceDivergence;
    SP.__test.saveState();
    return SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'operation_stale', JSON.stringify(r));
});

// 21 Merge-new fail leaves no new Asset
test('F2-21 Merge-new fail does not leave new Asset', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    const beforeAssets = SP.__test.getRawState().assets.map(a => a.id).sort();
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'merge-new',
      candidateIds: [left, right],
      name: 'should-not-remain'
    });
    SP.__test.getRawState().installSim.duplicateFailAfterCreate = true;
    SP.__test.saveState();
    const done = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const afterAssets = SP.__test.getRawState().assets.map(a => a.id).sort();
    const leftLife = SP.__test.getRawState().assets.find(a => a.id === left).lifecycleStatus;
    const rightLife = SP.__test.getRawState().assets.find(a => a.id === right).lifecycleStatus;
    const orphan = SP.__test.getRawState().assets.find(a =>
      (a.displayName || '').includes('should-not-remain') || a.name === 'should-not-remain'
    );
    return {
      ok: done.ok,
      status: done.status,
      sameAssets: JSON.stringify(beforeAssets) === JSON.stringify(afterAssets),
      leftLife,
      rightLife,
      orphan: !!orphan
    };
  });
  assert(r.ok === false && r.sameAssets && !r.orphan && r.leftLife !== 'deleted' && r.rightLife !== 'deleted', JSON.stringify(r));
});

// 22 Snapshot real migration assert
test('F2-22 Snapshot migrates to Canonical without dangling refs', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    const inst = SP.getAssetInstances(left)[0];
    const snap = SP.__test.createPackageSnapshotForInstance(inst.id, { note: 'f2', source: 'f2', retained: true });
    SP.__test.getRawState().snapshots.push(snap);
    SP.__test.saveState();
    const beforeCount = SP.__test.getRawState().snapshots.filter(s => s.skillId === left || s.skillId === right).length;
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const onCanonical = SP.__test.getRawState().snapshots.filter(s => s.skillId === left);
    const dangling = SP.__test.getRawState().snapshots.filter(s => {
      const a = SP.__test.getRawState().assets.find(x => x.id === s.skillId);
      return !a || (a.lifecycleStatus === 'deleted' && !a.mergedIntoAssetId);
    });
    // dangling refs across entities
    const badInst = SP.__test.getRawState().instances.filter(i => {
      const a = SP.__test.getRawState().assets.find(x => x.id === i.skillId);
      return !a || (a.lifecycleStatus === 'deleted' && !a.mergedIntoAssetId && i.lifecycleStatus === 'available');
    });
    return {
      beforeCount,
      onCanonical: onCanonical.length,
      dangling: dangling.length,
      badInst: badInst.length,
      snapMoved: onCanonical.some(s => s.id === snap.id)
    };
  });
  assert(r.beforeCount >= 1 && r.onCanonical >= 1 && r.dangling === 0 && r.badInst === 0 && r.snapMoved, JSON.stringify(r));
});

// 23 Uninstall rollback writes audit events
test('F2-23 Uninstall rollback appends rollback AuditEvent', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    let insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    if (insts.length < 2) {
      const prepI = SP.prepareInstall({
        source: 'local-directory:~/Skills/local-demo', hostIds: ['custom'],
        mode: 'add-instance', existingAssetId: id
      });
      SP.confirmInstall(prepI.operationId, { userConfirmed: true });
      insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    }
    const a = insts[0];
    const b = insts[1];
    const prep = SP.prepareUninstall({
      assetId: id, mode: 'stop-managing', instanceIds: [a.id, b.id]
    });
    SP.__test.getRawState().installSim.uninstallFailInstanceId = b.id;
    SP.__test.saveState();
    const beforeAudits = SP.__test.getRawState().auditEvents.length;
    const done = SP.confirmUninstall(prep.operationId, { userConfirmed: true });
    const audits = SP.__test.getRawState().auditEvents.slice(beforeAudits);
    const completed = audits.filter(e => e.eventType === 'uninstall_instance');
    const rb = audits.filter(e => e.eventType === 'uninstall_rollback_completed');
    return {
      status: done.status,
      completed: completed.length,
      rollback: rb.length,
      snapRef: rb.every(e => !!e.snapshotId)
    };
  });
  assert(r.status === 'rolled-back' && r.completed >= 1 && r.rollback >= 1 && r.snapRef, JSON.stringify(r));
});

// 24 Uninstall rollback-failed
test('F2-24 Uninstall rollback-failed returns rollback-failed', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    let insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    if (insts.length < 2) {
      const prepI = SP.prepareInstall({
        source: 'local-directory:~/Skills/local-demo', hostIds: ['custom'],
        mode: 'add-instance', existingAssetId: id
      });
      SP.confirmInstall(prepI.operationId, { userConfirmed: true });
      insts = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    }
    const a = insts[0];
    const b = insts[1];
    const prep = SP.prepareUninstall({
      assetId: id, mode: 'stop-managing', instanceIds: [a.id, b.id]
    });
    SP.__test.getRawState().installSim.uninstallFailInstanceId = b.id;
    SP.__test.getRawState().installSim.uninstallRollbackFailInstanceId = a.id;
    SP.__test.saveState();
    const done = SP.confirmUninstall(prep.operationId, { userConfirmed: true });
    const audits = SP.__test.getRawState().auditEvents.filter(e => e.eventType === 'uninstall_rollback_failed');
    return { status: done.status, audits: audits.length };
  });
  assert(r.status === 'rollback-failed' && r.audits >= 1, JSON.stringify(r));
});

// Static: update-app single operation flow
test('F2-static update-app same-operation confirm only userConfirmed', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'update-app.js'), 'utf8');
  assert(/confirmUpdate\([^,]+,\s*\{\s*userConfirmed:\s*true\s*\}/.test(src), 'confirm must only pass userConfirmed');
  assert(!/confirmUpdate\([\s\S]{0,200}fileStrategies/.test(src), 'UI must not pass fileStrategies to confirm');
  assert(/btn-modify/.test(src) && /cancelUpdateOperation/.test(src), 'modify selection must cancel operation');
  const confirmBlock = src.split('btn-confirm')[1] || '';
  assert(!/prepareUpdate/.test(confirmBlock.slice(0, 600)), 'confirm must not prepareUpdate');
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let passed = 0, failed = 0;
  console.log('=== Phase F.2 Targeted Tests ===\n');
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
