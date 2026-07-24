/**
 * Phase D.2 targeted tests — file content access boundary
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { chromiumLaunchOptions } = require('./chrome-launch');

const BASE = 'http://localhost:8081';
const ROOT = __dirname;

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
  });
  await page.goto(BASE + '/index.html?dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getAssetDetail && SP.getFileDetail);
  await page.evaluate(() => SP.resetState());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.getAssetDetail);
}

async function evalSP(fn, ...args) {
  return page.evaluate(fn, ...args);
}

async function openDetail(name) {
  const id = await evalSP((n) => SP.resolveAssetId(n), name);
  await page.goto(BASE + '/skill-detail.html?skill=' + encodeURIComponent(id) + '&dev=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && document.getElementById('btn-edit'));
}

function hasContentLeak(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'content')) return true;
  if (Object.prototype.hasOwnProperty.call(obj, 'contentForView')) return true;
  return false;
}

test('1 Permission Denied getInstanceFiles has no content', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-permission-denied');
    const inst = SP.getAssetInstances(id)[0];
    const files = SP.getInstanceFiles(inst.id);
    return {
      count: files.length,
      leak: files.some(f => 'content' in f || 'contentForView' in f),
      sample: files[0]
    };
  });
  assert(r.count > 0, 'Expected files');
  assert(!r.leak, 'getInstanceFiles leaked content');
  assert(!hasContentLeak(r.sample), 'sample has content keys');
});

test('2 Permission Denied getAssetFiles has no content', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const files = SP.getAssetFiles(SP.resolveAssetId('demo-permission-denied'));
    return { count: files.length, leak: files.some(f => 'content' in f || 'contentForView' in f) };
  });
  assert(r.count > 0 && !r.leak, JSON.stringify(r));
});

test('3 Permission Denied getAssetDetail.files has no content', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const detail = SP.getAssetDetail(SP.resolveAssetId('demo-permission-denied'));
    return {
      count: detail.files.length,
      leak: detail.files.some(f => 'content' in f || 'contentForView' in f),
      snapLeak: detail.snapshots.some(s => Array.isArray(s.files) || 'files' in s)
    };
  });
  assert(r.count > 0 && !r.leak, 'detail.files leaked content');
  assert(!r.snapLeak, 'detail.snapshots must be summaries without files[]');
});

test('4 getFiles/getFile never expose body', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const all = SP.getFiles();
    const one = SP.getFile(all[0].id);
    return {
      allLeak: all.some(f => 'content' in f || 'contentForView' in f),
      oneLeak: 'content' in one || 'contentForView' in one,
      noRaw: typeof SP.getFileRaw !== 'function',
      noRawInternal: typeof SP.getFileRawInternal !== 'function'
    };
  });
  assert(!r.allLeak && !r.oneLeak, 'public list APIs leaked content');
  assert(r.noRaw && r.noRawInternal, 'raw accessors must not be exported');
});

test('5 Readable content only via getFileDetail', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    const meta = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const detail = SP.getFileDetail(meta.id);
    return {
      listHasContent: 'content' in meta,
      status: detail.contentAccessStatus,
      content: detail.content,
      contentForView: detail.contentForView,
      read: detail.readAccess
    };
  });
  assert(!r.listHasContent, 'list still has content key');
  assert(r.read && r.status === 'readable', 'expected readable');
  assert(typeof r.content === 'string' && r.content.length > 0, 'getFileDetail should return body');
  assert(r.contentForView === r.content, 'contentForView mismatch');
});

test('6 Missing list APIs metadata only', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const inst = SP.getAssetInstances(id)[0];
    const lists = [
      SP.getInstanceFiles(inst.id),
      SP.getAssetFiles(id),
      SP.getFiles({ instanceId: inst.id }),
      SP.getAssetDetail(id).files
    ];
    const metaOnly = lists.every(arr => arr.length && arr.every(f => !('content' in f) && !('contentForView' in f)));
    const file = lists[0][0];
    const detail = SP.getFileDetail(file.id);
    return {
      metaOnly,
      detailContent: detail.content,
      detailView: detail.contentForView,
      status: detail.contentAccessStatus
    };
  });
  assert(r.metaOnly, 'Missing lists leaked content');
  assert(r.detailContent == null && r.detailView == null, 'Missing detail must null body');
  assert(/historical|denied|permission/i.test(r.status), 'status: ' + r.status);
});

test('7 Binary never returns body', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const binary = SP.getAssetFiles(id).find(f => f.fileType === 'binary' || (f.relativePath || '').includes('icon.png'));
    const detail = SP.getFileDetail(binary.id);
    const lists = [SP.getFile(binary.id), binary];
    return {
      found: !!binary,
      listLeak: lists.some(f => 'content' in f && f.content != null),
      content: detail.content,
      view: detail.contentForView,
      status: detail.contentAccessStatus,
      isBinary: detail.isBinary
    };
  });
  assert(r.found && r.isBinary, 'binary missing');
  assert(r.content == null && r.view == null, 'binary body leaked');
  assert(/binary/i.test(r.status), 'status: ' + r.status);
});

test('8 getAssetSnapshots has no file bodies', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const snaps = SP.getAssetSnapshots(SP.resolveAssetId('pr-review'));
    return {
      count: snaps.length,
      hasFilesKey: snaps.some(s => 'files' in s),
      sample: snaps[0]
    };
  });
  assert(r.count > 0, 'no snapshots');
  assert(!r.hasFilesKey, 'summary must not include files[]');
  assert(r.sample.fileCount != null && r.sample.packageSizeBytes != null, 'summary fields missing');
});

test('9 Permission Denied package snapshot is metadata-only', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-permission-denied');
    const inst = SP.getAssetInstances(id)[0];
    const created = SP.createPackageSnapshot({ assetId: id, instanceId: inst.id, note: 'd2-denied', source: 'test' });
    const snapId = created.snapshotId;
    const summary = SP.getAssetSnapshots(id).find(s => s.id === snapId);
    const detail = SP.getSnapshotDetail(snapId);
    const bodies = (SP.__test.getRawState().snapshots.find(s => s.id === snapId).files || []).map(f => f.content);
    const fileDetail = SP.getSnapshotFileDetail(snapId, detail.files[0].relativePath);
    return {
      capture: summary.contentCaptureStatus,
      captured: summary.capturedFileCount,
      metaOnly: summary.metadataOnlyFileCount,
      allNull: bodies.every(c => c == null),
      fileContent: fileDetail.content,
      fileStatus: fileDetail.contentAccessStatus,
      publicHasNoFiles: !('files' in (created.snapshot || {}))
    };
  });
  assert(r.capture === 'metadata-only', 'capture: ' + r.capture);
  assert(r.captured === 0 && r.metaOnly > 0, JSON.stringify(r));
  assert(r.allNull && r.fileContent == null, 'denied snapshot returned body');
});

test('10 Readable package snapshot keeps text body', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    const created = SP.createPackageSnapshot({ assetId: id, instanceId: inst.id, note: 'd2-ok', source: 'test' });
    const snapId = created.snapshotId;
    const raw = SP.__test.getRawState().snapshots.find(s => s.id === snapId);
    const skill = raw.files.find(f => f.relativePath === 'SKILL.md');
    const binary = raw.files.find(f => f.fileType === 'binary');
    const fileDetail = SP.getSnapshotFileDetail(snapId, 'SKILL.md');
    return {
      capture: raw.contentCaptureStatus,
      captured: raw.capturedFileCount,
      skillContent: skill && skill.content,
      binaryContent: binary && binary.content,
      binaryStatus: binary && binary.contentCaptureStatus,
      readable: fileDetail.readAccess,
      view: fileDetail.contentForView,
      publicHasNoContent: created.snapshot && !('files' in created.snapshot)
    };
  });
  assert(r.capture === 'partial' || r.capture === 'full', 'capture: ' + r.capture);
  assert(typeof r.skillContent === 'string' && r.skillContent.length > 0, 'text body missing');
  assert(r.binaryContent == null && r.binaryStatus === 'metadata-only', 'binary should be metadata-only');
  assert(r.readable && typeof r.view === 'string' && r.view.length > 0, 'snapshot file detail failed');
});

test('11 Unreadable cannot open read-only Editor Session', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-permission-denied');
    const inst = SP.getAssetInstances(id)[0];
    return SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'read-only' });
  });
  assert(!r.ok && r.code === 'permission-denied', JSON.stringify(r));
});

test('12 Readable but not writable opens read-only only', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    // Ensure read grant without write
    SP.__test.patchRawState(state => {
      state.permissionGrants
        .filter(g => g.scopeId === inst.id || (g.scopeType === 'directory' && g.scopePath))
        .forEach(g => { g.writeAccess = false; g.readAccess = true; g.status = 'active'; });
    });
    const ro = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'read-only' });
    const ed = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    return { ro, ed, write: SP.getInstancePermission(inst.id).writeAccess };
  });
  assert(r.ro.ok && r.ro.mode === 'read-only', JSON.stringify(r.ro));
  assert(!r.ed.ok && r.ed.code === 'read-only', JSON.stringify(r.ed));
});

test('13 Read-write opens editable Session', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, scopeType: 'instance', purpose: 'd2' });
    return SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
  });
  assert(r.ok && r.mode === 'editable' && r.writeAccess && r.editableFileIds.length > 0, JSON.stringify(r));
});

test('14 Missing cannot open Editor Session', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const inst = SP.getAssetInstances(id)[0];
    return SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'read-only' });
  });
  assert(!r.ok && r.code === 'missing', JSON.stringify(r));
});

test('15 Detail unread does not call openSkillEditor', async () => {
  await freshPage();
  await resetState();
  await openDetail('demo-permission-denied');
  const label = await page.locator('#btn-edit').textContent();
  const disabled = await page.locator('#btn-edit').isDisabled();
  assert(/需要读取权限/.test(label), 'label: ' + label);
  assert(disabled, 'edit should be disabled');
  const called = await page.evaluate(() => {
    let hit = false;
    const orig = SP.openSkillEditor;
    SP.openSkillEditor = function () { hit = true; };
    document.getElementById('btn-edit').click();
    SP.openSkillEditor = orig;
    return hit;
  });
  assert(!called, 'openSkillEditor was called without read access');
});

test('16 Detail Missing disables Finder', async () => {
  await freshPage();
  await resetState();
  await openDetail('demo-path-missing');
  const disabled = await page.locator('#btn-folder').isDisabled();
  assert(disabled, 'Finder should be disabled for Missing');
  const toast = await page.evaluate(() => {
    let msg = null;
    const orig = SP.toast;
    SP.toast = (m) => { msg = m; };
    document.getElementById('btn-folder').click();
    SP.toast = orig;
    return msg;
  });
  // Disabled button may not fire click; either way must not claim Finder opened
  if (toast) assert(!/已在 Finder|真实|成功打开/.test(toast), 'toast: ' + toast);
});

test('17 Phase D.1 suite still wired (22 checks via import markers)', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'phase-d1-targeted-tests.js'), 'utf8');
  const count = (src.match(/^test\(/gm) || []).length;
  assert(count >= 22, 'D.1 tests missing: ' + count);
  assert(fs.existsSync(path.join(ROOT, 'phase-d1-targeted-tests.js')), 'd1 missing');
});

test('18 Public API surface for D.2', async () => {
  await freshPage();
  await resetState();
  const r = await evalSP(() => ({
    snapDetail: typeof SP.getSnapshotDetail,
    snapFile: typeof SP.getSnapshotFileDetail,
    editor: typeof SP.openEditorSession,
    noStateFiles: true
  }));
  assert(r.snapDetail === 'function' && r.snapFile === 'function' && r.editor === 'function', JSON.stringify(r));
  const src = fs.readFileSync(path.join(ROOT, 'skill-detail-app.js'), 'utf8');
  assert(!/getState\(\)\.files/.test(src), 'Detail page reads getState().files');
  assert(!/getState\(\)\.snapshots/.test(src), 'Detail page reads getState().snapshots');
});

(async () => {
  console.log('=== Phase D.2 Targeted Tests ===\n');
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('✅ ' + t.name);
      passed++;
    } catch (e) {
      console.log('❌ ' + t.name);
      console.log('   ' + e.message);
      failed++;
    }
  }
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
