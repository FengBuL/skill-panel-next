const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('./chrome-launch');

const BASE = 'http://localhost:8081';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

let browser, context, page;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function freshPage() {
  if (page) await page.close();
  page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
}

async function resetState() {
  await page.goto(BASE + '/index.html?dev=1');
  await page.waitForLoadState('networkidle');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.evaluate(() => { localStorage.clear(); localStorage.setItem('sp-dev', '1'); location.reload(); })
  ]);
}

async function evalSP(fn, ...args) {
  return await page.evaluate(fn, ...args);
}

// 1. First-launch auto routing
test('Clear localStorage then open index.html redirects to onboarding', async () => {
  await freshPage();
  await page.goto(BASE + '/index.html');
  await page.waitForLoadState('networkidle');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.evaluate(() => { localStorage.clear(); location.reload(); })
  ]);
  const url = page.url();
  assert(url.includes('onboarding.html'), `Expected onboarding redirect, got ${url}`);
});

// 2. Fresh seed state has no scan sessions or pending change sets
test('Fresh state has empty scanSessions and no pending ChangeSet', async () => {
  await freshPage();
  await page.goto(BASE + '/index.html');
  await page.waitForLoadState('networkidle');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.evaluate(() => { localStorage.clear(); location.reload(); })
  ]);
  const state = await evalSP(() => SP.getState());
  assert(state.scanSessions.length === 0, `Expected 0 scanSessions, got ${state.scanSessions.length}`);
  assert(state.changeSets.filter(c => c.status === 'pending').length === 0, 'Expected no pending changeSets');
  assert(state.scanDiscoveries.length === 0, 'Expected no scanDiscoveries');
});

// 3. Rebind Candidate keeps Asset UUID and does not create new Asset
test('Accepting rebind-candidate keeps original Asset UUID and count', async () => {
  await freshPage();
  await resetState();
  const before = await evalSP(() => {
    SP.loadDemoScanScenario();
    return { assets: SP.getState().assets.length };
  });
  const item = await evalSP(() => {
    const cs = SP.getState().changeSets.find(c => c.status === 'pending');
    return SP.getChangeItems(cs.id).find(i => i.changeType === 'rebind-candidate');
  });
  assert(item, 'No rebind-candidate item');
  const idBefore = item.skillId;
  await evalSP(id => {
    SP.acceptChangeItem(id);
    const cs = SP.getState().changeItems.find(i => i.id === id).changeSetId;
    SP.applyChangeSet(cs);
  }, item.id);
  const after = await evalSP(() => ({ assets: SP.getState().assets.length }));
  const idAfter = await evalSP(id => SP.getState().changeItems.find(i => i.id === id).skillId, item.id);
  assert(after.assets === before.assets, `Asset count changed: ${before.assets} -> ${after.assets}`);
  assert(idAfter === idBefore, 'Asset UUID changed after rebind');
});

// 4. Update Available does not modify local file content or hash
test('Accepting update-available leaves local file content and hash unchanged', async () => {
  await freshPage();
  await resetState();
  await evalSP(() => SP.loadDemoScanScenario());
  const before = await evalSP(() => {
    const cs = SP.getState().changeSets.find(c => c.status === 'pending');
    const item = SP.getChangeItems(cs.id).find(i => i.changeType === 'update-available');
    const asset = SP.getState().assets.find(a => a.id === item.skillId);
    const inst = SP.getState().instances.find(i => i.skillId === asset.id && i.isPrimary);
    const file = SP.__test.getRawState().files.find(f => f.instanceId === inst.id && f.relativePath === 'SKILL.md');
    return { itemId: item.id, content: file.content, hash: file.contentHash, version: inst.installedVersion };
  });
  await evalSP(id => {
    SP.acceptChangeItem(id);
    const cs = SP.getState().changeItems.find(i => i.id === id).changeSetId;
    SP.applyChangeSet(cs);
  }, before.itemId);
  const after = await evalSP(id => {
    const item = SP.getState().changeItems.find(i => i.id === id);
    const asset = SP.getState().assets.find(a => a.id === item.skillId);
    const inst = SP.getState().instances.find(i => i.skillId === asset.id && i.isPrimary);
    const file = SP.__test.getRawState().files.find(f => f.instanceId === inst.id && f.relativePath === 'SKILL.md');
    const binding = SP.getState().sourceBindings.find(b => b.skillId === asset.id);
    return { content: file.content, hash: file.contentHash, version: inst.installedVersion, updateStatus: binding?.updateStatus };
  }, before.itemId);
  assert(after.content === before.content, 'Local file content changed after update-available');
  assert(after.hash === before.hash, 'Local file hash changed after update-available');
  assert(after.version === before.version, 'Installed version changed after update-available');
  assert(after.updateStatus === 'available', 'Source binding updateStatus not available');
});

// 5. Cancelled scan partial results
test('Cancelled scan has no ChangeSet until explicitly generated', async () => {
  await freshPage();
  await resetState();
  const session = await evalSP(() => {
    const s = SP.createScanSession('first-full');
    SP.startScan();
    SP.scanTick(s.id);
    SP.scanTick(s.id);
    SP.cancelScan(s.id);
    return s;
  });
  const noCs = await evalSP(() => SP.getState().changeSets.length);
  assert(noCs === 0, `Expected 0 changeSets after cancel, got ${noCs}`);
  const cs = await evalSP(id => SP.createChangeSet(id, { source: 'cancelled-partial-scan' }), session.id);
  assert(cs, 'ChangeSet not created');
  assert(cs.source === 'cancelled-partial-scan', `Expected source cancelled-partial-scan, got ${cs.source}`);
});

