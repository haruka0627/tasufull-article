# AI 秘書 DeepSeek — Pages Function Redeploy Preflight

**実施日:** 2026-06-28  
**Git HEAD（開始）:** `2a8666a` — `docs(secretary): add deepseek production route triage`  
**種別:** build + deploy + Function mount 確認（**実装変更なし · commit 未実施**）

**関連:** `reports/ai-secretary-deepseek-production-route-triage.md`

---

## 総合判定: **Go（Function マウント）** — deploy script 要修正

| 項目 | 判定 |
| --- | --- |
| `npm run build:pages` | ✅ PASS |
| dist `functions/api/secretary-deepseek-chat.js` | ✅ 存在 |
| **script 経由 deploy**（`deploy-cloudflare-pages.mjs`） | ❌ **Functions bundle 未アップロード** → preview **405** |
| **dist CWD 経由 deploy**（preflight 追加検証） | ✅ **Functions bundle アップロード** → preview **204/503 JSON** |
| **Production alias**（Service Token あり） | ✅ **503 JSON** · `configured:false` |
| **Production alias**（未認証 · manual） | ✅ **302** Cloudflare Access（期待どおり） |

---

## 1. git status（開始）

```
（空 · clean）
```

**build/deploy 後:** `deploy/cloudflare/dist/**` に build 生成物 diff あり（docs 同期等）。**本 preflight では commit しない。**

---

## 2. build 結果

```
npm run build:pages → PASS
[stage-cloudflare-pages] copied deploy/cloudflare/functions → dist/functions
[stage-cloudflare-pages] OK → deploy/cloudflare/dist
```

| 確認 | 結果 |
| --- | --- |
| `deploy/cloudflare/dist/functions/api/secretary-deepseek-chat.js` | ✅ 存在（2320 bytes） |
| `deploy/cloudflare/dist/functions/_shared/secretary-deepseek.mjs` | ✅ 存在 |

---

## 3. deploy — script 経由（指定手順）

```bash
node --env-file=.env scripts/deploy-cloudflare-pages.mjs
```

| 項目 | 値 |
| --- | --- |
| **Deploy URL** | `https://5caae8de.tasufull-article.pages.dev` |
| wrangler 警告 | `No routes found when building Functions directory: ...\tasufull-article\functions - skipping` |
| Functions bundle | **アップロードログなし** |

### preview `5caae8de` 検証

| Probe | HTTP | 判定 |
| --- | ---: | --- |
| OPTIONS `/api/secretary-deepseek-chat` | **405** | ❌ NG（body 空） |
| POST 同上 | **405** | ❌ NG（body 空 · 非 JSON） |

**原因:** `scripts/deploy-cloudflare-pages.mjs` が repo **ルート CWD** で `wrangler pages deploy deploy/cloudflare/dist` を実行。wrangler は **repo ルート `./functions`** を参照し、存在しないため Functions を **skip**。

---

## 4. deploy — dist CWD 追加検証（preflight）

script 単体では Function 未到達のため、**同一 dist 成果物**を dist CWD から再 deploy（Functions bundle 確認目的 · 破壊的操作なし）。

```bash
# cwd = deploy/cloudflare/dist
wrangler pages deploy . --project-name tasufull-article --branch main
```

| 項目 | 値 |
| --- | --- |
| **Deploy URL（Functions 同梱）** | `https://5d928746.tasufull-article.pages.dev` |
| wrangler | `Compiled Worker successfully` · **`Uploading Functions bundle`** |

### preview `5d928746` 検証

| Probe | HTTP | Content-Type | Body 署名 | 判定 |
| --- | ---: | --- | --- | --- |
| **OPTIONS** | **204** | — | `Access-Control-Allow-Methods: POST, OPTIONS` | ✅ **Go** |
| **POST** | **503** | `application/json` | `configured:false` · `error:"DEEPSEEK_API_KEY not configured"` | ✅ **Go**（Secret 未登録想定どおり） |

---

## 5. Production alias 検証

**Base:** `https://tasufull-article.pages.dev/api/secretary-deepseek-chat`

| Probe | 条件 | HTTP | 結果 | 判定 |
| --- | --- | ---: | --- | --- |
| POST · `redirect: manual` | 未認証 | **302** | Cloudflare Access リダイレクト | ✅ 期待どおり |
| POST · Service Token | `CF-Access-Client-Id/Secret` 設定済 | **503** | JSON · `configured:false` | ✅ **Function 到達** |

**Secret / Token 値:** 本レポートに記載しない。Service Token は **configured（presence のみ確認）**。

---

## 6. Function マウント Go/No-Go

