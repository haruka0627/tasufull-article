# AI 秘書 DeepSeek — Production Secret Smoke

**実施日:** 2026-06-28  
**Git HEAD:** `c11142b` — `docs(secretary): add deepseek production redeploy smoke`  
**種別:** Secret 登録 · redeploy · live smoke 証跡

**JSON:** `reports/ai-secretary-deepseek-production-secret-smoke.json`

---

## 総合判定: **DeepSeek P0 Go**

| 領域 | 判定 |
| --- | --- |
| Pages Function マウント | ✅ Go |
| **`DEEPSEEK_API_KEY` CF 登録** | ✅ **present** |
| Secret → Function `env` 反映 | ✅ Go |
| DeepSeek API 到達 | ✅ Go |
| POST 200 · `usedDeepSeek:true` | ✅ **Go**（Phase D · 残高チャージ後） |
| **DeepSeek P0 完了** | ✅ **Go** |

---

## Phase D — 残高チャージ後 · 最終 smoke（2026-06-28）

**前提:** DeepSeek 残高 **$2.00 反映確認**（ユーザー報告）

**Endpoint:** `POST https://tasufull-article.pages.dev/api/secretary-deepseek-chat`  
**認証:** Cloudflare Access **Service Token**  
**Body:** Adapter 互換（`message` + `surface: ops_secretary`）

| 項目 | 値 |
| --- | --- |
| HTTP | **200** |
| Content-Type | `application/json` |
| `configured` | **true** |
| `usedDeepSeek` | **true** |
| `error` | **null** |
| `replyLength` | 32 |
| `model` | `deepseek-chat` |
| `modelLabel` | `DeepSeek` |
| latencyMs | ~1174 |

**判定:** ✅ **DeepSeek P0 Go** — production alias 経由で live 応答確認

---

## Phase 履歴

| Phase | Secret | POST 結果 | 判定 |
| --- | --- | --- | --- |
| A 登録前 | absent | 503 · `configured:false` | Function 到達 |
| B 登録後 · redeploy 前 | present | 503 · `configured:false` | Secret 未反映 |
| C redeploy 後 | present | 502 · `Insufficient Balance` | Secret 反映 · 残高 blocker |
| **D 残高チャージ後** | **present** | **200 · `usedDeepSeek:true`** | **P0 Go** |

---

## Phase C — Redeploy + 再 smoke（参考）

### Redeploy

```bash
node --env-file=.env scripts/deploy-cloudflare-pages.mjs
```

| 項目 | 結果 |
| --- | --- |
| **Deploy URL** | `https://4f24758d.tasufull-article.pages.dev` |
| **Production alias** | `https://tasufull-article.pages.dev` |
| **Functions bundle** | ✅ |

### Phase C smoke（残高不足時）

| 項目 | 値 |
| --- | --- |
| HTTP | **502** |
| `configured` | **true** |
| `usedDeepSeek` | **false** |
| `error` | `Insufficient Balance` |

---

## 次アクション

DeepSeek P0 **完了** → **Google OAuth / Supabase Edge deploy**（`secretary-google-oauth` · `secretary-google-tools`）

---

## 参照

- `reports/ai-secretary-deepseek-pages-function-redeploy.md`
- `reports/ai-secretary-deepseek-production-route-triage.md`
