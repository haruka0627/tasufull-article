# AI 秘書 DeepSeek — Production Secret Smoke

**実施日:** 2026-06-28  
**Git HEAD:** `3910f67` — `fix(deploy): run pages deploy from dist for functions`  
**種別:** Secret presence + live smoke 証跡

**JSON:** `reports/ai-secretary-deepseek-production-secret-smoke.json`

---

## 総合判定: **No-Go（P0 DeepSeek 未完）** — Function 到達 **Go**

| 領域 | 判定 |
| --- | --- |
| Pages Function マウント | ✅ Go |
| **`DEEPSEEK_API_KEY` Production Secret** | ❌ **absent** |
| POST 200 · `usedDeepSeek:true` | ❌ 未到達 |
| 本 smoke（Secret 未登録時） | ✅ **503 · `configured:false`** は正常 |

---

## 1. git / dist 状態

| 項目 | 結果 |
| --- | --- |
| `git status`（開始） | report 2 件 untracked のみ · **dist drift なし** |
| dist checkout | **不要** |

---

## 2. Production Secret — presence のみ

**確認:** `wrangler pages secret list --project-name tasufull-article`

| Secret | Presence |
| --- | --- |
| **`DEEPSEEK_API_KEY`** | **absent** |
| production secrets 一覧 | **空** |

Secret / Token **値は記載しない**。

---

## 3. Smoke 結果

### Production alias（Service Token · POST）

**Endpoint:** `https://tasufull-article.pages.dev/api/secretary-deepseek-chat`

| 項目 | 値 |
| --- | --- |
| HTTP | **503** |
| Content-Type | `application/json` |
| `configured` | **false** |
| `usedDeepSeek` | **false** |
| `error` | `DEEPSEEK_API_KEY not configured` |
| 判定 | ✅ **Function 到達** · Secret absent どおり |

### 参考

| Probe | 結果 | 判定 |
| --- | --- | --- |
| alias 未認証 · manual | **302** Access | ✅ |
| preview `b9931fcd` POST | **503** JSON · `configured:false` | ✅ |
| local 8788 POST | **503** JSON · `configured:false` | ✅ |

**405 / HTML fallback / empty body:** なし

---

## 4. Secret 登録後の期待

| 状態 | 期待 POST |
| --- | --- |
| Secret **absent**（現状） | **503** · `configured:false` |
| Secret **present** · 残高不足 | **502** 等 · `configured:true` 可 |
| Secret **present** · 残高 OK | **200** · `usedDeepSeek:true` |

---

## 5. 次アクション

1. Cloudflare Pages Production に **`DEEPSEEK_API_KEY`** 登録（Dashboard / `wrangler pages secret put`）
2. 本 smoke を **再実行** → 200 または 502 確認
3. DeepSeek 残高チャージ（200 到達用）
4. その後 Google OAuth Edge deploy へ

---

## 参照

- `reports/ai-secretary-deepseek-pages-function-redeploy.md`
- `reports/ai-secretary-deepseek-production-route-triage.md`
- `reports/ai-secretary-p0-production-smoke.md`
