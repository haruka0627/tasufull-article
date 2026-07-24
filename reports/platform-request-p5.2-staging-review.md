# Platform Request P5.2 — Staging SQL Review Report

**Date:** 2026-07-05  
**Phase:** P5.2（レビュー・検証のみ · **SQL 未適用**）  
**Review target:** `supabase/platform-request-p5.1-ddl-rls-draft.sql`  
**Prior:** P5.1 `reports/platform-request-p5.1-ddl-rls-draft.md`

---

## 0. スコープ

| 実施 | 未実施 |
| --- | --- |
| 静的レビュー（DDL / RLS / 整合性） | SQL 適用 |
| リスク分類 · チェックリスト作成 | Supabase Migration / SQL Editor 実行 |
| Staging 適用可否判定 | Production 接触 |
| Markdown + SSOT 更新 | JS / HTML / CSS / Edge / Stripe / Talk 実装 |

---

## 1. DDL 整合性レビュー

### 1.1 サマリー

| 観点 | 判定 | コメント |
| --- | --- | --- |
| **PK** | ✅ 問題なし | 全 5 テーブル `id uuid primary key default gen_random_uuid()` |
| **FK** | ✅ 問題なし | 参照整合 · CASCADE / RESTRICT / SET NULL が責務に合致 |
| **NOT NULL** | ✅ 問題なし | 必須列は適切。`budget` · `legacy_local_id` · `sent_at` 等は nullable |
| **DEFAULT** | ✅ 問題なし | `status` · `urgency` · `photos` · `amount_jpy` · `purpose` 等 |
| **INDEX** | ✅ 基本十分 | 主要クエリパスをカバー（下表） |
| **CHECK** | ✅ 問題なし | status / urgency / channel / jsonb array 型 |

### 1.2 テーブル別 DDL 詳細

#### `platform_requests`

| 項目 | 内容 | 判定 |
| --- | --- | --- |
| PK | `id` uuid | ✅ |
| UNIQUE | `legacy_local_id` | ✅ LS 移行用 |
| FK | なし（`owner_id` → auth.users は Supabase 慣行どおりアプリ層） | ✅ |
| CHECK | title ≤80 · photos array · urgency · status | ✅ |
| INDEX | `owner_id` · `(status, created_at desc)` · `category` | ✅ |
| TRIGGER | `updated_at` 自動更新 | ✅ |

**P2 localStorage 互換:** `title` / `body` / `category` / `area` / `urgency` / `budget` / `photos` / `status` — すべてマッピング可能。

#### `platform_request_matches`

| 項目 | 内容 | 判定 |
| --- | --- | --- |
| PK | `id` uuid | ✅ |
| FK | `request_id` → `platform_requests` **ON DELETE CASCADE** | ✅ |
| UNIQUE | `(request_id, candidate_id, candidate_type)` | ✅ 重複マッチ防止 |
| CHECK | `candidate_type` 6 値 · `match_reasons` array · status 6 値 | ✅ |
| INDEX | `request_id` · `(candidate_id, candidate_type)` · `status` | ✅ |

#### `platform_request_notifications`

| 項目 | 内容 | 判定 |
| --- | --- | --- |
| PK | `id` uuid | ✅ |
| FK | `request_id` CASCADE · `match_id` SET NULL | ✅ |
| INDEX | `(recipient_id, status)` · `request_id` | ✅ |
| 不足（軽微） | `idempotency_key` UNIQUE なし | ⚠️ fan-out 重複リスク（P5-5 前に追加推奨） |

#### `platform_request_payments`

| 項目 | 内容 | 判定 |
| --- | --- | --- |
| PK | `id` uuid | ✅ |
| FK | `request_id` · `match_id` **ON DELETE RESTRICT** | ✅ 決済履歴保護 |
| UNIQUE | `stripe_checkout_session_id` (partial) | ✅ Webhook 冪等 |
| INDEX | `payer_id` · `match_id` | ✅ |
| 不足（軽微） | `request_id` 単独 INDEX なし | ⚠️ owner 決済一覧で join 依存 |

