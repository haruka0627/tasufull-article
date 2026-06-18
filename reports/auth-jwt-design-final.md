# P1-A2: Auth / JWT 設計固定（TASFUL 全体）

**作成日:** 2026-06-18  
**種別:** 設計固定のみ（**コード / UI / DB / Secrets / 認証実装 変更なし**）  
**前提:** [`auth-jwt-migration-audit.md`](auth-jwt-migration-audit.md)（P1-A1）· [`release-blocker-roadmap.md`](release-blocker-roadmap.md) NB-3  
**Supabase プロジェクト:** `ddojquacsyqesrjhcvmn`

---

## 設計原則（固定）

1. **正（Source of Truth）:** Supabase Auth JWT **`app_metadata` のみ**（ユーザー編集不可）· 永続データは **DB** · Connect/Stripe ID は **DB 参照**
2. **業務 ID:** クロスドメイン識別子は **`talk_user_id`（text）** を canonical とする
3. **安否:** `member_id` は **`talk_user_id` と同一値**を signup 時に設定（family 契約は行レベルで `contract_holder_id` 分離）
4. **Builder 案件ロール**（poster/applicant）は **JWT に載せない** — **DB `builder_project_applications` で判定**
5. **運営:** **`is_ops=true`** のみを新規 canonical とし、既存 RLS の `tasu_admin` / `role` は **移行期互換**
6. **デモ:** localhost / `?talkDev=1` / `config.talkDevMode` のみ LS・URL 権限 fallback を許可

---

# 設計決定一覧

| # | 決定 | 内容 |
|---|------|------|
| D-1 | 業務 ID | `talk_user_id` = canonical · `app_user_id` claim **不採用**（エイリアス禁止） |
| D-2 | sub との関係 | **1:1 mapping テーブル** `member_identities(auth_user_id uuid PK, talk_user_id text UNIQUE)` · signup 時発行 |
| D-3 | member_id | **常に talk_user_id と同値**を `app_metadata` に設定 |
| D-4 | claim 格納 | **`app_metadata` only** · `user_metadata` は RLS **禁止** |
| D-5 | ops 判定 | **`is_ops: boolean`** canonical + **`role: 'tasu_admin'`** 互換 |
| D-6 | is_admin | **独立 claim 不採用** · `is_ops` に統合 |
| D-7 | Builder 平台種別 | JWT `platform_role`: `member` \| `partner` \| `vendor`（旧 actor_type 相当） |
| D-8 | Builder 案件権限 | poster/applicant/owner — **DB のみ** · JWT に載せない |
| D-9 | partner_id | JWT に **partner 組織 UUID**（ユーザーが partner スタッフの場合のみ） |
| D-10 | Connect | `connect_account_id` / `stripe_customer_id` — **JWT 禁止** · DB lookup |
| D-11 | business_id | **JWT 禁止** · `business_listings.user_id = talk_user_id` |
| D-12 | 本番 LS | 認証・権限・注文・通知・Connect — **禁止** |
| D-13 | dev policy | `*_dev` **本番 0 件維持**（[`dev-rls-p0-drop-result.md`](dev-rls-p0-drop-result.md) 継続） |
| D-14 | Edge 認証 | 書込 API は **JWT 必須** · body `user_id` は **JWT と一致検証**（service_role 除く） |
| D-15 | Auth hook | Supabase **Custom Access Token Hook**（Edge）で claim 注入 · 手動 admin API で ops 付与 |

---

# 採用 JWT claims

## 確認① — 最小セット確定

