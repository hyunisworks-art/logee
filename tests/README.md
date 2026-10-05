# tests

`index.html` の E2E テスト（Playwright）。テスト用の依存はこのフォルダーに閉じてあり、デプロイ対象には影響しない。

```bash
npm install          # 初回のみ
npx playwright test  # static-server.js が自動起動する
```

| ファイル | 内容 |
| --- | --- |
| `TESTCASES.md` | テストケース一覧と調査記録 |
| `helpers.js` | 共通ヘルパー（起動・選択・入力・設定/MOD読込） |
| `static-server.js` | テスト用の静的サーバー（`file://` だと localStorage が隔離されないため） |
| `fixtures/` | 読込テスト用の .md とMODフィクスチャ |

環境変数 `PW_BASE_URL`（本番URLへ流す）、`PW_CHANNEL=chrome`（実機Chromeを使う）に対応。詳細は `TESTCASES.md` を参照。
