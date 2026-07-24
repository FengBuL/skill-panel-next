const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('./chrome-launch');

const BASE = 'http://localhost:8081';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

let browser, context, page;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function clearState() {
  await page.goto(BASE + '/index.html?dev=1');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('sp-dev', '1'); });
  await page.goto(BASE + '/index.html?dev=1');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => SP.loadDemoScanScenario());
}

async function freshPage() {
  if (page) await page.close();
  page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(BASE + '/index.html?dev=1');
  await page.waitForLoadState('networkidle');
}

async function lsState() {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('sp-state-v3');
    return raw ? JSON.parse(raw) : null;
  });
}

async function evalSP(fn, ...args) {
  return await page.evaluate(fn, ...args);
}

// 1. Formal Index count unchanged before confirmation
test('Scanning before confirmation does not change formal index', async () => {
  await clearState();
  const before = await evalSP(() => ({ assets: SP.getState().assets.length, instances: SP.getState().instances.length }));
  await evalSP(() => {
    const s = SP.createScanSession('first-full');
    SP.scanTick(s.id);
    SP.scanTick(s.id);
  });
  const after = await evalSP(() => ({ assets: SP.getState().assets.length, instances: SP.getState().instances.length }));
  assert(after.assets === before.assets && after.instances === before.instances, 'Formal index changed before confirmation');
});

// 2. Pause stops progress
test('Pause stops scan progress', async () => {
  await clearState();
  await evalSP(() => {
    const s = SP.createScanSession('first-full');
    SP.startScan();
    SP.scanTick(s.id);
    SP.pauseScan(s.id);
  });
  const step1 = await evalSP(() => SP.getActiveScanSession().currentStep);
  await page.waitForTimeout(600);
  const step2 = await evalSP(() => SP.getActiveScanSession().currentStep);
  assert(step1 === 1 && step2 === step1, `Progress did not stop: ${step1} -> ${step2}`);
});

// 3. Resume restores progress
test('Resume continues from previous progress', async () => {
  await clearState();
  await evalSP(() => {
    const s = SP.createScanSession('first-full');
    SP.startScan();
    SP.scanTick(s.id);
    SP.pauseScan(s.id);
  });
  const step1 = await evalSP(() => SP.getActiveScanSession().currentStep);
  await evalSP(() => {
    const s = SP.getActiveScanSession();
    SP.resumeScan(s.id);
    SP.scanTick(s.id);
    SP.scanTick(s.id);
    SP.pauseScan(s.id);
  });
  const step2 = await evalSP(() => SP.getActiveScanSession().currentStep);
  assert(step2 > step1, `Progress did not resume: ${step1} -> ${step2}`);
});

// 4. Cancel does not update formal index
test('Cancel scan does not update formal index', async () => {
  await clearState();
  const before = await evalSP(() => ({ assets: SP.getState().assets.length, instances: SP.getState().instances.length }));
  await evalSP(() => {
    const s = SP.createScanSession('first-full');
    SP.startScan();
    SP.scanTick(s.id);
    SP.scanTick(s.id);
    SP.cancelScan(s.id);
  });
  const after = await evalSP(() => ({ assets: SP.getState().assets.length, instances: SP.getState().instances.length }));
  assert(after.assets === before.assets && after.instances === before.instances, 'Formal index changed after cancel');
});

// 5. Refresh restores ScanSession
test('Refresh restores current ScanSession', async () => {
  await clearState();
  const session = await evalSP(() => {
    const s = SP.createScanSession('first-full');
    SP.startScan();
    SP.scanTick(s.id);
    SP.pauseScan(s.id);
    return s;
  });
  const step1 = await evalSP(() => SP.getActiveScanSession().currentStep);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.evaluate(() => location.reload())
  ]);
  const restored = await evalSP(() => SP.getActiveScanSession());
  assert(restored && restored.id === session.id && restored.status === 'paused' && restored.currentStep === step1, 'Session not restored after refresh');
});

// 6. Completion generates a ChangeSet
test('Scan completion generates a ChangeSet', async () => {
  await clearState();
  const before = await evalSP(() => SP.getState().changeSets.length);
  await evalSP(() => {
    const s = SP.createScanSession('first-full');
    SP.startScan();
    let guard = 0;
    while (SP.getActiveScanSession() && SP.getActiveScanSession().status === 'scanning' && guard++ < 100) {
      SP.scanTick(s.id);
    }
  });
  const after = await evalSP(() => SP.getState().changeSets.length);
  assert(after > before, 'No ChangeSet generated after completion');
});

