const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('./chrome-launch');

const BASE = 'http://localhost:8081';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

let browser, context, page;

async function run() {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();

  // Ensure fresh seed state; dev=1 bypasses first-launch onboarding redirect.
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('sp-dev', '1');
  });
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && document.querySelector('tbody tr[data-id], #not-found, .empty'));

  let passed = 0, failed = 0;
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

test('Library page renders skill list', async () => {
  await page.goto(BASE + '/index.html?dev=1');
  await page.waitForLoadState('networkidle');
  const count = await page.textContent('#nav-lib-count');
  if (parseInt(count) < 1) throw new Error('Expected active skills count > 0');
  const rows = await page.locator('tbody tr[data-id]').count();
  if (rows < 1) throw new Error('Expected table rows');
});

test('Insights page renders archive candidates', async () => {
  await page.goto(BASE + '/insights.html?dev=1');
  await page.waitForLoadState('networkidle');
  const count = await page.textContent('#sum-archive');
  if (parseInt(count) < 1) throw new Error('Expected archive candidates');
  const itemCount = await page.locator('#panel-archive .item').count();
  if (itemCount < 1) throw new Error('Expected archive items');
});

test('Skill detail page renders known skill', async () => {
  await page.goto(BASE + '/skill-detail.html?skill=pr-review&dev=1');
  await page.waitForLoadState('networkidle');
  const title = await page.textContent('#title');
  if (!title.includes('PR Review')) throw new Error('Unexpected title: ' + title);
  const path = await page.textContent('#path-text');
  if (!path.includes('pr-review')) throw new Error('Unexpected path');
});

test('Skill detail page shows not found for unknown skill', async () => {
  await page.goto(BASE + '/skill-detail.html?skill=not-exist&dev=1');
  await page.waitForLoadState('networkidle');
  const visible = await page.locator('#not-found').isVisible();
  if (!visible) throw new Error('Not found block should be visible');
});

test('Skill editor loads and shows external conflict flow', async () => {
  await page.goto(BASE + '/index.html?dev=1');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    localStorage.setItem('sp-dev', '1');
    SP.resetState();
  });
  const url = await page.evaluate(() => {
    // Prefer a skill with unfinished draft / external conflict demo if present
    let id = SP.resolveAssetId('demo-external-conflict') || SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.lifecycleStatus !== 'missing') || SP.getAssetInstances(id)[0];
    if (!inst) throw new Error('no instance');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e2e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    if (!s.ok) throw new Error(s.blockedReason || 'session');
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const cur = SP.getEditorFileContent(s.id, skill.id).content || '---\nname: x\n---\n\n';
    SP.saveEditorDraft(s.id, skill.id, cur + '\nE2E_DRAFT\n');
    SP.loadEditorDemoCase('external-content');
    return 'skill-editor.html?skill=' + encodeURIComponent(id) + '&session=' + encodeURIComponent(s.id) + '&dev=1';
  });
  await page.goto(BASE + '/' + url);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#editor');
  await page.click('#btn-apply');
  // Either apply modal then conflict redirect, or direct conflict
  await page.waitForTimeout(500);
  const onConflict = page.url().includes('conflict.html');
  if (!onConflict) {
    await page.waitForSelector('#apply-modal.show', { timeout: 5000 });
    await page.click('#apply-confirm');
    await page.waitForURL(/conflict\.html/, { timeout: 8000 });
  }
  await page.waitForSelector('#btn-keep');
  await page.click('#btn-keep');
  await page.waitForURL(/skill-editor\.html/, { timeout: 8000 });
});

test('New skill flow creates skill and redirects to editor', async () => {
  await page.goto(BASE + '/new-skill.html?dev=1');
  await page.waitForLoadState('networkidle');
  await page.fill('#name', 'test-created-skill');
  await page.fill('#display', 'Test Created');
  await page.fill('#description', 'Created via Playwright test');
  await page.click('#btn-create');
  await page.waitForURL(/skill-editor\.html\?skill=.*/, { timeout: 8000 });
  await page.waitForSelector('#skill-name, #file-name');
  const name = await page.locator('#skill-name, #file-name').first().textContent();
  if (!/Test Created|test-created-skill/i.test(name)) throw new Error('Unexpected editor title: ' + name);
});

test('Activity page renders pending and history tabs', async () => {
  await page.goto(BASE + '/activity.html?dev=1');
  await page.waitForLoadState('networkidle');
  const rows = await page.locator('#tbody tr[data-id]').count();
  if (rows < 1) throw new Error('Expected activity rows');
  await page.click('button[data-subview="history"]');
  await page.waitForTimeout(200);
  // history may have rows or empty state; just ensure no error
  await page.locator('#tbody').isVisible();
});

test('Settings page renders and toggles a setting', async () => {
  await page.goto(BASE + '/settings.html?dev=1');
  await page.waitForLoadState('networkidle');
  const section = await page.locator('#sec-dirs.active').count();
  if (section !== 1) throw new Error('Dirs section should be active');
  // Toggle a switch
  const sw = page.locator('[data-setting="scanSubdirectories"]').first();
  const before = await sw.evaluate(el => el.classList.contains('on'));
  await sw.click();
  await page.waitForTimeout(200);
  const after = await sw.evaluate(el => el.classList.contains('on'));
  if (after === before) throw new Error('Switch did not toggle');
});

test('Compare page renders duplicate pair', async () => {
  await page.goto(BASE + '/compare.html?left=release-notes&right=changelog-zh&group=A&dev=1');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#compare .col h2, #compare-grid .sp-compare-card h2', { timeout: 10000 });
  const left = await page.locator('#compare .col h2, #compare-grid .sp-compare-card h2').first().textContent();
  if (!left) throw new Error('Left column missing');
  const right = await page.locator('#compare .col h2, #compare-grid .sp-compare-card h2').nth(1).textContent();
  if (!right) throw new Error('Right column missing');
});

test('Add existing page validates path', async () => {
  await page.goto(BASE + '/add-existing.html?dev=1');
  await page.waitForLoadState('networkidle');
  await page.fill('#path-input', '~/Projects/skills/imported-test/SKILL.md');
  await page.click('#btn-validate');
  await page.waitForSelector('#step2-card:not(.hidden)', { timeout: 3000 });
});

test('Cross-page origin is saved from Library to Detail', async () => {
  await page.goto(BASE + '/index.html?dev=1');
  await page.waitForLoadState('networkidle');
  const row = page.locator('tbody tr:has-text("PR Review")').first();
  await row.click();
  await page.click('#d-open');
  await page.waitForURL(/skill-detail\.html\?skill=/);
  const backHref = await page.getAttribute('#btn-back', 'href');
  if (backHref !== 'index.html') throw new Error('Back href should be index.html, got ' + backHref);
});

run();
