# P0-W5: 本番前残タスク — 総監査（Stripe 除外）

**作成日:** 2026-06-18  
**種別:** 監査のみ（**コード / UI / DB 変更なし**）  
**前提:** Stripe は [`stripe-ready-check.md`](stripe-ready-check.md) で **READY** — **本監査から Stripe 決済・Webhook・Live 切替は除外**  
**根拠:** 各 `*-release-status.md` · [`release-readiness-overview.md`](release-readiness-overview.md) · [`platform-phase-next-review.md`](platform-phase-next-review.md) · [`pre-production-cross-audit-remaining-issues.md`](pre-production-cross-audit-remaining-issues.md) · [`dev-rls-p0-drop-result.md`](dev-rls-p0-drop-result.md) · [`talk-call-final-release-review.md`](talk-call-final-release-review.md) · [`connect-production-gap.md`](connect-production-gap.md) · [`marketplace-payment-production-gap.md`](marketplace-payment-production-gap.md)

---

## エグゼクティブサマリ

| 観点 | 判定 |
|------|------|
| **限定公開（デモ / パイロット）** | **GO** — 7 領域 UX E2E 主要 PASS · RELEASE FROZEN |
| **フル本番（実データ・実通知・実受取）** | **NO-GO** — 永続化 · Connect 実 API · 市場実注文 · ホスト未稼働 |
| **製品 P0（凍結 6 領域の UI/導線）** | **なし** — 各 release-status で確定 |
| **インフラ / 配線 P0（Stripe 除く）** | **7 件 BLOCKER** |

---

## 確認① 本番阻害要因 — 一覧表

