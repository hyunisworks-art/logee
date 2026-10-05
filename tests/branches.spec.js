// 片側しか通っていなかった分岐を狙って踏むテスト群。
// 「リッチテキストか平文か」「旧データがあるか」「設定に何が入っているか」など、
// 正常系だけを流すと反対側に一度も入らない条件を対象にする。
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
  openSettings,
  autoDialog,
} = require("./helpers");

/** その場で作った設定JSONを設定ファイルの読込口から読ませる */
async function importConfigObject(page, obj) {
  await openSettings(page);
  await page.setInputFiles("#configFileInput", {
    name: "test.logee-config.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(obj), "utf-8"),
  });
}

/** 選択中パネルを編集状態にし、本文を全選択する */
async function editAndSelectAll(page, locator) {
  await selectNode(page, locator);
  await page.keyboard.press("F2");
  await locator.locator(".ql-editor").waitFor();
  await page.keyboard.press("Control+a");
}

test.describe("リッチテキストの書式", () => {
  test("太字にすると本文がHTMLになり、Markdownでは ** になる", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "見出し");

    await editAndSelectAll(page, page.locator(".node-box.root"));
    await page.locator(".format-btn.format-bold").click();
    await page.keyboard.press("Escape");

    const store = await readStore(page);
    expect(store.trees[0].tree.text).toContain("<strong>");

    await page.click("#btnExportMd");
    const textarea = page.locator(".modal-overlay textarea");
    await textarea.waitFor();
    expect(await textarea.inputValue()).toContain("**見出し**");
  });

  test("斜体は _ に変換される", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "強調");

    await editAndSelectAll(page, page.locator(".node-box.root"));
    await page.locator(".format-btn.format-italic").click();
    await page.keyboard.press("Escape");

    await page.click("#btnExportMd");
    const textarea = page.locator(".modal-overlay textarea");
    await textarea.waitFor();
    expect(await textarea.inputValue()).toContain("_強調_");
  });

  test("下線はMarkdownでは装飾なしの地の文になる", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "下線");

    await editAndSelectAll(page, page.locator(".node-box.root"));
    await page.locator(".format-btn.format-underline").click();
    await page.keyboard.press("Escape");

    const store = await readStore(page);
    expect(store.trees[0].tree.text).toContain("<u>");

    await page.click("#btnExportMd");
    const textarea = page.locator(".modal-overlay textarea");
    await textarea.waitFor();
    const md = await textarea.inputValue();
    expect(md).toContain("下線");
    expect(md).not.toContain("<u>");
  });

  test("箇条書きは - になり、書式ボタンの押下状態が反映される", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "項目");

    await editAndSelectAll(page, page.locator(".node-box.root"));
    const bullet = page.locator(".format-btn", { hasText: "箇条書き" });
    await bullet.click();
    await expect(bullet).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");

    await page.click("#btnExportMd");
    const textarea = page.locator(".modal-overlay textarea");
    await textarea.waitFor();
    expect(await textarea.inputValue()).toContain("- 項目");
  });

  test("書式を2回押すと解除される", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "普通");

    await editAndSelectAll(page, page.locator(".node-box.root"));
    const bold = page.locator(".format-btn.format-bold");
    await bold.click();
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Control+a");
    await bold.click();
    await page.keyboard.press("Escape");

    const store = await readStore(page);
    expect(store.trees[0].tree.text).not.toContain("<strong>");
  });
});

test.describe("旧データからの移行", () => {
  test("logicTree.v1 しかない場合は1本目のツリーとして取り込む", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem(
        "logicTree.v1",
        JSON.stringify({ id: "n1", text: "旧ツリー", collapsed: false, children: [{ id: "n2", text: "旧の子", collapsed: false, children: [] }] }),
      );
    });
    await page.goto("/");
    await page.waitForSelector(".node-box.root");

    await expect(page.locator(".node-box.root")).toContainText("旧ツリー");
    await expect(nodeBox(page, "旧の子")).toHaveCount(1);
    // 旧キーは消さずに残す（手動復旧用）
    expect(await page.evaluate(() => localStorage.getItem("logicTree.v1"))).not.toBeNull();
  });

  test("壊れた logicTree.v1 は無視して空のツリーで起動する", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("logicTree.v1", "{壊れたJSON");
    });
    await page.goto("/");
    await page.waitForSelector(".node-box.root");
    await expect(page.locator(".node-box.root .node-text")).toHaveText("クリックしてテーマを入力");
  });

  test("壊れた logicTree.v2 は無視して空のツリーで起動する", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("logicTree.v2", "[[[");
    });
    await page.goto("/");
    await page.waitForSelector(".node-box.root");
    await expect(page.locator(".node-box.root .node-text")).toHaveText("クリックしてテーマを入力");
  });
});

