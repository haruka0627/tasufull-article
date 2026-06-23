# TASFUL — Auth Hook linked ref L2 allowlist seed 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** のみ |
| 前提 | `tasful-auth-linked-ref-l1-backup-baseline.md` · L1 判定 `READY_FOR_LINKED_REF_L2_ALLOWLIST` |
| 実施方法 | Admin API `POST /auth/v1/admin/users`（service_role）· **5 件 CREATE のみ** |
| 本セッション | 既存 7 件 metadata **未変更** · Hook / RLS / MATCH / UI / Dashboard **未変更** |

---

## 1. 実施サマリ

| # | L2 完了条件 | 結果 |
|---|-------------|------|
| 1 | auth.users **7 → 12** | **PASS**（total=12） |
| 2 | `@tasful.invalid` **5 件** | **PASS** |
| 3 | 既存 7 件 metadata **L1 と diff なし** | **PASS**（§5） |
| 4 | T1–T5 に `talk_user_id` **なし** | **PASS**（0 rows） |
| 5 | Auth Hook **未 CREATE** | **PASS** |
| 6 | MATCH migration **未適用** | **PASS**（match_* = 0） |

**実行コマンド**

```bash
node scripts/seed-auth-hook-l2-allowlist.mjs
npx supabase db query --linked --yes -f sql/auth-hook-l2-verify-readonly.sql
```

---

## 2. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| 既存 7 件 app/user metadata 変更 | ✓ 未更新 |
| INSERT は T1–T5 Auth 作成のみ | ✓ Admin API create のみ |
| Auth Hook CREATE / ENABLE | ✓ |
| RLS / MATCH migration / UI / Dashboard | ✓ |

---

## 3. 作成した allowlist（T1–T5）

| Slot | ロール（計画） | email | auth_user_id | email_confirmed |
|------|----------------|-------|--------------|-----------------|
| **T1** | `normal_user` | `t1@tasful.invalid` | `2d537fc9-ee67-4da8-97d3-bafe824ba466` | **true** |
| **T2** | `match_verified_user` | `t2@tasful.invalid` | `d9f57cfa-61f9-4426-ad6a-78ebbd1b7723` | **true** |
| **T3** | `banned_match_user` | `t3@tasful.invalid` | `fbd8fdf3-d789-43eb-be9b-3a03b2df90d3` | **true** |
| **T4** | `tasu_admin` | `t4@tasful.invalid` | `6b13b77f-1de1-47f1-97cd-3c401ce81c0c` | **true** |
| **T5** | `missing_talk_user_id` | `t5@tasful.invalid` | `147ebffb-6504-4df5-ac31-072e1c6531b4` | **true** |

### 3.1 作成時 metadata（全 5 件同一方針）

**app_metadata**

```json
{
  "provider": "email",
  "providers": ["email"]
}
```

**user_metadata**

```json
{
  "email_verified": true
}
```

**未設定（L3 へ）:** `talk_user_id` · `member_id` · `role` · `is_ops` · `platform_role`

### 3.2 既存 demo ID との分離

| 区分 | text / email 空間 |
|------|-------------------|
| 既存 DB demo | `u_me` · `u_hiro` · `@tasful-dev.test` |
| **L2 allowlist** | **`t1`–`t5@tasful.invalid`** · UUID 上表 |

### 3.3 パスワード（平文は本 report に記載しない）

| 項目 | 保管 |
|------|------|
| 変数 | `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` |
| 場所 | **`.env`（gitignore）** · L2 実行時に自動生成または手動設定 |
| ログイン検証 | `t1@tasful.invalid` · password grant → **HTTP 200 OK**（token 発行確認） |

---

## 4. L3 backfill 予定 mapping（参考 · 未実施）

| Slot | 予定 `talk_user_id` | L3 backfill |
|------|---------------------|-------------|
| T1 | `u_auth_test_001` | **実施** |
| T2 | `u_auth_test_002` | L3b 以降 |
| T3 | `u_auth_test_003` | L3b 以降 |
| T4 | `u_auth_test_ops` + `is_ops` / `role=tasu_admin` | L3b 以降 |
| T5 | — | **常にスキップ** |

**L3 最初の 1 件:** **T1 のみ**（phased checklist L3）。

---

## 5. 既存 7 件 — L1 baseline 突合

**方法:** L1 §3.3 JSON と READ クエリ結果を **キー単位で目視一致**（`updated_at` は L2 未接触のため L1 値のまま変動なし）。

| uuid | email | L1 app_metadata 一致 | L1 user_metadata 一致 |
|------|-------|----------------------|------------------------|
| `72d07af0-…` | anpi-rls-a@tasful-dev.test | ✓ | ✓ |
| `c8476454-…` | anpi-rls-b@tasful-dev.test | ✓ | ✓ |
| `b77481c9-…` | anpi-rls-admin@tasful-dev.test | ✓ | ✓ |
| `a4a111ca-…` | talk-rls-a@tasful-dev.test | ✓ | ✓ |
| `15bb209a-…` | talk-rls-b@tasful-dev.test | ✓ | ✓ |
| `9d9bd0bb-…` | talk-rls-admin@tasful-dev.test | ✓ | ✓ |
| `0f106b57-…` | talk-rls-worker@tasful-dev.test | ✓ | ✓ |

**判定:** **metadata diff なし · PASS**

---

## 6.  post-L2 集計

| 指標 | 値 |
|------|-----|
| total_users | **12** |
| `@tasful.invalid` | **5** |
| `@tasful-dev.test` | **7** |
| allowlist `app_metadata.talk_user_id` | **0** |
| Hook 関数（pg_proc） | **0** |
| `match_*` テーブル | **0** |

---

## 7. rollback（L2 範囲）

| 操作 | 手順 |
|------|------|
| allowlist 5 件削除 | Admin API `DELETE /auth/v1/admin/users/{uuid}` · §3 uuid |
| 既存 7 件 | **触らない** · L1 §3.3 で復元可能 |
| 再 seed | `node scripts/seed-auth-hook-l2-allowlist.mjs`（存在時 skip） |

---

## 8. 成果物

| ファイル | 用途 |
|----------|------|
| `scripts/seed-auth-hook-l2-allowlist.mjs` | idempotent create（既存 skip · L1 uuid 保護） |
| `sql/auth-hook-l2-allowlist-seed.sql` | 手順 · pre-check READ |
| `sql/auth-hook-l2-verify-readonly.sql` | L2 ゲート READ |

---

## 9. 次ステップ（L3）

| 順 | 作業 |
|----|------|
| 1 | **T1 のみ** Admin API merge · `talk_user_id` / `member_id` |
| 2 | Hook **OFF** のまま JWT decode + `refreshSession` |
| 3 | 既存 7 件 · T5 は **変更禁止** |

---

## 10. 判定

### **READY_FOR_LINKED_REF_L3_BACKFILL_T1**

**理由**

- T1–T5 `@tasful.invalid` **5 件作成** · email confirmed · ログイン可能
- 既存 7 件 **L1 baseline と一致**
- `talk_user_id` **未設定** · Hook / MATCH **未変更**
- demo ID 空間と **分離**

**BLOCKED_WITH_REASON:** 該当なし

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-linked-ref-l1-backup-baseline.md` | L1 rollback baseline |
| `reports/tasful-auth-hook-linked-ref-phased-checklist.md` | L3 手順 |
