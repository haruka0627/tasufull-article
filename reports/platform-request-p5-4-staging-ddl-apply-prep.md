# Platform Request P5-4 — Staging DDL Apply Prep Report

**Date:** 2026-07-05  
**Phase:** P5-4（Staging 手動適用 **準備のみ** · SQL **未実行**）  
**SQL 正本:** `supabase/platform-request-p5.1-ddl-rls-draft.sql`  
**Prior:** P5.2 `reports/platform-request-p5.2-staging-review.md` · P5-3 `reports/platform-request-p5-3-store-adapter.md`

---

## 0. スコープ宣言

| 実施（P5-4） | 未実施 |
| --- | --- |
| SQL 再レビュー | SQL 実行 |
| 適用前チェックリスト | Supabase Migration / CLI apply |
| 適用手順 · 確認SQL · Rollback 整理 | Production 接続 |
| Go / No-Go 判定 | JS / HTML / CSS 変更 |

**DB 接触:** なし（本報告書作成時点）

---

## 1. SQL ファイル再レビュー

**対象:** `supabase/platform-request-p5.1-ddl-rls-draft.sql`（395 行 · DDL + RLS 一体）

### 1.1 ヘッダーコメント

| 項目 | 行 | 確認 |
| --- | --- | --- |
| `DRAFT ONLY / NOT APPLIED` | L4–5 | ✅ |
| Staging ref `ahlxuyvhzqdqaojiywmu` | L8 | ✅ |
| `PRODUCTION 適用禁止` | L10 | ✅ |
| Production ref `ddojquacsyqesrjhcvmn` | L11 | ✅ |
| 10月リリース窓まで Production 禁止 | L12 | ✅ |
| 既存 Builder / Pricing / Talk 非変更 | L16 | ✅ |

### 1.2 作成・変更オブジェクト（Platform Request のみ）

| 種別 | 名前 | 操作 |
| --- | --- | --- |
| **関数** | `public.platform_request_set_updated_at()` | CREATE OR REPLACE |
| **テーブル** | `platform_requests` | CREATE IF NOT EXISTS |
| **テーブル** | `platform_request_matches` | CREATE IF NOT EXISTS |
| **テーブル** | `platform_request_notifications` | CREATE IF NOT EXISTS |
| **テーブル** | `platform_request_payments` | CREATE IF NOT EXISTS |
| **テーブル** | `platform_request_subscriptions` | CREATE IF NOT EXISTS |
| **インデックス** | `platform_*` 系 11 件 | CREATE IF NOT EXISTS |
| **トリガー** | `*_set_updated_at` ×3 | DROP IF EXISTS + CREATE |
| **RLS** | 5 テーブル ENABLE | ALTER TABLE |
| **ポリシー** | 10 件 | DROP IF EXISTS + CREATE |

### 1.3 既存テーブル非接触の確認

| 検索パターン | 結果 |
| --- | --- |
| `builder_` DDL（CREATE/ALTER/DROP） | **0 件**（コメント・CHECK 値 `builder_partner` のみ） |
| `talk_` テーブル DDL | **0 件**（status 値 `talk_started` のみ） |
| `pricing` / Stripe テーブル | **0 件** |
| `listings` / `auth.users` FK | **0 件**（意図的疎結合） |

**判定:** SQL は **Platform Request 専用オブジェクトのみ** 作成。Builder / Talk / Pricing 既存テーブルに **触れない** ✅

### 1.4 冪等性

- `create table if not exists` · `create index if not exists`
- `drop policy if exists` · `drop trigger if exists`
- 再実行時の安全性: **Staging 初回適用・再適用ともに許容設計** ✅

### 1.5 P5.2 既知ギャップ（適用後も継続）

| ID | 内容 | ブロッカー |
| --- | --- | --- |
| S1 | `builder_partner` / `company` / `listing` 型 candidate RLS | DDL 適用自体は可 · マッチ UI 接続前に P5.2a 修正案 |

---

## 2. 環境正本（誤適用防止）

| 環境 | Project Ref | URL | P5-4 |
| --- | --- | --- | --- |
| **Staging（適用可）** | `ahlxuyvhzqdqaojiywmu` | `https://ahlxuyvhzqdqaojiywmu.supabase.co` | ✅ のみ |
| **Production（禁止）** | `ddojquacsyqesrjhcvmn` | `https://ddojquacsyqesrjhcvmn.supabase.co` | ❌ No-Go |

**正本:** [docs/supabase-environments.md](../docs/supabase-environments.md)

### 2.1 Production 誤接続ガード（必須）

適用担当者は **RUN 前に以下をすべて満たすこと:**

```text
[ ] Dashboard URL に ahlxuyvhzqdqaojiywmu が含まれる
[ ] URL に ddojquacsyqesrjhcvmn が含まれない
[ ] Project Settings → General → Reference ID = ahlxuyvhzqdqaojiywmu
[ ] ローカル supabase link の project ref が Production でない（link 使用時）
[ ] .env / MCP が Production ref を指していない
```

**1 項目でも Production に該当 → 即中止（SQL を貼らない）**