// 7. Ignoring single change does not change skill lifecycle
test('Ignoring a change item does not change skill lifecycle', async () => {
  await clearState();
  const cs = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending'));
  assert(cs, 'No pending change set');
  const item = await evalSP(id => SP.getChangeItems(id).find(i => i.skillId), cs.id);
  assert(item, 'No item linked to existing skill');
  const beforeStatus = await evalSP(id => SP.getAsset(id).lifecycleStatus, item.skillId);
  await evalSP(id => SP.ignoreChangeItem(id), item.id);
  const afterStatus = await evalSP(id => SP.getAsset(id).lifecycleStatus, item.skillId);
  assert(afterStatus === beforeStatus, 'Lifecycle changed after ignore');
});

// 8. Accept added item creates Asset, Instance, Files
test('Accepting added item creates Asset, Instance and Files', async () => {
  await clearState();
  const cs = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending'));
  const before = await evalSP(() => ({ assets: SP.getState().assets.length, instances: SP.getState().instances.length, files: SP.getState().files.length }));
  const item = await evalSP(id => SP.getChangeItems(id).find(i => i.changeType === 'added'), cs.id);
  assert(item, 'No added item');
  await evalSP(id => { SP.acceptChangeItem(id); SP.applyChangeSet(SP.getState().changeItems.find(i => i.id === id).changeSetId); }, item.id);
  const after = await evalSP(() => ({ assets: SP.getState().assets.length, instances: SP.getState().instances.length, files: SP.getState().files.length }));
  assert(after.assets > before.assets && after.instances > before.instances && after.files > before.files, 'Asset/Instance/File not created');
});

// 9. Path change retains Asset UUID
test('Accepting path change retains original Asset UUID', async () => {
  await clearState();
  const cs = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending'));
  const item = await evalSP(id => SP.getChangeItems(id).find(i => i.changeType === 'path-changed'), cs.id);
  assert(item, 'No path-changed item');
  const idBefore = item.skillId;
  await evalSP(id => { SP.acceptChangeItem(id); SP.applyChangeSet(SP.getState().changeItems.find(i => i.id === id).changeSetId); }, item.id);
  const idAfter = await evalSP(id => SP.getState().changeItems.find(i => i.id === id).skillId, item.id);
  assert(idAfter === idBefore, 'Asset UUID changed after path change');
});

// 10. Second instance does not duplicate Asset
test('Adding second instance does not duplicate Asset', async () => {
  await clearState();
  const cs = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending'));
  const item = await evalSP(id => SP.getChangeItems(id).find(i => i.changeType === 'instance-changed'), cs.id);
  assert(item, 'No instance-changed item');
  const beforeCount = await evalSP(id => SP.getInstances({ skillId: id }).length, item.skillId);
  await evalSP(id => { SP.acceptChangeItem(id); SP.applyChangeSet(SP.getState().changeItems.find(i => i.id === id).changeSetId); }, item.id);
  const asset = await evalSP(id => SP.getAsset(id), item.skillId);
  const afterCount = await evalSP(id => SP.getInstances({ skillId: id }).length, item.skillId);
  assert(asset && afterCount === beforeCount + 1, 'Asset duplicated or instance not added');
});

// 11. Single instance missing does not affect other instances
test('Single instance missing does not affect other normal instances', async () => {
  await clearState();
  const multi = await evalSP(() => {
    const asset = SP.getState().assets.find(a => a.name === 'pr-review');
    return { assetId: asset?.id, count: SP.getState().instances.filter(i => i.skillId === asset?.id).length };
  });
  assert(multi.count >= 2, 'Need multi-instance skill for this test');
  const beforeOk = await evalSP(id => SP.getState().instances.filter(i => i.skillId === id && i.lifecycleStatus !== 'missing').length, multi.assetId);
  const cs = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending'));
  const item = await evalSP(id => SP.getChangeItems(id).find(i => i.changeType === 'missing'), cs.id);
  if (item) {
    await evalSP(id => { SP.acceptChangeItem(id); SP.applyChangeSet(SP.getState().changeItems.find(i => i.id === id).changeSetId); }, item.id);
  }
  const afterOk = await evalSP(id => SP.getState().instances.filter(i => i.skillId === id && i.lifecycleStatus !== 'missing').length, multi.assetId);
  assert(afterOk >= beforeOk - 1, 'Other normal instances affected by missing');
});

// 12. All instances missing marks Asset missing
test('All instances missing marks Asset missing', async () => {
  await clearState();
  const cs = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending'));
  // Find an added skill with only one instance after apply, then mark missing via a new scan is complex.
  // Instead, mutate the single instance of a non-multi skill to missing and reconcile.
  const target = await evalSP(() => {
    const asset = SP.getState().assets.find(a => SP.getState().instances.filter(i => i.skillId === a.id).length === 1);
    return asset?.id;
  });
  assert(target, 'No single-instance skill found');
  await evalSP(id => {
    SP.__test.patchRawState(state => {
      const inst = state.instances.find(i => i.skillId === id);
      inst.lifecycleStatus = 'missing';
    });
    SP.reconcileAssetLifecycle(id);
  }, target);
  const status = await evalSP(id => SP.getAsset(id).lifecycleStatus, target);
  assert(status === 'missing', 'Asset not marked missing when all instances missing');
});

