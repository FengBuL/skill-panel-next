const { createRequire } = require("node:module");
const path = require("node:path");

const prototypeRequire = createRequire(
  path.join(__dirname, "..", "prototype", "package.json"),
);
const { chromium } = prototypeRequire("playwright");

if (!chromium.__skillPanelLocalePatched) {
  const launch = chromium.launch.bind(chromium);

  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);

    browser.newContext = (options = {}) =>
      newContext({ locale: "zh-CN", ...options });

    return browser;
  };

  Object.defineProperty(chromium, "__skillPanelLocalePatched", {
    value: true,
  });
}