test.describe("統合設定（theme・keybinds を含む logee-config）", () => {
  test("theme と keybinds と template を同時に適用できる", async ({ page }) => {
    await openApp(page);
    await importConfigObject(page, {
      type: "logee-config",
      name: "統合設定",
      version: "1.0.0",
      theme: { colors: { accent: "#ff00aa", bg: "#101010" } },
      keybinds: { addSibling: "Insert" },
      template: { layout: "pyramid", connector: "straight", params: {} },
    });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--accent")))
      .toBe("#ff00aa");
    await expect(page.locator("#canvas")).toHaveClass(/layout-pyramid/);

    const settings = await readSettings(page);
    expect(settings.shortcuts.addSibling).toBe("Insert");
    // 既定のショートカットは消えずに残る（マージであって置き換えではない）
    expect(settings.shortcuts.addChild).toBe("Shift+Enter");
  });

  test("差し替えたショートカットが実際に効く", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "ルート");
    const root = page.locator(".node-box.root");
    await selectNode(page, root);
    await nodeButton(root, "＋下位").click();
    await typeInEditing(page, "子1");

    await importConfigObject(page, {
      type: "logee-config",
      name: "keybindsのみ",
      version: "1.0.0",
      keybinds: { addSibling: "Insert" },
    });
    await page.click("#stgClose");

    await selectNode(page, nodeBox(page, "子1"));
    await page.keyboard.press("Insert");
    await typeInEditing(page, "子2");

    expect(outline((await readStore(page)).trees[0].tree).children.map((c) => c.text)).toEqual(["子1", "子2"]);
  });

  test("theme だけの logee-config はレイアウトを変えない", async ({ page }) => {
    await openApp(page);
    await importConfigObject(page, {
      type: "logee-config",
      name: "テーマのみ",
      version: "1.0.0",
      theme: { colors: { accent: "#123456" } },
    });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--accent")))
      .toBe("#123456");
    await expect(page.locator("#canvas")).toHaveClass(/layout-tree/);
  });

  test("壊れたJSONは読み込みを断られる", async ({ page }) => {
    await openApp(page);
    const messages = autoDialog(page, true);
    await openSettings(page);
    await page.setInputFiles("#configFileInput", {
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{壊れている", "utf-8"),
    });

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain("JSON");
  });

  test("未知の type は何も起こさない", async ({ page }) => {
    await openApp(page);
    await importConfigObject(page, { type: "template", name: "将来用", version: "1.0.0" });
    await expect(page.locator("#canvas")).toHaveClass(/layout-tree/);
  });
});

test.describe("ショートカットの再割り当て", () => {
  test("修飾キーなしのキーを割り当てられる", async ({ page }) => {
    await openApp(page);
    await openSettings(page);

    const input = page.locator('.sc-input[data-action="addSibling"]');
    await input.click();
    await expect(input).toHaveValue("キーを押してください…");
    await input.press("Insert");

    await expect(input).toHaveValue("Insert");
    expect((await readSettings(page)).shortcuts.addSibling).toBe("Insert");
  });

  // 修飾キー付きの割り当ては、Ctrl の keydown が先に届く点が要注意。
  // 修飾キー単体で確定してしまうと、この組み合わせは永久に割り当てられない。
  test("修飾キー付きのキーを割り当てられる（Ctrl単体では確定しない）", async ({ page }) => {
    await openApp(page);
    await openSettings(page);

    const input = page.locator('.sc-input[data-action="addSibling"]');
    await input.click();
    await input.press("Control+Shift+K");

    await expect(input).toHaveValue("Ctrl+Shift+K");
    expect((await readSettings(page)).shortcuts.addSibling).toBe("Ctrl+Shift+K");
  });

  test("Escape を押すと元の割り当てに戻る", async ({ page }) => {
    await openApp(page);
    await openSettings(page);

    const input = page.locator('.sc-input[data-action="addChild"]');
    await input.click();
    await expect(input).toHaveValue("キーを押してください…");
    await input.press("Escape");

    await expect(input).toHaveValue("Shift+Enter");
  });
});

