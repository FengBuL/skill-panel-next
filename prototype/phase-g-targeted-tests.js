/**
 * Phase G targeted tests — Insights, Activity, Settings, Cases guard, global regressions.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromiumLaunchOptions } = require('./chrome-launch');

const BASE = 'http://localhost:8081';
const ROOT = __dirname;
const INSIGHT_TABS = ['archive', 'dup', 'file', 'draft', 'token', 'maint'];
const EMPTY_MSG = {
  archive: '没有建议归档', dup: '没有疑似重复', file: '没有文件问题',
  draft: '没有未完成草稿', token: 'Token', maint: '最近维护记录为空'
};
const SETTINGS_READONLY = {
  showCodexUsageNotice: '#adapters-list',
  defaultCreateLocationId: '#defaultCreateLocationId'
};

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }

let browser, context, page;
async function freshPage() {
  if (page) await page.close();
  page = await context.newPage();
}
async function resetState(dev = true) {
  const q = dev ? '?dev=1' : '';
  await page.goto(BASE + '/index.html' + q, { waitUntil: 'networkidle' });
  await page.evaluate((d) => {
    localStorage.clear(); sessionStorage.clear();
    if (d) localStorage.setItem('sp-dev', '1');
  }, dev);
  await page.goto(BASE + '/index.html' + q, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && (SP.__test || !localStorage.getItem('sp-dev')));
  await page.evaluate((d) => {
    SP.resetState();
    if (!d && SP.markOnboardingComplete) SP.markOnboardingComplete('tests');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP);
}
async function evalSP(fn, ...args) { return page.evaluate(fn, ...args); }
async function gotoInsights() {
  await page.goto(BASE + '/insights.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForSelector('#tabs .tab');
}
async function gotoActivity() {
  await page.goto(BASE + '/activity.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForSelector('#tbody');
}
async function gotoSettings(sec) {
  await page.goto(BASE + '/settings.html?dev=1' + (sec ? '#x' : ''), { waitUntil: 'networkidle' });
  if (sec) await page.click(`.sec-nav button[data-sec="${sec}"]`);
}
async function clickTab(tab) {
  await page.click(`.tab[data-tab="${tab}"]`);
  await page.waitForSelector(`#panel-${tab}.active`);
}
async function summaryDom() {
  return page.evaluate(() => ({
    archive: document.getElementById('sum-archive').textContent,
    dup: document.getElementById('sum-dup').textContent,
    file: document.getElementById('sum-file').textContent,
    draft: document.getElementById('sum-draft').textContent,
    token: document.getElementById('sum-token').textContent
  }));
}
async function clearInsightsLists() {
  await evalSP(() => {
    const s = SP.__test.getRawState();
    s.pendingTasks.forEach(t => { t.status = 'resolved'; });
    s.auditEvents = s.auditEvents.filter(e =>
      !['apply_change', 'archive', 'restore_archive', 'restore_version', 'ignore', 'unignore'].includes(e.eventType));
    (s.usageAdapters || []).forEach(a => { a.supportsTokens = false; a.status = 'limited'; });
    SP.__test.saveState();
  });
}
function spawnSuite(file, expectPassed) {
  const result = spawnSync(process.execPath, [path.join(ROOT, file)], { cwd: ROOT, env: process.env, encoding: 'utf8' });
  const out = (result.stdout || '') + (result.stderr || '');
  const m = out.match(/(\d+)\s+passed,\s*(\d+)\s+failed/);
  assert(result.status === 0, file + ' failed:\n' + out.slice(-1500));
  assert(m && Number(m[1]) === expectPassed && Number(m[2]) === 0, file + ' expected ' + expectPassed + ' passed: ' + (m && m[0]));
}

test('G-1 insights.html source has no SP.__test', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'insights.html'), 'utf8');
  assert(!/SP\.__test/.test(src), 'insights.html must not reference SP.__test');
});

test('G-2 insights tabs archive/dup/file/draft/token/maint exist', async () => {
  await freshPage(); await resetState();
  await gotoInsights();
  const tabs = await page.locator('#tabs .tab').evaluateAll(els => els.map(e => e.dataset.tab));
  INSIGHT_TABS.forEach(t => assert(tabs.includes(t), 'missing tab ' + t));
  assert(tabs.length >= INSIGHT_TABS.length, JSON.stringify(tabs));
});

test('G-3 summary counts match API lengths exactly', async () => {
  await freshPage(); await resetState();
  await gotoInsights();
  const api = await evalSP(() => ({
    archive: SP.getArchiveCandidates().length, dup: SP.getDuplicateGroups().length,
    file: SP.getFileIssues().length, draft: SP.getUnfinishedDrafts().length, token: SP.getTokenAttentions().length
  }));
  const dom = await summaryDom();
  Object.keys(api).forEach(k => assert(dom[k] === String(api[k]), k + ': dom=' + dom[k] + ' api=' + api[k]));
});

test('G-4 archive opens confirm modal on 归档 click', async () => {
  await freshPage(); await resetState();
  await gotoInsights();
  await clickTab('archive');
  const n = await page.locator('.act-arch').count();
  assert(n >= 1, 'need archive candidate');
  await page.locator('.act-arch').first().click();
  assert(await page.locator('#arch-modal.show').count() === 1, 'arch modal not shown');
  assert(/确认归档/.test(await page.locator('#arch-modal header').innerText()), 'modal header');
});

test('G-5 dup Compare navigates to compare path', async () => {
  await freshPage(); await resetState();
  await gotoInsights();
  await clickTab('dup');
  const btn = page.locator('[data-action="compare"]').first();
  assert(await btn.count() >= 1, 'no compare button');
  await Promise.all([page.waitForURL(/compare\.html/), btn.click()]);
  assert(/compare\.html/.test(page.url()), page.url());
});

test('G-6 file issue navigates to detail or editor', async () => {
  await freshPage(); await resetState();
  await gotoInsights();
  await clickTab('file');
  const editor = page.locator('[data-action="editor"]').first();
  const detail = page.locator('[data-action="detail"]').first();
  if (await editor.count()) {
    await Promise.all([page.waitForURL(/skill-editor\.html/), editor.click()]);
  } else {
    assert(await detail.count() >= 1, 'no file issue actions');
    await Promise.all([page.waitForURL(/skill-detail\.html/), detail.click()]);
  }
  assert(/skill-(editor|detail)\.html/.test(page.url()), page.url());
});

test('G-7 draft opens editor', async () => {
  await freshPage(); await resetState();
  await gotoInsights();
  await clickTab('draft');
  assert(await page.locator('[data-action="editor"]').count() >= 1, 'no draft editor btn');
  await Promise.all([page.waitForURL(/skill-editor\.html/), page.locator('[data-action="editor"]').first().click()]);
});

test('G-8 token empty shows unavailable reason not fake zero Token', async () => {
  await freshPage(); await resetState();
  await clearInsightsLists();
  await gotoInsights();
  await clickTab('token');
  const text = await page.locator('#panel-token').innerText();
  assert(/暂无可用的|不可用|无数据|没有 Token 关注项/.test(text), text.slice(0, 200));
  assert(!/^0\s*Token$/m.test(text) && !/平均关联 Token\s*0/.test(text), 'must not fake zero token primary: ' + text.slice(0, 120));
});

test('G-9 each insights tab shows empty state when cleared', async () => {
  await freshPage(); await resetState();
  await clearInsightsLists();
  await gotoInsights();
  for (const tab of INSIGHT_TABS) {
    await clickTab(tab);
    const empty = await page.locator(`#panel-${tab} .empty`).count();
    assert(empty >= 1, tab + ' missing empty state');
    const txt = await page.locator(`#panel-${tab}`).innerText();
    assert(txt.includes(EMPTY_MSG[tab].slice(0, 4)) || /没有|为空|暂无/.test(txt), tab + ': ' + txt.slice(0, 80));
  }
});

test('G-10 refresh keeps insights tab via viewState', async () => {
  await freshPage(); await resetState();
  await gotoInsights();
  await clickTab('draft');
  await evalSP(() => SP.setViewState('insights', { tab: 'draft' }));
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.locator('#panel-draft.active').count() === 1, 'draft tab not restored');
  const vs = await evalSP(() => SP.getViewState('insights'));
  assert(vs.tab === 'draft', JSON.stringify(vs));
});

test('G-11 activity pending/history subviews switch via clicks', async () => {
  await freshPage(); await resetState();
  await gotoActivity();
  await page.click('[data-subview="history"]');
  assert(await page.locator('[data-subview="history"].active').count() === 1);
  await page.click('[data-subview="pending"]');
  assert(await page.locator('[data-subview="pending"].active').count() === 1);
});

test('G-12 activity range chips filter via clicks', async () => {
  await freshPage(); await resetState();
  await gotoActivity();
  await page.click('[data-subview="history"]');
  await page.click('[data-range="30"]');
  assert(await page.locator('[data-range="30"].active').count() === 1);
  const n30 = await page.locator('#tbody tr[data-id]').count();
  await page.click('[data-range="1"]');
  const n1 = await page.locator('#tbody tr[data-id]').count();
  assert(n1 <= n30, 'today should be subset of 30d: ' + n1 + ' vs ' + n30);
});

test('G-13 activity kind chips filter via clicks', async () => {
  await freshPage(); await resetState();
  await gotoActivity();
  await page.click('[data-subview="history"]');
  await page.click('[data-kind="usage"]');
  assert(await page.locator('[data-kind="usage"].active').count() === 1);
  const kinds = await page.locator('#tbody .type').evaluateAll(els => els.map(e => e.textContent));
  assert(kinds.every(k => k.includes('调用') || k === '—' || !k), JSON.stringify(kinds.slice(0, 5)));
});

test('G-14 activity search filters list', async () => {
  await freshPage(); await resetState();
  await gotoActivity();
  await page.click('[data-subview="history"]');
  const before = await page.locator('#tbody tr[data-id]').count();
  await page.fill('#q', 'zzznomatchphaseg');
  await page.waitForTimeout(200);
  const after = await page.locator('#tbody tr[data-id]').count();
  assert(after < before || before === 0, 'search should reduce rows: ' + before + ' -> ' + after);
});

test('G-15 activity sort chips reorder via clicks', async () => {
  await freshPage(); await resetState();
  await gotoActivity();
  await page.click('[data-subview="history"]');
  await page.click('[data-sort="earliest"]');
  const early = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#tbody tr[data-id]')];
    return rows.map(r => ({ id: r.dataset.id, time: r.querySelector('td')?.textContent || '' }));
  });
  await page.click('[data-sort="latest"]');
  const late = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#tbody tr[data-id]')];
    return rows.map(r => ({ id: r.dataset.id, time: r.querySelector('td')?.textContent || '' }));
  });
  assert(early.length >= 2 && late.length >= 2, 'need rows');
  const times = await evalSP(() => SP.getActivityEvents().map(e => ({ id: e.id, time: e.time })));
  const byId = Object.fromEntries(times.map(t => [t.id, t.time]));
  const earlyFirst = byId[early[0].id];
  const earlyLast = byId[early[early.length - 1].id];
  const lateFirst = byId[late[0].id];
  const lateLast = byId[late[late.length - 1].id];
  assert(earlyFirst <= earlyLast, 'earliest order broken: ' + earlyFirst + ' > ' + earlyLast);
  assert(lateFirst >= lateLast, 'latest order broken: ' + lateFirst + ' < ' + lateLast);
  assert(early[0].id !== late[0].id || earlyFirst === lateFirst, 'sort should change first row when times differ');
});

test('G-16 select event shows drawer with eventType', async () => {
  await freshPage(); await resetState();
  await gotoActivity();
  const id = await page.locator('#tbody tr[data-id]').first().getAttribute('data-id');
  assert(id, 'no activity rows');
  await page.locator(`#tbody tr[data-id="${id}"]`).click();
  const props = await page.locator('#e-props').innerText();
  assert(/事件类型/.test(props), props.slice(0, 120));
  const et = await evalSP((eid) => SP.getActivityEvents().find(e => e.id === eid)?.eventType, id);
  assert(props.includes(et), 'drawer missing ' + et);
});

test('G-17 update_awaiting_merge shows 待合并', async () => {
  await freshPage(); await resetState();
  const id = await evalSP(() => SP.addAuditEvent({
    skillId: SP.resolveAssetId('pr-review'), eventType: 'update_awaiting_merge',
    category: 'edit', source: 'Skill Panel', result: 'pending', note: 'merge pending'
  }).id);
  await gotoActivity();
  await page.click('[data-subview="history"]');
  await page.locator(`#tbody tr[data-id="${id}"]`).click();
  const txt = await page.locator('#drawer-body').innerText();
  assert(/待合并/.test(txt), txt.slice(0, 160));
});

test('G-18 update_partially_completed shows 部分完成', async () => {
  await freshPage(); await resetState();
  const id = await evalSP(() => SP.addAuditEvent({
    skillId: SP.resolveAssetId('pr-review'), eventType: 'update_partially_completed',
    category: 'edit', source: 'Skill Panel', result: 'partial', note: 'deferred files'
  }).id);
  await gotoActivity();
  await page.click('[data-subview="history"]');
  await page.locator(`#tbody tr[data-id="${id}"]`).click();
  assert(/部分完成/.test(await page.locator('#drawer-body').innerText()));
});

test('G-19 failed rolled-back rollback-failed labels', async () => {
  await freshPage(); await resetState();
  const ids = await evalSP(() => [
    SP.addAuditEvent({ skillId: SP.resolveAssetId('pr-review'), eventType: 'update_failed', category: 'edit', source: 'SP', result: 'failed' }).id,
    SP.addAuditEvent({ skillId: SP.resolveAssetId('pr-review'), eventType: 'update_rollback_completed', category: 'edit', source: 'SP', result: 'rolled-back' }).id,
    SP.addAuditEvent({ skillId: SP.resolveAssetId('pr-review'), eventType: 'update_rollback_failed', category: 'edit', source: 'SP', result: 'rollback-failed' }).id
  ]);
  await gotoActivity();
  await page.click('[data-subview="history"]');
  const body = await page.locator('#tbody').innerText();
  assert(/失败/.test(body) && /已回滚/.test(body) && /回滚失败/.test(body), body.slice(0, 200));
  await page.locator(`#tbody tr[data-id="${ids[0]}"]`).click();
  const props = await page.locator('#e-props').innerHTML();
  assert(!/>\s*content\s*</i.test(props), 'drawer must not expose content property');
});

test('G-20 drawer excludes SKILL body not note marker', async () => {
  await freshPage(); await resetState();
  const seed = await evalSP(() => {
    const f = SP.__test.getRawState().files.find(x => x.relativePath === 'SKILL.md' && x.content);
    return { hash: f && f.contentHash, snippet: f && String(f.content).slice(0, 80) };
  });
  const id = await evalSP(() => SP.addAuditEvent({
    skillId: SP.resolveAssetId('pr-review'), eventType: 'apply_change', category: 'edit',
    source: 'Skill Panel', result: 'completed', note: 'note REMOTE_UPDATE_MARKER ok'
  }).id);
  await gotoActivity();
  await page.click('[data-subview="history"]');
  await page.locator(`#tbody tr[data-id="${id}"]`).click();
  const drawer = await page.locator('#drawer-body').innerText();
  const list = await page.locator('#tbody').innerText();
  assert(drawer.includes('REMOTE_UPDATE_MARKER'), 'note marker allowed in drawer');
  if (seed.snippet && seed.snippet.length > 20) assert(!drawer.includes(seed.snippet.slice(0, 40)), 'raw skill body leaked');
  if (seed.hash) assert(!list.includes(seed.hash), 'list leaked content hash');
});

test('G-21 activity restores filters after reload', async () => {
  await freshPage(); await resetState();
  await gotoActivity();
  await page.click('[data-subview="history"]');
  await page.click('[data-range="30"]');
  await page.click('[data-kind="usage"]');
  await page.fill('#q', 'pr');
  await page.click('[data-sort="earliest"]');
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.locator('[data-subview="history"].active').count() === 1);
  assert(await page.locator('[data-range="30"].active').count() === 1);
  assert(await page.locator('[data-kind="usage"].active').count() === 1);
  assert(await page.locator('[data-sort="earliest"].active').count() === 1);
  assert((await page.inputValue('#q')) === 'pr');
});

test('G-22 activity empty states for pending and history', async () => {
  await freshPage(); await resetState();
  await evalSP(() => {
    const s = SP.__test.getRawState();
    s.auditEvents = s.auditEvents.filter(e => e.category === 'usage');
    SP.__test.saveState();
  });
  await gotoActivity();
  await page.click('[data-subview="pending"]');
  assert(/没有待处理|暂无活动|筛选无结果/.test(await page.locator('#tbody').innerText()));
  await evalSP(() => { SP.__test.getRawState().auditEvents = []; SP.__test.saveState(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-subview="history"]');
  assert(/历史记录为空|暂无活动|筛选无结果/.test(await page.locator('#tbody').innerText()));
});

test('G-23 all defaultSettings keys have control or readonly display', async () => {
  await freshPage(); await resetState();
  await gotoSettings();
  const keys = await evalSP(() => Object.keys(SP.getSettings()));
  const missing = [];
  for (const key of keys) {
    const ok = await page.evaluate(({ key, ro }) => {
      if (document.querySelector(`[data-setting="${key}"]`) || document.getElementById(key)) return true;
      const sel = ro[key];
      if (sel && document.querySelector(sel)) return true;
      return false;
    }, { key, ro: SETTINGS_READONLY });
    if (!ok) missing.push(key);
  }
  assert(!missing.length, 'missing controls: ' + missing.join(', '));
});

test('G-24 language or density persists after reload', async () => {
  await freshPage(); await resetState();
  await gotoSettings('appear');
  await page.selectOption('#density', 'compact');
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.inputValue('#density') === 'compact');
  const stored = await evalSP(() => SP.getSettings().density);
  assert(stored === 'compact', String(stored));
});

test('G-25 reset settings requires confirm dialog', async () => {
  await freshPage(); await resetState();
  await evalSP(() => {
    SP.setSetting('language', 'en');
    SP.setSetting('theme', 'dark');
    SP.setSetting('density', 'compact');
    SP.setSetting('defaultPage', 'insights');
    SP.setSetting('snapshotsPerSkill', 50);
    SP.setSetting('archiveDirectory', '~/Custom/Archive');
    SP.setSetting('cleanupWindowDays', 60);
    SP.setSetting('usageRetentionDays', 90);
    SP.setSetting('savePromptContent', true);
    SP.setSetting('wordWrap', false);
    SP.setSetting('showCodexUsageNotice', false);
  });
  await gotoSettings('about');
  page.once('dialog', d => d.accept());
  await page.click('#btn-reset-settings');
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.SP);
  const restored = await evalSP(() => {
    const cur = SP.getSettings();
    const def = {
      language: 'system', theme: 'system', density: 'standard',
      defaultPage: 'library', restoreLastView: true,
      defaultCreateLocationId: 'claude', scanSubdirectories: true,
      followSymlinks: false, ignoreHidden: true,
      fileChangeDetection: true, autosaveDrafts: true, showDiffBeforeApply: true,
      snapshotsPerSkill: 20, autoCleanupSnapshots: true,
      archiveDirectory: '~/Library/Application Support/Skill Panel/Archive',
      cleanupWindowDays: 90, ignoreFavorite: true,
      ignoreRecentlyEdited: true, ignoreUserCreated: true,
      finalSnapshotOnDelete: true, usageRetentionDays: 180,
      savePromptContent: false, saveFilenames: true,
      showCodexUsageNotice: true, wordWrap: true
    };
    const mismatches = Object.keys(def).filter(k => JSON.stringify(cur[k]) !== JSON.stringify(def[k]));
    return { mismatches, cur };
  });
  assert(!restored.mismatches.length, 'defaults not restored: ' + JSON.stringify(restored.mismatches) + ' ' + JSON.stringify(restored.cur));
});

test('G-26 dirs-list from hosts with scan-meta getHosts', async () => {
  await freshPage(); await resetState();
  await gotoSettings('dirs');
  const n = await page.locator('[data-host-id]').count();
  const hosts = await evalSP(() => SP.getHosts().length);
  assert(n === hosts && n >= 1, 'hosts=' + hosts + ' dom=' + n);
  const meta = await page.locator('#scan-meta').innerText();
  assert(/已管理目录|Managed directories/.test(meta), meta);
  assert(!/SP\.getHosts\(\)/.test(meta), 'must not show SP.getHosts() in UI: ' + meta);
  const firstId = await page.locator('[data-host-id]').first().getAttribute('data-host-id');
  const host = await evalSP((id) => SP.getHosts().find(h => h.id === id), firstId);
  assert(host && host.path, 'host fields from Public API');
  const txt = await page.locator(`[data-host-id="${firstId}"]`).innerText();
  assert(txt.includes(host.path) || txt.includes(host.name), txt.slice(0, 120));
});

test('G-27 settings.html no SP.__test or getRawState assignment', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'settings.html'), 'utf8');
  assert(!/SP\.__test/.test(src), 'settings must not use SP.__test');
  assert(!/getRawState\s*=/.test(src) && !/=\s*getRawState/.test(src), 'direct getRawState assignment');
});

test('G-28 host path and permission shown in dirs-list', async () => {
  await freshPage(); await resetState();
  await gotoSettings('dirs');
  const txt = await page.locator('#dirs-list').innerText();
  assert(/权限|granted|不足|正常/.test(txt), txt.slice(0, 120));
  assert(/\/|~/.test(txt), 'path missing: ' + txt.slice(0, 80));
});

test('G-29 settings danger zone exists', async () => {
  await freshPage(); await resetState();
  await gotoSettings('about');
  assert(await page.locator('[data-danger-zone]').count() === 1);
});

test('G-30 theme change applies dark class or storage', async () => {
  await freshPage(); await resetState();
  await gotoSettings('appear');
  await page.selectOption('#theme', 'dark');
  await page.waitForTimeout(200);
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const stored = await evalSP(() => SP.getSettings().theme);
  assert(stored === 'dark', 'state theme=' + stored);
  assert(dark, 'dark class missing');
});

test('G-31 setSetting theme nope returns ok false', async () => {
  await freshPage(); await resetState();
  await gotoSettings();
  const r = await evalSP(() => SP.setSetting('theme', 'nope'));
  assert(r && r.ok === false, JSON.stringify(r));
});

test('G-32 invalid setting shows toast failure', async () => {
  await freshPage(); await resetState();
  await gotoSettings('appear');
  const before = await evalSP(() => SP.getSettings().theme);
  await page.evaluate(() => {
    const sel = document.getElementById('theme');
    const opt = document.createElement('option');
    opt.value = 'nope';
    opt.textContent = 'nope';
    sel.appendChild(opt);
  });
  await page.selectOption('#theme', 'nope');
  await page.waitForTimeout(300);
  const toast = await page.locator('#toast.show').innerText().catch(() => '');
  assert(/无效|失败|未知|invalid|fail/i.test(toast), 'toast=' + toast);
  const after = await evalSP(() => SP.getSettings().theme);
  assert(after === before, 'state should rollback: ' + after);
  const ui = await page.inputValue('#theme');
  assert(ui === before, 'control should rollback: ' + ui);
});

test('G-33 index nav no cases link in normal mode', async () => {
  await freshPage(); await resetState(false);
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  const hrefs = await page.locator('.sidebar .nav a').evaluateAll(a => a.map(x => x.getAttribute('href') || ''));
  assert(!hrefs.some(h => /cases\.html/i.test(h)), JSON.stringify(hrefs));
});

test('G-34 cases without dev redirects or blocks cards', async () => {
  await freshPage();
  await page.goto(BASE + '/cases.html', { waitUntil: 'networkidle' });
  const url = page.url();
  const cards = await page.locator('#cases .case').count();
  const body = await page.locator('body').innerText();
  assert(cards === 0 || /index\.html/.test(url) || /开发模式不可用/.test(body), 'cases accessible without dev');
});

test('G-35 ?dev=1 can access cases', async () => {
  await freshPage(); await resetState();
  await page.goto(BASE + '/cases.html?dev=1', { waitUntil: 'networkidle' });
  assert(await page.locator('#cases .case').count() >= 12, 'expected case cards');
});

test('G-36 sp-dev=1 localStorage can access cases', async () => {
  await freshPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.setItem('sp-dev', '1'); SP.resetState(); });
  await page.goto(BASE + '/cases.html', { waitUntil: 'networkidle' });
  assert(await page.locator('#cases .case').count() >= 12);
});

test('G-37 dev mode badge present on cases', async () => {
  await freshPage(); await resetState();
  await page.goto(BASE + '/cases.html?dev=1', { waitUntil: 'networkidle' });
  assert(await page.locator('[data-dev-mode-badge]').count() === 1);
});

test('G-38 formal pages nav has no cases links', async () => {
  await freshPage(); await resetState(false);
  for (const p of ['settings.html', 'insights.html', 'activity.html']) {
    await page.goto(BASE + '/' + p, { waitUntil: 'networkidle' });
    const n = await page.locator('a[href*="cases"]').count();
    assert(n === 0, p + ' has cases link count ' + n);
  }
});

test('G-39 cases-dev-guard script before case content', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'cases.html'), 'utf8');
  const guard = src.indexOf('id="cases-dev-guard"');
  const cases = src.indexOf('id="cases"');
  assert(guard >= 0 && cases > guard, 'guard must precede #cases');
});

test('G-40 update install exist and shared has prepareUpdate', async () => {
  assert(fs.existsSync(path.join(ROOT, 'update.html')));
  assert(fs.existsSync(path.join(ROOT, 'install.html')));
  const src = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
  assert(/function prepareUpdate/.test(src) && /prepareUpdate,/.test(src));
});

test('G-41 phase-f41 suite still 25 passed', async () => {
  const f41 = path.join(ROOT, 'phase-f41-targeted-tests.js');
  const n = (fs.readFileSync(f41, 'utf8').match(/^test\(/gm) || []).length;
  assert(n === 25, 'expected 25 tests in f41, got ' + n);
  const result = spawnSync(process.execPath, [f41], { cwd: ROOT, env: process.env, encoding: 'utf8' });
  const out = (result.stdout || '') + (result.stderr || '');
  const totals = [...out.matchAll(/(\d+)\s+passed,\s*(\d+)\s+failed/g)];
  const last = totals[totals.length - 1];
  assert(result.status === 0, 'f41 exit=' + result.status + '\n' + out.slice(-800));
  assert(last && Number(last[1]) === 25 && Number(last[2]) === 0, 'f41 totals=' + (last && last[0]));
});

test('G-42 phase-f4 suite still 22 passed', async () => { spawnSuite('phase-f4-targeted-tests.js', 22); });

test('G-43 run-all-tests lists 20 suites including phase-g', async () => {
  const runner = fs.readFileSync(path.join(ROOT, 'run-all-tests.js'), 'utf8');
  const suites = runner.match(/suites = \[([\s\S]*?)\];/)[1].match(/'[^']+\.js'/g);
  assert(suites && suites.length === 20, 'expected 20 suites, got ' + (suites && suites.length));
  assert(runner.includes("'phase-g-targeted-tests.js'"));
});

test('G-44 public summaries omit content field', async () => {
  await freshPage(); await resetState();
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const bad = (arr, label) => arr.filter(x => x && Object.prototype.hasOwnProperty.call(x, 'content')).map(x => label);
    return {
      assets: bad(SP.getAssets(), 'asset'),
      drafts: bad(SP.getDraftSummaries(id), 'draft'),
      snaps: bad(SP.getSnapshots(id), 'snap')
    };
  });
  assert(!r.assets.length && !r.drafts.length && !r.snaps.length, JSON.stringify(r));
});

test('G-45 dark mode pages remain readable', async () => {
  await freshPage(); await resetState();
  await evalSP(() => SP.setSetting('theme', 'dark'));
  for (const p of ['insights.html', 'activity.html', 'settings.html']) {
    await page.goto(BASE + '/' + p + '?dev=1', { waitUntil: 'networkidle' });
    const info = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      const parse = (c) => {
        const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
      };
      const lum = ({ r, g, b }) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const fg = parse(cs.color);
      const bg = parse(cs.backgroundColor);
      if (!fg || !bg || fg.a === 0 || bg.a === 0) return { ok: false, color: cs.color, bg: cs.backgroundColor };
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      return { ok: ratio >= 2.5, ratio, color: cs.color, bg: cs.backgroundColor };
    });
    assert(info.ok, p + ' contrast=' + JSON.stringify(info));
  }
});

test('G-46 settings primary buttons visible at 1280x800', async () => {
  await freshPage(); await resetState();
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoSettings('dirs');
  assert(await page.locator('#btn-add-dir').isVisible());
  await gotoSettings('about');
  assert(await page.locator('#btn-reset-settings').isVisible());
});

test('G-47 formal nav has exactly 4 workspace links', async () => {
  await freshPage(); await resetState(false);
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  const links = await page.locator('.sidebar .nav a').evaluateAll(a => a.map(x => (x.textContent || '').trim()));
  assert(links.length === 4, JSON.stringify(links));
  ['Library', 'Insights', 'Activity', 'Settings'].forEach(l => assert(links.some(t => t.includes(l)), l));
});

test('G-48 normal mode no clickable cases on main pages', async () => {
  await freshPage(); await resetState(false);
  for (const p of ['index.html', 'settings.html', 'insights.html', 'activity.html']) {
    await page.goto(BASE + '/' + p, { waitUntil: 'networkidle' });
    const clickable = await page.locator('a[href*="cases"], button[data-open-cases], #btn-open-cases').count();
    assert(clickable === 0, p + ' has cases entry');
  }
});

test('G-49 resolve removes pending row keeps history', async () => {
  await freshPage(); await resetState();
  const info = await evalSP(() => {
    const open = SP.getOpenPendingActivityEvents();
    const e = open.find(x => x.taskId) || open[0];
    return e ? { id: e.id, taskId: e.taskId, count: SP.getOpenPendingTaskCount() } : null;
  });
  assert(info && info.taskId, 'need open pending with taskId');
  await gotoActivity();
  await page.click('[data-subview="pending"]');
  assert(await page.locator(`#tbody tr[data-id="${info.id}"]`).count() === 1);
  await page.locator(`#tbody tr[data-id="${info.id}"]`).click();
  await page.click(`[data-resolve="${info.id}"]`);
  await page.click('#resolve-ok');
  await page.waitForTimeout(200);
  assert(await page.locator(`#tbody tr[data-id="${info.id}"]`).count() === 0, 'pending row should disappear');
  const after = await evalSP(({ id, taskId, prevCount }) => ({
    count: SP.getOpenPendingTaskCount(),
    stillOpen: SP.getOpenPendingActivityEvents().some(e => e.id === id),
    inAll: SP.getActivityEvents().some(e => e.id === id),
    resolveEv: SP.getActivityEvents().some(e => e.eventType === 'resolve' && e.taskId === taskId),
    prevCount
  }), { id: info.id, taskId: info.taskId, prevCount: info.count });
  assert(after.count === after.prevCount - 1, 'count ' + after.count + ' vs ' + (after.prevCount - 1));
  assert(!after.stillOpen && after.inAll && after.resolveEv, JSON.stringify(after));
  await page.click('[data-subview="history"]');
  assert(await page.locator(`#tbody tr[data-id="${info.id}"]`).count() === 1, 'history keeps original');
});

test('G-50 archive ignore resolves task and drops candidate', async () => {
  await freshPage(); await resetState();
  const before = await evalSP(() => {
    const list = SP.getArchiveCandidates();
    const c = list[0];
    return c ? { taskId: c.task.id, skillId: c.skill.id, n: list.length, rules: SP.getIgnoreRules().length } : null;
  });
  assert(before, 'need archive candidate');
  await gotoInsights();
  await clickTab('archive');
  await page.click(`.act-ignore[data-task-id="${before.taskId}"]`);
  await page.waitForTimeout(200);
  const after = await evalSP(({ taskId, skillId, n, rules }) => {
    const task = SP.__test.getRawState().pendingTasks.find(t => t.id === taskId);
    return {
      n: SP.getArchiveCandidates().length,
      rules: SP.getIgnoreRules().length,
      status: task && task.status,
      ignored: SP.getActivityEvents().some(e => e.eventType === 'suggestion_ignored' && e.taskId === taskId),
      ruleOk: SP.getIgnoreRules().some(r => r.skillId === skillId && r.ruleType === 'suggestion'),
      prevN: n,
      prevRules: rules
    };
  }, before);
  assert(after.n === after.prevN - 1, 'candidates ' + after.n);
  assert(after.status === 'resolved' && after.ignored && after.ruleOk && after.rules === after.prevRules + 1, JSON.stringify(after));
});

test('G-51 file ignore resolves only matching task', async () => {
  await freshPage(); await resetState();
  const info = await evalSP(() => {
    const list = SP.getFileIssues().filter(x => ['path_missing', 'permission_denied'].includes(x.task.taskType));
    const item = list[0];
    if (!item) return null;
    const others = SP.__test.getRawState().pendingTasks.filter(t => t.skillId === item.skill.id && t.id !== item.task.id && t.status === 'open').map(t => t.id);
    return { taskId: item.task.id, skillId: item.skill.id, others, openBefore: SP.__test.getRawState().pendingTasks.filter(t => t.status === 'open').length };
  });
  assert(info, 'need ignorable file issue');
  await gotoInsights();
  await clickTab('file');
  await page.click(`.act-ignore[data-task-id="${info.taskId}"]`);
  await page.waitForTimeout(200);
  const after = await evalSP(({ taskId, others }) => {
    const s = SP.__test.getRawState();
    return {
      target: s.pendingTasks.find(t => t.id === taskId)?.status,
      othersOpen: others.filter(id => s.pendingTasks.find(t => t.id === id)?.status === 'open'),
      othersExpected: others.length
    };
  }, info);
  assert(after.target === 'resolved', JSON.stringify(after));
  assert(after.othersOpen.length === after.othersExpected, 'must not batch-resolve unrelated: ' + JSON.stringify(after));
});

test('G-52 resetSettingsToDefaults equals defaultSettings', async () => {
  await freshPage(); await resetState();
  const expected = await evalSP(() => SP.getSettings());
  const flipped = await evalSP(() => {
    const hosts = SP.getHosts().filter(h => h.hostType !== 'archive' && h.enabled !== false);
    const altHost = hosts.find(h => h.id !== 'claude') || hosts[0];
    const patch = {
      language: 'en',
      theme: 'dark',
      density: 'compact',
      defaultPage: 'insights',
      restoreLastView: false,
      defaultCreateLocationId: altHost.id,
      scanSubdirectories: false,
      followSymlinks: true,
      ignoreHidden: false,
      fileChangeDetection: false,
      autosaveDrafts: false,
      showDiffBeforeApply: false,
      snapshotsPerSkill: 50,
      autoCleanupSnapshots: false,
      archiveDirectory: '~/Custom/Archive',
      cleanupWindowDays: 60,
      ignoreFavorite: false,
      ignoreRecentlyEdited: false,
      ignoreUserCreated: false,
      finalSnapshotOnDelete: false,
      usageRetentionDays: 90,
      savePromptContent: true,
      saveFilenames: false,
      showCodexUsageNotice: false,
      wordWrap: false
    };
    const results = Object.entries(patch).map(([k, v]) => ({ k, r: SP.setSetting(k, v) }));
    const failed = results.filter(x => !x.r || x.r.ok === false);
    SP.resetSettingsToDefaults();
    return {
      failed,
      after: SP.getSettings(),
      expectedKeys: Object.keys(patch)
    };
  });
  assert(!flipped.failed.length, 'flip failed: ' + JSON.stringify(flipped.failed));
  assert(
    JSON.stringify(flipped.after) === JSON.stringify(expected),
    'after reset mismatch: ' + JSON.stringify({ expected, after: flipped.after })
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP);
  const afterReload = await evalSP(() => SP.getSettings());
  assert(
    JSON.stringify(afterReload) === JSON.stringify(expected),
    'after reload mismatch: ' + JSON.stringify({ expected, afterReload })
  );
});

test('G-53 invalid settings rejected without state change', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const snap = JSON.stringify(SP.getSettings());
    const tries = [
      SP.setSetting('defaultPage', 'settings'),
      SP.setSetting('defaultCreateLocationId', 'no-such-host'),
      SP.setSetting('archiveDirectory', '   '),
      SP.setSetting('snapshotsPerSkill', 15),
      SP.setSetting('cleanupWindowDays', 45),
      SP.setSetting('usageRetentionDays', 1),
      SP.setSetting('restoreLastView', 'yes'),
      SP.setSetting('language', 1),
      SP.setSetting('notARealSetting', true)
    ];
    return {
      allRejected: tries.every(t => t && t.ok === false),
      unknown: tries[tries.length - 1].error === 'unknown_setting',
      unchanged: JSON.stringify(SP.getSettings()) === snap
    };
  });
  assert(r.allRejected && r.unknown && r.unchanged, JSON.stringify(r));
});

test('G-54 english language persists across refresh', async () => {
  await freshPage(); await resetState();
  await gotoSettings('appear');
  await page.selectOption('#language', 'en');
  await page.waitForTimeout(200);
  await gotoInsights();
  const lead = await page.locator('[data-i18n="insights.lead"]').innerText();
  assert(/Pending task queue|candidate signal/i.test(lead), lead);
  const tab = await page.locator('.tab[data-tab="archive"]').innerText();
  assert(/Archive/i.test(tab), tab);
  await page.reload({ waitUntil: 'networkidle' });
  const lead2 = await page.locator('[data-i18n="insights.lead"]').innerText();
  assert(/Pending task queue|candidate signal/i.test(lead2), lead2);
  assert(await evalSP(() => SP.getSettings().language) === 'en');
  assert(await evalSP(() => SP.lang) === 'en');
  await gotoSettings('appear');
  await page.selectOption('#language', 'zh');
  await page.waitForTimeout(200);
  await gotoInsights();
  const leadZh = await page.locator('[data-i18n="insights.lead"]').innerText();
  assert(/待处理任务队列/.test(leadZh), leadZh);
});

test('G-55 select change calls setSetting once and syncs switches', async () => {
  await freshPage(); await resetState();
  await gotoSettings('appear');
  const calls = await page.evaluate(async () => {
    let n = 0;
    const orig = SP.setSetting;
    SP.setSetting = function (...args) { n++; return orig.apply(this, args); };
    const sel = document.getElementById('density');
    sel.value = 'compact';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    SP.setSetting = orig;
    return n;
  });
  assert(calls === 1, 'setSetting calls=' + calls);
  await gotoSettings('sources');
  await page.locator('[data-setting="savePromptContent"]').first().click();
  await page.waitForTimeout(100);
  const synced = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-setting="savePromptContent"]')];
    return { n: nodes.length, on: nodes.map(x => x.classList.contains('on')) };
  });
  assert(synced.n >= 2 && synced.on.every(v => v === synced.on[0]), JSON.stringify(synced));
});

test('G-56 malicious strings render as text only', async () => {
  await freshPage(); await resetState();
  const id = await evalSP(() => {
    const skillId = SP.resolveAssetId('pr-review');
    const asset = SP.__test.getRawState().assets.find(a => a.id === skillId);
    asset.displayName = '<img src=x onerror=window.__xss=1>XSS';
    const ev = SP.addAuditEvent({
      skillId, eventType: 'path_missing', category: 'pending', source: '<script>window.__xss=1</script>',
      result: 'pending', note: '<b id="xss-note">note</b>', taskId: null
    });
    SP.__test.saveState();
    return ev.id;
  });
  await gotoActivity();
  await page.click('[data-subview="pending"]');
  await page.locator(`#tbody tr[data-id="${id}"]`).click();
  const bad = await page.evaluate(() => ({
    xss: window.__xss === 1,
    img: !!document.querySelector('#tbody img, #drawer img, #e-props img'),
    scriptExec: !!document.querySelector('#xss-note'),
    noteText: document.getElementById('e-note')?.textContent || '',
    sourceText: document.getElementById('e-props')?.innerText || ''
  }));
  assert(!bad.xss && !bad.img && !bad.scriptExec, JSON.stringify(bad));
  assert(bad.noteText.includes('<b id="xss-note">note</b>') || bad.noteText.includes('note'), bad.noteText);
  assert(bad.sourceText.includes('<script>') || bad.sourceText.includes('script'), bad.sourceText.slice(0, 200));
});

(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'zh-CN'
  });
  let passed = 0, failed = 0;
  console.log('=== Phase G Targeted Tests ===\n');
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
