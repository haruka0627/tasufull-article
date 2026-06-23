# TASFUL — Auth Hook linked ref L11 MATCH RLS D2 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | `tasful-auth-linked-ref-l10-match-schema.md` · L10 判定 `READY_FOR_LINKED_REF_L11_RLS_D2` |
| Hook | **ON**（L6 設定維持 · 関数 **未変更**） |
| RLS | **有効**（8 MATCH テーブル · 20 policies） |

---

## 1. 実施サマリ

| # | L11 完了条件 | 結果 |
|---|-------------|------|
| 1 | RLS enabled = 8 | **PASS**（§3） |
| 2 | policies 作成確認 | **PASS** · **20** 件（§4） |
| 3 | T1 own profile 読書き OK | **PASS**（§5） |
| 4 | T1 が T2 profile を不正更新不可 | **PASS**（§5） |
| 5 | swipe / block / report / verification が JWT talk_user_id に紐づく | **PASS**（§5） |
| 6 | match_pairs は成立者のみ参照可能 | **PASS**（§5） |
| 7 | moderation_logs user-facing read 制限 · admin 広域 read | **PASS**（§5 · §6） |
| 8 | anon / invalid JWT / sub-only JWT 拒否 | **PASS**（§5） |
| 9 | service-role 経路は必要最小限 | **PASS**（§6） |
| 10 | Edge smoke 再実行 | **PASS**（§7） |
| 11 | legacy 7 / allowlist metadata diff なし | **PASS**（§8） |
| 12 | auth/rest/edge 5xx なし | **PASS**（§7） |

**実行**

```bash
node scripts/verify-auth-hook-l11-rls-d2.mjs
node scripts/verify-auth-hook-l11-rls-d2.mjs --skip-apply   # migration 済み時
```

**自動検証:** `L11 result: PASS (6 checks)`

**判定:** **`READY_FOR_LINKED_REF_L12_HOOK_EXCEPTION`**

---

## 2. Pre-apply gate（RLS OFF）

```bash
npx supabase db query --linked --yes -f sql/auth-hook-l11-pre-gates.sql
```

| 指標 | 期待 | 実測 |
|------|------|------|
| `rls_enabled_count` | **0** | **0** |

---

## 3. Migration 適用

| 項目 | 値 |
|------|-----|
| ファイル | `supabase/migrations/20260621170000_match_rls_d2.sql` |
| 方法 | `npx supabase db query --linked --yes -f <file>` |
| 前提 schema | L10 `20260621160000_create_match_schema.sql`（適用済み） |

**Post-apply gates**

| 指標 | 期待 | 実測 |
|------|------|------|
| `core_table_count` | 8 | **8** |
| `rls_enabled_count` | 8 | **8** |
| `policy_count` | ≥ 20 | **20** |
| `helper_func_count` | 3 | **3** |
| `legacy_user_count` | 7 | **7** |
| `allowlist_backfill_count` | 5 | **5** |
| `hook_func_count` | 1 | **1** |

---

## 4. Helper 関数 · Policies

### 4.1 Auth helpers（D2）

| 関数 | 役割 |
|------|------|
| `match_current_user_id()` | JWT `app_metadata.talk_user_id` → root → `member_id`（**auth.uid() 不使用**） |
| `match_is_admin()` | JWT `tasu_admin` / `match_admin` / `is_ops=true` |
| `match_users_are_blocked(a,b)` | 双方向 active block 判定（将来 view 用） |

### 4.2 RLS policies（20 件）

| テーブル | policies | 要点 |
|----------|----------|------|
| `match_profiles` | 3 | own SELECT/INSERT/UPDATE · verification_status trigger guard |
| `match_profile_photos` | 3 | profile owner 経由 |
| `match_swipes` | 2 | swiper own · self-swipe CHECK + RLS |
| `match_pairs` | 1 | participant SELECT のみ · writes = service_role |
| `match_blocks` | 3 | blocker SELECT/INSERT/UPDATE · blocked は不可視 |
| `match_reports` | 3 | reporter own + **admin SELECT** |
| `match_verifications` | 3 | owner SELECT/INSERT + **admin SELECT** |
| `match_moderation_logs` | 2 | own SELECT（user_id 一致）+ **admin SELECT** · writes なし |

**anon:** 全 MATCH テーブル `REVOKE ALL` · authenticated に最小 GRANT

---

