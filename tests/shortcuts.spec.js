const { test, expect } = require("./fixtures/test-base");
const {
  openApp,
  nodeBox,
  selectNode,
  setNodeText,
  typeInEditing,
  nodeButton,
  readStore,
  readSettings,
  outline,
} = require("./helpers");

async function buildTree(page) {
  const root = page.locator(".node-box.root");
  await setNodeText(page, root, "ルート");
  await selectNode(page, root);
  await nodeButton(root, "＋下位").click();
  await typeInEditing(page, "子1");
  const c = nodeBox(page, "子1");
  await selectNode(page, c);
  await nodeButton(c, "＋同列").click();
  await typeInEditing(page, "子2");
}

test.describe("キーボードショートカット", () => {
  test("Enter で同列、Shift+Enter で下位が増える", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, nodeBox(page, "子2"));
    await page.keyboard.press("Enter");
    await typeInEditing(page, "子3");

    await selectNode(page, nodeBox(page, "子3"));
    await page.keyboard.press("Shift+Enter");
    await typeInEditing(page, "孫");

    const root = outline((await readStore(page)).trees[0].tree);
    expect(root.children.map((c) => c.text)).toEqual(["子1", "子2", "子3"]);
    expect(root.children[2].children.map((c) => c.text)).toEqual(["孫"]);
  });

  test("F2 で編集開始、Escape で確定して選択に戻る", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, nodeBox(page, "子1"));
    await page.keyboard.press("F2");
    await expect(page.locator(".node-box.editing")).toHaveCount(1);

    await page.keyboard.type("追記");
    await page.keyboard.press("Escape");
    await expect(page.locator(".node-box.editing")).toHaveCount(0);
    await expect(page.locator(".node-box.selected")).toHaveCount(1);
    await expect(nodeBox(page, "追記")).toHaveCount(1);
  });

  test("Delete で選択中のノードを削除する", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, nodeBox(page, "子2"));
    await page.keyboard.press("Delete");
    await expect(nodeBox(page, "子2")).toHaveCount(0);
  });

  test("Alt+↑／↓ で同列内の並び順が入れ替わる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, nodeBox(page, "子2"));
    await page.keyboard.press("Alt+ArrowUp");

    let root = outline((await readStore(page)).trees[0].tree);
    expect(root.children.map((c) => c.text)).toEqual(["子2", "子1"]);

    await page.keyboard.press("Alt+ArrowDown");
    root = outline((await readStore(page)).trees[0].tree);
    expect(root.children.map((c) => c.text)).toEqual(["子1", "子2"]);
  });

  test("Alt+→／← で階層を上げ下げする", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, nodeBox(page, "子2"));
    await page.keyboard.press("Alt+ArrowRight");
    let root = outline((await readStore(page)).trees[0].tree);
    expect(root.children[0].children.map((c) => c.text)).toEqual(["子2"]);

    await page.keyboard.press("Alt+ArrowLeft");
    root = outline((await readStore(page)).trees[0].tree);
    expect(root.children.map((c) => c.text)).toEqual(["子1", "子2"]);
  });

  test("Ctrl+↑ で折りたたみ／展開する", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, page.locator(".node-box.root"));
    await page.keyboard.press("Control+ArrowUp");
    await expect(nodeBox(page)).toHaveCount(1);

    await page.keyboard.press("Control+ArrowUp");
    await expect(nodeBox(page)).toHaveCount(3);
  });

  test("Ctrl+z で直前の操作を取り消す", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, nodeBox(page, "子2"));
    await page.keyboard.press("Delete");
    await expect(nodeBox(page, "子2")).toHaveCount(0);

    await page.keyboard.press("Control+z");
    await expect(nodeBox(page, "子2")).toHaveCount(1);
  });

  test("Ctrl+Shift+E で Markdown出力モーダルが開く", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await page.keyboard.press("Control+Shift+E");
    const textarea = page.locator(".modal-overlay textarea");
    await textarea.waitFor();
    expect(await textarea.inputValue()).toContain("# ルート");
  });

  test("Ctrl+= / Ctrl+- / Ctrl+0 でズームが変わる", async ({ page }) => {
    await openApp(page);

    await page.keyboard.press("Control+=");
    const zoomedIn = (await readSettings(page)).zoom;
    expect(zoomedIn).toBeGreaterThan(1);

    await page.keyboard.press("Control+-");
    await page.keyboard.press("Control+-");
    expect((await readSettings(page)).zoom).toBeLessThan(1);

    await page.keyboard.press("Control+0");
    expect((await readSettings(page)).zoom).toBe(1);
  });

  // 編集中は Escape 以外のキーを Quill へそのまま渡す。
  // F2 直後のカーソルは本文の先頭なので、Delete は「ノード削除」ではなく1文字削除になる。
  test("編集中の Delete はノード削除ではなく本文の1文字削除になる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, nodeBox(page, "子1"));
    await page.keyboard.press("F2");
    await page.keyboard.press("Delete");
    await expect(page.locator(".node-box.editing")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(nodeBox(page)).toHaveCount(3); // ノードは消えていない
    const root = outline((await readStore(page)).trees[0].tree);
    expect(root.children.map((c) => c.text)).toEqual(["1", "子2"]);
  });

  // 編集中の Enter は「同列を追加」ではなく本文の改行になる
  test("編集中の Enter はノード追加ではなく本文の改行になる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await selectNode(page, nodeBox(page, "子2"));
    await page.keyboard.press("F2");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("2行目");
    await page.keyboard.press("Escape");

    await expect(nodeBox(page)).toHaveCount(3);
    const root = outline((await readStore(page)).trees[0].tree);
    expect(root.children[1].text).toContain("2行目");
  });
});
