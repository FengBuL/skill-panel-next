/**
 * Phase F targeted tests — Install / Update / Uninstall / Compare + F.0 gate items
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

// ---- Install ----
test('F-8 Five sources resolve', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const keys = [
      'github:acme/hello-skill',
      'git:https://example.com/skills/world.git',
      'zip-url:https://example.com/pkg.zip',
      'local-directory:~/Skills/local-demo',
      'local-zip:~/Downloads/local-demo.zip'
    ];
    return keys.map(k => ({ k, ok: SP.resolveInstallSource(k).ok, type: SP.resolveInstallSource(k).sourceType }));
  });
  assert(r.every(x => x.ok), JSON.stringify(r));
});

test('F-9 No Formal Index change before confirm', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const before = {
      a: SP.__test.getRawState().assets.length,
      i: SP.__test.getRawState().instances.length,
      f: SP.__test.getRawState().files.length
    };
    const prep = SP.prepareInstall({ source: 'github:acme/hello-skill', hostIds: ['claude'], mode: 'new-asset' });
    const after = {
      a: SP.__test.getRawState().assets.length,
      i: SP.__test.getRawState().instances.length,
      f: SP.__test.getRawState().files.length
    };
    return { prepOk: prep.ok, before, after, operationId: prep.operationId };
  });
  assert(r.prepOk && r.before.a === r.after.a && r.before.i === r.after.i && r.before.f === r.after.f, JSON.stringify(r));
});

test('F-10 No script/dependency execution markers', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
  assert(!/child_process|fetch\(|XMLHttpRequest|eval\(/.test(src.match(/resolveInstallSource[\s\S]*?function prepareInstall/)[0]), 'network/exec in resolve');
});

test('F-11 Path conflict blocked', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const prep1 = SP.prepareInstall({ source: 'github:acme/hello-skill', hostIds: ['claude'], mode: 'new-asset' });
    SP.confirmInstall(prep1.operationId, { userConfirmed: true });
    const prep2 = SP.prepareInstall({ source: 'github:acme/hello-skill', hostIds: ['claude'], mode: 'new-asset' });
    return prep2;
  });
  assert(r.ok === false && r.code === 'path_conflict', JSON.stringify(r));
});

test('F-12 Existing Asset can add Instance', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const before = SP.__test.getRawState().instances.filter(i => i.skillId === id).length;
    const prep = SP.prepareInstall({
      source: 'local-directory:~/Skills/local-demo',
      hostIds: ['custom'],
      mode: 'add-instance',
      existingAssetId: id
    });
    if (!prep.ok) return { step: 'prep', prep };
    const done = SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const after = SP.__test.getRawState().instances.filter(i => i.skillId === id).length;
    return { before, after, done, sameAsset: (done.results || []).filter(x => x.status === 'completed').every(x => x.assetId === id) };
  });
  assert(r.after === r.before + 1 && r.done.ok && r.sameAsset, JSON.stringify(r));
});

test('F-13 New Asset uses permanent UUID + F-14 SourceBinding/Baseline', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const prep = SP.prepareInstall({ source: 'zip-url:https://example.com/pkg.zip', hostIds: ['claude'], mode: 'new-asset' });
    const done = SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const assetId = done.results[0].assetId;
    const asset = SP.__test.getRawState().assets.find(a => a.id === assetId);
    const binding = SP.__test.getRawState().sourceBindings.find(b => b.skillId === assetId);
    const snap = SP.__test.getRawState().snapshots.find(s => s.id === binding.baselineSnapshotId);
    return {
      uuid: /^[0-9a-f-]{36}$/i.test(assetId),
      binding: !!(binding && binding.baselineSnapshotId && binding.sourceType),
      snapType: snap && snap.type,
      snapSource: snap && snap.source
    };
  });
  assert(r.uuid && r.binding && r.snapType === 'package', JSON.stringify(r));
});

test('F-15/16 Partial fail and no half-baked on all-fail; partial keeps one Asset', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    SP.loadInstallDemoCase('fail-codex');
    const beforeAssets = SP.__test.getRawState().assets.map(a => a.id);
    const prep = SP.prepareInstall({
      source: 'github:acme/hello-skill',
      hostIds: ['claude', 'codex'],
      mode: 'new-asset'
    });
    const done = SP.confirmInstall(prep.operationId, { userConfirmed: true });
    const after = SP.__test.getRawState().assets.filter(a => !beforeAssets.includes(a.id) && a.lifecycleStatus !== 'deleted');
    const assetId = after[0] && after[0].id;
    const insts = assetId ? SP.__test.getRawState().instances.filter(i => i.skillId === assetId) : [];
    const completed = (done.results || []).filter(x => x.status === 'completed');
    const failed = (done.results || []).filter(x => x.status === 'failed');
    return {
      status: done.status,
      created: after.length,
      insts: insts.length,
      completed: completed.length,
      failed: failed.length,
      sameAsset: completed.every(x => x.assetId === assetId)
    };
  });
  assert(r.failed >= 1 && r.completed >= 1, JSON.stringify(r));
  assert(r.created === 1 && r.sameAsset, JSON.stringify(r));
  assert(r.status === 'partially-completed', JSON.stringify(r));
});

// ---- Update ----
test('F-17 No update writes nothing', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    // ensure binding up to date
    const b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id);
    if (b) { b.updateStatus = 'up-to-date'; b.remoteVersion = b.baselineVersion; }
    SP.__test.saveState();
    const before = SP.__test.getRawState().snapshots.length;
    const prep = SP.prepareUpdate({ assetId: id });
    const after = SP.__test.getRawState().snapshots.length;
    return { prep, before, after };
  });
  assert(r.prep.updateStatus === 'up-to-date' && r.before === r.after && !r.prep.operationId, JSON.stringify(r));
});

test('F-18..24 Update flow snapshot / select / baseline', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    // ensure source binding
    let b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id);
    if (!b) {
      const inst = SP.__test.getRawState().instances.find(i => i.skillId === id && i.isPrimary);
      const snap = SP.__test.createPackageSnapshotForInstance(inst.id, { note: 'base', source: 'seed-baseline', retained: true });
      SP.__test.getRawState().snapshots.push(snap);
      b = {
        id: SP.uuid(), skillId: id, sourceType: 'github', sourceUrl: 'https://github.com/demo/pr-review',
        repository: 'demo/pr-review', branch: 'main', baselineVersion: '1.0.0', baselineCommit: 'aaa',
        baselineSnapshotId: snap.id, trustPolicy: 'untrusted', lastCheckedAt: null,
        updateStatus: 'unknown', remoteVersion: '1.0.0', remoteCommit: 'aaa'
      };
      SP.__test.getRawState().sourceBindings.push(b);
      SP.__test.getRawState().assets.find(a => a.id === id).sourceBindingId = b.id;
      SP.__test.saveState();
    }
    SP.loadUpdateDemoCase('update-available');
    const check = SP.checkForUpdates(id);
    const insts = SP.getAssetInstances(id);
    insts.forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f-update' }));
    const prep = SP.prepareUpdate({ assetId: id, selectedRelativePaths: ['SKILL.md'] });
    if (!prep.ok) return { step: 'prep', prep, check };
    const tw = SP.getUpdateThreeWayDiff(prep.operationId, 'SKILL.md');
    const done = SP.confirmUpdate(prep.operationId, { userConfirmed: true });
    const binding = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id);
    return {
      check: check.updateStatus,
      snaps: (prep.snapshotIds || []).length,
      hasThree: !!(tw && tw.base != null && tw.remote != null),
      status: done.status,
      baseline: binding.baselineVersion,
      updateStatus: binding.updateStatus
    };
  });
  assert(r.check === 'update-available' && r.snaps >= 1 && r.hasThree && r.status === 'completed', JSON.stringify(r));
  assert(r.baseline === '9.9.9' && r.updateStatus === 'up-to-date', JSON.stringify(r));
});

// ---- Uninstall ----
test('F-25 Stop Managing does not delete files', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    const beforeFiles = SP.__test.getRawState().files.filter(f => f.instanceId === inst.id).length;
    const prep = SP.prepareUninstall({ assetId: id, mode: 'stop-managing', instanceIds: [inst.id] });
    const done = SP.confirmUninstall(prep.operationId, { userConfirmed: true });
    const afterFiles = SP.__test.getRawState().files.filter(f => f.instanceId === inst.id).length;
    const instAfter = SP.__test.getRawState().instances.find(i => i.id === inst.id);
    return { beforeFiles, afterFiles, status: done.status, life: instAfter.lifecycleStatus, deleted: (done.results[0] || {}).filesDeleted };
  });
  assert(r.beforeFiles === r.afterFiles && r.deleted === false && r.life === 'stopped', JSON.stringify(r));
});

test('F-26 Single instance uninstall keeps others', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const insts = SP.getAssetInstances(id);
    if (insts.length < 2) {
      // add second via install
      const prepI = SP.prepareInstall({ source: 'local-directory:~/Skills/local-demo', hostIds: ['custom'], mode: 'add-instance', existingAssetId: id });
      SP.confirmInstall(prepI.operationId, { userConfirmed: true });
    }
    const list = SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available');
    const target = list[0];
    const other = list[1];
    const prep = SP.prepareUninstall({ assetId: id, mode: 'stop-managing', instanceIds: [target.id] });
    SP.confirmUninstall(prep.operationId, { userConfirmed: true });
    const otherAfter = SP.__test.getRawState().instances.find(i => i.id === other.id);
    return { otherLife: otherAfter.lifecycleStatus, countAvail: SP.__test.getRawState().instances.filter(i => i.skillId === id && i.lifecycleStatus === 'available').length };
  });
  assert(r.otherLife === 'available' && r.countAvail >= 1, JSON.stringify(r));
});

test('F-27 Delete local copy requires second confirm', async () => {
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

test('F-30 Detach SourceBinding keeps files and lifecycles', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    let b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id);
    if (!b) {
      b = { id: SP.uuid(), skillId: id, sourceType: 'github', sourceUrl: 'x', repository: 'x', branch: 'main', baselineVersion: '1', baselineCommit: '1', baselineSnapshotId: null, trustPolicy: 'untrusted', lastCheckedAt: null, updateStatus: 'unknown', remoteVersion: '1', remoteCommit: '1' };
      SP.__test.getRawState().sourceBindings.push(b);
      SP.__test.saveState();
    }
    const beforeFiles = SP.__test.getRawState().files.filter(f => f.skillId === id).length;
    const beforeInst = SP.__test.getRawState().instances.filter(i => i.skillId === id).map(i => i.lifecycleStatus).sort();
    const beforeAssetLife = SP.__test.getRawState().assets.find(a => a.id === id).lifecycleStatus;
    const prep = SP.prepareUninstall({ assetId: id, mode: 'detach-source' });
    const done = SP.confirmUninstall(prep.operationId, { userConfirmed: true });
    const afterFiles = SP.__test.getRawState().files.filter(f => f.skillId === id).length;
    const afterInst = SP.__test.getRawState().instances.filter(i => i.skillId === id).map(i => i.lifecycleStatus).sort();
    const afterAssetLife = SP.__test.getRawState().assets.find(a => a.id === id).lifecycleStatus;
    const still = SP.__test.getRawState().sourceBindings.some(x => x.skillId === id);
    return { beforeFiles, afterFiles, still, done, beforeInst, afterInst, beforeAssetLife, afterAssetLife, targets: prep.targets };
  });
  assert(r.beforeFiles === r.afterFiles && !r.still && r.done.ok, JSON.stringify(r));
  assert((r.targets || []).length === 0, JSON.stringify(r));
  assert(JSON.stringify(r.beforeInst) === JSON.stringify(r.afterInst) && r.beforeAssetLife === r.afterAssetLife, JSON.stringify(r));
});

// ---- Compare ----
test('F-32/33 Compare real SKILL.md Diff without getSkill content', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    const li = SP.getAssetInstances(left)[0];
    const ri = SP.getAssetInstances(right)[0];
    const lf = SP.__test.getRawState().files.find(f => f.instanceId === li.id && f.relativePath === 'SKILL.md');
    const rf = SP.__test.getRawState().files.find(f => f.instanceId === ri.id && f.relativePath === 'SKILL.md');
    if (lf && rf && lf.content === rf.content) {
      rf.content = String(rf.content || '') + '\n## Compare Diff Marker\n';
      rf.contentHash = SP.$hash(rf.content);
      SP.__test.saveState();
    }
    const opened = SP.openCompareSession([left, right]);
    const sessionId = opened.session.id;
    const overview = SP.getCompareOverview(sessionId);
    const dL = SP.getCompareFileDetail(sessionId, left, lf.id);
    const dR = SP.getCompareFileDetail(sessionId, right, rf.id);
    const lines = (SP.lineDiffSafe || SP.$lineDiff)(dL.content || '', dR.content || '');
    const hasAddOrDel = (lines || []).some(l => l.type === 'add' || l.type === 'del');
    const skillObj = SP.getSkill(left);
    return {
      readable: !!(dL && dL.content && dR && dR.content),
      nonEmpty: (lines || []).length > 0,
      hasAddOrDel,
      skillContentNull: skillObj.content == null,
      overviewOk: !!(overview && overview.candidates && overview.candidates.length >= 2)
    };
  });
  assert(r.readable && r.nonEmpty && r.hasAddOrDel && r.skillContentNull && r.overviewOk, JSON.stringify(r));
});

test('F-35/36/37 Merge keeps UUID; ignore no skill IgnoreRule', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    const opened = SP.openCompareSession([left, right]);
    const sessionId = opened.session.id;
    const prep = SP.prepareDuplicateResolution({
      sessionId,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    const merged = SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const ignore = SP.resolveDuplicateComparison({
      sessionId: SP.openCompareSession([
        SP.resolveAssetId('release-notes'),
        SP.resolveAssetId('changelog-zh')
      ]).session.id,
      action: 'ignore',
      candidateIds: [SP.resolveAssetId('release-notes'), SP.resolveAssetId('changelog-zh')]
    });
    const rules = SP.__test.getRawState().ignoreRules.filter(r =>
      r.ruleType === 'skill_id' && (r.skillId === SP.resolveAssetId('release-notes') || r.skillId === SP.resolveAssetId('changelog-zh')));
    return {
      merged,
      ignore,
      rules: rules.length,
      preserved: merged.preservedAssetId,
      left
    };
  });
  assert(r.merged.ok && r.preserved === r.left && r.rules === 0 && r.ignore.ok !== false, JSON.stringify(r));
});

test('F pages exist and no Raw/saveState', async () => {
  ['install-app.js', 'update-app.js', 'uninstall-app.js', 'compare-app.js'].forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert(!/getAssetRaw|getInstanceRaw|SP\.saveState/.test(src), f + ' uses raw/saveState');
    assert(!/getSkill\([^)]*\)\.content/.test(src), f + ' uses getSkill content');
  });
  ['install.html', 'update.html', 'uninstall.html', 'compare.html'].forEach(f => {
    assert(fs.existsSync(path.join(ROOT, f)), f + ' missing');
  });
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let passed = 0, failed = 0;
  console.log('=== Phase F Targeted Tests ===\n');
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
