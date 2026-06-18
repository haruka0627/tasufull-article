# 安否 RLS verify 用 JWT 更新結果

**実施日:** 2026-06-17  
**目的:** P0 dev RLS DROP 後の verify で発生した JWT 期限切れを解消し、`.env` から単独 verify / 再監査が安定して実行できる状態にする  
**対象 DB:** linked Supabase `ddojquacsyqesrjhcvmn`  
**関連:** [`dev-rls-p0-drop-result.md`](dev-rls-p0-drop-result.md)

---

## 1. 総合判定: **PASS**

| 確認項目 | 結果 |
|----------|------|
| `.env` に fresh JWT 反映 | ✅ 3 キー更新済み |
| 期限切れ JWT 残留 | ✅ なし（各キー 1 件のみ · 有効期限内） |
| `verify-anpi-rls-real-db.mjs` | ✅ **17/17 OK** |
| `verify-anpi-no-response-rls-p0.mjs` | ✅ **PASS**（0 errors） |
| RLS SQL / UI 変更 | ✅ なし |

---

## 2. 実行コマンド

```powershell
cd C:\Users\rubih\tasufull-article

node scripts/issue-anpi-rls-jwt.mjs --write-env

node scripts/verify-anpi-rls-real-db.mjs
node scripts/verify-anpi-no-response-rls-p0.mjs
```

| コマンド | 終了コード | 備考 |
|----------|------------|------|
| `issue-anpi-rls-jwt.mjs --write-env` | 0 | テストユーザー 3 件更新 · `.env` 書き込み成功 |
| `verify-anpi-rls-real-db.mjs` | 0 | P9-5 実 DB 検証 |
| `verify-anpi-no-response-rls-p0.mjs` | 0 | Phase2 P0 検証 |

---

## 3. `.env` 更新内容（secret 非掲載）

`mergeEnvFile` により既存キーを **上書き**（重複行は作らない）。

| キー | 件数 | 有効期限（UTC） | 状態 |
|------|------|-----------------|------|
| `ANPI_RLS_USER_A_JWT` | 1 | 2026-06-17T03:07:06Z | 有効 |
| `ANPI_RLS_USER_B_JWT` | 1 | 2026-06-17T03:07:07Z | 有効 |
| `ANPI_RLS_ADMIN_JWT` | 1 | 2026-06-17T03:07:07Z | 有効 |

同時更新（既存値があれば上書き）:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

**テストユーザー（member_id 確認）:**

| ロール | email（公開テスト用） | member_id |
|--------|----------------------|-----------|
| User A | `anpi-rls-a@tasful-dev.test` | `anpi_rls_member_a` |
| User B | `anpi-rls-b@tasful-dev.test` | `anpi_rls_member_b` |
| Admin | `anpi-rls-admin@tasful-dev.test` | `anpi_rls_admin`（`tasu_admin`） |

**重複チェック:** `ANPI_RLS_*_JWT` の duplicate **none**

---

## 4. verify 結果

### 4.1 `verify-anpi-rls-real-db.mjs` — **PASS（17/17）**

- JWT member_id 解決 OK
- anon insert / 他人 select 拒否 OK
- User A/B 本人 CRUD 分離 OK
- 契約者 `contract_holder_id` 参照 OK
- admin 全件 select / update OK
- dev ポリシー未検出（P0 DROP 後状態維持）

### 4.2 `verify-anpi-no-response-rls-p0.mjs` — **PASS**

- anon INSERT `anpi_check_sessions` 拒否
- contract_holder INSERT / stranger READ 拒否
- audit INSERT OK · UPDATE/DELETE 拒否
- probe 行 cleanup OK

---

## 5. 背景・注意

| 項目 | 内容 |
|------|------|
| 前回 FAIL 原因 | `.env` 内 JWT 期限切れ（PGRST303） |
| 今回の対処 | `--write-env` で fresh token を `.env` に永続化 |
| JWT 寿命 | Supabase access token 既定 ~1 時間。期限切れ時は同コマンドを再実行 |
| セキュリティ | 本レポートに JWT 本体・service_role 等の secret は記載しない |

---

## 6. 次にやるべきこと

1. 安否 verify を定期実行する場合、期限切れ前に `node scripts/issue-anpi-rls-jwt.mjs --write-env` を再実行
2. CI で verify する場合は、実行直前に JWT 発行ステップを挟む（`.env` 依存を避ける）
3. P0 dev RLS 監査は [`dev-rls-p0-drop-result.md`](dev-rls-p0-drop-result.md) の post-check SQL で継続確認

**Verdict:** `.env` の安否 verify 用 JWT は fresh token に更新済み。単独 verify は `.env` 読み込みのみで **PASS**。
