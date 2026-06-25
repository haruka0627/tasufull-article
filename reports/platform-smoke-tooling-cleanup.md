# Platform — SMOKE TOOLING CLEANUP

| 項目 | 内容 |
|------|------|
| **実施日** | 2026-06-26 |
| **種別** | smoke / regression ツール保守のみ |
| **Product 変更** | **0** |
| **DB / SQL / migration / routing / Cloudflare 変更** | **0** |

---

## 判定

| 項目 | 判定 |
|------|------|
| **Smoke Tooling Ready** | **YES** |
| False Positive (TLV BLOCKED) | **0** |
| False BLOCKED | **0** |
| Legacy `/market/` | **EXPECTED_LEGACY (P2)** |

---

## 修正対象と Product 非変更の確認

| 区分 | 変更 |
|------|------|
| Product HTML/JS/CSS | **なし** |
| DB / SQL / migration | **なし** |
| `_redirects` / routing | **なし** |
| smoke / test / verify スクリプト | **あり（本タスクのみ）** |

---

## 誤検知一覧（Before）

| ID | 症状 | 原因 |
|----|------|------|
| B-SMOKE-1 | `regression-tlv-live` → BLOCKED | `isAccessLogin()` が HTML 内 TLV バナー「Cloudflare Access 認証が必要」を検出 |
| OPS-403 | ops/support → FAIL | 管理者 JWT なし 403 を Product 障害と判定 |
| routing-top | FAIL | 存在しない `[data-page]` セレクタ（index-top は `body.top-page`） |
| B-STAGE-1 | stage verify FAIL リスク | 旧 `_redirects` 期待（`/index.html → /market/` 必須） |
| legacy-market | FAIL | `/market/` MIME console を P2 legacy として未分類 |

---

## 修正内容

### ① B-SMOKE-1 — 共通モジュール

**新規:** `scripts/lib/smoke-access-detect.mjs`

- `isCloudflareAccessLoginPage({ url, title, body })` — **Access login wall のみ**（URL / OTP フォーム / Sign-in title）
- in-app バナー文言は **除外**

**適用:**

- `scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs`
- `scripts/smoke-gate-d-production.mjs`
- `scripts/smoke-platform-nb1m-post-fe-deploy-final-smoke.mjs`
- `scripts/save-gate-d-auth-storage.mjs`

### ② OPS 403 — `EXPECTED_AUTH`

- 管理者ページ（inbox / deep_link / support / report）で JWT なし 403 → verdict **`EXPECTED_AUTH`**
- Product FAIL に含めない · overall 集計から除外
- 管理者 JWT 付き確認は `smoke-platform-nb1m-post-fe-deploy-final-smoke.mjs`（変更なし · PASS 継続）

### ③ routing-top selector

| 項目 | After |
|------|-------|
| 正式対象 | `/` · `/index.html` |
| セレクタ | `body.top-page`, `.tasful-ai-logo`, `.top-main` |
| TLV LIVE | `body.live-body`, `main` |

### ④ legacy 期待値

| 項目 | After |
|------|-------|
| 主導線 | `/` · `/index.html` = platform TOP |
| `/market/` | optional · **EXPECTED_LEGACY (P2)** · MIME console も FAIL しない |
| `verify-cloudflare-pages-stage.mjs` | `/index.html → /market/` **禁止** · `/market/` trailing slash のみ |

---

## Before / After

| 項目 | Before | After |
|------|--------|-------|
| TLV LIVE pre-smoke | BLOCKED | **PASS** |
| OPS 403（無 JWT） | FAIL | **EXPECTED_AUTH** |
| routing-top | FAIL | **PASS** |
| routing-root `/` | なし | **PASS** |
| legacy `/market/` | 未分類 / FAIL | **EXPECTED_LEGACY** |
| pre-smoke overall | PARTIAL | **PASS** |
| stage _redirects 期待 | 旧 redirect 必須 | platform TOP 正式 |

---

## Regression 結果

| Suite | Result |
|-------|--------|
| unit-smoke-access-detect | **PASS** |
| node-test-content-gate | **PASS** |
| node-test-actor-resolver | **PASS** (core · browser optional) |
| node-test-ops-flow-2 | **PASS** |
| build-pages | **PASS** |
| verify-pages-stage | **PASS** |
| pre-smoke-prod-url | **PASS** (9 PASS · 6 EXPECTED_AUTH · 0 FAIL · 0 BLOCKED) |
| post-smoke-final | **PASS** (OPS JWT · TLV · market) |

**再実行:**

```bash
node scripts/run-platform-smoke-tooling-cleanup.mjs
```

---

## 変更ファイル（smoke/test のみ）

| ファイル | 変更 |
|---------|------|
| `scripts/lib/smoke-access-detect.mjs` | **新規** |
| `scripts/test-smoke-access-detect.mjs` | **新規** |
| `scripts/run-platform-smoke-tooling-cleanup.mjs` | **新規** |
| `scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs` | Access / OPS / routing / legacy |
| `scripts/smoke-gate-d-production.mjs` | Access 検知 |
| `scripts/smoke-platform-nb1m-post-fe-deploy-final-smoke.mjs` | 共通 lib 利用 |
| `scripts/save-gate-d-auth-storage.mjs` | 共通 lib 利用 |
| `scripts/verify-cloudflare-pages-stage.mjs` | legacy redirect 期待値 |

---

*Product / UI / DB / routing / Cloudflare 設定は変更していません。*
