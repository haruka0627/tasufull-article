# TASFUL AI — Production Ready Final Phase

**実施日:** 2026-06-28  
**Git HEAD:** `b4441b2` — `chore(tasful-ai): deploy workspace quota enforcement`  
**スコープ:** TASFUL AI のみ（機能追加なし · 検証 + build EPERM 修正）  
**判定:** **No-Go**（運用ブロッカー 2 件 + 本番 alias 未デプロイ）

---

## Executive Summary

| Phase | 結果 |
| --- | --- |
| ① `npm run build:pages` | ✅ **PASS**（EPERM 根本原因修正済み） |
| ② Serper credits + live | ❌ **FAIL** — `Not enough credits` |
| ③ Cloudflare Access E2E | ❌ **FAIL** — Service Token 未設定（prod alias） |
| ④ Stripe Production E2E | ✅ **PASS** — Free / Standard / Pro quota Edge **11/11** |
| ⑤ Final Regression | ⚠️ **大部分 PASS**（TASFUL AI コア） |
| **Production Ready** | **No-Go** |

**コミット:** 未実施（全 PASS 条件未達 · AD-007 遵守）

---

## ① npm run build:pages — PASS

### EPERM 根本原因

| 要因 | 詳細 |
| --- | --- |
| **直接原因** | `deploy/cloudflare/stage-cloudflare-pages.mjs:307` の `fs.rmSync(OUT_DIR)` が Windows EPERM |
| **ロック元** | `wrangler pages dev` が `deploy/cloudflare/dist` を cwd に使用 → **`workerd.exe`** が dist ディレクトリを保持 |
| **127.0.0.1:8788** | `npm run dev` → `scripts/dev-pages.mjs` → `npx wrangler pages dev . --port 8788` |
| **複数プロセス** | セッション中に **dev-pages / wrangler / workerd が 3 ツリー以上** 蓄積（LISTEN PID だけ kill では不十分） |
| **VSCode / Cursor** | 直接ロックの主因ではない（Cursor helper node は dist 非 cwd） |
| **Windows Lock** | workerd 終了後 2–3 秒の handle 解放待ちが必要 |

### 修正

| ファイル | 変更 |
| --- | --- |
| `scripts/stop-pages-dev.mjs` | **新規** — port 8788 LISTEN + `dev-pages.mjs` + wrangler `pages dev` + プロジェクト workerd を `/T` 付き taskkill |
| `package.json` | `build:pages` 先頭に `node scripts/stop-pages-dev.mjs &&` を追加 |

### 実行結果

```text
[stop-pages-dev] stopping dev stack PIDs: 18184, 18136, ... 38680
[stop-pages-dev] port 8788 free, workerd cleared
[stage-cloudflare-pages] OK → deploy/cloudflare/dist
```

- **Exit code:** 0  
- **dist 更新:** 正式 `npm run build:pages` のみ（手動 cp なし）  
- **TLV verify:** 12 files OK  

### 注意

- build 前に dev 停止が必要（`build:pages` が自動停止するようになった）  
- **本番 Pages への redeploy は本セッション未実施**（前回 deploy hash `5437d70e` が alias 未反映のまま）

---

## ② Serper — FAIL（運用ブロッカー）

**コード変更:** なし

### Live Edge プローブ

`node scripts/verify-tasful-ai-production-environment.mjs`

| Probe | 結果 |
| --- | --- |
| OpenAI / Claude / Gemini text | ✅ PASS |
| OpenAI / Claude / Gemini Vision | ✅ PASS |
| **Serper search** | ❌ **HTTP 502** — `Not enough credits` |

`SERPER_API_KEY` は Edge に **設定済み**（503 not-configured ではない）。**credits 枯渇**が原因。

### Web Search / Hybrid / Gateway live

| 検証 | 結果 |
| --- | --- |
| Edge `serper-search` direct | ❌ credits 枯渇 |
| Preflight（deploy hash URL） | Serper secret **present** · working **502** |
| Browser hybrid（8788 · mock Serper） | route classification **6/6 PASS** · site_search 応答 timeout（live chat 依存 · Serper mock 以前の待ち） |

**credits 補充後の再実行コマンド:**

```bash
node scripts/verify-tasful-ai-production-environment.mjs
PAGES_BASE_URL=https://5437d70e.tasufull-article.pages.dev node scripts/test-tasful-ai-production-preflight.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/test-ai-serper-search-browser.mjs
```

---

## ③ Cloudflare Access — FAIL（運用ブロッカー）

**Service Token:** `.env` に `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` **未設定**

### Production alias — `https://tasufull-article.pages.dev`

`node scripts/verify-tasful-ai-access-workspace.mjs`

| Check | 結果 |
| --- | --- |
| Unauthenticated — Access gate | ✅ PASS（Access login HTML = 期待） |
| Authenticated MIME/routing | ❌ **FAIL** — Service Token 未設定 |
| Access HTML を asset として取得 | ❌ **未認証時は Access HTML**（Service Token なしでは E2E 不可） |

### Production URL（Access なし preview）— `https://cf-pages-deploy.tasufull-article.pages.dev`

| Check | 結果 |
| --- | --- |
| MIME ai-workspace.html / *.js / css | ✅ **4/4 PASS** |
| Workspace HTML load | ✅ PASS |
| Composer + Gateway | ✅ PASS |
| 390px layout | ✅ PASS |
| Console errors | ✅ 0 |

### 設定手順（人間作業）

1. Cloudflare Zero Trust → Access → Service Auth → **Create Service Token**
2. Application `tasufull-article.pages.dev` Policy に Service Auth を Include
3. `.env` に `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` を設定（値をログに出さない）
4. 再検証:

