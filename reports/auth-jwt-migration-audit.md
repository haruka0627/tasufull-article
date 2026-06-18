# P1-A1: Auth / JWT 移行監査

**作成日:** 2026-06-18  
**種別:** 監査のみ（**コード / UI / DB / Secrets / 認証実装 変更なし**）  
**目的:** NB-3 実装前に localStorage / demo user / role / 疑似認証依存を全洗い出し  
**根拠:** リポジトリ静的解析 · `scripts/audit-localstorage-usage.mjs`（1434 ファイル · **185 キー**）· 各 `*-release-status.md` · RLS SQL

**関連:** [`release-blocker-roadmap.md`](release-blocker-roadmap.md) STEP 3（NB-3）· [`prelaunch-blockers-review.md`](prelaunch-blockers-review.md)

---

## エグゼクティブサマリ

| 観点 | 判定 |
|------|------|
| **JWT 基盤コード** | 部分実装済（`talk-runtime.js` · `member-auth.js` · RLS SQL） |
| **本番 identity 解決** | **未完了** — dev 時は URL/`u_me`/LS で全通過 |
| **localStorage 永続データ** | **185 キー** · 本番移行対象 **多数** |
| **role 偽装リスク** | **HIGH** — Builder role LS · Connect state LS · `?talkDev=1` |

---

## 確認① localStorage / sessionStorage 使用箇所

### スキャンサマリ（`audit-localstorage-usage.mjs`）

| 指標 | 値 |
|------|-----|
| スキャン対象ファイル | 1434 |
| **ユニーク localStorage キー** | **185** |
| Supabase 移行 **high** 優先 | 20 |
| カテゴリ内訳 | talk 23 · builder 18 · anpi 18 · other 77 · genai 9 · chat 5 · … |

**sessionStorage:** 主に **UI 状態**（戻り URL · 監査 boot · AI チャット履歴 · OAuth state）— 本番残存 **可**（JWT 化対象外が多い）

### 判定（確認①）

| 観点 | 判定 |
|------|------|
| デモ / E2E としての LS 利用 | **PASS**（意図的） |
| 本番データが LS 主体 | **FAIL** |
| 移行棚卸しの完全性 | **PASS**（185 キー機械抽出済） |

---

### 領域別 — 主要キー一覧（本番移行対象）

#### 共通 / 認証（member）

| キー | 代表ファイル | 用途 | 本番残せるか | JWT化 |
|------|-------------|------|-------------|-------|
| `tasu_member_session` | `member-auth.js` · `profile-settings.js` · `my-listings.js` | 会員セッション（Supabase Auth 連携 **hybrid**） | ⚠️ キャッシュのみ | **JWT 主体** · LS は表示用 |
| `tasu-supabase-auth` / `sb-*-auth-token` | `talk-runtime.js` | Supabase SDK セッション | ✅ SDK 管理 | **sub + custom claims** |
| `tasful_last_profile` | `member-auth.js` · `login.js` | 表示用プロフィールキャッシュ | ✅ | 任意 |
| `tasu_member_signups` | signup 系 | サインアップ草稿 | ❌ | DB `profiles` |
| `tasu_member_role` | 少数 | デモロール | ❌ | claim `role` |

#### TALK

| キー | 代表ファイル | 用途 | 本番残せるか | JWT化 |
|------|-------------|------|-------------|-------|
| `tasful_talk_notifications` | `talk-notifications-store.js` | 通知本体（Supabase 併用） | ❌ ソース | DB `talk_notifications` + JWT `talk_user_id` |
| `tasful_talk_notify_fanout` | 同上 | 受信者 fanout | ❌ | DB / Edge |
| `tasful_chat_threads` / `tasful_chat_messages` | `chat-thread-store.js` · platform-chat-* | 取引スレッド | ❌ | `transaction_*` / Supabase chat |
| `tasu_chat_seed_v1` | `chat-supabase.js` | デモ seed | ❌ | 削除 |
| `tasu_talk_admin_preview` | `talk-runtime.js` | 運営 UI プレビュー | ❌ 本番 | claim `is_ops` |
| `tasu_builder_member` | `talk-runtime.js` | Builder プレビュー | ❌ | claim |

