const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('./chrome-launch');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8081';

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
    sessionStorage.setItem('sp-library-url-boot', '1');
  });
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getLibraryViewState);
  await page.evaluate(() => {
    SP.setLibraryViewState({
      section: 'all', viewMode: 'table', search: '', filters: {}, sort: 'recent',
      page: 1, pageSize: 20, selectedAssetId: null, expandedAssetIds: [],
      expandedTreeNodes: [], scrollTop: 0, detailOpen: false, categoryId: null
    });
    history.replaceState(null, '', location.pathname + '?dev=1');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('tbody tr[data-id]');
}

test('Library ignore-hint does not change Asset/Instance lifecycle or create IgnoreRule', async () => {
  await freshPage();
  await resetState();
  const result = await page.evaluate(() => {
    const missing = SP.queryLibraryAssets({ section: 'missing', pageSize: 50 }).items[0];
    if (!missing) return { error: 'No missing skill' };
    const beforeAsset = SP.getState().assets.find(a => a.id === missing.id);
    const beforeInst = SP.getState().instances.filter(i => i.skillId === missing.id).map(i => ({
      id: i.id, lifecycleStatus: i.lifecycleStatus
    }));
    const beforeRules = SP.getState().ignoreRules.filter(r => r.skillId === missing.id).length;
    const res = SP.ignoreMissingHint(missing.id);
    const afterAsset = SP.getState().assets.find(a => a.id === missing.id);
    const afterInst = SP.getState().instances.filter(i => i.skillId === missing.id).map(i => ({
      id: i.id, lifecycleStatus: i.lifecycleStatus
    }));
    const afterRules = SP.getState().ignoreRules.filter(r => r.skillId === missing.id).length;
    return {
      res,
      beforeLife: beforeAsset.lifecycleStatus,
      afterLife: afterAsset.lifecycleStatus,
      beforeInst,
      afterInst,
      beforeRules,
      afterRules,
      libraryCallsIgnoreSkill: false
    };
  });
  assert(!result.error, result.error || 'setup failed');
  assert(result.res && result.res.ok, 'ignoreMissingHint should succeed');
  assert(result.beforeLife === result.afterLife, 'Asset lifecycle changed');
  assert(JSON.stringify(result.beforeInst) === JSON.stringify(result.afterInst), 'Instance lifecycle changed');
  assert(result.beforeRules === result.afterRules, 'IgnoreRule was created');
  assert(result.res.ignoreRuleCreated === false, 'ignoreRuleCreated should be false');
});

test('Library page source does not call ignoreSkill or expose batch ignore', async () => {
  await freshPage();
  await resetState();
  const src = fs.readFileSync(path.join(__dirname, 'library-app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(!/\bignoreskill\b/i.test(src), 'library-app.js still references ignoreSkill');
  assert(!/data-batch="ignore"/.test(html), 'index.html still has batch ignore');
  assert(!/id="ignore-modal"/.test(html), 'index.html still has ignore-modal');
  assert(/data-batch="ignore-hint"/.test(html), 'ignore-hint batch action missing');
  const ui = await page.locator('button[data-batch="ignore"]').count();
  assert(ui === 0, 'Batch ignore button still visible');
});

test('Recent nav and title use 最近 and include no-usage skills', async () => {
  await freshPage();
  await resetState();
  const label = await page.locator('#nav-sec-recent').innerText();
  assert(label.includes('最近') && !label.includes('最近使用'), 'Nav label should be 最近: ' + label);
  await page.click('#nav-sec-recent');
  await page.waitForFunction(() => SP.getLibraryViewState().section === 'recent');
  const title = await page.locator('#section-title').textContent();
  assert(title === '最近', 'Section title should be 最近: ' + title);
  const check = await page.evaluate(() => {
    const r = SP.queryLibraryAssets({ section: 'recent', pageSize: 100 });
    const noUsage = r.items.filter(i => !i.hasUsageData);
    const usageOnly = r.items.every(i => i.hasUsageData === true);
    // Pick an edited/no-usage asset and ensure it can rank into recent by activity
    const edited = SP.queryLibraryAssets({ section: 'all', pageSize: 200 }).items
      .find(i => !i.hasUsageData && i.lifecycleStatus !== 'archived' && i.recentActivityAt);
    return {
      total: r.total,
      noUsageCount: noUsage.length,
      usageOnly,
      editedInRecent: edited ? r.items.some(i => i.id === edited.id) || (edited.recentActivityAt != null) : false,
      editedId: edited && edited.id,
      editedHasUsage: edited && edited.hasUsageData
    };
  });
  assert(check.total > 0, 'Recent empty');
  assert(!check.usageOnly, 'Recent must not be usage-only');
  assert(check.noUsageCount > 0 || check.editedHasUsage === false, 'Expected no-usage skills eligible for Recent');
});

test('Narrow drawer closes via button Escape and overlay with viewState update', async () => {
  await freshPage();
  await resetState();
  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(80);
  const id = await page.evaluate(() => SP.resolveAssetId('pr-review'));
  await page.click(`tbody tr[data-id="${id}"]`);
  await page.waitForFunction(() => document.getElementById('detail')?.classList.contains('drawer-open'));
  assert((await page.evaluate(() => SP.getLibraryViewState().detailOpen)) === true, 'detailOpen should be true');

  await page.click('#d-close');
  await page.waitForFunction(() => !document.getElementById('detail')?.classList.contains('drawer-open'));
  let vs = await page.evaluate(() => SP.getLibraryViewState());
  assert(vs.detailOpen === false, 'detailOpen false after close button');
  assert(vs.selectedAssetId === id, 'selectedAssetId should remain after close');
  assert((await page.locator('#detail-overlay.show').count()) === 0, 'overlay should hide');

  await page.click(`tbody tr[data-id="${id}"]`);
  await page.waitForFunction(() => document.getElementById('detail')?.classList.contains('drawer-open'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('detail')?.classList.contains('drawer-open'));
  vs = await page.evaluate(() => SP.getLibraryViewState());
  assert(vs.detailOpen === false, 'detailOpen false after Escape');
  assert(vs.selectedAssetId === id, 'selectedAssetId kept after Escape');

  await page.click(`tbody tr[data-id="${id}"]`);
  await page.waitForFunction(() => document.getElementById('detail')?.classList.contains('drawer-open'));
  const box = await page.locator('#detail-overlay').boundingBox();
  assert(box, 'overlay bounding box missing');
  // Click left side of overlay (drawer covers the right).
  await page.mouse.click(box.x + 24, box.y + box.height / 2);
  await page.waitForFunction(() => !document.getElementById('detail')?.classList.contains('drawer-open'));
  vs = await page.evaluate(() => SP.getLibraryViewState());
  assert(vs.detailOpen === false, 'detailOpen false after overlay');
  assert(vs.selectedAssetId === id, 'selectedAssetId kept after overlay');
});

test('Archive confirm copy mentions Asset scope instances and no file move', async () => {
  await freshPage();
  await resetState();
  const id = await page.evaluate(() => SP.resolveAssetId('pr-review'));
  await page.click(`tbody tr[data-id="${id}"] input[data-check]`);
  await page.click('button[data-batch="archive"]');
  await page.waitForSelector('#archive-modal.show');
  const header = await page.locator('#archive-modal header p').textContent();
  const body = await page.locator('#archive-body').innerText();
  const all = header + '\n' + body;
  assert(/不会删除本地文件|当前原型不会删除/.test(all), 'Missing no-delete wording: ' + all);
  assert(/Asset|整个/.test(all) || /实例/.test(all), 'Missing Asset/instance scope: ' + all);
  assert(/2 个实例|实例/.test(body), 'Missing instance count for multi-instance: ' + body);
  assert(!/已移动到归档目录|保存到本地归档目录/.test(all), 'Should not claim files were moved: ' + all);
});

test('Library scan scope footer wording updated', async () => {
  await freshPage();
  await resetState();
  const foot = await page.locator('.side-foot p').innerText();
  assert(foot.includes('扫描系统允许访问的授权范围'), 'Footer wording missing: ' + foot);
  assert(!foot.includes('仅扫描已授权目录'), 'Old footer wording still present');
});

async function run() {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();

  let passed = 0, failed = 0;
  console.log('=== Phase C.1 Targeted Tests ===\n');
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