| claim | 採否 | 必須/任意 | 用途 | 領域 | RLS | セキュリティ |
|-------|------|----------|------|------|-----|------------|
| **`sub`** | ✅ 採用 | **必須**（Auth 標準） | `auth.users.id` | 全般 | fallback のみ | Supabase 発行 · 改ざん不可 |
| **`talk_user_id`** | ✅ 採用 | **必須** | 業務主体 ID | TALK · 市場 · Workspace · Connect · Builder 参加者 | **Yes** | `app_metadata` · text · 不変 |
| **`member_id`** | ✅ 採用 | **必須** | 安否 RLS · = `talk_user_id` | 安否 | **Yes** | D-3 同値 |
| **`is_ops`** | ✅ 採用 | 任意（default false） | 運営 UI · AI秘書 · 書込 | AI秘書 · TALK admin · 安否 admin | **Yes**（新関数） | bool · admin API のみ更新 |
| **`role`** | ✅ 採用（互換） | 任意 | **`tasu_admin`** 既存 RLS 互換 | 横断 | **Yes**（既存 SQL） | `is_ops` と **同期**（hook） |
| **`platform_role`** | ✅ 採用 | 任意 | Builder **平台**種別: member/partner/vendor | Builder | 補助のみ | 案件権限の代替 **不可** |
| **`partner_id`** | ✅ 採用 | 条件必須 | partner 組織 UUID | Builder · Connect | Builder RLS | partner スタッフのみ |
| **`owner_id`** | ✅ 採用 | 条件必須 | TASFUL 運営 owner 行（`demo-owner-001` 後継） | Builder admin | Builder RLS | **`is_ops` 時のみ** または固定 ops owner |
| **`email`** | ⚠️ 参照のみ | 任意 | 表示 · 監査 | 共通 | **No** | Supabase 標準 claim · RLS 不使用 |
| **`app_user_id`** | ❌ 不採用 | — | `talk_user_id` と重複 | — | — | 名称分裂防止 |
| **`actor_type`** | ❌ JWT 不採用 | — | → **`platform_role`** に改名 | Builder | 旧 SQL 移行時 alias | 案件 poster/applicant と混同防止 |
| **`actor_id`** | ❌ JWT 不採用 | — | → **`talk_user_id`** で代替 | Builder | `talk_user_id` = 参加者 ID | — |
| **`vendor_id`** | ❌ 不採用 | — | `platform_role=vendor` + DB | Builder | DB | — |
| **`business_id`** | ❌ 不採用 | — | DB `business_listings` | 市場 | DB `user_id` | — |
| **`connect_account_id`** | ❌ 不採用 | — | DB `business_listings.stripe_account_id` | Connect · 市場 | DB | クライアント設定 **禁止** |
| **`stripe_customer_id`** | ❌ 不採用 | — | DB `gen_ai_subscriptions` / Edge | Workspace | Edge service_role | PCI/秘匿 |
| **`is_admin`** | ❌ 不採用 | — | → **`is_ops`** | — | — | 二重判定防止 |

### JWT payload 例（本番 · app_metadata）

```json
{
  "talk_user_id": "u_7f3a…",
  "member_id": "u_7f3a…",
  "is_ops": false,
  "role": "authenticated",
  "platform_role": "member",
  "partner_id": null
}
```

**運営ユーザー例:**

```json
{
  "talk_user_id": "u_ops_001",
  "member_id": "u_ops_001",
  "is_ops": true,
  "role": "tasu_admin",
  "platform_role": "member",
  "owner_id": "tasful_ops"
}
```

---

# 確認② — ID 対応方針

| ID | 関係 | 主キー | 外部キー候補 | JWT | DB 解決 |
|----|------|--------|-------------|-----|---------|
| **`auth.users.id` (`sub`)** | 1:1 → talk_user_id | uuid PK | `member_identities.auth_user_id` | **sub**（標準） | mapping テーブル |
| **`talk_user_id`** | 1:1 sub（本設計） | text UNIQUE | 全市場・TALK・安否・GenAI 行 | **必須** | canonical |
| **`member_id`** | N:1 talk_user_id（通常 1:1） | — | 安否 context 行 | **必須**（=talk_user_id） | 家族契約時のみ行で holder 分離 |
| **`app_user_id`** | — 不採用 | — | — | ❌ | talk_user_id |
| **Builder `actor_id`（参加者）** | = talk_user_id | — | applications.user_id | **talk_user_id** | 案件ごと |
| **`partner_id`** | N:1 partner org | uuid PK | `builder_partners.id` | **条件** | partner スタッフ membership |
| **`vendor_id`** | — | uuid | vendor profile | ❌ | `platform_role` + vendor テーブル |
| **`business_id`** | N:1 seller | uuid | `business_listings.id` | ❌ | seller = talk_user_id |
| **`stripe_customer_id`** | 1:1 talk_user_id 想定 | text | `gen_ai_subscriptions` | ❌ | Edge / DB |
| **`connect_account_id`** | N:1 seller | text `acct_*` | `business_listings.stripe_account_id` | ❌ | payout 解決 |

**新規テーブル（設計 · 未実装）:**

```text
member_identities (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  talk_user_id text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
)
```

**Signup フロー（設計）:** Auth 作成 → hook が `talk_user_id` 新規発行（`u_` + uuid 短縮）→ `member_id` 同値設定