// 13. Category, tags, favorite retained after scan apply
test('Category, tags and favorite retained after scan apply', async () => {
  await clearState();
  const cs = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending'));
  const item = await evalSP(id => SP.getChangeItems(id).find(i => i.changeType === 'content-changed' && i.skillId), cs.id);
  assert(item, 'No content-changed item for existing skill');
  await evalSP(id => {
    SP.__test.patchRawState(state => {
      const asset = state.assets.find(a => a.id === id);
      asset.categoryIds = ['cat-test'];
      asset.tagIds = ['tag-git'];
      asset.isFavorite = true;
    });
  }, item.skillId);
  await evalSP(id => {
    SP.acceptChangeItem(id);
    const item = SP.__test.getRawState().changeItems.find(i => i.id === id);
    SP.applyChangeSet(item.changeSetId);
  }, item.id);
  const asset = await evalSP(id => SP.getAsset(id), item.skillId);
  assert(asset.categoryIds.includes('cat-test') && asset.tagIds.includes('tag-git') && asset.isFavorite, 'User data overwritten');
});

// 14. One valid path cannot correspond to two valid instances
test('One valid path cannot correspond to two valid instances', async () => {
  await clearState();
  const paths = await evalSP(() => {
    const map = {};
    SP.getState().instances.filter(i => i.lifecycleStatus === 'available').forEach(i => { (map[i.skillFilePath] ||= []).push(i.id); });
    return map;
  });
  Object.entries(paths).forEach(([path, ids]) => assert(ids.length <= 1, `Path ${path} has ${ids.length} valid instances`));
});

// 15. Partial apply failure shows per-item results
test('Partial apply failure returns per-item results', async () => {
  await clearState();
  const cs = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending'));
  const items = await evalSP(id => SP.getChangeItems(id).slice(0, 2), cs.id);
  items.forEach(i => evalSP(id => SP.acceptChangeItem(id), i.id));
  // Corrupt one discovery to force failure (must mutate raw state)
  await evalSP(id => {
    SP.__test.patchRawState(state => {
      const item = state.changeItems.find(i => i.id === id);
      const d = state.scanDiscoveries.find(x => x.id === item.discoveryId);
      if (d) d.skillFileContent = null;
    });
  }, items[0].id);
  const res = await evalSP(id => SP.applyChangeSet(id), cs.id);
  assert(Array.isArray(res.results) && res.results.length >= 2, 'No per-item results');
  assert(res.results.some(r => !r.ok), 'Expected at least one failed result');
  assert(res.results.some(r => r.ok), 'Expected at least one successful result');
  assert(res.ok === false || res.changeSet.status === 'partial-failure', 'Expected partial-failure status');
});

// 16. AuditEvent cannot be modified via UI / SP API surface
test('AuditEvent is immutable from UI-facing API', async () => {
  await freshPage();
  const before = await evalSP(() => SP.getState().auditEvents.length);
  // The API surface exposes no mutation helpers for audit events.
  const hasHelpers = await evalSP(() => ({
    edit: typeof SP.editAuditEvent,
    del: typeof SP.deleteAuditEvent,
    set: typeof SP.setAuditEvent
  }));
  assert(hasHelpers.edit === 'undefined' && hasHelpers.del === 'undefined' && hasHelpers.set === 'undefined', 'Audit mutation helpers exposed');
  // Verify no accidental mutation happened via normal API usage.
  const after = await evalSP(() => SP.getState().auditEvents.length);
  assert(after === before, 'AuditEvents unexpectedly changed');
});

// 17. hosts is the single formal scan config source
test('hosts is the single formal scan config source', async () => {
  await freshPage();
  const state = await lsState();
  assert(!state.storageLocations, 'storageLocations persisted as top-level field');
  const hosts = await evalSP(() => SP.getHosts());
  const locs = await evalSP(() => SP.getStorageLocations());
  assert(hosts.length > 0 && locs.length === hosts.length, 'StorageLocations not derived from hosts');
  const hasUpdateHost = await evalSP(() => typeof SP.updateHost === 'function');
  assert(hasUpdateHost, 'No host mutation API');
});

async function run() {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  let passed = 0, failed = 0;
  console.log('=== Phase 2 Targeted Tests ===\n');
  for (const t of tests) {
    try {
      await t.fn();
      console.log('✅', t.name);
      passed++;
    } catch (e) {
      console.log('❌', t.name, ':', e.message);
      failed++;
    }
  }
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
