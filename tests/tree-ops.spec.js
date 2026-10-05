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

/** ルート＋子2つ（子1には孫1つ）の木を作る */
async function buildSampleTree(page) {
  const root = page.locator(".node-box.root");
  await setNodeText(page, root, "ルート");

  await selectNode(page, root);
  await nodeButton(root, "＋下位").click();
  await typeInEditing(page, "子1");

  const child1 = nodeBox(page, "子1");
  await selectNode(page, child1);
  await nodeButton(child1, "＋同列").click();
  await typeInEditing(page, "子2");

  const c1 = nodeBox(page, "子1");
  await selectNode(page, c1);
  await nodeButton(c1, "＋下位").click();
  await typeInEditing(page, "孫1");
}

test.describe("ノード操作", () => {
  test("＋下位・＋同列で階層と兄弟を追加できる", async ({ page }) => {
    await openApp(page);
    await buildSampleTree(page);

    const store = await readStore(page);
    expect(outline(store.trees[0].tree)).toEqual({
      text: "ルート",
      children: [
        { text: "子1", children: [{ text: "孫1", children: [] }] },
        { text: "子2", children: [] },
      ],
    });
  });

  // 仕様書：閉じるボタンは「確認ダイアログなしで即削除」。
  // 子は消さずに元の位置へ昇格させる（配下ごと消える仕様ではない）。
  test("✕は確認なしで即削除し、子は同じ位置へ昇格する", async ({ page }) => {
    await openApp(page);
    await buildSampleTree(page);

    const messages = autoDialog(page, true);
    const child1 = nodeBox(page, "子1");
    await selectNode(page, child1);
    await nodeButton(child1, "✕").click();

    await expect(nodeBox(page, "子1")).toHaveCount(0);
    expect(messages).toEqual([]); // 確認ダイアログは出ない

    const store = await readStore(page);
    expect(outline(store.trees[0].tree).children.map((c) => c.text)).toEqual(["孫1", "子2"]);
  });

  test("「元に戻す」で直前の削除を取り消せる", async ({ page }) => {
    await openApp(page);
    await buildSampleTree(page);

    const child2 = nodeBox(page, "子2");
    await selectNode(page, child2);
    await nodeButton(child2, "✕").click();
    await expect(nodeBox(page, "子2")).toHaveCount(0);

    await page.click("#btnUndo");
    await expect(nodeBox(page, "子2")).toHaveCount(1);
  });

  test("「上位にする」で階層が1つ上がる", async ({ page }) => {
    await openApp(page);
    await buildSampleTree(page);

    const grand = nodeBox(page, "孫1");
    await selectNode(page, grand);
    await nodeButton(grand, "上位にする").click();

    const store = await readStore(page);
    expect(outline(store.trees[0].tree).children.map((c) => c.text)).toEqual(["子1", "孫1", "子2"]);
  });

  test("「下位にする」で直前の兄弟の子になる", async ({ page }) => {
    await openApp(page);
    await buildSampleTree(page);

    const child2 = nodeBox(page, "子2");
    await selectNode(page, child2);
    await nodeButton(child2, "下位にする").click();

    const store = await readStore(page);
    const root = outline(store.trees[0].tree);
    expect(root.children).toHaveLength(1);
    expect(root.children[0].children.map((c) => c.text)).toEqual(["孫1", "子2"]);
  });

  test("先頭の子では「下位にする」が押せない", async ({ page }) => {
    await openApp(page);
    await buildSampleTree(page);

    const child1 = nodeBox(page, "子1");
    await selectNode(page, child1);
    await expect(nodeButton(child1, "下位にする")).toBeDisabled();
  });

  test("すべて折りたたむ／すべて展開が効く", async ({ page }) => {
    await openApp(page);
    await buildSampleTree(page);

    await page.click("#btnCollapseAll");
    // ルートが畳まれるので子孫は描画されない
    await expect(nodeBox(page)).toHaveCount(1);

    await page.click("#btnExpandAll");
    await expect(nodeBox(page)).toHaveCount(4);
  });

  test("「このツリーを消去」で空のルートだけに戻る", async ({ page }) => {
    await openApp(page);
    await buildSampleTree(page);

    autoDialog(page, true);
    await page.click("#btnReset");

    await expect(nodeBox(page)).toHaveCount(1);
    await expect(page.locator(".node-box.root .node-text")).toHaveText("クリックしてテーマを入力");
  });
});
