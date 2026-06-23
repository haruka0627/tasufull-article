# TASFUL MATCH — P15-L1 ファイル作成記録

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-21** |
| 前提 | [`tasful-match-p15-l1-migration-draft.md`](tasful-match-p15-l1-migration-draft.md) **承認済み** |
| 状態 | **ファイル作成のみ · SQL 未適用 · Edge/UI 未着手** |
| 本番 URL | **`tasful.jp` 確認は 8 月まで保留** |

---

## 1. 作成ファイル

| # | パス | 用途 |
|---|------|------|
| 1 | `sql/match-p15-l1-pre-gates.sql` | 適用前 READ-ONLY gate（単一行） |
| 2 | `supabase/migrations/20260622190000_match_p15_l1_schema.sql` | DDL · 関数 · VIEW |
| 3 | `supabase/migrations/20260622191000_match_p15_l1_rls.sql` | 新規 6 表 RLS · 14 policies |
| 4 | `reports/tasful-match-p15-l1-files-created.md` | 本記録 |

---

## 2. 準拠確認（ドラフト対照）

| 要件 | 対応 |
|------|------|
| legacy 7 gate | pre-gates `legacy_user_count` = **7** |
| allowlist 5 gate | `allowlist_backfill_count` = **5** · talk/member = t1–t5 |
| Hook EXCEPTION gate | `hook_exception_mode` = **1** |
| core 8 / RLS 8 / policies 20 | `core_table_count` · `core_rls_enabled_count` · `core_policy_count` |
| P15 新表 0 gate | `p15_table_count` = **0** · `p15_public_view_count` = **0** |
| rollback コメント | 各 migration 末尾に ROLLBACK ブロック（コメント） |
| idempotent 寄り | `if not exists` · `drop … if exists` · `on conflict do nothing` |
| 既存 20 policies 不変更 | RLS ファイルは core 8 表に `drop policy` なし |
| match_profiles ADD のみ | `purpose` · `relationship_view` · `weekend_style` · `completeness_cached` |
| last_active_at | ADD なし · pre-gate `last_active_at_exists` = **1** |
| VIEW | `activity_label` のみ · raw `last_active_at` 非公開 |
| AI 非実装 | ルールベース関数のみ · TASFUL AI CTA 用 DB 土台 |

---

## 3. 適用前 gate（期待値）

```bash
npx supabase db query --linked --yes -f sql/match-post-auth-final-smoke-readonly.sql
npx supabase db query --linked --yes -f sql/match-p15-l1-pre-gates.sql
```

| 列 | 期待 | 失敗時 |
|----|------|--------|
| `legacy_user_count` | **7** | STOP |
| `allowlist_backfill_count` | **5** | STOP |
| `hook_func_count` | **1** | STOP |
| `hook_exception_mode` | **1** | STOP |
| `core_table_count` | **8** | STOP · L10 未適用 |
| `core_rls_enabled_count` | **8** | STOP · L11 未適用 |
| `core_policy_count` | **20** | STOP · core RLS 改変 |
| `p15_table_count` | **0** | STOP · 二重適用 |
| `p15_public_view_count` | **0** | STOP |
| `p15_function_count` | **0** | STOP · 部分適用 |
| `last_active_at_exists` | **1** | STOP · L10 欠落 |
| `t6_user_count` | **0** | 調査 |

---

## 4. 適用手順（**未実施** · 参考）

```bash
# 1) Pre-gates PASS 後
npx supabase db query --linked --yes -f supabase/migrations/20260622190000_match_p15_l1_schema.sql
npx supabase db query --linked --yes -f supabase/migrations/20260622191000_match_p15_l1_rls.sql

# 2) Post smoke（次フェーズで sql/scripts 追加予定）
# sql/match-p15-l1-verify-gates.sql
# node scripts/verify-match-p15-l1-schema.mjs
```

**適用後期待（概要）:**

| 指標 | 期待 |
|------|------|
| P15 新表 | **6** + hobby **2** = **8** |
| 新 RLS enabled | **6** |
| 新 policies | **14** |
| core policies | **20**（不変） |
| VIEW | `match_profiles_public` 存在 |
| 関数 | 6（ban stub + 5 helpers/scores） |

---

## 5. Rollback 順序

1. `20260622191000_match_p15_l1_rls.sql` 末尾 ROLLBACK ブロック（コメント解除して実行）
2. `20260622190000_match_p15_l1_schema.sql` 末尾 ROLLBACK ブロック
3. `sql/match-p15-l1-pre-gates.sql` で `p15_table_count=0` を再確認
4. legacy 7 · allowlist 5 · core_policy_count=20 を確認

---

## 6. スコープ外（今回作成なし）

| 項目 | フェーズ |
|------|----------|
| `sql/match-p15-l1-verify-gates.sql` | 適用直前 |
| `scripts/verify-match-p15-l1-schema.mjs` | 適用直前 |
| Edge Functions（favorite/footprint 等） | P15-L3 |
| UI / `match-api.js` | P15-L4/L5 |
| `tasful.jp` prod URL 検証 | 8 月以降 |

---

## 7. 次アクション

| 順 | 作業 | 状態 |
|----|------|------|
| 1 | pre-gates 実行 · PASS 確認 | **待ち** |
| 2 | linked ref へ schema → RLS 適用 | **禁止（gate 後）** |
| 3 | verify-gates + smoke スクリプト | 未着手 |
| 4 | P15-L3 Edge 設計/実装 | 未着手 |

**判定:** **P15-L1 ファイル作成完了 — linked ref 適用待ち（pre-gates PASS 後）**