**sessionStorage（TALK）:** `tasu_talk_return_url` · `talkRestoreOnLoad` · `talkActiveTab` — **UX 状態 · 残可**

#### Builder

| キー | 代表ファイル | 用途 | 本番残せるか | JWT化 |
|------|-------------|------|-------------|-------|
| `tasful:builder:mvp:v1` | `builder/builder.js` | **全 MVP 状態** | ❌ | Supabase builder テーブル群 |
| `tasful:builder:mvp:role` | `builder/builder.js` · 監査 scripts | **partner/user/vendor/owner** | ❌ | JWT `actor_type` + `partner_id` |
| `tasful:builder:mvp:partner_id` | 同上 | パートナー ID | ❌ | claim `partner_id` |
| `tasful:builder:mvp:threads:v1` | 同上 | スレッド | ❌ | DB |
| `tasful:builder:partner_evaluations:v1` | partner-eval | 評価 | ❌ | DB |
| `tasful:builder:admin:*` | admin 画面 | 運営データ | ❌ | DB + `is_ops` |

**sessionStorage:** `tasful:builder:mvp:session:role` · `tasu:builder:ops-bench` — ベンチ用 · 本番 **禁止**

#### Connect

| キー | 代表ファイル | 用途 | 本番残せるか | JWT化 |
|------|-------------|------|-------------|-------|
| `tasful_connect_onboarding_v1` | `connect-member-ui.js` · `payment-settings.js` | onboarding ステップ | ❌ | DB + Stripe API |
| `tasful_demo_connect_seller_status_v1` | `platform-chat-connect-chat-flow.js` | 売主 Connect 状態 | ❌ | DB `stripe_account_id` |
| `tasu_stripe_ingest_mode_v1` | `stripe-connect-ingest.js` | sim/production 切替 | ❌ | サーバー設定 |
| `tasu_connect_issues_v1` | ingest / support | Connect 障害 | ❌ | DB |
| `tasful_platform_connect_payments_v1` | connect chat flow | TALK 取引決済デモ | ❌ | `shop_orders` / payments |

#### 市場

| キー | 代表ファイル | 用途 | 本番残せるか | JWT化 |
|------|-------------|------|-------------|-------|
| `tasu_market_cart` / `_items` / `_count` | `shop-market-product-data.js` | カート | ⚠️ 短期キャッシュ可 | DB or 匿名 cart → login 紐付 |
| `tasu_market_order_history` | 同上 · seller/buyer UI | 注文履歴 | ❌ | `shop_orders` |
| `tasu_market_last_order` | `shop-market-complete.js` | 完了表示 | ❌ | `shop_orders` |
| `tasu_market_seller_products` | 出品 | 出品 catalog LS | ❌ | `listings` / `business_listings` |
| `tasu_shop_orders` | `shop-checkout.js` | Path B デモ注文 | ❌ | `shop_orders` |
| `tasful_listings` / `tasu_listings_v1` | `listings-db.js` | 出品 fallback | ❌ | Supabase listings |

#### AI Workspace

| キー | 代表ファイル | 用途 | 本番残せるか | JWT化 |
|------|-------------|------|-------------|-------|
| `tasu_genai_plan` | `gen-ai-workspace.js` · E2E | プラン表示キャッシュ | ⚠️ | Edge `stripe-get-genai-plan` |
| `tasu_genai_usage` / `tasu_genai_my_characters` | gen-ai | 利用量 · キャラ | ❌ | DB `gen_ai_*` |
| `tasu_genai_active_character` | `gen-ai-character-vrm.js` | UI 選択 | ✅ 端末設定 | 任意 |

**sessionStorage:** `tasu_ai_chat_*` — 比較支援チャット履歴 · **端末内 OK**

#### AI秘書

| キー | 代表ファイル | 用途 | 本番残せるか | JWT化 |
|------|-------------|------|-------------|-------|
| `tasu_ai_ops_cases_v1` | `ai-ops-case-store.js` | 案件 | ❌ | Supabase ops テーブル |
| `tasu_ai_ops_events_v1` | admin-ai-* | イベント | ❌ | DB |
| `tasu_ai_ops_admin_notifications_v1` | `ai-ops-notify.js` | 運営通知 | ❌ | `ai_ops_admin_notifications` |
| `tasu_support_tickets_v1` | `support-trouble-center.js` | サポート | ❌ | DB |

