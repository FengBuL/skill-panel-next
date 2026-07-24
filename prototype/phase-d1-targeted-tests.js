/**
 * Phase D.1 targeted tests — permission, package snapshot, relink safety
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
  await page.waitForFunction(() => window.SP && SP.getAssetDetail);
  await page.evaluate(() => SP.resetState());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getAssetDetail);
}

async function evalSP(fn, ...args) {
  return page.evaluate(fn, ...args);
}

test('1 readAccess is not unconditionally true', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const denied = SP.getAssetInstances(SP.resolveAssetId('demo-permission-denied'))[0];
    const perm = SP.getInstancePermission(denied.id);
    const normal = SP.getAssetInstances(SP.resolveAssetId('pr-review')).find(i => i.hostType === 'claude-code');
    const nperm = SP.getInstancePermission(normal.id);
    return {
      deniedRead: perm.readAccess,
      deniedWrite: perm.writeAccess,
      normalRead: nperm.readAccess
    };
  });
  assert(r.deniedRead === false && r.deniedWrite === false, 'Denied should be unreadable');
  assert(r.normalRead === true, 'Normal instance should still read via grant');
  const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
  assert(!/grants\.some\(g => g\.readAccess\) \|\| true/.test(sharedSrc), '|| true still present');
});

test('2 Permission Denied cannot read file body', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-permission-denied');
    const inst = SP.getAssetInstances(id)[0];
    const file = SP.getInstanceFiles(inst.id)[0];
    const detail = SP.getFileDetail(file.id);
    return {
      contentForView: detail.contentForView,
      status: detail.contentAccessStatus,
      read: detail.readAccess
    };
  });
  assert(r.contentForView == null, 'contentForView should be null');
  assert(r.read === false, 'readAccess false');
  assert(/denied|permission/i.test(r.status), 'status: ' + r.status);
});

test('3 Grant read then revoke restores unreadability', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-permission-denied');
    const inst = SP.getAssetInstances(id)[0];
    const file = SP.getInstanceFiles(inst.id)[0];
    const before = SP.getFileDetail(file.id);
    const grant = SP.requestWritePermission({
      instanceId: inst.id,
      scopeType: 'instance',
      readAccess: true,
      writeAccess: false,
      purpose: 'grant-read-test'
    });
    const mid = SP.getFileDetail(file.id);
    const rev = SP.revokeWritePermission(grant.grant.id);
    const after = SP.getFileDetail(file.id);
    return {
      before: before.contentForView,
      mid: mid.contentForView,
      midStatus: mid.contentAccessStatus,
      after: after.contentForView,
      afterRead: after.readAccess,
      grantOk: grant.ok,
      revOk: rev.ok
    };
  });
  assert(r.before == null, 'before should be unreadable');
  assert(r.grantOk && r.mid != null && r.midStatus === 'readable', 'after grant should read: ' + r.midStatus);
  assert(r.revOk && r.after == null && r.afterRead === false, 'after revoke should be unreadable');
});

test('4 Missing only allows historical metadata', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const inst = SP.getAssetInstances(id)[0];
    const perm = SP.getInstancePermission(inst.id);
    const file = SP.getInstanceFiles(inst.id)[0];
    const detail = SP.getFileDetail(file.id);
    return {
      permStatus: perm.contentAccessStatus,
      read: perm.readAccess,
      write: perm.writeAccess,
      contentForView: detail.contentForView,
      path: detail.relativePath,
      hash: detail.contentHash,
      fileStatus: detail.contentAccessStatus
    };
  });
  assert(r.read === false && r.write === false, 'Missing not currently readable');
  assert(r.permStatus === 'historical-metadata', 'perm status: ' + r.permStatus);
  assert(r.contentForView == null, 'no body for missing');
  assert(r.path && r.hash, 'metadata should remain');
});

test('5 Package snapshot includes full package files', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const beforeFiles = SP.__test.getRawState().files.filter(f => f.skillId === id).length;
    SP.archiveSkill(id, 'd1-test');
    const snaps = SP.getAssetSnapshots(id).filter(s => s.source === 'pre-archive' && s.type === 'package');
    // Pick the richest package snap (primary instance), not merely newest equal-timestamp sibling.
    const primary = snaps.map(s => {
      const d = SP.getSnapshotDetail(s.id);
      return { summary: s, detail: d, n: (d.files || []).length };
    }).sort((a, b) => b.n - a.n)[0].summary;
    const detail = SP.getSnapshotDetail(primary.id);
    const paths = (detail.files || []).map(f => f.relativePath);
    const binary = (detail.files || []).find(f => f.fileType === 'binary' || f.relativePath.includes('icon.png'));
    return {
      beforeFiles,
      afterFiles: SP.__test.getRawState().files.filter(f => f.skillId === id).length,
      snapCount: snaps.length,
      paths,
      hasSkill: paths.includes('SKILL.md'),
      hasRef: paths.some(p => p.includes('references/')),
      hasScript: paths.some(p => p.includes('scripts/')),
      hasNested: paths.some(p => p.includes('nested/SKILL.md')),
      hasBinary: !!binary,
      binaryContentNull: (() => {
        const raw = SP.__test.getRawState().snapshots.find(s => s.id === primary.id);
        const bf = (raw.files || []).find(f => f.fileType === 'binary' || f.relativePath.includes('icon.png'));
        return bf ? bf.content == null : false;
      })(),
      binarySize: binary ? binary.sizeBytes : 0,
      packageSize: primary.packageSizeBytes,
      summaryHasNoFiles: !('files' in primary) || primary.files == null
    };
  });
  assert(r.snapCount >= 2, 'Expected package snap per instance, got ' + r.snapCount);
  assert(r.hasSkill && r.hasRef && r.hasScript && r.hasNested && r.hasBinary, 'Missing package paths: ' + r.paths.join(','));
  assert(r.binaryContentNull, 'Binary must not store fake text content');
  assert(r.binarySize > 0 && r.packageSize >= r.binarySize, 'Binary size not counted');
  assert(r.beforeFiles === r.afterFiles, 'Archive deleted Formal Index files');
});

test('6 Multi-instance archive all protected', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const instIds = SP.getAssetInstances(id).map(i => i.id);
    SP.archiveSkill(id, 'd1-multi');
    const snaps = SP.getAssetSnapshots(id).filter(s => s.type === 'package' && s.source === 'pre-archive');
    const covered = instIds.every(iid => snaps.some(s => s.instanceId === iid));
    const batch = SP.getAssetSnapshots(id).find(s => s.type === 'batch' && s.source === 'pre-archive');
    return { instIds: instIds.length, snaps: snaps.length, covered, batch: !!batch };
  });
  assert(r.covered && r.snaps >= r.instIds, 'Not all instances snapshotted');
  assert(r.batch, 'Batch snapshot missing for multi-instance');
});

test('7 Unconfirmed candidate cannot rebind', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const miss = SP.getAssetInstances(id)[0];
    const high = SP.getRelinkCandidates(miss.id).find(c => c.confidence === 'high');
    return SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', candidateId: high.id, candidate: high,
      evidence: high.evidence, confidence: 'high'
    });
  });
  assert(!r.ok && r.code === 'not_confirmed', 'Expected not_confirmed: ' + JSON.stringify(r));
});

test('8 Arbitrary path cannot bypass candidate', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const miss = SP.getAssetInstances(id)[0];
    return SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', newPath: '~/Evil/SKILL.md', userConfirmed: true
    });
  });
  assert(!r.ok && r.code === 'candidate_required', 'Expected candidate_required');
});

test('9 High confidence rebind keeps UUIDs', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const miss = SP.getAssetInstances(id)[0];
    const high = SP.getRelinkCandidates(miss.id).find(c => c.confidence === 'high');
    const res = SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', candidateId: high.id, candidate: high,
      evidence: high.evidence, confidence: 'high', userConfirmed: true
    });
    return { res, sameInst: res.instanceId === miss.id, sameAsset: res.assetId === id };
  });
  assert(r.res.ok && r.sameInst && r.sameAsset, JSON.stringify(r.res));
});

test('10 Path conflict still rejected', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const miss = SP.getAssetInstances(SP.resolveAssetId('demo-path-missing'))[0];
    const high = SP.getRelinkCandidates(miss.id).find(c => c.confidence === 'high');
    SP.__test.patchRawState(state => {
      const primary = state.instances.find(i => i.skillId === SP.resolveAssetId('pr-review') && i.isPrimary);
      primary.skillFilePath = high.path;
      primary.rootPath = high.path.replace(/\/SKILL\.md$/, '');
    });
    return SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', candidateId: high.id, candidate: high,
      evidence: high.evidence, confidence: 'high', userConfirmed: true
    });
  });
  assert(!r.ok && r.code === 'path_conflict', JSON.stringify(r));
});

test('11 Add New uses candidate files not old missing body', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const miss = SP.getAssetInstances(id)[0];
    const oldMeta = SP.getInstanceFiles(miss.id).find(f => f.relativePath === 'SKILL.md');
    const oldRaw = SP.__test.getRawState().files.find(f => f.id === oldMeta.id);
    const high = SP.getRelinkCandidates(miss.id).find(c => c.confidence === 'high');
    const res = SP.relinkInstance({
      instanceId: miss.id, mode: 'add-new', candidateId: high.id, candidate: high,
      evidence: high.evidence, confidence: 'high', userConfirmed: true
    });
    const neuMeta = SP.getInstanceFiles(res.newInstanceId).find(f => f.relativePath === 'SKILL.md');
    const neuDetail = SP.getFileDetail(neuMeta.id);
    return {
      ok: res.ok,
      oldContent: oldRaw && oldRaw.content,
      newContent: neuDetail && neuDetail.content,
      marker: neuDetail && neuDetail.content && neuDetail.content.includes('PHASE_D1_CANDIDATE_MARKER'),
      stillMissing: SP.getInstance(miss.id).lifecycleStatus === 'missing',
      listHasNoContent: !('content' in neuMeta)
    };
  });
  assert(r.ok && r.marker, 'Candidate marker missing');
  assert(r.newContent !== r.oldContent, 'Copied old missing content');
  assert(r.stillMissing, 'Original missing cleared');
});

test('12 Add New without candidate files is pending-rescan', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const miss = SP.getAssetInstances(id)[0];
    const low = SP.getRelinkCandidates(miss.id).find(c => c.confidence === 'low');
    const res = SP.relinkInstance({
      instanceId: miss.id, mode: 'add-new', candidateId: low.id, candidate: low,
      evidence: low.evidence, confidence: 'low', userConfirmed: true
    });
    const neu = SP.getInstanceFiles(res.newInstanceId)[0];
    const neuDetail = SP.getFileDetail(neu.id);
    return {
      ok: res.ok,
      indexStatus: res.indexStatus,
      fileStatus: neu && neu.indexStatus,
      content: neuDetail && neuDetail.content,
      listHasNoContent: !('content' in neu)
    };
  });
  assert(r.ok && r.indexStatus === 'pending-rescan', JSON.stringify(r));
  assert(r.fileStatus === 'pending-rescan', 'file indexStatus');
  assert(!r.content, 'should not copy old body');
});

test('13 Directory permission path boundary', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    assertPath = (a, b) => SP.$pathInScope(a, b);
    const ok1 = assertPath('~/Projects/skills/foo', '~/Projects/skills/foo');
    const ok2 = assertPath('~/Projects/skills/foo/bar', '~/Projects/skills/foo');
    const bad = assertPath('~/Projects/skills/foobar', '~/Projects/skills/foo');
    const id = SP.resolveAssetId('pr-review');
    const custom = SP.getAssetInstances(id).find(i => i.hostType === 'custom');
    const grant = SP.requestWritePermission({
      instanceId: custom.id,
      scopeType: 'directory',
      scopePath: custom.rootPath,
      purpose: 'boundary'
    });
    const invalid = SP.requestWritePermission({
      instanceId: custom.id,
      scopeType: 'host',
      purpose: 'bad'
    });
    return { ok1, ok2, bad, grantOk: grant.ok, affected: grant.affectedInstanceIds, invalid };
  });
  assert(r.ok1 && r.ok2 && r.bad === false, 'path boundary logic failed');
  assert(r.grantOk && r.affected.length >= 1, 'directory grant');
  assert(!r.invalid.ok && r.invalid.code === 'invalid_scope_type', 'invalid scopeType');
});

test('14 Approx tokens are never exact without tokenizer source', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const bad = SP.__test.getRawState().files.filter(f => f.tokenCountMode === 'exact' && f.tokenCountExactSource !== 'tokenizer');
    const nested = SP.__test.getRawState().files.find(f => f.isNestedSkillMarker);
    return {
      badCount: bad.length,
      nestedMode: nested && nested.tokenCountMode
    };
  });
  assert(r.badCount === 0, 'exact without tokenizer source: ' + r.badCount);
  assert(r.nestedMode === 'estimated' || r.nestedMode === 'unavailable', 'nested mode: ' + r.nestedMode);
});

test('15 Detail has no Ignore Skill action', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'skill-detail.html'), 'utf8');
  const src = fs.readFileSync(path.join(ROOT, 'skill-detail-app.js'), 'utf8');
  assert(!html.includes('忽略此 Skill'), 'Ignore menu still present');
  assert(!/more-ignore/.test(html), 'more-ignore still present');
  assert(!/ignoreSkill\s*\(/.test(src), 'Detail still calls ignoreSkill');
  assert(html.includes('可能已被删除或停止管理'), 'not-found copy not updated');
});

test('16 Relink UI payload includes candidate fields', async () => {
  await freshPage();
  await resetState();
  const src = fs.readFileSync(path.join(ROOT, 'skill-detail-app.js'), 'utf8');
  assert(/candidateId/.test(src) && /userConfirmed:\s*true/.test(src), 'Relink call missing fields');
  assert(/evidence/.test(src) && /confidence/.test(src), 'missing evidence/confidence');
});

test('17 Medium/Low cannot rebind without extra confirm', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const miss = SP.getAssetInstances(SP.resolveAssetId('demo-path-missing'))[0];
    const med = SP.getRelinkCandidates(miss.id).find(c => c.confidence === 'medium');
    const low = SP.getRelinkCandidates(miss.id).find(c => c.confidence === 'low');
    const medRes = SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', candidateId: med.id, candidate: med,
      evidence: med.evidence, confidence: 'medium', userConfirmed: true
    });
    const lowRes = SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', candidateId: low.id, candidate: low,
      evidence: low.evidence, confidence: 'low', userConfirmed: true
    });
    const medOk = SP.relinkInstance({
      instanceId: miss.id, mode: 'rebind', candidateId: med.id, candidate: med,
      evidence: med.evidence, confidence: 'medium', userConfirmed: true, extraConfirmed: true
    });
    return { medRes, lowRes, medOk };
  });
  assert(!r.medRes.ok && r.medRes.code === 'medium_needs_confirm', JSON.stringify(r.medRes));
  assert(!r.lowRes.ok && r.lowRes.code === 'low_confidence', JSON.stringify(r.lowRes));
  assert(r.medOk.ok, 'medium with extraConfirmed should work');
});

test('18 Snapshot retained via public API', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const snap = SP.getAssetSnapshots(id)[0];
    const before = snap.retained;
    const res = SP.setSnapshotRetained(snap.id, !before);
    const after = SP.getAssetSnapshots(id).find(s => s.id === snap.id);
    const audit = SP.getAssetAuditEvents(id).some(e => e.eventType === 'snapshot_retain');
    return { res, before, after: after.retained, audit };
  });
  assert(r.res.ok && r.after !== r.before && r.audit, JSON.stringify(r));
});

test('19 Detail page does not mutate raw getState arrays', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'skill-detail-app.js'), 'utf8');
  assert(!/getState\(\)\.snapshots/.test(src), 'direct snapshots access');
  assert(!/getState\(\)\.assets/.test(src), 'direct assets access');
  assert(!/\.retained\s*=/.test(src), 'direct retained assignment');
});

test('20 Restore UI has no target directory select', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'skill-detail.html'), 'utf8');
  const src = fs.readFileSync(path.join(ROOT, 'skill-detail-app.js'), 'utf8');
  assert(!/restore-target/.test(html + src), 'restore-target still present');
  const restoreFn = src.match(/function openRestoreModal[\s\S]*?\n  function /);
  const block = restoreFn ? restoreFn[0] : '';
  assert(!/overwrite|conflictOption/.test(block), 'restore still shows overwrite strategy');
  assert(/不移动宿主文件|Missing/.test(html + src), 'restore explanation missing');
});

test('21 No duplicate compound selectors vs shared.css', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'skill-detail.html'), 'utf8');
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const shared = fs.readFileSync(path.join(ROOT, 'shared.css'), 'utf8');
  const pageSelectors = [...style.matchAll(/(^|\n)\s*([.#][^{,\n]+)\s*\{/g)].map(m => m[2].trim());
  const sharedSelectors = new Set([...shared.matchAll(/(^|\n)\s*([.#][^{,\n]+)\s*\{/g)].map(m => m[2].trim()));
  const publicDupes = pageSelectors.filter(sel => {
    if (!sharedSelectors.has(sel)) return false;
    // flag shared public / compound trees
    return /^(?:\.btn|\.card|\.modal|\.app|\.sidebar|\.nav|\.titlebar|:root|\.sp-file-tree|\.modal\.wide)(\s|$|\.|:)/.test(sel)
      || sel === '.sp-file-tree .node'
      || sel === '.modal.wide';
  });
  assert(publicDupes.length === 0, 'Duplicate selectors: ' + publicDupes.join(', '));
});

test('22 Permission Denied viewer shows no body in UI', async () => {
  await freshPage();
  await resetState();
  const id = await evalSP(() => SP.resolveAssetId('demo-permission-denied'));
  await page.goto(BASE + '/skill-detail.html?skill=' + encodeURIComponent(id) + '&dev=1', { waitUntil: 'networkidle' });
  await page.click('[data-tab="files"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const vs = SP.getDetailViewState();
    const files = SP.getInstanceFiles(vs.selectedInstanceId);
    if (files[0]) SP.setDetailViewState({ selectedFileId: files[0].id, tab: 'files' });
  });
  await page.click('[data-tab="overview"]');
  await page.click('[data-tab="files"]');
  await page.waitForTimeout(200);
  const text = await page.locator('#file-viewer').textContent();
  assert(/无读取权限|不可读|权限/.test(text), 'Expected denial message: ' + text.slice(0, 120));
  const preview = await page.locator('#file-view-preview').innerHTML();
  assert(!/<h1>/.test(preview) || /无读取|不可读|权限|历史/.test(text), 'Should not render skill body');
});

(async () => {
  console.log('=== Phase D.1 Targeted Tests ===\n');
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
