# NB-1 + Auth 本番 Smoke — 実施 Runbook

**作成日:** 2026-06-18  
**種別:** Runbook のみ（**本 Runbook 作成時点では未実施**）  
**目的:** AUTH-RB-2（`tasful.jp` 実機 Auth smoke）を実施可能にする  
**前提 DB:** `https://ddojquacsyqesrjhcvmn.supabase.co`  
**本番 Origin（確定）:** `https://tasful.jp`  
**除外:** Stripe Live · 本番決済 · Connect 本番 onboarding · 市場 checkout 本格実装

**関連:** [`auth-step10-exec-apply.md`](auth-step10-exec-apply.md)（AUTH-H-1 適用済）· [`auth-step10-exec-prep.md`](auth-step10-exec-prep.md)

---

## 実施前チェック（Runbook 利用者向け）

| 項目 | 必須 |
|------|------|
| `tasful.jp` がブラウザ/curl で到達可能 | ✅ Phase A PASS 後のみ Phase B 以降 |
| 本番ビルドに auth スタック配信済み | `auth-current-user.js` · `auth-ops-guard.js` · `connect-state.js` · `market-identity.js` · `builder-actor-identity.js` |
| `chat-supabase-config.js` 本番 URL/anon key | リポジトリに秘密を commit しない |
| Supabase `SITE_URL=https://tasful.jp` | Phase A で確認 |
| テスト用 Auth ユーザー 9 ロール分 | 下記「テストユーザー準備」 |
| 記録用ディレクトリ | `reports/screenshots/auth-production-smoke/` |

### テストユーザー準備（実施前に Ops が作成）

| ID | 用途 | `app_metadata` 目安 |
|----|------|---------------------|
| `prod_smoke_guest` | 未ログイン比較用 | —（未ログイン） |
| `prod_smoke_member_a` | 一般会員 A | `talk_user_id`, `member_id` |
| `prod_smoke_member_b` | 一般会員 B | 同上 |
| `prod_smoke_ops` | ops | `is_ops: true` または `role: tasu_admin` |
| `prod_smoke_connect_pending` | Connect 未完了 | DB payout 未 ready |
| `prod_smoke_connect_ready` | Connect 完了 | DB payout active |
| `prod_smoke_builder_owner` | Builder 当事者 | DB 上の案件 owner |
| `prod_smoke_builder_stranger` | Builder 非当事者 | 無関係 |
| `prod_smoke_seller` | 市場 seller | 自 `listings` あり |
| `prod_smoke_buyer` | 市場 buyer | 他者公開品閲覧のみ |

**代替（暫定）:** ステージング検証ユーザー `talk-rls-a@tasful-dev.test` 等を本番 Auth に複製する場合は、本番 smoke 結果に **暫定** と明記する。

---

# 実施手順

## 全体フロー

```
[0] 本 Runbook 精読 · テストユーザー準備
[1] Phase A — tasful.jp ホスト確認          → A が FAIL なら中断
[2] Phase B — Auth Smoke 9 シナリオ（手動+スクショ）
[3] Phase C — 認証境界（本番 host · URL/LS 昇格拒否）
[4] Phase D — RLS Smoke（REST + UI 補助）
[5] 自動 probe 再実行（G-1〜G-7 補強）
[6] Phase E — GO / NO-GO 判定
[7] 成果物: auth-production-smoke-results.md（実施後に作成）
```

## 推奨コマンド（実施日）

```bash
# Phase A
curl -sI https://tasful.jp/
curl -sI https://www.tasful.jp/
dig +short tasful.jp A
dig +short tasful.jp AAAA

# 自動 probe（本番 .env / linked DB）
node scripts/verify-auth-step8b-legacy-rls.mjs
node scripts/verify-auth-step10-review-scores.mjs
node scripts/verify-auth-step8-rls-inventory.mjs

# ローカル回帰（本番 host シミュレーション）
node scripts/test-auth-step7-fallback-lockdown.mjs
node scripts/test-auth-ops-guard.mjs
node scripts/test-connect-state.mjs
node scripts/test-market-identity.mjs
node scripts/test-builder-actor-identity.mjs

# 本番ブラウザ smoke（NB-1 後 · 実施時にスクリプト化推奨）
# PROD_BASE=https://tasful.jp node scripts/test-auth-production-smoke.mjs
```

**実施記録:** `reports/auth-production-smoke-results.json`（実施後作成）

---