#### `platform_request_subscriptions`

| 項目 | 内容 | 判定 |
| --- | --- | --- |
| PK | `id` uuid | ✅ |
| UNIQUE | `(user_id, role)` | ✅ poster/receiver 各 1 行 |
| INDEX | `user_id` | ✅ |

### 1.3 Blueprint とのギャップ（軽微 · Staging CRUD には非ブロッカー）

| Blueprint 案 | P5.1 草案 | 影響 |
| --- | --- | --- |
| `expires_at` | なし | 期限切れはアプリ/バッチで後付け可 |
| `talk_thread_id` on matches | なし | Talk 接続（P5-7）前にカラム追加 |
| `idempotency_key` on notifications | なし | fan-out 前に追加推奨 |
| `public_id` | `legacy_local_id` のみ | adapter が uuid URL を生成 |

---

## 2. RLS レビュー

### 2.1 ロール別確認

| ロール | テーブル | 期待 | 草案 | 判定 |
| --- | --- | --- | --- | --- |
| **owner** | `platform_requests` | SELECT/INSERT/UPDATE 自分の行 | `owner_id = auth.uid()` | ✅ |
| **owner** | `platform_requests` | 他人の `closed` は不可 | open ポリシーは `status='open'` のみ · closed は owner ポリシーのみ | ✅ |
| **authenticated** | `platform_requests` | `open` 一覧閲覧 | `platform_requests_select_open` | ✅ |
| **owner** | `matches` | 自依頼のマッチ閲覧 | EXISTS join on `platform_requests` | ✅ |
| **candidate** | `matches` | 自分のマッチ閲覧 | `candidate_id = auth.uid()` AND type ∈ user/worker/freelancer | ⚠️ 一部のみ（§3） |
| **recipient** | `notifications` | 自分宛のみ SELECT | `recipient_id = auth.uid()` | ✅ |
| **payer** | `payments` | 自分の支払い SELECT | `payer_id = auth.uid()` | ✅ |
| **owner** | `payments` | 自依頼の決済 SELECT | EXISTS join on `platform_requests` | ✅ |
| **self** | `subscriptions` | 自分のサブスク SELECT | `user_id = auth.uid()` | ✅ |
| **service_role** | 全テーブル | 全操作 | Supabase 既定 RLS バイパス | ✅ |

### 2.2 RLS ポリシー OR 結合の確認

PostgreSQL は同一コマンドの複数ポリシーを **OR** で評価。

- 依頼者は `select_owner` OR `select_open` → 自分の `closed` も閲覧可 ✅
- 第三者は `select_open` のみ → 他人の `closed` は不可 ✅

### 2.3 意図的に欠落しているポリシー（設計どおり）

| 操作 | 理由 |
| --- | --- |
| DELETE on `platform_requests` | 論理削除（status）のみ想定 |
| INSERT on `matches` / `notifications` / `payments` | service_role / Edge のみ |
| UPDATE on `matches` by candidate | P5-4 で Edge RPC または service_role |

### 2.4 RLS 軽微所見

| # | 所見 | 分類 |
| --- | --- | --- |
| L1 | `platform_requests_update_owner` が status 遷移を制限しない（`cancelled`→`open` 等） | 軽微 — P5-3 adapter でガード可 |
| L2 | `open` 依頼は全 authenticated に本文公開 — 仕様どおりだがプライバシー注意 | 軽微 — 商品設計確認済み |

---

## 3. Builder との整合（将来接続）

### 3.1 既存 Builder スキーマ（参照 · 非変更）

| テーブル | ID 型 | オーナー識別 |
| --- | --- | --- |
| `builder_partners` | `id` uuid | `owner_auth_uid` **text**（`auth.uid()::text`） |
| `builder_workers` | `id` uuid | `owner_auth_uid` **text** |
| `builder_contact_reveals` | — | `user_id` **uuid** |

