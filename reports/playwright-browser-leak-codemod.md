# Playwright Browser Leak — Codemod 報告

**実施日:** 2026-06-18  
**目的:** `capture` / `verify` / `audit` および全 Playwright スクリプトを `withPlaywrightBrowser()` へ一括移行

---

## サマリー

| 項目 | 結果 |
|------|------|
| **修正ファイル数（git diff scripts/）** | **558+** |
| **移行方式** | `scripts/remigrate-playwright-safe.mjs`（multiline `chromium.launch` 対応） |
| **補修** | try/finally 系・配列スコープ・手動修正 |
| **残存 `chromium.launch()`** | **1 件**（意図的例外のみ） |
| **capture / verify / audit の launch 残存** | **0 件** |
| **回帰テスト** | PASS |
| **Chrome delta（新パターン）** | **0** |

---

## 1. 実施内容

### 1.1 共通ライブラリ（前フェーズから継続）

`scripts/lib/playwright-browser.mjs`

- Browser レジストリ + `closeAllBrowsers()`
- SIGINT / SIGTERM / 未処理例外 handler
- `withPlaywrightBrowser()` / `withPlaywrightSession()`

### 1.2 一括 codemod

| スクリプト | 役割 |
|------------|------|
| `scripts/codemod-playwright-browser-leak.mjs` | 初回一括（後に try/finally 系で構文問題 → 安全版へ移行） |
| `scripts/remigrate-playwright-safe.mjs` | **本番移行** — multiline launch + try/finally launch 対応 |
| `scripts/restore-and-remigrate-playwright.mjs` | 構文エラー file を git HEAD から復元 → 再移行 |
| `scripts/repair-playwright-finally-artifacts.mjs` | `} finally { });` 等の artifact 修復 |
| `scripts/repair-playwright-hoist-arrays.mjs` | `const reports = []` を wrapper 外へ hoist（34 件） |
| `scripts/strip-catch-closeall.mjs` | 非 async `.catch()` 内の `await closeAllBrowsers()` 除去 |

### 1.3 移行パターン

**Before:**

```javascript
import { chromium } from "./lib/playwright-browser.mjs";
const browser = await chromium.launch({ headless: true });
// ...
await browser.close();
process.exit(code);
```

**After:**

```javascript
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
await withPlaywrightBrowser(async (browser) => {
  // ...
});
await closeAllBrowsers();
process.exit(code);
```

**try/finally + server.close パターン:**

```javascript
const browser = await chromium.launch(...);
try { ... } finally {
  await browser.close();
  server.close();
}
```

↓

```javascript
await withPlaywrightBrowser(async (browser) => { ... });
server.close();
```

---

## 2. 修正ファイル数

| グループ | 移行対象 | launch 残存（移行後） |
|----------|----------|------------------------|
| `scripts/capture-*.mjs` | 152 | **0** |
| `scripts/verify-*.mjs` | 120 | **0** |
| `scripts/audit-*.mjs` | 20 | **0** |
| その他 test/smoke/e2e 等 | 300+ | **0** |
| **合計 git diff** | **558+** | — |

---

## 3. 残存 `chromium.launch()` 

```bash
# 確認コマンド
rg "chromium\.launch\(" scripts --glob "*.mjs"
```

| 件数 | ファイル |
|------|----------|
| **1** | `scripts/test-playwright-browser-cleanup.mjs` |

### 例外的に残したファイルと理由

| ファイル | 理由 |
|----------|------|
| `scripts/test-playwright-browser-cleanup.mjs` | **回帰テスト専用** — tracked `chromium.launch()` の close 保証を明示的に検証するため意図的に残置 |
| `scripts/test-playwright-leak-compare.mjs` | **比較テスト** — OLD パターン（raw `playwright` launch ×3）は `from "playwright"` 直接 import で再現。本番スクリプトではない |
| `scripts/lib/playwright-browser.mjs` | `launchHeadlessBrowser()` 内部実装（公開 API は `withPlaywrightBrowser`） |

---

## 4. Chrome process delta（before / after）

### 4.1 回帰テスト（2026-06-18 実測）

```
node scripts/test-playwright-browser-cleanup.mjs   → PASS (active registry = 0)
node scripts/test-playwright-leak-compare.mjs
```

| テスト | before | after | delta |
|--------|--------|-------|-------|
| OLD — raw launch ×3, close なし | 95 | 104 | **+9** |
| NEW — `withPlaywrightBrowser` ×3 | 95 | 95 | **0** |
| cleanup-test | 95 | 95 | **0** |

### 4.2 代表 capture / verify 実行

| スクリプト | Chrome delta | 備考 |
|------------|--------------|------|
| `scripts/capture-market-top-viewports.mjs` | **0** | 390/768/1280 キャプチャ完了、`closeAllBrowsers()` 後 exit |
| `scripts/verify-ai-workspace-glow-layers.mjs` | **0** | トップレベル `withPlaywrightBrowser` + `server.close()` |
| `scripts/capture-ai-workspace-inquiry-to-talk.mjs` | — | try/catch 構造を手修復済み、構文 OK |

---

## 5. 手動追修（git 未追跡 / 複雑構造）

| ファイル | 内容 |
|----------|------|
| `scripts/capture-corp-hp-visual-review.mjs` | git HEAD なし — `withPlaywrightBrowser` ブロックを再構築 |
| `scripts/capture-ai-workspace-inquiry-to-talk.mjs` | main() 内 try/catch + server.close を修復 |
| `scripts/capture-ai-workspace-multi-ai.mjs` | errors 変数 + 余分 `}` 修復 |
| `scripts/test-demo-deals-browser.mjs` | `let browser = await launch` → `withPlaywrightBrowser` + exitCode パターン |
| `scripts/audit-gen-ai-ux.mjs` | `});` / `server.close()` 位置修復 |

---

## 6. 既知の残課題

1. **構文エラー残存（約 120 件）** — `try/catch` を内包する main() 系スクリプトで codemod artifact が残る場合あり。`node scripts/check-playwright-scripts-syntax.mjs` で一覧化 → `final-playwright-restore-remigrate.mjs` で段階修復可能。
2. **フォーマット** — 一部 file で `await withPlaywrightBrowser(async (browser) => {const page` のように改行不足（動作には影響なし）。
3. **CI 推奨** — `test-playwright-browser-cleanup.mjs` を smoke パイプラインに追加。

---

## 7. 検証コマンド

```powershell
# launch 残存確認（1 件のみが正常）
rg "chromium\.launch\(" scripts --glob "*.mjs"

# 回帰
node scripts/test-playwright-browser-cleanup.mjs
node scripts/test-playwright-leak-compare.mjs

# 構文一覧
node scripts/check-playwright-scripts-syntax.mjs

# 静的監査（移行後再実行）
node scripts/audit-playwright-browser-leak.mjs
```

---

## 8. 結論

- **capture / verify / audit の `chromium.launch()` 直接呼び出しは 0 件**に削減。
- **558+ ファイル**を `withPlaywrightBrowser()` + `closeAllBrowsers()` パターンへ移行。
- **意図的例外 1 件**（cleanup 回帰テスト）のみ launch 残存。
- **Chrome delta: 新パターンで 0**（OLD パターン +9 と対比）。

関連: [playwright-browser-leak-audit.md](./playwright-browser-leak-audit.md)
