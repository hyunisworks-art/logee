# MOD（`.logee-mod.json`）のセキュリティ概要

Logee は、ユーザーが持ち込んだ JavaScript で**ノードの配置座標だけ**を差し替える MOD 機能を持ちます。DOM の生成権限は渡しません。

**信頼できる作者の MOD だけ**読み込んでください。隔離はブラウザの `iframe sandbox` と CSP に依存します。

## 設計上の境界

| 項目 | 内容 |
| --- | --- |
| 実行場所 | `sandbox="allow-scripts"` の `<iframe srcdoc>` 内（`allow-same-origin` は付けない → opaque origin） |
| 渡すデータ | ツリー構造のみ（`id` / `collapsed` / `children`）。ノード本文は渡さない |
| 戻り値 | 各ノードの座標（数値）。全ノード分を検証し、1 つでも不正なら結果全体を破棄 |
| 永続化 | MOD 状態は `localStorage` に保存しない（再読み込みで標準レイアウトに戻る） |
| タイムアウト | 応答 1 秒・起動 3 秒で解除（無限ループ対策） |
| 読込口 | 通常の設定インポートでは MOD を拒否。専用の読込口からのみ |

iframe 内 CSP は `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'` です。`unsafe-eval` は MOD コードを `new Function` で組み立てるために必要で、外部通信は `default-src 'none'` で塞いでいます。

## 想定される脅威と対策（要約）

| 脅威 | 対策 |
| --- | --- |
| `localStorage` / Cookie / 親 DOM へのアクセス | opaque origin と sandbox により到達不可 |
| ツリー本文の外部送信 | 本文を MOD に渡さない。iframe 内の通信は CSP で遮断 |
| 無限ループ | 1 秒タイムアウトで iframe 破棄（**ブラウザが iframe を親と別プロセスに隔離することが前提**） |
| 壊れた座標 | 有限かつ範囲内の座標のみ受理 |

## Quill（CDN）について

リッチテキスト編集は [Quill](https://quilljs.com/) 1.3.7 を jsDelivr から読み込みます（BSD-3-Clause）。アプリ本体はサーバーへツリー内容を送信しませんが、**編集パネル利用時は CDN 取得のためネットワーク接続が必要**です。

## 残る留意点

- MOD ファイルは第三者配布されうるため、コードを含まない `.logee-config.json` とは別カテゴリとして扱ってください。
- `srcdoc` 非対応や古いブラウザでは MOD が起動せず、タイムアウトで解除されます（フェイルセーフ側）。
