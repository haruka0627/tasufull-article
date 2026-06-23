# TASFUL — Auth Hook linked ref L10 MATCH schema 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | `tasful-auth-linked-ref-l9-edge-smoke.md` · L9 判定 `READY_FOR_LINKED_REF_L10_MATCH_SCHEMA` |
| Hook | **ON**（L6 設定維持 · 変更なし） |
| RLS | **未適用**（L11 へ defer） |

---

## 1. 実施サマリ

| # | L10 完了条件 | 結果 |
|---|-------------|------|
| 1 | migration 適用前 `match_*` = 0 | **PASS**（§2） |
| 2 | MATCH schema migration 適用 | **PASS**（§3） |
| 3 | 8 テーブル作成確認 | **PASS**（§4） |
| 4 | PK / FK / UNIQUE / INDEX 確認 | **PASS**（§5） |
| 5 | created_at / updated_at / status 系 | **PASS**（§6） |
| 6 | Edge smoke 再実行 | **PASS**（§7） |
| 7 | legacy 7 件 L1 baseline diff なし | **PASS**（§8） |
| 8 | allowlist metadata diff なし | **PASS**（§8） |
| 9 | Hook ON 維持 | **PASS**（§8） |
| 10 | auth/rest/edge 5xx なし | **PASS**（§7） |

**実行**

```bash
node scripts/verify-auth-hook-l10-match-schema.mjs
node scripts/verify-auth-hook-l10-match-schema.mjs --skip-apply   # migration 済み時
```

**自動検証:** `L10 result: PASS (4 checks)`

**判定:** **`READY_FOR_LINKED_REF_L11_RLS_D2`**

---

## 2. Pre-apply gate（match_* = 0）

```bash
npx supabase db query --linked --yes -f sql/auth-hook-l10-pre-gates.sql
```

| 指標 | 期待 | 実測 |
|------|------|------|
| `match_table_count` | **0** | **0** |

---

## 3. Migration 適用

| 項目 | 値 |
|------|-----|
| ファイル | `supabase/migrations/20260621160000_create_match_schema.sql` |
| 方法 | `npx supabase db query --linked --yes -f <file>` |
| RLS draft / hook migration | **未適用**（単一ファイルのみ） |

**補助関数:** `public.match_set_updated_at()` + 各 `updated_at` テーブル trigger

---

## 4. 作成テーブル（論理名 ↔ DDL 名）

| # | 要求名 | DDL テーブル名 | 備考 |
|---|--------|----------------|------|
| 1 | match_profiles | `match_profiles` | `user_id` = talk_user_id text |
| 2 | match_photos | `match_profile_photos` | draft/RLS 既存命名に合わせる |
| 3 | match_swipes | `match_swipes` | self-swipe CHECK |
| 4 | match_matches | `match_pairs` | user_low/high 正規化 UNIQUE |
| 5 | match_blocks | `match_blocks` | optional FK → match_pairs |
| 6 | match_reports | `match_reports` | status workflow |
| 7 | match_verifications | `match_verifications` | phone/identity |
| 8 | match_moderation_logs | `match_moderation_logs` | append-only audit |

**`core_table_count` = 8** · **`match_%` 総数 = 8**（draft 余剰テーブルなし）

---

## 5. PK / FK / UNIQUE / INDEX

Post-apply gates（`sql/auth-hook-l10-verify-gates.sql`）:

| 指標 | 期待 | 実測 |
|------|------|------|
| `pk_constraint_count` | 8 | **8** |
| `fk_constraint_count` | ≥ 3 | **3** |
| `unique_constraint_count` | ≥ 4 | **4** |
| `index_count` | ≥ 15 | **33** |
| `rls_enabled_count` | 0 | **0** |

**FK（主要）**

| 子 | 親 | ON DELETE |
|----|-----|-----------|
| `match_profile_photos.profile_id` | `match_profiles.id` | CASCADE |
| `match_profiles.main_photo_id` | `match_profile_photos.id` | SET NULL |
| `match_blocks.match_pair_id` | `match_pairs.id` | SET NULL |

**UNIQUE（主要）**

| テーブル | 制約 |
|----------|------|
| `match_profiles` | `user_id` |
| `match_swipes` | `(swiper_user_id, target_user_id)` |
| `match_pairs` | `(user_low_id, user_high_id)` |
| `match_blocks` | `(blocker_user_id, blocked_user_id)` |

---

