# Live Platform — ZEGO Token API env デバッグ

**日付:** 2026-06-29  
**症状:** `/api/tlv-zego-token` が **503** `ZEGO credentials not configured`  
**E2E env presence:** PASS · **Token API runtime:** FAIL（修正前）

---

## 1. 原因（Root cause）

### ズレの構造

| 層 | 読む場所 | 用途 |
| --- | --- | --- |
| **E2E / Node スクリプト** | repo root `.env`（`readZegoEnv()`） | env presence チェック |
| **Pages Function runtime** | wrangler `context.env` | Token 発行 |

**`npm run dev` の `--env-file=.env` だけでは Pages Functions の `context.env` に ZEGO 変数が載らない。**

wrangler pages dev（CWD=`deploy/cloudflare/dist`）は **`dist/.dev.vars`** を Function binding の正本とする（DEEPSEEK 時と同型 · `reports/ai-secretary-deepseek-production-route-triage.md` RC-4 参照）。

`npm run build:pages` が dist を **全削除**するため、`.dev.vars` も消える → dev 再起動時に再同期が必要。

### 503 発生箇所

**ファイル:** `deploy/cloudflare/functions/api/tlv-zego-token.js`

```javascript
const appId = Number(env.ZEGO_APP_ID || 0);
const serverSecret = String(env.ZEGO_SERVER_SECRET || "").trim();

if (!appId || !serverSecret) {
  return jsonResponse({ error: "ZEGO credentials not configured", ... }, 503);
}
```

**Exact reason:** `context.env.ZEGO_APP_ID` または `context.env.ZEGO_SERVER_SECRET` が空（`.dev.vars` 未同期 · dev 未再起動）。

---

## 2. Token API が参照する env 名

| env 名 | 必須 | 用途 |
| --- | --- | --- |
| `ZEGO_APP_ID` | **必須** | Token04 appId |
| `ZEGO_SERVER_SECRET` | **必須** · **32 byte** | Token04 署名 |
| `ZEGO_SERVER` | 任意 | レスポンス `server` フィールド |

**validation:**

- `!appId || !serverSecret` → 503 `ZEGO credentials not configured`
- `serverSecret.length !== 32` → 503 `ZEGO_SERVER_SECRET must be 32 bytes`

---

## 3. local dev で必要な env の置き場所

| 場所 | 役割 | Git |
| --- | --- | --- |
| **`.env`**（repo root） | 正本 · E2E / build スクリプトが読む | 禁止 |
| **`deploy/cloudflare/dist/.dev.vars`** | wrangler Pages Functions binding | 禁止（自動同期） |
| **`deploy/cloudflare/.dev.vars.example`** | テンプレ | 可 |
| **Cloudflare Pages Dashboard Secrets** | 本番のみ | — |

**不要:** `wrangler.toml`（本リポジトリ未使用）· client `live-zego-config.js`（secret 不含）

---

## 4. 修正内容

### 新規

| ファイル | 内容 |
| --- | --- |
| `scripts/lib/sync-pages-dev-vars.mjs` | `.env` → `dist/.dev.vars` 同期（presence のみログ） |
| `deploy/cloudflare/.dev.vars.example` | テンプレ |

### 更新

| ファイル | 内容 |
| --- | --- |
| `scripts/ensure-pages-dist.mjs` | dev 起動前に `.dev.vars` + platform/live zego config 生成 |
| `scripts/verify-platform-live-zego-integration-e2e.mjs` | `.dev.vars` 診断 · Token 503 hint · console filter |
| `platform-live/zego-platform-poc.html` | config 同期 load · ZEGO SDK UMD deps preload |
| `platform-live/zego-platform-poc.js` | 重複 config loader 防止 |
| `.env.example` | `.dev.vars` 同期説明 |
| `.gitignore` | `deploy/cloudflare/dist/.dev.vars` |

**未変更:** `live/providers/zego-live-provider.js` · `live/live-zego-poc.html` · Platform Interface · Edge logic

---

## 5. 再実行手順

```bash
# 1. .env に ZEGO 3 変数（32 byte secret）
# 2. build（dist 再生成 · .dev.vars は dev 起動時に同期）
npm run build:pages

# 3. dev（ensure-pages-dist が .dev.vars を書き wrangler が読む）
npm run dev
# wrangler ログに以下が出れば OK:
#   Using secrets defined in .dev.vars
#   env.ZEGO_APP_ID ("(hidden)")
#   env.ZEGO_SERVER_SECRET ("(hidden)")

# 4. E2E
npm run verify:platform-live-zego-integration-e2e
```

**注意:** `.env` 変更後は **必ず dev 再起動**（wrangler は起動時に `.dev.vars` を読む）。

---

## 6. E2E 結果（修正後 · 2026-06-29）

**Summary:** PASS **31** · FAIL **0** · SKIP **1** · exit **0** · verdict **GO**

| 項目 | 結果 |
| --- | --- |
| env presence | **PASS** |
| dist/.dev.vars | **PASS** |
| token:host | **PASS**（len=338） |
| token:audience | **PASS**（len=338） |
| initialize | **PASS** |
| create session | **PASS** |
| host publish | **PASS** |
| audience join | **PASS** |
| audience play | **SKIP**（headless fake media · remote DOM 未検出） |
| reconnect | **PASS** |
| leave / cleanup | **PASS** |
| provider signals | **PASS** |
| broadcast signals | **PASS** |
| TLV PoC / Interface | **PASS**（未変更） |

---

## 7. Phase 2.5 / Phase 3

| 判断 | 結果 |
| --- | --- |
| **Phase 2.5（Token env 修正）** | **Go** |
| **実機 E2E（Token + lifecycle）** | **Go** |
| **Phase 3 開始** | **Conditional** — `browser:audience-play` SKIP は headless 既知 · 実ブラウザ確認後に着手推奨 |

---

## 参照

- Token API: `deploy/cloudflare/functions/api/tlv-zego-token.js`
- Dev 起動: `scripts/dev-pages.mjs` · `scripts/ensure-pages-dist.mjs`
- E2E: `scripts/verify-platform-live-zego-integration-e2e.mjs`
- 先行事例: `reports/ai-secretary-deepseek-production-route-triage.md`（RC-4 `.dev.vars`）
