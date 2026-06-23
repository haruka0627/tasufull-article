# TASFUL — Auth Hook linked ref L1 backup baseline

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21**（UTC · `supabase db query --linked`） |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** のみ |
| 前提 | `tasful-auth-linked-ref-l0-inventory.md` · L0 判定 `READY_FOR_LINKED_REF_L1_BACKUP` |
| 方法 | **READ-ONLY SELECT** · 本レポートへスナップショット記録 |
| 本セッション | INSERT/UPDATE/DELETE · Hook CREATE · Dashboard 変更 · RLS/UI/migration **なし** |

---

## 1. 実施サマリ

| # | L1 項目 | 結果 |
|---|---------|------|
| 1 | auth.users 7 件 metadata バックアップ | **完了**（§3） |
| 2 | text ID 利用箇所再確認 | **完了**（§4） · L0 と **一致** |
| 3 | MATCH migration 未適用 | **再確認 PASS**（§5） |
| 4 | Auth Hook 未 CREATE | **再確認 PASS**（§6） |
| 5 | Supabase Pro PITR 確認 | **Dashboard 手動チェック項目**（§7 · 本 AI セッション未実施） |
| 6 | rollback 用 baseline | **§8–§9** |

**再利用 SQL:** `sql/auth-hook-l1-backup-readonly.sql`

---

## 2. 接続・禁止事項の遵守

| 確認 | 結果 |
|------|------|
| CLI `--linked` → `ddojquacsyqesrjhcvmn` | OK（L0 と同手順 · client config 一致） |
| SQL 書込 | **なし** |
| Auth Hook CREATE / ENABLE | **なし** |
| Dashboard 設定変更 | **なし** |
| RLS / UI / migration 適用 | **なし** |

---

## 3. auth.users metadata バックアップ（7 件 · 全量）

**スナップショット ID:** `L1-BASELINE-2026-06-21`  
**復元:** §9 Admin API merge または L0/L1 再クエリ照合

### 3.1 集計

| 指標 | 値 |
|------|-----|
| total_users | **7** |
| app `talk_user_id` あり | **4** |
| app `member_id` あり | **7** |
| user `talk_user_id` あり | **4** |
| app `talk_user_id` 重複 | **0** |

### 3.2 行別スナップショット（created_at 昇順）

#### U1 — anpi-rls-a@tasful-dev.test

| 列 | 値 |
|----|-----|
| id | `72d07af0-3d3b-4a87-8358-cae56a3ad721` |
| email | `anpi-rls-a@tasful-dev.test` |
| created_at | `2026-06-01T20:24:39.30581+00:00` |
| updated_at | `2026-06-18T08:54:49.523606+00:00` |
| app_metadata | `{"member_id":"anpi_rls_member_a","provider":"email","providers":["email"]}` |
| user_metadata | `{"email_verified":true,"member_id":"anpi_rls_member_a"}` |

#### U2 — anpi-rls-b@tasful-dev.test

| 列 | 値 |
|----|-----|
| id | `c8476454-e1f9-4efc-adfc-6fd6ba6102f9` |
| email | `anpi-rls-b@tasful-dev.test` |
| created_at | `2026-06-01T20:24:39.723269+00:00` |
| updated_at | `2026-06-18T08:54:49.746866+00:00` |
| app_metadata | `{"member_id":"anpi_rls_member_b","provider":"email","providers":["email"]}` |
| user_metadata | `{"email_verified":true,"member_id":"anpi_rls_member_b"}` |

#### U3 — anpi-rls-admin@tasful-dev.test

| 列 | 値 |
|----|-----|
| id | `b77481c9-18f5-4130-854b-1a97db97c357` |
| email | `anpi-rls-admin@tasful-dev.test` |
| created_at | `2026-06-01T20:24:40.033193+00:00` |
| updated_at | `2026-06-18T08:54:49.970804+00:00` |
| app_metadata | `{"member_id":"anpi_rls_admin","provider":"email","providers":["email"],"role":"tasu_admin"}` |
| user_metadata | `{"email_verified":true,"member_id":"anpi_rls_admin"}` |

