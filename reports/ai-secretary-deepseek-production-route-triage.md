# AI 秘書 DeepSeek — Production Route Triage

**実施日:** 2026-06-28  
**Git HEAD:** `34e54ff` — `docs(secretary): add p0 production smoke evidence`  
**種別:** 調査・切り分けのみ（**実装変更なし · deploy なし · commit 未実施**）  
**前提:** working tree **clean** · P0 smoke No-Go 証跡 commit 済 · Admin UI PASS 済

**関連証跡:** `reports/ai-secretary-p0-production-smoke.md` · `reports/secretary-deepseek-deploy-triage.md`

---

## 総合判定

| 項目 | 判定 |
| --- | --- |
| **経路設計（Adapter → path）** | ✅ 正しい |
| **ソース / dist functions 配置** | ✅ リポジトリ上は揃っている |
| **ローカル 8788 Function 到達** | ✅ POST → **503 JSON**（Secret 未バインド） |
| **Production alias 到達** | ❌ **Cloudflare Access 302**（P0 は follow で HTML と誤分類） |
| **Production preview 到達** | ❌ **405 空応答** — Function **未マウント** |
| **Production Secret** | ❌ **未登録想定**（prior triage どおり） |

**HTML fallback の主因:** P0 の「SPA fallback」は **誤分類**。実体は **(A) Cloudflare Access ログイン HTML**（alias）+ **(B) 現行 deploy 成果物に Pages Function 不在**（preview）。

---

## 1. git status

```
git status --short → （空 · clean）
```

---

## 2. 期待 endpoint（Production URL）

クライアントは同一オリジンで **1 本のみ**（Gateway 非経由 · AD-010）。

| # | Method | Path | Surface | 用途 |
| ---: | --- | --- | --- | --- |
| 1 | **POST** | `/api/secretary-deepseek-chat` | `ops_secretary` | DeepSeek チャット（本番） |
| 2 | OPTIONS | 同上 | — | CORS preflight（Function 実装あり） |

**Production ベース URL（想定）**

| 種別 | URL |
| --- | --- |
| Production alias | `https://tasufull-article.pages.dev/api/secretary-deepseek-chat` |
| Deploy preview（Access なし） | `https://<deployment-id>.tasufull-article.pages.dev/api/secretary-deepseek-chat` |
| ローカル dev | `http://127.0.0.1:8788/api/secretary-deepseek-chat` |

**クライアント定義**

- `admin-ai-secretary-deepseek-adapter.js` — `API_PATH = "/api/secretary-deepseek-chat"`
- `admin-ai-secretary-phase2.js` — `TasuSecretaryDeepSeekAdapter` 経由（`TasuAiModelGateway` 不使用）

**Gateway 関連:** 本 endpoint は **秘書専用 Pages Function**。`ai-model-gateway.js` 契約とは独立（AD-010）。

---

## 3. P0 smoke が実際に叩いた endpoint

| Probe | Endpoint | Method | HTTP | Content-Type | 解釈 |
| --- | --- | --- | ---: | --- | --- |
| local-8788 | `http://127.0.0.1:8788/api/secretary-deepseek-chat` | POST | **503** | `application/json` | ✅ **Function 到達** · `configured:false` |
| production-pages-dev | `https://tasufull-article.pages.dev/api/secretary-deepseek-chat` | POST | **200** | `text/html` | ❌ Function JSON 未到達（後述: Access HTML） |

**P0 JSON:** `reports/ai-secretary-p0-production-smoke.json`

---

## 4. 本 triage 追加 probe（2026-06-28 · read-only）

| Probe | HTTP | Content-Type / 署名 | Function 到達 |
| --- | ---: | --- | --- |
| **local POST** | 503 | JSON · `DEEPSEEK_API_KEY not configured` | ✅ |
| **local OPTIONS** | **204** | `Access-Control-Allow-Methods: POST, OPTIONS` | ✅ |
| **alias POST · redirect:manual** | **302** | `text/html` · 302 Found | ❌ Access ゲート |
| **alias POST · redirect:follow** | 200 | HTML ~30KB · `<title>Sign in ・ Cloudflare Access</title>` | ❌ Access ログイン（SPA ではない） |
| **alias GET** | 200 | 同上 Access HTML | ❌ |
| **preview `bbe9eb2a` POST** | **405** | body 空 · Content-Type なし | ❌ Function 署名不一致 |
| **preview `bbe9eb2a` OPTIONS** | **405** | body 空 | ❌ Function 未マウント |
| **preview `bbe9eb2a` GET** | 200 | HTML ~67KB | 静的 / SPA fallback（API path への GET） |