### 3.2 Platform Request 草案

| カラム | 型 |
| --- | --- |
| `owner_id` | **uuid** |
| `candidate_id` | **uuid**（エンティティ ID） |
| `candidate_type` | text（`builder_partner` / `worker` / …） |

### 3.3 接続シナリオ別の問題点

| candidate_type | candidate_id の意味 | 現 RLS | 問題 |
| --- | --- | --- | --- |
| `user` / `freelancer` | `auth.users.id` | `candidate_id = auth.uid()` | ✅ 問題なし |
| `worker` | **`builder_workers.id`** を入れる場合 | `candidate_id = auth.uid()` | **重大** — RLS 不一致 |
| `worker` | 運用で `auth.uid()` を入れる場合 | 一致 | ✅ MVP 限定で可 |
| `builder_partner` | `builder_partners.id` | candidate ポリシー対象外 | **重大** — 協力会社担当者が SELECT 不可 |
| `company` | 法人エンティティ ID | 対象外 | **重大** — 同上 |
| `listing` | `listings.id` | 対象外 | **重大** — 掲載者が SELECT 不可 |

### 3.4 推奨解決（P5.3 適用前 · SQL 修正案）

**いずれか必須（Staging DDL 適用後でも可）:**

| 案 | 内容 |
| --- | --- |
| **A（推奨）** | `platform_request_matches` に `candidate_owner_id uuid` 追加 + RLS `candidate_owner_id = auth.uid()` |
| **B** | `builder_partner` 用ポリシー: `exists (select 1 from builder_partners p where p.id = candidate_id and p.owner_auth_uid = auth.uid()::text)` |
| **C** | 当該 type は service_role API のみ（クライアント SELECT なし） |

**P5.2 判定:** Staging **CRUD-only 適用**にはブロッカーにならない。**Builder マッチ UI 接続前**に A または B が必須。

### 3.5 owner_id uuid vs Builder text 慣行

| 項目 | 判定 |
| --- | --- |
| Platform `owner_id` uuid | Supabase Auth 標準 · ✅ |
| Builder `owner_auth_uid` text | Calendar/General Jobs 既存慣行 · Platform とは別レーン |
| 横断 join | 直接 FK なし · `auth.uid()` で橋渡し — ✅ 問題なし |

---

## 4. Pricing Catalog 整合

| SKU | catalog | DDL 対応 | 判定 |
| --- | --- | --- | --- |
| `platform_request_match_contact` | ¥550 · fixed · draft | `amount_jpy default 550` · `purpose default 'platform_request_match_contact'` | ✅ |
| `platform_request_user_subscription` | ¥330/月 · draft | `plan_sku` 列 · `role='poster'` | ✅ 構造のみ（P6 接続） |
| `platform_request_receiver_subscription` | ¥550/月 · draft | `plan_sku` 列 · `role='receiver'` | ✅ 構造のみ（P6 接続） |

| 所見 | 分類 |
| --- | --- |
| `plan_sku` に catalog CHECK / FK なし | 軽微 — ランタイム `TasuPricingRuntime` で検証 |
| catalog `enabled: false` — Staging DDL には影響なし | 問題なし |
| `platform_match_general_contact`（別 SKU）との混同 | 問題なし — `purpose` で分離 |

---

## 5. Talk 連携レビュー（設計確認のみ）

### 5.1 接続ポイント

| ステップ | 現草案 | 既存資産 | ギャップ |
| --- | --- | --- | --- |
| **Thread 生成** | `matches.status = talk_started` のみ | `platform-chat-fee.js` threadId · inquiry フロー | `talk_thread_id` 列なし（軽微） |
| **Participant** | `owner_id` + `candidate_id`/`candidate_owner_id` | Talk 公式ルーム · peer messaging | P5-7 で metadata 設計 |
| **Contact reveal** | `platform_request_payments.status = paid` | `builder_contact_reveals` パターン | Platform 専用 reveal 行は未定義（軽微 — payment 台帳で代替可） |
| **通知** | `platform_request_notifications` | `talk_notifications` · `VALID_TYPES` | type `platform_request` 未追加（コード · P5-5） |