---

## 3. 適用前チェックリスト

### 3.1 リポジトリ・レビュー

```text
[ ] SQL ファイル: supabase/platform-request-p5.1-ddl-rls-draft.sql（P5.1 正本）
[ ] P5.2 レビュー完了（Conditional Go）
[ ] P5-3 Store Adapter 完了（local 動作）
[ ] supabase/migrations/ に本 SQL を登録していない（自動適用経路なし）
[ ] npm run db push / supabase db push を実行しない
```

### 3.2 Staging 環境

```text
[ ] 対象 ref: ahlxuyvhzqdqaojiywmu（§2.1 ガード PASS）
[ ] Supabase Dashboard → SQL Editor を開く
[ ] 適用者: 人間承認済み（AI / CI 自動実行禁止）
[ ] 同時に他メンバーが Production SQL を実行していないことを確認
```

### 3.3 適用前 DB 状態（SQL Editor で実行 · 読み取りのみ）

```sql
-- 既存 platform_request_* が無いこと（初回適用想定）
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'platform_request%'
order by table_name;
-- 期待: 0 rows（再適用時は 5 rows — その場合は §6 Rollback を検討）
```

```sql
-- Builder 等が存在すること（環境確認 · 非破壊）
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('builder_projects', 'builder_partners', 'talk_notifications')
order by table_name;
-- 期待: 既存行あり（Staging 構成による）
```

### 3.4 成果物の準備

```text
[ ] 本 SQL 全文をクリップボードにコピー（ファイルパスから直接）
[ ] §5 確認 SQL を別タブに用意
[ ] §6 Rollback SQL を別タブに用意（適用失敗時）
[ ] 適用結果記録用: 本報告書 §8 または P5-5 報告書
```

---

## 4. 適用手順（人間手動 · Staging のみ）

> **P5-4 では実行しない。** 次フェーズ（P5-5 Apply）で担当者が実施。

### Step 1 — Dashboard 接続確認