// 6. Checkpoint restore reverts Formal Index
test('Restore ChangeSet checkpoint reverts applied path changes', async () => {
  await freshPage();
  await resetState();
  await evalSP(() => SP.loadDemoScanScenario());
  const before = await evalSP(() => {
    const cs = SP.getState().changeSets.find(c => c.status === 'pending');
    const item = SP.getChangeItems(cs.id).find(i => i.changeType === 'path-changed');
    const asset = SP.getState().assets.find(a => a.id === item.skillId);
    const inst = SP.getState().instances.find(i => i.skillId === asset.id && i.isPrimary);
    return { itemId: item.id, path: inst.skillFilePath, changeSetId: cs.id };
  });
  await evalSP(id => {
    SP.acceptChangeItem(id);
    const cs = SP.getState().changeItems.find(i => i.id === id).changeSetId;
    SP.applyChangeSet(cs);
  }, before.itemId);
  const changed = await evalSP(id => {
    const item = SP.getState().changeItems.find(i => i.id === id);
    const asset = SP.getState().assets.find(a => a.id === item.skillId);
    const inst = SP.getState().instances.find(i => i.skillId === asset.id && i.isPrimary);
    return { path: inst.skillFilePath };
  }, before.itemId);
  assert(changed.path !== before.path, 'Path did not actually change before restore');
  await evalSP(id => SP.restoreChangeSetCheckpoint(id), before.changeSetId);
  const restored = await evalSP(id => {
    const item = SP.getState().changeItems.find(i => i.id === id);
    const asset = SP.getState().assets.find(a => a.id === item.skillId);
    const inst = SP.getState().instances.find(i => i.skillId === asset.id && i.isPrimary);
    return { path: inst.skillFilePath };
  }, before.itemId);
  assert(restored.path === before.path, `Path not restored: ${restored.path} !== ${before.path}`);
});

// 7. AuditEvent immutability from query API
test('Modifying returned AuditEvent does not affect persisted event', async () => {
  await freshPage();
  await resetState();
  const firstId = await evalSP(() => {
    const events = SP.getAuditEvents();
    if (!events.length) return null;
    events[0].note = 'TAMPERED';
    events[0].result = 'TAMPERED';
    return events[0].id;
  });
  assert(firstId, 'No audit events to test');
  const persisted = await evalSP(id => {
    const raw = JSON.parse(localStorage.getItem('sp-state-v3'));
    return raw.auditEvents.find(e => e.id === id);
  }, firstId);
  assert(persisted.note !== 'TAMPERED', 'Persisted audit event note was mutated via returned copy');
  assert(persisted.result !== 'TAMPERED', 'Persisted audit event result was mutated via returned copy');
});

// 8. Completed scan remains visible and can open ChangeSet
test('Completed scan page still shows actions and can open ChangeSet', async () => {
  await freshPage();
  await resetState();
  const sessionId = await evalSP(() => {
    const s = SP.createScanSession('first-full');
    SP.startScan();
    // Finish all steps synchronously
    while (true) {
      const cur = SP.getScanSession(s.id);
      if (!cur || !['scanning', 'idle', 'paused'].includes(cur.status)) break;
      if (!SP.scanTick(s.id)) break;
    }
    return s.id;
  });
  await page.goto(BASE + '/scan.html?session=' + sessionId + '&dev=1');
  await page.waitForLoadState('networkidle');
  const status = await page.textContent('#status-text');
  assert(status.includes('等待确认') || status.includes('部分失败'), `Expected completed status, got ${status}`);
  const btnVisible = await page.isVisible('#btn-changes');
  assert(btnVisible, 'Expected 查看变化 button after completion');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('#btn-changes')
  ]);
  assert(page.url().includes('scan-changes.html'), `Expected scan-changes.html, got ${page.url()}`);
});

// 9. Apply sets onboardingDecision even if initialized already true
test('Applying ChangeSet sets onboardingDecision to scan-applied', async () => {
  await freshPage();
  await resetState();
  const decision = await evalSP(() => {
    SP.markOnboardingComplete('scan-started');
    SP.loadDemoScanScenario();
    const cs = SP.getState().changeSets.find(c => c.status === 'pending');
    const item = SP.getChangeItems(cs.id).find(i => i.changeType === 'added');
    SP.acceptChangeItem(item.id);
    SP.applyChangeSet(cs.id);
    return SP.getState().onboardingDecision;
  });
  assert(decision === 'scan-applied', `Expected scan-applied, got ${decision}`);
});

// 10. Keep pending marks onboardingDecision
test('Keeping pending changes marks onboardingDecision pending-changes', async () => {
  await freshPage();
  await resetState();
  await evalSP(() => {
    SP.markOnboardingComplete('scan-started');
    SP.loadDemoScanScenario();
  });
  const csId = await evalSP(() => SP.getState().changeSets.find(c => c.status === 'pending').id);
  await page.goto(BASE + '/scan-changes.html?set=' + csId + '&dev=1');
  await page.waitForLoadState('networkidle');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('#btn-keep')
  ]);
  const decision = await evalSP(() => SP.getState().onboardingDecision);
  assert(decision === 'pending-changes', `Expected pending-changes, got ${decision}`);
});

async function run() {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  let passed = 0, failed = 0;
  console.log('=== Phase B.1 Targeted Tests ===\n');
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
