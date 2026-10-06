const { test, expect } = require("./fixtures/test-base");
const { openApp, importConfigFile } = require("./helpers");
test("「設定をデフォルトに戻す」でレイアウトとインデントも戻る", async ({ page }) => {
  await openApp(page);
  await importConfigFile(page, "sample-pyramid.logee-config.json");
  await expect(page.locator("#canvas")).toHaveClass(/layout-pyramid/);
  page.once("dialog", (d) => d.accept());
  await page.click("#stgSettingsReset");
  await expect(page.locator("#canvas")).toHaveClass(/layout-tree/);
  await expect(page.locator("#stgIndent")).toHaveValue("28");
});
