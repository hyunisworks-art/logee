const { test, expect } = require("./fixtures/test-base");
const {
  openApp,
  nodeBox,
  selectNode,
  setNodeText,
  typeInEditing,
  nodeButton,
  readStore,
  autoDialog,
} = require("./helpers");

const items = (page) => page.locator("#treeItems .tree-item");

test.describe("複数ツリー", () => {
  test("「＋」で新しいツリーが増え、そちらがアクティブになる", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "ツリー1");

    await page.click("#btnNewTree");
    await expect(items(page)).toHaveCount(2);
    await expect(items(page).nth(1)).toHaveClass(/active/);
    await expect(page.locator(".node-box.root .node-text")).toHaveText("クリックしてテーマを入力");
  });

  test("クリックでツリーを切り替えても内容が混ざらない", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "ツリー1");

    await page.click("#btnNewTree");
    await setNodeText(page, page.locator(".node-box.root"), "ツリー2");

    await items(page).nth(0).click();
    await expect(page.locator(".node-box.root")).toContainText("ツリー1");

    await items(page).nth(1).click();
    await expect(page.locator(".node-box.root")).toContainText("ツリー2");
  });

  // recalcNextId() が働かないと、切替後の新規ノードIDが他ツリーのIDと衝突する
  test("切替後に追加したノードのIDが重複しない", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "ツリー1");
    const root1 = page.locator(".node-box.root");
    await selectNode(page, root1);
    await nodeButton(root1, "＋下位").click();
    await typeInEditing(page, "1-子");

    await page.click("#btnNewTree");
    await setNodeText(page, page.locator(".node-box.root"), "ツリー2");

    await items(page).nth(0).click();
    await expect(page.locator(".node-box.root")).toContainText("ツリー1");
    const r = page.locator(".node-box.root");
    await selectNode(page, r);
    await nodeButton(r, "＋下位").click();
    await typeInEditing(page, "1-子2");

    const ids = await page.$$eval(".node-box", (els) => els.map((e) => e.dataset.nodeId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("ツリー切替でundo履歴が持ち越されない", async ({ page }) => {
    await openApp(page);
    const root = page.locator(".node-box.root");
    await selectNode(page, root);
    await nodeButton(root, "＋下位").click();
    await typeInEditing(page, "子");
    await expect(page.locator("#btnUndo")).toBeEnabled();

    await page.click("#btnNewTree");
    await expect(page.locator("#btnUndo")).toBeDisabled();
  });

  test("ダブルクリックでツリー名を変更できる", async ({ page }) => {
    await openApp(page);
    await page.click("#btnNewTree");

    await items(page).nth(1).dblclick();
    const input = page.locator("#treeItems .tree-item-input");
    await input.waitFor();
    await input.fill("調査メモ");
    await input.press("Enter");

    await expect(items(page).nth(1).locator(".tree-item-title")).toHaveText("調査メモ");
    const store = await readStore(page);
    expect(store.trees[1].title).toBe("調査メモ");
  });

  test("✕でツリーを削除できる（確認あり）", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "ツリー1");
    await page.click("#btnNewTree");
    await expect(items(page)).toHaveCount(2);

    const messages = autoDialog(page, true);
    await items(page).nth(1).locator(".tree-item-del").click();

    await expect(items(page)).toHaveCount(1);
    expect(messages.length).toBeGreaterThan(0);
    await expect(page.locator(".node-box.root")).toContainText("ツリー1");
  });

  test("最後の1本は削除できない", async ({ page }) => {
    await openApp(page);
    const messages = autoDialog(page, true);
    await items(page).nth(0).locator(".tree-item-del").click();

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain("最後の1本");
    await expect(items(page)).toHaveCount(1);
  });

  test("☰でツリー一覧を開閉できる", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#treeList")).not.toHaveClass(/hidden/);
    await page.click("#btnToggleList");
    await expect(page.locator("#treeList")).toHaveClass(/hidden/);
    await page.click("#btnToggleList");
    await expect(page.locator("#treeList")).not.toHaveClass(/hidden/);
  });

  test("複数ツリーはリロード後も残る", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "ツリー1");
    await page.click("#btnNewTree");
    await setNodeText(page, page.locator(".node-box.root"), "ツリー2");

    await page.reload();
    await page.waitForSelector(".node-box.root");
    await expect(items(page)).toHaveCount(2);
    await expect(page.locator(".node-box.root")).toContainText("ツリー2");
  });
});
