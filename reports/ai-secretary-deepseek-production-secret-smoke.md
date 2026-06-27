# AI 秘書 DeepSeek — Production Secret Smoke

**実施日:** 2026-06-28  
**Git HEAD:** `6ba3102` — `docs(secretary): add deepseek production secret smoke evidence`  
**種別:** Secret 登録 + live smoke 証跡

**JSON:** `reports/ai-secretary-deepseek-production-secret-smoke.json`

---

## 総合判定: **No-Go（P0 DeepSeek 未完）** — Secret **present** · Function **未反映**

| 領域 | 判定 |
| --- | --- |
| Pages Function マウント | ✅ Go |
| **`DEEPSEEK_API_KEY` CF 登録** | ✅ **present**（`wrangler pages secret put` 成功） |
| Secret → Function `env` 反映 | ❌ **未反映**（POST 依然 `configured:false`） |
| POST 200 · `usedDeepSeek:true` | ❌ 未到達 |
| **DeepSeek P0** | ❌ **No-Go** |

---

## Phase A — 登録前（commit `6ba3102` 時点）

| 項目 | 結果 |
| --- | --- |
| **`DEEPSEEK_API_KEY`** | **absent** |
| POST（Service Token） | **503** · `configured:false` |
| 判定 | Function 到達 · Secret 未登録どおり |

---

## Phase B — Secret 登録 + 再 smoke（2026-06-28）

### 1. Secret 登録

| 項目 | 結果 |
| --- | --- |
| 方法 | `wrangler pages secret put DEEPSEEK_API_KEY --project-name tasufull-article` |
| 結果 | ✅ **Success! Uploaded secret DEEPSEEK_API_KEY** |
| 値の表示 | **なし** |

### 2. presence 確認

**`wrangler pages secret list --project-name tasufull-article`**

| Secret | Presence |
| --- | --- |
| **`DEEPSEEK_API_KEY`** | **present** |

### 3. Production alias smoke（Service Token · POST）

**Endpoint:** `https://tasufull-article.pages.dev/api/secretary-deepseek-chat`

| 項目 | 値 |
| --- | --- |
| HTTP | **503** |
| Content-Type | `application/json` |
| `configured` | **false** |
| `usedDeepSeek` | **false** |
| `error` | `DEEPSEEK_API_KEY not configured` |
| 15s 後リトライ | 同上 **503** · `configured:false` |

**判定（ユーザー基準）:** ❌ **No-Go** — Secret **未反映**（登録失敗ではなく deploy 未実施による binding 遅延）

### 4. API 側エラー

| 項目 | 結果 |
| --- | --- |
| DeepSeek API 到達 | **未到達**（`configured:false` のため proxy 未呼び出し） |
| 残高 / 401 / 502 | **未検証** |

---

## 解釈

Cloudflare Pages は **Secret 追加後、新しい deployment まで Functions の `env` に反映されない**（[CF ドキュメント](https://developers.cloudflare.com/pages/functions/bindings/) どおり）。

| 状態 | 期待 |
| --- | --- |
| Secret put 直後 · deploy なし | 503 `configured:false`（**今回観測**） |
| Secret + **redeploy 後** | `configured:true` → **502**（残高不足）または **200** |

---

## 次アクション

1. **`node --env-file=.env scripts/deploy-cloudflare-pages.mjs`** で production redeploy（Functions 同梱済 script）
2. Service Token 経由 POST 再 smoke
   - **502** · `Insufficient Balance` → Secret 到達 **Go** · 残高チャージ
   - **200** · `usedDeepSeek:true` → DeepSeek P0 **Go**
3. 証跡更新 + commit

---

## 参照

- `reports/ai-secretary-deepseek-pages-function-redeploy.md`
- `reports/ai-secretary-deepseek-production-route-triage.md`