### 5.2 推奨 Talk メタデータ（P5-7 実装時）

```text
thread.metadata.source = platform_request
thread.metadata.request_id = uuid
thread.metadata.match_id = uuid
thread.metadata.payment_id = uuid
```

### 5.3 判定

Talk 接続に必要な DDL の **最小セットは P5.1 で充足**（payments + matches status）。  
`talk_thread_id` は P5-7 前の軽微 amendment で足りる。

---

## 6. Store Adapter 移行レビュー

### 6.1 モード設計

| モード | 読み取り | 書き込み | P5.1 DDL 対応 |
| --- | --- | --- | --- |
| **local** | `tasful_platform_requests_v1` | LS のみ | 変更不要 ✅ |
| **supabase** | `platform_requests` | INSERT/UPDATE RLS | `owner_id` = session user ✅ |
| **dual** | DB 優先 · LS フォールバック | 両方 | `legacy_local_id` UPSERT ✅ |

### 6.2 フィールドマッピング

| LS (P2) | DB (P5.1) | 判定 |
| --- | --- | --- |
| `id` (`prq-*`) | `legacy_local_id` + 新 `id` uuid | ✅ adapter が URL 変換 |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | ✅ |
| `photos[]` | `photos` jsonb | ✅ |
| `author` / `source` | DB になし | 軽微 — `source` 列追加は任意 |
| demo `demo-*` | 移行対象外 | ✅ JS 定数維持 |

### 6.3 認証ゲート

| 状態 | 動作 |
| --- | --- |
| 未ログイン | `local` モード継続（P2 テスト互換） |
| ログイン済み | `dual` → `supabase` 切替 |

**判定:** P5.1 DDL は adapter 実装（P5-3）に **ブロッカーなし**。

---

## 7. Migration 順序確認

```text
① DDL（5 tables + helper function + indexes + triggers）
    ↓
② RLS（同一ファイル内 · 10 policies）
    ↓
③ Seed（Staging demo requests / matches — 任意 · P5-3）
    ↓
④ Store Adapter + CRUD（P5-3 · 8788 + Staging）
    ↓
⑤ サーバーマッチ + notifications（P5-4〜5 · candidate_owner_id 修正含む）
    ↓
⑥ Talk thread + deep link（P5-7）
    ↓
⑦ Stripe Checkout + Webhook（P5-6）
```

| 確認 | 判定 |
| --- | --- |
| DDL → RLS の順序（同一トランザクション推奨） | ✅ |
| Seed 前に RLS 必須 | ✅ service_role で seed |
| CRUD 前に Stripe/Talk 不要 | ✅ |
| Builder テーブル変更なし | ✅ |

**Builder 慣行:** DDL と RLS をファイル分割（`migrations` + `manual/*_rls.sql`）も可。Staging 手動適用では **単一ファイル一括**でも可。

---

## 8. リスク一覧

### 問題なし

| # | 項目 |
| --- | --- |
| N1 | PK / FK / CASCADE / RESTRICT の責務分離 |
| N2 | owner / recipient / payer の基本 RLS |
| N3 | service_role バイパス設計 |
| N4 | ¥550 / SKU 名の catalog 整合 |
| N5 | 既存 Builder / Talk / Pricing テーブル非接触 |
| N6 | `legacy_local_id` による LS 移行パス |
| N7 | Production 未適用 · migrations 未登録 |
| N8 | 冪等 DDL（`if not exists` · `drop policy if exists`） |

### 軽微（Staging 適用後・次フェーズ前に対応可）

