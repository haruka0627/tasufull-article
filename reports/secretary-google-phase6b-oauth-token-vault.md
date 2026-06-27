# AI秘書 Phase 6-B — OAuth + Token Vault + Edge Skeleton

**Status:** ✅ 実装完了（2026-06-27）  
**設計正本:** `reports/secretary-google-workspace-plan.md`  
**前提設計 commit:** `b774c61`

---

## 概要

AI秘書専用 Google OAuth（Authorization Code + PKCE · offline）の **骨組み** を追加。Token Vault（Supabase）· Edge Functions · ダッシュボード最小 UI。

**未実装（Phase 6-C+）:** Gmail / Calendar / Contacts / Drive の実 API 呼び出し。

---

## 実装一覧

| 領域 | ファイル |
| --- | --- |
| **Migration** | `supabase/migrations/20260710100000_secretary_google_token_vault.sql` |
| **Shared Edge** | `supabase/functions/_shared/secretary-google-oauth.ts` |
| **OAuth Edge** | `supabase/functions/secretary-google-oauth/index.ts` |
| **Tools Edge** | `supabase/functions/secretary-google-tools/index.ts` |
| **Client** | `admin-ai-secretary-google-oauth-client.js` |
| **UI** | `admin-ai-secretary-google-connect-ui.js` |
| **Dashboard** | `admin-operations-dashboard.html` · `.css` · `admin-ai-secretary-phase2.js` |
| **Test** | `scripts/test-secretary-google-oauth-phase6b.mjs` |

---

## OAuth Skeleton

| 項目 | 内容 |
| --- | --- |
| **Grant** | Authorization Code + **PKCE (S256)** |
| **Offline** | `access_type=offline` · 初回 `prompt=consent` |
| **Actions** | `connect` · `callback` (GET) · `status` · `disconnect` · `refresh` · `mock_callback` |
| **Mock** | `SECRETARY_GOOGLE_OAUTH_MOCK=1` または Client ID/Secret 未設定 |
| **Platform 分離** | 別 Secret 名 · 別 Edge · Supabase Auth Google provider 非共用 |

---

## Token Vault

**Tables:**

- `secretary_google_token_vault` — provider · google_account_email · access_token · refresh_token · scope · expires_at
- `secretary_google_oauth_pending` — PKCE state · code_verifier · TTL 10min

**RLS:** 有効 · **anon/authenticated へ REVOKE ALL** — クライアント直接 SELECT 不可。Edge は **service_role** のみ。

---

## Edge Skeleton

| Function | 役割 |
| --- | --- |
| `secretary-google-oauth` | connect / callback / status / disconnect / refresh |
| `secretary-google-tools` | health · capabilities · execute → **501 stub** |

---

## UI Skeleton

`admin-operations-dashboard.html` AIチャット見出し下:

- `Google未接続` / `Google接続済み`
- **接続する** / **切断する**（mock 時は mock_callback で即接続）

---

## Security

| チェック | 状態 |
| --- | --- |
| client_secret ブラウザ非公開 | ✅ Edge env のみ |
| refresh_token ブラウザ非公開 | ✅ Vault + sanitizeForClient |
| access_token ブラウザ非公開 | ✅ 同上 |
| ログ/レスポンス token 除外 | ✅ sanitizeForClient |
| Secret 名参照のみ（実値なし） | ✅ |

**Secret 名（設定は人間作業）:**

- `SECRETARY_GOOGLE_CLIENT_ID`
- `SECRETARY_GOOGLE_CLIENT_SECRET`
- `SECRETARY_GOOGLE_REDIRECT_URI`

---

## テスト

```bash
node scripts/test-secretary-google-oauth-phase6b.mjs
```

回帰:

```bash
node scripts/test-secretary-ai-voice-integration-phase1.mjs
node scripts/test-tasful-ai-voice-integration-phase1.mjs
node scripts/test-builder-ai-voice-integration-phase1.mjs
```

---

## 8788 手動確認

`npm run build:pages` 後 · `npm run dev` ·  
http://127.0.0.1:8788/admin-operations-dashboard.html

- Google 接続 UI 表示
- Voice UI 維持
- Console JS Error 0
- 1280 / 768 / 390 · 横スクロールなし

---

## 次フェーズ

| Phase | 内容 |
| --- | --- |
| **6-C** | Gmail read-only |
| **6-D** | Gmail write + Human Gate |
| **6-E〜H** | Calendar · Contacts · Drive |
