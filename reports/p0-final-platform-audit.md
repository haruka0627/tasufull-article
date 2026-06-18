# P0-FINAL-AUDIT — 本番投入前プラットフォーム監査

**実施日:** 2026-06-18  
**種別:** 調査のみ（**コード変更なし · 修正なし**）  
**前提:** NB-1C **READY**（`tasufull-article.pages.dev`）· NB-1D **未適用**（`tasful.jp` 未到達）  
**除外:** Stripe Live · Connect 本番 onboarding · Auth Runbook Phase B 9 シナリオ（未実施）

**方法:** リポジトリ静的解析 · 既存監査レポート照合 · `deploy/cloudflare/dist` / stage 設定確認 · 代表 HTML→JS 配線 grep

**参照:** [`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md) · [`nb1d-custom-domain-auth-precheck.md`](nb1d-custom-domain-auth-precheck.md) · 各 `*-final-audit-remaining-issues.md`

---

## 総合判定: **NOT_READY**

| 判定 | **NOT_READY** |
|------|---------------|
| 意味 | **本番 apex（`tasful.jp`）での実ユーザー・実権限・実決済投入は不可** |
| デモ / pages.dev 限定公開 | 静的配信 smoke **PASS** — **パイロット表示のみ**は可能 |
| 主因 | 会員ガード無効 · ops 公開 · Builder/Connect/市場の権限・決済ギャップ · TALK 通話未配線 · 本番 host 未到達 |

### 判定マトリクス

| 状態 | 判定 |
|------|------|
| CRITICAL 解消 · apex 200 · Auth Phase A–C PASS | **READY** |
| CRITICAL なし · HIGH 残存 · デモ限定可 | **READY_WITH_WARNINGS** |
| CRITICAL 複数 · 権限/決済/本番 host 未整備 | **NOT_READY** ← **現状** |

---

## 領域サマリ（7 ロール × 6 ドメイン）

| 領域 | 未ログイン | 一般会員 | Connect 未/完了 | buyer / seller | ops | 総合 |
|------|------------|----------|-----------------|----------------|-----|------|
| **Auth** | ❌ ガード無効 | ❌ 同上 | ❌ UI/DB 分裂 | ❌ market 未統合 | ❌ ops 全公開 | **NOT_READY** |
| **TALK** | ⚠️ 公開閲覧可 | ⚠️ chat-detail 身份 | — | — | ❌ ops TALK 無防備 | **NOT_READY** |
| **Builder** | ❌ `?role=owner` | ❌ URL/LS 昇格 | — | — | ❌ admin 無ガード | **NOT_READY** |
| **市場** | ⚠️ 閲覧可 | ⚠️ 導線切れ | — | ❌ モック決済/通知 | — | **NOT_READY** |
| **Connect** | — | ❌ LS 偽装可 | ❌ UI≠DB | — | — | **NOT_READY** |
| **AI Workspace** | ⚠️ 静的デモ UI | ❌ JWT 未接続 | — | — | — | **NOT_READY** |

---

# CRITICAL

## C-1 · Auth — 会員ガード全無効（全ロール）

| 項目 | 内容 |
|------|------|
| **ファイル** | `member-auth.js` L18 |
| **事象** | `DEV_SKIP_AUTH = true` → `guardMemberPage` / `isAuthenticated` が常に true |
| **影響** | `dashboard.html` · `payment-settings.html` · `my-listings.html` 等 — **未ログインでも会員 UI 到達** |
| **分類** | 権限漏れ · 本番化リスク |
| **pages.dev** | 同左（host 非依存） |

---

## C-2 · Auth — ops 画面が静的公開（ops ロール）

| 項目 | 内容 |
|------|------|
| **ファイル** | `auth-ops-guard.js`（**git 未追跡 · main 未含有**）· 全 ops HTML |
| **事象** | `auth-ops-guard.js` を読む HTML **0 件**。`admin-operations-dashboard.html` · `admin-ai-operations-center.html` · `support-trouble-center.html` · `talk-ops-room.html` は Supabase/ops JS のみ |
| **影響** | AI 運営司令塔 · 運営センター · 問い合わせセンター · レガシー ops TALK が **URL 知っていれば全開** |
| **分類** | 権限漏れ · 本番化リスク |

---

## C-3 · Auth — ANPI LINE 管理が URL/LS で昇格（ops）

| 項目 | 内容 |
|------|------|
| **ファイル** | `anpi-line-healthcheck.js` · `anpi-line-admin.js` · `anpi-line-admin.html` |
| **事象** | `?anpi_admin=1` / `localStorage tasu_anpi_line_admin_v1` で admin UI 表示。本番 host ガードなし |
| **影象** | LINE Push テスト等の管理 UI が **誰でも到達可能** |
| **分類** | 権限漏れ · localStorage 依存 |

---

## C-4 · Builder — 本番 host でも URL/LS で owner 昇格（全 Builder フロー）

| 項目 | 内容 |
|------|------|
| **ファイル** | `builder/builder.js` L1189–1207 |
| **事象** | `getRole()` = `?role=` → sessionStorage → localStorage → **default `"owner"`**。`TasuBuilderActorIdentity` **未使用** |
| **配線** | `builder-actor-identity.js` は **`builder/index.html` のみ**。案件作成/応募/スレッド/完了/レビュー等 **30+ HTML 未配線** |
| **影響** | `builder/mvp-thread.html?role=owner` · `admin-applications.html?role=owner` で **採用/完了/管理 UI** |
| **分類** | 権限漏れ · localStorage 依存 · pages.dev でも再現（`tasful.jp` では auth helper が host 判定するが builder.js は別経路） |

---

## C-5 · Connect — UI が production DB 状態を無視（Connect 未完了/完了）

| 項目 | 内容 |
|------|------|
| **ファイル** | `connect-member-ui.js` · `payment-settings.js` vs `connect-state.js` |
| **事象** | `TasuConnectState` は LS 禁止設計だが、描画は `connect-member-ui.resolveConnectStep()` が **LS/URL 無条件** |
| **影響** | 本番 host で LS に `ready` 偽装 → **Connect 完了 UI 表示**（DB と不一致） |
| **分類** | 権限漏れ · localStorage 依存 · 導線切れ（DB 正と UI 正の分裂） |

---

## C-6 · TALK — 通話スタックが HTML に未配線（通話導線）

| 項目 | 内容 |
|------|------|
| **ファイル** | `scripts/talk-call-*.js` · `talk-call.css` · `talk-service-worker.js` · `chat-detail.html` |
| **事象** | talk-call 関連 script/CSS/SW を読む HTML **0 件**。`data-talk-call-start-button` なし |
| **影響** | チャット詳細から **発信/着信 UI 不能**（資産は dist にコピーされるが未使用） |
| **分類** | 導線切れ · ボタン無反応（将来配線後も `_headers` microphone 禁止でブロック — C-7） |
| **docs 乖離** | `reports/talk-call-phase2-chat-detail.md` / E2E テスト期待と **現ソース不一致** |

---

## C-7 · Infra — `_headers` が microphone 禁止（通話本番化）

| 項目 | 内容 |
|------|------|
| **ファイル** | `deploy/cloudflare/_headers` L7 |
| **事象** | `Permissions-Policy: camera=(), microphone=(), geolocation=()` が `/*` に適用 |
| **影響** | WebRTC 通話の `getUserMedia` **ブロック**（HTML 配線後も） |
| **分類** | 本番化リスク |

---

## C-8 · 市場 — 実決済なし（buyer / seller）

| 項目 | 内容 |
|------|------|
| **ファイル** | `shop-market-checkout.js` · `shop-store-checkout.js` |
| **事象** | `confirmOrder()` → localStorage のみ → 完了ページ。Stripe / `shop_orders` **未接続** |
| **影響** | カート→注文完了は **デモのみ**（[`marketplace-payment-production-gap.md`](marketplace-payment-production-gap.md)） |
| **分類** | 本番化リスク · UX 重大（本番と誤認） |

---

## C-9 · 市場 — 購入通知が常に `u_me`（buyer / seller）

| 項目 | 内容 |
|------|------|
| **ファイル** | `shop-market-notify.js` L9–15, L61–66 |
| **事象** | `BUYER_USER_ID = "u_me"` 固定。本番 config に `currentUserId` なし → fallback `u_me`。`?userId=` も無ガード |
| **影響** | TALK 購入通知が **誤ユーザー**へ。`market-identity.js` 未統合 |
| **分類** | 権限漏れ · pages.dev / tasful.jp 共通 |

---

## C-10 · Infra — 本番 apex 未到達（全ドメイン）

| 項目 | 内容 |
|------|------|
| **根拠** | [`nb1d-custom-domain-auth-precheck.md`](nb1d-custom-domain-auth-precheck.md) · DNS NXDOMAIN |
| **事象** | `tasful.jp` 未配信 · `SITE_URL` Secret 未設定 · Supabase Site URL 未切替 |
| **影響** | `isProductionHost()` **実機未検証** · Featured Checkout 戻り先不安定 |
| **分類** | 本番化リスク · pages.dev 限定挙動との差 |

---

# HIGH

## H-1 · Auth — `auth-current-user.js` 配線が 4 ページのみ

| 読込あり | 未読込（例） |
|----------|--------------|
| `talk-home.html` · `payment-settings.html` · `shop-market-cart.html` · `builder/index.html` | `dashboard.html` · `chat-detail.html` · `profile-settings.html` · 全 ops · 全市場（cart 除く） · 全 AI |

**影響:** JWT / fallback lockdown が **ページ単位で欠落**。NB-1C smoke は 8 URL のみ PASS。

---

## H-2 · Auth — `auth-ops-guard.js` が git / 本番 deploy に不在

| 項目 | 内容 |
|------|------|
| **事象** | ローカルに存在するが **未 commit**。clean build から欠落リスク |
| **分類** | 本番化リスク · 404（将来配線してもファイル不在） |

---

## H-3 · TALK — `chat-detail.html` に auth なし + 本番で `u_me` fallback

| 項目 | 内容 |
|------|------|
| **ファイル** | `chat-detail.html` · `chat-user-identity.js` |
| **事象** | `auth-current-user.js` 未読込。production mode で JWT 空時 **config 默认 `u_me`** |
| **影響** | 未ログインでも **デモユーザーとしてチャット UI** の可能性 |
| **分類** | 権限漏れ · 導線切れ（ログイン誘導弱い） |

---

## H-4 · TALK — `talk-calendar.html` がデモ seed のみ

| 項目 | 内容 |
|------|------|
| **ファイル** | `talk-calendar.html` · `talk-room-calendar-demo-seed.js` |
| **事象** | auth / supabase config なし。カレンダー導線は **ローカルデモデータ** |
| **分類** | 導線切れ · localStorage 依存 · UX 重大（本番データ非連動） |

---

## H-5 · TALK — `talk-runtime.js` が LS session を本番でも受理

| 項目 | 内容 |
|------|------|
| **ファイル** | `talk-runtime.js` |
| **事象** | `tasu_member_session` を `auth-current-user` より寛容に読む |
| **分類** | localStorage 依存 · pages.dev / tasful.jp 差 |

---

## H-6 · Builder — admin 系ページに ops / JWT ガードなし

| ページ例 | リスク |
|----------|--------|
| `admin-applications.html` · `admin-reviews.html` · `admin-dispatch.html` | `?role=owner` で管理 UI |

---

## H-7 · 市場 — `market-identity.js` が cart 以外未配線

| 未配線 | `shop-market-checkout.html` · `complete` · `mypage` · `order-history` · `seller-orders` · `shop-store.html` |
| **影響** | seller/buyer 判定が **未統合**（STEP5 レポートとコード乖離） |

---

## H-8 · 市場 — 導線切れ（404 ではないが誤 destination）

| 場所 | 問題 |
|------|------|
| `shop-store.html` タブバー L349–355 | **注文** → `index.html`（正: `shop-market-order-history.html`）· **マイページ** → `profile-settings.html` |
| `shop-products.html` ヘッダー | カート/お気に入り/マイページ → `index.html` |
| **分類** | 導線切れ · UX 重大 |

---

## H-9 · 市場 — 注文履歴/ seller orders が LS 共有・認可なし

| 項目 | 内容 |
|------|------|
| **キー** | `tasu_market_order_history` 等 |
| **事象** | buyer スコープなし · `?shopId=` 任意で seller 画面 |
| **分類** | 権限漏れ · localStorage 依存 |

---

## H-10 · AI Workspace — JWT 未接続 · GenAI 課金不可

| ページ | 事象 |
|--------|------|
| `ai-workspace.html` | 固定表示「はるかまん」· auth stack なし |
| `gen-ai-workspace.html` | `getGenAiUserId()` が config `currentUserId` 依存 → 本番 build では **空** → Checkout エラー |
| **分類** | 権限漏れ · 本番化リスク |

---

## H-11 · Connect — dashboard が connect-state 未読込

| 項目 | 内容 |
|------|------|
| **ファイル** | `dashboard.html` · `connect-member-ui.js` |
| **事象** | Connect バナーが LS ベース · URL に `talkDev=1` 付与 |
| **分類** | 導線切れ · pages.dev 限定挙動 |

---

## H-12 · 検証 — stage verify が配線漏れを検出不能

| 項目 | 内容 |
|------|------|
| **ファイル** | `scripts/verify-cloudflare-pages-stage.mjs` |
| **事象** | talk-call は `talk-call-webrtc.js` 1 ファイルのみ必須。HTML→JS 参照未検証 |
| **影響** | NB-1C smoke PASS でも **通話/Builder 権限/ops ガード欠落を見逃す** |

---

# MEDIUM

## M-1 · Auth — ガード対象外ページ

`member-auth.js` 読込あるが `MEMBER_GUARD_PAGES` 外: `talk-home.html` · `profile-edit.html` · `deal-detail.html` · `anpi-dashboard.html`

`member-auth.js` 自体なし: `chat-detail.html` · `voice-settings.html`

---

## M-2 · Auth — ops JS が guard 欠落時 demo 昇格

`ops-talk.js` · `admin-ai-action-executor.js` → `TasuTalkRuntime.isTalkAdmin()`（`?talkAdmin=1` / LS）

---

## M-3 · TALK — 通知導線

`talk-home.html` 通知一覧は配線済。talk-call **着信通知**（`talk-call-notify-bridge.js`）は未読込。Web Push Phase 7.1 **未適用**（[`talk-call-final-release-review.md`](talk-call-final-release-review.md)）

---

## M-4 · TALK — `talk-home.html` で `chat-supabase-config.js` 二重読込

L825 + L888 — console ノイズ潜在

---

## M-5 · TALK — `chat-detail.html` の `/post` リンク

ルート相対 `/post` — 静的 host では **404 リスク**（`post.html` は存在）

---

## M-6 · Builder — `patch-builder-html-auth-stack.mjs` 未適用

一括 auth 注入スクリプト存在 · **未実行**

---

## M-7 · 市場 — Path B Stripe（`checkout.html`）が商品導線から未接続

`shop-market-product-detail.js` → Path A モック checkout のみ

---

## M-8 · AI — 通知/提案は UI 存在 · 実ユーザー連動なし

`ai-workspace.html` スターターチップ・提案 UI は動作するが **アカウント非連動**

---

## M-9 · pages.dev vs tasful.jp — 本番 host 定義不一致

| モジュール | pages.dev | tasful.jp |
|------------|-----------|-----------|
| `auth-current-user` | dev 扱い | production |
| `talk-runtime.isTalkProductionMode` | production 扱い | production |

**影響:** 同一ビルドで **モジュール間の fallback 方針が不一致**

---

## M-10 · `dashboard-data.js` — 本番 host で `global` 参照リスク

NB-1B で `globalThis` 修正済みと記載あるが、**main 上の状態要確認**（pages.dev smoke は PASS）

---

## M-11 · Webhook / RLS — 横断監査既知 WARNING

[`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md): 実 Stripe Webhook 未配線 · 検証 JWT expired · サーバー側認証未統合

---

# LOW

## L-1 · UX — 完了/注文ページのデモ fallback 明示

`shop-market-complete.js` `buildDemoOrder()` — 意図的デモ（RELEASE FROZEN）

## L-2 · UX — FAQ フッターが AI Workspace へ

`shop-store.html` — FAQ 専用ページではない

## L-3 · Builder — `mvp-talk.html` → `threads.html` ラベル不一致

リダイレクト先は `mvp-threads.html` で動作

## L-4 · 重複 config 読込 · console warn フィルタ

NB-1C smoke が Supabase 400 を除外 — 本番でも未ログイン API ノイズは残り得る

## L-5 · HSTS 未設定

[`nb1-host-production-readiness.md`](nb1-host-production-readiness.md) — apex 安定後に検討可

## L-6 · ドキュメント乖離

`auth-step5` · `auth-step6` · `talk-call-phase2` 等の **実装完了記載**と現ソースが不一致

---

# 確認項目 ×  severity マトリクス

| # | 確認項目 | 最悪 severity | 代表 ID |
|---|----------|---------------|---------|
| 1 | 404 | MEDIUM | M-5 |
| 2 | JS Error | HIGH | H-10（GenAI userId 空） |
| 3 | Console Error | LOW–MEDIUM | M-4 · L-4 |
| 4 | 権限漏れ | **CRITICAL** | C-1〜C-5 · C-9 · H-3 · H-6 · H-9 |
| 5 | 導線切れ | **CRITICAL–HIGH** | C-6 · H-4 · H-8 · H-11 |
| 6 | ボタン無反応 | **CRITICAL** | C-6（通話） |
| 7 | localStorage 依存 | **CRITICAL** | C-4 · C-5 · C-9 · H-7 · H-9 |
| 8 | pages.dev 限定挙動 | HIGH | H-1 · M-9 · NB-1C smoke シミュレーション |
| 9 | 本番化リスク | **CRITICAL** | C-8 · C-10 · H-2 · H-12 |
| 10 | UX 重大欠陥 | HIGH | H-8（市場タブ）· C-8（モック決済） |

---

# ドメイン別チェックリスト（調査結果）

## Auth（7 ロール）

| ロール | 状態 | 主な finding |
|--------|------|--------------|
| 未ログイン | ❌ | C-1 ガード無効 · ops 全開 C-2 |
| 一般会員 | ❌ | C-1 · H-1 JWT 未配線多数 |
| Connect 未完了 | ❌ | C-5 LS 偽装 |
| Connect 完了 | ❌ | C-5 UI≠DB |
| buyer | ❌ | C-9 · H-7 |
| seller | ❌ | C-9 · H-9 |
| ops | ❌ | C-2 · C-3 · H-2 |

## TALK

| 導線 | 状態 | ID |
|------|------|-----|
| 通知 | ⚠️ 一覧可 · 通話着信不可 | M-3 |
| チャット | ❌ chat-detail 身份 | H-3 |
| 通話 | ❌ 未配線 + mic 禁止 | C-6 · C-7 |
| カレンダー | ❌ デモのみ | H-4 |

## Builder

| 導線 | 状態 | ID |
|------|------|-----|
| 案件作成 | ❌ role 昇格 | C-4 |
| 応募 | ❌ 同上 | C-4 |
| やりとり | ❌ 同上 | C-4 |
| 完了報告 | ❌ 同上 | C-4 |
| レビュー | ❌ 同上 | C-4 |

## 市場

| 導線 | 404 | 導線/権限 |
|------|-----|-----------|
| 店舗一覧/詳細 | ✅ 存在 | ⚠️ auth なし |
| 商品一覧/詳細 | ✅ 存在 | ⚠️ H-8 ヘッダー |
| カート | ✅ | ⚠️ identity のみ cart |
| 注文完了 | ✅ | ❌ C-8 モック |

## Connect

| 項目 | 状態 | ID |
|------|------|-----|
| 本人確認 UI | ⚠️ 表示可 | C-5 |
| ステータス | ❌ LS/DB 分裂 | C-5 |
| 導線 | ❌ dashboard talkDev | H-11 |

## AI Workspace

| 項目 | 状態 | ID |
|------|------|-----|
| 通知 | ⚠️ UI のみ | M-8 |
| 提案 | ⚠️ スターター動作 | M-8 |
| 詳細/GenAI | ❌ 課金 identity | H-10 |

---

# 推奨解消順（調査結果 · 実装は別タスク）

| 優先 | 項目 | 解除する finding |
|------|------|------------------|
| P0 | `DEV_SKIP_AUTH = false` | C-1 |
| P0 | ops 5 ページに auth stack + commit `auth-ops-guard.js` | C-2 · H-2 |
| P0 | Builder `getRole()` → `TasuBuilderActorIdentity` + HTML 一括配線 | C-4 |
| P0 | Connect UI → `TasuConnectState` 一本化 | C-5 |
| P0 | NB-1D apex + Site URL + SITE_URL | C-10 |
| P1 | chat-detail auth + talk-call HTML 配線 + `_headers` mic | C-6 · C-7 · H-3 |
| P1 | market auth stack + notify 統合 + タブ導線修正 | C-9 · H-7 · H-8 |
| P1 | AI workspace auth + GenAI userId | H-10 |
| P2 | 実決済 Path B + shop_orders | C-8 |
| P2 | verify/smoke 拡張 | H-12 |

---

# 既存 RELEASE FROZEN との関係

[`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md) は **デモ導線 E2E PASS** を記録。本監査は **本番投入（実 host · 実権限 · 実決済）** 観点で **NOT_READY**。

| 観点 | 凍結監査 | P0-FINAL |
|------|----------|----------|
| デモ UX 導線 | PASS | 導線切れ HIGH 残存 |
| サーバー認証 | WARNING | **CRITICAL 多数** |
| pages.dev 静的 | N/A | NB-1C PASS |
| tasful.jp 本番 | FAIL | C-10 継続 |

---

**ステータス:** P0-FINAL-AUDIT 完了 — **NOT_READY**（**CRITICAL 10 · HIGH 12** — コード変更なし · 調査のみ）