**sessionStorage:** `tasu_ops_admin_access_token` — **運営書込トークン · JWT/短命 token 化必須**

#### 安否

| キー | 代表ファイル | 用途 | 本番残せるか | JWT化 |
|------|-------------|------|-------------|-------|
| `tasu_anpi_user_context_v1` | `anpi-user-context.js` | 安否コンテキスト本体 | ❌ | DB + JWT `member_id` |
| `tasu_anpi_user_id_hint_v1` | 同上 | 復元 hint | ⚠️ | claim 優先 |
| `tasu_anpi_notification_logs_v1` | anpi-notify | 通知ログ LS fallback | ❌ | Supabase logs |
| `tasu_anpi_*_mock_v1` | 各種 | **mock フラグ** | ❌ 本番禁止 | 削除 |
| `tasu_anpi_line_admin_v1` | `anpi-line-admin.js` | 運営モード | ❌ | claim `is_ops` / `anpi_admin` |

**sessionStorage:** LINE OAuth `tasu_anpi_line_login_*` — **OAuth フロー · 短期 OK**

---

### 疑似認証パターン（URL / config / dev フラグ）

| パターン | 所在 | 本番影響 | JWT化 |
|----------|------|----------|-------|
| `?talkDev=1` | 全領域 E2E · platform-chat-* | localhost 以外 **無効化済**（`talk-runtime`） | N/A |
| `?userId=u_*` | `chat-user-identity.js` | 本番 **無視 + warn**（実装済） | `talk_user_id` claim |
| `TASU_CHAT_SUPABASE_CONFIG.currentUserId` | config · fallback **`u_me`** | 未ログイン時 **偽装可能** | 本番では空 + ログイン強制 |
| `shouldDevSkipAuth()` | `member-auth.js` | localhost で **全ページ認証スキップ** | 本番 host で false |
| `?anpi_admin=1` | `anpi-line-admin-page.js` | 運営 UI 解放 | JWT `is_ops` |
| `?builder=1` / `tasu_builder_member` | `talk-runtime.js` | Builder プレビュー | claim |
| `demoConnect=1` | bench / detail-skill | Connect デモ | 実 Stripe 状態 |

---

## 確認② ロール判定

### ロール解決マトリクス

| ロール | 判定ロジック（現行） | 根拠 | 本番 JWT claim（案） | 移行リスク |
|--------|---------------------|------|---------------------|-----------|
| **user** | Builder `mvp:role=user` · 一般 member | LS + デモ actor | `actor_type=user` · `app_user_id` | **HIGH** LS 書換 |
| **partner** | `tasful:builder:mvp:role=partner` + `partner_id` | LS | `actor_type=partner` · `partner_id` (uuid) | **HIGH** |
| **vendor** | Builder general flow vendor_user | bench actor type | `actor_type=vendor` | **HIGH** |
| **owner** | Builder `owner` / `demo-owner-001` | LS 固定 ID | `actor_type=owner` · `owner_id` | **HIGH** |
| **business** | listing `listing_type` · service deals | データ属性 | `account_type=business` | MEDIUM |
| **buyer** | chat room `buyer_id` · market cart | リクエスト body / LS | `app_user_id`（buyer=自分） | MEDIUM |
| **seller** | `seller_id` · Connect `SELLER_STATUS_KEY` | LS demo status | `app_user_id` + `connect_account_id` | **HIGH** |
| **owner**（listing） | `listings.user_id` vs `getEffectiveUserId()` | クライアント比較 | JWT `talk_user_id` = `user_id` | **HIGH** RLS 未JWT時 |
| **applicant** | `gfIsApplicant(actor, spec)` | Builder general flow | `actor_type` + thread membership | MEDIUM |
| **poster** | `gfIsPoster` | Builder | 同上 | MEDIUM |
| **admin** | `isTalkAdmin()` = JWT role **or** `?talkAdmin=1` **or** LS preview | `talk-runtime.js` | `is_ops=true` / `role=tasu_admin` | **HIGH** preview 残存 |
| **ops** | `talk-notify-audience` page 名 · ops room | **ページ URL ベース** | `is_ops` claim | **HIGH** URL 到達=ops |