#### U4 — talk-rls-a@tasful-dev.test

| 列 | 値 |
|----|-----|
| id | `a4a111ca-d70e-4444-bc1c-e7ca4efc5597` |
| email | `talk-rls-a@tasful-dev.test` |
| created_at | `2026-06-03T14:41:51.978075+00:00` |
| updated_at | `2026-06-18T09:50:50.918616+00:00` |
| app_metadata | `{"member_id":"u_me","provider":"email","providers":["email"],"talk_user_id":"u_me"}` |
| user_metadata | `{"email_verified":true,"talk_user_id":"u_me"}` |

#### U5 — talk-rls-b@tasful-dev.test

| 列 | 値 |
|----|-----|
| id | `15bb209a-7170-4702-8fd9-672bc5352616` |
| email | `talk-rls-b@tasful-dev.test` |
| created_at | `2026-06-03T14:41:52.500714+00:00` |
| updated_at | `2026-06-18T09:50:51.157086+00:00` |
| app_metadata | `{"member_id":"u_store","provider":"email","providers":["email"],"talk_user_id":"u_store"}` |
| user_metadata | `{"email_verified":true,"talk_user_id":"u_store"}` |

#### U6 — talk-rls-admin@tasful-dev.test

| 列 | 値 |
|----|-----|
| id | `9d9bd0bb-8849-4dd5-bd25-b51e230a900a` |
| email | `talk-rls-admin@tasful-dev.test` |
| created_at | `2026-06-03T14:41:52.765525+00:00` |
| updated_at | `2026-06-18T09:49:18.420758+00:00` |
| app_metadata | `{"member_id":"u_admin","provider":"email","providers":["email"],"role":"tasu_admin","talk_user_id":"u_admin"}` |
| user_metadata | `{"email_verified":true,"talk_user_id":"u_admin"}` |

#### U7 — talk-rls-worker@tasful-dev.test

| 列 | 値 |
|----|-----|
| id | `0f106b57-e056-451f-8fe4-079464c70815` |
| email | `talk-rls-worker@tasful-dev.test` |
| created_at | `2026-06-03T14:44:27.912648+00:00` |
| updated_at | `2026-06-16T20:40:54.234977+00:00` |
| app_metadata | `{"member_id":"u_worker","provider":"email","providers":["email"],"talk_user_id":"u_worker"}` |
| user_metadata | `{"email_verified":true,"talk_user_id":"u_worker"}` |

### 3.3 機械可読 JSON（rollback 用 · repo 内 baseline）