test.describe("ズームとキャンバス操作", () => {
  test("ズームは上限2.0・下限0.5で止まる", async ({ page }) => {
    await openApp(page);

    for (let i = 0; i < 15; i++) await page.keyboard.press("Control+=");
    expect((await readSettings(page)).zoom).toBe(2);

    for (let i = 0; i < 25; i++) await page.keyboard.press("Control+-");
    expect((await readSettings(page)).zoom).toBe(0.5);
  });

  test("修飾キーなしの↑↓でキャンバスが縦スクロールする", async ({ page }) => {
    await openApp(page);
    // 縦に伸ばしてスクロールできる状態を作る
    const root = page.locator(".node-box.root");
    await selectNode(page, root);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Shift+Enter");
      await page.keyboard.press("Escape");
      await page.locator(".node-box.selected").first().click({ force: true });
    }
    await page.click("#canvas", { position: { x: 5, y: 5 } });
    for (let i = 0; i < 10; i++) await page.keyboard.press("Control+=");

    const before = await page.evaluate(() => document.getElementById("canvas").scrollTop);
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(() => page.evaluate(() => document.getElementById("canvas").scrollTop))
      .toBeGreaterThan(before);

    const mid = await page.evaluate(() => document.getElementById("canvas").scrollTop);
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(() => page.evaluate(() => document.getElementById("canvas").scrollTop))
      .toBeLessThan(mid);
  });

  test("空白のドラッグでキャンバスをパンできる", async ({ page }) => {
    await openApp(page);
    const root = page.locator(".node-box.root");
    await selectNode(page, root);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Shift+Enter");
      await page.keyboard.press("Escape");
      await page.locator(".node-box.selected").first().click({ force: true });
    }
    for (let i = 0; i < 10; i++) await page.keyboard.press("Control+=");

    const canvas = await page.locator("#canvas").boundingBox();
    const x = canvas.x + canvas.width - 20;
    const y = canvas.y + canvas.height - 20;
    const before = await page.evaluate(() => document.getElementById("canvas").scrollTop);

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 30, y - 120, { steps: 10 });
    await page.mouse.up();

    await expect
      .poll(() => page.evaluate(() => document.getElementById("canvas").scrollTop))
      .toBeGreaterThan(before);
  });
});

test.describe("書き出し", () => {
  test("テーマのみ書き出すと現在のCSS変数が入ったJSONになる", async ({ page }) => {
    await openApp(page);
    await openSettings(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#stgThemeExport"),
    ]);
    expect(download.suggestedFilename()).toBe("logee-theme.json");

    const stream = await download.createReadStream();
    const body = await new Promise((resolve) => {
      let s = "";
      stream.on("data", (c) => (s += c));
      stream.on("end", () => resolve(s));
    });
    const json = JSON.parse(body);
    expect(json.type).toBe("theme");
    expect(json.colors.accent).toBeTruthy();
  });

  test("統合設定の書き出しには現在のレイアウトとキー割り当てが入る", async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    await page.setInputFiles("#configFileInput", {
      name: "radial.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ type: "logee-config", template: { layout: "radial", params: { radiusStep: 200 } } }),
        "utf-8",
      ),
    });
    await expect(page.locator("#canvas")).toHaveClass(/layout-radial/);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#stgConfigExport"),
    ]);
    const stream = await download.createReadStream();
    const body = await new Promise((resolve) => {
      let s = "";
      stream.on("data", (c) => (s += c));
      stream.on("end", () => resolve(s));
    });
    const json = JSON.parse(body);
    expect(json.type).toBe("logee-config");
    expect(json.template.layout).toBe("radial");
    expect(json.template.params).toMatchObject({ radiusStep: 200 });
    expect(json.keybinds.addChild).toBe("Shift+Enter");
  });

  test("Markdownをダウンロードできる", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "ダウンロード");
    await page.click("#btnExportMd");
    await page.locator(".modal-overlay textarea").waitFor();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#mdDownload"),
    ]);
    expect(download.suggestedFilename()).toMatch(/^logic-tree-\d{4}-\d{2}-\d{2}\.md$/);
  });
});