| デプロイ | Deploy URL | Function mount |
| --- | --- | --- |
| `deploy-cloudflare-pages.mjs`（現行 script） | `5caae8de` | **No-Go**（405） |
| dist CWD deploy（正しい wrangler コンテキスト） | `5d928746` | **Go**（204 / 503 JSON） |
| **Production alias**（最新 deploy 反映後） | `tasufull-article.pages.dev` | **Go**（Service Token 経由で 503 JSON） |

---

## 7. 次に必要な作業

| 優先 | 内容 | 種別 |
| ---: | --- | --- |
| ~~**P0**~~ | ~~**`scripts/deploy-cloudflare-pages.mjs` 修正**~~ | ✅ **完了** — §9 参照 |
| **P0** | Cloudflare Pages Production に **`DEEPSEEK_API_KEY`** Secret 登録 | インフラ |
| **P1** | DeepSeek **残高チャージ** → POST **200** · `usedDeepSeek:true` smoke | 運用 |
| **P1** | `verify-cloudflare-pages-stage.mjs` に `functions/api/secretary-deepseek-chat.js` を REQUIRED_PATHS 追加 | commit 候補 |
| **P1** | smoke script に preview POST `/api/secretary-deepseek-chat`（503/502/200 JSON）追加 | commit 候補 |
| **P2** | ローカル 8788: `deploy/cloudflare/dist/.dev.vars` で `DEEPSEEK_API_KEY` バインド（gitignore · 値非コミット） | 運用 |

**現時点:** Function **ルートは本番到達可能**。DeepSeek 実応答には **Production Secret + 残高** が残ブロッカー。

---

## 8. 完了報告サマリ

| 項目 | 結果 |
| --- | --- |
| **build** | ✅ PASS · functions dist コピー済 |
| **deploy URL（script）** | `https://5caae8de.tasufull-article.pages.dev` — Functions **なし** |
| **deploy URL（Functions 同梱）** | `https://5d928746.tasufull-article.pages.dev` |
| **preview OPTIONS** | **204** ✅（`5d928746`） |
| **preview POST** | **503 JSON** · `configured:false` ✅ |
| **prod alias Access** | 未認証 **302** · Service Token あり **503 JSON** ✅ |
| **Function マウント** | **Go**（dist CWD deploy 後）· script 単体は **No-Go** |
| **次作業** | deploy script CWD 修正 · `DEEPSEEK_API_KEY` 登録 · 200 smoke |

---

## 9. deploy script 修正後検証（2026-06-28）

**修正:** `scripts/deploy-cloudflare-pages.mjs` — wrangler を `deploy/cloudflare/dist` CWD で `pages deploy .` 実行 · Functions marker 事前チェック · cwd/target ログ追加

**Commit message（予定）:** `fix(deploy): run pages deploy from dist for functions`

### build

```
npm run build:pages → PASS
[stage-cloudflare-pages] copied deploy/cloudflare/functions → dist/functions
```

### deploy（修正 script）

```bash
node --env-file=.env scripts/deploy-cloudflare-pages.mjs
```

| ログ | 結果 |
| --- | --- |
| `[deploy-pages] cwd=.../deploy/cloudflare/dist` | ✅ |
| `[deploy-pages] target=. (static + dist/functions for Pages Functions)` | ✅ |
| wrangler `Uploading Functions bundle` | ✅ |
| **Deploy URL** | `https://b9931fcd.tasufull-article.pages.dev` |

### preview `b9931fcd`

| Probe | HTTP | 判定 |
| --- | ---: | --- |
| OPTIONS | **204** | ✅ |
| POST | **503** · JSON · `configured:false` | ✅ |

### Production alias（Service Token）

| Probe | HTTP | 判定 |
| --- | ---: | --- |
| OPTIONS | **204** | ✅ |
| POST | **503** · JSON · `configured:false` | ✅ Function 到達 |

**JSON 証跡:** `reports/ai-secretary-deepseek-pages-function-redeploy.json`

### 修正前後

| 手順 | Deploy URL | Functions bundle | `/api/secretary-deepseek-chat` |
| --- | --- | --- | --- |
| 旧 script（repo root CWD） | `5caae8de` | ❌ skip | 405 空 |
| 手動 dist CWD（preflight） | `5d928746` | ✅ | 204 / 503 JSON |
| **修正 script** | **`b9931fcd`** | ✅ | **204 / 503 JSON** |

**総合:** deploy script 修正 **Go** — script 単体で Functions 同梱を確認。

### 残作業

| 優先 | 内容 |
| ---: | --- |
| P0 | Cloudflare Pages Production **`DEEPSEEK_API_KEY`** 登録 |
| P1 | DeepSeek 残高 · POST 200 smoke |
| P1 | verify / smoke script に functions チェック追加 |
