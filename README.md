# Logee（ロジー）

ブラウザだけで動く、無料のロジックツリー（思考整理）ツールです。データは端末内の `localStorage` に保存され、**サーバーへ内容を送りません**（Quill エディタ用 CDN 読込を除く）。

**デモ（本番）:** https://logee-logic-tree.vercel.app/

**解説・更新通知:** [note の記事](https://note.com/hyu_nisworks/n/nfc96807ed86e)

## 起動方法

1. このリポジトリを Clone または Download する
2. `index.html` をブラウザで開く（ビルド不要）
3. ネットワーク: リッチテキスト編集に [Quill](https://quilljs.com/) 1.3.7 を jsDelivr から読み込むため、**編集パネル利用時はオンライン接続が必要**

Vercel 等にデプロイする場合は、ルートの `index.html` と `logo.png` だけを公開する運用が想定されています（`.vercelignore` 参照）。

## 主な機能

- ルートから右方向へ階層を増やすロジックツリー編集（複数ツリーの保存・切替）
- ノードの追加・削除・ドラッグ移動、折りたたみ、Undo（最大 50 件）
- Markdown の読込・出力（ネスト見出し）
- 設定: インデント、ズーム、レイアウト（tree / tree-rtl / pyramid / radial）
- 配色テーマ・ショートカット・レイアウト設定の JSON インポート／エクスポート
- 上級者向け: `.logee-mod.json` による配置計算の差し替え（サンドボックス内 JS。**セキュリティ上の注意あり**）

## 設定ファイル

設定画面（歯車）から読込・書き出しできます。拡張子は慣例として次を使います。

| 拡張子 | `type` フィールド | 用途 |
| --- | --- | --- |
| `.logee-theme.json` | `theme` | 配色のみ |
| `.logee-config.json` | `logee-config` | テーマ + ショートカット + レイアウト |
| `.logee-mod.json` | `logee-mod` | コード入り MOD（**専用の読込口**からのみ） |

標準の設定インポートに MOD ファイルを選ぶと拒否され、MOD 用の読込口の案内が表示されます。

## テーマファイル（`.logee-theme.json`）

テーマは CSS カスタムプロパティ `--*` を上書きします。インポート時は `document.documentElement` に `setProperty` され、`localStorage` キー `logicTree.theme` に保存されます。「テーマをリセット」で上書きを解除し、保存データも削除します。

### スキーマ

```json
{
  "type": "theme",
  "name": "My Theme",
  "version": "1.0.0",
  "colors": {
    "bg": "#f5f6f8",
    "panel": "#ffffff",
    "text": "#1f2430",
    "text-sub": "#7a8093",
    "line": "#7a8494",
    "accent": "#3b6fe0",
    "accent-soft": "#e8effd",
    "selected-border": "#7c3aed",
    "editing-border": "#d97706",
    "danger": "#d1495b",
    "border": "#dde1e8"
  }
}
```

### `colors` のキー（すべて文字列・CSS 色値）

| キー | 用途（概要） |
| --- | --- |
| `bg` | ページ背景 |
| `panel` | ノードパネル背景 |
| `text` | 本文 |
| `text-sub` | 補助テキスト |
| `line` | 接続線 |
| `accent` | 強調・アクセント |
| `accent-soft` | 薄いアクセント 背景 |
| `selected-border` | 選択中ノードの枠 |
| `editing-border` | 編集中ノードの枠 |
| `danger` | 削除等 |
| `border` | 一般ボーダー |

**含まれないもの:** エクスポート対象外の `--shadow`（固定 CSS）や `--indent`（設定画面の数値）があります。既定の配色はダークで、`:root` に定義しています。ライトは `samples/themes/sample-light.logee-theme.json` を読み込むと使えます。テーマ JSON で上書きした値が優先されます。

### 作り方

1. アプリで好みの見た目に近づける（または既存テーマをインポート）
2. 設定 →「テーマをエクスポート」で `.logee-theme.json` を保存
3. `name` / 色値をエディタで編集 → 再インポート

サンプル: `samples/themes/` に `sample-dark`（既定と同じ）、`sample-light`、`sample-aqua` などがあります。

## 統合設定（`.logee-config.json`）

```json
{
  "type": "logee-config",
  "name": "My Config",
  "version": "1.0.0",
  "theme": { "colors": { } },
  "keybinds": { "addChild": "Shift+Enter" },
  "template": {
    "layout": "tree",
    "connector": "straight",
    "params": {}
  }
}
```

- **`theme.colors`:** テーマと同形式。省略可。
- **`keybinds`:** 下表のアクション名 → ショートカット文字列。未指定キーは組み込みデフォルトのまま。`Ctrl` は Windows/Linux の Ctrl と macOS の ⌘（Cmd）の両方にマッチします。
- **`template.layout`:** `tree` | `tree-rtl` | `pyramid` | `radial`（不正値は `tree` にフォールバック）
- **`template.connector`:** 現状 `straight` のみ実質利用（値の保持・往復）
- **`template.params`:** レイアウト固有。`radial` では例: `radiusStep`, `startAngle`, `sweep`, `gap`（`samples/configs/sample-radial.logee-config.json` 参照）

### デフォルトショートカット（上書き可能なアクション名）

| アクション名 | デフォルト |
| --- | --- |
| `addChild` | Shift+Enter |
| `addSibling` | Enter |
| `edit` | F2 |
| `delete` | Delete |
| `collapse` | Ctrl+ArrowUp |
| `undo` | Ctrl+z |
| `exportMd` | Ctrl+Shift+E |
| `importMd` | Ctrl+Shift+I |
| `importClipboard` | Ctrl+Shift+V |
| `moveUp` / `moveDown` / `moveLeft` / `moveRight` | Alt+矢印 |
| `zoomIn` / `zoomOut` / `zoomReset` | Ctrl+= / Ctrl+- / Ctrl+0 |

設定は `localStorage` キー `logicTree.settings` に保存されます。

## MOD（`.logee-mod.json`）について

配置座標をユーザー提供 JavaScript で差し替える拡張です。**信頼できる作者の MOD だけ**読み込んでください。実行は sandbox iframe 内に限定していますが、ブラウザ実装に依存します。詳細は `docs/security-mod.md` を参照。

## カスタマイズの進め方

1. **Fork / Clone** して `index.html` を編集（単一ファイル完結）
2. **テーマだけ**配布する: `.logee-theme.json` を作成し、設定からインポート
3. **レイアウト preset** を配布: `.logee-config.json` の `template` を共有
4. **配置アルゴリズム** を試す: `.logee-mod.json`（例: `samples/mods/sample-spiral.logee-mod.json`）

ツリーの中身は Markdown 入出力でやり取りできます。複数ツリーの一括エクスポートは未対応です。

## 開発・テスト（任意）

```bash
cd tests && npm install && npx playwright test
```

ケース一覧: `tests/TESTCASES.md`。本番 URL に対して流す場合は `PW_BASE_URL` を指定。

## サードパーティ

- [Quill](https://github.com/slab/quill) 1.3.7（BSD-3-Clause）— jsDelivr CDN 経由で読み込み。初回の編集利用時にネットワーク接続が必要です。

## 不具合報告・更新連絡・要望について

Logee は無料で全機能を使えます。

- **不具合報告:** [GitHub の Issue](https://github.com/hyunisworks-art/logee/issues) で受け付けます。再現手順、ブラウザの種類とバージョンを添えてください。
- **更新連絡・機能の要望:** [note の記事](https://note.com/hyu_nisworks/n/nfc96807ed86e)（100 円）の購入者向けに提供しています。要望の Issue は受け付けません。

Logee はオープンソース（MIT License）として公開しており、Fork して自由に改変・再配布できます。開発と更新は作者が行う方針のため、Pull Request は原則として受け付けません。

## ライセンス

[MIT License](./LICENSE) — Copyright (c) hyunisworks-art / ひゅー