```json
{
  "baseline_id": "L1-BASELINE-2026-06-21",
  "project_ref": "ddojquacsyqesrjhcvmn",
  "captured_at": "2026-06-21",
  "auth_users": [
    {
      "id": "72d07af0-3d3b-4a87-8358-cae56a3ad721",
      "email": "anpi-rls-a@tasful-dev.test",
      "created_at": "2026-06-01T20:24:39.30581+00:00",
      "updated_at": "2026-06-18T08:54:49.523606+00:00",
      "app_metadata": {
        "member_id": "anpi_rls_member_a",
        "provider": "email",
        "providers": ["email"]
      },
      "user_metadata": {
        "email_verified": true,
        "member_id": "anpi_rls_member_a"
      }
    },
    {
      "id": "c8476454-e1f9-4efc-adfc-6fd6ba6102f9",
      "email": "anpi-rls-b@tasful-dev.test",
      "created_at": "2026-06-01T20:24:39.723269+00:00",
      "updated_at": "2026-06-18T08:54:49.746866+00:00",
      "app_metadata": {
        "member_id": "anpi_rls_member_b",
        "provider": "email",
        "providers": ["email"]
      },
      "user_metadata": {
        "email_verified": true,
        "member_id": "anpi_rls_member_b"
      }
    },
    {
      "id": "b77481c9-18f5-4130-854b-1a97db97c357",
      "email": "anpi-rls-admin@tasful-dev.test",
      "created_at": "2026-06-01T20:24:40.033193+00:00",
      "updated_at": "2026-06-18T08:54:49.970804+00:00",
      "app_metadata": {
        "member_id": "anpi_rls_admin",
        "provider": "email",
        "providers": ["email"],
        "role": "tasu_admin"
      },
      "user_metadata": {
        "email_verified": true,
        "member_id": "anpi_rls_admin"
      }
    },
    {
      "id": "a4a111ca-d70e-4444-bc1c-e7ca4efc5597",
      "email": "talk-rls-a@tasful-dev.test",
      "created_at": "2026-06-03T14:41:51.978075+00:00",
      "updated_at": "2026-06-18T09:50:50.918616+00:00",
      "app_metadata": {
        "member_id": "u_me",
        "provider": "email",
        "providers": ["email"],
        "talk_user_id": "u_me"
      },
      "user_metadata": {
        "email_verified": true,
        "talk_user_id": "u_me"
      }
    },
    {
      "id": "15bb209a-7170-4702-8fd9-672bc5352616",
      "email": "talk-rls-b@tasful-dev.test",
      "created_at": "2026-06-03T14:41:52.500714+00:00",
      "updated_at": "2026-06-18T09:50:51.157086+00:00",
      "app_metadata": {
        "member_id": "u_store",
        "provider": "email",
        "providers": ["email"],
        "talk_user_id": "u_store"
      },
      "user_metadata": {
        "email_verified": true,
        "talk_user_id": "u_store"
      }
    },
    {
      "id": "9d9bd0bb-8849-4dd5-bd25-b51e230a900a",
      "email": "talk-rls-admin@tasful-dev.test",
      "created_at": "2026-06-03T14:41:52.765525+00:00",
      "updated_at": "2026-06-18T09:49:18.420758+00:00",
      "app_metadata": {
        "member_id": "u_admin",
        "provider": "email",
        "providers": ["email"],
        "role": "tasu_admin",
        "talk_user_id": "u_admin"
      },
      "user_metadata": {
        "email_verified": true,
        "talk_user_id": "u_admin"
      }
    },
    {
      "id": "0f106b57-e056-451f-8fe4-079464c70815",
      "email": "talk-rls-worker@tasful-dev.test",
      "created_at": "2026-06-03T14:44:27.912648+00:00",
      "updated_at": "2026-06-16T20:40:54.234977+00:00",
      "app_metadata": {
        "member_id": "u_worker",
        "provider": "email",
        "providers": ["email"],
        "talk_user_id": "u_worker"
      },
      "user_metadata": {
        "email_verified": true,
        "talk_user_id": "u_worker"
      }
    }
  ]
}
```

---

## 4. 既存 text ID 利用箇所（L1 再確認）

### 4.1 TALK

| ソース | text_user_id | 行数 |
|--------|--------------|------|
| transaction_rooms.buyer_id | `u_me` | 11 |
| transaction_rooms.seller_id | `u_hiro` | 11 |
| transaction_reads.user_id | `u_me`, `u_hiro` | 12 reads 合計 |

**L0 差分:** なし

### 4.2 Marketplace

| ソース | text_user_id | 行数 |
|--------|--------------|------|
| listings.user_id | `u_me` | 27 |
| business_listings.user_id | `u_me` | 4 |
| business_listings.user_id | `00000000-0000-4000-b000-000000000001` | 1 |

### 4.3 profiles

| user_id | display_name |
|---------|--------------|
| `u_hiro` | ひろ |
| `u_me` | marketplace-rls-…-profile-touch |
| `u_sachi` | はるかまん |
| `u_store` | premium_home |

### 4.4 members

