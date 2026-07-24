/**
 * Shared Playwright Chromium launch options.
 * Priority: CHROME_EXECUTABLE_PATH → Playwright bundled Chromium → macOS Chrome fallback.
 */
const fs = require('fs');

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function resolveChromeExecutablePath() {
  const fromEnv = process.env.CHROME_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  if (process.platform === 'darwin' && fs.existsSync(MAC_CHROME)) return MAC_CHROME;
  return undefined;
}

function chromiumLaunchOptions(extra = {}) {
  const executablePath = resolveChromeExecutablePath();
  const opts = Object.assign({ headless: true }, extra);
  if (executablePath) opts.executablePath = executablePath;
  return opts;
}

module.exports = {
  MAC_CHROME,
  resolveChromeExecutablePath,
  chromiumLaunchOptions
};