**対照:** Function がマウントされている場合、POST（Secret なし）は **503 JSON**、OPTIONS は **204**（ローカル実測）。

**現行 Production deploy:** `bbe9eb2a.tasufull-article.pages.dev` → alias `tasufull-article.pages.dev`（`reports/tasful-ai-production-ready-verification.md` · TASFUL AI deploy · 2026-06-28）

---

## 5. Route / Function 定義の所在

| レイヤ | パス | 役割 |
| --- | --- | --- |
| **クライアント Adapter** | `admin-ai-secretary-deepseek-adapter.js` | `POST` + JSON body |
| **Function ソース（正）** | `deploy/cloudflare/functions/api/secretary-deepseek-chat.js` | Pages Function ハンドラ |
| **共有ロジック** | `deploy/cloudflare/functions/_shared/secretary-deepseek.mjs` | DeepSeek API 呼び出し |
| **dist ミラー（deploy 同梱）** | `deploy/cloudflare/dist/functions/api/secretary-deepseek-chat.js` | git tracked（`6c70985`） |
| **dist 共有** | `deploy/cloudflare/dist/functions/_shared/secretary-deepseek.mjs` | 同上 |
| **`_worker.js`** | **なし** | file-based Pages Functions のみ |
| **`wrangler.toml`** | **なし** | deploy script が CLI 直叩き |
| **`_routes.json`** | **なし** | 全 path で functions 評価（デフォルト） |

**Cloudflare ルーティング規約:** `dist/functions/api/secretary-deepseek-chat.js` → **`/api/secretary-deepseek-chat`**

**ビルド:** `deploy/cloudflare/stage-cloudflare-pages.mjs` → `copyPagesFunctions()`  
`deploy/cloudflare/functions/` → `deploy/cloudflare/dist/functions/`

**ローカル dev:** `scripts/dev-pages.mjs` — CWD=`deploy/cloudflare/dist` · `--env-file`  repo root `.env`

**Production deploy:** `scripts/deploy-cloudflare-pages.mjs`  
1. `node deploy/cloudflare/stage-cloudflare-pages.mjs`  
2. `wrangler pages deploy deploy/cloudflare/dist --project-name tasufull-article`

---

## 6. build / deploy 対象 vs 含めるべきファイル

### 含めるべき（secretary DeepSeek）

| ファイル | ソース | dist | git tracked |
| --- | --- | --- | --- |
| `functions/api/secretary-deepseek-chat.js` | ✅ | ✅ | ✅ |
| `functions/_shared/secretary-deepseek.mjs` | ✅ | ✅ | ✅ |
| `admin-ai-secretary-deepseek-adapter.js` | root | dist コピー | ✅ |
| `admin-ai-secretary-phase2.js` | root | dist コピー | ✅ |
| `admin-operations-dashboard.html` | root | dist コピー | ✅ |

### 検証ギャップ

| Script | `functions/` 検証 |
| --- | --- |
| `scripts/verify-cloudflare-pages-stage.mjs` | ❌ **REQUIRED_PATHS に未含** |
| `scripts/smoke-cloudflare-pages.mjs` | ❌ **`/api/secretary-deepseek-chat` 未チェック** |

**リスク:** dist に functions が無い状態でも stage verify が PASS し得る。現行 **preview 405** は「deploy 成果物に Function が載っていない」可能性が高い（リポジトリ dist には存在するが、**直近 deploy アーティファクトでは未マウント**）。

---

## 7. HTML fallback 原因分類

| ID | 分類 | 信頼度 | 根拠 |
| --- | --- | --- | --- |
| **RC-1** | **Cloudflare Access（auth / routing）** | **高** | alias POST manual → **302** · follow → Access ログイン HTML（~30KB）。P0 の「SPA fallback」は **redirect follow による誤検知** |
| **RC-2** | **Pages Function 未配置（deploy 成果物）** | **高** | preview `bbe9eb2a` POST/OPTIONS → **405 空**（local は 503 JSON / OPTIONS 204）。Function ハンドラの応答形式と不一致 |
| **RC-3** | **Production Secret 未登録** | **高（到達後）** | `secretary-deepseek-deploy-triage.md` · Function 到達後も **503** になる想定 |
| **RC-4** | **ローカル Secret バインド不足** | **高（8788 のみ）** | `.env` に `DEEPSEEK_API_KEY` **present（non-empty）** だが POST **503** · `deploy/cloudflare/dist/.dev.vars` **MISSING** |
| **RC-5** | **endpoint path 不一致** | **低** | クライアント・ソース・dist すべて `/api/secretary-deepseek-chat` で一致 |
| **RC-6** | **deploy script が function を除外** | **中** | script 自体は `dist/functions` を deploy 対象に含む設計 · **verify が functions を見ていない**ため欠落検知弱い |
| **RC-7** | **production alias が古い deploy** | **部分** | alias は `bbe9eb2a` と同一アーティファクト · 古い alias 単独では説明不足（preview 自体が 405） |

