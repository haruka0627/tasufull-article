# Business Directory Production Step 1 — Supabase Migration Apply

**日付:** 2026-06-27  
**種別:** staging migration apply · 検証（Edge / Stripe / Pages **未実施**）  
**Project ref:** `ddojquacsyqesrjhcvmn`（linked Supabase）

---

## 結論

| 項目 | 結果 |
| --- | --- |
| **Phase 1 schema** | ✅ 適用済 |
| **Phase 1 seed** | ✅ 適用済 |
| **Phase 6 stripe columns** | ✅ 適用済 |
| **Remote 検証** | ✅ **22/22 PASS**（1 NOTE: migration history 未記録） |
| **Migration history** | ⚠️ **未記録** — `migration repair` 要（下記） |
| **Marketplace `listings`** | ✅ 存在維持 · BD migration は non-touch |

---

## 適用手順（実施済）

`supabase db push` は履歴ドリフト（partner 以降の未記録 migration 多数）のため **不可**。  
BD 3 本を **順番どおり直接 apply**:

```bash
npx supabase db query --linked -f supabase/migrations/20260711100000_business_directory_phase1_schema.sql
npx supabase db query --linked -f supabase/migrations/20260711100001_business_directory_phase1_seed.sql
npx supabase db query --linked -f supabase/migrations/20260712100000_business_directory_phase6_stripe_subscription.sql
```

---

## Migration history 追記（要手動）

SQL apply 後、`schema_migrations` に BD 3 版本が **未登録**。  
今後の `db push` 整合のため **運営確認のうえ** 実行:

```bash
npx supabase migration repair --status applied 20260711100000
npx supabase migration repair --status applied 20260711100001
npx supabase migration repair --status applied 20260712100000
```

---

## 履歴ドリフト（既知）

Remote `schema_migrations` 最終: `20260630100001`（partner）のみ記録。  
Match / Live 等は **スキーマ存在・migration 未記録** の状態。  
BD apply とは独立 — 別途 drift 整理 Epic 推奨。

---

## Remote 検証 SQL

```sql
-- tables + view
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'business_directory%'
order by 1;

-- phase6 columns
select column_name from information_schema.columns
where table_name = 'business_directory_listings'
  and column_name in ('stripe_price_id','subscription_status','current_period_end','cancel_at_period_end','plan_changed_at');

-- seed
select plan_code from business_directory_plan_features order by 1;
select listing_type, count(*) from business_directory_categories group by 1;
```

### 結果サマリー（2026-06-27 apply 後）

| チェック | 結果 |
| --- | --- |
| BD tables | 11（`information_schema.tables` · `business_directory%`） |
| public view | `business_directory_listings_public` |
| RLS | 全 BD テーブル `relrowsecurity=true` |
| plan_features | free · standard · pro · premium |
| categories | shop_retail ×4 · business_service ×4 |
| phase6 columns | 7 列（phase1 stripe_* + phase6 5 列） |

---

## テスト

```bash
node scripts/test-business-directory-production-step1-migration.mjs          # 16/16 PASS
node scripts/test-business-directory-production-step1-migration.mjs --remote # 22 pass · 0 fail · 1 note (2026-06-27)
```

**NOTE:** Windows では `supabase db query` の SQL 引数が shell 経由で壊れるため、リモート検証は一時 `.sql` + `-f` で実行（スクリプト内対応済）。

---

## 次ステップ（Production Step 2 以降 · 未着手）

1. `migration repair`（上記 3 版本）
2. Edge deploy: `business-directory` · `stripe-webhook`（別指示）
3. Stripe secrets / webhook（別指示）
4. Pages production deploy（別指示）

---

## 参照

- [business-directory-phase1-db.md](./business-directory-phase1-db.md)
- [business-directory-phase7-deploy-preflight.md](./business-directory-phase7-deploy-preflight.md)
- [business-directory-data-model-design.md](../docs/business-directory-data-model-design.md)