# Phase A — tasful.jp ホスト確認

| # | 確認項目 | 実施方法 | PASS 条件 | FAIL 条件 |
|---|----------|----------|-----------|-----------|
| A-1 | **DNS** | `dig +short tasful.jp A` / `AAAA` | 有効な A または AAAA が返る | NXDOMAIN · 空 · 誤 IP |
| A-2 | **HTTPS** | `curl -sI https://tasful.jp/` | `HTTP/2 200` または `301→200` · 証明書有効 | TLS エラー · 接続拒否 · 証明書不一致 |
| A-3 | **www → non-www** | `curl -sI https://www.tasful.jp/` | apex `https://tasful.jp` へ **301/308**（方針に従う） | 別サイト · 200 で重複コンテンツ · ループ |
| A-4 | **SITE_URL** | Supabase Dashboard → Auth → URL Configuration | `https://tasful.jp`（末尾スラッシュなし推奨） | 未設定 · localhost · ステージング URL のまま |
| A-5 | **静的配信** | ブラウザで代表 URL を開く | 下表すべて **200** · JS/CSS 404 なし | 主要アセット 404 · 白画面 |
| A-6 | **キャッシュ** | デプロイ直後にハードリロード / `Cache-Control` 確認 | auth スタック最新が配信（`auth-current-user.js` に STEP7 ロジック） | 旧ビルド固定 · CDN が古い JS を返す |

### A-5 代表 URL（静的配信）

| URL | 用途 |
|-----|------|
| `https://tasful.jp/` | 市場トップ |
| `https://tasful.jp/talk-home.html` | TALK |
| `https://tasful.jp/chat-detail.html` | 取引チャット |
| `https://tasful.jp/payment-settings.html` | Connect |
| `https://tasful.jp/admin-operations-dashboard.html` | ops |
| `https://tasful.jp/builder/index.html` | Builder |
| `https://tasful.jp/auth-current-user.js` | Auth helper |

### Phase A 判定

| 判定 | 条件 |
|------|------|
| **PASS** | A-1〜A-6 すべて PASS |
| **FAIL** | いずれか FAIL → **Phase B 以降実施禁止** |

**記録:** `reports/screenshots/auth-production-smoke/phase-a-host/`  
- `a1-dns.txt` · `a2-https-headers.txt` · `a3-www-redirect.txt` · `a5-index.png` · `a5-talk-home.png`

---

# Phase B — Auth Smoke 9 シナリオ

**共通ルール**

- Origin は **`https://tasful.jp` のみ**（`talkDev=1` 付与禁止）
- 各シナリオでスクリーンショット **390px** 最低 1 枚（ops は **1280** 推奨 1 枚）
- DevTools Console に `canUseLocalStorageFallback` / `getCurrentUser` を記録（可能なら）

**スクリーンショット根:** `reports/screenshots/auth-production-smoke/`

---

## B-1 未ログイン

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/` · `https://tasful.jp/detail-skill.html?id=<公開listing>` · `https://tasful.jp/chat-detail.html?thread=<id>` |
| **前提** | ログアウト · Cookie クリア |
| **操作** | ① トップ閲覧 ② 公開商品詳細 ③ `?userId=u_me` を付与して再読込 ④ chat-detail 直打ち |
| **期待結果** | 公開 listing 閲覧可 · 信頼スコア `public_review_scores` 経由で表示 or 「新規ユーザー」 · URL `userId` **無視** · チャット本文読込不可 or ログイン誘導 · ops 画面不可 |
| **失敗条件** | LS/URL で別ユーザーとして動作 · 他人チャット閲覧可 · ops 画面表示 · draft 露出 |
| **スクショ** | `b1-guest/index-390.png` · `b1-guest/detail-trust-390.png` · `b1-guest/chat-detail-denied-390.png` · `b1-guest/url-userId-ignored-390.png` |

---

## B-2 一般会員

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/talk-home.html?tab=notify` · `https://tasful.jp/chat-detail.html?thread=<Aのroom>` |
| **前提** | `prod_smoke_member_a` で Supabase Auth ログイン |
| **操作** | ① 通知一覧 ② 自分が当事者の room ③ member B の room ID を直打ち |
| **期待結果** | 自分の通知のみ · 当事者 room READ/送信可 · B の room **不可**（空/エラー） |
| **失敗条件** | B の通知表示 · B の room メッセージ表示 · `getCurrentUser()` が URL と不一致 |
| **スクショ** | `b2-member/notify-own-390.png` · `b2-member/chat-own-390.png` · `b2-member/chat-stranger-empty-390.png` |