| ID | 領域 | 重要度 | 種別 | 内容 | 根拠 |
|----|------|--------|------|------|------|
| NB-1 | 共通 | **BLOCKER** | ホスト | **`https://tasful.jp` DNS / 静的ホスト未稼働** — 本番 origin 不在 | P0-W4 DNS 未登録 |
| NB-2 | Builder | **BLOCKER** | データ | **全 MVP 状態が localStorage** — マルチ端末・本番 DB なし | `platform-phase-next-review.md` B-1 |
| NB-3 | Builder | **BLOCKER** | 認証 | **デモロール切替 · 本番 JWT 未統合** | `builder-top.html` · 横断監査 |
| NB-4 | 市場 | **BLOCKER** | データ/導線 | **Path A checkout がモック**（`shop-market-checkout.js` → LS のみ） | `marketplace-payment-production-gap.md` |
| NB-5 | 市場 | **BLOCKER** | DB | **`shop_orders` テーブル REST 404 · 未デプロイ** | 同上 |
| NB-6 | Connect | **BLOCKER** | 配線 | **実 Stripe Connect onboarding なし**（AccountLink / `accounts.create` 未実装） | `connect-production-gap.md` |
| NB-7 | Connect | **BLOCKER** | 配線 | **Connect ingest が localStorage シミュレーションのみ** — サーバー Webhook 未統合 | `stripe-connect-ingest.js` |
| NH-1 | TALK | **HIGH** | 通話 | **Phase7.1 Push migration 未適用** · **`talk-call-push-notify` Edge 404** | `talk-call-final-release-review.md` |
| NH-2 | TALK | **HIGH** | 通話 | **TURN 未投入 · 厳格 NAT 未検証**（STUN のみ） | Phase5.5 WARNING |
| NH-3 | 安否 | **HIGH** | 通知 | **LINE 本番到達未完了**（Edge デプロイ · `ANPI_LINE_MOCK=0` · 本番チャネル） | `platform-phase-next-review.md` A-3/A-4 |
| NH-4 | 安否 | **HIGH** | 可用性 | **no-response サーバー timeout / cron 未構築**（クライアント polling のみ） | Phase2 設計 |
| NH-5 | 共通 | **HIGH** | 認証 | **本番 JWT / サーバー側ロール検証未統合**（デモ `userId` / `talkDev` 主体） | 横断監査 |
| NH-6 | 市場 | **HIGH** | データ | **出品 `publishSellerProduct()` → localStorage** · 本番 JWT CRUD 未接続 | M-5, M-6 |
| NH-7 | Connect | **HIGH** | 決済以外 | **Shop checkout Edge 未デプロイ確認** · Path B 入口 HTML 未配線 | `marketplace-payment-production-gap.md` |
| NH-8 | AI Workspace | **HIGH** | ホスト | **本番ホスト未稼働時は Workspace 配信不可**（製品自体は PASS） | NB-1 |
| NM-1 | TALK | **MEDIUM** | 通知 | official_builder ルームにカレンダー案内カードなし（notify 導線は PASS） | `talk-release-status.md` P2 |
| NM-2 | TALK | **MEDIUM** | 同期 | 通知・既読のマルチ端末 Supabase 同期未完了 | 改善項目 |
| NM-3 | 安否 | **MEDIUM** | E2E | LINE send/fallback **38/40** · dashboard PC クイック 1 件 WARNING | `anpi-release-status.md` |
| NM-4 | AI秘書 | **MEDIUM** | 連携 | TALK bus 未購読 · chat_started 未配線 · 市場 KPI sim | `ai-ops-secretary-release-status.md` P2 |
| NM-5 | Builder | **MEDIUM** | QA | 2-window bench ヘッドレス flaky · partner-assignment 辞退永続不安定 | P2 |
| NM-6 | 市場 | **MEDIUM** | セキュリティ | `users` safe view 未整備 · `review_scores` RLS 深度不足（FAIL 0） | marketplace-rls-final-lock |
| NM-7 | Connect | **MEDIUM** | UX | payout requirement stale 表示 · browser back returnTo | connect-final-audit P2 |
| NM-8 | 横断 | **MEDIUM** | 監査 | `review-tasful-final.mjs` WARNING 115 件（UX / CTA 系） | cross-audit |
| NL-1 | Builder | **LOW** | UX | 390px 完了/承認ボタン到達性 · CTA mobile 1 FAIL | P2-9, P2-13 |
| NL-2 | 市場 | **LOW** | UX | PC CTA 42px · 注文完了 PC 幅 760px 等 | market-ec P2 |
| NL-3 | TALK | **LOW** | UX | モバイル full-bleed · インライン composer saveMessage 未接続 | talk P2 |
| NL-4 | 安否 | **LOW** | UX | LINE バッジ文言統一 · TALK delivery headless timeout | anpi P2 |
| NL-5 | AI Workspace | **LOW** | 拡張 | 比較支援はデモ seed 依存 · 本番検索 API 統合は将来 | category-flow-audit |

**除外（Stripe READY 管轄 · 本監査対象外）:** Live Secret · Live Product/Price · Live Webhook · GenAI/Featured Live smoke · `SITE_URL` 投入タイミング · Stripe Dashboard 配線

**RLS dev ポリシー:** [`dev-rls-p0-drop-result.md`](dev-rls-p0-drop-result.md) 時点で P0 DROP **32 本完了** · `*_dev` **0 件** — **2026-06-17 以降 BLOCKER から降格**（JWT ローテ運用は NH-5）

---

## 確認② TALK

**総合: PASS**（RELEASE FROZEN スコープ · 通話フル本番は WARNING）

| 確認項目 | 判定 | 根拠 |
|----------|------|------|
| 通知 → 詳細 | **PASS** | 9 種 × 390/1280 · `review-talk-user-flow.mjs` FAIL 0 |
| 通知 → スレッド | **PASS** | board-thread · chat-detail · partner-assignment 遷移 PASS |
| カレンダー追加 | **PASS** | `builder-ops-route-001` → `partner-assignment.html` · `test-talk-builder-calendar-return.mjs` |
| 通話導線（foreground） | **PASS** | Phase1〜4 E2E · 通知センター着信 · 履歴 UI |
| 通話導線（背景 Push） | **FAIL** | Phase7.1 migration 未適用 · Edge 404 · 実機未確認 |
| Connect あり取引 | **PASS** | `platform-chat-connect-*` · 6 CASE business OK（デモ決済層） |
| Connect なし取引 | **PASS** | 通常チャット · 手数料ゲート UX |
| 購入後導線 | **PASS** | seller confirm · 完了カード · payment-settings 連携（sim 層） |

