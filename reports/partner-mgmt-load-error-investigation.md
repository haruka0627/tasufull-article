# 協力パートナー管理画面 — 読み込みエラー調査

| 項目 | 内容 |
|------|------|
| 確認日時 | 2026-06-23 |
| 対象 URL | `http://127.0.0.1:8788/builder/partner-management`（実体: `partner-management.html`） |
| 現象 | 画面は表示されるが件数 0、一覧に「読み込みエラー / ログインしてください」 |

---

## 総合判定

**原因: Supabase セッション未確立（クライアント側 `not_logged_in`）**

- HTTP ステータス: **Edge Function には未到達**（クライアントで 401 相当を throw）
- `partner-list` / `partner-get` の Network 記録: **なし**
- `supabase.auth.getSession()`: **session = null**, `tasu-supabase-auth` 長さ 0
- `Authorization: Bearer <access_token>`: **付与されない**（fetch 前に失敗）
- JWT `app_metadata.partner_role`: **未評価**（セッションなし）

localhost では `member-auth.js` の `DEV_SKIP_AUTH` によりダッシュボード等は「ログイン済み」に見えますが、**Supabase Auth セッションは作られません**。協力パートナー API は `partner-api.js` が必ず `getSession()` の JWT を Bearer で送るため、この状態では一覧取得できません。

---

## 1. Console error

| シナリオ | 件数 | 内容 |
|----------|------|------|
| 未ログイン（storage クリア） | **0**（修正後） | — |
| 修正前 | 1 | `SyntaxError: Invalid or unexpected token`（`partner-management.js` 177 行目の引用符不一致） |

**修正済み**: `partner-management.js` 177 行目 `'` / `"` の不一致を修正。これによりエラー UI も正しく描画されます。

---

## 2. Network

| エンドポイント | 結果 |
|----------------|------|
| `partner-list` | **リクエスト未送信** |
| `partner-get` | **リクエスト未送信** |
| Supabase `/auth/v1/` | ページロード時の静的読み込みのみ（セッション復元なし） |

`partner-api.js` のフロー:

1. `partnerList()` → `authFetch()` → `buildAuthHeaders()` → `getSessionAsync()`
2. session / access_token なし → `makeAuthError("not_logged_in", …, 401)` を **throw**
3. `ensurePartnerOpsAuth()` まで到達しないため **partner_role チェックも未実施**

---

## 3. `getSession()` の結果（未ログイン時）

```json
{
  "hasSession": false,
  "hasAccessToken": false,
  "rawAuthStorageLength": 0,
  "storageKeys": []
}
```

---

## 4. `partnerList()` プローブ（同一ページ内）

```json
{
  "ok": false,
  "code": "not_logged_in",
  "status": 401,
  "message": "ログインしてください"
}
```

※ これは **クライアント生成の 401** であり、Edge Function の HTTP 401 ではありません。

---

## 5. ログイン済みだが `partner_role` なしの場合（別シナリオ）

過去の live 検証（`reports/partner-api-auth-live200-result.md`）より:

| 項目 | 結果 |
|------|------|
| アカウント | `talk-rls-admin@tasful-dev.test` でサインイン成功 |
| JWT `partner_role` | **なし** |
| UI メッセージ | 「この操作を行う権限がありません（partner_role: …）」 |
| `partner-list` Network | **未送信**（`ensurePartnerOpsAuth` で 403 相当を throw） |
| Auth Admin 上の `partner_role` 付与ユーザー | **0 件** |

この場合は **403 相当（forbidden）** で、メッセージは「ログインしてください」ではなく権限エラーになります。

---

## 6. チェックリスト対応表

| # | 確認項目 | 結果 |
|---|----------|------|
| 1 | Console error | 修正前: SyntaxError 1 件 / 修正後: 0 |
| 2 | partner-list / auth Network | 失敗リクエストなし（未送信） |
| 3 | getSession() | null（未ログイン時） |
| 4 | Authorization Bearer | 付与されず |
| 5 | JWT partner_role | セッションなしのため未確認 |
| 6 | Edge Function 401/403/500 | **未到達** |
| 7 | 401 系 | ✅ ログイン状態なし / localhost dev skip が主因 |
| 8 | 403 系 | ログイン後に role 未付与のとき発生（別パス） |
| 9 | 500 系 | 該当なし（現状） |

---

## 7. 根本原因の整理

```
localhost (127.0.0.1)
  └─ member-auth DEV_SKIP_AUTH = true
       └─ login.js がフォーム送信を即リダイレクト（Supabase サインインしない）
            └─ localStorage に tasu-supabase-auth なし
                 └─ partner-api getSessionAsync() → not_logged_in
                      └─ 件数 0 / 「ログインしてください」
```

協力パートナー管理は `member-auth.js` を使わず、**実 Supabase セッション + `app_metadata.partner_role`** が必須です。

---

## 8. 実施した修正

| ファイル | 内容 |
|----------|------|
| `builder/partner-management.js` | 引用符 SyntaxError 修正、未ログイン/403 向けヒント + ログインリンク |
| `login.js` | `return` が partner-management / partner-detail のときは **DEV_SKIP_AUTH を無効化**し実ログインを要求 |

---

## 9. 運用側で必要な作業

1. **ログイン**: `login.html?return=builder/partner-management.html` から運営アカウントでサインイン
2. **partner_role 付与**: Supabase Dashboard → Authentication → Users → `raw_app_meta_data` に例:
   ```json
   { "partner_role": "admin" }
   ```
3. **再ログイン**: 付与前の JWT には role が含まれないため必須
4. **確認**: 一覧が 3 件、統計が DB と一致すること

検証スクリプト:

```bash
node --env-file=.env scripts/verify-partner-api-auth-live200.mjs
```

---

## 10. 関連ファイル

- JSON: `reports/partner-mgmt-load-error-investigation.json`
- 調査スクリプト: `scripts/investigate-partner-mgmt-load-error.mjs`
- API クライアント: `partner-api.js`
- 過去 live 検証: `reports/partner-api-auth-live200-result.md`