---

## B-3 ops

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/admin-operations-dashboard.html` |
| **前提** | `prod_smoke_ops`（`is_ops` / `tasu_admin`）でログイン |
| **操作** | ① 司令塔表示 ② ログアウト → `prod_smoke_member_a` で同 URL ③ `?talkAdmin=1` のみ（未ログイン / 一般会員） |
| **期待結果** | ops JWT で表示可 · 一般会員は **拒否/空** · URL だけでは昇格不可 |
| **失敗条件** | 一般会員で ops データ表示 · `talkAdmin=1` で昇格 |
| **スクショ** | `b3-ops/dashboard-1280.png` · `b3-ops/member-denied-390.png` · `b3-ops/url-talkAdmin-no-escalation-390.png` |

---

## B-4 Connect 未完了

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/payment-settings.html` |
| **前提** | `prod_smoke_connect_pending` · DB payout **未** ready |
| **操作** | ① 画面表示 ② DevTools で LS に `tasful_demo_connect_seller_status_v1=ready` 書込 → リロード |
| **期待結果** | step ≠ `ready` · payout CTA 非表示 or ガード · LS 偽装 **無効** |
| **失敗条件** | LS だけで ready 表示 · 売上受取 CTA が出る |
| **スクショ** | `b4-connect-pending/payment-settings-390.png` · `b4-connect-pending/ls-ready-blocked-390.png` |

---

## B-5 Connect 完了

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/payment-settings.html` |
| **前提** | `prod_smoke_connect_ready` · DB payout active |
| **操作** | 画面表示 · sales-fees 導線（触るのみ · 実 Stripe は対象外） |
| **期待結果** | `ready` 表示 · Connect 完了 UI · DB と一致 |
| **失敗条件** | DB ready なのに未完了表示 · 未完了ユーザーが ready |
| **スクショ** | `b5-connect-ready/payment-settings-390.png` |

---

## B-6 Builder 当事者

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/builder/board-project-detail.html?id=<owner案件>&view=applications` |
| **前提** | `prod_smoke_builder_owner` ログイン · 案件は DB/デモで owner 紐付け |
| **操作** | 応募一覧 · 採用/完了 CTA の到達（操作は最小） |
| **期待結果** | `builder-actor-identity` が JWT+DB で owner 解決 · 操作可 |
| **失敗条件** | URL `role=owner` 単独で操作可 · 他人案件で操作可 |
| **スクショ** | `b6-builder-owner/applications-390.png` |

---

## B-7 Builder 非当事者

| 項目 | 内容 |
|------|------|
| **URL** | B-6 と同じ owner URL |
| **前提** | `prod_smoke_builder_stranger` ログイン |
| **操作** | owner URL 直打ち · 操作ボタンクリック試行 |
| **期待結果** | 操作不可 · 空状態 / エラー / read only |
| **失敗条件** | 採用・応募一覧の編集可 |
| **スクショ** | `b7-builder-stranger/denied-390.png` |

---

## B-8 市場 buyer

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/index.html` · `https://tasful.jp/detail-product.html?id=<公開UUID>` |
| **前提** | `prod_smoke_buyer` ログイン |
| **操作** | 公開品閲覧 · seller B の **draft** listing ID を REST/UI で参照試行 |
| **期待結果** | 公開品可 · draft 不可 · `payment_url` 非表示（safe view） |
| **失敗条件** | draft 閲覧可 · 他人名義で出品 UPDATE 可 |
| **スクショ** | `b8-market-buyer/listing-public-390.png` · `b8-market-buyer/draft-denied-390.png` |

---

## B-9 市場 seller

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/my-listings.html` または seller ダッシュボード |
| **前提** | `prod_smoke_seller` ログイン · 自出品あり |
| **操作** | 自出品編集 · B の listing を UPDATE 試行（UI または REST） |
| **期待結果** | 自出品 CRUD 可 · 他人 UPDATE **拒否** |
| **失敗条件** | 他人 draft/public の base `listings` 更新可 |
| **スクショ** | `b9-market-seller/own-listing-390.png` · `b9-market-seller/other-update-fail.png` |

---

# Phase C — 認証境界確認（本番 host）

**実施:** シークレットウィンドウ · `https://tasful.jp` · 各項目を **未ログイン** および **一般会員ログイン** で試行

