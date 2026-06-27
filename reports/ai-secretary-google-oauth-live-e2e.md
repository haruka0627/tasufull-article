# AI 秘書 P0 — Google OAuth Live E2E

**実施日:** 2026-06-28  
**Git HEAD:** `938cc98` — `docs(secretary): add google oauth live prep`  
**種別:** live 移行 · Secrets · redeploy · OAuth E2E 証跡

**JSON:** `reports/ai-secretary-google-oauth-live-e2e.json`

**Secret / Token 値は記載しない**

---

## 総合判定

| 領域 | 判定 |
| --- | --- |
| **Live 移行（Secrets · MOCK 解除 · redeploy · connect）** | ✅ **Go** |
| **OAuth callback · Vault · Gmail/Calendar live** | ❌ **No-Go**（GCP test user 未登録） |
| **Dashboard UI（未接続）** | ✅ **PASS**（1280 / 390 · JS fatal 0） |

---

## 1. Supabase Secrets

| Secret | Presence |
| --- | --- |
| `SECRETARY_GOOGLE_CLIENT_ID` | **present** |
| `SECRETARY_GOOGLE_CLIENT_SECRET` | **present** |
| `SECRETARY_GOOGLE_REDIRECT_URI` | **present** |
| `SECRETARY_GOOGLE_OAUTH_MOCK` | **absent**（unset 済） |

`.env` から CLI 経由で登録（値はログ非出力）。

---

## 2. Edge redeploy

| Function | 結果 |
| --- | --- |
| `secretary-google-oauth` | ✅ deployed |
| `secretary-google-tools` | ✅ deployed |

Secret 変更後に redeploy 実施。

---

## 3. Live OAuth connect smoke

**Base:** `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/secretary-google-oauth`

| Probe | HTTP | 署名 | 判定 |
| --- | ---: | --- | --- |
| **connect** | **200** | `mock:false` · `configured:true` · `authUrl` → `accounts.google.com` | ✅ **live モード** |
| **status**（callback 前） | **200** | `connected:false` · `mock:false` · `configured:true` | ✅ 未接続（期待） |

503 `redirect_uri_not_configured` / mock fallback は **解消**。

---

## 4. OAuth callback / Token Vault

| 項目 | 結果 |
| --- | --- |
| ブラウザ consent | ❌ **`access_denied`** |
| 原因 | OAuth app **Testing** · ログイン Google アカウントが **Test users 未登録** |
| **Token Vault** | **0 rows**（callback 未完了のため保存なし） |
| **status connected** | `false` |

**次アクション（人間 · GCP Console）:**

1. OAuth consent screen → **Test users** に live smoke 用 Gmail を追加
2. Dashboard（8788）→ 「接続する」→ consent 完了
3. Cursor に「live OAuth 続行」と依頼 → Gmail/Calendar/Dashboard 接続済み smoke 再実施

---

## 5. Gmail / Calendar read-only smoke

| Probe | 結果 |
| --- | --- |
| **gmail · labels.list** | ⏸ skipped（未接続） |
| **status · profile（email）** | ⏸ skipped（未接続） |
| **calendar_read · calendarList.list** | ⏸ skipped（未接続） |

callback 成功後に再実施予定。

---

## 6. Dashboard smoke（8788 · 未接続）

**URL:** `http://127.0.0.1:8788/admin-operations-dashboard.html`

| Viewport | HTTP | Label | JS fatal |
| --- | ---: | --- | ---: |
| **1280×900** | 200 | Google未接続 | **0** |
| **390×844** | 200 | Google未接続 | **0** |

UI / Edge fetch は正常 · **接続済み（live）表示は callback 後**。

---

## 7. Mock → Live 切替確認

| チェック | 結果 |
| --- | --- |
| `SECRETARY_GOOGLE_OAUTH_MOCK` | **absent** |
| connect `mock` | **false** |
| status `mock` | **false** |
| authUrl | **Google 本番 consent URL** |

---

## 参照

- `reports/ai-secretary-google-oauth-gcp-console-runbook.md`
- `reports/ai-secretary-google-oauth-live-prep.md`
- `reports/ai-secretary-google-oauth-p0-mock-connect.md`
