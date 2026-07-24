const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('./chrome-launch');

const BASE = 'http://localhost:8081';

let browser, context, page;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function lsState() {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('sp-state-v3');
    return raw ? JSON.parse(raw) : null;
  });
}

function findAsset(state, predicate) {
  return state.assets.find(predicate);
}

function findAssetByName(state, name) {
  return state.assets.find(a => a.name === name);
}

async function clearState() {
  await page.goto(BASE + '/index.html?dev=1');
  await page.waitForLoadState('networkidle');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.evaluate(() => { localStorage.clear(); localStorage.setItem('sp-dev', '1'); location.reload(); })
  ]);
}

async function run() {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();

  console.log('=== Walkthrough: 6 core flows ===\n');
  let passed = 0, failed = 0;

  // Flow 1: Create -> Editor -> Apply -> Library
  try {
    await clearState();
    await page.goto(BASE + '/new-skill.html?dev=1');
    await page.waitForLoadState('networkidle');
    await page.fill('#name', 'walkthrough-new-skill');
    await page.fill('#display', 'Walkthrough New Skill');
    await page.fill('#description', 'Created during walkthrough');
    await page.click('#btn-create');
    await page.waitForURL(/skill-editor\.html\?skill=.*/, { timeout: 8000 });
    await page.waitForSelector('#editor:not([readonly]):not([disabled])', { timeout: 8000 });

    const url = page.url();
    const skillId = new URL(url).searchParams.get('skill');

    await page.fill('#editor', await page.inputValue('#editor') + '\n## Walkthrough\n- verified');
    await page.waitForTimeout(800);

    await page.click('#btn-apply');
    await page.waitForSelector('#apply-modal.show', { timeout: 5000 });
    await page.click('#apply-confirm');
    await page.waitForSelector('#apply-modal.show', { state: 'hidden', timeout: 8000 });

    const state1 = await lsState();
    const skill = findAsset(state1, a => a.id === skillId);
    assert(skill && skill.lifecycleStatus === 'available', 'Skill should be available after apply');
    assert(!state1.drafts.find(d => d.skillId === skillId), 'Draft should be cleared');
    assert(
      state1.auditEvents.some(a => (a.eventType === 'apply_change' || a.eventType === 'apply_completed') && a.skillId === skillId),
      'apply activity missing'
    );

    await page.goto(BASE + '/index.html?dev=1');
    await page.waitForLoadState('networkidle');
    const row = await page.locator('tbody tr[data-id="' + skillId + '"]').count();
    assert(row === 1, 'New skill should appear in Library');

    console.log('✅ Flow 1: Create -> Editor -> Apply -> Library');
    passed++;
  } catch (e) {
    console.log('❌ Flow 1:', e.message);
    failed++;
  }

  // Flow 2: Insights archive -> restore
  try {
    await clearState();
    await page.goto(BASE + '/insights.html');
    await page.waitForLoadState('networkidle');
    const first = await page.locator('#panel-archive .item').first();
    const title = await first.locator('h4').textContent();
    const archiveBtn = first.locator('button:has-text("归档")');
    await archiveBtn.click();
    await page.waitForSelector('#arch-modal.show', { timeout: 3000 });
    await page.click('#arch-confirm');
    await page.waitForSelector('#arch-modal.show', { state: 'hidden', timeout: 3000 });

    const state2 = await lsState();
    const cleanTitle = title.trim().replace(/^归档\s+/, '').split(' · ')[0];
    const archivedSkill = findAsset(state2, a => (a.displayName || a.name) === cleanTitle && a.lifecycleStatus === 'archived');
    assert(archivedSkill, 'Skill should be archived, title=' + title.trim() + ', clean=' + cleanTitle);

    await page.goto(BASE + '/index.html');
    await page.waitForLoadState('networkidle');
    await page.click('#nav-sec-archive');
    await page.waitForFunction(() => SP.getLibraryViewState().section === 'archive');
    await page.waitForSelector('tbody tr[data-id]');
    const archivedRow = await page.locator('tbody tr[data-id="' + archivedSkill.id + '"]').count();
    assert(archivedRow === 1, 'Archived skill should appear in Archive section');

    await page.click('tbody tr[data-id="' + archivedSkill.id + '"]');
    await page.click('#d-open');
    await page.waitForURL(/skill-detail\.html\?skill=/);
    await page.click('#btn-restore');
    await page.waitForSelector('#restore-modal.show', { timeout: 3000 });
    await page.click('#restore-ok');
    await page.waitForSelector('#restore-modal.show', { state: 'hidden', timeout: 3000 });

    const state2b = await lsState();
    const restored = findAsset(state2b, a => a.id === archivedSkill.id);
    assert(restored && restored.lifecycleStatus === 'available', 'Skill should be restored to available');

    console.log('✅ Flow 2: Insights archive -> restore');
    passed++;
  } catch (e) {
    console.log('❌ Flow 2:', e.message);
    failed++;
  }

  // Flow 3: Duplicate -> Compare -> archive left
  try {
    await clearState();
    await page.goto(BASE + '/insights.html');
    await page.waitForLoadState('networkidle');
    await page.click('button[data-tab="dup"]');
    await page.waitForTimeout(200);
    const compareBtn = await page.locator('#panel-dup .item button:has-text("查看差异")').first();
    await compareBtn.click();
    await page.waitForURL(/compare\.html/);

    page.once('dialog', async d => { await d.accept(); });
    const url = new URL(page.url());
    let leftId = url.searchParams.get('left');
    if (!leftId) {
      leftId = await page.evaluate(() => {
        const card = document.querySelector('#compare-grid .sp-compare-card, #compare .col');
        return card ? card.dataset.candidateId : null;
      });
    }
    await page.waitForSelector('#act-archive-left, [data-act="archive"]', { timeout: 10000 });
    if (await page.locator('#act-archive-left').count()) {
      await page.click('#act-archive-left');
    } else {
      await page.locator('[data-act="archive"]').first().click();
    }
    // Destructive archive confirms then goBack(~650ms); wait for navigation to settle
    await Promise.race([
      page.waitForURL(/insights\.html|index\.html/, { timeout: 5000 }),
      page.waitForTimeout(1500)
    ]).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});

    const state3 = await lsState();
    const resolvedLeft = await page.evaluate(id => {
      try { return (SP.resolveAssetId && SP.resolveAssetId(id)) || id; } catch (_) { return id; }
    }, leftId);
    const leftSkill = findAsset(state3, a => a.id === resolvedLeft || a.id === leftId || a.name === leftId);
    assert(leftSkill && leftSkill.lifecycleStatus === 'archived', 'Left skill should be archived from compare');

    console.log('✅ Flow 3: Duplicate -> Compare -> archive left');
    passed++;
  } catch (e) {
    console.log('❌ Flow 3:', e.message);
    failed++;
  }

  // Flow 4: Editor external conflict -> force apply
  try {
    await clearState();
    const editorUrl = await page.evaluate(() => {
      const id = SP.resolveAssetId('pr-review');
      const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
      SP.requestWritePermission({ instanceId: inst.id, purpose: 'wt' });
      const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
      const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
      const cur = SP.getEditorFileContent(s.id, skill.id).content;
      SP.saveEditorDraft(s.id, skill.id, cur + '\n## Verified\n- conflict handled\n');
      SP.loadEditorDemoCase('external-content');
      return 'skill-editor.html?skill=' + encodeURIComponent(id) + '&session=' + encodeURIComponent(s.id) + '&dev=1';
    });
    await page.goto(BASE + '/' + editorUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#editor');
    await page.click('#btn-apply');
    await page.waitForTimeout(400);
    if (!page.url().includes('conflict.html')) {
      await page.waitForSelector('#apply-modal.show', { timeout: 5000 });
      await page.click('#apply-confirm');
      await page.waitForURL(/conflict\.html/, { timeout: 8000 });
    }
    await page.waitForSelector('#btn-force');
    // Explicitly acknowledge full diff viewed, then prepare force
    await page.check('#diff-viewed-ack');
    await page.evaluate(() => {
      const id = new URLSearchParams(location.search).get('conflict');
      if (window.SP && SP.markConflictDiffViewed) SP.markConflictDiffViewed(id, { userAcknowledged: true });
    });
    await page.click('#btn-force');
    await page.waitForSelector('#force-modal.show', { timeout: 5000 });
    await page.check('#force-ack');
    await page.click('#force-confirm');
    await page.waitForURL(/skill-editor\.html/, { timeout: 8000 });

    const state4 = await lsState();
    const pr = findAssetByName(state4, 'pr-review');
    assert(pr, 'pr-review missing');
    assert(state4.auditEvents.some(a => a.eventType === 'force_apply' && a.skillId === pr.id), 'force_apply audit missing');

    console.log('✅ Flow 4: Editor external conflict -> force apply');
    passed++;
  } catch (e) {
    console.log('❌ Flow 4:', e.message);
    failed++;
  }

  // Flow 5: Library state preservation -> Detail -> back
  try {
    await clearState();
    await page.goto(BASE + '/index.html');
    await page.waitForLoadState('networkidle');
    await page.fill('#search', 'review');
    await page.waitForTimeout(300);
    const visibleRows = await page.locator('tbody tr[data-id]').count();
    assert(visibleRows >= 1, 'Search should filter rows');

    await page.click('tbody tr:has-text("PR Review")');
    await page.click('#d-open');
    await page.waitForURL(/skill-detail\.html\?skill=/);
    await page.click('#btn-back');
    await page.waitForURL(/index\.html/);

    const searchAfter = await page.inputValue('#search');
    assert(searchAfter === 'review', 'Search state should be preserved after back');

    console.log('✅ Flow 5: Library state preservation -> Detail -> back');
    passed++;
  } catch (e) {
    console.log('❌ Flow 5:', e.message);
    failed++;
  }

  // Flow 6: Create IgnoreRule outside Library (Detail/Settings domain) -> unignore via Settings
  try {
    await clearState();
    await page.goto(BASE + '/index.html?dev=1');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const id = SP.resolveAssetId('pr-review');
      if (SP.createIgnoreRule) SP.createIgnoreRule({ skillId: id, ruleType: 'suggestion', note: 'walkthrough' });
    });
    const state6 = await lsState();
    const ignored = findAssetByName(state6, 'pr-review');
    assert(ignored && ignored.lifecycleStatus === 'available', 'Asset should remain available');
    assert(state6.ignoreRules.some(r => r.skillId === ignored.id), 'Ignore rule should exist');
    // Library must not expose whole-skill ignore batch entry.
    assert((await page.locator('button[data-batch="ignore"]').count()) === 0, 'Library batch ignore should be removed');

    await page.goto(BASE + '/settings.html?dev=1');
    await page.waitForLoadState('networkidle');
    await page.click('button[data-sec="archive"]');
    await page.waitForTimeout(200);
    await page.locator('.ignore-item:has-text("PR Review") button[data-unignore]').first().click();
    await page.waitForTimeout(300);

    const state6b = await lsState();
    const unignored = findAssetByName(state6b, 'pr-review');
    assert(unignored && unignored.lifecycleStatus === 'available', 'Asset should remain available');
    assert(!state6b.ignoreRules.some(r => r.skillId === unignored.id), 'Ignore rule should be removed');

    console.log('✅ Flow 6: Ignore -> unignore via Settings');
    passed++;
  } catch (e) {
    console.log('❌ Flow 6:', e.message);
    failed++;
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
