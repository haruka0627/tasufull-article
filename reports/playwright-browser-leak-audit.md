# Playwright Browser Leak 監査レポート

**実施日:** 2026-06-18  
**症状:** Chrome を閉じてもタスクマネージャー上の `Google Chrome` / `chrome-headless-shell` プロセス数が増加し続ける  
**対象:** `scripts/capture-*.mjs`, `scripts/verify-*.mjs`, `scripts/smoke-*.mjs`, および Playwright を使用する全スクリプト（603 件）

---

## 1. 原因

### 根本原因

Playwright スクリプトの大半が **トップレベルで `await chromium.launch()` し、`try/finally` なしで `browser.close()` を呼んでいた** ため、以下のいずれかで **orphan `chrome-headless-shell.exe` が残存** していた。

| トリガー | 挙動 |
|----------|------|
| スクリプト内の例外 | `browser.close()` 未到達 → プロセス残留 |
| `process.exit()` を `finally` より前に実行 | 同上 |
| SIGINT (Ctrl+C) | Node プロセスのみ終了、子 Chrome は残る |
| 未処理 Promise rejection | 同上 |
| 複数 `launch` + 1 回だけ `close` | 2 本目以降の Browser が未解放 |

### 再現テスト結果

`scripts/test-playwright-leak-compare.mjs` で **修正前パターン（launch 3 回・close なし・例外）** と **修正後パターン（`withPlaywrightBrowser` 3 回・例外）** を比較:

| パターン | Chrome プロセス数 (before → after) | 増分 (delta) |
|----------|--------------------------------------|--------------|
| **修正前** — raw `playwright` launch、例外で close スキップ ×3 | 96 → 105 | **+9** |
| **修正後** — `withPlaywrightBrowser` + 例外 ×3 | 96 → 96 | **0** |

1 Browser あたり約 3 プロセス（親 + renderer 等）が残留するため、スクリプトを繰り返し実行するたびにタスクマネージャーの Chrome 数が単調増加していた。

### 静的監査サマリー

`node scripts/audit-playwright-browser-leak.mjs` → `reports/playwright-browser-leak-audit.json`

| 指標 | 件数 |
|------|------|
| スキャン対象 | 603 |
| 問題あり | 395 |
| `no_finally_close` | 365 |
| `top_level_no_finally` | 250 |
| `close_count_lt_launch` | 27 |
| `raw_playwright_import`（lib 未経由） | 28 |
| `no_lib_wrapper` | 34 |

**グループ別（capture / verify / smoke）:**

| グループ | 総数 | 問題あり |
|----------|------|----------|
| capture | 152 | 117 |
| verify | 120 | 80 |
| smoke | 4 | **0**（今回修正済み） |

### 調査項目チェックリスト

| # | 調査内容 | 結果 |
|---|----------|------|
| 1 | `browser.close()` が全スクリプトで実行されているか | **否** — 365 件で `finally` なし。27 件は launch 数 > close 数 |
| 2 | `page.close()` が必要な箇所で実行されているか | 一部のみ。`withPlaywrightSession` 利用時は finally で page/context を close |
| 3 | `try/finally` で `browser.close()` を保証しているか | **否** — 250 件がトップレベル launch + finally なし |
| 4 | Promise 未完了でプロセスが残っていないか | 未処理 rejection 時に cleanup なし（修正前）。lib 導入後は handler で close |
| 5 | `child_process` で起動した Chrome が残存していないか | Playwright 経由の headless shell が主因。直接 spawn は少数 |
| 6 | 例外発生時でもブラウザが確実に終了するか | **修正前: 否 / 修正後: lib 利用スクリプトは可** |

---

## 2. 該当ファイル

### 2.1 今回修正済み（代表）

| ファイル | 問題 | 対応 |
|----------|------|------|
| `scripts/lib/playwright-browser.mjs` | グローバル cleanup なし | Browser レジストリ + シグナル handler + `withPlaywrightBrowser` |
| `scripts/capture-corp-hp-visual-review.mjs` | top-level launch、finally なし | `try/finally` + `closeAllBrowsers()` |
| `scripts/capture-iwasho-home-top.mjs` | top-level launch | `withPlaywrightBrowser()` |
| `scripts/smoke-post-empty-cards.mjs` | finally なし | `try/finally` で page/browser close |
| `scripts/smoke-post-fs-ui.mjs` | 同上 | 同上 |
| `scripts/smoke-post-fs-restore.mjs` | 同上 | 同上 |
| `scripts/smoke-cloudflare-pages.mjs` | 複数 browser、finally 弱い | `finally` で `closeAllBrowsers()` |
| `scripts/audit-shop-vendor-flow-supplement.mjs` | finally なし | `try/finally` |

### 2.2 高リスク未修正（`close_count_lt_launch` — launch > close）

27 件。代表例:

```
scripts/audit-ai-workspace-category-flow.mjs
scripts/verify-ai-workspace-category-demos.mjs
scripts/verify-ai-workspace-code-ui.mjs
scripts/verify-ai-workspace-generate-ui.mjs
scripts/verify-ai-workspace-glow-layers.mjs
scripts/capture-market-notify-ui-review.mjs
scripts/lib/capture-demo-video-390.mjs
scripts/capture-ai-workspace-inquiry-to-talk.mjs
scripts/capture-ai-workspace-multi-ai.mjs
scripts/capture-ai-workspace-real-api.mjs
scripts/capture-ai-workspace-search.mjs
scripts/capture-chatgpt-real-api.mjs
scripts/capture-claude-real-api.mjs
scripts/capture-market-cart-390.mjs
scripts/capture-market-notify-demo-390.mjs
…（全件は audit JSON 参照）
```