## 6. created_at / updated_at / status 系

| テーブル | created_at | updated_at | status 系 |
|----------|------------|------------|-----------|
| match_profiles | ✓ | ✓ trigger | `profile_status`, `verification_status` |
| match_profile_photos | ✓ | ✓ trigger | `moderation_status`, `photo_status` |
| match_swipes | ✓ | — | `action` |
| match_pairs | ✓ | ✓ trigger | `status` |
| match_blocks | ✓ | ✓ trigger | `block_status` |
| match_reports | ✓ | ✓ trigger | `status` |
| match_verifications | ✓ | ✓ trigger | `status` |
| match_moderation_logs | ✓ | — | `level`, `allowed` |

**`status_timestamp_col_count` = 16**（gates CTE 定義どおり）

---

## 7. Edge smoke 再実行（L9 regression · post-schema）

L10 から L9 smoke を `--skip-deploy --skip-db-gates` で再実行（schema 後は `match_*=0` gate を skip）。

| ケース | HTTP | 結果 |
|--------|------|------|
| T1 swipe | **200** | PASS |
| T1 self-swipe | **422** | PASS |
| match-submit-report | **200** | PASS |
| match-block-user | **200** | PASS |
| match-submit-verification | **200** | PASS |
| match-moderation-log | **200** | PASS |
| match-admin-review（T1） | **403** | PASS |
| 401 / 403 invalid JWT | 401 / 403 | PASS |
| auth/rest/edge health | no 5xx | PASS |

**Edge functions:** L9 deploy 7 件 **変更なし** · ACTIVE 維持

---

## 8. 不変確認（legacy · allowlist · Hook）

| 確認 | 期待 | 実測 |
|------|------|------|
| legacy `@tasful-dev.test` | 7 件 · L1 metadata 不変 | **7** · diff なし |
| allowlist T1–T5 | `talk_user_id` / `member_id` = t1–t5 | **5/5** |
| `custom_access_token_hook` | 1 件存在 | **1** |
| Hook Dashboard/config | ON | **維持** |
| RLS on match_* | OFF | **0 テーブル** |

**READ-ONLY SQL:** `sql/auth-hook-l10-verify-readonly.sql`

---

## 9. 禁止事項遵守

| 禁止 | 遵守 |
|------|------|
| 既存 7 ユーザー metadata 変更 | ✓ |
| allowlist T1–T5 metadata 変更 | ✓ |
| Hook 関数変更 | ✓ |
| Dashboard 追加変更 | ✓ |
| UI 変更 | ✓ |
| Auth 設定変更 | ✓ |
| RLS 本番化 | ✓（未 enable） |

---

## 10. 成果物

| ファイル | 用途 |
|----------|------|
| `supabase/migrations/20260621160000_create_match_schema.sql` | L10 DDL |
| `scripts/verify-auth-hook-l10-match-schema.mjs` | 自動検証 |
| `sql/auth-hook-l10-pre-gates.sql` | pre-apply match=0 |
| `sql/auth-hook-l10-verify-gates.sql` | post-apply combined gates |
| `sql/auth-hook-l10-verify-readonly.sql` | 手動 READ-ONLY |
| `reports/tasful-auth-linked-ref-l10-match-schema.md` | 本レポート |

**L9 smoke 拡張:** `scripts/verify-auth-hook-l9-remote-edge-smoke.mjs` に `--skip-db-gates` 追加（L10 regression 用 · L9 単体挙動は不変）

---

## 11. Rollback（参考 · 未実施）

```sql
-- L10 schema rollback（RLS 未適用前提）
drop table if exists public.match_moderation_logs cascade;
drop table if exists public.match_verifications cascade;
drop table if exists public.match_reports cascade;
drop table if exists public.match_blocks cascade;
drop table if exists public.match_pairs cascade;
drop table if exists public.match_swipes cascade;
drop table if exists public.match_profile_photos cascade;
drop table if exists public.match_profiles cascade;
drop function if exists public.match_set_updated_at() cascade;
```

PITR: disabled（L1 参照）· 論理 baseline + migration ファイルで復旧

---

## 12. 次フェーズ

| 項目 | 内容 |
|------|------|
| L11 | MATCH RLS D2（`talk_user_id` text · `20260621140000_match_rls_d2_talk_user_id_draft.sql` 系） |
| 前提 | 本 L10 判定 **`READY_FOR_LINKED_REF_L11_RLS_D2`** |