| # | 項目 | 推奨タイミング |
| --- | --- | --- |
| M1 | `talk_thread_id` 列なし | P5-7 前 |
| M2 | `idempotency_key` on notifications なし | P5-5 前 |
| M3 | `expires_at` on requests なし | P5-4 前後 |
| M4 | owner UPDATE の status 遷移制限なし | P5-3 adapter |
| M5 | `plan_sku` catalog 制約なし | P6 |
| M6 | `payments.request_id` INDEX なし | 負荷見て追加 |
| M7 | `source` / `author` 列なし | adapter で省略可 |

### 重大（Builder マッチ接続前に必須 · CRUD-only では許容）

| # | 項目 | ブロッカー範囲 |
| --- | --- | --- |
| S1 | `builder_partner` / `company` / `listing` 型の candidate RLS 未対応 | P5-4 マッチ UI |
| S2 | `candidate_id = entity.id` と `candidate_id = auth.uid()` の運用曖昧 | P5-4 設計確定 |

**P5.2 結論:** S1/S2 は **Staging DDL 適用自体**にはブロックしない。**P5-4 着手前**に P5.2a SQL amendment 必須。

---

## 9. Staging 適用チェックリスト

### 9.1 適用前

```text
[ ] 対象 Project ref = ahlxuyvhzqdqaojiywmu（Staging）を Dashboard で目視
[ ] Production ref ddojquacsyqesrjhcvmn ではないことを二重確認
[ ] 適用者: 人間承認済み（自動 migration / CI 禁止）
[ ] バックアップ: Staging スキーマ export または PITR 方針確認（Free tier は限定的）
[ ] ロールバック SQL を手元に用意（§9.3）
[ ] 適用ファイル: supabase/platform-request-p5.1-ddl-rls-draft.sql（現行版）
[ ] 既存 platform_request_* テーブルが無いことを確認（再適用時は冪等設計済み）
```

### 9.2 適用後（確認 SQL）

```sql
-- 1) テーブル存在（5 件）
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'platform_request%'
order by table_name;

-- 2) RLS 有効化
select relname, relrowsecurity
from pg_class
where relname like 'platform_request%'
  and relnamespace = 'public'::regnamespace;

-- 3) ポリシー一覧（期待: 10 policies）
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename like 'platform_request%'
order by tablename, policyname;

-- 4) インデックス
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and tablename like 'platform_request%'
order by tablename;

-- 5) 関数
select proname from pg_proc
where proname = 'platform_request_set_updated_at';
```

### 9.3 RLS 手動検証（適用後 · テストユーザー A/B）

```sql
-- ユーザー A: 依頼投稿
-- set role authenticated; set request.jwt.claim.sub = '<user_a_uuid>';
-- insert into platform_requests (owner_id, title, body, category, area, status)
-- values ('<user_a_uuid>', 'Test', 'Body', 'IT・Web', '東京都', 'open');

-- ユーザー B: open 依頼が見える
-- ユーザー B: user_a の closed 依頼が見えない

-- service_role: matches / notifications insert 可能
```

### 9.4 Rollback（Staging のみ · 緊急時）

```sql
-- *** Staging only · データ全削除 ***
drop table if exists public.platform_request_payments cascade;
drop table if exists public.platform_request_notifications cascade;
drop table if exists public.platform_request_matches cascade;
drop table if exists public.platform_request_subscriptions cascade;
drop table if exists public.platform_request_requests cascade; -- typo guard
drop table if exists public.platform_requests cascade;
drop function if exists public.platform_request_set_updated_at() cascade;
```

> 適用順の逆: payments → notifications → matches → subscriptions → requests → function

---

## 10. P5.1 レビュー項目クローズ（P5.1 §6）

