# 協力パートナー管理 — 実ログイン検証

| 項目 | 内容 |
|------|------|
| 確認日時 | 2026-06-23T01:35:22.909Z |
| ログイン URL | http://127.0.0.1:8788/login.html?return=builder/partner-management.html |
| 運営アカウント | talk-rls-admin@tasful-dev.test |
| SERVICE_KEY | あり（Supabase CLI 経由） |

## ステップ結果

| # | 内容 | 結果 |
|---|------|------|
| 1 | DEV_SKIP_AUTH スキップ（return=partner-management） | **PASS** |
| 2 | 実 Supabase ログイン（ブラウザ） | **PASS** |
| 3 | getSession() access_token | **PASS** |
| 4 | partner-list Bearer | **PASS (200)** |
| 5 | partner_role 未設定 → 権限エラー | **PASS** |
| 6 | raw_app_meta_data partner_role=admin | **PASS** |
| 7 | 再ログイン JWT partner_role | **PASS** |
| 8 | 件数カード・一覧表示 | **PASS** |

## 総合: PASS ✅

### 手動確認用

| 項目 | 値 |
|------|-----|
| ログイン URL | `http://127.0.0.1:8788/login.html?return=builder/partner-management.html` |
| 運営アカウント | `talk-rls-admin@tasful-dev.test` |
| パスワード | `TalkRlsAdmin1!`（検証時に Admin API でリセット済み） |
| partner_role | **admin**（付与済み） |

### ステップ詳細

1. **DEV_SKIP_AUTH スキップ** — `return=builder/partner-management.html` のため localhost でも実ログインフォーム表示
2. **実 Supabase ログイン** — メール/パスワード送信後 `partner-management.html` へ遷移
3. **getSession()** — `hasSession: true`, `hasAccessToken: true`
4. **partner-list** — role 付与後 `Authorization: Bearer <access_token>` 付き HTTP **200**、3件
5. **partner_role 未設定** — UI「権限がありません」、`partner-list` 未送信（クライアント 403）
6. **partner_role 付与** — Auth Admin API で `partner_role: admin`
7. **再ログイン** — 新 JWT に `partner_role: admin`
8. **UI** — hold **1** / approved **1**、申請一覧 **3件**

---

詳細 JSON: `reports/partner-mgmt-real-login-verify.json`

再検証:

```bash
node --env-file=.env scripts/verify-partner-mgmt-real-login.mjs
```
