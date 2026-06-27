# AI 秘書 P0 — Google OAuth Mock Connect / Callback E2E

**実施日:** 2026-06-28  
**Git HEAD:** `52127d2` — `docs(secretary): add google oauth edge smoke evidence`  
**種別:** Secret 設定 · mock connect/callback E2E · Dashboard smoke 証跡

**JSON:** `reports/ai-secretary-google-oauth-p0-mock-connect.json`

**スコープ:** AI秘書 Google OAuth / Tools のみ · live OAuth 未実施 · Secret/Token 値非記載

---

## 総合判定: **Go（mock connect / callback E2E）**

| 領域 | 判定 |
| --- | --- |
| `SECRETARY_GOOGLE_REDIRECT_URI` | ✅ **present** |
| Secrets presence | ✅ 期待どおり |
| connect smoke | ✅ **200** · mock · 503 解消 |
| mock callback E2E | ✅ **connected:true** |
| status / capabilities | ✅ **connected · googleConnected** |
| Gmail / Calendar read mock | ✅ **200** |
| Dashboard 8788 | ✅ **PASS**（1280 / 390） |

---

## 1. Supabase Secret — REDIRECT_URI

| Secret | Presence |
| --- | --- |
| **`SECRETARY_GOOGLE_OAUTH_MOCK`** | **present** |
| **`SECRETARY_GOOGLE_REDIRECT_URI`** | **present** |
| `SECRETARY_GOOGLE_CLIENT_ID` | **absent** |
| `SECRETARY_GOOGLE_CLIENT_SECRET` | **absent** |

**Callback パターン（値は Secret のみ · 非コミット）:**

`https://<project>.supabase.co/functions/v1/secretary-google-oauth?action=callback`

---

## 2. Edge redeploy（Dashboard CORS ブロッカー解消）

Dashboard connect が `Failed to fetch` となる原因: ブラウザ preflight で `x-secretary-dev-user-id` が CORS Allow-Headers に未登録。

| 対応 | 結果 |
| --- | --- |
| `supabase/functions/_shared/cors.ts` に `x-secretary-dev-user-id` 追加 | ✅ |
| redeploy `secretary-google-oauth` · `secretary-google-tools` | ✅ |
| preflight `OPTIONS` | **204** · header 許可確認 |

---

## 3. OAuth connect smoke（production Edge）

**Base:** `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/secretary-google-oauth`

| Probe | HTTP | 署名 | 判定 |
| --- | ---: | --- | --- |
| **connect** | **200** | `mock:true` · `state` 生成 · `authUrl` あり | ✅ 503 **解消** |
| **mock_callback** | **200** | `connected:true` · `mock:true` · email あり | ✅ |
| **status**（callback 後） | **200** | `connected:true` · `mock:true` | ✅ |
| **disconnect**（cleanup） | **200** | `ok:true` | ✅ |

**503 `redirect_uri_not_configured`:** **解消済**（REDIRECT_URI present + client `redirectUri` 送信）

Token / refresh / code_verifier 等はレスポンスに **露出なし**（redact 確認済）。

---

## 4. Tools capabilities / read-only mock

**Base:** `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/secretary-google-tools`

| Probe | HTTP | 署名 | 判定 |
| --- | ---: | --- | --- |
| **capabilities** | **200** | `googleConnected:true` | ✅ |
| **gmail** · `method=labels.list` | **200** | `mock:true` · labels **4** | ✅ |
| **calendar_read** · `method=calendarList.list` | **200** | `mock:true` | ✅ |

---

## 5. Dashboard smoke（8788）

**URL:** `http://127.0.0.1:8788/admin-operations-dashboard.html`

**手順:** 有効 `auth.users` id を `sessionStorage` 注入 → 「接続する」→ mock callback 自動完了

| Viewport | HTTP | Before | After | Connect btn | JS fatal |
| --- | ---: | --- | --- | --- | ---: |
| **1280×900** | 200 | Google未接続 | Google接続済み（mock） | hidden | **0** |
| **390×844** | 200 | Google未接続 | Google接続済み（mock） | hidden | **0** |

`data-state=connected` · `data-mock=1` 確認済。

---

## 6. 未実施（意図どおり）

- live Google OAuth（CLIENT_ID / CLIENT_SECRET 未設定）
- GCP OAuth consent / 本番 redirect 検証

---

## 参照

- `reports/ai-secretary-google-oauth-p0-edge-smoke.md`（404 解消 · REDIRECT_URI 未設定時）
- `supabase/migrations/20260710100000_secretary_google_token_vault.sql`
