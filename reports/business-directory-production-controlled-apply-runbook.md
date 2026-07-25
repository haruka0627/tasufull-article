# Business Directory — Production Controlled Apply Runbook

**日付:** 2026-07-01  
**種別:** Production controlled migration · **手順書のみ（本 runbook 作成時点では未実行）**  
**Project ref:** `ddojquacsyqesrjhcvmn`（Production Supabase · `tasful-ai`）  
**目的:** Business Directory を **Production Ready** に向け、欠落している依存 migration 2 本を安全に apply する

> **ステータス（2026-07-01）:** Production Controlled Apply **完了** · [結果正本](./business-directory-production-controlled-apply-result.md) · DB Production Ready **Go** · Commercial Launch **Conditional**  
> **注:** §0 一部表記は apply **前** の runbook 原稿（手順再現用）。現状 Production DB は result 正本を参照。

---

## 0. Executive summary

| 項目 | 内容 |
| --- | --- |
| **現状ブロッカー** | Production DB に `20260715110000` · `20260716100000` **未適用** |
| **Phase 2a** | `20260717120000` **適用済** · Edge Phase 2 **deploy 済** |
| **apply 方針** | `15110000` = **partial apply（view 除外）** · `16100000` = **full apply** |
| **Edge redeploy** | **不要**（DB のみ） |
| **適用可否** | **Conditional Go** — partial apply 正本に従えば Phase 2a regress 回避可能 |
| **Production Ready（apply 前）** | **Not Ready** |
| **Production Ready（apply + smoke 後）** | 主要 smoke PASS + view 6 列維持 → **再判定 Go 可能** |

**正本 SQL（15110000 partial）:** [reports/sql/business-directory-15110000-partial-apply.sql](../reports/sql/business-directory-15110000-partial-apply.sql)

**関連監査:**

- [business-directory-dependent-migrations-production-readiness.md](./business-directory-dependent-migrations-production-readiness.md)
- [business-directory-dependency-migration-audit.md](./business-directory-dependency-migration-audit.md)
- [business-directory-phase2a-production-controlled-migration.md](./business-directory-phase2a-production-controlled-migration.md) — Phase 2a 適用済記録
- [docs/supabase-environments.md](../docs/supabase-environments.md)

---

## 1. 背景

### 1.1 なぜ apply が必要か

Production には Phase 2a（`20260717120000`）が先行適用されているが、依存 migration 2 本が未適用のため以下が欠落している:

| 欠落オブジェクト | 影響 |
| --- | --- |
| `business_directory_pending_updates` | owner detail · published 編集 · `content_update` |
| `review_requests.published_snapshot_json` | `content_update` 監査スナップショット |
| `business_directory_ai_draft_usage_daily` | AI 下書き quota テーブル |
| `consume_business_directory_ai_draft_quota` | `generate_listing_draft` |

**Edge は deploy 済** — 失敗原因は **DB オブジェクト欠落のみ**。

### 1.2 なぜ partial apply が必要か（クリティカル）

`20260715110000` の migration ファイルには `CREATE OR REPLACE VIEW business_directory_listings_public` が含まれる。  
この view 定義は **Phase 2a 以前**（SEO/FAQ 列なし）。

| 適用方法 | 結果 |
| --- | --- |
| `15110000` **ファイル丸ごと** | Phase 2a public view **regress** — `seo_title` 等 6 列消失 |
| `15110000` **partial（view SKIP）** | pending + column + RLS のみ — **安全** |
| `16100000` **full** | view 変更なし — **安全** |

Phase 2a view は既に `content_update` 可視性ルールを含むため、view ブロックの skip は **機能欠落なし**。

### 1.3 Partial Apply SQL との整合（監査済）

| partial snippet ブロック | 元 migration 行 | 整合 |
| --- | --- | --- |
| `[A]` pending_updates table | 4–8 | ✅ 一致 |
| `[B]` table comment | 10–11 | ✅ |
| `[C]` index | 13–14 | ✅ |
| `[D]` published_snapshot_json | 16–17 | ✅ |
| `[E]` column comment | 19–20 | ✅ |
| `[F]` RLS enable | 48 | ✅ |
| `[G]` revoke/grant | 50–51 | ✅ |
| `[SKIP-1]` CREATE OR REPLACE VIEW | 22–43 | ✅ 意図的除外 |
| `[SKIP-2]` COMMENT ON VIEW | 45–46 | ✅ 意図的除外 |

