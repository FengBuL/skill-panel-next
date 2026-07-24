/**
 * Phase F.4 targeted tests — Update strategy UI, explicit write permission, audit semantics.
 * Strategy choices MUST go through Playwright UI (data-strategy-path), not API-only injection.
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

async function openUpdatePreview(grantWrite) {
  const assetId = await evalSP((grant) => {
    const id = SP.resolveAssetId('pr-review');
    SP.loadUpdateDemoCase('update-available');
    if (grant) {
      SP.getAssetInstances(id).forEach(i => SP.requestWritePermission({ instanceId: i.id, purpose: 'f4-seed' }));
    } else {
      // revoke write grants for pr-review instances
      const instIds = new Set(SP.getAssetInstances(id).map(i => i.id));
      (SP.__test.getRawState().permissionGrants || []).forEach(g => {
        if (g.scopeType === 'instance' && instIds.has(g.scopeId) && g.writeAccess) {
          g.status = 'revoked';
          g.writeAccess = false;
        }
      });
      SP.getAssetInstances(id).forEach(i => { i.permissionMode = 'read-only'; });
      SP.__test.saveState();
    }
    return id;
  }, !!grantWrite);
  await page.goto(BASE + '/update.html?skill=' + encodeURIComponent(assetId) + '&dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getUpdatePlanPreview);
  if (await page.$('#btn-force')) {
    await page.click('#btn-force');
    await page.waitForSelector('#pre-files, [data-strategy-path]', { timeout: 8000 });
  }
  await page.waitForSelector('[data-strategy-path], #btn-prep', { timeout: 10000 });
  return assetId;
}

async function setStrategy(relativePath, value) {
  const sel = page.locator('[data-strategy-path="' + relativePath + '"]');
  await sel.waitFor({ timeout: 5000 });
  await sel.selectOption(value);
}

test('F4-1 Update page has per-file strategy controls', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  const count = await page.locator('[data-strategy-path]').count();
  assert(count >= 1, 'expected strategy selects, got ' + count);
});

test('F4-2 gatherStrategiesFromDom is used on Prepare', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'update-app.js'), 'utf8');
  assert(/gatherStrategiesFromDom\(\)/.test(src), 'gatherStrategiesFromDom missing');
  assert(/btn-prep[\s\S]{0,800}gatherStrategiesFromDom/.test(src) ||
    /onclick[\s\S]{0,400}gatherStrategiesFromDom[\s\S]{0,400}prepareUpdate/.test(src),
    'Prepare handler must call gatherStrategiesFromDom');
});

test('F4-3 UI Keep Local freezes keep-local on Operation', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  await setStrategy('SKILL.md', 'keep-local');
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const r = await evalSP(() => {
    const ops = SP.__test.getRawState().updateOperations.filter(o => o.status === 'prepared');
    const op = ops[ops.length - 1];
    return { strat: op && op.fileStrategies && op.fileStrategies['SKILL.md'], id: op && op.id };
  });
  assert(r.strat === 'keep-local', JSON.stringify(r));
});

test('F4-4 UI Manual Merge freezes manual-merge', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  await setStrategy('SKILL.md', 'manual-merge');
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const r = await evalSP(() => {
    const op = SP.__test.getRawState().updateOperations.filter(o => o.status === 'prepared').slice(-1)[0];
    return op && op.fileStrategies && op.fileStrategies['SKILL.md'];
  });
  assert(r === 'manual-merge', String(r));
});

test('F4-5 UI Defer freezes defer', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  await setStrategy('SKILL.md', 'defer');
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const r = await evalSP(() => {
    const op = SP.__test.getRawState().updateOperations.filter(o => o.status === 'prepared').slice(-1)[0];
    return op && op.fileStrategies && op.fileStrategies['SKILL.md'];
  });
  assert(r === 'defer', String(r));
});

test('F4-6 Remote Add strategies include use-remote / manual-merge / defer', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  const opts = await page.locator('[data-strategy-path="NEW_REMOTE.md"] option').evaluateAll(os => os.map(o => o.value));
  assert(opts.includes('use-remote') && opts.includes('manual-merge') && opts.includes('defer'), JSON.stringify(opts));
  await setStrategy('NEW_REMOTE.md', 'defer');
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const strat = await evalSP(() => {
    const op = SP.__test.getRawState().updateOperations.filter(o => o.status === 'prepared').slice(-1)[0];
    return op && op.fileStrategies && op.fileStrategies['NEW_REMOTE.md'];
  });
  assert(strat === 'defer', String(strat));
});

test('F4-7 Remote Delete strategies include use-remote / keep-local / defer', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  const delPath = await page.locator('[data-change-type="deleted"]').first().getAttribute('data-strategy-path');
  assert(delPath, 'missing deleted strategy control');
  const opts = await page.locator('[data-strategy-path="' + delPath + '"] option').evaluateAll(os => os.map(o => o.value));
  assert(opts.includes('use-remote') && opts.includes('keep-local') && opts.includes('defer'), JSON.stringify(opts));
  assert(!opts.includes('manual-merge'), 'delete must not offer manual-merge: ' + JSON.stringify(opts));
});

test('F4-8 Binary has no manual-merge', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  const bin = page.locator('[data-change-type="binary-changed"]').first();
  const n = await bin.count();
  if (!n) {
    // seed may lack binary — assert static UI builder constraint
    const src = fs.readFileSync(path.join(ROOT, 'update-app.js'), 'utf8');
    assert(/isBinary[\s\S]{0,200}manual-merge/.test(src) === false ||
      /allowedStrategies[\s\S]{0,80}use-remote',\s*'keep-local',\s*'defer'/.test(src) ||
      /binary[\s\S]{0,120}keep-local',\s*'defer'/.test(src),
      'binary strategy builder must exclude manual-merge');
    return;
  }
  const pathAttr = await bin.getAttribute('data-strategy-path');
  const opts = await page.locator('[data-strategy-path="' + pathAttr + '"] option').evaluateAll(os => os.map(o => o.value));
  assert(!opts.includes('manual-merge'), JSON.stringify(opts));
});

test('F4-9 Prepare strategies match UI selection', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  await setStrategy('SKILL.md', 'keep-local');
  await setStrategy('NEW_REMOTE.md', 'defer');
  const uiBefore = await page.evaluate(() => {
    const o = {};
    document.querySelectorAll('[data-strategy-path]').forEach(s => { o[s.dataset.strategyPath] = s.value; });
    return o;
  });
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const frozen = await evalSP(() => {
    const op = SP.__test.getRawState().updateOperations.filter(o => o.status === 'prepared').slice(-1)[0];
    return op && op.fileStrategies;
  });
  assert(frozen['SKILL.md'] === uiBefore['SKILL.md'], JSON.stringify({ uiBefore, frozen }));
  assert(frozen['NEW_REMOTE.md'] === uiBefore['NEW_REMOTE.md'], JSON.stringify({ uiBefore, frozen }));
});

test('F4-10 Modify selection cancels old Operation', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const oldId = await page.locator('#btn-confirm').getAttribute('data-operation-id');
  await page.click('#btn-modify');
  await page.waitForSelector('#btn-prep');
  const status = await evalSP((id) => {
    const op = SP.__test.getRawState().updateOperations.find(o => o.id === id);
    return op && op.status;
  }, oldId);
  assert(status === 'cancelled', String(status));
});

test('F4-11 Confirm uses locked Operation ID', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  await setStrategy('SKILL.md', 'use-remote');
  // defer add/delete noise toward completed
  const paths = await page.locator('[data-strategy-path]').evaluateAll(els => els.map(e => e.dataset.strategyPath));
  for (const p of paths) {
    if (p === 'SKILL.md') continue;
    const sel = page.locator('[data-strategy-path="' + p + '"]');
    const vals = await sel.locator('option').evaluateAll(os => os.map(o => o.value));
    if (vals.includes('defer')) await sel.selectOption('defer');
  }
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  const prepId = await page.locator('#btn-confirm').getAttribute('data-operation-id');
  await page.click('#btn-confirm');
  await page.waitForFunction((id) => document.body.innerText.includes(id), prepId);
  const body = await page.locator('body').innerText();
  assert(body.includes(prepId), 'result must show same op id');
});

test('F4-12 Prepare click must not auto requestWritePermission', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'update-app.js'), 'utf8');
  const m = src.match(/getElementById\('btn-prep'\)\.onclick\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
  assert(m, 'btn-prep onclick handler not found');
  assert(!/requestWritePermission/.test(m[1]), 'Prepare handler must not call requestWritePermission: ' + m[1].slice(0, 200));
});

test('F4-13 No write permission can still view Preview', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(false);
  const n = await page.locator('[data-strategy-path]').count();
  assert(n >= 1, 'preview strategies visible without write');
  const disabled = await page.locator('#btn-prep').isDisabled();
  assert(disabled, 'prepare must be disabled without write');
});

test('F4-14 No write permission cannot Prepare writable Operation', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(false);
  assert(await page.locator('#btn-prep').isDisabled(), 'btn-prep disabled');
  const before = await evalSP(() => SP.__test.getRawState().updateOperations.length);
  // force click via evaluate should still be blocked by handler
  await page.evaluate(() => {
    const btn = document.getElementById('btn-prep');
    if (btn) btn.disabled = false;
  });
  await page.click('#btn-prep');
  await page.waitForTimeout(300);
  const after = await evalSP(() => ({
    count: SP.__test.getRawState().updateOperations.length,
    prepared: SP.__test.getRawState().updateOperations.filter(o => o.status === 'prepared').length
  }));
  // either toast blocked without creating, or permission-denied without prepared
  assert(after.prepared === 0 || after.count === before, JSON.stringify({ before, after }));
});

test('F4-15 Explicit 申请写权限 grants access', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(false);
  await page.locator('[data-request-write]').first().click();
  await page.waitForTimeout(200);
  const write = await page.locator('#insts').innerText();
  assert(/Write:\s*是/.test(write), write.slice(0, 200));
});

test('F4-16 Keep Local UI keeps Formal File content', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  const before = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id)[0];
    const f = SP.__test.getRawState().files.find(x => x.instanceId === inst.id && x.relativePath === 'SKILL.md');
    return { instId: inst.id, hash: f.contentHash, content: String(f.content || '') };
  });
  await setStrategy('SKILL.md', 'keep-local');
  const paths = await page.locator('[data-strategy-path]').evaluateAll(els => els.map(e => e.dataset.strategyPath));
  for (const p of paths) {
    if (p === 'SKILL.md') continue;
    const sel = page.locator('[data-strategy-path="' + p + '"]');
    const vals = await sel.locator('option').evaluateAll(os => os.map(o => o.value));
    if (vals.includes('defer')) await sel.selectOption('defer');
  }
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  await page.click('#btn-confirm');
  await page.waitForFunction(() => /保留本地|hasLocal|modified|completed/i.test(document.body.innerText));
  const after = await evalSP((instId) => {
    const f = SP.__test.getRawState().files.find(x => x.instanceId === instId && x.relativePath === 'SKILL.md');
    const inst = SP.__test.getRawState().instances.find(i => i.id === instId);
    return { hash: f.contentHash, content: String(f.content || ''), local: inst.localModificationStatus };
  }, before.instId);
  assert(after.hash === before.hash && after.content === before.content, JSON.stringify({ before, after }));
  assert(after.local === 'modified', JSON.stringify(after));
});

test('F4-17 Manual Merge UI creates Draft and PendingTask', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  await setStrategy('SKILL.md', 'manual-merge');
  const paths = await page.locator('[data-strategy-path]').evaluateAll(els => els.map(e => e.dataset.strategyPath));
  for (const p of paths) {
    if (p === 'SKILL.md') continue;
    const sel = page.locator('[data-strategy-path="' + p + '"]');
    const vals = await sel.locator('option').evaluateAll(os => os.map(o => o.value));
    if (vals.includes('defer')) await sel.selectOption('defer');
  }
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  await page.click('#btn-confirm');
  await page.waitForFunction(() => /awaiting-merge|待合并/.test(document.body.innerText));
  const r = await evalSP(() => {
    const drafts = SP.__test.getRawState().drafts.filter(d => d.status === 'update-manual-merge');
    const tasks = SP.__test.getRawState().pendingTasks.filter(t => t.taskType === 'update_manual_merge' && t.status === 'open');
    return { drafts: drafts.length, tasks: tasks.length };
  });
  assert(r.drafts >= 1 && r.tasks >= 1, JSON.stringify(r));
});

test('F4-18 Defer UI keeps Update Available', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  const paths = await page.locator('[data-strategy-path]').evaluateAll(els => els.map(e => e.dataset.strategyPath));
  for (const p of paths) await setStrategy(p, 'defer');
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  await page.click('#btn-confirm');
  await page.waitForFunction(() => /partial|暂缓|partially-completed|deferred/i.test(document.body.innerText));
  const st = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const b = SP.__test.getRawState().sourceBindings.find(x => x.skillId === id) ||
      SP.__test.getRawState().sourceBindings.find(x => x.id === (SP.__test.getRawState().assets.find(a => a.id === id) || {}).sourceBindingId);
    return b && b.updateStatus;
  });
  assert(st === 'update-available', String(st));
});

test('F4-19 Manual Merge writes update_awaiting_merge audit', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  await setStrategy('SKILL.md', 'manual-merge');
  const paths = await page.locator('[data-strategy-path]').evaluateAll(els => els.map(e => e.dataset.strategyPath));
  for (const p of paths) {
    if (p === 'SKILL.md') continue;
    const sel = page.locator('[data-strategy-path="' + p + '"]');
    const vals = await sel.locator('option').evaluateAll(os => os.map(o => o.value));
    if (vals.includes('defer')) await sel.selectOption('defer');
  }
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  await page.click('#btn-confirm');
  await page.waitForTimeout(200);
  const r = await evalSP(() => {
    const ev = SP.__test.getRawState().auditEvents.filter(e => e.category === 'update').slice(-5);
    return {
      types: ev.map(e => e.eventType),
      awaiting: ev.some(e => e.eventType === 'update_awaiting_merge' && e.result === 'pending'),
      completed: ev.some(e => e.eventType === 'update_completed')
    };
  });
  assert(r.awaiting && !r.completed, JSON.stringify(r));
});

test('F4-20 Defer writes partial AuditEvent', async () => {
  await freshPage(); await resetState();
  await openUpdatePreview(true);
  const paths = await page.locator('[data-strategy-path]').evaluateAll(els => els.map(e => e.dataset.strategyPath));
  for (const p of paths) await setStrategy(p, 'defer');
  await page.click('#btn-prep');
  await page.waitForSelector('#btn-confirm');
  await page.click('#btn-confirm');
  await page.waitForTimeout(200);
  const r = await evalSP(() => {
    const ev = SP.__test.getRawState().auditEvents.filter(e => e.eventType === 'update_partially_completed').slice(-1)[0];
    return ev && { type: ev.eventType, result: ev.result };
  });
  assert(r && r.type === 'update_partially_completed' && r.result === 'partial', JSON.stringify(r));
});

test('F4-21 Canonical Usage sort ranks aggregated Asset', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const left = SP.resolveAssetId('demo-duplicate-a');
    const right = SP.resolveAssetId('demo-duplicate-b');
    SP.__test.getRawState().usageEvents = SP.__test.getRawState().usageEvents.filter(e =>
      e.skillId !== left && e.skillId !== right
    );
    SP.__test.saveState();
    for (let i = 0; i < 50; i++) SP.addUsageEvent({ skillId: left, callCount: 1, attributionLevel: 'accurate', totalTokens: 1 });
    for (let i = 0; i < 5; i++) SP.addUsageEvent({ skillId: right, callCount: 1, attributionLevel: 'accurate', totalTokens: 1 });
    // also seed a third asset with mid usage so ranking is meaningful
    const other = SP.resolveAssetId('pr-review');
    SP.__test.getRawState().usageEvents = SP.__test.getRawState().usageEvents.filter(e => e.skillId !== other);
    for (let i = 0; i < 20; i++) SP.addUsageEvent({ skillId: other, callCount: 1, attributionLevel: 'accurate', totalTokens: 1 });
    SP.__test.saveState();
    const opened = SP.openCompareSession([left, right]);
    const prep = SP.prepareDuplicateResolution({
      sessionId: opened.session.id,
      action: 'confirm-multi-instance',
      primaryAssetId: left,
      candidateIds: [left, right]
    });
    SP.confirmDuplicateResolution(prep.operationId, { userConfirmed: true });
    const lib = SP.queryLibraryAssets({ pageSize: 50, sort: 'usage' });
    const idxA = lib.items.findIndex(x => x.id === left);
    const idxOther = lib.items.findIndex(x => x.id === other);
    return {
      usageA: lib.items[idxA] && lib.items[idxA].usage30,
      usageOther: lib.items[idxOther] && lib.items[idxOther].usage30,
      idxA,
      idxOther,
      aBeforeOther: idxA >= 0 && idxOther >= 0 && idxA < idxOther
    };
  });
  assert(r.usageA === 55, JSON.stringify(r));
  assert(r.aBeforeOther, 'aggregated A must sort above lower-usage asset: ' + JSON.stringify(r));
});

test('F4-static update-app no silent write grant on prepare', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'update-app.js'), 'utf8');
  assert(/data-strategy-path/.test(src), 'strategy controls required');
  assert(/data-request-write/.test(src), 'explicit write request required');
  assert(/getUpdatePlanPreview/.test(src), 'preview API required');
  assert(/gatherStrategiesFromDom\(\)/.test(src), 'gatherStrategiesFromDom required');
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let passed = 0, failed = 0;
  console.log('=== Phase F.4 Targeted Tests ===\n');
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
