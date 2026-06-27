# AI 秘書 DeepSeek — Production Secret Smoke

**実施日:** 2026-06-28  
**Git HEAD:** `1138302` — `docs(secretary): update deepseek production secret smoke`  
**種別:** Secret 登録 · redeploy · live smoke 証跡

**JSON:** `reports/ai-secretary-deepseek-production-secret-smoke.json`

---

## 総合判定: **Secret 反映 Go** · **DeepSeek P0 No-Go**（API 残高）

| 領域 | 判定 |
| --- | --- |
| Pages Function マウント | ✅ Go |
| **`DEEPSEEK_API_KEY` CF 登録** | ✅ **present** |
| Secret → Function `env` 反映 | ✅ **Go**（redeploy 後 · `configured:true`） |
| DeepSeek API 到達 | ✅ **Go**（502 · `Insufficient Balance`） |
| POST 200 · `usedDeepSeek:true` | ❌ 未到達 |
| **DeepSeek P0 完了** | ❌ **No-Go** — 残高チャージ後に 200 smoke |

---

## Phase C — Redeploy + 再 smoke（2026-06-28）

### 1. Redeploy

```bash
node --env-file=.env scripts/deploy-cloudflare-pages.mjs
```

| 項目 | 結果 |
| --- | --- |
| EPERM 対応 | `stop-pages-dev.mjs` で dev 停止後に再実行 |
| **cwd** | `deploy/cloudflare/dist` ✅ |
| **target** | `.` ✅ |
| **Functions bundle** | `Uploading Functions bundle` ✅ |
| **Deploy URL** | `https://4f24758d.tasufull-article.pages.dev` |
| **Production alias** | `https://tasufull-article.pages.dev` |

### 2. Secret presence

| Secret | Presence |
| --- | --- |
| **`DEEPSEEK_API_KEY`** | **present** |

### 3. Production alias smoke（Service Token · POST）

**Endpoint:** `https://tasufull-article.pages.dev/api/secretary-deepseek-chat`  
**Body:** Adapter 互換（`message` + `surface: ops_secretary`）

| 項目 | 値 |
| --- | --- |
| HTTP | **502** |
| Content-Type | `application/json` |
| `configured` | **true** |
| `usedDeepSeek` | **false** |
| `error` | `Insufficient Balance` |
| `model` | `deepseek-chat` |
| 判定 | ✅ **Secret 反映 Go** · DeepSeek API **到達** · **残高 blocker** |

### 4. Preview `4f24758d`

| 項目 | 値 |
| --- | --- |
| HTTP | **502** |
| `configured` | **true** |
| `error` | `Insufficient Balance` |

### 5. dist drift

| 項目 | 結果 |
| --- | --- |
| build/deploy 後 drift | 63 modified + untracked |
| 対応 | `git checkout -- deploy/cloudflare/dist/` + `git clean -fd` |
| commit | **不要**（build 由来のみ） |

---

## Phase 履歴

| Phase | Secret | POST 結果 | 判定 |
| --- | --- | --- | --- |
| A 登録前 | absent | 503 · `configured:false` | Function 到達 |
| B 登録後 · redeploy 前 | present | 503 · `configured:false` | Secret 未反映 |
| **C redeploy 後** | **present** | **502 · `configured:true`** | **Secret 反映 Go** |

---

## 次アクション

1. **DeepSeek 残高チャージ**
2. Service Token 経由 POST 再 smoke → **200** · `usedDeepSeek:true`
3. DeepSeek P0 **Go** 確定 → Google OAuth Edge deploy へ

---

## 参照

- `reports/ai-secretary-deepseek-pages-function-redeploy.md`
- `reports/ai-secretary-deepseek-production-route-triage.md`
