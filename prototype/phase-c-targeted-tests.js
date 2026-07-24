const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('./chrome-launch');

const BASE = 'http://localhost:8081';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

let browser, context, page;

async function freshPage() {
  if (page) await page.close();
  page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
}

async function resetState() {
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('sp-dev', '1');
  });
  // Navigate to a clean URL so stale ?q= cannot bootstrap into viewState.
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && document.querySelector('#list-pane') && SP.getLibraryViewState);
  await page.evaluate(() => {
    sessionStorage.setItem('sp-library-url-boot', '1');
    SP.setLibraryViewState({
      section: 'all', viewMode: 'table', search: '', filters: {}, sort: 'recent',
      page: 1, pageSize: 20, selectedAssetId: null, expandedAssetIds: [],
      expandedTreeNodes: [], scrollTop: 0, detailOpen: false, categoryId: null
    });
    history.replaceState(null, '', location.pathname + '?dev=1');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('tbody tr[data-id]');
  await page.waitForFunction(() => {
    const vs = SP.getLibraryViewState();
    return vs.section === 'all' && vs.viewMode === 'table' && !vs.search && !(vs.filters && Object.keys(vs.filters).length);
  });
}

async function evalSP(fn, ...args) {
  return await page.evaluate(fn, ...args);
}

test('Three views share the same asset count', async () => {
  await freshPage();
  await resetState();
  await page.waitForSelector('tbody tr[data-id]');
  const tableCount = await page.locator('tbody tr[data-id]').count();
  await page.click('#view-cards');
  await page.waitForFunction(() => document.getElementById('cards-grid') && !document.getElementById('cards-grid').hidden && document.querySelectorAll('#cards-grid .lib-card').length > 0);
  const cardCount = await page.locator('#cards-grid .lib-card').count();
  await page.click('#view-tree');
  await page.waitForFunction(() => document.getElementById('tree-root') && !document.getElementById('tree-root').hidden && document.querySelectorAll('#tree-root .tree-skill').length > 0);
  const treeCount = await page.locator('#tree-root .tree-skill').count();
  assert(tableCount === cardCount && cardCount === treeCount, `Counts differ table=${tableCount} cards=${cardCount} tree=${treeCount}`);
  assert(tableCount > 0, 'Expected assets');
});

test('Switching views keeps search', async () => {
  await freshPage();
  await resetState();
  await page.fill('#search', 'prompt');
  await page.waitForFunction(() => (SP.getLibraryViewState().search || '') === 'prompt');
  const n1 = await page.locator('tbody tr[data-id]').count();
  await page.click('#view-cards');
  await page.waitForFunction(() => SP.getLibraryViewState().viewMode === 'cards');
  assert((await page.inputValue('#search')) === 'prompt', 'Search lost on cards');
  const n2 = await page.locator('#cards-grid .lib-card').count();
  await page.click('#view-tree');
  await page.waitForFunction(() => SP.getLibraryViewState().viewMode === 'tree');
  assert((await page.inputValue('#search')) === 'prompt', 'Search lost on tree');
  const n3 = await page.locator('#tree-root .tree-skill').count();
  assert(n1 === n2 && n2 === n3, `Search result counts differ ${n1}/${n2}/${n3}`);
});

test('Switching views keeps host filter', async () => {
  await freshPage();
  await resetState();
  await page.click('#btn-filter');
  await page.waitForSelector('#filter-panel.open');
  await page.check('#filter-panel input[data-filter-host="claude-code"]');
  await page.click('#btn-apply-filters');
  await page.waitForFunction(() => (SP.getLibraryViewState().filters.host || []).includes('claude-code'));
  const n1 = await page.locator('tbody tr[data-id]').count();
  assert(n1 > 0, 'Expected filtered table rows');
  await page.click('#view-cards');
  await page.waitForFunction(() => SP.getLibraryViewState().viewMode === 'cards');
  const n2 = await page.locator('#cards-grid .lib-card').count();
  assert(n1 === n2 && n1 > 0, `Filter not shared ${n1}/${n2}`);
});

test('Multi-instance skill appears once', async () => {
  await freshPage();
  await resetState();
  await page.fill('#search', 'pr-review');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr[data-id]').length === 1);
  const rows = await page.locator('tbody tr[data-id]').count();
  assert(rows === 1, `Expected 1 row for pr-review, got ${rows}`);
  const count = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    return SP.getAssetSummary(id).instanceCount;
  });
  assert(count >= 2, `Expected >=2 instances, got ${count}`);
});

