# TASFUL MATCH — P15-L1 pre-gates 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`**（linked ref） |
| 実行 SQL | `sql/match-p15-l1-pre-gates.sql` |
| 判定 | **`PASS`** |
| 次アクション | schema / RLS 適用は **承認待ち**（本 PASS 後も自動適用しない） |

---

## 1. 実行コマンド

```bash
npx supabase db query --linked --yes -f sql/match-p15-l1-pre-gates.sql
```

**CLI:** Supabase CLI v2.101.0 · exit code **0**

---

## 2. Gate 結果

| Gate | 期待 | 実測 | 結果 |
|------|------|------|------|
| legacy 7 | **7** | **7** | **PASS** |
| allowlist 5 | **5** | **5** | **PASS** |
| Hook EXCEPTION | **1** | **1**（`hook_func_count=1`） | **PASS** |
| core 8 | **8** | **8** | **PASS** |
| RLS 8 | **8** | **8** | **PASS** |
| policies 20 | **20** | **20** | **PASS** |
| P15 新表 0 | **0** | **0** | **PASS** |

### 2.1 補助 gate（pre-gates 同梱）

| 指標 | 期待 | 実測 | 結果 |
|------|------|------|------|
| `p15_public_view_count` | **0** | **0** | **PASS** |
| `p15_function_count` | **0** | **0** | **PASS** |
| `last_active_at_exists` | **1** | **1** | **PASS** |
| `t6_user_count` | **0** | **0** | **PASS** |

---

## 3. 生データ（combined row）

```json
{
  "legacy_user_count": 7,
  "allowlist_backfill_count": 5,
  "hook_func_count": 1,
  "hook_exception_mode": 1,
  "core_table_count": 8,
  "core_rls_enabled_count": 8,
  "core_policy_count": 20,
  "p15_table_count": 0,
  "p15_public_view_count": 0,
  "p15_function_count": 0,
  "last_active_at_exists": 1,
  "t6_user_count": 0
}
```

---

## 4. FAIL 時の原因

**該当なし** — 全 gate PASS。

---

## 5. 判定と次ステップ

| 項目 | 内容 |
|------|------|
| **総合判定** | **`PASS`** |
| schema 適用 | **未実施** · 承認後に `20260622190000_match_p15_l1_schema.sql` |
| RLS 適用 | **未実施** · 承認後に `20260622191000_match_p15_l1_rls.sql` |
| 本番 URL | **`tasful.jp` 確認は 8 月まで保留** |

**承認後の適用コマンド（参考 · 未実行）:**

```bash
npx supabase db query --linked --yes -f supabase/migrations/20260622190000_match_p15_l1_schema.sql
npx supabase db query --linked --yes -f supabase/migrations/20260622191000_match_p15_l1_rls.sql
```

---

## 6. 参照

| 文件 | 路径 |
|------|------|
| Pre-gates SQL | `sql/match-p15-l1-pre-gates.sql` |
| Schema migration | `supabase/migrations/20260622190000_match_p15_l1_schema.sql` |
| RLS migration | `supabase/migrations/20260622191000_match_p15_l1_rls.sql` |
| ファイル作成記録 | `reports/tasful-match-p15-l1-files-created.md` |