### 未完一覧

| 項目 | 重要度 |
|------|--------|
| 背景 Web Push 着信（Phase7.1 deploy + migration + VAPID 運用） | HIGH |
| TURN 投入 · relay 検証 | HIGH |
| official_builder カレンダー案内カードなし | MEDIUM |
| マルチ端末既読/通知同期 | MEDIUM |
| 実機 Push E2E（Chrome/Android/iPhone） | HIGH |

---

## 確認③ Builder

**総合: PASS**（UX / 全ロール E2E）· **フル本番データ: FAIL**

| ロール | 応募 | 採用 | メッセージ | 完了報告 | 承認 | レビュー |
|--------|------|------|------------|----------|------|----------|
| **user** | PASS | PASS | PASS | PASS | PASS | PASS |
| **partner** | PASS | PASS | PASS | PASS | PASS | PASS |
| **vendor** | PASS | PASS | PASS | PASS | PASS | PASS |

**根拠:** `review-builder-user-flow.mjs` **44/0/0** · `verify-builder-general-flow-bench.mjs` **45/45**（partner_user / user_user / vendor_user）

| 観点 | 判定 |
|------|------|
| 掲示板 / board / ops 通知 | PASS |
| カレンダー / partner-assignment | PASS |
| 運営 admin（申請・派遣・レビュー） | PASS |
| Supabase 永続化 | **FAIL** — DDL 未実行 · localStorage のみ |
| 本番認証 | **FAIL** — デモロール |

---

## 確認④ 市場

**総合: PASS**（RELEASE FROZEN UI 導線）· **実注文 / 永続化: FAIL**

| 確認項目 | 判定 | 根拠 |
|----------|------|------|
| TOP | **PASS** | `shop-store.html` · market-ec FROZEN |
| 検索 | **PASS** | SP CTA 44px+ |
| 店舗 | **PASS** | 店舗導線監査 PASS |
| 商品 | **PASS** | 詳細 · 購入 CTA PASS |
| カート | **PASS** | LS カート UX PASS |
| 注文確認 | **PASS** | `shop-market-checkout.html` UI PASS |
| 注文完了 | **PASS** | CTA source 別導線 PASS |

**導線（一覧 → 店舗 → 商品 → カート → 注文）:** **PASS**（Path A · デモ）

| 観点 | 判定 |
|------|------|
| 実 Stripe / Supabase 注文 | **FAIL** — Path A モック · `shop_orders` 404 |
| Path B（`checkout.html` + Connect）入口 | **FAIL** — HTML 未 include · 未配線 |
| 出品 Supabase 永続化 | **FAIL** |

---

## 確認⑤ Connect

**総合: PASS**（UX RELEASE FROZEN）· **実 Connect / 受取: FAIL**

| 確認項目 | 判定 | 根拠 |
|----------|------|------|
| 本人確認導線 | **PASS** | identity → qualification · 36 PASS |
| Connect 必須フロー | **PASS** | ダッシュボードバナー · disclaimer · 売上受取 CTA |
| Connect 任意フロー | **PASS** | 未 Connect でも閲覧系は動作 |
| 売上受取導線 | **PASS**（UX）/ **FAIL**（実 API） | payment-settings ステップマシン PASS · **AccountLink なし** |

| 観点 | 判定 |
|------|------|
| onboarding localStorage | PASS（デモ） |
| 実 `accounts.create` / hosted onboarding | **FAIL** |
| Connect イベントサーバー ingest | **FAIL** |
| TALK 取引手数料 5% 自動決済 | **FAIL** — confirm/Webhook 未配線 |
| 運営 trouble ハードニング | **PASS** — 13/13 |

