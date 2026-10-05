// COVERAGE=1 のときだけ V8 のJSカバレッジを採取する test オブジェクト。
// 各 spec は @playwright/test ではなくこのモジュールから test / expect を取る。
const fs = require("fs");
const path = require("path");
const base = require("@playwright/test");

const OUT_DIR = path.join(__dirname, "..", ".coverage");
const enabled = !!process.env.COVERAGE;

const test = base.test.extend({
  page: async ({ page }, use, testInfo) => {
    if (!enabled) {
      await use(page);
      return;
    }
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    const entries = await page.coverage.stopJSCoverage();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const name = String(testInfo.testId || Math.random()).replace(/[^\w-]/g, "_");
    fs.writeFileSync(path.join(OUT_DIR, name + ".json"), JSON.stringify(entries));
  },
});

module.exports = { test, expect: base.expect };