test.describe("防御的な分岐", () => {
  test("MODが未読込のまま「MODを解除」を押すと案内が出る", async ({ page }) => {
    await openApp(page);
    const messages = autoDialog(page, true);
    await openSettings(page);
    await page.click("#stgModDisable");

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain("MODは読み込まれていません");
  });

  // MODは永続化しない約束なので、設定に残っていても標準レイアウトで起動する
  test("settings に logee-mod が残っていても標準レイアウトで起動する", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("logicTree.settings", JSON.stringify({ layout: "logee-mod", zoom: 1 }));
    });
    await page.goto("/");
    await page.waitForSelector(".node-box.root");
    await expect(page.locator("#canvas")).toHaveClass(/layout-tree/);
  });

  test("未知のレイアウト名は tree に丸められる", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("logicTree.settings", JSON.stringify({ layout: "存在しない", zoom: 1 }));
    });
    await page.goto("/");
    await page.waitForSelector(".node-box.root");
    await expect(page.locator("#canvas")).toHaveClass(/layout-tree/);
  });

  test("欠けた項目のある logicTree.v2 は補完して読み込む", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem(
        "logicTree.v2",
        JSON.stringify({
          trees: [
            null, // 不正なエントリは捨てる
            { id: "t3", tree: { id: "n5", text: "壊れかけ", children: [] } }, // title・updatedAt がない
          ],
          activeId: "存在しないID", // 実在しないので1本目へ寄せる
        }),
      );
    });
    await page.goto("/");
    await page.waitForSelector(".node-box.root");

    await expect(page.locator(".node-box.root")).toContainText("壊れかけ");
    const store = await readStore(page);
    expect(store.trees).toHaveLength(1);
    expect(store.trees[0].title).toBe("");
    expect(typeof store.trees[0].updatedAt).toBe("number");
    expect(store.activeId).toBe("t3");
  });

  test("しきい値未満の動きではドラッグが始まらない", async ({ page }) => {
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "ルート");
    const root = page.locator(".node-box.root");
    await selectNode(page, root);
    await nodeButton(root, "＋下位").click();
    await typeInEditing(page, "子1");

    const handle = nodeBox(page, "子1").first().locator(".drag-handle");
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 1);
    await expect(page.locator(".drag-clone")).toHaveCount(0);
    await page.mouse.up();

    expect(outline((await readStore(page)).trees[0].tree).children.map((c) => c.text)).toEqual(["子1"]);
  });

  test("Markdown出力モーダルはコピーでき、閉じられる", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openApp(page);
    await setNodeText(page, page.locator(".node-box.root"), "コピー対象");

    await page.click("#btnExportMd");
    await page.locator(".modal-overlay textarea").waitFor();
    await page.click("#mdCopy");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("コピー対象");

    await page.click("#mdClose");
    await expect(page.locator(".modal-overlay")).toHaveCount(0);
  });
});

test.describe("クリップボードからの読取", () => {
  test("クリップボードのMarkdownをツリーに変換する", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openApp(page);
    await page.evaluate(() => navigator.clipboard.writeText("# 貼り付け\n\n## 論点X"));

    await page.click("#btnImportClipboard");
    await expect(nodeBox(page, "論点X")).toHaveCount(1);
    await expect(page.locator(".node-box.root")).toContainText("貼り付け");
  });

  test("クリップボードが空なら案内を出して何もしない", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openApp(page);
    await page.evaluate(() => navigator.clipboard.writeText("   "));

    const messages = autoDialog(page, true);
    await page.click("#btnImportClipboard");

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain("クリップボード");
    await expect(page.locator(".node-box.root .node-text")).toHaveText("クリックしてテーマを入力");
  });
});
