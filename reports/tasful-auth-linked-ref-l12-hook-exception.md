# TASFUL — Auth Hook linked ref L12 U-7 P2 EXCEPTION 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | `tasful-auth-linked-ref-l11-rls-d2.md` · L11 判定 `READY_FOR_LINKED_REF_L12_HOOK_EXCEPTION` · **L11 PASS 確認済み** |
| Hook | **ON** · 関数 **EXCEPTION モードへ更新** |
| PITR | **無効** · rollback = Hook OFF + L5 DROP + L1 baseline |

---

## 1. 実施サマリ

| # | L12 完了条件 | 結果 |
|---|-------------|------|
| 1 | Hook WARN → EXCEPTION 切替 | **PASS**（§3） |
| 2 | T1–T5 login / refresh 成功 | **PASS**（§4） |
| 3 | 欠落 user login / refresh 拒否 | **PASS** · `t6@tasful.invalid`（§5） |
| 4 | Edge smoke 再実行 | **PASS**（§7） |
| 5 | RLS regression | **PASS**（§6） |
| 6 | legacy 7 / allowlist metadata 不変 | **PASS**（§8） |
| 7 | MATCH schema / RLS 不変 | **PASS**（§8） |
| 8 | auth/rest/edge health 5xx なし | **PASS**（§7） |

**実行**

```bash
node scripts/verify-auth-hook-l12-exception.mjs
node scripts/verify-auth-hook-l12-exception.mjs --skip-apply
```

**自動検証:** `L12 result: PASS (9 checks)`

**判定:** **`READY_FOR_MATCH_POST_AUTH_FINAL_SMOKE`**

---

## 2. Pre-apply gate

| 指標 | 期待 | 実測 |
|------|------|------|
| `hook_func_count` | 1 | **1** |
| `hook_exception_mode` | 0（WARN） | **0** |
| `rls_enabled_count` | 8（L11 維持） | **8** |

---

## 3. Hook EXCEPTION migration

| 項目 | 値 |
|------|-----|
| ファイル | `supabase/migrations/20260621180000_custom_access_token_hook_exception.sql` |
| Dashboard / config.toml | **変更なし**（Hook ON 維持） |

### 3.1 ロジック（P2 EXCEPTION）

| 条件 | 動作 |
|------|------|
| `app_metadata.talk_user_id` あり | claims merge · token 発行 |
| `talk_user_id` 欠落 · `member_id` あり | `talk_user_id := member_id` で merge · token 発行 |
| **両方欠落** | `RAISE EXCEPTION` · login / refresh **拒否** |
| `provider` / `providers` | DB 値を merge · **維持** |
| `role` / `platform_role` / `is_ops` | L6 以来どおり merge |

**Post-apply:** `hook_exception_mode = 1` · `pg_get_functiondef` に `raise exception` を含む

---

## 4. Allowlist T1–T5 login / refresh

| Slot | login | refresh | talk | member | hook merge |
|------|-------|---------|------|--------|------------|
| T1 | 200 | 200 | `t1` | `t1` | role/platform_role/is_ops ✓ |
| T2 | 200 | 200 | `t2` | `t2` | 同上 |
| T3 | 200 | 200 | `t3` | `t3` | 同上 |
| T4 | 200 | 200 | `t4` | `t4` | 同上 |
| T5 | 200 | 200 | `t5` | `t5` | 同上 |

**metadata:** T1–T5 app_metadata **diff なし**（SQL gates `allowlist_backfill_count=5`）

---

## 5. 欠落ユーザー検証（`t6@tasful.invalid`）

| 段階 | 操作 | 結果 |
|------|------|------|
| 1 | service_role で `t6` 作成（`provider`/`providers` のみ · talk/member **なし**） | OK |
| 2 | WARN 下で login → refresh token 取得 | migration 前に実施 |
| 3 | EXCEPTION migration 適用 | OK |
| 4 | `t6` password login | **拒否**（token なし · Auth API HTTP **500** = hook exception） |
| 5 | 旧 refresh token | **拒否**（token なし） |
| 6 | `t6` **削除** | `t6_user_count=0` |