snippet に **含まれないもの**（元 migration にも無し）: triggers · functions · named RLS policies on pending_updates。

**16100000:** migration ファイル **全文** apply — snippet 不要 · view 変更なし。

---

## 2. 対象 migration

| 順序 | Version | ファイル | Apply 方式 |
| --- | --- | --- | --- |
| 1 | `20260715110000` | `supabase/migrations/20260715110000_business_directory_content_update.sql` | **Partial** — [snippet](../reports/sql/business-directory-15110000-partial-apply.sql) の DDL ブロックのみ（行 68–113） |
| 2 | `20260716100000` | `supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql` | **Full** — ファイル全体 |
| — | `20260717120000` | `…_business_directory_page_content_phase2a.sql` | **適用済 · 再実行しない** |

### 2.1 Production 接続先（再確認）

| 項目 | 値 |
| --- | --- |
| **Production ref** | `ddojquacsyqesrjhcvmn` |
| **Staging ref（触らない）** | `ahlxuyvhzqdqaojiywmu` |
| **URL** | `https://ddojquacsyqesrjhcvmn.supabase.co` |
| **Edge base** | `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1` |
| **ガード定数** | `BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn` |

---

## 3. ロール分担

| ロール | 責務 |
| --- | --- |
| **Ops / DBA** | ref 確認 · backup · SQL apply · migration repair · rollback 判断 |
| **Engineering** | smoke 実行 · 失敗調査 · apply 記録 |
| **QA** | smoke 結果 · Production Ready 再判定 |
| **Product** | Production DB 変更承認 · Go/No-Go 最終判断 |

**Agents / CI:** migration · remote SQL · deploy **自動実行禁止**（AD-007 · 本 runbook 方針）

---

## 4. 適用前チェックリスト（全項目必須）

実施者: _______________ · 日時: _______________ · すべて ✅ で Step 5 へ

### 4.1 接続先 · 環境

- [ ] **P1** Supabase Dashboard → Settings → General → Reference ID = **`ddojquacsyqesrjhcvmn`**
- [ ] **P2** CLI link 確認: `supabase/.temp/project-ref` または `npx supabase migration list --linked` が **Production ref**
- [ ] **P3** Staging ref `ahlxuyvhzqdqaojiywmu` に **link していない**
- [ ] **P4** `.env` に Production `SUPABASE_*` · `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` · `BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn`
- [ ] **P5** `supabase db push` で **15110000 丸ごと** apply する計画が **ない**（No-Go N1）

### 4.2 DB 前提状態（apply 前 SELECT · 記録推奨）

- [ ] **P6** `20260717120000` が `schema_migrations` に **存在**
- [ ] **P7** `20260715110000` · `20260716100000` が `schema_migrations` に **未登録**
- [ ] **P8** `business_directory_pending_updates` テーブル **不存在**
- [ ] **P9** `published_snapshot_json` 列 **不存在**（`review_requests`）
- [ ] **P10** Phase 2a view 列 **6 件存在**（`short_description`, `full_description`, `seo_title`, `meta_description`, `faq_items`, `recommended_uses`）
- [ ] **P11** `consume_business_directory_ai_draft_quota` RPC **不存在**

**P6–P11 確認 SQL（SELECT のみ · 記録用）:**

```sql
-- migration history (BD)
select version, name from supabase_migrations.schema_migrations
where version in ('20260715110000','20260716100000','20260717120000')
order by version;
-- Expected: 17120000 only

-- pending_updates absent
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'business_directory_pending_updates'
) as pending_exists;
-- Expected: false

-- Phase 2a view columns (6)
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'business_directory_listings_public'
  and column_name in (
    'short_description','full_description',
    'seo_title','meta_description','faq_items','recommended_uses'
  )
order by column_name;
-- Expected: 6 rows

-- RPC absent
select exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'consume_business_directory_ai_draft_quota'
) as rpc_exists;
-- Expected: false
```

### 4.3 Edge · アプリ

- [ ] **P12** Edge `business-directory` が Production に **Phase 2 対応版 deploy 済**（redeploy 不要）
- [ ] **P13** [business-directory-dependency-migration-audit.md](./business-directory-dependency-migration-audit.md) レビュー済
- [ ] **P14** [partial apply snippet](../reports/sql/business-directory-15110000-partial-apply.sql) を DBA/Ops が読了 · **view SKIP** を理解

### 4.4 運用 · 承認 · backup