| # | 昇格手段 | 試行 URL / 操作例 | 期待（いずれか） | FAIL |
|---|----------|-------------------|------------------|------|
| C-1 | `?talkAdmin=1` | `/admin-operations-dashboard.html?talkAdmin=1` | login required / 拒否表示 | ops 画面フル表示 |
| C-2 | `?anpi_admin=1` | `/anpi-dashboard.html?anpi_admin=1` | read only / 一般 UI | 安否 admin 全件操作 |
| C-3 | `?talkDev=1` | `/talk-home.html?talkDev=1` | **無効**（本番 host） | デモモード有効 |
| C-4 | URL `role` | `/builder/...?role=owner` | onboarding required / 拒否 | 非当事者操作可 |
| C-5 | URL `sellerId` | 市場 URL に他人 sellerId | 無視 / 本人のみ | 他人として売却操作 |
| C-6 | URL `buyerId` | checkout 系に他人 buyerId | 無視 / JWT のみ | 他人購入者として完了 |
| C-7 | LS `role` | `localStorage` builder role 書込 | 無効 | UI 権限変化 |
| C-8 | LS `admin` | ops 系 LS フラグ | 無効 | 司令塔表示 |
| C-9 | LS connect ready | `tasful_demo_connect_seller_status_v1` | 無効 | ready 表示 |
| C-10 | `u_me` 固定 | `?userId=u_me` · config `currentUserId` 依存なし | 無視 / null user | u_me として動作 |

**記録:** `reports/screenshots/auth-production-smoke/phase-c-boundary/`  
**判定:** 10 項目中 **0 FAIL** で Phase C PASS

---

# Phase D — RLS Smoke

| # | 確認 | 実施 | PASS |
|---|------|------|------|
| D-1 | 自分の通知のみ | JWT A → `talk_notifications` または UI 通知タブ | B の通知 0 件 |
| D-2 | 自分の注文のみ | `shop_orders` 未デプロイ時は **SKIP 明記** · 代替 LS 注文は本番非対象 | 他人注文不可 |
| D-3 | 自分の Builder 案件のみ | owner URL / stranger 比較（B-6/B-7） | 非当事者拒否 |
| D-4 | Connect 状態他人参照不可 | A の Connect DB を B の JWT では ready にならない | DB 分離 |
| D-5 | ops のみ ops 画面 | member → admin dashboard 拒否（B-3） | ops のみ可 |

**自動補強（実施日）**

```bash
node scripts/verify-auth-step8b-legacy-rls.mjs
node scripts/verify-talk-rls-staging.mjs
node scripts/verify-marketplace-rls.mjs
```

---

# Smokeチェックリスト

実施時にコピーして使用:

```
Phase A ホスト
[ ] A-1 DNS
[ ] A-2 HTTPS
[ ] A-3 www redirect
[ ] A-4 SITE_URL
[ ] A-5 静的配信（7 URL）
[ ] A-6 キャッシュ / 最新 auth JS

Phase B 9 シナリオ
[ ] B-1 未ログイン
[ ] B-2 一般会員
[ ] B-3 ops
[ ] B-4 Connect 未完了
[ ] B-5 Connect 完了
[ ] B-6 Builder 当事者
[ ] B-7 Builder 非当事者
[ ] B-8 市場 buyer
[ ] B-9 市場 seller

Phase C 境界（10 項）
[ ] C-1 〜 C-10

Phase D RLS（5 項）
[ ] D-1 〜 D-5（D-2 は shop_orders 状況に応じ SKIP 可）

自動 probe
[ ] verify-auth-step8b-legacy-rls.mjs
[ ] verify-auth-step10-review-scores.mjs
[ ] test-auth-step7-fallback-lockdown.mjs
[ ] test-auth-ops-guard.mjs
[ ] test-connect-state.mjs
[ ] test-market-identity.mjs
[ ] test-builder-actor-identity.mjs
```

---

# スクリーンショット一覧

```
reports/screenshots/auth-production-smoke/
├── phase-a-host/
│   ├── a5-index.png
│   └── a5-talk-home.png
├── b1-guest/
├── b2-member/
├── b3-ops/
├── b4-connect-pending/
├── b5-connect-ready/
├── b6-builder-owner/
├── b7-builder-stranger/
├── b8-market-buyer/
├── b9-market-seller/
└── phase-c-boundary/
```

