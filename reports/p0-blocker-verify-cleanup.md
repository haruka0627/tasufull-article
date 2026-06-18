# P0-BLOCKER-VERIFY-CLEANUP — 検証クリーンアップ

**実施日:** 2026-06-18  
**前提:** P0-BLOCKER-FIX 完了（C-1 / C-2 / C-4）  
**スコープ外:** TALK 通話 · 市場 GMV · Stripe Live · 独自ドメイン設定作業（NB-1D 手動）

---

## 総合判定: **READY_WITH_WARNINGS**

| 判定 | 意味 |
|------|------|
| **READY_WITH_WARNINGS** | P0 コード BLOCKER 3 件は解消済み。**HP 移植フェーズ（NB-1D / apex 接続）へ進行可**。MAJOR 残存と live redeploy を警告として扱う |
| ~~BLOCKED~~ | 該当せず — C-1/C-2/C-4 再発なし |
| ~~READY_FOR_HP_MIGRATION~~ | apex 未到達 · Connect/ANPI MAJOR 残存のため、無警告 READY とはしない |

---

## 1. test-auth-ops-guard 末尾 timeout — 解消

**原因:** 末尾セグメントが `talk-home.html` を開いていたが、同ページは `auth-ops-guard.js` 未配線 → `TasuAuthOpsGuard` 待ち timeout。

**対応（最小変更）:** `scripts/test-auth-ops-guard.mjs` — デモ preview 検証を **既配線済み** `admin-operations-dashboard.html?talkDev=1&talkAdmin=1` に変更。

**結果:** `SUMMARY: ALL PASS`（dev server 起動時）

---

## 2. P0 BLOCKER 再発チェック

| ID | 確認項目 | 結果 |
|----|----------|------|
| **C-1** | `DEV_SKIP_AUTH = true` 定数 | **再発なし** — `isDevSkipAuthAllowed()` · pages.dev/tasful.jp で false |
| **C-2** | ops guard 未配線 | **再発なし** — 5 ops HTML + dist すべて `auth-ops-guard.js` 参照 |
| **C-4** | Builder URL/LS/default owner 本番経路 | **再発なし** — `isBuilderProdHost()` 委譲 · 34 builder HTML に `builder-actor-identity.js` |

---

## 3. 自動検証

| コマンド | 結果 |
|----------|------|
| `npm run build:pages` | **PASS** |
| `npm run verify:pages-stage` | **PASS**（927 files · auth stack 同梱） |
| `node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev` | **PASS** |
| `node scripts/test-auth-ops-guard.mjs` | **ALL PASS** |
| `node scripts/test-builder-actor-identity.mjs` | **ALL PASS** |

---

## 4. 警告（HP 移植前に認識）

| # | 内容 | 影響 |
|---|------|------|
| W-1 | **live pages.dev 未 redeploy の可能性** | ローカル dist は修正済み · `main` push + CF deploy 後に live でも ops/member ガードが有効化 |
| W-2 | **C-10a apex 未到達** | HP 移植作業そのもの（NB-1D 手動）— コード BLOCKER ではない |
| W-3 | **C-5 Connect UI/DB 分裂** | MAJOR — HP 移植スコープ外 · Connect 本番前に要対応 |
| W-4 | **C-3 ANPI LS 昇格** | MAJOR — ops guard 配線済みだが healthcheck 別経路 |
| W-5 | **C-9 市場 notify** | MAJOR — GMV スコープ外 |
| W-6 | browser テスト | dev server 必須（`npm run dev`） |

---

## 5. 変更ファイル（本タスク）

| ファイル | 変更 |
|----------|------|
| `scripts/test-auth-ops-guard.mjs` | talk-home → admin-operations-dashboard（末尾セグメント） |

---

## 6. 次フェーズ推奨アクション

1. `main` へ merge + Cloudflare Pages redeploy
2. NB-1D: `tasful.jp` DNS · Custom Domain · Supabase Site URL
3. redeploy 後: pages.dev smoke 再実行 + ops 403 手動確認
4. Connect UI 一本化（C-5）— HP 移植と並行可能

**HP 移植 GO/NO-GO:** **GO（警告付き）**
