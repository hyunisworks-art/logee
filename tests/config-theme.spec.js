const { test, expect } = require("./fixtures/test-base");
const {
  openApp,
  nodeBox,
  selectNode,
  typeInEditing,
  nodeButton,
  readSettings,
  importConfigFile,
  autoDialog,
} = require("./helpers");

/** レイアウトの違いが見えるよう、子を1つ持つ木にしておく */
async function addOneChild(page) {
  const root = page.locator(".node-box.root");
  await selectNode(page, root);
  await nodeButton(root, "＋下位").click();
  await typeInEditing(page, "子");
}

test.describe("設定ファイル（logee-config）", () => {
  const cases = [
    ["sample-tree.logee-config.json", "tree", "layout-tree"],
    ["sample-tree-rtl.logee-config.json", "tree-rtl", "layout-tree-rtl"],
    ["sample-pyramid.logee-config.json", "pyramid", "layout-pyramid"],
    ["sample-radial.logee-config.json", "radial", "layout-radial"],
  ];

  for (const [file, layout, cssClass] of cases) {
    test(`${file} で ${layout} レイアウトに切り替わる`, async ({ page }) => {
      await openApp(page);
      await addOneChild(page);

      await importConfigFile(page, file);
      await expect(page.locator("#canvas")).toHaveClass(new RegExp(cssClass));
      await expect(nodeBox(page)).toHaveCount(2);

      const settings = await readSettings(page);
      expect(settings.layout).toBe(layout);
    });
  }

  test("radial の params が settings.layoutParams に入る", async ({ page }) => {
    await openApp(page);
    await importConfigFile(page, "sample-radial.logee-config.json");
    await expect(page.locator("#canvas")).toHaveClass(/layout-radial/);

    const settings = await readSettings(page);
    expect(settings.layoutParams).toMatchObject({ radiusStep: 180, startAngle: -90, sweep: 360, gap: 24 });
  });

  test("radial では接続線がSVGで描かれる", async ({ page }) => {
    await openApp(page);
    await addOneChild(page);
    await importConfigFile(page, "sample-radial.logee-config.json");
    await expect(page.locator("#canvas")).toHaveClass(/layout-radial/);

    await expect(page.locator("#canvas svg line, #canvas svg path")).not.toHaveCount(0);
  });

  test("レイアウト設定はリロード後も保持される", async ({ page }) => {
    await openApp(page);
    await importConfigFile(page, "sample-pyramid.logee-config.json");
    await expect(page.locator("#canvas")).toHaveClass(/layout-pyramid/);

    await page.reload();
    await page.waitForSelector(".node-box.root");
    await expect(page.locator("#canvas")).toHaveClass(/layout-pyramid/);
  });

  test("設定ファイルの読込口では MOD を受け付けず案内を出す", async ({ page }) => {
    await openApp(page);
    const messages = autoDialog(page, true);
    await importConfigFile(page, "sample-spiral.logee-mod.json");

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain("MOD");
    await expect(page.locator("#modBadge")).toHaveText("");
  });
});

test.describe("テーマ（logee-theme）", () => {
  const cssVar = (page, name) =>
    page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);

  test("テーマを読み込むとCSS変数が上書きされる", async ({ page }) => {
    await openApp(page);
    await importConfigFile(page, "sample-forest.logee-theme.json");

    await expect.poll(() => cssVar(page, "--accent")).toBe("#5fbf56");
    expect(await cssVar(page, "--bg")).toBe("#0f1c11");
  });

  test("テーマはリロード後も保持される", async ({ page }) => {
    await openApp(page);
    await importConfigFile(page, "sample-aqua.logee-theme.json");
    await expect.poll(() => cssVar(page, "--accent")).toBe("#2b8fd6");

    await page.reload();
    await page.waitForSelector(".node-box.root");
    await expect.poll(() => cssVar(page, "--accent")).toBe("#2b8fd6");
  });

  test("「設定をデフォルトに戻す」でテーマの上書きが消える", async ({ page }) => {
    await openApp(page);
    await importConfigFile(page, "sample-aqua.logee-theme.json");
    await expect.poll(() => cssVar(page, "--accent")).toBe("#2b8fd6");

    page.once("dialog", (d) => d.accept());
    await page.click("#stgSettingsReset");
    await expect.poll(() => cssVar(page, "--accent")).toBe("");
    const saved = await page.evaluate(() => localStorage.getItem("logicTree.theme"));
    expect(saved).toBeNull();
  });
});