---

# 確認③ — Builder actor 設計

## 用語分離（固定）

| 用語 | レイヤ | 意味 | JWT / URL |
|------|--------|------|-----------|
| **platform_role** | 平台 | ユーザーの登録種別: member / partner / vendor | JWT **`platform_role`** |
| **poster** | 案件 | 掲示者（案件作成者） | **DB** `projects.created_by` |
| **applicant** | 案件 | 応募者 | **DB** `applications.status` |
| **owner** | 平台 | TASFUL 運営（`owner_id`） | JWT **`owner_id`** + `is_ops` |
| **partner** | 組織 | パートナー会社 | JWT **`partner_id`** + DB |
| **user_user / partner_user / vendor_user** | **ベンチフロー ID** | E2E シナリオ名 · **権限ではない** | demo/bench のみ |

## actor 判定（本番）

| 操作 | 判定根拠 | RLS 条件（案） |
|------|----------|----------------|
| **応募** | `talk_user_id` + insert application | `applications.user_id = talk_current_user_id()` |
| **採用** | project owner / ops | `builder_is_project_owner(project_id)` OR `is_ops` |
| **メッセージ** | thread participant | `thread_participants.user_id = talk_current_user_id()` |
| **完了報告 submitter** | 採用済み partner **または** applicant（フロー定義） | `applications.status='selected'` AND `user_id = talk_current_user_id()` |
| **承認者** | project owner / ops | `builder_is_project_owner` OR `talk_is_admin()` |
| **レビュー投稿者** | 取引相手方（DB） | `reviews.author_id = talk_current_user_id()` |

## URL / LS role の扱い

| 項目 | 決定 |
|------|------|
| `tasful:builder:mvp:role` | **表示・デモ切替のみ** · **権限源にしない** |
| `?builderFlow=partner_user` | **bench 表示用** · 本番 **無効** |
| sessionStorage `mvp:session:role` | **demo/bench のみ** |

**既存 SQL 整合:** `builder-rls-policies.sql` の `actor_type` は実装時 **`platform_role` に読替** + 案件権限は **application テーブル**へ移譲（SQL 改訂は NB-3 実装フェーズ · 本設計で方針固定）

---

# 確認④ — ops / admin ガード方式

## claim 固定

| claim | 役割 |
|-------|------|
| **`is_ops`** | **canonical** — フロントガード + 新 RLS `tasu_is_ops()` |
| **`role=tasu_admin`** | **互換** — 既存 `talk_is_admin()` · `anpi_is_admin()` |
| **`is_admin`** | **使用禁止**（新規コード） |
| **ops role / admin role 文字列** | **`role` 単一フィールド** · 値 `authenticated` \| `tasu_admin` |

## 許可画面（`is_ops=true` または dev preview）

| 画面 / パス | 領域 |
|-------------|------|
| `admin-operations-dashboard.html` | AI秘書 |
| `talk-ops-room.html` | AI秘書 |
| `admin-ai-operations-center.html` | AI秘書 |
| `support-trouble-center.html` | AI秘書 |
| `anpi-line-admin.html` | 安否運営 |
| `builder/builder-admin-*.html` | Builder 運営 |
| `ops-talk.html` | 運営 TALK |

## AI Workspace

| 項目 | 決定 |
|------|------|
| 一般利用者 | **`talk_user_id` 必須** · ops 不要 |
| 運営確認系 | **同一 host 内 admin リンク** — 到達は **`is_ops` 必須** |
| GenAI 自動処理 Edge | **JWT 検証** · body user_id = claim |

## 拒否時挙動（本番）

| 条件 | 挙動 |
|------|------|
| 未ログイン | `login.html?returnUrl=…` |
| ログイン済み · `is_ops=false` で ops 画面 | **403 静的** または `dashboard.html` へ · **データ API 空** |
| JWT 期限切れ | 再ログイン |

## preview / demo 例外

| 机制 | 本番 `tasful.jp` | localhost / `?talkDev=1` |
|------|------------------|---------------------------|
| `?talkAdmin=1` | **禁止** | 許可（preview のみ · **書込不可**） |
| `localStorage tasu_talk_admin_preview` | **禁止** | 許可（read-only 推奨） |
| `sessionStorage tasu_ops_admin_access_token` | **廃止** → JWT | dev のみ legacy |

---

# localStorage 廃止 / 残存方針

## 分類ルール（確認⑤）