```bash
node --env-file=.env scripts/verify-tasful-ai-access-workspace.mjs
PAGES_BASE_URL=https://tasufull-article.pages.dev node --env-file=.env scripts/verify-tasful-ai-access-workspace.mjs
```

**代替:** `reports/gate-d-auth-storage.json` の OTP Cookie は **2026-06-28 時点で prod alias 認証に失効**（fetch でも Access HTML）。

---

## ④ Stripe Production E2E — PASS

**対象:** Workspace quota · Usage · Subscription（Production Edge · simulate API）

`node scripts/test-ai-workspace-quota-edge.mjs` — **11/11 PASS**

| Plan | dailyLimit | 検証 |
| --- | --- | --- |
| **Free** | 5 | consume 5/5 · 402 depleted · openai-chat 402 |
| **Standard** (`genai_basic_300`) | 30 | dailyLimit OK |
| **Pro** (`genai_pro_980`) | 100 | dailyLimit OK |
| non-workspace surface | — | quota skip · HTTP 200 |
| error code | — | `quota_exceeded` unified |

`node scripts/test-ai-workspace-quota-production-compat.mjs` — **3/3 PASS**

**注:** フル Stripe Checkout UI E2E（`e2e-genai-stripe.mjs`）は gen-ai-workspace 向け。Workspace quota の Production 正本は上記 Edge simulate + DB RPC。

---

## ⑤ Final Regression

**検証ベース:** `http://127.0.0.1:8788`（dev 再起動後 · HTTP 200）

| Suite | 結果 |
| --- | --- |
| `test-tasful-ai-final-phase.mjs` | **31/31 PASS** |
| `test-tasful-ai-final-smoke-browser.mjs` | **52/53 PASS** — gen-ai-workspace `@pixiv/three-vrm` import error（TASFUL AI Workspace 外 · 既知） |
| `test-tasful-ai-attach-vision-browser.mjs` | **8/8 PASS** |
| `test-ai-workspace-usage-enforcement-browser.mjs` | **15/15 PASS** |
| `test-tlv-tasful-ai-entry.mjs` | **16/16 PASS** |
| `test-tasful-ai-voice-integration-phase1.mjs` | **39/39 PASS**（1280 / 768 / 390） |
| `test-ai-workspace-quota-unit.mjs` | **8/8 PASS** |
| `test-tasful-ai-production-preflight.mjs`（deploy hash） | **39/39 PASS**（Serper working のみ 502 · secret present として PASS 扱い） |
| `test-tasful-regression-final.mjs` | ❌ **Talk seed timeout**（TALK モジュール · TASFUL AI スコープ外） |

### モデル / 機能別（live Edge + local browser）

| 領域 | 結果 |
| --- | --- |
| OpenAI text / Vision | ✅ live PASS |
| Claude text / Vision | ✅ live PASS |
| Gemini text / Vision | ✅ live PASS |
| Attach | ✅ browser PASS |
| Workspace / Usage / Quota | ✅ browser + Edge PASS |
| Gateway | ✅ final-phase + smoke PASS |
| TLV entry | ✅ 16/16 · gateway unchanged |
| Voice | ✅ 39/39 |
| History / Conversation | ✅ final-phase + smoke PASS |
| Web Search / Hybrid | ❌ live Serper credits · browser partial |

### 他製品への影響（isolation）

| 領域 | 結果 |
| --- | --- |
| Builder | ✅ gateway / core / actions 未変更（final-phase isolation） |
| Platform | ✅ platform hub 未変更 |
| AI秘書 | ✅ secretary 未変更 |
| TLV | ✅ entry 16/16 · gateway unchanged |
| Business Directory / Marketplace | 本フェーズ未触 · regression 対象外 |

---

## 変更ファイル（build EPERM 修正のみ）

| ファイル | 内容 |
| --- | --- |
| `scripts/stop-pages-dev.mjs` | 新規 — dev/wrangler/workerd 停止 |
| `package.json` | `build:pages` に stop 前置 |

**機能追加なし** · Gateway 契約変更なし

---

## 残るブロッカー

| # | ブロッカー | 種別 | 対応 |
| --- | --- | --- | --- |
| 1 | **Serper credits 枯渇** | 運用 | serper.dev で credits 購入 → live プローブ再実行 |
| 2 | **CF Access Service Token 未設定** | 運用/インフラ | Zero Trust で発行 → `.env` 設定 → alias E2E |
| 3 | **本番 alias への formal build deploy 未反映** | 運用 | `npm run build:pages` 後 `wrangler pages deploy`（main） |
| 4 | gen-ai-workspace VRM import | 既知 · 低 | TASFUL AI Go 条件外（Workspace 本体は PASS） |

---

## Production Ready 判定

| 判定 | **No-Go** |
| --- | --- |
| 理由 | Serper live FAIL · CF Access prod alias E2E 未達 |
| Go 条件 | 上記 1–3 解消 + 全 regression PASS + `chore(tasful-ai): production ready final verification` コミット |

---

## 再検証チェックリスト（Go 直前）

- [ ] Serper credits 補充 → `verify-tasful-ai-production-environment.mjs` Serper **PASS**
- [ ] `CF_ACCESS_CLIENT_ID/SECRET` 設定 → prod alias `verify-tasful-ai-access-workspace.mjs` **全 PASS · Access HTML なし**
- [ ] `npm run build:pages` → `wrangler pages deploy deploy/cloudflare/dist --project-name tasufull-article --branch main`
- [ ] 上記 PASS 後コミット（build fix + report + docs）