| ID | 項目 | P5.2 結果 |
| --- | --- | --- |
| R1 | owner_id / candidate_id と auth.uid() | ✅ owner · ⚠️ candidate 一部（S1） |
| R2 | 他人の closed 非表示 | ✅ |
| R3 | open 依頼の authenticated 閲覧 | ✅ |
| R4 | legacy_local_id UPSERT | ✅ 設計確認 |
| R5 | payments RESTRICT delete | ✅ 意図どおり · 削除 API なし |
| R6 | company 型 candidate 閲覧 | ⚠️ S1 — P5.2a で対応 |
| R7 | 既存 builder/talk 非接触 | ✅ |
| R8 | Production ref ガード | ✅ チェックリスト化 |

---

## 11. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| SQL 適用 | なし ✅ |
| Production | 未接触 ✅ |
| SQL ファイル変更 | なし ✅ |
| DB 変更 | なし ✅ |
| JS / HTML / CSS | 変更なし ✅ |

---

## 12. Go / No-Go 判定

### 12.1 P5.2 レビュー完了

| 項目 | 結果 |
| --- | --- |
| DDL 整合性レビュー | ✅ |
| RLS レビュー | ✅（S1 既知ギャップ） |
| Builder / Catalog / Talk / Adapter 整合 | ✅ |
| Migration 順序 | ✅ |
| リスク分類 | ✅ |
| Staging チェックリスト | ✅ |

### **判定 A: Go — P5.2 レビュー完了**

P5.1 草案はレビュー済み。P5-3（Store Adapter）設計・実装に進行可。

---

### 12.2 Staging SQL 適用可否

| 条件 | 結果 |
| --- | --- |
| Staging ref のみ | ✅ チェックリスト §9.1 |
| CRUD / adapter 検証目的 | ✅ DDL+RLS で十分 |
| Builder マッチ UI まで一括で完結 | ❌ S1 未解決 — P5.2a amendment 後 |
| Production | **No-Go**（10月まで） |

### **判定 B: Conditional Go — Staging 手動適用可**

**適用可の範囲:** Staging `ahlxuyvhzqdqaojiywmu` へ **人間承認 + §9 チェックリスト完了後**、現行 `platform-request-p5.1-ddl-rls-draft.sql` を SQL Editor で手動適用。

**適用時の条件:**

1. Production ref でないことを二重確認
2. §9.2 確認 SQL で 5 テーブル · 10 ポリシーを検証
3. S1（candidate RLS）は **P5-4 前**に P5.2a で修正
4. `supabase/migrations/` への自動登録は **まだ行わない**（手動 Staging のみ）

### **判定 C: No-Go（継続）**

| 項目 | 理由 |
| --- | --- |
| Production Supabase migration | 2026年10月まで禁止 |
| CI / `supabase db push` 自動適用 | 人間承認なし禁止 |
| Builder partner マッチを DDL 適用直後に E2E | S1 未解決のため No-Go |

---

## 13. 次アクション

| 優先 | タスク | Phase |
| --- | --- | --- |
| 1 | Staging 手動適用（§9 チェックリスト） | P5-3 前提 |
| 2 | `PlatformRequestStoreAdapter` 実装 | P5-3 |
| 3 | P5.2a: `candidate_owner_id` + RLS amendment 草案 | P5-4 前 |
| 4 | `test-platform-request-p5-staging.mjs` | P5-3 |

---

## 14. 参照

| ドキュメント | 用途 |
| --- | --- |
| [platform-request-p5.1-ddl-rls-draft.sql](../supabase/platform-request-p5.1-ddl-rls-draft.sql) | レビュー対象 |
| [platform-request-p5.1-ddl-rls-draft.md](./platform-request-p5.1-ddl-rls-draft.md) | P5.1 報告 |
| [platform-request-p5-integration-blueprint.md](./platform-request-p5-integration-blueprint.md) | 全体設計 |
| [docs/supabase-environments.md](../docs/supabase-environments.md) | Staging ref |

---

*Generated: Platform Request P5.2 · review only · SQL not applied*