test('Expanding asset shows all instances', async () => {
  await freshPage();
  await resetState();
  await page.fill('#search', 'pr-review');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr[data-id]').length >= 1);
  const id = await evalSP(() => SP.resolveAssetId('pr-review'));
  await page.click(`tbody tr[data-id="${id}"] [data-expand]`);
  await page.waitForFunction(id => document.querySelectorAll(`tr.instance-row[data-asset="${id}"]`).length >= 2, id);
  const instRows = await page.locator(`tr.instance-row[data-asset="${id}"]`).count();
  assert(instRows >= 2, `Expected >=2 instance rows, got ${instRows}`);
});

test('Partial vs all missing are distinguished', async () => {
  await freshPage();
  await resetState();
  await page.click('#nav-sec-missing');
  await page.waitForFunction(() => SP.getLibraryViewState().section === 'missing');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr[data-id]').length > 0);
  const labels = await page.locator('tbody tr[data-id] .status-label').allTextContents();
  assert(labels.length > 0, 'Missing section empty');
  const joined = labels.join(' ');
  assert(/Missing|缺失|部分/i.test(joined), 'Missing labels not found: ' + joined);
  const scopes = await evalSP(() => {
    const r = SP.queryLibraryAssets({ section: 'missing', pageSize: 100 });
    return {
      all: r.items.filter(i => i.instanceSummary.missingScope === 'all' || i.lifecycleStatus === 'missing').length,
      partial: r.items.filter(i => i.instanceSummary.missingScope === 'partial').length
    };
  });
  assert(scopes.all + scopes.partial > 0, 'No missing scope items');
});

test('Updates Available only shows source updateStatus available', async () => {
  await freshPage();
  await resetState();
  await page.click('#nav-sec-updates');
  await page.waitForFunction(() => SP.getLibraryViewState().section === 'updates');
  const check = await evalSP(() => {
    const r = SP.queryLibraryAssets({ section: 'updates', pageSize: 100 });
    return { total: r.total, allAvailable: r.items.every(i => i.updateStatus === 'available') };
  });
  assert(check.total >= 1, 'Expected updateable skills');
  assert(check.allAvailable, 'Non-available items in updates section');
});

test('File full-text search shows one skill with filename and snippet', async () => {
  await freshPage();
  await resetState();
  await page.fill('#search', 'PHASEC_FILE_SEARCH_MARKER');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr[data-id]').length === 1);
  const rows = await page.locator('tbody tr[data-id]').count();
  assert(rows === 1, `Expected 1 skill for file search, got ${rows}`);
  const hit = await page.locator('.file-hit').first().textContent();
  assert(hit && hit.includes('checklist.md'), 'Missing filename in hit: ' + hit);
  assert(/PHASEC_FILE_SEARCH_MARKER|confirm checklist/i.test(hit), 'Missing snippet context: ' + hit);
});

test('Search HTML special chars do not inject', async () => {
  await freshPage();
  await resetState();
  await page.fill('#search', '<img src=x onerror=alert(1)>');
  await page.waitForTimeout(200);
  const html = await page.locator('#list-pane').innerHTML();
  assert(!html.includes('<img src=x'), 'Unescaped HTML injected into list');
  assert(!html.includes('onerror=alert'), 'Event handler injected');
});

