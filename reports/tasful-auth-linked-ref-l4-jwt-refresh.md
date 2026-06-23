# TASFUL — Auth Hook linked ref L4 JWT refresh / auth.jwt() / TasuAuthCurrentUser 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 対象ユーザー | **T1** · `t1@tasful.invalid` · `2d537fc9-ee67-4da8-97d3-bafe824ba466` |
| 前提 | `tasful-auth-linked-ref-l3-backfill-t1.md` · L3 判定 `READY_FOR_LINKED_REF_L4_JWT_REFRESH` |
| Hook | **OFF** · 関数 **未 CREATE** |
| 方法 | **READ-ONLY 検証のみ**（login · refresh · RPC · ロジックエミュレーション） |

---

## 1. 実施サマリ

| # | L4 確認項目 | 結果 |
|---|-------------|------|
| 1 | T1 login | **PASS** HTTP 200 |
| 2 | session refresh | **PASS** HTTP 200 |
| 3 | JWT decode（login / refresh） | **PASS**（§4） |
| 4 | Postgres `auth.jwt()` 経路 | **PASS**（§5 · RPC proxy） |
| 5 | TasuAuthCurrentUser 解決 | **PASS**（§6） |
| 6 | 3 系統一致 | **PASS**（§7） |
| 7 | T2–T5 / 既存 7 件 / metadata 無変更 | **PASS**（§8） |
| 8 | Hook / MATCH 無変更 | **PASS**（§9） |

**実行**

```bash
node scripts/verify-auth-hook-l4-jwt-refresh.mjs
npx supabase db query --linked --yes -f sql/auth-hook-l4-jwt-readonly.sql
```

---

## 2. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| INSERT / UPDATE / DELETE | ✓ |
| T1–T5 / 既存 7 件 metadata 変更 | ✓ |
| user_metadata 変更 | ✓ |
| Hook CREATE / ENABLE | ✓ |
| RLS / MATCH / UI / Dashboard | ✓ |

---

## 3. 検証手順

1. `t1@tasful.invalid` password grant login  
2. access token decode  
3. `refresh_token` grant  
4. refresh 後 access token decode  
5. PostgREST `POST /rest/v1/rpc/talk_current_user_id`（Bearer = T1 access token）  
6. `auth-current-user-core.mjs` + production lockdown で `TasuAuthCurrentUser` 相当を解決  
7. Admin API **READ** で T1 `app_metadata` 不変確認（service_role · 書込なし）

**非掲載:** access_token · refresh_token · password · service_role

---

## 4. JWT decode 結果（Hook OFF）

### 4.1 Login 直後

| claim | 値 |
|-------|-----|
| `sub` | `2d537fc9-ee67-4da8-97d3-bafe824ba466` |
| `role` | `authenticated` |
| `app_metadata.talk_user_id` | **`t1`** |
| `app_metadata.member_id` | **`t1`** |
| `app_metadata.provider` | `email` |
| `app_metadata.providers` | `["email"]` |

### 4.2 Refresh 後

| claim | 値 |
|-------|-----|
| `sub` | `2d537fc9-ee67-4da8-97d3-bafe824ba466` |
| `role` | `authenticated` |
| `app_metadata.talk_user_id` | **`t1`** |
| `app_metadata.member_id` | **`t1`** |
| `app_metadata.provider` | `email` |
| `app_metadata.providers` | `["email"]` |

**所見:** login / refresh **同一 claim** · provider/providers **維持**。

---

## 5. Postgres `auth.jwt()` 確認

### 5.1 直接 SQL 制約

`auth.jwt()` は **PostgREST リクエストにユーザ JWT が載ったコンテキスト**でのみ評価される。`supabase db query --linked`（service コンテキスト）では **NULL** になり得るため、L4 では **既存 RPC** を使用。

### 5.2 RPC proxy（実測）

| タイミング | 呼び出し | 結果 |
|------------|----------|------|
| login token | `POST /rest/v1/rpc/talk_current_user_id` | **`"t1"`** |
| refresh token | 同上 | **`"t1"`** |