## 5. RLS REST 検証（T1–T5 JWT · 代表）

| ケース | 期待 | 結果 |
|--------|------|------|
| T1 INSERT/SELECT/PATCH own `match_profiles` | OK | **PASS** |
| T1 SELECT T2 base profile | 拒否（空） | **PASS** |
| T1 PATCH T2 profile | 変更なし | **PASS** |
| T1 INSERT swipe `t1→t2` | 201 | **PASS** |
| T1 INSERT swipe as `t2` | 4xx | **PASS** |
| T1 SELECT `match_pairs`（t1/t2 成立） | 可 | **PASS** |
| T3 SELECT 同上 pair | 拒否 | **PASS** |
| T1 block T3 · T3 SELECT blocks | blocker のみ可視 | **PASS** |
| T1 report / verification INSERT | 201 · talk_user_id=t1 | **PASS** |
| T1 moderation_logs | 自分行のみ | **PASS** |
| anon SELECT profiles | 拒否 | **PASS** |
| invalid JWT | 401/403 | **PASS** |
| sub-only unsigned JWT | 401/403 | **PASS** |

---

## 6. service-role 経路（必要最小限）

| 用途 | 経路 | 備考 |
|------|------|------|
| Edge Functions | `service_role` JWT | RLS bypass · L9 smoke 維持 |
| moderation_logs INSERT | service_role REST | authenticated に INSERT policy **なし** |
| match_pairs INSERT | service_role | 成立処理は Edge / backend |
| 検証 seed / cleanup | verify script service_role | `L11RLS` テスト行のみ |

**T1–T5 allowlist JWT:** `is_ops=false` · admin role なし → `match_is_admin()` = false（期待どおり）

---

## 7. Edge smoke · API health

L9 remote smoke を `--skip-deploy --skip-db-gates` で再実行:

| ケース | HTTP | 結果 |
|--------|------|------|
| T1 swipe | **200** | PASS |
| T1 self-swipe | **422** | PASS |
| report / block / verification / moderation-log | **200** | PASS |
| match-admin-review（T1） | **403** | PASS |
| auth / rest / edge health | no 5xx | PASS |

---

## 8. 不変確認

| 確認 | 結果 |
|------|------|
| legacy `@tasful-dev.test` 7 件 | L1 baseline **diff なし** |
| allowlist T1–T5 `talk_user_id` / `member_id` | **t1–t5** 維持 |
| `custom_access_token_hook` | **1 件** · **未変更** |
| Dashboard / Auth 設定 / UI | **変更なし** |

**READ-ONLY SQL:** `sql/auth-hook-l11-verify-readonly.sql`

---

## 9. 禁止事項遵守

| 禁止 | 遵守 |
|------|------|
| 既存 7 ユーザー metadata 変更 | ✓ |
| allowlist metadata 変更 | ✓ |
| Hook 関数変更 | ✓ |
| Auth 設定変更 | ✓ |
| Dashboard 追加変更 | ✓ |
| UI 変更 | ✓ |

---

## 10. 成果物

| ファイル | 用途 |
|----------|------|
| `supabase/migrations/20260621170000_match_rls_d2.sql` | L11 RLS D2 DDL |
| `scripts/verify-auth-hook-l11-rls-d2.mjs` | 自動検証 |
| `sql/auth-hook-l11-pre-gates.sql` | pre-apply RLS=0 |
| `sql/auth-hook-l11-verify-gates.sql` | post-apply combined gates |
| `sql/auth-hook-l11-verify-readonly.sql` | 手動 READ-ONLY |
| `reports/tasful-auth-linked-ref-l11-rls-d2.md` | 本レポート |

---

## 11. Rollback（参考 · 未実施）

```sql
-- Drop policies + disable RLS (L10 schema retained)
-- See migration file for policy names; then:
alter table public.match_moderation_logs disable row level security;
-- ... repeat for 8 tables ...
drop function if exists public.match_is_admin();
-- Restore match_current_user_id only if rolling back entirely
```

---

## 12. 次フェーズ

| 項目 | 内容 |
|------|------|
| L12 | Hook U-7 P2 EXCEPTION — 欠落 `talk_user_id` user の login 拒否 |
| 前提 | 本 L11 判定 **`READY_FOR_LINKED_REF_L12_HOOK_EXCEPTION`** |
| 参照 | `reports/tasful-auth-hook-linked-ref-phased-checklist.md` § L12 |