### RLS 期待 claim（既存 SQL）

| 領域 | SQL 参照 | 期待 claim |
|------|----------|-----------|
| Marketplace | `marketplace-rls-production.sql` | `talk_user_id` / `member_id` / `sub` · admin role |
| Builder | `builder-rls-policies.sql` | `actor_id` · `actor_type` · `partner_id` · `owner_id` |
| 安否 | `anpi-rls-production.sql` | `member_id` · `anpi_is_admin()` |
| TALK 通話 | `talk-call-rls-production.sql` | `talk_current_user_id()` |

**ギャップ:** フロントは LS/URL · RLS は JWT — **NB-3 未実装時は不整合**

### 判定（確認②）

**WARNING** — claim 名は SQL に草案あり · **発行パイプライン未接続**

---

## 確認③ 認証必須導線

### Builder

| 導線 | 現在の認証 | 必要 claim | DB/RLS | 優先度 |
|------|-----------|-----------|--------|--------|
| 応募 | LS MVP state · ロール LS | `actor_type` · `app_user_id` | builder threads RLS | **P0** |
| 採用 | owner LS 判定 | `actor_type=owner` | 同上 | **P0** |
| メッセージ | thread actor LS | `actor_id` | messages RLS | **P0** |
| 完了報告 | partner LS | `partner_id` | completion events | **P0** |
| 承認 | owner LS | `owner_id` | 同上 | **P0** |
| レビュー | user LS | `app_user_id` | reviews | **P1** |

**現状:** `member-auth` ガード **builder ページ未列入** · **認証なしで MVP 操作可**

### TALK

| 導線 | 現在の認証 | 必要 claim | DB/RLS | 優先度 |
|------|-----------|-----------|--------|--------|
| 通知 | `getEffectiveUserId()` · fanout LS | `talk_user_id` | `talk_notifications` | **P0** |
| スレッド | chat-supabase + seed fallback | `talk_user_id` | rooms RLS | **P0** |
| メッセージ送信 | 同上 | `talk_user_id` | messages | **P0** |
| 通話 | talk-call JWT RPC 設計済 | `talk_user_id` | `talk_call_*` RLS | **P0** |
| カレンダー追加 | Builder notify · ロール LS | `partner_id` | partner-assignment | **P1** |

### Connect

| 導線 | 現在の認証 | 必要 claim | DB/RLS | 優先度 |
|------|-----------|-----------|--------|--------|
| 本人確認 | LS onboarding step | `app_user_id` | profiles | **P0** |
| onboarding | LS `tasful_connect_onboarding_v1` | + Stripe account | business_listings | **P0** |
| 売上受取 | demo seller status LS | `connect_account_id` · `payout_enabled` | shop payout | **P0** |
| Connect 状態確認 | LS + UI | `connect_account_id` | DB sync | **P0** |

### 市場

| 導線 | 現在の認証 | 必要 claim | DB/RLS | 優先度 |
|------|-----------|-----------|--------|--------|
| 出品 | LS `publishSellerProduct` | `talk_user_id` = owner | `listings_insert_owner` | **P0** |
| 店舗 | 閲覧 anon OK · 管理 LS | owner claim | business_listings | **P1** |
| 商品購入 | Path A 無認証 · Path B `userId` body | `talk_user_id` | `shop_orders` | **P0** |
| 注文 | LS history | buyer id | shop_orders RLS | **P0** |
| 販売者管理 | LS seller profile | seller = JWT | orders by seller | **P0** |

### AI Workspace

| 導線 | 現在の認証 | 必要 claim | DB/RLS | 優先度 |
|------|-----------|-----------|--------|--------|
| 提案 / 比較 | デモ seed · anon 可 | 任意 | — | **P2** |
| 自動処理（GenAI API） | `getGenAiUserId()` ← config **`u_me` fallback** | `app_user_id` | `gen_ai_subscriptions` Edge | **P0** |
| Stripe checkout | body `user_id` | `app_user_id` | service_role apply | **P0** |
| 運営確認 | admin ページ URL | `is_ops` | — | **P1** |

### AI秘書