| user_id | rank | is_premium | identity_verified |
|---------|------|------------|-------------------|
| `u_hiro` | GOLD MEMBER | false | true |
| `u_me` | legend | true | true |
| `u_sachi` | PLATINUM MEMBER | true | true |
| `u_store` | PREMIUM MEMBER | true | false |

### 4.5 text ID マップ（Auth allowlist 外 · 触らない）

| text ID | auth 紐付け | DB 主利用 |
|---------|-------------|-----------|
| `u_me` | U4 talk-rls-a | TALK buyer · listings · profiles · members |
| `u_hiro` | （auth 行なし） | TALK seller · profiles · members |
| `u_store` | U5 talk-rls-b | profiles · members |
| `u_sachi` | （auth 行なし） | profiles · members |
| `u_admin` | U6 | auth のみ |
| `u_worker` | U7 | auth のみ |
| anpi_rls_* | U1–U3 | auth member_id のみ |

**L2 方針:** 新規 T1–T5 `@tasful.invalid` は **`u_auth_test_*` 系** · 上表 ID とは **分離**。

---

## 5. MATCH migration 未適用（再確認）

| 確認 | 結果 |
|------|------|
| `public.match_*` テーブル | **0 件** |
| `public.match_current_user_id()` | **不存在** |
| repo `supabase/migrations/20260621120000_match_schema_draft.sql` | **未適用** |
| repo `20260621130000_match_rls_draft.sql` | **未適用** |
| repo `20260621140000_match_rls_d2_talk_user_id_draft.sql` | **未適用** |

**判定:** **PASS**（L0 と一致）

---

## 6. Auth Hook 未 CREATE（再確認）

| 確認 | 結果 |
|------|------|
| `pg_proc` `%custom_access_token%` / `%access_token_hook%` | **0 件** |
| `public.custom_access_token_hook` | **不存在** |
| Dashboard Hook ENABLE | **本セッション未変更** · L0 時点 OFF 相当 |

**判定:** **PASS**

---

## 7. Supabase Pro PITR — Dashboard 手動確認チェックリスト

**本 L1 セッションでは Dashboard を開いていない。** L6（Hook ON）前までに ops が実施し、結果を repo 外 ops 記録に追記すること。

### 7.1 確認手順

