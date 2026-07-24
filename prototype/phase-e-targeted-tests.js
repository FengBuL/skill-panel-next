/**
 * Phase E targeted tests — E.0 content boundary + Editor/Conflict flows
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
  await page.waitForFunction(() => window.SP && SP.openEditorSession);
  await page.evaluate(() => SP.resetState());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.__test && SP.openEditorSession);
}
async function evalSP(fn, ...args) { return page.evaluate(fn, ...args); }

test('E0-1 getState() strips file content', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const st = SP.getState();
    return {
      hasFiles: st.files.length > 0,
      leak: st.files.some(f => 'content' in f && f.content != null),
      rawHas: SP.__test.getRawState().files.some(f => f.content != null && f.content !== '')
    };
  });
  assert(r.hasFiles && !r.leak && r.rawHas, JSON.stringify(r));
});

test('E0-2 getSkill() has no content', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const s = SP.getSkill('pr-review');
    return { has: !!s, content: s.content, contentForView: s.contentForView, hash: s.contentHash };
  });
  assert(r.has && r.content == null && r.contentForView == null && r.hash, JSON.stringify(r));
});

test('E0-3 getSkills() has no content', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => SP.getSkills().some(s => s.content != null || s.contentForView != null));
  assert(!r, 'skills leaked content');
});

test('E0-4 __test only with ?dev=1 (not sp-dev alone)', async () => {
  await freshPage(); await resetState();
  const withDev = await evalSP(() => !!SP.__test);
  assert(withDev, '__test missing with ?dev=1');
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.setItem('sp-dev', '1'); });
  await page.reload({ waitUntil: 'networkidle' });
  const onlySpDev = await page.evaluate(() => !!window.SP && !!SP.__test);
  assert(!onlySpDev, '__test must not exist with only sp-dev');
  const src = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
  assert(/isTestMode\(\)/.test(src) && /SP\.__test/.test(src), 'test mode gate missing');
});

test('E0-5 createPackageSnapshot public has no file bodies', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    const created = SP.createPackageSnapshot({ assetId: id, instanceId: inst.id, note: 'e0' });
    return {
      ok: created.ok,
      hasFiles: created.snapshot && 'files' in created.snapshot,
      rawContent: SP.__test.getRawState().snapshots.find(s => s.id === created.snapshotId).files.some(f => f.content)
    };
  });
  assert(r.ok && !r.hasFiles && r.rawContent, JSON.stringify(r));
});

test('E0-6 Draft body requires Editor Session', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const file = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const denied = SP.getEditorDraft('no-session', file.id);
    const opened = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    SP.saveEditorDraft(opened.id, file.id, '# draft\n');
    const got = SP.getEditorDraft(opened.id, file.id);
    const summary = SP.getDraftSummaries(id)[0];
    return {
      denied,
      gotContent: got && got.content,
      summaryHasContent: summary && 'content' in summary,
      publicDraft: SP.getDraft(id)
    };
  });
  assert(r.denied == null, 'draft without session');
  assert(typeof r.gotContent === 'string' && r.gotContent.includes('draft'), 'session draft');
  assert(!r.summaryHasContent, 'summary leaked content');
  assert(r.publicDraft && !('content' in r.publicDraft), 'getDraft leaked');
});

test('E-7 Read-only session cannot save draft', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    const grants = SP.__test.getRawState().permissionGrants.filter(g => g.scopeId === inst.id);
    grants.forEach(g => { g.writeAccess = false; g.readAccess = true; g.status = 'active'; });
    SP.__test.saveState();
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'read-only' });
    const file = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const save = SP.saveEditorDraft(s.id, file.id, 'x');
    const view = SP.getEditorFileContent(s.id, file.id);
    return { ok: s.ok, mode: s.mode, saveOk: save.ok, canView: !!(view && view.content) };
  });
  assert(r.ok && r.mode === 'read-only' && !r.saveOk && r.canView, JSON.stringify(r));
});

test('E-8 Editable requires write', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.__test.getRawState().permissionGrants.filter(g => g.scopeId === inst.id).forEach(g => { g.writeAccess = false; });
    SP.__test.saveState();
    return SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
  });
  assert(!r.ok && r.code === 'read-only', JSON.stringify(r));
});

test('E-9 Revoked write blocks apply', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const file = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, file.id, SP.getEditorFileContent(s.id, file.id).content + '\n# x\n');
    SP.__test.getRawState().permissionGrants.filter(g => g.scopeId === inst.id).forEach(g => { g.writeAccess = false; });
    SP.__test.saveState();
    return SP.prepareApplyChanges(s.id);
  });
  assert(!r.ok && /permission|read-only|写权限/i.test((r.code || '') + (r.error || '')), JSON.stringify(r));
});

test('E-10 Permission Denied cannot open editor', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-permission-denied');
    const inst = SP.getAssetInstances(id)[0];
    return SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'read-only' });
  });
  assert(!r.ok && r.code === 'permission-denied', JSON.stringify(r));
});

test('E-11 Missing cannot open editor', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('demo-path-missing');
    const inst = SP.getAssetInstances(id)[0];
    return SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'read-only' });
  });
  assert(!r.ok && r.code === 'missing', JSON.stringify(r));
});

test('E-12 Asset/instance mismatch rejected', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const a = SP.resolveAssetId('pr-review');
    const other = SP.getAssetInstances(SP.resolveAssetId('api-doc'))[0];
    return SP.openEditorSession({ assetId: a, instanceId: other.id, mode: 'read-only' });
  });
  assert(!r.ok && r.code === 'mismatch', JSON.stringify(r));
});

test('E-13 Independent drafts per file', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const check = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'references/checklist.md');
    SP.saveEditorDraft(s.id, skill.id, 'SKILL_DRAFT_A');
    SP.saveEditorDraft(s.id, check.id, 'CHECK_DRAFT_B');
    return {
      a: SP.getEditorDraft(s.id, skill.id).content,
      b: SP.getEditorDraft(s.id, check.id).content
    };
  });
  assert(r.a === 'SKILL_DRAFT_A' && r.b === 'CHECK_DRAFT_B', JSON.stringify(r));
});

test('E-14 Switch file keeps drafts', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const check = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'references/checklist.md');
    SP.saveEditorDraft(s.id, skill.id, 'KEEP_A');
    SP.getEditorFileContent(s.id, check.id);
    SP.saveEditorDraft(s.id, check.id, 'KEEP_B');
    return SP.getEditorDraft(s.id, skill.id).content;
  });
  assert(r === 'KEEP_A', r);
});

test('E-15 Refresh restores drafts via session', async () => {
  await freshPage(); await resetState();
  const sessionId = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, 'REFRESH_DRAFT');
    SP.setEditorViewState({ sessionId: s.id, assetId: id, instanceId: inst.id, selectedFileId: skill.id });
    return s.id;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SP && SP.__test);
  const content = await evalSP((sid) => {
    const restored = SP.restoreEditorSession(sid);
    const skill = SP.getInstanceFiles(restored.session.instanceId).find(f => f.relativePath === 'SKILL.md');
    return SP.getEditorDraft(sid, skill.id).content;
  }, sessionId);
  assert(content === 'REFRESH_DRAFT', content);
});

test('E-16 Autosave does not mutate formal file', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const before = SP.__test.getRawState().files.find(f => f.id === skill.id).contentHash;
    SP.saveEditorDraft(s.id, skill.id, 'AUTOSAVE_ONLY');
    const after = SP.__test.getRawState().files.find(f => f.id === skill.id).contentHash;
    return { before, after };
  });
  assert(r.before === r.after, JSON.stringify(r));
});

test('E-17 Discard one draft keeps others', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const check = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'references/checklist.md');
    SP.saveEditorDraft(s.id, skill.id, 'A');
    SP.saveEditorDraft(s.id, check.id, 'B');
    SP.discardEditorDraft(s.id, skill.id);
    return { a: SP.getEditorDraft(s.id, skill.id), b: SP.getEditorDraft(s.id, check.id).content };
  });
  assert(r.a == null && r.b === 'B', JSON.stringify(r));
});

test('E-18 Autosave fail retains memory flag', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    SP.loadEditorDemoCase('autosave-fail');
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    return SP.saveEditorDraft(s.id, skill.id, 'MEM');
  });
  assert(!r.ok && r.code === 'autosave_failed' && r.retainedInMemory, JSON.stringify(r));
});

test('E-19 YAML error blocks apply', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, 'not yaml');
    return SP.prepareApplyChanges(s.id);
  });
  assert(!r.ok && r.code === 'validation', JSON.stringify(r));
});

test('E-20 Warning does not block apply', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const base = SP.getEditorFileContent(s.id, skill.id).content;
    // empty body after valid frontmatter may warn; keep valid name
    const content = '---\nname: pr-review\nversion: 9.9.9\n---\n\n';
    SP.saveEditorDraft(s.id, skill.id, content);
    const v = SP.validateEditorSession(s.id);
    const prep = SP.prepareApplyChanges(s.id);
    return { blocks: v.blocksApply, warnings: v.warningCount, prepOk: prep.ok, code: prep.code };
  });
  assert(!r.blocks && r.prepOk, JSON.stringify(r));
});

test('E-21 Single file diff', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const cur = SP.getEditorFileContent(s.id, skill.id).content;
    SP.saveEditorDraft(s.id, skill.id, cur + '\nDIFF_LINE_UNIQUE\n');
    const diff = SP.getEditorDiff(s.id, skill.id);
    return diff.lines.some(l => l.type === 'add' && /DIFF_LINE_UNIQUE/.test(l.text));
  });
  assert(r, 'diff missing add line');
});

test('E-22 Multi-file diff grouped', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const files = SP.getInstanceFiles(inst.id);
    const skill = files.find(f => f.relativePath === 'SKILL.md');
    const check = files.find(f => f.relativePath === 'references/checklist.md');
    SP.saveEditorDraft(s.id, skill.id, SP.getEditorFileContent(s.id, skill.id).content + '\nA\n');
    SP.saveEditorDraft(s.id, check.id, SP.getEditorFileContent(s.id, check.id).content + '\nB\n');
    const all = SP.getEditorAllDiff(s.id);
    return all.groups.length >= 2 && all.groups.every(g => g.relativePath);
  });
  assert(r, 'grouped diff failed');
});

test('E-23 Binary has no text diff', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const bin = SP.getInstanceFiles(inst.id).find(f => f.fileType === 'binary');
    const diff = SP.getEditorDiff(s.id, bin.id);
    return diff.metaOnly && (!diff.lines || !diff.lines.length);
  });
  assert(r, 'binary text diff leaked');
});

test('E-24 Diff HTML escaped in UI renderer contract', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '<img src=x onerror=alert(1)>\n');
    const diff = SP.getEditorDiff(s.id, skill.id);
    const evil = diff.lines.some(l => /onerror/.test(l.text || ''));
    // API returns raw text lines; page must escape — verify $escape works
    return evil && SP.$escape('<img src=x onerror=alert(1)>').indexOf('<img') === -1;
  });
  assert(r, 'escape contract failed');
});

test('E-25..33 Apply + rollback flow', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const beforeHash = SP.__test.getRawState().files.find(f => f.id === skill.id).contentHash;
    const base = SP.getEditorFileContent(s.id, skill.id).content;
    const next = base.replace(/^---\nname:.*\n/, '---\nname: pr-review\nversion: 1.4.1\n') + '\n\nPhaseE apply line\n';
    // ensure valid frontmatter
    const content = '---\nname: pr-review\nversion: 1.4.1\ncategory: 工程\n---\n\n# PR Review\n\nPhaseE apply line\n';
    SP.saveEditorDraft(s.id, skill.id, content);
    const prep = SP.prepareApplyChanges(s.id);
    if (!prep.ok) return { step: 'prep', prep };
    const applied = SP.confirmApplyChanges(prep.operationId, { userConfirmed: true });
    const afterHash = SP.__test.getRawState().files.find(f => f.id === skill.id).contentHash;
    const draftsLeft = SP.getDraftSummaries(id).filter(d => d.sessionId === s.id).length;
    const audit = SP.getAssetAuditEvents(id).find(e => e.eventType === 'apply_completed');
    return {
      prepOk: prep.ok, snap: !!prep.snapshotId, status: applied.status,
      hashChanged: beforeHash !== afterHash, draftsLeft,
      auditSnap: audit && audit.snapshotId === prep.snapshotId
    };
  });
  assert(r.prepOk && r.snap && r.status === 'completed' && r.hashChanged && r.draftsLeft === 0 && r.auditSnap, JSON.stringify(r));
});

test('E-30..32 Partial fail rolls back and keeps drafts', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    SP.loadEditorDemoCase('apply-partial-fail');
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const check = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'references/checklist.md');
    const skillBefore = SP.__test.getRawState().files.find(f => f.id === skill.id).content;
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.4.2\n---\n\n# A\n');
    SP.saveEditorDraft(s.id, check.id, '# checklist changed\n');
    const prep = SP.prepareApplyChanges(s.id);
    const applied = SP.confirmApplyChanges(prep.operationId, { userConfirmed: true });
    const skillAfter = SP.__test.getRawState().files.find(f => f.id === skill.id).content;
    return {
      status: applied.status,
      results: applied.results.map(x => ({ p: x.relativePath, s: x.status, r: x.rollbackStatus })),
      skillRestored: skillAfter === skillBefore,
      drafts: SP.getDraftSummaries(id).length
    };
  });
  assert(r.status === 'rolled-back' || r.status === 'rollback-failed', JSON.stringify(r));
  assert(r.skillRestored, 'skill not rolled back');
  assert(r.drafts >= 2, 'drafts not kept');
});

test('E-34..40 Conflict resolutions', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    const formalBefore = SP.__test.getRawState().files.find(f => f.id === skill.id).content;
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.4.0\n---\n\nDRAFT_KEEP\n');
    SP.loadEditorDemoCase('external-content');
    const prep = SP.prepareApplyChanges(s.id);
    if (!prep.conflictId) return { step: 'prep', prep };
    const keep = SP.resolveConflictKeepDraft(prep.conflictId);
    const formalAfter = SP.__test.getRawState().files.find(f => f.id === skill.id).content;
    const draft = SP.getEditorDraft(s.id, skill.id);
    // merge path
    SP.loadEditorDemoCase('external-content');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.4.0\n---\n\nDRAFT2\n');
    const prep2 = SP.prepareApplyChanges(s.id);
    const merged = SP.resolveConflictMerge(prep2.conflictId, skill.id);
    const mergeDraft = SP.getEditorDraft(s.id, skill.id);
    // save copy
    SP.loadEditorDemoCase('external-content');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.4.0\n---\n\nCOPYME\n');
    const prep3 = SP.prepareApplyChanges(s.id);
    const copy = SP.resolveConflictSaveCopy(prep3.conflictId, skill.id);
    const files = SP.getInstanceFiles(inst.id).map(f => f.relativePath);
    return {
      conflict: !!prep.conflictId,
      keepOk: keep.ok,
      formalUnchanged: formalAfter.includes('EXTERNAL_CHANGE_MARKER') || formalAfter !== 'DRAFT_KEEP',
      draftKept: draft && draft.content.includes('DRAFT_KEEP'),
      mergeOk: merged.ok,
      mergeHasMarkers: mergeDraft && /<<<<<<</.test(mergeDraft.content),
      copyOk: copy.ok,
      copyPath: copy.relativePath,
      copyExists: files.includes(copy.relativePath),
      originalStill: files.includes('SKILL.md')
    };
  });
  assert(r.conflict && r.keepOk && r.draftKept, JSON.stringify(r));
  assert(r.mergeOk && r.mergeHasMarkers, 'merge');
  assert(r.copyOk && r.copyExists && r.originalStill, 'copy');
});

test('E-35 File delete triggers conflict', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const check = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'references/checklist.md');
    SP.saveEditorDraft(s.id, check.id, '# d\n');
    SP.loadEditorDemoCase('external-delete');
    const prep = SP.prepareApplyChanges(s.id);
    return { code: prep.code, conflictId: prep.conflictId };
  });
  assert(r.code === 'conflict' && r.conflictId, JSON.stringify(r));
});

test('E-36..44 Force overwrite gates', async () => {
  await freshPage(); await resetState();
  const r = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id).find(f => f.relativePath === 'SKILL.md');
    SP.saveEditorDraft(s.id, skill.id, '---\nname: pr-review\nversion: 1.4.0\n---\n\nFORCE_DRAFT\n');
    SP.loadEditorDemoCase('external-content');
    const prep = SP.prepareApplyChanges(s.id);
    const noDiff = SP.prepareForceOverwrite(prep.conflictId);
    const noAck = SP.markConflictDiffViewed(prep.conflictId);
    SP.markConflictDiffViewed(prep.conflictId, { userAcknowledged: true });
    const ready = SP.prepareForceOverwrite(prep.conflictId);
    const noConfirm = SP.confirmForceOverwrite(ready.forceOperationId, { userConfirmed: true, secondConfirmed: false });
    const done = SP.confirmForceOverwrite(ready.forceOperationId, {
      userConfirmed: true, secondConfirmed: true
    });
    const formal = SP.__test.getRawState().files.find(f => f.id === skill.id).content;
    const audit = SP.getAssetAuditEvents(id).find(e => e.eventType === 'force_apply');
    // permission deny force
    SP.__test.getRawState().permissionGrants.filter(g => g.scopeId === inst.id).forEach(g => { g.writeAccess = false; });
    SP.__test.saveState();
    const denied = SP.prepareForceOverwrite(prep.conflictId);
    return {
      noDiffCode: noDiff.code,
      noAckOk: noAck && noAck.ok === false,
      readyOk: ready.ok,
      snap: ready.snapshotId,
      forceOp: ready.forceOperationId,
      noConfirm: noConfirm.code,
      doneOk: done.ok,
      forced: formal.includes('FORCE_DRAFT'),
      audit: !!(audit && audit.snapshotId),
      denied: denied.code
    };
  });
  assert(r.noDiffCode === 'diff_required', 'diff gate');
  assert(r.readyOk && r.snap, 'snap before force');
  assert(r.noConfirm === 'not_confirmed', 'second confirm');
  assert(r.doneOk && r.forced && r.audit, JSON.stringify(r));
  assert(r.denied === 'permission-denied', 'write gate');
});

test('E-45 Editor view state persists', async () => {
  await freshPage(); await resetState();
  await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    const skill = SP.getInstanceFiles(inst.id)[0];
    SP.setEditorViewState({ sessionId: s.id, selectedFileId: skill.id, rightPanel: 'problems', assetId: id, instanceId: inst.id });
  });
  await page.reload({ waitUntil: 'networkidle' });
  const vs = await evalSP(() => SP.getEditorViewState());
  assert(vs.sessionId && vs.rightPanel === 'problems', JSON.stringify(vs));
});

test('E-48 Pages do not use raw state mutation helpers in editor app', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'skill-editor-app.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(!/getState\(\)\.files/.test(src), 'editor reads raw files');
  assert(!/getSkill\([^)]*\)\.content/.test(src), 'editor uses skill.content');
  assert(!/\b__test\b/.test(src), 'editor uses __test');
});

test('E-49 No duplicate shared public selectors in editor html style beyond layout', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'skill-editor.html'), 'utf8');
  assert(!/\.btn\s*\{/.test(html), 'redefines .btn');
  assert(!/\.sidebar\s*\{/.test(html), 'redefines .sidebar');
});

test('E-50 Prior suites still wired', async () => {
  const run = fs.readFileSync(path.join(ROOT, 'run-all-tests.js'), 'utf8');
  assert(run.includes('phase-d2-targeted-tests.js'), 'd2 missing');
  assert(run.includes('phase-e-targeted-tests.js'), 'e missing in run-all — will add');
});

test('E-UI Editor page loads session', async () => {
  await freshPage(); await resetState();
  const url = await evalSP(() => {
    const id = SP.resolveAssetId('pr-review');
    const inst = SP.getAssetInstances(id).find(i => i.hostType === 'claude-code');
    SP.requestWritePermission({ instanceId: inst.id, purpose: 'e' });
    const s = SP.openEditorSession({ assetId: id, instanceId: inst.id, mode: 'editable' });
    return 'skill-editor.html?skill=' + encodeURIComponent(id) + '&session=' + encodeURIComponent(s.id) + '&dev=1';
  });
  await page.goto(BASE + '/' + url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#editor');
  await page.waitForFunction(() => {
    const el = document.getElementById('mode-label') || document.getElementById('mode-chip');
    const t = (el && el.textContent || '').trim();
    return /Editable|Read-only|可编辑|只读/i.test(t);
  });
  const mode = await page.evaluate(() => {
    const el = document.getElementById('mode-label') || document.getElementById('mode-chip');
    return (el && el.textContent || '').trim();
  });
  assert(
    /Editable|Read-only/.test(mode) || mode.includes('可编辑') || mode.includes('只读'),
    'unexpected mode: ' + JSON.stringify(mode)
  );
});

(async () => {
  console.log('=== Phase E Targeted Tests ===\n');
  browser = await chromium.launch(chromiumLaunchOptions());
  context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
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
})().catch(err => { console.error(err); process.exit(1); });