| 導線 | 現在の認証 | 必要 claim | DB/RLS | 優先度 |
|------|-----------|-----------|--------|--------|
| ダッシュボード | **ページガードなし**（URL 知識） | `is_ops` | ops read adapter | **P0** |
| 優先度 / 行動提案 | LS cases + Supabase read | `is_ops` | ai_ops_* | **P1** |
| Connect 警告 | sim ingest | `is_ops` | connect issues DB | **P1** |
| 運営通知 | LS + Supabase | `is_ops` | notifications | **P1** |

### 安否

| 導線 | 現在の認証 | 必要 claim | DB/RLS | 優先度 |
|------|-----------|-----------|--------|--------|
| 本人通知 | `anpi_user_context` LS | `member_id` | anpi context RLS | **P0** |
| 未応答 | Phase2 session LS/Supabase | `member_id` · family | `anpi_check_sessions` | **P0** |
| 家族通知 | TALK notify · user id 文字列 | `talk_user_id` | talk + anpi | **P0** |
| 緊急連絡先 | context LS | `member_id` | identity RLS | **P0** |

### 判定（確認③）

**FAIL**（本番必須導線）/ **PASS**（デモ E2E としては identity 明示）

---

## 確認④ JWT claim 設計案（最小限）

| claim | 用途 | 必須/任意 | 対象領域 | セキュリティ注意 |
|-------|------|----------|----------|----------------|
| **`sub`** | Supabase Auth UUID | **必須** | 全般 | RLS の auth.users 連携 |
| **`talk_user_id`** | TALK / 市場 / GenAI の業務 ID | **必須** | TALK · 市場 · Workspace | **`sub` と分離** · 移行期は mapping テーブル |
| **`member_id`** | 安否契約者 ID | **必須**（安否） | 安否 | `talk_user_id` と同一可 · SQL 両対応済 |
| **`email`** | 表示 · 監査 | 任意 | 共通 | PII · ログマスク |
| **`role`** | 粗いロール（`tasu_admin` 等） | 任意 | RLS admin 分岐 | **単一 claim のみに依存しない** |
| **`is_ops`** | 運営 UI / AI秘書 / 安否 admin | **必須**（運営） | AI秘書 · TALK admin | **サーバー署名のみ** · URL フラグ廃止 |
| **`is_admin`** | `is_ops` エイリアス候補 | 任意 | 同上 | `role` と冗長 — **1 つに統一** |
| **`actor_type`** | builder: owner/partner/user/vendor | **必須**（Builder） | Builder | LS `mvp:role` 置換 |
| **`actor_id`** | builder 操作者 ID | **必須**（Builder） | Builder | `builder_jwt_claim('actor_id')` と一致 |
| **`partner_id`** | UUID · パートナー行 | **条件必須** | Builder | partner ロール時のみ |
| **`owner_id`** | 運営 owner | **条件必須** | Builder | owner ロール時 |
| **`account_type`** | individual / business | 任意 | Connect · 市場 | onboarding 連動 |
| **`connect_account_id`** | Stripe `acct_*` | **条件必須** | Connect · 市場 payout | **クライアント設定禁止** · DB 正 |
| **`stripe_customer_id`** | GenAI 課金 | 任意 | Workspace | Edge のみ保持可 · claim は非推奨 |
| **`business_id`** | 店舗 / business_listings | 任意 | 市場 | seller 複数店舗時 |
| **`vendor_id`** | general flow vendor | 任意 | Builder | `actor_type=vendor` で代替可 |

**発行方針（案）:** Supabase Auth **`app_metadata` のみ**（ユーザー編集不可）· Edge / Admin API で更新

---

## 確認⑤ 移行順序（NB-3 · デモ維持 · FROZEN 尊重）

### STEP 1 — Identity 契約固定（コード最小）

- **対象:** claim 名 · `talk_user_id` ↔ `sub` mapping 方針 · ドキュメント
- **変更内容:** 設計書のみ · RLS SQL と `talk-runtime.pickTalkUserIdFromJwtPayload` を **単一表に整合**
- **影響:** なし（実装前）
- **検証:** レビュー · `builder-rls-policies.sql` / `marketplace-rls-production.sql` 照合

### STEP 2 — 本番 host ガード有効化（NB-1 後）