| 分類 | 条件 | 本番 |
|------|------|------|
| **A. 残してよい** | UI 状態 · フィルタ · draft 下書き · viewport · OAuth state（sessionStorage 可） | ✅ |
| **B. 移行必須** | userId · role · 権限 · Connect · order · notification · builder 状態 · ops データ | ❌ LS 禁止 |
| **C. demo 限定** | bench · seed · preview · mock フラグ | localhost/dev のみ |

## 代表キー — A（残可）

| キー | 用途 |
|------|------|
| `tasful_last_profile` | 表示キャッシュ |
| `tasu_ai_chat_*`（sessionStorage） | WS 比較チャット履歴 |
| `tasu_talk_return_url`（sessionStorage） | 戻り URL |
| `talkRestoreOnLoad` / `talkActiveTab` | タブ復元 |
| `tasu_anpi_line_login_*`（sessionStorage） | LINE OAuth |
| `tasu_breadcrumb_stack_v1`（sessionStorage） | パンくず |

## 代表キー — B（移行必須 · 優先度 P0→P2）

| 優先 | キー | 領域 |
|------|------|------|
| P0 | `tasu_member_session`（auth 主体は JWT） | 共通 |
| P0 | `tasful:builder:mvp:v1` / `mvp:role` / `mvp:partner_id` | Builder |
| P0 | `tasful_connect_onboarding_v1` / `tasful_demo_connect_seller_status_v1` | Connect |
| P0 | `tasu_market_order_history` / `tasu_shop_orders` / `tasu_market_seller_products` | 市場 |
| P0 | `tasful_talk_notifications` / `tasful_chat_threads` / `tasful_chat_messages` | TALK |
| P0 | `tasu_anpi_user_context_v1` | 安否 |
| P0 | `tasu_ai_ops_*` / `tasu_support_*` | AI秘書 |
| P1 | `tasu_genai_plan` / `tasu_genai_usage` | Workspace |
| P1 | `tasu_market_cart*` | 市場（ログイン後 DB へ） |
| P2 | `tasful_favorites` / `tasu_listings_v1` | 市場 |

## 本番禁止キー（一覧 · 抜粋 40）

```
tasful:builder:mvp:*          tasu_stripe_ingest_mode_v1
tasful_connect_onboarding_v1  tasful_demo_connect_seller_status_v1
tasu_connect_issues_v1        tasful_platform_connect_payments_v1
tasu_market_order_history     tasu_market_seller_products
tasu_shop_orders              tasful_listings / tasu_listings_v1
tasful_talk_notifications     tasful_chat_threads / tasful_chat_messages
tasu_chat_seed_v1             tasu_talk_admin_preview
tasu_builder_member           tasu_anpi_*_mock_v1
tasu_anpi_line_admin_v1       tasu_member_role
tasu_ai_ops_cases_v1          tasu_ai_ops_events_v1
tasu_ai_ops_admin_notifications_v1   tasu_support_tickets_v1
tasu_ops_admin_access_token (sessionStorage)
```

**185 キー全体:** 実装時 `audit-localstorage-usage.mjs --json` と照合 · **B/C は本番ビルドで assert 禁止**

---

# RLS 方針

## 確認⑥ — claim 名固定

| RLS 関数 | 参照 claim（優先順） | 対象テーブル例 |
|----------|---------------------|----------------|
| **`talk_current_user_id()`** | `talk_user_id` → `member_id` → `sub` | `talk_notifications` · `talk_call_*` · `listings.user_id` |
| **`talk_is_admin()`** | `role=tasu_admin` · `tasu_admin` · **`is_ops=true`（追加）** | talk admin insert |
| **`anpi_current_member_id()`** | `member_id` → `sub` | `anpi_user_context` · logs |
| **`anpi_is_admin()`** | 同上 + **`is_ops`** | anpi admin |
| **`marketplace_is_owner(uid)`** | `talk_current_user_id() = uid` | `listings` owner policies |
| **`marketplace_is_admin()`** | `talk_is_admin()` 委譲 | marketplace admin |
| **`builder_current_*()`** | `talk_user_id` · `platform_role` · `partner_id` · `owner_id` | builder_* テーブル |
| **`tasu_is_ops()`（新規 · 設計）** | `is_ops=true` OR `role=tasu_admin` | ops 書込テーブル |

### 条件式案（`tasu_is_ops` · 新規統一）

