const path = require("path");
const { test, expect } = require("./fixtures/test-base");
const {
  openApp,
  nodeBox,
  selectNode,
  setNodeText,
  typeInEditing,
  nodeButton,
  readStore,
  outline,
  autoDialog,
} = require("./helpers");

const fixture = (name) => path.join(__dirname, "fixtures", name);

/** ルート「テーマ」＋子「論点A」（孫「詳細A1」）＋子「論点B」 */
async function buildTree(page) {
  const root = page.locator(".node-box.root");
  await setNodeText(page, root, "テーマ");

  await selectNode(page, root);
  await nodeButton(root, "＋下位").click();
  await typeInEditing(page, "論点A");

  const a = nodeBox(page, "論点A");
  await selectNode(page, a);
  await nodeButton(a, "＋下位").click();
  await typeInEditing(page, "詳細A1");

  const a2 = nodeBox(page, "論点A");
  await selectNode(page, a2);
  await nodeButton(a2, "＋同列").click();
  await typeInEditing(page, "論点B");
}

async function exportedMarkdown(page) {
  await page.click("#btnExportMd");
  const textarea = page.locator(".modal-overlay textarea");
  await textarea.waitFor();
  return textarea.inputValue();
}

test.describe("Markdown出力", () => {
  test("階層が # の深さに対応する", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    const md = await exportedMarkdown(page);
    expect(md).toContain("# テーマ");
    expect(md).toContain("## 論点A");
    expect(md).toContain("### 詳細A1");
    expect(md).toContain("## 論点B");
    // 出現順は木の走査順どおり
    expect(md.indexOf("### 詳細A1")).toBeGreaterThan(md.indexOf("## 論点A"));
    expect(md.indexOf("## 論点B")).toBeGreaterThan(md.indexOf("### 詳細A1"));
  });

  test("見出し階層を「##まで」にすると、それより深い階層は地の文になる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await page.click("#btnExportMd");
    const textarea = page.locator(".modal-overlay textarea");
    await textarea.waitFor();
    await page.locator('.modal-overlay input[name="mdHeadingLimit"][value="2"]').check();

    const md = await textarea.inputValue();
    expect(md).toContain("## 論点A");
    expect(md).not.toContain("### 詳細A1");
    expect(md).toContain("詳細A1");
  });

  test("空のノードは (無題) として出力される", async ({ page }) => {
    await openApp(page);
    const md = await exportedMarkdown(page);
    expect(md.trim()).toBe("# (無題)");
  });
});

test.describe("Markdown読取", () => {
  test(".md を読み込むとツリーへ変換される", async ({ page }) => {
    await openApp(page);
    await page.setInputFiles("#mdFileInput", fixture("import-sample.md"));
    await expect(nodeBox(page, "論点A")).toHaveCount(1);

    const store = await readStore(page);
    const root = outline(store.trees[0].tree);
    expect(root.text.split("\n")[0]).toBe("テーマ");
    expect(root.children.map((c) => c.text)).toEqual(["論点A", "論点B"]);
    expect(root.children[0].children.map((c) => c.text)).toEqual(["詳細A1"]);
  });

  test("# のない連続行は直前のパネル内で複数行になる", async ({ page }) => {
    await openApp(page);
    await page.setInputFiles("#mdFileInput", fixture("import-sample.md"));
    await expect(nodeBox(page, "論点A")).toHaveCount(1);

    const store = await readStore(page);
    expect(outline(store.trees[0].tree).text).toBe("テーマ\nテーマの補足1\nテーマの補足2");
  });

  test(".md 以外のファイルは受け付けない", async ({ page }) => {
    await openApp(page);
    const messages = autoDialog(page, true);
    await page.setInputFiles("#mdFileInput", fixture("not-markdown.txt"));

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain(".md");
    await expect(page.locator(".node-box.root .node-text")).toHaveText("クリックしてテーマを入力");
  });

  test("読取後に「元に戻す」で読み込み前の内容へ戻せる", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "読み込み前");

    await page.setInputFiles("#mdFileInput", fixture("import-sample.md"));
    await expect(nodeBox(page, "論点A")).toHaveCount(1);

    await page.click("#btnUndo");
    await expect(page.locator(".node-box.root")).toContainText("読み込み前");
  });
});
