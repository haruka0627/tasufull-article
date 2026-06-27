# TASFUL AI — Production Ready Verification（Go）

**実施日:** 2026-06-28  
**Git HEAD（開始）:** `342b10c` — `feat(tasful-ai): add brave web search provider`  
**判定:** **Go — Production Ready（本番接続）**

---

## Deploy

| 項目 | 値 |
| --- | --- |
| build | `npm run build:pages` — **PASS**（EPERM なし · `stop-pages-dev.mjs`） |
| deploy | `node --env-file=.env scripts/deploy-cloudflare-pages.mjs` |
| branch | `main` |
| **Deploy URL** | https://bbe9eb2a.tasufull-article.pages.dev |
| **Production alias** | https://tasufull-article.pages.dev |

---

## 検証結果

| テスト | Base | 結果 |
| --- | --- | --- |
| `verify-tasful-ai-access-workspace.mjs` | prod alias + Service Token | **9/9 PASS** |
| `test-tasful-ai-production-preflight.mjs` | deploy preview（Access なし） | **39/39 PASS** |
| `verify-tasful-ai-production-environment.mjs` | Edge live | **7/7 PASS** |
| `test-web-search-provider-edge.mjs` | Brave Web Search | **7/7 PASS** |
| `test-tasful-ai-final-phase.mjs` | 8788 | **31/31 PASS** |

### prod alias Access E2E（9/9）

- Unauthenticated Access gate · MIME html/js/css · Workspace load · Composer · 390px · console 0  
- 証跡: `reports/tasful-ai-access-workspace-check.json`

### 注: preflight on prod alias（Service Token なし）

`test-tasful-ai-production-preflight.mjs` を **Access 保護 alias** で Service Token なし実行すると JS/CSS が `text/html`（login HTML）となり **29/39 FAIL** — 期待どおり。  
**正本 E2E:** `verify-tasful-ai-access-workspace.mjs`（Service Token 付き）。

---

## Production Ready チェックリスト

- [x] CF Access E2E PASS（Service Auth policy + verify script）
- [x] `build:pages` PASS
- [x] prod alias deploy PASS（branch=main）
- [x] Workspace / Gateway / JS/CSS MIME PASS（Service Token 経由）
- [x] 390px layout PASS · console error なし
- [x] Brave Search live PASS
- [x] Gateway 契約変更なし · UI 本体変更なし
- [x] unrelated working tree 未混入

---

## 変更（本セッション）

| ファイル | 内容 |
| --- | --- |
| `scripts/verify-tasful-ai-access-workspace.mjs` | Service Token 診断 · 静的 HTML マーカー · Playwright route |
| `deploy/cloudflare/dist/ai-workspace.html` | formal build 同期（search-blocking meta） |

---

## 残タスク（Production Ready 外）

| 項目 | 備考 |
| --- | --- |
| working tree 選別（P0-1） | Builder / Platform / TLV / ANPI 等 未コミット大量残 |
| `test-tasful-ai-production-preflight.mjs` | prod alias + Service Token 対応（任意 · verify script が正本） |
| 動画/音楽 API 本番 `enabled: true` | P0-2 backlog |
| TASFUL AI 操作アシスタント | backlog |

---

## 参照

- `reports/brave-search-phase1.md`
- `reports/tasful-ai-production-ready-next-plan.md`
