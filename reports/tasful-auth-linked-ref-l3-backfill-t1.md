# TASFUL — Auth Hook linked ref L3 backfill T1 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 対象ユーザー | **T1** · `t1@tasful.invalid` · `2d537fc9-ee67-4da8-97d3-bafe824ba466` |
| 前提 | `tasful-auth-linked-ref-l2-allowlist-seed.md` · L2 判定 `READY_FOR_LINKED_REF_L3_BACKFILL_T1` |
| 方法 | Admin API `PUT /auth/v1/admin/users/{id}` · **app_metadata merge のみ** |
| Hook | **OFF** · 関数 **未 CREATE** |

---

## 1. 実施サマリ

| # | L3 完了条件 | 結果 |
|---|-------------|------|
| 1 | T1 `app_metadata.talk_user_id` = `"t1"` | **PASS** |
| 2 | T1 `app_metadata.member_id` = `"t1"` | **PASS** |
| 3 | T2–T5 talk/member **未設定** | **PASS** |
| 4 | 既存 7 件 metadata **L1 diff なし** | **PASS** |
| 5 | T1 `user_metadata` **未変更** | **PASS** |
| 6 | Auth Hook **未 CREATE** | **PASS** |
| 7 | MATCH **未適用** | **PASS** |
| 8 | T1 login + refresh JWT に claim 載る | **PASS**（§6） |
| 9 | JWT 結果を report 記録（token 非掲載） | **PASS**（§6） |

**実行**

```bash
node scripts/backfill-auth-hook-l3-t1.mjs
npx supabase db query --linked --yes -f sql/auth-hook-l3-verify-readonly.sql
```

---

## 2. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| T2–T5 変更 | ✓ |
| 既存 7 件変更 | ✓ |
| user_metadata 変更 | ✓（T1 は `email_verified` のみのまま） |
| Hook CREATE / ENABLE | ✓ |
| RLS / MATCH / UI / Dashboard | ✓ |

---

## 3. T1 app_metadata backfill

### 3.1 merge 内容

| キー | 値 |
|------|-----|
| `talk_user_id` | **`t1`** |
| `member_id` | **`t1`** |

**保持（merge 後も存在）:** `provider: "email"` · `providers: ["email"]`

### 3.2 before / after

| タイミング | app_metadata |
|------------|--------------|
| **L2 直後（before）** | `{"provider":"email","providers":["email"]}` |
| **L3 後（after）** | `{"member_id":"t1","provider":"email","providers":["email"],"talk_user_id":"t1"}` |

### 3.3 user_metadata（変更なし）

| タイミング | user_metadata |
|------------|---------------|
| L2 / L3 | `{"email_verified":true}` |

### 3.4 demo ID との分離

| ID 空間 | 例 |
|---------|-----|
| 既存 demo / TALK | `u_me` · `u_hiro` · … |
| **T1 検証専用** | **`t1`**（新規 · 衝突なし） |

**重複監査:** `talk_user_id` 全体で duplicate **0 件**（`t1` は T1 のみ）

---

## 4. 他ユーザー影響確認

### 4.1 T2–T5（@tasful.invalid）

| email | talk_user_id | member_id |
|-------|--------------|-----------|
| t2@tasful.invalid | NULL | NULL |
| t3@tasful.invalid | NULL | NULL |
| t4@tasful.invalid | NULL | NULL |
| t5@tasful.invalid | NULL | NULL |

### 4.2 既存 7 件（@tasful-dev.test）

L1 §3.3 / L2 §5 と **キー単位一致** · **PASS**（`updated_at` のみ L3 未接触）

---

## 5. Hook / MATCH 状態

| 確認 | 結果 |
|------|------|
| `custom_access_token_hook` | **0 件** |
| `match_*` テーブル | **0** |

---

## 6. JWT 実測（Hook OFF · token 本文非掲載）

**方法:** `t1@tasful.invalid` password grant → access token decode → `refresh_token` grant → 再 decode  
**ツール:** ローカル base64 decode（`scripts/backfill-auth-hook-l3-t1.mjs`）

### 6.1 Login 直後（password grant）

| claim パス | 値 |
|------------|-----|
| `sub` | `2d537fc9-ee67-4da8-97d3-bafe824ba466` |
| `role` | `authenticated` |
| `app_metadata.talk_user_id` | **`t1`** |
| `app_metadata.member_id` | **`t1`** |
| `app_metadata.provider` | `email` |
| `app_metadata.providers` | `["email"]` |

### 6.2 Refresh 後（refresh_token grant）

| claim パス | 値 |
|------------|-----|
| `sub` | `2d537fc9-ee67-4da8-97d3-bafe824ba466` |
| `role` | `authenticated` |
| `app_metadata.talk_user_id` | **`t1`** |
| `app_metadata.member_id` | **`t1`** |
| `app_metadata.provider` | `email` |
| `app_metadata.providers` | `["email"]` |

**所見:** Hook **無し**でも Supabase が **`app_metadata` を JWT に埋込** · login / refresh **いずれも同一 claim**。

**非掲載:** access_token · refresh_token · パスワード · service_role

---

## 7. rollback（T1 のみ）

### 7.1 L3 前状態へ app_metadata 復元

Admin API merge:

```json
{
  "app_metadata": {
    "talk_user_id": null,
    "member_id": null,
    "provider": "email",
    "providers": ["email"]
  }
}
```

または L2 直後状態:

```json
{
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  }
}
```

**検証:** `sql/auth-hook-l3-verify-readonly.sql` で T1 talk/member NULL

### 7.2 既存 7 件 / T2–T5

**触らない** · L1 baseline（§3.3 `tasful-auth-linked-ref-l1-backup-baseline.md`）参照

---

## 8. 成果物

| ファイル | 用途 |
|----------|------|
| `scripts/backfill-auth-hook-l3-t1.mjs` | merge backfill + JWT login/refresh 検証 |
| `sql/auth-hook-l3-verify-readonly.sql` | READ ゲート |

---

## 9. 次ステップ（L4）

| 順 | 作業 |
|----|------|
| 1 | Postgres `auth.jwt()`（T1 セッション）で DB 側 claim 確認 |
| 2 | `TasuAuthCurrentUser`（preview/local）と `talkUserId` 一致 |
| 3 | L4 ゲート後 · L5 Hook CREATE 準備 |

---

## 10. 判定

### **READY_FOR_LINKED_REF_L4_JWT_REFRESH**

**理由**

- T1 **`talk_user_id` / `member_id` = `"t1"`** merge 成功 · provider/providers 保持
- T2–T5 · 既存 7 件 · user_metadata **無変更**
- Hook OFF で **login + refresh JWT** に claim 載ることを実測
- MATCH / Hook **未変更**

**BLOCKED_WITH_REASON:** 該当なし

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-linked-ref-l2-allowlist-seed.md` | T1 uuid |
| `reports/tasful-auth-linked-ref-l1-backup-baseline.md` | 既存 7 件 baseline |
| `reports/tasful-auth-hook-linked-ref-phased-checklist.md` | L4–L5 |
