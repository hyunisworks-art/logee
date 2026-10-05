const { test, expect } = require("./fixtures/test-base");
const { openApp, nodeBox, selectNode, setNodeText, readStore } = require("./helpers");

test.describe("起動と基本編集", () => {
  test("初回起動でルートノードが1つだけ表示される", async ({ page }) => {
    await openApp(page);
    await expect(nodeBox(page)).toHaveCount(1);
    await expect(page.locator(".node-box.root .node-text")).toHaveText("クリックしてテーマを入力");
  });

  test("クリックで選択され、操作ボタンが現れる", async ({ page }) => {
    await openApp(page);
    const root = page.locator(".node-box.root");
    await selectNode(page, root);
    await expect(root.locator(".node-actions button", { hasText: "＋下位" })).toBeVisible();
    // ルートには「＋同列」「✕」は出ない
    await expect(root.locator(".node-actions button", { hasText: "＋同列" })).toHaveCount(0);
  });

  test("ダブルクリックで編集でき、入力内容が localStorage に保存される", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "テーマA");

    const store = await readStore(page);
    expect(store.trees).toHaveLength(1);
    expect(store.trees[0].tree.text).toContain("テーマA");
  });

  test("リロードしても内容が復元される", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "テーマB");

    await page.reload();
    await page.waitForSelector(".node-box.root");
    await expect(page.locator(".node-box.root")).toContainText("テーマB");
  });
});