**実施後:** `reports/auth-production-smoke-results.json` に各ファイルパスと PASS/FAIL を記録。

---

# GO条件（Phase E）

| ID | 条件 | 検証方法 | 現状（Runbook 作成時） |
|----|------|----------|------------------------|
| **G-1** | legacy RLS PASS | `verify-auth-step8b-legacy-rls.mjs` | ✅ 適用済（再実行で確認） |
| **G-2** | review_scores PASS | `verify-auth-step10-review-scores.mjs` | ✅ AUTH-H-1 適用済 |
| **G-3** | fallback 拒否 PASS | `test-auth-step7-fallback-lockdown.mjs` + Phase C | ⬜ tasful.jp 実機待ち |
| **G-4** | ops guard PASS | `test-auth-ops-guard.mjs` + B-3 | ⬜ 実機待ち |
| **G-5** | Connect state PASS | `test-connect-state.mjs` + B-4/B-5 | ⬜ 実機待ち |
| **G-6** | 市場 buyer/seller PASS | `test-market-identity.mjs` + B-8/B-9 | ⬜ 実機待ち |
| **G-7** | Builder actor PASS | `test-builder-actor-identity.mjs` + B-6/B-7 | ⬜ 実機待ち |
| **G-8** | 9 シナリオ smoke PASS | Phase B 全項目 | ⬜ **NB-1 待ち** |
| **G-9** | anon READ 0 | legacy probe + inventory | ✅ DB 側確認済 |
| **G-10** | authenticated 他人アクセス不可 | legacy A/B probe | ✅ DB 側確認済 |

### Auth 本番 GO 判定

**GO:** G-1〜G-10 **すべて PASS** · Phase A **PASS** · Phase C **0 FAIL**

**WARNING:** G-8 のみ手動確認 · D-2 SKIP（`shop_orders` 未デプロイ）· 軽微 UI 差異

**NO-GO:** Phase A FAIL · Phase C 任意 1 件以上 FAIL · fallback 漏洩 · anon READ > 0 · 他人データ閲覧可

---

# NO-GO条件（即中断）

| 条件 | 対応 |
|------|------|
| `tasful.jp` 未到達 / TLS 不正 | NB-1 インフラ修正後に再実施 |
| `?talkDev=1` が本番で有効 | デプロイ rollback · hotfix |
| `?talkAdmin=1` / LS で ops 昇格 | **P0 hotfix** · `auth-ops-guard.js` |
| legacy anon READ > 0 | RLS 調査 · `auth-step10-rollback.sql` 検討 |
| authenticated 他人 room/通知閲覧 | RLS + JWT 調査 |

**今回の Runbook スコープ外（NO-GO にしない）:** Stripe Live 未接続 · Connect 実 onboarding · 市場 checkout 本番 · Builder LS 永続化（NB-2）

---

# 実行所要時間

| フェーズ | 見積 | 担当 |
|----------|------|------|
| 事前準備（ユーザー・記録） | 1〜2 h | Ops + QA |
| Phase A | 30〜45 min | Ops |
| Phase B（9 シナリオ + スクショ） | 2〜3 h | QA |
| Phase C | 45〜60 min | QA |
| Phase D + 自動 probe | 30〜45 min | Eng |
| 判定・レポート | 30 min | Eng |
| **合計** | **約 5〜7 h** | |

---

# Runbook ステータス

| 項目 | 状態 |
|------|------|
| Runbook 作成 | ✅ 本ファイル |
| NB-1 ホスト稼働 | ⬜ **未確認**（実施時に Phase A で判定） |
| Auth smoke 実施 | ⬜ **未実施** |
| Auth 本番 GO | ⬜ Phase A〜E 完了後 |

**`tasful.jp` が到達可能になったら、本 Runbook に従って実施し、結果を `reports/auth-production-smoke-results.md` に記録する。**

---

## 参照

| ファイル | 用途 |
|----------|------|
| [`auth-step10-exec-apply.md`](auth-step10-exec-apply.md) | AUTH-H-1 適用済 |
| [`auth-step10-production-go.md`](auth-step10-production-go.md) | GO 計画 |
| [`release-blocker-roadmap.md`](release-blocker-roadmap.md) | NB-1 解消方法 |
| `scripts/verify-auth-step10-review-scores.mjs` | G-2 probe |
| `scripts/verify-auth-step8b-legacy-rls.mjs` | G-1 / G-9 / G-10 |
