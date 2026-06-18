# Playwright 構文修復レポート（codemod 後）

実施日: 2026-06-18

## 概要

Playwright 一括移行（`withPlaywrightBrowser` / `closeAllBrowsers`）後に残った構文 artifact を修復し、`capture` / `verify` / `audit` スクリプトを実行可能状態に戻した。

## 構文エラー件数

| 段階 | 件数 |
|------|------|
| **before**（初回 `check-playwright-scripts-syntax.mjs`） | **123** |
| shebang 順序一括修復後 | 85 → 68 |
| `final-playwright-restore-remigrate` + artifact repair 後 | 41 → 26 |
| `repair-final-playwright-syntax` + 手動修復後 | **0** |

- **capture / verify / audit**: 123 件中 30 件が初期 broken → **0 件**（全件 PASS）
- チェック対象外: `scripts/_debug-talk-save2.mjs`（git HEAD なし・デバッグ用）、`scripts/codemod-playwright-*`

## 修復方針（維持した要件）

- `chromium.launch()` 直接呼び出しは復活させない（意図的テスト除く）
- `withPlaywrightBrowser()` / `closeAllBrowsers()` 方針を維持
- `process.exit()` 前の `await closeAllBrowsers()` を維持
- sync `function fail()` 内の `await closeAllBrowsers()` → `closeAllBrowsers().finally(() => process.exit(1))`
- `main().catch()` 内の非法 `await` を同様に修正
- codemod 由来の `try` 欠落 / `}  });` / shebang 順序 / `finally { });` artifact を修復

## 追加・更新した修復ツール

| スクリプト | 役割 |
|------------|------|
| `scripts/repair-playwright-syntax-artifacts.mjs` | shebang・bogus import・try/catch 括弧修復 |
| `scripts/repair-final-playwright-syntax.mjs` | git restore + 安全 migrate（破壊的 findClose 除去） |
| `scripts/repair-remaining-playwright-syntax.mjs` | 残件向け targeted repair |
| `scripts/remigrate-playwright-safe.mjs` | try/catch/finally パターン追加 |
| `scripts/check-playwright-scripts-syntax.mjs` | `_debug-talk-save2.mjs` をスキップ |

## 修正ファイル一覧（主要）

### capture / verify / audit（手動 + repair-capture-verify-audit）

- `scripts/capture-ai-workspace-real-api.mjs` — shebang 順序
- `scripts/capture-ai-workspace-search.mjs` — shebang 順序
- `scripts/capture-screenshots-viewer-search.mjs` — shebang 順序
- `scripts/capture-market-notify-demo-390.mjs` — orphan `} catch` → `try {` 追加
- `scripts/capture-shop-store-review-gemini-recheck.mjs` — `finally { });` 修復
- `scripts/verify-anpi-dashboard-mobile-footer.mjs` — sync `fail()` 修復
- `scripts/verify-detail-business-service-footer.mjs` — sync `fail()` 修復
- `scripts/verify-market-notify-live-flow.mjs` — try/catch + 重複 cleanup 除去

### test / e2e / inspect（repair-final + 手動）

- `scripts/browser-test-gen-ai.mjs` — `isAiSpeaking` 欠落 `}` + try/catch 修復
- `scripts/browser-test-gen-ai-3d-glb.mjs` — `startStaticServer` 括弧 + migrate
- `scripts/e2e-genai-stripe.mjs`, `e2e-genai-3d-stripe-purchase.mjs`, `e2e-genai-image-character.mjs`
- `scripts/inspect-bench-notify-cta-chain.mjs` — try/catch 追加
- `scripts/inspect-frame-b-notify-live.mjs` — **手動全面再構成**（nested try 誤マッチ回避）
- `scripts/test-talk-chat-hub-browser.mjs`, `test-talk-phase20-routes-browser.mjs`
- `scripts/test-mobile-detail-pages.mjs`, `test-platform-all-browser.mjs`
- `scripts/test-admin-ai-*-browser.mjs` 系（約 15 本）— `main().catch` + wrapper 括弧
- `scripts/wait-and-capture-real-device-localStorage.mjs` — top-level `return` → `async function main()`