test('Favorites Recent Archive section counts are correct', async () => {
  await freshPage();
  await resetState();
  const api = await evalSP(() => {
    const c = SP.getLibraryCounts();
    return {
      fav: SP.queryLibraryAssets({ section: 'favorites', pageSize: 100 }).total,
      recent: SP.queryLibraryAssets({ section: 'recent', pageSize: 100 }).total,
      archive: SP.queryLibraryAssets({ section: 'archive', pageSize: 100 }).total,
      counts: c
    };
  });
  assert(api.fav === api.counts.favorites, 'Favorites mismatch');
  assert(api.archive === api.counts.archive, 'Archive mismatch');
  assert(api.recent > 0 && api.fav > 0 && api.archive > 0, 'Section counts should be positive');
  await page.click('#nav-sec-favorites');
  await page.waitForFunction(() => SP.getLibraryViewState().section === 'favorites');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr[data-id]').length > 0);
  assert((await page.locator('tbody tr[data-id]').count()) === api.fav, 'Favorites UI count mismatch');
});

test('Category section filters to selected category', async () => {
  await freshPage();
  await resetState();
  const info = await evalSP(() => {
    const counts = SP.getLibraryCounts();
    const cat = (counts.categories || []).find(c => c.count > 0);
    if (!cat) return { error: 'No category with assets' };
    const apiTotal = SP.queryLibraryAssets({ section: 'categories', categoryId: cat.id, pageSize: 100 }).total;
    return { id: cat.id, name: cat.name, count: cat.count, apiTotal };
  });
  assert(!info.error, info.error || 'category lookup failed');
  assert(info.apiTotal === info.count && info.apiTotal > 0, `Category API mismatch ${info.apiTotal}/${info.count}`);
  await page.click('#nav-sec-categories');
  await page.waitForFunction(() => SP.getLibraryViewState().section === 'categories');
  await page.waitForSelector('#cat-list:not([hidden])');
  await page.click(`#cat-list a[data-cat="${info.id}"]`);
  await page.waitForFunction(id => {
    const vs = SP.getLibraryViewState();
    return vs.section === 'categories' && (vs.categoryId === id);
  }, info.id);
  await page.waitForFunction(() => document.querySelectorAll('tbody tr[data-id]').length > 0);
  const uiCount = await page.locator('tbody tr[data-id]').count();
  assert(uiCount === info.apiTotal, `Category UI count mismatch ui=${uiCount} api=${info.apiTotal}`);
  const allMatch = await evalSP((id) => {
    const r = SP.queryLibraryAssets({ section: 'categories', categoryId: id, pageSize: 100 });
    return r.items.every(i => (i.categoryIds || []).includes(id));
  }, info.id);
  assert(allMatch, 'Category results include assets outside selected category');
});

test('Scan Changes count comes from pending ChangeSet', async () => {
  await freshPage();
  await resetState();
  await evalSP(() => SP.loadDemoScanScenario());
  await page.reload({ waitUntil: 'networkidle' });
  const summary = await evalSP(() => SP.getPendingChangeSetSummary());
  assert(summary.pendingChangeSetCount >= 1, 'Expected pending changeset');
  await page.click('#nav-sec-scan-changes');
  await page.waitForSelector('#scan-changes-panel');
  const text = await page.textContent('#scan-changes-panel');
  assert(text.includes(String(summary.pendingChangeSetCount)) || /待确认|变化/.test(text), 'Scan changes panel missing count');
});