### 5.3 `talk_current_user_id()` と `auth.jwt()` の対応

関数定義（READ · `sql/auth-hook-l4-jwt-readonly.sql` §4）:

```sql
coalesce(
  auth.jwt() ->> 'talk_user_id',
  auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
  ...
  auth.jwt() -> 'app_metadata' ->> 'member_id',
  ...
)
```

T1 では root `talk_user_id` 無し · **`app_metadata.talk_user_id` = `"t1"`** が第一ヒット。

| 期待 SQL 式（T1 セッション） | 実効結果 |
|------------------------------|----------|
| `auth.jwt() -> 'app_metadata' ->> 'talk_user_id'` | **`t1`**（RPC 結果と一致） |
| `auth.jwt() -> 'app_metadata' ->> 'member_id'` | **`t1`**（L3 backfill · JWT decode と一致 · coalesce 同値） |

---

## 6. TasuAuthCurrentUser（Frontend ロジック · ファイル未変更）

**方法:** `auth-current-user.js` と同型の解決を Node で実施（`talkProductionMode: true` · demo fallback **無効**）。

| フィールド | 期待 | 実測 |
|------------|------|------|
| `talkUserId` | `t1` | **`t1`** |
| `memberId` | `t1` | **`t1`** |
| `authUserId` / `sub` | `2d537fc9-ee67-4da8-97d3-bafe824ba466` | **一致** |
| `source` | `jwt` | **`jwt`** |
| `authenticated` | true | **true** |

**注:** 本番 JWT 経路では `chat-supabase-config.js` の `currentUserId`（demo `u_me`）は **使われない**。業務 ID は **`talkUserId` = `"t1"`** が canonical。

---

## 7. 3 系統一致

| 系統 | talk / member | 一致 |
|------|---------------|------|
| JWT decode（refresh） | `t1` / `t1` | ✓ |
| RPC `talk_current_user_id` | `t1` | ✓ |
| TasuAuthCurrentUser | `t1` / `t1` | ✓ |

**判定:** **PASS**

---

## 8. 他ユーザー · metadata 不変

### 8.1 T2–T5

| email | talk_user_id | member_id |
|-------|--------------|-----------|
| t2–t5@tasful.invalid | **NULL** | **NULL** |

（t1 のみ `t1`）

### 8.2 既存 7 件

L1 §3.3 / L2 §5 と **同一**（L4 READ 確認 · **diff なし**）

### 8.3 T1 user_metadata

`{"email_verified":true}` — **L2/L3 から不変**

---

## 9. Hook / MATCH

| 確認 | 結果 |
|------|------|
| `custom_access_token_hook` | **0 件** |
| `match_*` テーブル | **0** |

---

## 10. 成果物

| ファイル | 用途 |
|----------|------|
| `scripts/verify-auth-hook-l4-jwt-refresh.mjs` | L4 自動検証 |
| `sql/auth-hook-l4-jwt-readonly.sql` | READ 監査 · 関数定義参照 |

---

## 11. 次ステップ（L5）

| 順 | 作業 |
|----|------|
| 1 | `custom_access_token_hook` migration **CREATE**（Dashboard **OFF**） |
| 2 | CREATE 後も token 挙動 **不変**確認（L5 ゲート） |
| 3 | その後 L6 Hook ENABLE（別フェーズ） |

---

## 12. 判定

### **READY_FOR_LINKED_REF_L5_HOOK_CREATE_OFF**

**理由**

- Hook OFF のまま T1 で **login · refresh · JWT · RPC(auth.jwt  proxy) · TasuAuthCurrentUser** が **`t1` で一致**
- 変更操作 **なし** · 他ユーザー **無影響**
- MATCH / Hook **未変更**

**BLOCKED_WITH_REASON:** 該当なし

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-linked-ref-l3-backfill-t1.md` | L3 T1 backfill |
| `auth-current-user.js` | Client 解決順 |
| `scripts/lib/auth-current-user-core.mjs` | L4 Node 検証 |
| `sql/marketplace-rls-production.sql` | `talk_current_user_id()` 定義 |
