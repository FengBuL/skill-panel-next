/**
 * Phase E.1 targeted tests — ApplyOperation / ForceApplyOperation / Baseline / Raw API
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
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('sp-dev', '1');
  });
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.__test && SP.openEditorSession);
  await page.evaluate(() => SP.resetState());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.__test && SP.openEditorSession);
}
async function evalSP(fn, ...args) { return page.evaluate(fn, ...args); }

async function openEditablePrReview() {
  return evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    return { id, instId: inst.id, sessionId: s.id, skillId: skill.id, baseSnapshotId: s.baseSnapshotId };
  });
}

test('E1-1 Prepare→mutate Formal→Confirm enters Conflict; Formal ≠ Draft', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const draftText = '---\nname: pr-review\nversion: 9.9.9\n---\n\nDRAFT_E1\n';
    SP.saveEditorDraft(s.id, skill.id, draftText);
    const prep = SP.prepareApplyChanges(s.id);
    if (!prep.ok) return { step: 'prep', prep };
    SP.__test.patchRawState(state => {
      const f = state.files.find(x => x.id === skill.id);
      f.content = String(f.content || '') + '\nEXTERNAL_AFTER_PREP\n';
      f.contentHash = SP.$hash(f.content);
      f.modifiedAt = SP.$now();
      f.sizeBytes = f.content.length;
    });
    const conf = SP.confirmApplyChanges(prep.operationId, { userConfirmed: true });
    const formal = SP.__test.getRawState().files.find(f => f.id === skill.id).content;
    return {
      prepOk: prep.ok,
      operationId: prep.operationId,
      conf,
      formalHasDraft: formal.includes('DRAFT_E1'),
      formalHasExternal: formal.includes('EXTERNAL_AFTER_PREP'),
      draftKept: !!(SP.getEditorDraft(s.id, skill.id))
    };
  });
  assert(r.prepOk && r.operationId, JSON.stringify(r));
  assert(r.conf && r.conf.ok === false && r.conf.code === 'conflict' && r.conf.conflictId, JSON.stringify(r));
  assert(!r.formalHasDraft && r.formalHasExternal && r.draftKept, JSON.stringify(r));
});

test('E1-2 Confirm rejects arbitrary Snapshot ID / sessionId as credential', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nx\n');
    const prep = SP.prepareApplyChanges(s.id);
    const bad1 = SP.confirmApplyChanges(s.id, { userConfirmed: true, snapshotId: prep.snapshotId });
    const bad2 = SP.confirmApplyChanges('snap-forged-id', { userConfirmed: true });
    const bad3 = SP.confirmApplyChanges(prep.snapshotId, { userConfirmed: true });
    return { prepOk: prep.ok, bad1, bad2, bad3 };
  });
  assert(r.prepOk, JSON.stringify(r));
  assert(r.bad1.ok === false && r.bad2.ok === false && r.bad3.ok === false, JSON.stringify(r));
});

test('E1-3 Snapshot must belong to current Asset/Instance (source pre-apply)', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.1\n---\n\nx\n');
    const prep = SP.prepareApplyChanges(s.id);
    const op = SP.__test.getRawState().applyOperations.find(o => o.id === prep.operationId);
    const other = SP.createPackageSnapshot({ assetId: id, instanceId: inst.id, source: 'manual', note: 'forged' });
    op.snapshotId = other.snapshotId;
    SP.__test.saveState();
    const conf = SP.confirmApplyChanges(prep.operationId, { userConfirmed: true });
    return { code: conf.code, source: (SP.__test.getRawState().snapshots.find(x => x.id === other.snapshotId) || {}).source };
  });
  assert(r.code === 'snapshot_source' || r.code === 'snapshot_mismatch' || r.code === 'snapshot_invalid', JSON.stringify(r));
});

test('E1-4 Used ApplyOperation cannot be confirmed twice', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.5.0\n---\n\n# once\n');
    const prep = SP.prepareApplyChanges(s.id);
    const first = SP.confirmApplyChanges(prep.operationId, { userConfirmed: true });
    const second = SP.confirmApplyChanges(prep.operationId, { userConfirmed: true });
    return { first: first.status, second };
  });
  assert(r.first === 'completed', JSON.stringify(r));
  assert(r.second.ok === false, JSON.stringify(r));
});

test('E1-5 Expired ApplyOperation cannot confirm', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.5.1\n---\n\n# exp\n');
    const prep = SP.prepareApplyChanges(s.id);
    const op = SP.__test.getRawState().applyOperations.find(o => o.id === prep.operationId);
    op.expiresAt = new Date(Date.now() - 1000).toISOString();
    SP.__test.saveState();
    const conf = SP.confirmApplyChanges(prep.operationId, { userConfirmed: true });
    return conf;
  });
  assert(r.ok === false && r.code === 'operation_expired', JSON.stringify(r));
});

test('E1-6 Snapshot create failure blocks apply', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.5.2\n---\n\n# snapfail\n');
    const session = SP.__test.getRawState().editorSessions.find(x => x.id === s.id);
    const realAsset = session.assetId;
    session.assetId = 'forged-asset-mismatch';
    SP.__test.saveState();
    const prep = SP.prepareApplyChanges(s.id);
    session.assetId = realAsset;
    SP.__test.saveState();
    return { ok: prep.ok, code: prep.code, operationId: prep.operationId };
  });
  assert(r.ok === false && r.code === 'snapshot_failed' && !r.operationId, JSON.stringify(r));
});

test('E1-7 Three-way Diff Base equals Session open content', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const openContent = SP.__test.getRawState().files.find(f => f.id === skill.id).content;
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nDRAFT_SIDE\n');
    SP.__test.patchRawState(state => {
      const f = state.files.find(x => x.id === skill.id);
      f.content = String(f.content || '') + '\nCURRENT_SIDE\n';
      f.contentHash = SP.$hash(f.content);
      f.modifiedAt = SP.$now();
    });
    const changes = [{ fileId: skill.id, relativePath: 'SKILL.md', kind: 'content-changed' }];
    const opened = SP.__test.getRawState(); // ensure session has baseSnapshotId
    const pub = SP.getEditorSession(s.id);
    const conflictOpen = (function () {
      // use internal path via prepare after detect
      return null;
    })();
    // Open conflict via API path
    const det = { ok: true };
    // Direct conflict open through detectExternalChanges comparison
    const cOpen = (function open() {
      const session = SP.__test.getRawState().editorSessions.find(x => x.id === s.id);
      // call detect which compares to base — already changed
      return SP.detectExternalChanges(s.id, { mutateSim: false });
    })();
    const openedC = (function () {
      // use prepareApply which opens conflict
      return SP.prepareApplyChanges(s.id);
    })();
    const detail = SP.getConflictFileDetail(openedC.conflictId, skill.id);
    return {
      baseSnapshotId: pub.baseSnapshotId,
      base: detail && detail.baseContent,
      current: detail && detail.currentContent,
      draft: detail && detail.draftContent,
      openContent,
      baseMatchesOpen: detail && detail.baseContent === openContent,
      allDifferent: detail && detail.baseContent !== detail.currentContent && detail.currentContent !== detail.draftContent && detail.baseContent !== detail.draftContent
    };
  });
  assert(r.baseSnapshotId, JSON.stringify(r));
  assert(r.baseMatchesOpen, JSON.stringify(r));
  assert(r.allDifferent, JSON.stringify(r));
});

test('E1-8 External change before Prepare keeps Base correct', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const openContent = SP.__test.getRawState().files.find(f => f.id === skill.id).content;
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nDRAFT_B\n');
    // change before prepare
    SP.__test.patchRawState(state => {
      const f = state.files.find(x => x.id === skill.id);
      f.content = String(f.content || '') + '\nBEFORE_PREP\n';
      f.contentHash = SP.$hash(f.content);
      f.modifiedAt = SP.$now();
    });
    const prep = SP.prepareApplyChanges(s.id);
    const detail = SP.getConflictFileDetail(prep.conflictId, skill.id);
    return {
      code: prep.code,
      baseMatchesOpen: detail && detail.baseContent === openContent,
      currentHas: detail && detail.currentContent.includes('BEFORE_PREP')
    };
  });
  assert(r.code === 'conflict' && r.baseMatchesOpen && r.currentHas, JSON.stringify(r));
});

test('E1-9 Cannot Force Confirm without Prepare', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => SP.confirmForceOverwrite('no-such-force-op', { userConfirmed: true, secondConfirmed: true }));
  assert(r.ok === false && r.code === 'operation_not_found', JSON.stringify(r));
});

test('E1-10 Force Confirm rejects arbitrary Snapshot ID', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nF\n');
    SP.loadEditorDemoCase('external-content');
    const prep = SP.prepareApplyChanges(s.id);
    SP.markConflictDiffViewed(prep.conflictId, { userAcknowledged: true });
    const forcePrep = SP.prepareForceOverwrite(prep.conflictId);
    const bad = SP.confirmForceOverwrite(forcePrep.snapshotId, { userConfirmed: true, secondConfirmed: true });
    return { forceOk: forcePrep.ok, bad };
  });
  assert(r.forceOk && r.bad.ok === false, JSON.stringify(r));
});

test('E1-11 Force prepare then Formal change invalidates Operation', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nFORCE\n');
    SP.loadEditorDemoCase('external-content');
    const prep = SP.prepareApplyChanges(s.id);
    SP.markConflictDiffViewed(prep.conflictId, { userAcknowledged: true });
    const forcePrep = SP.prepareForceOverwrite(prep.conflictId);
    SP.__test.patchRawState(state => {
      const f = state.files.find(x => x.id === skill.id);
      f.content = String(f.content || '') + '\nAGAIN\n';
      f.contentHash = SP.$hash(f.content);
      f.modifiedAt = SP.$now();
      f.sizeBytes = f.content.length;
    });
    const conf = SP.confirmForceOverwrite(forcePrep.forceOperationId, { userConfirmed: true, secondConfirmed: true });
    return conf;
  });
  assert(r.ok === false && r.code === 'stale', JSON.stringify(r));
});

test('E1-12 Cannot Prepare Force without Diff viewed ack', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nF\n');
    SP.loadEditorDemoCase('external-content');
    const prep = SP.prepareApplyChanges(s.id);
    const no = SP.prepareForceOverwrite(prep.conflictId);
    return no;
  });
  assert(r.ok === false && r.code === 'diff_required', JSON.stringify(r));
});

test('E1-13 Opening Conflict page / force modal does not auto-satisfy Diff gate', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nF\n');
    SP.loadEditorDemoCase('external-content');
    const prep = SP.prepareApplyChanges(s.id);
    // Simulate page load: getConflict + getConflictFileDetail without mark
    SP.getConflict(prep.conflictId);
    SP.getConflictFileDetail(prep.conflictId, skill.id);
    const noAck = SP.markConflictDiffViewed(prep.conflictId);
    const still = SP.prepareForceOverwrite(prep.conflictId);
    return { noAckOk: noAck.ok, stillCode: still.code, conflict: SP.getConflict(prep.conflictId) };
  });
  assert(r.noAckOk === false && r.stillCode === 'diff_required' && !r.conflict.diffViewed, JSON.stringify(r));
});

test('E1-14 Permission revoked can still discard Draft', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nKEEP_OR_DROP\n');
    SP.__test.getRawState().permissionGrants.filter(g => g.scopeId === inst.id).forEach(g => { g.writeAccess = false; });
    SP.__test.saveState();
    const restored = SP.restoreEditorSession(s.id);
    const draft = SP.getEditorDraft(s.id, skill.id);
    const discarded = SP.discardEditorDraft(s.id, skill.id);
    const applyBlocked = SP.prepareApplyChanges(s.id);
    return {
      mode: restored.session && restored.session.mode,
      draftWas: !!(draft && draft.content.includes('KEEP_OR_DROP')),
      discarded,
      applyBlocked: applyBlocked.code
    };
  });
  assert(r.draftWas && r.discarded.ok && r.applyBlocked, JSON.stringify(r));
});

test('E1-15 Conflict Discard failure does not return success', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nD\n');
    SP.loadEditorDemoCase('external-content');
    const prep = SP.prepareApplyChanges(s.id);
    // Fail discard by using wrong fileId
    const bad = SP.resolveConflictDiscard(prep.conflictId, 'no-file');
    const c = SP.getConflict(prep.conflictId);
    return { bad, status: c.status };
  });
  assert(r.bad.ok === false && r.status === 'open', JSON.stringify(r));
});

test('E1-16 Source-bound apply sets localModificationStatus=modified', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    const binding = SP.getAssetSourceBinding(id);
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 2.0.0\n---\n\n# mod\n');
    const prep = SP.prepareApplyChanges(s.id);
    const done = SP.confirmApplyChanges(prep.operationId, { userConfirmed: true });
    const after = SP.__test.getRawState().instances.find(i => i.id === inst.id);
    return { hasBinding: !!binding, status: done.status, local: after.localModificationStatus };
  });
  assert(r.hasBinding && r.status === 'completed' && r.local === 'modified', JSON.stringify(r));
});

test('E1-17 Force success clears unfinished Draft display', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nFORCE_OK\n');
    SP.loadEditorDemoCase('external-content');
    const prep = SP.prepareApplyChanges(s.id);
    SP.markConflictDiffViewed(prep.conflictId, { userAcknowledged: true });
    const forcePrep = SP.prepareForceOverwrite(prep.conflictId);
    const done = SP.confirmForceOverwrite(forcePrep.forceOperationId, { userConfirmed: true, secondConfirmed: true });
    const drafts = SP.getDraftSummaries(id).filter(d => d.sessionId === s.id && d.status !== 'applied');
    const unfinished = SP.getUnfinishedDrafts().filter(t => t.skillId === id);
    return { done, draftsLen: drafts.length, unfinished: unfinished.length, formal: SP.__test.getRawState().files.find(f => f.id === skill.id).content.includes('FORCE_OK') };
  });
  assert(r.done.ok && r.done.status === 'completed' && r.formal && r.draftsLen === 0, JSON.stringify(r));
});

test('E1-18 Force partial failure is not completed', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    SP.loadEditorDemoCase('apply-partial-fail');
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e1' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const check = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'references/checklist.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nA\n');
    SP.saveEditorDraft(s.id, check.id, '# B\n');
    SP.__test.patchRawState(state => {
      const f = state.files.find(x => x.id === skill.id);
      f.content = String(f.content || '') + '\nEXT\n';
      f.contentHash = SP.$hash(f.content);
      f.modifiedAt = SP.$now();
    });
    // Open multi-file conflict manually
    const det = SP.detectExternalChanges(s.id, { mutateSim: false });
    // force both drafts into conflict via prepare
    const prep = SP.prepareApplyChanges(s.id);
    if (!prep.conflictId) return { step: 'prep', prep, det };
    // Ensure conflict has both files with draft
    const c = SP.__test.getRawState().conflicts.find(x => x.id === prep.conflictId);
    // inject checklist into conflict files if missing
    if (c && !c.files.some(f => f.fileId === check.id)) {
      c.files.push({
        fileId: check.id, relativePath: 'references/checklist.md', kind: 'content-changed',
        baseContent: '# checklist\n', currentContent: '# checklist\n', draftContent: '# B\n',
        baseHash: 'x', currentHash: 'y', deleted: false
      });
    }
    SP.__test.saveState();
    SP.markConflictDiffViewed(prep.conflictId, { userAcknowledged: true });
    const forcePrep = SP.prepareForceOverwrite(prep.conflictId);
    const done = SP.confirmForceOverwrite(forcePrep.forceOperationId, { userConfirmed: true, secondConfirmed: true });
    return { status: done.status, ok: done.ok, results: done.results };
  });
  assert(r.status !== 'completed', JSON.stringify(r));
  assert(r.ok === false, JSON.stringify(r));
});

test('E1-19 Ordinary page without ?dev=1 has no SP.__test', async () => {
  await freshPage();
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.setItem('sp-dev', '1'); });
  assert(await page.evaluate(() => !!SP.__test), 'expected __test with ?dev=1');
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  const has = await page.evaluate(() => !!window.SP && !!SP.__test);
  assert(!has, 'SP.__test leaked without ?dev=1');
});

test('E1-20 Raw getters not on Public API', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => ({
    asset: typeof SP.getAssetRaw,
    inst: typeof SP.getInstanceRaw,
    host: typeof SP.getHostRaw,
    save: typeof SP.saveState,
    ignore: typeof SP.ignoreSkill,
    unignore: typeof SP.unignoreSkill
  }));
  assert(r.asset === 'undefined' && r.inst === 'undefined' && r.host === 'undefined', JSON.stringify(r));
  assert(r.save === 'undefined' && r.ignore === 'undefined' && r.unignore === 'undefined', JSON.stringify(r));
});

test('E1-21 Return to Detail restores Tab and Instance (view state copy-safe)', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.setDetailViewState({ assetId: id, tab: 'files', instanceId: SP.getAssetInstances(id)[0].id });
    const before = SP.getDetailViewState();
    const copy = SP.getDetailViewState();
    copy.tab = 'hacked';
    const after = SP.getDetailViewState();
    return { beforeTab: before.tab, afterTab: after.tab, instanceId: after.instanceId };
  });
  assert(r.beforeTab === 'files' && r.afterTab === 'files' && r.instanceId, JSON.stringify(r));
});

test('E1-22 Conflict page does not use Raw State', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'conflict-app.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'conflict.html'), 'utf8');
  assert(!/getAssetRaw|getInstanceRaw|getHostRaw|getState\(\)\.files/.test(src), 'conflict uses raw');
  assert(!/\b__test\b/.test(src), 'conflict uses __test');
});

test('E1-23 Editor/Conflict HTML do not duplicate shared.css public selectors', async () => {
  const ed = fs.readFileSync(path.join(ROOT, 'skill-editor.html'), 'utf8');
  const cf = fs.readFileSync(path.join(ROOT, 'conflict.html'), 'utf8');
  // Should link shared.css and not redefine .btn / .toast globally in a conflicting way beyond page-local
  assert(/shared\.css/.test(ed) && /shared\.css/.test(cf), 'missing shared.css');
  assert(!/\.btn\s*\{[^}]*border-radius:\s*999/.test(ed + cf), 'duplicate pillish btn');
});

test('E1-24 Cases no longer ignore whole Skill', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'cases.html'), 'utf8');
  assert(!/已忽略 Skill/.test(src), 'ignored skill lifecycle case remains');
  assert(!/忽略整个 Skill/.test(src) || /不可忽略整个 Skill/.test(src), 'ignore whole skill still promoted');
  assert(!/\bignoreskill\b/i.test(src), 'cases still calls ignoreSkill');
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext();
  let passed = 0, failed = 0;
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
