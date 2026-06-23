# TASFUL MATCH — P15-L1 post-gates 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`**（linked ref） |
| 実行 SQL | `sql/match-p15-l1-post-gates.sql` |
| 前提 | schema + RLS 適用 **PASS**（[`tasful-match-p15-l1-apply-result.md`](tasful-match-p15-l1-apply-result.md)） |
| 判定 | **`PASS`** |

---

## 1. 実行コマンド

```bash
npx supabase db query --linked --yes -f sql/match-p15-l1-post-gates.sql
```

**CLI:** exit code **0**

---

## 2. 構造 gate 結果

| 確認対象 | 期待 | 実測 | 結果 |
|----------|------|------|------|
| legacy 7 | **7** | **7** | **PASS** |
| allowlist 5 | **5** | **5** | **PASS** |
| Hook EXCEPTION | **1** | **1** | **PASS** |
| core 8 | **8** | **8** | **PASS** |
| RLS 8（core） | **8** | **8** | **PASS** |
| policies 20（core） | **20** | **20** | **PASS** |
| P15 新規 6 表 | **6** | **6** | **PASS** |
| P15 core 4 表 | **4** | **4** | **PASS** |
| hobby 2 表 | **2** | **2** | **PASS** |
| `match_profiles` ADD 4 列 | **4** | **4** | **PASS** |
| `last_active_at` 既存列 | **1** | **1** | **PASS** |
| P15 RLS enabled | **6** | **6** | **PASS** |
| 新規 14 policies | **14** | **14** | **PASS** |
| helper functions | **6** | **6** | **PASS** |
| `match_profiles_public` VIEW | **1** | **1** | **PASS** |
| VIEW raw `last_active_at` | **0** | **0** | **PASS** |
| VIEW `activity_label` 列 | **1** | **1** | **PASS** |

---

## 3. Smoke（関数呼び出し）

| 項目 | 実測 | 評価 |
|------|------|------|
| `match_activity_label(now())` | **`24時間以内に活動`** | **PASS** |
| `match_profile_completeness('t1')` → percent | **0** | **PASS**（`profile_not_found` · t1 プロフィール未作成） |
| `match_compatibility_score('t1','t2')` → code | **`profile_not_found`** | **PASS**（同上 · Edge/UI 前の想定内） |

プロフィール行が linked ref に未投入のため completeness/compatibility は **構造 smoke のみ**。データ投入後 P15-L3 smoke で再確認。

---

## 4. 生データ（combined row）

```json
{
  "legacy_user_count": 7,
  "allowlist_backfill_count": 5,
  "hook_func_count": 1,
  "hook_exception_mode": 1,
  "core_table_count": 8,
  "core_rls_enabled_count": 8,
  "core_policy_count": 20,
  "p15_core_table_count": 4,
  "p15_hobby_table_count": 2,
  "p15_table_count": 6,
  "profile_add_column_count": 4,
  "last_active_at_exists": 1,
  "p15_rls_enabled_count": 6,
  "p15_policy_count": 14,
  "p15_function_count": 6,
  "public_view_exists": 1,
  "public_view_has_raw_ts": 0,
  "public_view_has_activity_label": 1,
  "activity_label_smoke": "24時間以内に活動",
  "completeness_t1_percent": 0,
  "compatibility_t1_t2_code": "profile_not_found"
}
```

---

## 5. プライバシー確認（VIEW）

| 項目 | 結果 |
|------|------|
| `match_profiles_public` に `last_active_at` 列 | **なし**（`public_view_has_raw_ts=0`） |
| 活動表示 | **`activity_label` のみ**（bucket 文言） |
| オンライン中表示 | **なし**（設計どおり） |

---

## 6. FAIL 記録

**該当なし** — 全構造 gate PASS。

---

## 7. 総合判定

**`PASS`** — P15-L1 schema + RLS 適用後の linked ref 状態は計画どおり。

| 次 | 内容 |
|----|------|
| Edge/UI | **未着手**（承認後 P15-L3 以降） |
| prod URL | **8 月まで保留** |
| DB フェーズ | **`READY_FOR_P15_L3_EDGE`** |

---

## 8. 参照

| 文件 | 路径 |
|------|------|
| Post-gates SQL | `sql/match-p15-l1-post-gates.sql` |
| 適用結果 | `reports/tasful-match-p15-l1-apply-result.md` |
| Migration draft | `reports/tasful-match-p15-l1-migration-draft.md` |
