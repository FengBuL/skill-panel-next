/**
 * Phase F.0 integration gate tests
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
  await page.waitForFunction(() => window.SP && SP.__test);
  await page.evaluate(() => SP.resetState());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.__test);
}
async function evalSP(fn, ...args) { return page.evaluate(fn, ...args); }

function findBodyKeys(obj, pathPrefix, out) {
  if (obj == null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => findBodyKeys(v, pathPrefix + '[' + i + ']', out));
    return;
  }
  const banned = ['content', 'contentForView', 'skillFileContent', 'baseContent', 'currentContent', 'draftContent', '_baseContent', 'remoteContent', 'localContent'];
  Object.keys(obj).forEach(k => {
    const p = pathPrefix ? pathPrefix + '.' + k : k;
    if (banned.includes(k) && obj[k] != null && obj[k] !== '') out.push(p);
    findBodyKeys(obj[k], p, out);
  });
}

test('F0-1 Public State does not leak Conflict bodies', async () => {
  await freshPage(); await resetState();
  const leaks = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'f0' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.0.0\n---\n\nDRAFT\n');
    SP.loadEditorDemoCase('external-content');
    SP.prepareApplyChanges(s.id);
    const st = SP.getState();
    const out = [];
    (st.conflicts || []).forEach((c, i) => {
      (c.files || []).forEach((f, j) => {
        ['baseContent', 'currentContent', 'draftContent'].forEach(k => {
          if (f[k] != null) out.push('conflicts[' + i + '].files[' + j + '].' + k);
        });
      });
    });
    return out;
  });
  assert(leaks.length === 0, JSON.stringify(leaks));
});

test('F0-2 Public State does not leak ScanDiscovery bodies', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    SP.createScanSession();
    SP.startScan();
    // force a few ticks
    for (let i = 0; i < 30; i++) SP.scanTick();
    const st = SP.getState();
    const out = [];
    (st.scanDiscoveries || []).forEach((d, i) => {
      if (d.skillFileContent != null) out.push('scanDiscoveries[' + i + '].skillFileContent');
      (d.files || []).forEach((f, j) => {
        if (f.content != null) out.push('scanDiscoveries[' + i + '].files[' + j + '].content');
      });
    });
    // recursive check on key collections
    function walk(obj, p, acc) {
      if (!obj || typeof obj !== 'object') return;
      const banned = ['content', 'skillFileContent', 'baseContent', 'currentContent', 'draftContent'];
      if (Array.isArray(obj)) { obj.forEach((v, i) => walk(v, p + '[' + i + ']', acc)); return; }
      Object.keys(obj).forEach(k => {
        if (banned.includes(k) && obj[k] != null && String(obj[k]).length) acc.push(p + '.' + k);
        walk(obj[k], p + '.' + k, acc);
      });
    }
    ['files', 'snapshots', 'drafts', 'conflicts', 'scanDiscoveries'].forEach(key => walk(st[key], key, out));
    return { out, discoveryCount: (st.scanDiscoveries || []).length };
  });
  assert(r.out.length === 0, JSON.stringify(r.out));
});

test('F0-3 sp-dev does not open test mode via Editor navigation', async () => {
  await freshPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('sp-dev', '1');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.openSkillEditor);
  const hasTest = await page.evaluate(() => !!SP.__test);
  assert(!hasTest, '__test should not exist with only sp-dev');
  await page.evaluate(() => {
    // Avoid navigation side effects by inspecting URL builder via temporary override
    const rid = SP.resolveAssetId('pr-review');
    const orig = location.href;
    let captured = null;
    const realAssign = Object.getOwnPropertyDescriptor(Location.prototype, 'href') || null;
    // Call openSkillEditor but intercept by stubbing location.href setter is hard; instead check appendTestModeParam
    const url = SP.appendTestModeParam('skill-editor.html?skill=' + encodeURIComponent(rid));
    return { url, testMode: SP.isTestMode(), bypass: SP.isDevNavigationBypass() };
  });
  const r = await page.evaluate(() => {
    const rid = SP.resolveAssetId('pr-review');
    return {
      url: SP.appendTestModeParam('skill-editor.html?skill=' + encodeURIComponent(rid)),
      testMode: SP.isTestMode(),
      bypass: SP.isDevNavigationBypass(),
      hasTest: !!SP.__test
    };
  });
  assert(r.bypass && !r.testMode && !r.hasTest, JSON.stringify(r));
  assert(!/[?&]dev=1/.test(r.url), 'appendTestModeParam added dev with only sp-dev: ' + r.url);

  // Click path: open editor from library should not add ?dev=1
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('sp-dev', '1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('tbody tr[data-id]', { timeout: 10000 });
  const nav = page.waitForURL(/skill-editor\.html/, { timeout: 10000 });
  await page.evaluate(() => {
    const id = SP.resolveAssetId('pr-review');
    SP.openSkillEditor(id, { mode: 'read-only' });
  });
  await nav;
  const url = page.url();
  assert(!/[?&]dev=1(?:&|$)/.test(url), 'Editor URL has dev=1 from sp-dev: ' + url);
  const stillNoTest = await page.evaluate(() => !!window.SP && !!SP.__test);
  assert(!stillNoTest, 'SP.__test appeared without ?dev=1');
});

test('F0-4 Scan discard results has no runtime error', async () => {
  await freshPage(); await resetState();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const before = await evalSP(() => ({
    assets: SP.__test.getRawState().assets.length,
    files: SP.__test.getRawState().files.length
  }));
  const sessionId = await evalSP(() => {
    const s = SP.createScanSession();
    SP.startScan();
    for (let i = 0; i < 20; i++) SP.scanTick();
    return s.id || (SP.getActiveScanSession() && SP.getActiveScanSession().id);
  });
  await page.goto(BASE + '/scan.html?session=' + encodeURIComponent(sessionId) + '&dev=1', { waitUntil: 'networkidle' });
  // Cancel if possible then discard
  const hasCancel = await page.$('#btn-cancel');
  if (hasCancel) {
    await page.click('#btn-cancel').catch(() => {});
    await page.waitForTimeout(200);
  }
  // Open discard modal if present
  const discardBtn = await page.$('#btn-discard, [data-action="discard"], #discard-open');
  // Directly trigger discard-ok path via evaluate for reliability
  await page.evaluate(sid => {
    const modal = document.getElementById('discard-modal');
    if (modal) {
      modal.dataset.sessionId = sid;
      document.getElementById('discard-ok').click();
    } else {
      SP.discardScanSession(sid);
      location.href = 'index.html';
    }
  }, sessionId);
  await page.waitForURL(/index\.html/, { timeout: 8000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    assets: SP.__test ? SP.__test.getRawState().assets.length : SP.getState().assets.length,
    files: SP.__test ? SP.__test.getRawState().files.length : SP.getState().files.length,
    url: location.href
  }));
  // Need ?dev=1 for __test on library after discard - discard goes to index.html without dev
  assert(errors.length === 0, 'page errors: ' + errors.join('; '));
  assert(/index\.html/.test(after.url), 'did not return to library');
});

test('F0-4b Formal Index unchanged after discard', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const before = {
      assets: SP.__test.getRawState().assets.length,
      instances: SP.__test.getRawState().instances.length,
      files: SP.__test.getRawState().files.length
    };
    const s = SP.createScanSession();
    SP.startScan();
    for (let i = 0; i < 25; i++) SP.scanTick();
    const sid = s.id || SP.getActiveScanSession().id;
    SP.discardScanSession(sid);
    const after = {
      assets: SP.__test.getRawState().assets.length,
      instances: SP.__test.getRawState().instances.length,
      files: SP.__test.getRawState().files.length
    };
    return { before, after };
  });
  assert(r.before.assets === r.after.assets && r.before.instances === r.after.instances && r.before.files === r.after.files, JSON.stringify(r));
});

test('F0-5 Cases IDs align with Seed', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const ids = ['demo-normal', 'demo-codex', 'demo-archive-candidate', 'demo-external-conflict', 'demo-yaml-error', 'demo-path-missing', 'demo-permission-denied', 'demo-archived', 'demo-scan-ignored', 'demo-duplicate-a', 'demo-draft', 'demo-empty-content'];
    return ids.map(id => ({ id, ok: !!SP.resolveAssetId(id) && !!SP.getSkill(id) }));
  });
  const missing = r.filter(x => !x.ok);
  assert(missing.length === 0, JSON.stringify(missing));
  const casesSrc = fs.readFileSync(path.join(ROOT, 'cases.html'), 'utf8');
  assert(!/demo-ignored/.test(casesSrc) || /demo-scan-ignored/.test(casesSrc), 'old demo-ignored present');
  assert(!/已忽略 Skill/.test(casesSrc), 'ignored skill lifecycle remains');
});

test('F0-6 Archive copy does not claim file moves', async () => {
  const files = ['cases.html', 'insights.html', 'settings.html', 'skill-detail-app.js'];
  const joined = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  assert(!/保存到本地归档目录/.test(joined), 'claims save to archive directory');
  assert(!/选择恢复目录/.test(joined) || /不提供选择恢复目录|不选择恢复目录/.test(joined), 'claims restore directory selection');
  assert(/不移动/.test(joined) || /管理生命周期/.test(joined), 'missing archive semantics');
});

test('F0-7 Phase2-style partial failure produces failed', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    SP.loadDemoScanScenario();
    const raw = SP.__test.getRawState();
    const cs = raw.changeSets.find(c => c.status === 'pending');
    if (!cs) return { step: 'no-cs', sets: raw.changeSets.map(c => c.status), sessions: raw.scanSessions.length, discoveries: raw.scanDiscoveries.length, items: raw.changeItems.length };
    const items = raw.changeItems.filter(i => i.changeSetId === cs.id).slice(0, 2);
    if (items.length < 2) return { step: 'few-items', n: items.length, totalItems: raw.changeItems.length, csId: cs.id };
    items.forEach(i => SP.acceptChangeItem(i.id));
    SP.__test.patchRawState(state => {
      const item = state.changeItems.find(x => x.id === items[0].id);
      const d = state.scanDiscoveries.find(x => x.id === item.discoveryId);
      if (d) d.skillFileContent = null;
    });
    const res = SP.applyChangeSet(cs.id);
    return {
      ok: res.ok,
      status: res.changeSet && res.changeSet.status,
      failed: (res.results || []).filter(x => !x.ok).length,
      passed: (res.results || []).filter(x => x.ok).length,
      total: (res.results || []).length
    };
  });
  assert(r.total >= 2 && r.failed >= 1 && r.passed >= 1, JSON.stringify(r));
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let passed = 0, failed = 0;
  console.log('=== Phase F.0 Targeted Tests ===\n');
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