1. ブラウザで [Supabase Dashboard](https://supabase.com/dashboard) を開く
2. プロジェクト **`tasful-staging`**（ref `ahlxuyvhzqdqaojiywmu`）を選択
3. **Settings → General → Reference ID** が `ahlxuyvhzqdqaojiywmu` であることを目視
4. §2.1 ガード全項目 PASS を記録

### Step 2 — SQL Editor

1. 左メニュー **SQL Editor** → **New query**
2. クエリ名（任意）: `Platform Request P5.1 DDL+RLS Staging`
3. `supabase/platform-request-p5.1-ddl-rls-draft.sql` の **全文** を貼り付け
4. **RUN 前に再度** Reference ID を確認（Production 誤実行防止）

### Step 3 — 実行

1. **Run**（または Ctrl+Enter）
2. エラーなく完了することを確認
3. エラー時: 出力を保存 · §6 Rollback を検討 · **Production では再試行しない**

### Step 4 — 適用後確認

1. §5 の確認 SQL を **順番に** 実行
2. 期待値と照合（§5.2）
3. 結果を P5-5 報告書に追記:
   - 実行日時 · 実行者 · ref 確認スクリーンショット相当の記録
   - 確認 SQL 結果（表件数 · ポリシー数）

### Step 5 — 適用後に行わないこと

```text
✗ Production への同 SQL 実行
✗ supabase/migrations/ への自動登録（別途 P5-5 で判断）
✗ Cloudflare Production env 変更
✗ Stripe Live 設定
```

---

## 5. 確認 SQL（適用後）

### 5.1 テーブル存在（期待: 5 件）

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'platform_request%'
order by table_name;
```

| 期待 table_name |
| --- |
| `platform_request_matches` |
| `platform_request_notifications` |
| `platform_request_payments` |
| `platform_request_subscriptions` |
| `platform_requests` |

### 5.2 RLS 有効化（期待: 5 行 · relrowsecurity = true）

```sql
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'platform_request%'
  and c.relkind = 'r'
order by c.relname;
```

### 5.3 ポリシー（期待: 10 件）

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename like 'platform_request%'
order by tablename, policyname;
```

| tablename | 期待 policy 数 |
| --- | --- |
| `platform_requests` | 4 |
| `platform_request_matches` | 2 |
| `platform_request_notifications` | 1 |
| `platform_request_payments` | 2 |
| `platform_request_subscriptions` | 1 |

### 5.4 インデックス（期待: ≥11）

```sql
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and tablename like 'platform_request%'
order by tablename, indexname;
```

### 5.5 トリガー（期待: 3）

```sql
select tgname, c.relname as table_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'platform_request%'
  and not t.tgisinternal
order by c.relname;
```

| 期待 trigger |
| --- |
| `platform_requests_set_updated_at` |
| `platform_request_matches_set_updated_at` |
| `platform_request_subscriptions_set_updated_at` |

### 5.6 関数（期待: 1）

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'platform_request_set_updated_at';
```

### 5.7 既存テーブル無変更確認（適用後）

```sql
-- builder_projects 等が引き続き存在（DROP されていない）
select count(*) as builder_projects_exists
from information_schema.tables
where table_schema = 'public' and table_name = 'builder_projects';
-- 期待: 1
```

---

## 6. Rollback 方針（Staging 限定）

### 6.1 原則

| 項目 | 方針 |
| --- | --- |
| 対象環境 | **Staging `ahlxuyvhzqdqaojiywmu` のみ** |
| 対象オブジェクト | Platform Request 作成物のみ DROP |
| 既存テーブル | **触れない**（builder_* · talk_* · listings 等） |
| Production | **Rollback も禁止**（そもそも適用しない） |

### 6.2 Rollback SQL（緊急時 · Staging SQL Editor）

```sql
-- ============================================================
-- Platform Request P5.1 — ROLLBACK (Staging ONLY)
-- Project ref MUST be ahlxuyvhzqdqaojiywmu
-- NEVER run on ddojquacsyqesrjhcvmn (Production)
-- ============================================================

drop table if exists public.platform_request_payments cascade;
drop table if exists public.platform_request_notifications cascade;
drop table if exists public.platform_request_matches cascade;
drop table if exists public.platform_request_subscriptions cascade;
drop table if exists public.platform_requests cascade;
drop function if exists public.platform_request_set_updated_at() cascade;
```

**DROP 順:** FK 依存の子 → 親 → 関数

### 6.3 Rollback 後確認

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'platform_request%';
-- 期待: 0 rows
```

---

## 7. 適用結果記録テンプレート（P5-5 用）

| 項目 | 記入欄 |
| --- | --- |
| 実行日時（JST） | _未実施（P5-4）_ |
| 実行者 | |
| Dashboard Reference ID 確認 | `ahlxuyvhzqdqaojiywmu` ☐ |
| SQL 実行結果 | SUCCESS / FAIL |
| テーブル数 | 期待 5 |
| ポリシー数 | 期待 10 |
| RLS 全有効 | ☐ |
| Builder 既存テーブル無事 | ☐ |
| Rollback 要否 | 不要 / 実施 |

---

## 8. 禁止事項遵守（P5-4）

| 項目 | 状態 |
| --- | --- |
| SQL 実行 | なし ✅ |
| DB / MCP 接触 | なし ✅ |
| Production 接続 | なし ✅ |
| JS / HTML / CSS | 変更なし ✅ |
| localStorage | 変更なし ✅ |

---

## 9. Go / No-Go 判定

### 9.1 P5-4 準備完了

| 項目 | 結果 |
| --- | --- |
| SQL 再レビュー（Platform Request のみ） | ✅ |
| Production ガード明記 | ✅ |
| 適用前チェックリスト | ✅ |
| 適用手順（Dashboard 手動） | ✅ |
| 確認 SQL · 期待値 | ✅ |
| Rollback SQL（Staging 限定） | ✅ |
| SQL 未実行 · DB 未接触 | ✅ |

### **判定 A: Go — P5-4 準備完了**

Staging 手動適用の手順・ガード・確認SQL が揃った。次フェーズ（P5-5 Apply）で人間が §2–§4 に従い実行可。

---

### 9.2 Staging 手動適用可否

| 条件 | 判定 |
| --- | --- |
| §2.1 Production ガードを毎回実施 | **Go** |
| 人間承認 + Dashboard SQL Editor のみ | **Go** |
| `supabase db push` / CI 自動適用 | **No-Go** |
| P5.2 S1 未修正のまま Builder マッチ E2E | **No-Go**（DDL 適用自体は可） |

### **判定 B: Conditional Go — Staging 手動適用可**

**条件:** 担当者が §2.1 · §3 · §4 を **すべて** 完了してから RUN。

---

### 9.3 Production

### **判定 C: No-Go — Production 適用禁止（2026年10月まで継続）**

| 項目 | 理由 |
| --- | --- |
| Production ref `ddojquacsyqesrjhcvmn` | リリース窓外 |
| Cloudflare Production | 未接続方針 |
| Stripe Live | 未接続方針 |

---

## 10. 次アクション

| 優先 | タスク | Phase |
| --- | --- | --- |
| 1 | §4 手順で Staging SQL Editor 手動適用 | **P5-5** |
| 2 | §5 確認 SQL 実行 · 結果記録 | P5-5 |
| 3 | Adapter `supabase` mode 実装 | P5-6 |
| 4 | P5.2a `candidate_owner_id` 修正案（マッチ前） | P5-6 並行可 |

---

## 11. 参照

| ドキュメント | 用途 |
| --- | --- |
| [platform-request-p5.1-ddl-rls-draft.sql](../supabase/platform-request-p5.1-ddl-rls-draft.sql) | 適用 SQL |
| [platform-request-p5.2-staging-review.md](./platform-request-p5.2-staging-review.md) | レビュー正本 |
| [platform-request-p5-3-store-adapter.md](./platform-request-p5-3-store-adapter.md) | Adapter 土台 |
| [docs/supabase-environments.md](../docs/supabase-environments.md) | ref 正本 |

---

*Generated: Platform Request P5-4 · apply prep only · SQL not executed*
