/**
 * Phase F.3 targeted tests — Remote content integrity, strategy semantics,
 * Canonical Usage wiring, Duplicate active Operation restore.
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

async function prepUpdateSkillMd(strategy) {
  return evalSP((strat) => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [inst.id],
      selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': strat || 'use-remote' }
    });
    return { id, instId: inst.id, prep };
  }, strategy);
}

// 1 Tamper _remoteContents SKILL.md
test('F3-1 Tampered remote SKILL.md body fails Confirm', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    op._remoteContents['SKILL.md'] = String(op._remoteContents['SKILL.md'] || '') + '\nTAMPERED';
    SP.__test.saveState();
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'operation_tampered', JSON.stringify(r));
});

// 2 Tamper remote add body
test('F3-2 Tampered remote-add body fails Confirm', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const prep = SP.prepareUpdate({
      assetId: id,
      instanceIds: [inst.id],
      selectedRelativePaths: [],
      remoteAdds: [{ relativePath: 'NEW_REMOTE.md', content: 'ORIGINAL_ADD' }],
      fileStrategies: { 'NEW_REMOTE.md': 'use-remote' }
    });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    op._remoteContents['NEW_REMOTE.md'] = 'TAMPERED_ADD';
    SP.__test.saveState();
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'operation_tampered', JSON.stringify(r));
});

// 3 Tamper remote candidate size metadata (must fail — either hash or size check)
test('F3-3 Tampered remote size fails Confirm', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const prep = SP.prepareUpdate({ assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    const st = (op.remoteContentStates || []).find(s => s.relativePath === 'SKILL.md');
    if (!st) return { ok: true, error: 'no-state' };
    // Keep confirmationHash fields inconsistent via size while also adjusting body length mismatch path:
    // mutate sizeBytes only → confirmationHash mismatch OR if hash rebuilt from states, tamper body length without hash update
    st.sizeBytes = (st.sizeBytes || 0) + 99;
    SP.__test.saveState();
    return SP.confirmUpdate(prep.operationId, { userConfirmed: true });
  });
  assert(r.ok === false && r.code === 'operation_tampered', JSON.stringify(r));
});

// 4 Untouched op confirms
test('F3-4 Untouched Operation still confirms', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': 'use-remote' }
    });
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const raw = SP.__test.getRawState().instances.find(i => i.id === inst.id);
    return { done, local: raw && raw.localModificationStatus };
  });
  assert(r.done.ok && r.done.status === 'completed', JSON.stringify(r.done));
  assert(r.local === 'clean', JSON.stringify(r));
});

// 5–6 Keep Local → modified + remote baseline
test('F3-5/6 Keep Local → modified; Baseline is Remote body', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const localBefore = SP.__test.getRawState().files.find(f => f.instanceId === inst.id && f.relativePath === 'SKILL.md');
    const localContent = String(localBefore.content || '');
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': 'keep-local' }
    });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    const remoteBody = String(op._remoteContents['SKILL.md'] || '');
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const localAfter = SP.__test.getRawState().files.find(f => f.instanceId === inst.id && f.relativePath === 'SKILL.md');
    const binding = SP.__test.getRawState().sourceBindings.find(b => b.id === op.source.bindingId);
    const baseSnap = SP.__test.getRawState().snapshots.find(s => s.id === binding.baselineSnapshotId);
    const baseFile = baseSnap && (baseSnap.files || []).find(f => f.relativePath === 'SKILL.md');
    const rawInst = SP.__test.getRawState().instances.find(i => i.id === inst.id);
    const fileResult = ((done.results || [])[0] || {}).files || [];
    return {
      status: done.status,
      hasLocal: !!done.hasLocalModifications,
      kept: fileResult.some(f => f.status === 'kept-local'),
      localStatus: rawInst && rawInst.localModificationStatus,
      localUnchanged: String(localAfter.content || '') === localContent,
      baselineRemote: baseFile && String(baseFile.content || '') === remoteBody,
      baselineNotLocal: baseFile && String(baseFile.content || '') !== localContent,
      baselineSource: baseSnap && baseSnap.source,
      bindingStatus: binding && binding.updateStatus
    };
  });
  assert(r.status === 'completed' && r.hasLocal && r.kept, JSON.stringify(r));
  assert(r.localStatus === 'modified' && r.localUnchanged, JSON.stringify(r));
  assert(r.baselineRemote && r.baselineNotLocal && r.baselineSource === 'remote-baseline', JSON.stringify(r));
  assert(r.bindingStatus === 'local-modified', JSON.stringify(r));
});

// 7–8 Manual Merge semantics
test('F3-7/8 Manual Merge not completed; binding not up-to-date; PendingTask', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': 'manual-merge' }
    });
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const binding = SP.__test.getRawState().sourceBindings.find(b =>
      b.skillId === id || b.id === (SP.__test.getRawState().assets.find(a => a.id === id) || {}).sourceBindingId
    );
    const tasks = SP.__test.getRawState().pendingTasks.filter(t =>
      t.taskType === 'update_manual_merge' && t.status === 'open' && t.instanceId === inst.id
    );
    const drafts = SP.__test.getRawState().drafts.filter(d =>
      d.sourceOperationId === prep.operationId && d.status === 'update-manual-merge'
    );
    const formal = SP.__test.getRawState().files.find(f => f.instanceId === inst.id && f.relativePath === 'SKILL.md');
    const rawInst = SP.__test.getRawState().instances.find(i => i.id === inst.id);
    return {
      status: done.status,
      unresolved: done.unresolvedMergeCount,
      bindingStatus: binding && binding.updateStatus,
      tasks: tasks.length,
      drafts: drafts.length,
      formalHash: formal && formal.contentHash,
      localStatus: rawInst && rawInst.localModificationStatus
    };
  });
  assert(r.status === 'awaiting-merge' || r.status === 'partially-completed', JSON.stringify(r));
  assert(r.status !== 'completed', JSON.stringify(r));
  assert(r.bindingStatus === 'merge-required' || r.bindingStatus === 'local-conflict', JSON.stringify(r));
  assert(r.bindingStatus !== 'up-to-date', JSON.stringify(r));
  assert(r.tasks >= 1 && r.drafts >= 1, JSON.stringify(r));
  assert(r.localStatus === 'pending-merge' || r.localStatus === 'conflict', JSON.stringify(r));
});

// 9 Use Remote → clean
test('F3-9 Use Remote all success → Instance clean', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(id)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const prep = SP.prepareUpdate({
      assetId: id, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'],
      fileStrategies: { 'SKILL.md': 'use-remote' }
    });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === prep.operationId);
    const remoteHash = SP.$hash(String(op._remoteContents['SKILL.md'] || ''));
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const rawInst = SP.__test.getRawState().instances.find(i => i.id === inst.id);
    const file = SP.__test.getRawState().files.find(f => f.instanceId === inst.id && f.relativePath === 'SKILL.md');
    return {
      status: done.status,
      local: rawInst && rawInst.localModificationStatus,
      fileHash: file && file.contentHash,
      remoteHash,
      hasLocal: !!done.hasLocalModifications
    };
  });
  assert(r.status === 'completed' && r.local === 'clean' && !r.hasLocal, JSON.stringify(r));
  assert(r.fileHash === r.remoteHash, JSON.stringify(r));
});

// 10–12 Canonical Usage in summary / library / deriveV2Skill
test('F3-10/11/12 Canonical Usage in summary, library, deriveV2Skill', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    SP.__test.getRawState().usageEvents = SP.__test.getRawState().usageEvents.filter(e =>
      e.skillId !== left && e.skillId !== right
    );
    SP.__test.saveState();
    for (let i = 0; i < 10; i++) SP.addUsageEvent({ skillId: left, callCount: 1, attributionLevel: 'accurate', totalTokens: 1 });
    for (let i = 0; i < 20; i++) SP.addUsageEvent({ skillId: right, callCount: 1, attributionLevel: 'accurate', totalTokens: 1 });
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const summary = SP.getAssetUsageSummary(left);
    const assetSummary = SP.getAssetSummary(left);
    const lib = SP.queryLibraryAssets({ pageSize: 200, sort: 'usage' });
    const row = (lib.items || []).find(x => x.id === left);
    const v2 = SP.getSkill(left);
    const events = SP.getCanonicalUsageEvents(left);
    return {
      calls: summary && summary.calls,
      summary30: assetSummary && assetSummary.usage30,
      lib30: row && row.usage30,
      v230: v2 && v2.usage30,
      eventCount: events.length,
      sortFirstIsA: lib.items[0] && lib.items[0].id === left
    };
  });
  assert(r.calls === 30 && r.summary30 === 30 && r.lib30 === 30 && r.v230 === 30, JSON.stringify(r));
  assert(r.eventCount === 30, JSON.stringify(r));
});

// 13 Merge fail restores prepared UpdateOperation
test('F3-13 Merge fail restores prepared UpdateOperation', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    SP.loadUpdateDemoCase('update-available');
    const inst = SP.getAssetInstances(left)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const up = SP.prepareUpdate({ assetId: left, instanceIds: [inst.id], selectedRelativePaths: ['SKILL.md'] });
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'merge-new',
      candidateIds: [left, right],
      name: 'f3-fail-merge'
    });
    SP.__test.getRawState().installSim.duplicateFailAfterCreate = true;
    SP.__test.saveState();
    const done = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === up.operationId);
    return {
      mergeOk: done.ok,
      status: op && op.status,
      reason: op && op.invalidatedReason,
      leftLife: SP.__test.getRawState().assets.find(a => a.id === left).lifecycleStatus
    };
  });
  assert(r.mergeOk === false && r.status === 'prepared' && !r.reason, JSON.stringify(r));
  assert(r.leftLife !== 'deleted', JSON.stringify(r));
});

// 14 Merge fail restores prepared ApplyOperation
test('F3-14 Merge fail restores prepared ApplyOperation', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    const inst = SP.getAssetInstances(left)[0];
    const applyOpId = SP.uuid();
    SP.__test.getRawState().applyOperations = SP.__test.getRawState().applyOperations || [];
    SP.__test.getRawState().applyOperations.push({
      id: applyOpId,
      assetId: left,
      skillId: left,
      instanceId: inst.id,
      status: 'prepared',
      preparedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });
    SP.__test.saveState();
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'merge-new',
      candidateIds: [left, right],
      name: 'f3-fail-apply'
    });
    // ensure checkpoint captured the apply op
    const cp = SP.__test.getRawState().duplicateResolutionOperations.find(o => o.id === prep.operationId);
    const captured = ((cp && cp._entityCheckpoint && cp._entityCheckpoint.activeOperations) || [])
      .some(a => a.id === applyOpId && a.collection === 'applyOperations');
    SP.__test.getRawState().installSim.duplicateFailAfterCreate = true;
    SP.__test.saveState();
    const done = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const op = SP.__test.getRawState().applyOperations.find(o => o.id === applyOpId);
    return {
      captured,
      mergeOk: done.ok,
      status: op && op.status,
      reason: op && op.invalidatedReason
    };
  });
  assert(r.captured, 'apply op must be in activeOperations checkpoint: ' + JSON.stringify(r));
  assert(r.mergeOk === false && r.status === 'prepared' && !r.reason, JSON.stringify(r));
});

// 15 Merge fail restores EditorSession / Conflict
test('F3-15 Merge fail restores EditorSession and Conflict', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    const inst = SP.getAssetInstances(left)[0];
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f3' });
    const session = SP.openEditorSession({ assetId: left, instanceId: inst.id, mode: 'read-only' });
    const sessId = session.id;
    const confId = SP.uuid();
    SP.__test.getRawState().conflicts.push({
      id: confId, assetId: left, skillId: left, instanceId: inst.id,
      status: 'open', createdAt: new Date().toISOString()
    });
    SP.__test.saveState();
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'merge-new',
      candidateIds: [left, right],
      name: 'f3-fail-session'
    });
    SP.__test.getRawState().installSim.duplicateFailAfterCreate = true;
    SP.__test.saveState();
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const sess = SP.__test.getRawState().editorSessions.find(s => s.id === sessId);
    const conf = SP.__test.getRawState().conflicts.find(c => c.id === confId);
    return {
      sessAsset: sess && (sess.assetId || sess.skillId),
      confAsset: conf && (conf.assetId || conf.skillId),
      left,
      sessOk: !!sess,
      confOk: !!conf
    };
  });
  assert(r.sessOk && r.confOk && r.sessAsset === r.left && r.confAsset === r.left, JSON.stringify(r));
});

// Static: update-app present and same-operation
test('F3-static update-app.js present with immutable confirm', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'update-app.js'), 'utf8');
  assert(/confirmUpdate\([^,]+,\s*\{\s*userConfirmed:\s*true\s*\}/.test(src), 'confirm only userConfirmed');
  assert(/lockedOperationId/.test(src), 'locked operation id');
  assert(/awaiting-merge|hasLocalModifications|本地修改/.test(src), 'F.3 result semantics in UI');
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let passed = 0, failed = 0;
  console.log('=== Phase F.3 Targeted Tests ===\n');
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
