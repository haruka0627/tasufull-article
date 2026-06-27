# AI 秘書 P0 — Google OAuth Edge Smoke

**実施日:** 2026-06-28  
**Git HEAD:** `75580af` — `docs(secretary): add deepseek production success smoke`  
**種別:** Migration · Edge deploy · mock smoke 証跡

**JSON:** `reports/ai-secretary-google-oauth-p0-edge-smoke.json`

**DeepSeek:** 触らず · 別途 P0 Go 済（本タスク対象外）

---

## 総合判定: **Go（Edge mock smoke）**

| 領域 | 判定 |
| --- | --- |
| Migration `20260710100000` | ✅ **適用済** |
| Edge deploy | ✅ **成功** |
| **404 NOT_FOUND** | ✅ **解消** |
| mock health / status | ✅ **200 JSON** |
| Dashboard UI | ✅ **PASS**（1280 / 390） |
| live OAuth | ⏸ **未実施**（意図どおり） |

---

## 1. Migration

**File:** `supabase/migrations/20260710100000_secretary_google_token_vault.sql`

| 項目 | 結果 |
| --- | --- |
| 適用前 | version **未登録** · tables **なし** |
| 適用 | `supabase db query --linked -f …` |
| 履歴 | `migration repair --status applied 20260710100000` |
| `secretary_google_token_vault` | **present** |
| `secretary_google_oauth_pending` | **present** |
| RLS | **enabled** |
| anon/authenticated REVOKE | **yes** |

---

## 2. Edge deploy

```bash
npx supabase functions deploy secretary-google-oauth secretary-google-tools \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

| Function | 結果 |
| --- | --- |
| `secretary-google-oauth` | ✅ deployed |
| `secretary-google-tools` | ✅ deployed |

---

## 3. Supabase Secrets（presence のみ）

| Secret | Presence |
| --- | --- |
| **`SECRETARY_GOOGLE_OAUTH_MOCK`** | **present** (`1`) |
| `SECRETARY_GOOGLE_CLIENT_ID` | **absent** |
| `SECRETARY_GOOGLE_CLIENT_SECRET` | **absent** |
| `SECRETARY_GOOGLE_REDIRECT_URI` | **absent** |

Secret / Token **値は記載しない**。

---

## 4. Edge smoke（production Supabase）

**Base:** `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1`

| Probe | HTTP | 署名 | 判定 |
| --- | ---: | --- | --- |
| **tools · health** | **200** | `ok:true` · `mock:true` · `service: secretary-google-tools` | ✅ |
| **tools · capabilities** | **200** | `googleConnected:false` | ✅ |
| **oauth · status** | **200** | `mock:true` · `connected:false` | ✅ Google未接続 |
| **oauth · connect** | **503** | `redirect_uri_not_configured` | △ 期待（REDIRECT_URI 未設定） |

**404 NOT_FOUND:** **解消**（deploy 前は全 probe 404）

---

## 5. Dashboard smoke（8788）

**URL:** `http://127.0.0.1:8788/admin-operations-dashboard.html`

| Viewport | HTTP | Google UI | Connect btn | JS errors |
| --- | ---: | --- | --- | ---: |
| **1280×900** | 200 | 「Google未接続」 | ✅ | **0** |
| **390×844** | 200 | 「Google未接続」 | ✅ | **0** |

`TasuSecretaryGoogleOAuthClient` · `TasuSecretaryGoogleConnectUI` ロード確認済。

---

## 6. 次アクション（live OAuth 前）

1. Supabase Secret: **`SECRETARY_GOOGLE_REDIRECT_URI`**（callback URL · 値非コミット）
2. mock connect E2E — `connect` → `mock_callback` → `status.connected:true`
3. live 用: `SECRETARY_GOOGLE_CLIENT_ID` · `CLIENT_SECRET` + GCP OAuth 設定
4. Gmail / Calendar read-only smoke（Edge `action=gmail_read` / `calendar_read`）

---

## 参照

- `reports/secretary-google-phase6b-oauth-token-vault.md`
- `reports/ai-secretary-p0-production-smoke.md`（Google 404 事前証跡）