**破壊的検証なし:** T2 backfill 巻き戻し · 既存 7 件 login **未実施**

### 5.1 既存 7 ユーザー（検証方針）

| 区分 | 方針 |
|------|------|
| 検証実施 | **metadata L1 diff のみ**（READ-ONLY SQL） |
| login / refresh | **無断検証しない**（ユーザー指示） |
| Hook 影響（理論） | L1 baseline: U1–U3 は `member_id` のみ → **merge 継続可** · U4–U7 は `talk_user_id` あり → **merge 継続可** |
| 本番前 | 欠落 cohort が 0 であることの SQL 監査を別途推奨 |

---

## 6. RLS regression（代表）

| ケース | 結果 |
|--------|------|
| T1 own profile INSERT | **PASS** |
| T1 PATCH T2 profile | **拒否**（nickname 不変） |
| anon SELECT | **拒否** |
| invalid JWT | **401/403** |
| sub-only JWT | **401/403** |

**MATCH:** `rls_enabled_count=8` · `policy_count=20` · **migration なし**

---

## 7. Edge smoke · API health

| ケース | HTTP | 結果 |
|--------|------|------|
| T1 swipe | **200** | PASS |
| T1 self-swipe | **422** | PASS |
| report / block / verification | **200** | PASS |
| admin-review（T1） | **403** | PASS |
| `/auth/v1/health` · `/rest/v1/` · Edge OPTIONS | no 5xx | PASS |

---

## 8. 不変確認

| 確認 | 結果 |
|------|------|
| legacy 7 件 metadata | L1 baseline **diff なし** |
| allowlist T1–T5 metadata | **不変** |
| `custom_access_token_hook` | **更新済み**（EXCEPTION のみ · Dashboard 不変） |
| MATCH 8 tables / RLS 20 policies | **不変** |
| UI / Auth 設定 / Dashboard | **変更なし** |

---

## 9. 禁止事項遵守

| 禁止 | 遵守 |
|------|------|
| 既存 7 metadata 変更 | ✓ |
| allowlist metadata 変更 | ✓ |
| MATCH schema 変更 | ✓ |
| RLS 変更 | ✓ |
| UI / Dashboard / Auth 設定 | ✓ |
| 既存 7 login/refresh 検証 | ✓（未実施） |
| Hook 関数 migration | ✓（本 L12 のみ） |

---

## 10. 成果物

| ファイル | 用途 |
|----------|------|
| `supabase/migrations/20260621180000_custom_access_token_hook_exception.sql` | L12 Hook EXCEPTION |
| `scripts/verify-auth-hook-l12-exception.mjs` | 自動検証 |
| `sql/auth-hook-l12-pre-gates.sql` | pre-apply WARN + RLS=8 |
| `sql/auth-hook-l12-verify-gates.sql` | post/final combined gates |
| `sql/auth-hook-l12-verify-readonly.sql` | 手動 READ-ONLY |
| `reports/tasful-auth-linked-ref-l12-hook-exception.md` | 本レポート |

---

## 11. Rollback（PITR 無効 · 参考）

| 順序 | 操作 |
|------|------|
| 1 | `config.toml` `[auth.hook.custom_access_token]` `enabled=false` + `supabase config push`（Hook **OFF**） |
| 2 | L5 rollback SQL: `DROP FUNCTION custom_access_token_hook`（`reports/tasful-auth-linked-ref-l5-hook-create-off.md`） |
| 3 | または L5 migration 本文で `CREATE OR REPLACE` を WARN 版に戻す |
| 4 | L1 baseline で auth.users metadata 照合 |

**L11 RLS / L10 schema:** 本 rollback では触らない

---

## 12. 次フェーズ

| 項目 | 内容 |
|------|------|
| 次 | **MATCH post-auth final smoke** |
| 前提 | 本 L12 判定 **`READY_FOR_MATCH_POST_AUTH_FINAL_SMOKE`** |