- **対象:** `member-auth.shouldDevSkipAuth` · `chat-user-identity` · `talk-runtime.isTalkDevMode`
- **変更内容:** `tasful.jp` で **dev skip 無効**（既存ロジック · config 確認のみ）
- **影響:** 未ログイン → login リダイレクト · **デモは localhost 維持**
- **検証:** localhost E2E 回帰 · 本番 host smoke

### STEP 3 — Supabase Auth ログイン → JWT 発行

- **対象:** `login.js` · `member-auth.establishSupabaseSession` · Auth hook（custom claims）
- **変更内容:** `app_metadata.talk_user_id` / `member_id` 付与 · `tasu_member_session` は **キャッシュ化**
- **影響:** TALK · 市場 · 安否 · GenAI の `getEffectiveUserId` 経路
- **検証:** `talk-runtime.getAuthTalkUserIdSync` · `verify-anpi-rls-real-db.mjs`

### STEP 4 — Connect + 市場 seller（収益クリティカル）

- **対象:** Connect onboarding Edge · `shop_orders` · listing owner CRUD
- **変更内容:** LS seller status → DB · checkout body `user_id` → JWT
- **影響:** NB-6/7/4/5 と連動 · **UI 変更最小**
- **検証:** `review-connect-user-flow` · shop smoke · RLS 38/38

### STEP 5 — Builder DB + actor claims

- **対象:** `builder/builder.js` MVP LS · `tasful:builder:mvp:role`
- **変更内容:** Supabase 読み書き · JWT `actor_type` / `partner_id` · **デモモードは LS フォールバック残置**
- **影響:** Builder 凍結解除 · bench は `talkDev` 継続
- **検証:** `verify-builder-general-flow-bench.mjs` 45/45

### STEP 6 — AI秘書 / ops ガード

- **対象:** `admin-operations-dashboard.html` · `supabase-ops-write-config.js`
- **変更内容:** `is_ops` claim 必須 · `tasu_ops_admin_access_token` → 短命 JWT
- **影響:** 運営 URL 直アクセス遮断
- **検証:** `test-admin-operations-dashboard-browser.mjs`

### STEP 7 — LS データ移行 · mock フラグ削除

- **対象:** `tasu_anpi_*_mock_v1` · Connect sim · market order LS
- **変更内容:** migration scripts · 本番 `ANPI_LINE_MOCK=0`
- **影響:** 横断 · **最後に実施**（デモ破壊防止）
- **検証:** 全 `review-*-user-flow.mjs` · regression final

**優先条件への適合:** Connect/市場（STEP 4）→ Builder（STEP 5）· localhost デモは STEP 2 以降も **`talkDev=1` で維持**

---

## 確認⑥ リスク分類

### RELEASE BLOCKER

| ID | リスク | 内容 |
|----|--------|------|
| RB-A1 | **userId 偽装** | 本番未ログイン時 `u_me` / config fallback（`chat-supabase.js` · `gen-ai-workspace.js`） |
| RB-A2 | **Builder 全状態 LS** | `tasful:builder:mvp:v1` — なりすまし · データ消失 |
| RB-A3 | **Connect 状態 LS** | 売上受取がデモ state · 実 Stripe 非連動 |
| RB-A4 | **市場注文 LS** | 購入/売上が本番 DB に残らない |
| RB-A5 | **ops ページ無ガード** | admin ダッシュボード URL 到達で運営 UI |
| RB-A6 | **JWT claim 未発行** | RLS は JWT 前提 · クライアントは LS — **全面不整合** |

### HIGH

| ID | リスク |
|----|--------|
| RH-A1 | `?talkAdmin=1` / `tasu_talk_admin_preview` 運営 UI |
| RH-A2 | `tasful:builder:mvp:role` ロール偽装 |
| RH-A3 | listing owner クライアント比較のみ（RLS 迂回は anon 不可だが insert 失敗/デモ混在） |
| RH-A4 | GenAI checkout `user_id` body 信頼（Edge metadata） |
| RH-A5 | 安否 mock フラグ本番残存 |
| RH-A6 | `shouldDevSkipAuth` mis-config on production host |

### MEDIUM