- [ ] **P15** Maintenance window 開始/終了を決定 · 関係者通知
- [ ] **P16** 作業担当 · rollback 承認者（Ops + DBA）指名
- [ ] **P17** Backup / dump 方針確認（Free · **PITR なし** — §9 参照）
- [ ] **P18** §5.1 apply 前 schema スナップショット保存
- [ ] **P19** Product/Ops **Production DB 変更承認**
- [ ] **P20** Staging リハーサル完了 **または** リスク受容の NOTE（推奨: Staging で partial + full 済）

### 4.5 ローカル静的確認（DB 非接触 · apply 前推奨）

```powershell
cd c:\Users\rubih\tasufull-article
node scripts/test-business-directory-content-update.mjs
node scripts/test-business-directory-ai-draft-phase1b-edge.mjs
```

期待: **15/15** · **27/27** PASS

---

## 5. Production 適用手順（時系列）

> **警告:** 以下は maintenance window 内の **人手作業** のみ。  
> Step 5.2–5.4 は **Production DB を変更** する。

### 5.0 タイムライン概要

```text
T-24h   事前チェック §4 · backup 方針 · 承認
T-1h    schema スナップショット §5.1 · 最終 ref 目視
T+0     Step 5.2  15110000 partial apply
T+5m    Step 5.3  partial VERIFY（SELECT）
T+10m   Step 5.4  16100000 full apply
T+15m   Step 5.5  full VERIFY（SELECT）
T+20m   Step 5.6  migration repair ×2
T+30m   Step 6     smoke tests
T+60m   Step 7     Go / No-Go · 記録 §10
```

### 5.1 apply 前スナップショット（SELECT のみ · 必須）

SQL Editor または read-only `db query` で結果を **チケットに保存**:

```sql
-- view 定義（rollback / regress 検知用）
select pg_get_viewdef('public.business_directory_listings_public'::regclass, true);

-- profiles 列
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'business_directory_profiles'
order by ordinal_position;

-- BD migration history
select version, name from supabase_migrations.schema_migrations
where version >= '20260711100000' order by version;
```

### 5.2 Step 1 — `20260715110000` partial apply

**実行する SQL:** [reports/sql/business-directory-15110000-partial-apply.sql](../reports/sql/business-directory-15110000-partial-apply.sql) の **実行可能 DDL のみ**（コメント行 68–113 · ブロック `[A]`–`[G]`）

**実行してはいけないもの:**

- 同ファイル内 `[SKIP-1]` / `[SKIP-2]` に相当する view SQL
- `supabase/migrations/20260715110000_…sql` **ファイル丸ごと**
- `supabase db push`（15110000 を view 含めて適用する恐れ）

**推奨実行方法（いずれか · DBA 判断）:**

```powershell
# 方法 A: Supabase Dashboard → SQL Editor（snippet DDL を貼付 · 目視確認後 Run）

# 方法 B: CLI（Production link 確認後）
npx supabase link --project-ref ddojquacsyqesrjhcvmn --yes
npx supabase db query --linked -f reports/sql/business-directory-15110000-partial-apply.sql
# ※ VERIFY / ROLLBACK コメントブロックは実行されないよう、DDL 部分のみ貼付推奨
```

**記録:** 実行者 · 時刻 · 実行方法 · エラー有無

### 5.3 Step 2 — partial apply 直後 VERIFY（SELECT のみ · 必須）

[snippet § VERIFY](../reports/sql/business-directory-15110000-partial-apply.sql) の **チェック 1–8** を実行。

**最低限（すべて PASS するまで Step 5.4 へ進まない）:**

| # | 確認 | Expected |
| --- | --- | --- |
| V1 | `pending_updates` 存在 | true |
| V2 | `published_snapshot_json` 列 | 1 row |
| V3 | Phase 2a view **6 列** | **6 rows** |
| V4 | view に `review_requested` + `published_at` 述語 | true |

**V3 が 6 未満 → 即停止** — §8.2 緊急 view 回復を検討（full 15110000 誤 apply の疑い）

### 5.4 Step 3 — `20260716100000` full apply

**実行する SQL:** migration ファイル **全文**

```powershell
npx supabase db query --linked -f supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql
```

または Dashboard SQL Editor にファイル全文を貼付。

**期待されるオブジェクト:**