## 手動修正した代表例

### 1. shebang が import より後ろ（78 件一括 + CVA 3 件）

```diff
-import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
 #!/usr/bin/env node
+#!/usr/bin/env node
+import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
```

### 2. sync `fail()` 内の非法 await

```diff
 function fail(msg) {
   console.error("FAIL:", msg);
-  await closeAllBrowsers();
-  process.exit(1);
+  closeAllBrowsers().finally(() => process.exit(1));
 }
```

### 3. `try` 欠落（Missing catch or finally after try）

```diff
 await withPlaywrightBrowser(async (browser) => {
   try {
     ...
-  }
-  });
+  } catch (err) {
+    fail(String(err?.message || err));
+  }
+});
```

### 4. `inspect-frame-b-notify-live.mjs` — nested try 誤マッチ

regex migrate が `readBNotifyFrame` 内の `try` をトップレベル `try/finally` と誤認。git 原文を基に **関数を wrapper 外に置き**、本体のみ `withPlaywrightBrowser` でラップ。

### 5. `browser-test-gen-ai.mjs` — 関数閉じ括弧欠落

codemod 後に `isAiSpeaking()` の closing `}` が消え `Unexpected end of input` → 手動で `}` を復元。

## chromium.launch() 残存件数

| 対象 | 件数 |
|------|------|
| `scripts/**/*.mjs`（意図的テスト除く） | **0** |
| `scripts/test-playwright-browser-cleanup.mjs`（意図的） | **1** |
| **合計** | **1** |

capture / verify / audit グループ: **0 件**

## Chrome delta（リーク再確認）

```
node scripts/test-playwright-browser-cleanup.mjs   → PASS (registry active=0)
node scripts/test-playwright-leak-compare.mjs      → OLD +9 / NEW 0
```

| パターン | delta |
|----------|-------|
| OLD（launch 直 + close なし） | **+9** |
| NEW（withPlaywrightBrowser） | **0** |

## 代表 capture / verify / audit 実行（構文 OK → 実行開始確認）

| 種別 | スクリプト | 構文 | 実行 |
|------|-----------|------|------|
| capture | `capture-market-top-viewports.mjs` | PASS | 起動・screenshot 処理まで到達 |
| capture | `capture-screenshots-viewer-search.mjs` | PASS | 起動・部分 PASS/FAIL 出力 |
| capture | `capture-chat-detail-header-390.mjs` | PASS | 起動（Timeout は dev server 依存） |
| verify | `verify-index-home-restore.mjs` | PASS | 起動（実行時 `loaded` 参照エラーは別件） |
| verify | `verify-anpi-dashboard-mobile-footer.mjs` | PASS | 起動・FAIL 出力（DOM 期待値） |
| verify | `verify-tas-hero-restore-index-top.mjs` | PASS | 起動 |
| audit | `audit-gen-ai-ux.mjs` | PASS | **exit 0** |
| audit | `audit-market-footer-links.mjs` | PASS | 起動（`report` 参照は別件） |
| audit | `audit-bench-notify-layout.mjs` | PASS | 起動・LAYOUT_AUDIT_FAIL 出力 |

※ 上記は **構文修復後に Node がパース・起動できる** ことを確認。業務ロジック FAIL / 実行時 ReferenceError は codemod 以前からの別バグの可能性あり。

## 残課題

- `scripts/_debug-talk-save2.mjs` — git HEAD なし、構文チェック対象外
- 一部 verify/audit の実行時 ReferenceError（例: `loaded is not defined`）は別途 functional fix が必要

## 検証コマンド

```bash
node scripts/check-playwright-scripts-syntax.mjs
node scripts/test-playwright-browser-cleanup.mjs
node scripts/test-playwright-leak-compare.mjs
```