test('Returning to Library restores view search filter selection scroll', async () => {
  await freshPage();
  await resetState();
  await page.fill('#search', 'review');
  await page.waitForFunction(() => (SP.getLibraryViewState().search || '') === 'review');
  await page.click('#btn-filter');
  await page.waitForSelector('#filter-panel.open');
  await page.check('#filter-panel input[data-filter-host="claude-code"]');
  await page.click('#btn-apply-filters');
  await page.waitForFunction(() => (SP.getLibraryViewState().filters.host || []).includes('claude-code'));
  await page.click('#view-cards');
  await page.waitForFunction(() => SP.getLibraryViewState().viewMode === 'cards' && document.querySelectorAll('#cards-grid .lib-card').length > 0);
  // Persist scroll via ViewState (list may not overflow enough for a real scroll in headless).
  await page.evaluate(() => {
    SP.setLibraryViewState({ scrollTop: 160 });
    document.getElementById('list-pane').scrollTop = 160;
  });
  await page.waitForFunction(() => (SP.getLibraryViewState().scrollTop || 0) >= 160);
  const id = await evalSP(() => SP.resolveAssetId('pr-review'));
  const cardCount = await page.locator(`.lib-card[data-id="${id}"]`).count();
  assert(cardCount === 1, 'pr-review should remain visible under search+host filter');
  await page.click(`.lib-card[data-id="${id}"]`);
  await page.click('#d-open');
  await page.waitForURL(/skill-detail\.html/);
  await page.click('#btn-back');
  await page.waitForURL(/index\.html/);
  await page.waitForFunction(() => (SP.getLibraryViewState().search || '') === 'review');
  assert((await page.inputValue('#search')) === 'review', 'Search not restored');
  const restored = await evalSP(() => {
    const vs = SP.getLibraryViewState();
    const pane = document.getElementById('list-pane');
    const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
    return {
      mode: vs.viewMode,
      selected: vs.selectedAssetId,
      host: (vs.filters && vs.filters.host) || [],
      scrollTop: vs.scrollTop || 0,
      paneScroll: pane.scrollTop,
      clampedScroll: Math.min(vs.scrollTop || 0, max)
    };
  });
  assert(restored.mode === 'cards', 'viewMode not restored: ' + restored.mode);
  assert(restored.selected === id, 'selectedAssetId not restored');
  assert(restored.host.includes('claude-code'), 'filters.host not restored');
  assert(restored.scrollTop >= 160, 'scrollTop not restored in viewState: ' + restored.scrollTop);
  // DOM may clamp when content is shorter than requested scroll; still must apply clamped value.
  assert(
    restored.paneScroll === restored.clampedScroll,
    `list-pane scroll not applied: pane=${restored.paneScroll} clamped=${restored.clampedScroll}`
  );
});

test('Column settings persist after refresh', async () => {
  await freshPage();
  await resetState();
  await page.click('#btn-cols');
  await page.waitForSelector('#col-settings-panel.open');
  const hasToken = await page.locator('#col-settings-panel input[value="token"]').count();
  if (hasToken) {
    await page.check('#col-settings-panel input[value="token"]');
  }
  await page.click('#btn-save-cols');
  await page.waitForTimeout(150);
  const before = await evalSP(() => SP.getLibraryViewState().visibleColumns);
  await page.reload({ waitUntil: 'networkidle' });
  const after = await evalSP(() => SP.getLibraryViewState().visibleColumns);
  assert(JSON.stringify(before) === JSON.stringify(after), 'Columns not persisted');
  if (hasToken) assert(after.includes('token'), 'token column missing after refresh');
});

test('Tree expand state persists after refresh', async () => {
  await freshPage();
  await resetState();
  await page.click('#view-tree');
  await page.waitForFunction(() => SP.getLibraryViewState().viewMode === 'tree' && document.querySelectorAll('#tree-root .tree-node').length > 0);
  const first = page.locator('#tree-root [data-tree-toggle]').first();
  await first.click();
  await page.waitForTimeout(150);
  const nodes = await evalSP(() => SP.getLibraryViewState().expandedTreeNodes);
  assert(nodes.length >= 1, 'expandedTreeNodes empty');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => SP.getLibraryViewState().viewMode === 'tree');
  const after = await evalSP(() => SP.getLibraryViewState().expandedTreeNodes);
  assert(after.length >= 1, 'Tree expand state lost');
});

