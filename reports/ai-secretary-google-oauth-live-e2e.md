# AI 秘書 P0 — Google OAuth Live E2E

**実施日:** 2026-06-28  
**Git HEAD:** `c39e399`（検証時）  
**JSON:** `reports/ai-secretary-google-oauth-live-e2e.json`

**Secret / Token / UUID 値は記載しない**

---

## 総合判定

| 領域 | 判定 |
| --- | --- |
| **OAuth consent · callback · Vault** | ✅ **PASS** |
| **Gmail / Calendar live API** | ✅ **PASS** |
| **Dashboard UI（接続済み）** | ✅ **PASS**（1280 / 390 · JS fatal 0） |
| **Full Live E2E** | ✅ **Go** |

---

## Post-consent 最終検証（2026-06-28）

**コマンド:** `node --env-file=.env scripts/verify-secretary-google-oauth-live-post-consent.mjs`

### status

| チェック | 結果 |
| --- | --- |
| HTTP | **200** |
| `connected` | **true** |
| `mock` | **false** |
| `configured` | **true** |
| **判定** | ✅ **PASS** |

### Token Vault

| チェック | 結果 |
| --- | --- |
| rows | **1** |
| **判定** | ✅ **PASS** |

### Gmail

| Probe | HTTP | 判定 |
| --- | ---: | --- |
| **labels.list** | 200 | ✅ **PASS** |
| **profile（status email）** | — | ✅ **PASS** |

### Calendar

| Probe | HTTP | 判定 |
| --- | ---: | --- |
| **calendarList.list** | 200 | ✅ **PASS** |

### Dashboard（8788）

| Viewport | HTTP | Label | JS fatal | 判定 |
| --- | ---: | --- | ---: | --- |
| **1280×900** | 200 | Google接続済み | **0** | ✅ **PASS** |
| **390×844** | 200 | Google接続済み | **0** | ✅ **PASS** |

**overall:** ✅ **PASS**

---

## フロー概要

1. Live connect API（mock:false · configured:true）
2. external Chrome（PowerShell `Start-Process` — authUrl 切り詰め修正）
3. Google consent 完了 · Dashboard リダイレクト
4. GCP: Gmail API · Google Calendar API 有効化
5. post-consent 検証 **全項目 PASS**

---

## 変更ファイル（AI秘書 Google OAuth）

| ファイル | 内容 |
| --- | --- |
| `admin-ai-secretary-google-oauth-client.js` | UUID 検証 · dev bootstrap param |
| `admin-ai-secretary-google-connect-ui.js` | WebDriver 検知 · connect redirect |
| `scripts/secretary-google-oauth-live-open-external.mjs` | connect + 通常 Chrome 起動 |
| `scripts/verify-secretary-google-oauth-live-post-consent.mjs` | post-consent 自動検証 |
| `scripts/test-secretary-google-oauth-phase6b.mjs` | 単体 / browser smoke |

---

## 参照

- `reports/ai-secretary-google-oauth-authurl-investigation.md`
- `reports/ai-secretary-google-oauth-gcp-console-runbook.md`