### P0 記述の訂正

| P0 記載 | 本 triage 訂正 |
| --- | --- |
| Production 200 · SPA fallback | **Access ログイン HTML**（未認証 · redirect follow） |
| Function 未到達 | alias: **Access で未到達** · preview: **Function 未マウント** |

---

## 8. ローカル 8788 — Secret presence（値は非表示）

| 項目 | 状態 |
| --- | --- |
| repo root `.env` | **存在** |
| `DEEPSEEK_API_KEY` 行 | **present（non-empty）** |
| `deploy/cloudflare/dist/.dev.vars` | **MISSING** |
| POST `/api/secretary-deepseek-chat` | **503** · `configured:false` · JSON |

**解釈:** Pages Function **自体はローカルで動作**。wrangler pages dev が Function `env.DEEPSEEK_API_KEY` に `.env` を渡していない（Pages Functions は `.dev.vars` が正本のことが多い）。**Secret 値は本レポートに記載しない。**

---

## 9. 最小修正案

| 順 | 対象 | 内容 | 種別 |
| ---: | --- | --- | --- |
| 1 | **Smoke 手順** | alias 直叩き禁止 · **preview URL** または **CF Access Service Token** で POST 検証 · `redirect: manual` 必須 | 運用 / ドキュメント |
| 2 | **Deploy** | `npm run build:pages`（dev 停止後）→ `wrangler pages deploy` · deploy 直後 **preview** で OPTIONS **204** / POST **503 JSON** を確認 | **deploy 必須** |
| 3 | **CF Pages Secret** | Production 環境に `DEEPSEEK_API_KEY` 登録（Encrypted） | インフラ |
| 4 | **DeepSeek 残高** | 200 · `usedDeepSeek:true` smoke 前にチャージ | 運用 |
| 5 | **verify script** | `verify-cloudflare-pages-stage.mjs` に `functions/api/secretary-deepseek-chat.js` 等を REQUIRED_PATHS 追加 | **commit 候補**（小） |
| 6 | **smoke script** | preview base で POST `/api/secretary-deepseek-chat` → 503/502/200 JSON 期待 | **commit 候補**（小） |
| 7 | **ローカル dev** | `deploy/cloudflare/dist/.dev.vars` に `DEEPSEEK_API_KEY`（gitignore · 値非コミット）— または wrangler env バインド手順を `docs/local-dev.md` に明記 | 運用 / 任意 doc |

**コード変更（Adapter / Function / Gateway）:** 現時点 **不要**。ルーティング定義は正しい。

---

## 10. deploy / commit 要否

| 質問 | 回答 |
| --- | --- |
| **deploy が必要か** | **はい** — preview 405 は Function 未マウント。Secret 登録とセットで本番到達確認が必要 |
| **commit 候補か** | **本レポートのみ** — 調査成果物として commit 可（ユーザー指示時）。機能 fix commit は不要 |
| **source / dist 変更** | **不要**（本タスク scope 外） |

---

## 11. 完了報告サマリ

| 項目 | 内容 |
| --- | --- |
| **期待 endpoint** | `POST /api/secretary-deepseek-chat`（`ops_secretary`）@ 同一オリジン |
| **実際の endpoint（smoke）** | local **503 JSON** ✅ · prod alias **200 Access HTML** ❌ |
| **実際の endpoint（triage 追加）** | alias **302**（manual）· preview **405 空** ❌ |
| **route 定義の所在** | `deploy/cloudflare/functions/api/secretary-deepseek-chat.js` → dist ミラー · file-based Pages Functions |
| **fallback 原因候補** | **RC-1 Access** + **RC-2 Function 未マウント on deploy** + **RC-3/4 Secret** |
| **最小修正案** | Access 対応 smoke · redeploy + functions 署名確認 · Production Secret · verify/smoke 拡張 |
| **deploy** | **必要** |
| **commit** | **本 report のみ候補**（実装 commit 不要） |

---

## 参照

- `reports/ai-secretary-p0-production-smoke.md`
- `reports/secretary-deepseek-deploy-triage.md`
- `reports/secretary-deepseek-adapter-phase1.md`
- `reports/tasful-ai-production-ready-verification.md`
- `docs/AI/SECRETARY_AI.md` · AD-010