```sql
-- 設計案（NB-3 実装時に各 is_admin を段階統合）
select coalesce(
  (auth.jwt() -> 'app_metadata' ->> 'is_ops')::boolean,
  false
) or public.talk_is_admin();
```

### anon 禁止方針

| 対象 | 方針 |
|------|------|
| 通知 · チャット · 注文 · builder · anpi context | **authenticated のみ** |
| 公開 listings 閲覧 | **`listings_public_safe` view** · anon SELECT のみ（既存） |
| 書込全般 | **anon INSERT/UPDATE/DELETE 禁止** |

### service_role 使用範囲

| 用途 | 許可 |
|------|------|
| Stripe Webhook apply（GenAI · Featured · shop） | ✅ |
| LINE send Edge · バッチ | ✅ |
| クライアント anon key からの service_role | ❌ |
| ops 画面から service_role | ❌ |

### dev policy 廃止

| 項目 | 方針 |
|------|------|
| `*_dev` / `using(true)` | **本番 0 維持** · 新規 dev policy **禁止** |
| staging | 別 Supabase project 推奨 |
| 検証 | `sql/dev-rls-p0-post-check.sql` をリリースゲート |

---

# デモ互換方針（確認⑦）

| モード | 判定 | LS / URL fallback |
|--------|------|-------------------|
| **production** | `hostname=tasful.jp`（確定 host リスト）· `talkDev` 無効 | **禁止** |
| **demo** | localhost · 127.0.0.1 · `?talkDev=1` · `talkDevMode=true` | **許可** |
| **preview** | demo + `?talkAdmin=1` | **ops UI  read-only** · API 書込禁止 |
| **bench** | demo + `benchEmbed=1` / sessionStorage ops-bench | **許可** · CI 専用 |

### 本番ビルド無効化条件

- `TASU_CHAT_SUPABASE_CONFIG.talkProductionMode !== false` on production host
- `shouldDevSkipAuth() === false`
- `getEffectiveUserId()` — authId 空なら **ログイン誘導**（config `u_me` fallback 禁止）

### テスト URL パラメータ

| パラメータ | 本番 | demo |
|------------|------|------|
| `talkDev=1` | ❌ 無視 | ✅ |
| `userId=u_*` | ❌ 無視（warn） | ✅ |
| `talkAdmin=1` | ❌ | ✅ preview |
| `anpi_admin=1` | ❌ | ✅ preview |
| `demoConnect=1` | ❌ | ✅ |

**回帰:** 凍結 E2E は **demo モードのまま** · 本番 smoke は **別スイート**

---

# 実装順序（NB-3 · 確認⑧）

### STEP 1 — 設計・ claim 固定

| 項目 | 内容 |
|------|------|
| **変更対象** | 本ドキュメント · hook 仕様書 · mapping DDL 草案 |
| **影響** | なし |
| **DoD** | ステークホルダー sign-off · P1-A2 **READY** |
| **ロールバック** | — |

### STEP 2 — Auth helper / getCurrentUser

| 項目 | 内容 |
|------|------|
| **変更対象** | `member-auth.js` · `talk-runtime.js` · `chat-user-identity.js` · Custom Access Token Hook |
| **影響** | 全領域 read path |
| **DoD** | 本番 host で `getAuthTalkUserIdSync()` 非空 · config `u_me` fallback 削除 |
| **ロールバック** | hook 無効 · dev skip 再有効 |

### STEP 3 — ops / admin guard

| 項目 | 内容 |
|------|------|
| **変更対象** | admin-* HTML 入口 · `supabase-ops-write-config.js` |
| **影響** | AI秘書 · 安否 admin |
| **DoD** | 非 ops JWT で admin URL → 403 · `?talkAdmin=1` 本番無効 |
| **ロールバック** | feature flag `TASU_OPS_GUARD=0`（dev のみ） |

### STEP 4 — Connect 状態 JWT/DB 化

| 項目 | 内容 |
|------|------|
| **変更対象** | `payment-settings.js` · Connect Edge · `business_listings` |
| **影響** | Connect · 市場 payout |
| **DoD** | LS onboarding 不使用 · DB `stripe_account_id` が正 |
| **ロールバック** | LS read fallback（demo のみ） |

### STEP 5 — 市場 buyer / seller JWT 化

| 項目 | 内容 |
|------|------|
| **変更対象** | `shop-checkout.js` · listings CRUD · `shop_orders` |
| **影響** | 市場 |
| **DoD** | 購入/出品が `talk_current_user_id()` と RLS 一致 |
| **ロールバック** | Path A demo 復帰（feature flag） |

