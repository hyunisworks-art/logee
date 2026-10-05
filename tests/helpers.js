// logic-tree の E2E テスト共通ヘルパー。
// アプリは localStorage に状態を持つため、各テストは必ず clean な状態から始める。

const path = require("path");

const APP_DIR = path.resolve(__dirname, "..");

/** サンプル設定ファイル（samples/）の絶対パス */
function sampleFile(name) {
  const dir = name.includes(".logee-theme.") ? "themes"
            : name.includes(".logee-mod.")   ? "mods"
            : "configs";
  return path.join(APP_DIR, "samples", dir, name);
}

/**
 * アプリを開く。
 * localStorage は goto 前に addInitScript で消す（goto 後に消すと
 * 初期化済みの store がそのまま保存され直してしまう）。
 * addInitScript は reload のたびに走るため、消去は初回だけに限定する
 * （そうしないと「リロードで復元される」ことを確認できない）。
 */
async function openApp(page) {
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("__testCleared")) {
        localStorage.clear();
        sessionStorage.setItem("__testCleared", "1");
      }
    } catch (_) {}
  });
  await page.goto("/");
  await page.waitForSelector(".node-box.root");
  await waitForQuill(page);
}

/** Quill（CDN読み込み）の準備完了を待つ。編集系テストの前提。 */
async function waitForQuill(page) {
  await page.waitForFunction(() => typeof window.Quill === "function", null, { timeout: 15_000 });
}

/** ノードのパネル。text 指定時はその本文を持つパネル */
function nodeBox(page, text) {
  return text === undefined
    ? page.locator(".node-box")
    : page.locator(".node-box").filter({ hasText: text });
}

/** パネルを選択状態にする（操作ボタンは選択中のみ現れる） */
async function selectNode(page, locator) {
  await locator.click();
  await locator.and(page.locator(".selected")).waitFor();
}

/**
 * パネルの本文を書き換える。
 * ダブルクリック → Quill エディタに入力 → 別の場所をクリックして確定、まで行う。
 */
async function setNodeText(page, locator, text) {
  await locator.dblclick();
  const editor = locator.locator(".quill-editor .ql-editor");
  await editor.waitFor();
  await editor.click();
  await page.keyboard.type(text);
  await commitEdit(page);
  await page.locator(".node-box").filter({ hasText: text }).first().waitFor();
}

/**
 * 「＋下位」「＋同列」で追加された直後のパネルへ入力する。
 * 追加操作は新パネルをそのまま編集状態にするので、ダブルクリックは不要。
 */
async function typeInEditing(page, text) {
  const editor = page.locator(".node-box.editing .quill-editor .ql-editor");
  await editor.waitFor();
  await editor.click();
  await page.keyboard.type(text);
  await commitEdit(page);
  await page.locator(".node-box").filter({ hasText: text }).first().waitFor();
}

/** 編集を確定する（キャンバス空白のクリックでは選択も外れるため Escape を使う） */
async function commitEdit(page) {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".node-box.editing"));
}

/** 選択中パネルの操作ボタンを押す */
function nodeButton(locator, label) {
  return locator.locator(".node-actions button", { hasText: label });
}

/** localStorage に保存されたツリー群を読む */
function readStore(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("logicTree.v2") || "null"));
}

/** localStorage に保存された設定を読む */
function readSettings(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("logicTree.settings") || "null"));
}

/** ノードの本文だけを取り出した入れ子構造にする（構造の比較用） */
function outline(node) {
  return { text: stripHtml(node.text), children: (node.children || []).map(outline) };
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

/** 設定モーダルを開く */
async function openSettings(page) {
  await page.click("#btnSettings");
  await page.waitForSelector("#stgConfigImport");
}

/** 設定ファイル（.logee-config.json / .logee-theme.json）を読み込ませる */
async function importConfigFile(page, filename) {
  await openSettings(page);
  await page.setInputFiles("#configFileInput", sampleFile(filename));
}

/** MODファイル（.logee-mod.json）を読み込ませる */
async function importModFile(page, filename) {
  await openSettings(page);
  await page.setInputFiles("#modFileInput", sampleFile(filename));
}

/** その場で組み立てたMODオブジェクトを読み込ませる（異常系テスト用） */
async function importModObject(page, obj) {
  await openSettings(page);
  await page.setInputFiles("#modFileInput", {
    name: "test.logee-mod.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(obj), "utf-8"),
  });
}

/** MODの読み込み確認モーダルで「読み込む」を押す */
async function acceptMod(page) {
  const accept = page.locator("#modAccept");
  await accept.waitFor();
  await accept.click();
}

/** confirm / alert を自動で処理する。戻り値は捕捉したメッセージの配列 */
function autoDialog(page, accept = true) {
  const messages = [];
  page.on("dialog", async (d) => {
    messages.push(d.message());
    await (accept ? d.accept() : d.dismiss());
  });
  return messages;
}

module.exports = {
  APP_DIR,
  sampleFile,
  openApp,
  waitForQuill,
  nodeBox,
  selectNode,
  setNodeText,
  typeInEditing,
  commitEdit,
  nodeButton,
  readStore,
  readSettings,
  outline,
  stripHtml,
  openSettings,
  importConfigFile,
  importModFile,
  importModObject,
  acceptMod,
  autoDialog,
};