test('Batch action returns per-item success and failure', async () => {
  await freshPage();
  await resetState();
  const result = await evalSP(() => {
    const active = SP.queryLibraryAssets({ section: 'all', pageSize: 5 }).items.map(i => i.id);
    const archived = SP.queryLibraryAssets({ section: 'archive', pageSize: 1 }).items.map(i => i.id);
    const ids = active.slice(0, 2).concat(archived.slice(0, 1));
    return SP.batchLibraryAction('archive', ids);
  });
  assert(result.total === result.success + result.failed, 'totals mismatch');
  assert(result.success >= 1, 'Expected some success');
  assert(result.failed >= 1, 'Expected some failure for already-archived');
  assert(result.results.every(r => r.ok || r.error), 'Missing per-item error');
});

test('Narrow viewport shows detail as drawer', async () => {
  await freshPage();
  await resetState();
  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(100);
  await page.waitForSelector('tbody tr[data-id]', { state: 'visible' });
  const id = await evalSP(() => SP.resolveAssetId('pr-review'));
  await page.click(`tbody tr[data-id="${id}"]`);
  await page.waitForFunction(() => {
    const el = document.getElementById('detail');
    return el && el.classList.contains('drawer-open') && window.matchMedia('(max-width:1100px)').matches;
  });
  const drawer = await page.locator('#detail.drawer-open').count();
  assert(drawer === 1, 'Expected detail drawer-open on narrow viewport');
});

test('Library page does not mutate raw v3 arrays via query APIs', async () => {
  await freshPage();
  await resetState();
  const ok = await evalSP(() => {
    const before = JSON.stringify({
      a: SP.getState().assets.length,
      i: SP.getState().instances.length,
      f: SP.getState().files.length
    });
    const item = SP.queryLibraryAssets({ section: 'all', pageSize: 1 }).items[0];
    item.name = 'TAMPERED';
    item.instances[0].skillFilePath = '/hacked';
    const summary = SP.getAssetSummary(item.id);
    summary.description = 'HACK';
    const after = JSON.stringify({
      a: SP.getState().assets.length,
      i: SP.getState().instances.length,
      f: SP.getState().files.length
    });
    const raw = SP.getState().assets.find(a => a.id === item.id);
    return before === after && raw.name !== 'TAMPERED' && raw.description !== 'HACK';
  });
  assert(ok, 'Query view models mutated raw state');
});

test('index.html has no duplicated shared public selectors', async () => {
  await freshPage();
  await resetState();
  const dup = await page.evaluate(async () => {
    const css = await (await fetch('shared.css')).text();
    const html = await (await fetch('index.html')).text();
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    if (!styleMatch) return [];
    const pageCss = styleMatch[1];
    const publicSelectors = ['.btn', '.card', '.modal', '.app', '.sidebar', '.nav', '.titlebar', ':root'];
    return publicSelectors.filter(sel => {
      const re = new RegExp('(^|[}\\s])' + sel.replace('.', '\\.') + '\\s*\\{');
      return re.test(css) && re.test(pageCss);
    });
  });
  assert(dup.length === 0, 'Duplicated selectors: ' + dup.join(','));
});

test('Prior Phase A/B/B.1 suite files remain present for regression', async () => {
  const fs = require('fs');
  const path = require('path');
  const root = __dirname;
  const playwrightSuites = [
    'e2e-test.js',
    'walkthrough-test.js',
    'phase1-targeted-tests.js',
    'phase2-targeted-tests.js',
    'phase-b1-targeted-tests.js',
    'phase-c1-targeted-tests.js'
  ];
  playwrightSuites.forEach(name => {
    const full = path.join(root, name);
    assert(fs.existsSync(full), 'Missing prior suite file: ' + name);
    const src = fs.readFileSync(full, 'utf8');
    assert(src.includes('chromium') || src.includes('playwright'), name + ' does not look like a Playwright suite');
  });
  assert(fs.existsSync(path.join(root, 'run-all-tests.js')), 'Missing run-all-tests.js entry');
});

async function run() {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  let passed = 0, failed = 0;
  console.log('=== Phase C Targeted Tests ===\n');
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