- `business_directory_ai_draft_usage_daily` テーブル
- `idx_bd_ai_draft_usage_daily_date` インデックス
- RLS + policy `bd_ai_draft_usage_daily_deny_all`
- RPC `consume_business_directory_ai_draft_quota(uuid, text, integer)`
- `GRANT EXECUTE` to `service_role`

### 5.5 Step 4 — full apply 直後 VERIFY（SELECT のみ）

```sql
-- RPC exists
select exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'consume_business_directory_ai_draft_quota'
) as rpc_exists;
-- Expected: true

-- quota table + policy
select tablename from pg_tables
where schemaname = 'public' and tablename = 'business_directory_ai_draft_usage_daily';

select polname from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'business_directory_ai_draft_usage_daily';
-- Expected: bd_ai_draft_usage_daily_deny_all

-- Phase 2a view 6 columns still present (re-check)
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'business_directory_listings_public'
  and column_name in (
    'short_description','full_description',
    'seo_title','meta_description','faq_items','recommended_uses'
  );
-- Expected: 6
```

### 5.6 Step 5 — migration history 整合（DBA 判断）

DDL 成功 · VERIFY PASS 後、CLI history を整合:

```powershell
npx supabase migration repair --status applied 20260715110000
npx supabase migration repair --status applied 20260716100000
npx supabase migration list --linked
```

**期待:** Local/Remote に `20260715110000` · `20260716100000` · `20260717120000` が揃う。

**注意:** `repair` は history メタデータのみ — DDL 失敗時に repair しない。

### 5.7 Step 6 — Edge deploy

**不要。** Phase 2 Edge は deploy 済。本 apply は DB のみ。

---

## 6. 適用後 Smoke Test 手順

apply 完了 · VERIFY PASS · migration repair 後に実施。

### 6.1 環境準備

```powershell
cd c:\Users\rubih\tasufull-article

# Production .env（SUPABASE_* · AUTH_HOOK_L2_ALLOWLIST_PASSWORD · BD_PRODUCTION_PROJECT_REF）
# CLI link = ddojquacsyqesrjhcvmn

# 8788 browser テスト用（任意 · --skip-browser で省略可）
npm run dev
# netstat -ano | findstr 8788 → LISTEN 確認
```

### 6.2 自動 smoke（必須 · 順序固定）

| # | コマンド | 合格基準 | 備考 |
| --- | --- | --- | --- |
| **S1** | `node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote` | **21/21 PASS** | Phase 2a 列維持 · staging guard は Production link 時に OK |
| **S2** | `node scripts/test-business-directory-phase2a-production-smoke.mjs --skip-stripe` | **≥19 pass · 0 fail**（NOTE 可） | apply 前実績: 14 pass / 6 fail |
| **S3** | `node scripts/test-business-directory-production-step2-edge.mjs --remote` | health + public API **200** | Edge 回帰 |

**S2 で apply 後 PASS 期待（apply 前 FAIL だった項目）:**

| チェック | apply 前原因 |
| --- | --- |
| `AI generate_listing_draft` | RPC/表なし |
| `get_owner_listing_detail` | pending 表なし |
| `published update_draft_listing` | pending 表なし |
| `submit content_update` / approve chain | 同上 |
| `content_update live updated` | approve 未到達 |

**S2 で DB 外として NOTE 許容:**

| チェック | 原因 |
| --- | --- |
| Free public short visible（browser） | `public/detail.html` config 未読込 |
| Standard+ rich | `--skip-stripe` · plan=free |
| 8788 browser planGate | 同上 · config |

**S2 実行例:**

```powershell
$env:BD_PRODUCTION_PROJECT_REF = "ddojquacsyqesrjhcvmn"
node scripts/test-business-directory-phase2a-production-smoke.mjs --skip-stripe
# browser 省略: --skip-browser 追加
```

### 6.3 人手 E2E（推奨 · 8788）

1. Owner: AI 下書き生成 → 反映 → 保存
2. 新規 draft → Phase 2 フィールド → 公開申請 → Ops approve → public detail
3. Published listing → 編集 → pending → **内容更新を申請** → approve → public 更新確認
4. Ops: admin 審査キューで `content_update` 行の表示

### 6.4 Smoke 結果記録

| テスト | Pass | Fail | Note | 実行者 | 時刻 |
| --- | --- | --- | --- | --- | --- |
| S1 readiness `--remote` | | | | | |
| S2 production-smoke | | | | | |
| S3 step2-edge | | | | | |
| 人手 E2E | | | | | |

---

## 7. Go / No-Go 判定