### STEP 6 — Builder actor JWT/DB 化

| 項目 | 内容 |
|------|------|
| **変更対象** | `builder/builder.js` · builder Supabase · RLS SQL 更新 |
| **影響** | Builder |
| **DoD** | bench 45/45 · LS `mvp:v1` 未使用（本番） |
| **ロールバック** | demo LS 復帰（localhost） |

### STEP 7 — localStorage fallback 制限

| 項目 | 内容 |
|------|------|
| **変更対象** | 禁止キー一覧 · 本番 assert · mock フラグ削除 |
| **影響** | 横断 |
| **DoD** | 本番で B/C キー書込が no-op + console warn |
| **ロールバック** | per-key feature flag |

### STEP 8 — RLS 再検証

| 項目 | 内容 |
|------|------|
| **変更対象** | `talk_is_admin` + `is_ops` · builder SQL · hook 連携 |
| **影響** | DB ポリシー（実装フェーズ） |
| **DoD** | `verify-marketplace-rls` 38/38 · `verify-anpi-rls-real-db` 17/17 · talk RLS staging PASS |
| **ロールバック** | policy バージョン戻し（migration 記録） |

### STEP 9 — E2E 再検証

| 項目 | 内容 |
|------|------|
| **変更対象** | smoke スイート分割（demo vs prod） |
| **影響** | CI |
| **DoD** | `review-*-user-flow` PASS · `test-tasful-regression-final` PASS |
| **ロールバック** | demo スイートのみ CI gate |

---

# 未決事項

| # | 項目 | 解決時期 | 備考 |
|---|------|----------|------|
| U-1 | Custom Access Token Hook の **デプロイ名・ランタイム** | STEP 2 着手前 | Supabase Dashboard vs Edge Function |
| U-2 | **`talk_user_id` 既存デモ ID（`u_me`）移行** | STEP 2 | mapping テーブル seed vs 新規発行のみ |
| U-3 | **builder-rls-policies.sql** の `actor_type` → `platform_role` リネーム SQL | STEP 6 | 本設計は方針固定済 |
| U-4 | **匿名カート → ログイン merge** 詳細 UX | STEP 5 | 設計上 DB 移行で足りる |
| U-5 | **ops 403 ページ** 静的 HTML 新規か dashboard リダイレクトか | STEP 3 | UX 最小なら redirect |
| U-6 | **family 安否** で `member_id ≠ talk_user_id` を将来許容するか | Phase3+ | 現設計は 1:1 |

---

# 総合判定

## **READY**

| 条件 | 状態 |
|------|------|
| P1-A1 の 12 設計決定が **すべて固定** | ✅ D-1〜D-15 |
| claim 最小セット確定 | ✅ |
| ID mapping 方針確定 | ✅ |
| Builder / ops / LS / RLS / demo 方針確定 | ✅ |
| NB-3 実装 STEP 1〜9 · DoD 定義 | ✅ |
| 未決は **実装着手阻害しない**（U-1〜U-3 は STEP 2/6 で解消） | ✅ |

**NB-3 Auth/JWT 実装（コード変更）に進行可能。** 最初の実装 PR は **STEP 2（Auth hook + getCurrentUser）** と **STEP 3（ops guard）** を並行可能。

---

## P1-A1 RELEASE BLOCKER との対応

| RB | 設計での解消方針 |
|----|------------------|
| RB-A1 userId 偽装 | STEP 2 · 本番 fallback 禁止 |
| RB-A2 Builder LS | STEP 6 · DB + talk_user_id |
| RB-A3 Connect LS | STEP 4 · DB |
| RB-A4 市場 LS | STEP 5 · shop_orders |
| RB-A5 ops 無ガード | STEP 3 · is_ops |
| RB-A6 claim 未発行 | STEP 2 · hook |

---

**参照:** [`auth-jwt-migration-audit.md`](auth-jwt-migration-audit.md) · [`sql/talk-rls-production.sql`](../sql/talk-rls-production.sql) · [`sql/builder-rls-policies.sql`](../sql/builder-rls-policies.sql) · [`sql/anpi-rls-production.sql`](../sql/anpi-rls-production.sql) · [`sql/marketplace-rls-production.sql`](../sql/marketplace-rls-production.sql)

**設計固定完了:** コード / UI / DB / Secrets / 認証処理 **変更 0 件**