| ID | リスク |
|----|--------|
| RM-A1 | 通知/チャット LS キャッシュと Supabase 二重源 |
| RM-A2 | sessionStorage ops token 長期保存 |
| RM-A3 | AI Workspace 比較デモ seed |
| RM-A4 | `tasu_member_session` hybrid — Supabase session との drift |

### LOW

| ID | リスク |
|----|--------|
| RL-A1 | UI sessionStorage（戻り URL · スクロール） |
| RL-A2 | genai 端末キャラ選択 LS |
| RL-A3 | E2E scripts の LS seed 操作 |

---

# 総合判定

## **WARNING**

| 理由 | 詳細 |
|------|------|
| **READY 要素** | JWT 読取（`talk-runtime`）· Supabase Auth ログイン経路 · RLS SQL 草案 · `chat-user-identity` 本番 URL 無視 — **設計の芽はある** |
| **FAIL 要素** | 永続データの大半が LS · ops/Builder/Connect ロールが偽装可能 · claim 発行パイプライン **未実装** |
| **判定** | NB-3 **実装開始可能だが設計決定必須** — 現状のまま本番 JWT 切替は **NO-GO** |

---

# NB-3 実装前に必要な設計決定

1. **`talk_user_id` と Supabase `sub` の関係** — 同一 vs mapping テーブル vs signup 時発行
2. **claim 格納場所** — `app_metadata` only（推奨） vs `user_metadata`
3. **Builder `actor_type` 枚举** — owner / partner / user / vendor / builder の正規化
4. **partner_id / owner_id の型** — uuid vs text（`builder-rls-policies.sql` は uuid）
5. **運営判定** — `is_ops` 単一 claim vs `role=tasu_admin` · **`?talkAdmin=1` 本番禁止**
6. **デモ維持策略** — localhost + `talkDev=1` で LS MVP 残すか / feature flag
7. **GenAI `user_id`** — JWT のみ vs body（Edge は JWT 検証必須）
8. **市場 cart** — 匿名 cart → ログイン merge 仕様
9. **Connect `connect_account_id`** — claim に載せるか DB lookup only（**DB 推奨**）
10. **Auth hook 実装場所** — Supabase Edge Function vs Dashboard hook vs 手動 admin API
11. **移行期間の dual-read** — LS + Supabase 併用期間とカットオーバー条件
12. **MEMBER_GUARD_PAGES 拡張** — builder · gen-ai-workspace · admin-* を含めるか

---

# 推奨実装順

1. **設計決定 1〜6** を固定（上記リスト）
2. **NB-1** 本番 host — dev skip が確実に off になる環境
3. **Auth hook** — `talk_user_id` + `member_id` + `is_ops` 最小セット
4. **`member-auth` + `talk-runtime`** — 本番で LS/URL fallback を **ログイン必須**に
5. **Marketplace owner** — JWT + 既存 RLS（`verify-marketplace-rls.mjs`）
6. **Connect** — DB account 状態 · onboarding Edge（LS 読み替え）
7. **Shop orders / checkout** — JWT buyer · seller payout gate
8. **Builder Supabase** — actor claims + DDL（NB-2 連動）
9. **AI秘書 ops ガード** — `is_ops` 必須
10. **安否** — mock フラグ除去 · `member_id` 統一
11. **LS 移行バッチ** — 領域別 migration · dual-read 終了
12. **回帰** — frozen 6 領域 + `test-tasful-regression-final.mjs`

---

## 参照ファイル（identity 中核）

| ファイル | 役割 |
|----------|------|
| `chat-user-identity.js` |  effective userId · URL 本番無効 |
| `talk-runtime.js` | JWT 解析 · admin/builder preview |
| `member-auth.js` | セッション · dev skip · page guard |
| `talk-notifications-store.js` | 通知 LS + Supabase |
| `builder/builder.js` | MVP LS · role keys |
| `payment-settings.js` / `connect-member-ui.js` | Connect LS |
| `anpi-user-context.js` | 安否 context LS |
| `gen-ai-workspace.js` | `getGenAiUserId()` |
| `sql/marketplace-rls-production.sql` | marketplace JWT |
| `sql/builder-rls-policies.sql` | builder JWT claims |
| `sql/anpi-rls-production.sql` | anpi member_id |

---

**監査実施:** 静的解析 · `node scripts/audit-localstorage-usage.mjs` · **変更 0 件**