### 7.1 Apply 実施前 Go（§4 すべて ✅ + 以下）

| # | 条件 |
| --- | --- |
| **G1** | Dashboard / CLI ref = `ddojquacsyqesrjhcvmn` |
| **G2** | Backup / dump 方針確認済 |
| **G3** | partial apply snippet 理解 · **view SKIP** 徹底 |
| **G4** | Phase 2a 6 列の post-apply VERIFY 手順準備 |
| **G5** | Maintenance window · rollback §8 レビュー済 |
| **G6** | Edge Phase 2 deploy 済（redeploy 不要） |
| **G7** | Product/Ops Production DB 変更承認 |
| **G8** | Staging リハーサル済 **または** リスク NOTE 記録 |

**Apply 前判定:** 上記すべて ✅ → **Go（apply 開始可）**

### 7.2 Apply 実施前 No-Go（いずれかで中止）

| # | 条件 |
| --- | --- |
| **N1** | `15110000` を view 含む **丸ごと** apply しようとしている |
| **N2** | ref 不一致（Staging link · 別 project） |
| **N3** | rollback 手順未レビュー |
| **N4** | Phase 2a 6 列が apply 前から欠落 |
| **N5** | backup / dump 方針 **未確認** |
| **N6** | `17120000` 未適用（Phase 2a 未完了） |

### 7.3 Apply 完了後 Go（Production Ready 再判定）

| # | 条件 | 必須 |
| --- | --- | --- |
| **PG1** | partial VERIFY V1–V4 PASS | ✅ |
| **PG2** | full VERIFY（RPC + view 6 列）PASS | ✅ |
| **PG3** | S1 readiness `--remote` **21/21** | ✅ |
| **PG4** | S2 smoke **≥19 pass · 0 fail**（content_update / AI 系） | ✅ |
| **PG5** | Phase 2a view 6 列 **維持** | ✅ |
| **PG6** | migration repair 完了 · list 整合 | ✅ |
| **PG7** | 8788 browser / planGate / Stripe | 別 Epic（Commercial Launch） |

**Production Ready 再判定:**

| 結果 | 条件 |
| --- | --- |
| **Go（BD DB 依存解消）** | PG1–PG6 すべて ✅ |
| **Conditional Go** | PG1–PG6 ✅ だが PG7 未了 — **Commercial Launch は別判断** |
| **No-Go** | PG4 主要 FAIL · view regress · rollback 実施 |

---

## 8. Rollback 判断条件

> Rollback DDL は **destructive**。実行前に **Ops + DBA 承認** · backup 取得必須。  
> 本章は **判断基準** と **例示 SQL**（コメントアウト）のみ。

### 8.1 いつ rollback を検討するか

| 状況 | 深刻度 | 推奨 action |
| --- | --- | --- |
| partial VERIFY **V3**（view 6 列）FAIL | **Critical** | apply **直後停止** · §8.3 緊急 view 回復 |
| S2 の content_update / AI 系が **多数 FAIL** | High | 原因調査 · 16100000 のみ rollback 検討 · 15110000 は維持可 |
| S2 Phase 2a 列 regress（public API） | **Critical** | §8.3 view 回復 · 15110000 full 誤 apply 疑い |
| 本番 listing データ破損 | **Critical** | dump リストア検討 · incident |
| quota RPC のみ問題 | Medium | 16100000 rollback（§8.4） |
| browser / Stripe / config 失敗のみ | Low | **rollback 不要** — DB 外 |

### 8.2 rollback **不要** なケース

- `public/detail.html` に `chat-supabase-config.js` 未読込
- `--skip-stripe` による Standard+ チェック skip
- 8788 未起動による browser skip
- テスト用 L7 ユーザー不足（Auth 設定 · DB migration 外）

### 8.3 緊急 — Phase 2a view regress（full 15110000 誤 apply）

**症状:** VERIFY V3 が 6 未満 · public API から Phase 2 列消失

**回復（view のみ · pending DDL は維持）:**

`supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql` の **行 21–52**（DROP VIEW + CREATE VIEW + GRANT）を再実行。

詳細: [snippet EMERGENCY 節](../reports/sql/business-directory-15110000-partial-apply.sql)

### 8.4 rollback 例示（実行禁止 · 承認後のみ）

**16100000 のみ（quota 問題）:**