---

## 確認⑥ AI秘書

**総合: PASS**（RELEASE FROZEN）

| 確認項目 | 判定 | 根拠 |
|----------|------|------|
| ダッシュボード | **PASS** | `test-admin-operations-dashboard-browser.mjs` 43/43 |
| 優先度判定 | **PASS** | Daily Inbox · morning summary |
| 行動提案 | **PASS** | action board · automation engine |
| Connect 警告 | **PASS** | `#ops-ai-connect` · support `?filter=connect` |
| 運営通知 | **PASS** | Ops Watch · Support · 接続 P0/P1/P2 PASS |

| 観点 | 判定 |
|------|------|
| 本番接続レビュー | PASS（要修正 0） |
| 実 Stripe / 実 TALK bus KPI | **MEDIUM** — sim データ依存 |

---

## 確認⑦ 安否

**総合: PASS**（RELEASE FROZEN）· **LINE 本番 / サーバー timeout: WARNING**

| 確認項目 | 判定 | 根拠 |
|----------|------|------|
| 通知 | **PASS** | 26/26 · TALK 連携 |
| 未応答 | **PASS**（Phase2 UX）/ **WARNING**（サーバー） | Phase2 LOCK · polling のみ |
| 緊急連絡先 | **PASS** | identity / relationship / RLS browser 34/34 |
| エスカレーション | **PASS** | 3 CTA · WebRTC 橋渡し · `official_anpi` |

| 観点 | 判定 |
|------|------|
| Phase2 DB | PASS — 適用済 |
| prod RLS verify（fresh JWT） | PASS — 17/17 |
| LINE 本番配信 | **FAIL** — mock モード · Edge/Secrets 運用待ち |
| サーバー側 timeout cron | **FAIL** — 未構築 |

---

## AI Workspace（優先対象 · 確認① 補足）

| 確認項目 | 判定 | 根拠 |
|----------|------|------|
| 比較支援 4 カテゴリ | **PASS** | 29 OK / 0 NG |
| 問い合わせ → TALK 下書き | **PASS** | `ai-workspace-inquiry-to-talk.md` |
| 音声 / 声設定 Phase1 | **PASS** | implementation レポート |
| 本番ホスト配信 | **FAIL** | NB-1 |
| サブスク権限（GenAI プラン） | Stripe 管轄 · **除外** |

---

# RELEASE BLOCKER

（Stripe 決済・Webhook・Live 切替 **除外**）

| ID | 領域 | 内容 |
|----|------|------|
| **NB-1** | 共通 | 本番静的ホスト `https://tasful.jp` 未稼働 |
| **NB-2** | Builder | MVP 全状態 localStorage · Supabase DDL 未実行 |
| **NB-3** | Builder | 本番認証 / JWT 未統合（デモロール） |
| **NB-4** | 市場 | 市場 checkout Path A がモック（実注文不可） |
| **NB-5** | 市場 | `shop_orders` 未デプロイ |
| **NB-6** | Connect | 実 Stripe Connect onboarding API 未実装 |
| **NB-7** | Connect | Connect ingest サーバー経路なし（LS sim のみ） |

---

# HIGH

| ID | 領域 | 内容 |
|----|------|------|
| **NH-1** | TALK | Push Phase7.1 migration + `talk-call-push-notify` deploy |
| **NH-2** | TALK | TURN 未設定 · 厳格 NAT |
| **NH-3** | 安否 | LINE 本番（Edge + Secrets + mock 無効化） |
| **NH-4** | 安否 | no-response サーバー timeout / cron |
| **NH-5** | 共通 | 本番 JWT / サーバー側ロール検証 |
| **NH-6** | 市場 | 出品 Supabase 永続化 · オーナー JWT CRUD |
| **NH-7** | Connect | Shop checkout Functions デプロイ · Path B 入口配線 |
| **NH-8** | AI Workspace | 本番ホスト依存（NB-1 と同一根） |