### 2.3 raw `playwright` 直接 import（lib 未経由）— 28 件

上記高リスク群とほぼ重複。`from "playwright"` で launch すると **レジストリ・シグナル cleanup の対象外**。

### 2.4 その他

- **capture:** 117 / 152 件に静的問題（主に `no_finally_close`）
- **verify:** 80 / 120 件
- **test:** 206 件中多数（開発時の繰り返し実行で leak 蓄積しやすい）

---

## 3. 修正内容

### 3.1 共通ライブラリ `scripts/lib/playwright-browser.mjs`

```text
+ activeBrowsers Set — launch 時に track、disconnect で untrack
+ closeAllBrowsers() — 全 tracked browser を close
+ getActiveBrowserCount() / countChromeProcesses() — 診断用
+ withPlaywrightBrowser(fn) — launch + fn + finally close
+ withPlaywrightSession(fn) — browser + context + page、finally で page/context close
+ chromium.launch — tracked launchHeadlessBrowser へのエイリアス
+ プロセス handler（初回 import 時に 1 回だけ）:
    SIGINT, SIGTERM, uncaughtException, unhandledRejection, beforeExit
```

**推奨パターン（新規・修正時）:**

```javascript
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage();
  try {
    // ...
  } finally {
    await page.close().catch(() => null);
  }
});
await closeAllBrowsers(); // 念のため
```

### 3.2 個別スクリプト

- **smoke 系 4 件:** すべて `try/finally` または `closeAllBrowsers()` 済み
- **capture 代表 2 件:** `withPlaywrightBrowser` / `try/finally` へ移行
- **audit 1 件:** `try/finally` 追加

### 3.3 回帰テスト・監査ツール（新規）

| スクリプト | 用途 |
|------------|------|
| `scripts/test-playwright-browser-cleanup.mjs` | 例外後も active registry = 0 |
| `scripts/test-playwright-leak-compare.mjs` | 修正前後の Chrome プロセス delta 比較 |
| `scripts/audit-playwright-browser-leak.mjs` | 静的監査 → JSON 出力 |

---

## 4. 修正前後 — Chrome プロセス数比較

### 4.1 実測（2026-06-18、Windows 10）

**環境:** 既存 orphan プロセス多数あり（baseline 96 プロセス = headless-shell + chrome 合算）

| テスト | 操作 | before | after | delta |
|--------|------|--------|-------|-------|
| 修正前パターン | raw launch ×3、例外で close スキップ | 96 | 105 | **+9** |
| 手動 cleanup 後 | orphan 3 browser を close | 105 | 96 | -9 |
| 修正後パターン | `withPlaywrightBrowser` ×3、各回例外 | 96 | 96 | **0** |
| 回帰テスト | `test-playwright-browser-cleanup.mjs` | 97 | 97 | 0（registry=0 PASS） |

### 4.2 解釈

- **修正前:** 1 回の失敗スクリプト実行で **+9 プロセス** が残留。日次で capture/verify/test を数十回回すと **数百プロセス** に達しうる。
- **修正後（lib 利用）:** 同一条件下で **delta 0**。レジストリ上の active browser も 0。
- **残存 baseline（96）:** 過去の leak による orphan。一度 `Get-Process chrome-headless-shell | Stop-Process` 等で掃除後、以降 lib 経由スクリプトのみ使用すれば増分は抑止可能。

### 4.3 確認コマンド

```powershell
# プロセス数確認
(Get-Process chrome-headless-shell -ErrorAction SilentlyContinue).Count
(Get-Process chrome -ErrorAction SilentlyContinue).Count

# 回帰テスト
node scripts/test-playwright-browser-cleanup.mjs
node scripts/test-playwright-leak-compare.mjs

# 静的再監査
node scripts/audit-playwright-browser-leak.mjs
```

---

## 5. 推奨フォローアップ

1. **優先:** `close_count_lt_launch` 27 件 — 2 本目の browser を `finally` で close、または `withPlaywrightBrowser` へ統合
2. **raw playwright import 28 件** — `./lib/playwright-browser.mjs` の `chromium` に置換
3. **capture / verify 残 197 件** — 段階的に `withPlaywrightBrowser` へ移行（一括 codemod 可）
4. **既存 orphan 掃除** — 開発 PC で headless-shell を一度停止し、以降 delta を監視
5. **CI** — `test-playwright-browser-cleanup.mjs` を smoke パイプラインに追加

---

## 6. 結論

| 項目 | 内容 |
|------|------|
| **原因** | `browser.close()` が例外・SIGINT・早期 exit でスキップされ、orphan headless Chrome が蓄積 |
| **該当規模** | 603 スクリプト中 395 件に静的問題。smoke 4 件は修正済み |
| **今回の修正** | 共通 lib に registry + シグナル cleanup + `withPlaywrightBrowser`。代表 8 ファイル修正 |
| **効果** | 同一再現テストで delta **+9 → 0**（修正後パターン） |
| **残課題** | capture/verify/test の大半は未移行。lib 未 import の script は従来どおり leak しうる |

詳細なファイル一覧・issue 種別は `reports/playwright-browser-leak-audit.json` を参照。