```sql
-- EXAMPLE ONLY — DO NOT RUN without DBA approval
-- drop function if exists public.consume_business_directory_ai_draft_quota(uuid, text, integer);
-- drop table if exists public.business_directory_ai_draft_usage_daily;
-- npx supabase migration repair --status reverted 20260716100000
```

**15110000 partial のみ（content_update 問題 · view は触らない）:**

```sql
-- EXAMPLE ONLY — DO NOT RUN without DBA approval
-- drop table if exists public.business_directory_pending_updates;
-- alter table public.business_directory_review_requests
--   drop column if exists published_snapshot_json;
-- npx supabase migration repair --status reverted 20260715110000
```

**データ損失:**

| rollback 対象 | 失われるデータ |
| --- | --- |
| pending_updates | 進行中 content_update 草稿 |
| published_snapshot_json | 監査スナップショット（列 drop 時） |
| ai_draft_usage_daily | 当日 quota カウント |

**Phase 2a view / profiles 列:** partial apply では **変更しない** — rollback でも view SSOT は `17120000` を維持。

### 8.5 rollback 判断フロー

```text
VERIFY V3 < 6 ?
  YES → 緊急 view 回復 §8.3（pending は維持可）
  NO  → S2 content_update/AI FAIL ?
          YES → ログ調査 → 16100000 rollback 検討 → 再 smoke
          NO  → PG7 のみ FAIL ?
                  YES → rollback 不要 · 別 Epic
                  NO  → Go 記録 §10
```

---

## 9. Backup / PITR

| 項目 | Production 現状 |
| --- | --- |
| Plan | Free（doc 記載） |
| PITR | **なし** |
| 最低限 | §5.1 schema スナップショット · Dashboard export 方針 · §8 rollback レビュー |

**No-Go:** backup / dump 方針 **未確認** のまま apply 開始

---

## 10. Apply 記録テンプレート

```text
=== Business Directory Production Controlled Apply ===
Date:
Window:
Operator (SQL):
Operator (Smoke):
Approver:

Pre-check §4: ALL PASS [ ]
Ref verified: ddojquacsyqesrjhcvmn [ ]

Step 5.2 partial 15110000: SUCCESS [ ] FAIL [ ] notes:
Step 5.3 VERIFY partial: V1-V4 PASS [ ]
Step 5.4 full 16100000: SUCCESS [ ] FAIL [ ]
Step 5.5 VERIFY full: PASS [ ]
Step 5.6 migration repair: DONE [ ]

S1: __/21
S2: __ pass / __ fail / __ notes
S3: PASS [ ] FAIL [ ]

Post-apply Go/No-Go: GO [ ] CONDITIONAL [ ] NO-GO [ ]
Production Ready (BD DB): GO [ ] NOT READY [ ]

Rollback executed: NO [ ] YES [ ] reason:
Incident ticket:
```

---

## 11. 関連ファイル

| ファイル | 役割 |
| --- | --- |
| [reports/sql/business-directory-15110000-partial-apply.sql](../reports/sql/business-directory-15110000-partial-apply.sql) | **Partial apply 正本** |
| `supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql` | Full apply #2 |
| `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql` | View SSOT（適用済） |
| [business-directory-dependent-migrations-production-readiness.md](./business-directory-dependent-migrations-production-readiness.md) | 適用前監査 |
| [business-directory-dependency-migration-audit.md](./business-directory-dependency-migration-audit.md) | オブジェクト監査 |
| `scripts/test-business-directory-phase2a-production-smoke.mjs` | Apply 後 smoke |
| `scripts/test-business-directory-phase2a-staging-readiness.mjs` | Remote readiness |
| `scripts/test-business-directory-production-step2-edge.mjs` | Edge smoke |

---

## 12. 本 runbook ステータス

| Item | Status |
| --- | --- |
| Runbook 完成 | ✅ 本ファイル |
| Partial snippet 整合 | ✅ §1.3 |
| 適用前チェックリスト | ✅ §4 |
| 時系列手順 | ✅ §5 |
| Smoke 手順 | ✅ §6 |
| Go / No-Go | ✅ §7 |
| Rollback 判断 | ✅ §8 |
| Production apply 実行 | ✅ **完了**（2026-07-01 · [result](./business-directory-production-controlled-apply-result.md)） |
| Production Ready（DB 依存） | ✅ **Go** — Commercial Launch は **Conditional** |

---

*本 runbook は Production controlled apply の実行正本です。Agents は migration / remote SQL / deploy を自動実行しません。*
