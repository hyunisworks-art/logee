// MOD（logee-mod）のテスト。設計と脅威モデルは ../docs/security-check-mod-2026-08-08.md を参照。
// ここでは「隔離が崩れていないこと」と「異常なMODは必ず解除されること」を確認する。
const { test, expect } = require("./fixtures/test-base");
const {
  openApp,
  nodeBox,
  selectNode,
  typeInEditing,
  nodeButton,
  importModFile,
  importModObject,
  acceptMod,
  autoDialog,
} = require("./helpers");
const mods = require("./fixtures/mods");

async function buildTree(page) {
  const root = page.locator(".node-box.root");
  await selectNode(page, root);
  await nodeButton(root, "＋下位").click();
  await typeInEditing(page, "子1");
  const c = nodeBox(page, "子1");
  await selectNode(page, c);
  await nodeButton(c, "＋同列").click();
  await typeInEditing(page, "子2");
}

/**
 * MOD/radial レイアウトの配置結果を読む。
 * 座標が当たるのはパネル（.node-box）ではなく外側の .radial-node なので、そちらを見る。
 */
function panelPositions(page) {
  return page.$$eval("#canvas .radial-node", (els) =>
    els.map((el) => ({ id: el.dataset.id, left: el.style.left, top: el.style.top })),
  );
}

test.describe("MOD（コード注入）", () => {
  test("読み込みには確認モーダルの承認が要る", async ({ page }) => {
    await openApp(page);
    await importModFile(page, "sample-spiral.logee-mod.json");

    await expect(page.locator("#modAccept")).toBeVisible();
    await expect(page.locator("#modBadge")).toHaveText(""); // 承認前は適用されない

    await page.click("#modCancel");
    await expect(page.locator("#modBadge")).toHaveText("");
  });

  test("承認するとMODバッジが出て配置が差し替わる", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    await importModFile(page, "sample-spiral.logee-mod.json");
    await acceptMod(page);

    await expect(page.locator("#modBadge")).toContainText("Spiral Layout");
    await expect(page.locator("#canvas")).toHaveClass(/layout-radial/);
    // 全パネルが絶対配置される（＝MOD/radial系の描画になっている）
    await expect
      .poll(async () => {
        const pos = await panelPositions(page);
        return pos.length === 3 && pos.every((p) => p.left !== "" && p.top !== "");
      })
      .toBe(true);
  });

  test("MODはリロードで解除され、標準レイアウトへ戻る", async ({ page }) => {
    await openApp(page);
    await importModFile(page, "sample-spiral.logee-mod.json");
    await acceptMod(page);
    await expect(page.locator("#modBadge")).toContainText("Spiral");

    // 永続化されていないこと（settings.layout は書き換えない）
    const layout = await page.evaluate(
      () => (JSON.parse(localStorage.getItem("logicTree.settings") || "{}").layout),
    );
    expect(layout).not.toBe("logee-mod");

    await page.reload();
    await page.waitForSelector(".node-box.root");
    await expect(page.locator("#modBadge")).toHaveText("");
    await expect(page.locator("#canvas")).toHaveClass(/layout-tree/);
  });

  test("バッジの「解除」ボタンで標準レイアウトへ戻せる", async ({ page }) => {
    await openApp(page);
    await importModFile(page, "sample-spiral.logee-mod.json");
    await acceptMod(page);
    await expect(page.locator("#modBadge")).toContainText("Spiral");

    await page.locator("#modBadge button").click();
    await expect(page.locator("#modBadge")).toHaveText("");
    await expect(page.locator("#canvas")).toHaveClass(/layout-tree/);
  });

  test("正常なMODの座標がそのまま反映される", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    await importModObject(page, mods.column);
    await acceptMod(page);
    await expect(page.locator("#modBadge")).toContainText("Column");

    // 縦一列に並べるMODなので、left は全ノードで同じ・top は全て異なる
    await expect
      .poll(async () => {
        const pos = await panelPositions(page);
        if (pos.length !== 3 || pos.some((p) => p.left === "")) return null;
        return { xs: new Set(pos.map((p) => p.left)).size, ys: new Set(pos.map((p) => p.top)).size };
      })
      .toEqual({ xs: 1, ys: 3 });
  });

  test("MODは localStorage へ到達できない（opaque origin）", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    // localStorage が読めてしまったら MOD 側が例外を投げ、解除アラートが出る
    const messages = autoDialog(page, true);
    await importModObject(page, mods.storageProbe);
    await acceptMod(page);

    await page.waitForTimeout(2000);
    expect(messages.filter((m) => m.includes("leaked:"))).toEqual([]);
    await expect(page.locator("#modBadge")).toContainText("StorageProbe");
  });

  test("例外を投げるMODは解除される", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    const messages = autoDialog(page, true);
    await importModObject(page, mods.throws);
    await acceptMod(page);

    await expect(page.locator("#modBadge")).toHaveText("");
    expect(messages.join("\n")).toContain("MODを解除しました");
  });

  test("不正な座標を返すMODは解除される", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    const messages = autoDialog(page, true);
    await importModObject(page, mods.badPositions);
    await acceptMod(page);

    await expect(page.locator("#modBadge")).toHaveText("");
    expect(messages.join("\n")).toContain("座標が不正");
  });

  test("上限を超える座標を返すMODは解除される", async ({ page }) => {
    await openApp(page);
    await buildTree(page);
    const messages = autoDialog(page, true);
    await importModObject(page, mods.hugeCoords);
    await acceptMod(page);

    await expect(page.locator("#modBadge")).toHaveText("");
    expect(messages.join("\n")).toContain("座標が不正");
  });

  // 1秒タイムアウトが効くのは、ブラウザが sandbox iframe を親と別プロセスへ隔離した場合だけ。
  // 実機 Chrome（PW_CHANNEL=chrome）では 1 秒で解除されUIも操作可能なままだが、
  // Playwright 同梱の Chromium は同一スレッドで動かすため、MODの無限ループでタブごと固まる。
  // 同梱Chromiumでは検証できないので、実機Chrome指定のときだけ実行する。
  test("無限ループのMODはタイムアウトで解除される", async ({ page }) => {
    test.skip(
      !process.env.PW_CHANNEL,
      "sandbox iframe をプロセス隔離するブラウザが必要（PW_CHANNEL=chrome で実行）",
    );
    await openApp(page);
    await buildTree(page);
    const messages = autoDialog(page, true);
    await importModObject(page, mods.infinite);
    await acceptMod(page);

    await expect(page.locator("#modBadge")).toHaveText("", { timeout: 15_000 });
    expect(messages.join("\n")).toMatch(/応答がありません|起動しませんでした/);
  });

  test("layout.code がないファイルは読み込みを断られる", async ({ page }) => {
    await openApp(page);
    const messages = autoDialog(page, true);
    await importModObject(page, mods.noCode);

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain("layout.code");
    await expect(page.locator("#modAccept")).toHaveCount(0);
  });

  test("MODの読込口は logee-mod 以外を受け付けない", async ({ page }) => {
    await openApp(page);
    const messages = autoDialog(page, true);
    await importModObject(page, { type: "theme", name: "Theme", colors: {} });

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain("MOD 専用");
  });
});
