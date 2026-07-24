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

  console.log('=== Phase 1 Targeted Tests ===\n');
  let passed = 0, failed = 0;

  // Test 1: Draft persists across reloads after two edits
  try {
    await clearState();
    await page.goto(BASE + '/skill-editor.html?skill=figma-tokens');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const original = await page.inputValue('#editor');
    const edit1 = original + '\n\n## Edit 1';
    await page.fill('#editor', edit1);
    await page.waitForTimeout(800);
    const edit2 = edit1 + '\n\n## Edit 2';
    await page.fill('#editor', edit2);
    await page.waitForTimeout(800);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const afterReload = await page.inputValue('#editor');
    assert(afterReload.includes('## Edit 2'), 'Draft should persist second edit after reload');

    console.log('✅ Draft persists across reloads after two edits');
    passed++;
  } catch (e) {
    console.log('❌ Draft persistence:', e.message);
    failed++;
  }

  // Test 2: PendingTask query by skillId
  try {
    await clearState();
    const result = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sp-state-v3'));
      const asset = state.assets.find(a => a.name === 'demo-yaml-error');
      if (!asset) return { error: 'demo-yaml-error asset not found' };
      const tasks = state.pendingTasks.filter(t => t.skillId === asset.id && t.status === 'open');
      return { taskCount: tasks.length, hasYamlError: tasks.some(t => t.taskType === 'yaml_error') };
    });
    if (result.error) throw new Error(result.error);
    assert(result.taskCount > 0, 'Should find open pending tasks for demo-yaml-error');
    assert(result.hasYamlError, 'Should include yaml_error task');

    console.log('✅ PendingTask queryable by skillId from real state');
    passed++;
  } catch (e) {
    console.log('❌ PendingTask query:', e.message);
    failed++;
  }

  // Test 3: compare.html?group=<groupId> renders correct candidates
  try {
    await clearState();
    const groupInfo = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sp-state-v3'));
      const group = state.duplicateGroups.find(g => g.name === 'B' || g.id === 'B');
      if (!group) return { error: 'Group B not found' };
      const names = group.skillIds.map(id => {
        const a = state.assets.find(x => x.id === id);
        return a ? (a.displayName || a.name) : null;
      }).filter(Boolean);
      return { skillIds: group.skillIds, names };
    });
    if (groupInfo.error) throw new Error(groupInfo.error);
    await page.goto(BASE + '/compare.html?group=B');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#compare .col h2, #compare-grid .sp-compare-card h2', { timeout: 10000 });
    const headings = page.locator('#compare .col h2, #compare-grid .sp-compare-card h2');
    const leftHeading = (await headings.nth(0).textContent()).trim();
    const rightHeading = (await headings.nth(1).textContent()).trim();
    assert(leftHeading && rightHeading, 'Compare page should render both columns');
    assert(groupInfo.names.includes(leftHeading), 'Left skill should belong to group B');
    assert(groupInfo.names.includes(rightHeading), 'Right skill should belong to group B');

    console.log('✅ compare.html?group=B renders correct candidates');
    passed++;
  } catch (e) {
    console.log('❌ Compare group render:', e.message);
    failed++;
  }

  // Test 4: Library -> Detail -> back restores search and selection state
  try {
    await clearState();
    await page.goto(BASE + '/index.html');
    await page.waitForLoadState('networkidle');
    await page.fill('#search', 'review');
    await page.waitForTimeout(300);
    const beforeRows = await page.locator('tbody tr:visible').count();
    assert(beforeRows >= 1, 'Search should filter to at least 1 row');
    await page.click('tbody tr:has-text("PR Review")');
    await page.click('#d-open');
    await page.waitForURL(/skill-detail\.html\?skill=/);
    await page.click('#btn-back');
    await page.waitForURL(/index\.html/);
    await page.waitForTimeout(300);
    const searchAfter = await page.inputValue('#search');
    assert(searchAfter === 'review', 'Search should be restored after back');

    console.log('✅ Library -> Detail -> back restores search state');
    passed++;
  } catch (e) {
    console.log('❌ Cross-page state preservation:', e.message);
    failed++;
  }

  // Test 5: A valid instance path cannot correspond to two valid Instances
  try {
    await clearState();
    const unique = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sp-state-v3'));
      const paths = state.instances.filter(i => i.lifecycleStatus === 'available').map(i => i.skillFilePath);
      return paths.length === new Set(paths).size;
    });
    assert(unique, 'Available instance paths must be unique');

    console.log('✅ Valid instance paths are unique');
    passed++;
  } catch (e) {
    console.log('❌ Instance path uniqueness:', e.message);
    failed++;
  }

  // Test 6: Modifying derived View Model does not change original state
  try {
    await clearState();
    const result = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sp-state-v3'));
      const assetBefore = JSON.parse(JSON.stringify(state.assets.find(a => a.name === 'pr-review')));
      const s = SP.getSkill('pr-review');
      s.displayName = 'HACKED';
      s.lifecycleStatus = 'deleted';
      const stateAfter = JSON.parse(localStorage.getItem('sp-state-v3'));
      const assetAfter = stateAfter.assets.find(a => a.name === 'pr-review');
      return {
        viewModelChanged: s.displayName === 'HACKED' && s.lifecycleStatus === 'deleted',
        displayNameUnchanged: assetAfter.displayName === assetBefore.displayName,
        lifecycleUnchanged: assetAfter.lifecycleStatus === assetBefore.lifecycleStatus
      };
    });
    assert(result.viewModelChanged, 'View model mutation should be visible on copy');
    assert(result.displayNameUnchanged, 'Original asset displayName must not change');
    assert(result.lifecycleUnchanged, 'Original asset lifecycle must not change');

    console.log('✅ Derived View Model mutation does not change original state');
    passed++;
  } catch (e) {
    console.log('❌ View model immutability:', e.message);
    failed++;
  }

  // Test 7: Runtime new entity IDs are UUID format
  try {
    await clearState();
    await page.goto(BASE + '/new-skill.html');
    await page.waitForLoadState('networkidle');
    await page.fill('#name', 'uuid-test-skill');
    await page.fill('#display', 'UUID Test');
    await page.fill('#description', 'Testing UUID generation');
    await page.click('#btn-create');
    await page.waitForURL(/skill-editor\.html\?skill=/, { timeout: 3000 });
    const url = page.url();
    const skillId = new URL(url).searchParams.get('skill');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert(uuidRegex.test(skillId), 'New skill ID should be UUID v4 format, got ' + skillId);

    const state = await lsState();
    const asset = state.assets.find(a => a.id === skillId);
    assert(asset, 'New asset should exist in state');
    const instance = state.instances.find(i => i.skillId === skillId);
    assert(instance && uuidRegex.test(instance.id), 'New instance ID should be UUID');
    const file = state.files.find(f => f.skillId === skillId);
    assert(file && uuidRegex.test(file.id), 'New file ID should be UUID');

    console.log('✅ Runtime new entity IDs are UUID format');
    passed++;
  } catch (e) {
    console.log('❌ Runtime UUID format:', e.message);
    failed++;
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