---

# MEDIUM

| ID | 領域 | 内容 |
|----|------|------|
| **NM-1** | TALK | official_builder カレンダー案内カード |
| **NM-2** | TALK | 通知/既読マルチ端末同期 |
| **NM-3** | 安否 | LINE E2E WARNING · dashboard 1 件 |
| **NM-4** | AI秘書 | TALK bus / 市場 KPI 実データ未配線 |
| **NM-5** | Builder | 2-window bench flaky · 辞退永続 |
| **NM-6** | 市場 | users safe view · review_scores RLS |
| **NM-7** | Connect | payout stale UX · returnTo P2 |
| **NM-8** | 横断 | tasful-final UX WARNING 115 |

---

# LOW

| ID | 領域 | 内容 |
|----|------|------|
| **NL-1** | Builder | 390px ボタン · mobile CTA |
| **NL-2** | 市場 | PC CTA 42px · レイアウト P2 |
| **NL-3** | TALK | full-bleed · inline composer |
| **NL-4** | 安否 | バッジ文言 · headless timeout |
| **NL-5** | AI Workspace | デモ seed 依存 · 将来 API 統合 |

---

# 本番投入可能判定

## **WARNING**

| シナリオ | 判定 | 理由 |
|----------|------|------|
| **限定公開 / デモ / パイロット** | **GO** | 7 領域 RELEASE FROZEN · 主要 E2E PASS · 製品 P0 なし |
| **フル本番（実データ・実 LINE・実受取・実注文）** | **NO-GO** | BLOCKER 7 件（NB-1〜7）未解消 |
| **Stripe 承認後の収益化（GenAI/Featured）** | **別管轄 READY** | 本監査対象外 · NB-1 ホストは共通前提 |

### 判定理由

- **GO と言える範囲:** 凍結済み UX 導線（TALK 通知/スレッド/カレンダー · Builder 全ロール · 市場 UI · Connect UX · AI秘書 · 安否 Phase2 · AI Workspace 比較）は監査 **PASS**。
- **NO-GO となる範囲:** Builder/市場/Connect の **永続化と実 API**、**本番ホスト**、**背景通話 Push**、**LINE 本番** が未完了。
- **Stripe READY との関係:** GenAI/Featured の Live 切替は READY だが、**NB-1（tasful.jp）** が未解消の間は Checkout 戻り先含め本番 smoke 不可。

### フル本番 GO への最短ゲート（Stripe 除く · 推奨順）

1. **NB-1** — `tasful.jp` 静的ホスト + HTTPS  
2. **NB-5 + NH-7** — `shop_orders` + Shop checkout Edge（市場実注文の前提）  
3. **NB-6 + NB-7** — Connect onboarding + サーバー ingest  
4. **NB-2 + NB-3** — Builder Supabase + 本番 Auth  
5. **NH-3 + NH-4** — 安否 LINE 本番 + timeout cron  
6. **NH-1 + NH-2** — TALK 背景 Push + TURN（通話フル本番）

---

## 領域別 PASS/FAIL 早見

| 領域 | UX（FROZEN） | フル本番 |
|------|-------------|----------|
| TALK | **PASS** | **WARNING**（Push/TURN） |
| Builder | **PASS** | **FAIL**（DB/Auth） |
| 市場 | **PASS** | **FAIL**（mock checkout） |
| Connect | **PASS** | **FAIL**（実 API） |
| AI Workspace | **PASS** | **WARNING**（ホスト） |
| AI秘書 | **PASS** | **PASS**（sim KPI のみ MEDIUM） |
| 安否 | **PASS** | **WARNING**（LINE/timeout） |

---

**監査実施:** 既存レポート横断 · リポジトリ静的調査 · **コード / UI / DB 変更 0 件**
