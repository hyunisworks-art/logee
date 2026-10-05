// ドラッグ&ドロップによる階層移動・並び替え。
// 判定は `dropMetrics()` に集約されていて、測る向きがレイアウトごとに変わる
// （tree系＝上下端、pyramid＝左右端、radial＝円の接線方向）ため、3レイアウトとも通す。
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
  importConfigFile,
} = require("./helpers");

/** ルート＋子3つ（子1に孫1つ） */
async function buildTree(page) {
  const root = page.locator(".node-box.root");
  await setNodeText(page, root, "ルート");

  await selectNode(page, root);
  await nodeButton(root, "＋下位").click();
  await typeInEditing(page, "子1");

  for (const name of ["子2", "子3"]) {
    const prev = nodeBox(page, name === "子2" ? "子1" : "子2");
    await selectNode(page, prev);
    await nodeButton(prev, "＋同列").click();
    await typeInEditing(page, name);
  }

  const c1 = nodeBox(page, "子1");
  await selectNode(page, c1);
  await nodeButton(c1, "＋下位").click();
  await typeInEditing(page, "孫1");
}

const children = async (page) => outline((await readStore(page)).trees[0].tree).children.map((c) => c.text);

/**
 * パネルをドラッグして落とす。
 * where: "center"（子にする）/ "start"（前に挿入）/ "end"（後ろに挿入）
 * 掴むのは左端のドラッグハンドル。4pxのしきい値を確実に超えるよう段階的に動かす。
 */
async function dragTo(page, sourceText, targetText, where = "center") {
  const source = nodeBox(page, sourceText).first();
  const handle = source.locator(".drag-handle");
  const from = await handle.boundingBox();
  const target = targetText ? await nodeBox(page, targetText).first().boundingBox() : null;
  if (!from) throw new Error("ドラッグ元の座標が取得できません");

  let to;
  if (!target) {
    // 空白（キャンバスの余白）へ落とす
    const canvas = await page.locator("#canvas").boundingBox();
    to = { x: canvas.x + canvas.width - 8, y: canvas.y + canvas.height - 8 };
  } else if (where === "center") {
    to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  } else if (where === "start") {
    to = { x: target.x + target.width * 0.06, y: target.y + target.height * 0.06 };
  } else {
    to = { x: target.x + target.width * 0.94, y: target.y + target.height * 0.94 };
  }

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.move(to.x, to.y); // 判定用に同じ位置でもう一度動かす
  await page.mouse.up();
}

test.describe("ドラッグ&ドロップ（tree）", () => {
  test("パネルの中央へ落とすと、その子になる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await dragTo(page, "子3", "子2", "center");

    const root = outline((await readStore(page)).trees[0].tree);
    expect(root.children.map((c) => c.text)).toEqual(["子1", "子2"]);
    expect(root.children[1].children.map((c) => c.text)).toEqual(["子3"]);
  });

  test("パネルの上端へ落とすと、その前に挿入される", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await dragTo(page, "子3", "子1", "start");
    expect(await children(page)).toEqual(["子3", "子1", "子2"]);
  });

  test("パネルの下端へ落とすと、その後ろに挿入される", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await dragTo(page, "子1", "子2", "end");
    expect(await children(page)).toEqual(["子2", "子1", "子3"]);
  });

  test("ドラッグ中は挿入位置のフィードバックが出る", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    const handle = nodeBox(page, "子3").first().locator(".drag-handle");
    const from = await handle.boundingBox();
    const target = await nodeBox(page, "子1").first().boundingBox();

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 12, from.y + 12, { steps: 3 });

    // 中央＝子にする → 対象パネルがハイライトされる
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
    await expect(page.locator(".node-box.drop-into")).toHaveCount(1);
    await expect(page.locator(".drag-clone")).toHaveCount(1);

    // 上端＝兄弟として挿入 → 挿入線に変わる
    await page.mouse.move(target.x + target.width * 0.06, target.y + target.height * 0.06, { steps: 5 });
    await expect(page.locator(".drop-sibling-line")).toHaveCount(1);
    await expect(page.locator(".node-box.drop-into")).toHaveCount(0);

    await page.mouse.up();
    // 後片付け：クローンもフィードバックも残らない
    await expect(page.locator(".drag-clone")).toHaveCount(0);
    await expect(page.locator(".drop-sibling-line")).toHaveCount(0);
  });

  test("自分の子孫の上へは落とせない（循環参照ガード）", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await dragTo(page, "子1", "孫1", "center");

    const root = outline((await readStore(page)).trees[0].tree);
    expect(root.children.map((c) => c.text)).toEqual(["子1", "子2", "子3"]);
    expect(root.children[0].children.map((c) => c.text)).toEqual(["孫1"]);
  });

  test("何もない場所へ落とすと元の位置のまま", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await dragTo(page, "子3", null);
    expect(await children(page)).toEqual(["子1", "子2", "子3"]);
  });

  test("ルートのパネルはドラッグできない（ハンドルがない）", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    // ハンドル自体は描画されるが、ルートには mousedown が結び付かないので動かない
    const root = page.locator(".node-box.root");
    const from = await root.locator(".drag-handle").boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 40, { steps: 5 });
    await expect(page.locator(".drag-clone")).toHaveCount(0);
    await page.mouse.up();
  });

  test("ドラッグ移動は「元に戻す」で取り消せる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);

    await dragTo(page, "子3", "子2", "center");
    expect(await children(page)).toEqual(["子1", "子2"]);

    await page.click("#btnUndo");
    expect(await children(page)).toEqual(["子1", "子2", "子3"]);
  });
});

test.describe("ドラッグ&ドロップ（pyramid・radial）", () => {
  // pyramid は兄弟が横に並ぶため、前後の判定は左右端になる
  test("pyramid ではパネルの左端が「前に挿入」になる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    await importConfigFile(page, "sample-pyramid.logee-config.json");
    await expect(page.locator("#canvas")).toHaveClass(/layout-pyramid/);
    await page.click("#stgClose");

    await dragTo(page, "子3", "子1", "start");
    expect(await children(page)).toEqual(["子3", "子1", "子2"]);
  });

  test("radial でも中央へ落とせば子になる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    await importConfigFile(page, "sample-radial.logee-config.json");
    await expect(page.locator("#canvas")).toHaveClass(/layout-radial/);
    await page.click("#stgClose");

    await dragTo(page, "子3", "子2", "center");

    const root = outline((await readStore(page)).trees[0].tree);
    expect(root.children.map((c) => c.text)).toEqual(["子1", "子2"]);
    expect(root.children[1].children.map((c) => c.text)).toEqual(["子3"]);
  });
});
