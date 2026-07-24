#!/usr/bin/env node
/**
 * Unified Playwright regression entry for Skill Panel prototype.
 * Runs each suite sequentially; exits non-zero if any suite fails.
 * Suite totals use the LAST "N passed, M failed" line in each suite output
 * (so nested suite runs like F.4 inside F.4.1 are ignored).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = __dirname;
const NODE = process.execPath;
const suites = [
  'e2e-test.js',
  'walkthrough-test.js',
  'phase1-targeted-tests.js',
  'phase2-targeted-tests.js',
  'phase-b1-targeted-tests.js',
  'phase-c-targeted-tests.js',
  'phase-c1-targeted-tests.js',
  'phase-d-targeted-tests.js',
  'phase-d1-targeted-tests.js',
  'phase-d2-targeted-tests.js',
  'phase-e-targeted-tests.js',
  'phase-e1-targeted-tests.js',
  'phase-f0-targeted-tests.js',
  'phase-f-targeted-tests.js',
  'phase-f1-targeted-tests.js',
  'phase-f2-targeted-tests.js',
  'phase-f3-targeted-tests.js',
  'phase-f4-targeted-tests.js',
  'phase-f41-targeted-tests.js',
  'phase-g-targeted-tests.js'
];

function parseSuiteTotals(out) {
  const matches = [...String(out || '').matchAll(/(\d+)\s+passed,\s*(\d+)\s+failed/g)];
  if (!matches.length) return { passed: null, failed: null };
  const last = matches[matches.length - 1];
  return { passed: Number(last[1]), failed: Number(last[2]) };
}

console.log('=== Skill Panel unified test runner ===\n');

let failedSuites = 0;
const summary = [];

for (const file of suites) {
  const full = path.join(ROOT, file);
  console.log(`\n-------- ${file} --------`);
  const result = spawnSync(NODE, [full], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const out = (result.stdout || '') + (result.stderr || '');
  process.stdout.write(out);
  const { passed, failed } = parseSuiteTotals(out);
  const failedCount = failed == null ? (result.status === 0 ? 0 : 1) : failed;
  const ok = result.status === 0 && failedCount === 0;
  if (!ok) failedSuites += 1;
  summary.push({
    file,
    ok,
    passed: passed == null ? '?' : passed,
    failed: failed == null ? '?' : failedCount,
    exit: result.status
  });
}

console.log('\n=== Suite summary ===');
summary.forEach(s => {
  const mark = s.ok ? '✅' : '❌';
  console.log(`${mark} ${s.file}: ${s.passed} passed, ${s.failed} failed (exit ${s.exit})`);
});
console.log(failedSuites ? `\n${failedSuites} suite(s) failed` : '\nAll suites passed');
process.exit(failedSuites ? 1 : 0);