| # | チェック | 記録欄 |
|---|----------|--------|
| PITR-1 | [ ] [Supabase Dashboard](https://supabase.com/dashboard/project/ddojquacsyqesrjhcvmn) → **Project Settings → Database** | |
| PITR-2 | [ ] **Plan** が Pro / Team / Enterprise か（Free なら PITR **無**） | Plan: ________ |
| PITR-3 | [ ] **Point in Time Recovery** の表示（Enabled / Disabled） | PITR: ________ |
| PITR-4 | [ ] **Daily backups** の有無 · 最新 backup 日時 | Last backup: ________ |
| PITR-5 | [ ] PITR 無の場合: L6 前に **Pro 昇格 or 論理 backup 手順**を product 承認 | Decision: ________ |
| PITR-6 | [ ] **Database → Backups** タブのスクリーンショット保存（repo 外） | File: ________ |

### 7.2 ゲート整理

| フェーズ | PITR 要否 |
|----------|-----------|
| **L2** allowlist ユーザー **作成**（Auth 新規） | PITR **推奨** · 未確認でも L2 可（本 baseline 済み） |
| **L3** metadata backfill（既存 7 件は不変） | 本 §3 baseline で **単行 revert 可** |
| **L6** Hook ON | PITR **または** 論理 backup **必須**（phased checklist） |

---

## 8. 追加 baseline（rollback 参照）

### 8.1 主要テーブル行数

| テーブル | 行数 |
|----------|------|
| transaction_rooms | 11 |
| transaction_reads | 12 |
| listings | 27 |
| business_listings | 5 |
| profiles | 4 |
| members | 4 |
| auth.users | 7 |

### 8.2 RLS 状態（変更検知用）

| テーブル | RLS enabled |
|----------|-------------|
| transaction_rooms | true |
| listings | true |
| profiles | true |
| members | true |

**policies（抜粋）:** `transaction_rooms_select_participant` · `listings_*_owner` · `profiles_*_owner` · `members_*_owner` — L0 と同一。

### 8.3 再取得コマンド

```bash
npx supabase db query --linked --yes -f sql/auth-hook-l1-backup-readonly.sql
```

---

## 9. rollback 手順（本 baseline 使用）

### 9.1 既存 7 ユーザー metadata 復元（L3 誤操作時）

**方法:** Supabase Admin API `PUT /auth/v1/admin/users/{id}` · **§3.3 JSON の `app_metadata` / `user_metadata` を merge 復元**

| 対象 uuid | 用途 |
|-----------|------|
| `72d07af0-…` | U1 anpi-a |
| `c8476454-…` | U2 anpi-b |
| `b77481c9-…` | U3 anpi-admin |
| `a4a111ca-…` | U4 talk-rls-a / u_me |
| `15bb209a-…` | U5 talk-rls-b |
| `9d9bd0bb-…` | U6 talk-rls-admin |
| `0f106b57-…` | U7 talk-rls-worker |

**検証:** 復元後 `sql/auth-hook-l1-backup-readonly.sql` 先頭クエリと **byte 同等**（`updated_at` は変動可 · metadata キー一致）。

### 9.2 新規 T1–T5（L2 以降）の rollback

| 操作 | 手順 |
|------|------|
| 新規 Auth ユーザー削除 | Admin API delete · **L2 記録 uuid のみ** |
| T1 backfill 取消 | `talk_user_id` / `member_id` キー削除 · またはユーザー削除 |

**注意:** 本 baseline **以前**の 7 件は L2–L3 で **変更しない**前提。

### 9.3 Hook / migration rollback（将来）

| 層 | 手順 |
|----|------|
| Hook ON | Dashboard OFF · **< 1 分** |
| Hook CREATE | `DROP FUNCTION public.custom_access_token_hook(jsonb)`（事前 migration） |
| MATCH schema | 別途 DROP migration · **本 baseline 行数と突合** |

### 9.4 DB 全体（最終手段）

- PITR 有: Dashboard から **L1 日時直前**へ restore（**全 DB 巻き戻し** · TALK テストデータ含む）
- PITR 無: §3 + §4 論理復元 + Hook OFF

---

## 10. L1 ゲート

| 項目 | 結果 |
|------|------|
| auth.users 7 件スナップショット | **PASS** |
| text ID 再確認 | **PASS** · L0 一致 |
| MATCH 未適用 | **PASS** |
| Hook 未 CREATE | **PASS** |
| PITR Dashboard | **手動未完了** · §7 記載 · **L2 非阻害** |
| 書込禁止遵守 | **PASS** |

---

## 11. 次ステップ（L2）

| 順 | 作業 |
|----|------|
| 1 | Dashboard §7 PITR チェック（ops · 任意だが L6 前必須） |
| 2 | T1–T5 **`@tasful.invalid`** Auth ユーザー **新規作成** |
| 3 | UUID を repo 外 allowlist / mapping CSV へ |
| 4 | **既存 7 件 metadata は変更しない** |

---

## 12. 判定

### **READY_FOR_LINKED_REF_L2_ALLOWLIST**

**理由**

- L1 必須項目（§1）を READ-ONLY で完了
- rollback 可能な **auth.users 全量 baseline**（§3.3 JSON）を固定
- text ID · MATCH · Hook 状態を L0 と **一致確認**
- PITR は Dashboard 手動（§7）· **L2 allowlist 作成を阻害しない**
- 書込 · Dashboard · Hook · migration **未実施**

**BLOCKED_WITH_REASON:** 該当なし

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-linked-ref-l0-inventory.md` | L0 結果 |
| `reports/tasful-auth-hook-linked-ref-phased-checklist.md` | L1–L12 |
| `sql/auth-hook-l1-backup-readonly.sql` | 再取得 |
