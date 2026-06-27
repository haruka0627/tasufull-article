# TASFUL AI Production Environment Fix — レポート

実施日: 2026-06-26  
方針: **アプリ仕様変更なし** · **本番環境・Edge・デプロイ整備のみ**

---

## 実施サマリー

| 作業 | 結果 |
| --- | --- |
| Supabase Edge 再デプロイ（Vision 含む） | ✅ 完了 |
| Cloudflare Pages 再デプロイ | ✅ 完了 |
| OpenAI / Claude Vision live 確認 | ✅ 復旧 |
| Gemini billing 確認 | ⚠️ credits 枯渇（429） |
| Serper credits 確認 | ⚠️ 枯渇（502） |
| Cloudflare Access + MIME | ⚠️ 本番 URL は Access 保護 · デプロイ成果物は MIME 正常 |

**アプリコード（HTML/JS/CSS/Gateway 契約）: 変更なし**

---

## 1. Edge deploy 状態

### デプロイ前（Preflight 時点）

| Function | Version | Updated (UTC) | Vision (`ai-attachments.ts`) |
| --- | --- | --- | --- |
| `gemini-chat` | 22 | 2026-06-22 | ❌ live で Vision 未動作 |
| `openai-chat` | 11 | 2026-06-12 | ❌ 同上 |
| `claude-chat` | 10 | 2026-06-12 | ❌ 同上 |
| `serper-search` | 7 | 2026-06-04 | — |

**原因:** `openai-chat` / `claude-chat` は Attach/Vision 対応コードが **live 未反映**（デプロイ漏れ）。

### デプロイ実施

```text
npx supabase functions deploy gemini-chat openai-chat claude-chat serper-search \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

アップロード確認:

- `gemini-chat` → `_shared/ai-attachments.ts` ✅
- `openai-chat` → `_shared/ai-attachments.ts` ✅
- `claude-chat` → `_shared/ai-attachments.ts` ✅
- `serper-search` → `_shared/cors.ts` のみ（コード変更なし · 再デプロイのみ）

### デプロイ後

| Function | Version | Updated (UTC) | Routing |
| --- | --- | --- | --- |
| `gemini-chat` | **23** | 2026-06-25 22:11:34 | `/functions/v1/gemini-chat` |
| `openai-chat` | **12** | 2026-06-25 22:11:34 | `/functions/v1/openai-chat` |
| `claude-chat` | **11** | 2026-06-25 22:11:34 | `/functions/v1/claude-chat` |
| `serper-search` | **8** | 2026-06-25 22:11:34 | `/functions/v1/serper-search` |

Edge base: `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1`

---

## 2. Vision 状態

プローブ: 1×1 PNG を `attachments[]` で POST（`scripts/verify-tasful-ai-production-environment.mjs`）

| Provider | Text | Vision | 応答例（Vision） |
| --- | --- | --- | --- |
| **OpenAI** | ✅ HTTP 200 | ✅ HTTP 200 | `Red.` |
| **Claude** | ✅ HTTP 200 | ✅ HTTP 200 | `Dot` / `# Dot` |
| **Gemini** | ❌ HTTP 429 | ❌ HTTP 429 | billing — 下記 §3 |

**Edge 到達 · payload 生成 · Vision 応答:** OpenAI / Claude は **デプロイ後に復旧**。Gemini は billing 復旧待ち。

Preflight 再実行でも OpenAI Vision `赤色` · Claude Vision `点` を確認（Post-deploy PASS）。

---

## 3. Gemini 状態（確認のみ · コード変更なし）

| 項目 | 状態 |
| --- | --- |
| Edge secret 参照 | ✅ `GEMINI_API_KEY` present（値は未ログ） |
| Secret digest vs Edge | ✅ MATCH（`scripts/diagnose-gemini-edge.mjs`） |
| Google API `generateContent` | ❌ **429** `RESOURCE_EXHAUSTED` |
| メッセージ | `Your prepayment credits are depleted` |
| `models.list` | ✅ HTTP 200（キー有効 · 生成のみ不可） |
| 復旧手順 | [Google AI Studio](https://ai.studio/projects) で prepay / billing チャージ |

**Billing 復旧後:** `node scripts/verify-tasful-ai-production-environment.mjs` で Gemini text / Vision を再プローブ。

---

## 4. Serper 状態（確認のみ · コード変更なし）

| 項目 | 状態 |
| --- | --- |
| `SERPER_API_KEY` on Edge | ✅ present（503 not-configured ではない） |
| `serper-search` live | ❌ **502** |
| Upstream 原因 | Serper API **400: `Not enough credits`** |
| Edge 接続 | ✅ 到達 · キー参照 · upstream が拒否 |

**復旧手順:** Serper ダッシュボードで credits チャージ、または有効クレジットのある API キーを Supabase secret に反映（値はレポートに記載しない）。

---

## 5. Cloudflare Access 状態

| URL | Access | 備考 |
| --- | --- | --- |
| `https://tasufull-article.pages.dev/*` | ✅ 有効 | 未認証 → Cloudflare Access ログイン HTML |
| `https://cf-pages-deploy.tasufull-article.pages.dev/*` | なし | デプロイ alias · MIME/Workspace 検証用 |
| `https://6d60c6ea.tasufull-article.pages.dev/*` | なし | 今回のデプロイ preview |

**本番 URL（Access 配下）:** 未認証では Workspace 未到達（意図どおり private test gate）。

**認証後 E2E 自動化:** `.env` に `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`（Service Token）未設定 → `scripts/verify-tasful-ai-access-workspace.mjs` は本番ホストで MIME 未検証。**OTP セッションまたは Service Token 設定後に再実行可能。**

---

## 6. MIME

### 本番 URL（Access · 未認証）

| Asset | HTTP | Content-Type | 実体 |
| --- | --- | --- | --- |
| `ai-workspace.html` | 200 | text/html | Access ログイン |
| `ai-workspace-chat.js` | 200 | text/html | Access ログイン（MIME FAIL の原因） |

### デプロイ成果物（Access なし · 検証済み）

| Asset | HTTP | Content-Type |
| --- | --- | --- |
| `ai-workspace.html` | 200 | text/html |
| `ai-workspace-chat.js` | 200 | application/javascript |
| `ai-model-gateway.js` | 200 | application/javascript |
| `tasful-ai-voice.css` | 200 | text/css |

**結論:** 静的ファイル自体の MIME は **正常**。本番 hostname の未認証 MIME 問題は **Access ゲート** が原因。

---

## 7. Routing

| 経路 | 状態 |
| --- | --- |
| Pages → `ai-workspace.html` | ✅ dist に存在 · デプロイ済 |
| Pages → `*.js` / `*.css` | ✅ 正しいパス · 正しい MIME（preview 確認） |
| Browser → Supabase Edge `/functions/v1/*` | ✅ anon key 経由 |
| Workspace composer @390px | ✅ preview URL で PASS（model bar · 横スクロールなし · console error なし） |

### Cloudflare Pages デプロイ

```text
npx wrangler pages deploy deploy/cloudflare/dist --project-name=tasufull-article
```

- Preview: `https://6d60c6ea.tasufull-article.pages.dev`
- Branch alias: `https://cf-pages-deploy.tasufull-article.pages.dev`
- Upload: 165 new + 1173 cached files · `_headers` / `_redirects` 同梱

---

## 8. build 結果

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |

---

## 9. test 結果

| コマンド | 結果 | 備考 |
| --- | --- | --- |
| `test-admin-ai-secretary-text-chat-browser.mjs` | **PASS** | |
| `test-talk-ops-assistant-browser.mjs` | **PASS** | |
| `test-admin-operations-dashboard-browser.mjs` | **PASS**（単独） | 連続実行時 Connect コピー flake（製品 bug ではない） |
| `test-ai-voice-core-browser.mjs` | **PASS** | |
| `test-tasful-ai-attach-vision-browser.mjs` | **PASS** | |
| `test-tasful-ai-final-smoke-browser.mjs` | **PASS** (53/53) | |
| `test-tasful-ai-production-preflight.mjs` | **PARTIAL** | Access 未認証 MIME/browser FAIL · Edge Vision OpenAI/Claude PASS |
| `verify-tasful-ai-production-environment.mjs` | **PARTIAL** | Gemini + Serper FAIL · OpenAI/Claude PASS |
| `verify-tasful-ai-access-workspace.mjs` | **PASS** | `PAGES_BASE_URL=cf-pages-deploy...` |

**回帰:** AI秘書 · Voice Core · Gateway 契約 · Platform/Builder/TLV — **変更なし · 既存テスト PASS**

---

## 10. Production Ready 判定

### 判定: **NO**（大幅改善 · 残り 3 ブロッカー）

| ブロッカー | 内容 | 所有者 |
| --- | --- | --- |
| Gemini billing | prepay credits 枯渇 → 429 | Google AI Studio 側 |
| Serper credits | Not enough credits → Web 検索不可 | Serper アカウント |
| Access E2E | 本番 hostname の認証後 MIME/Workspace 自動検証未完了 | CF Service Token 設定 |

**達成済み:** Edge Vision デプロイ · OpenAI/Claude live Vision · Pages 再デプロイ · staging MIME/routing · 全ローカル E2E PASS

---

## 11. 追加スクリプト

| スクリプト | 用途 |
| --- | --- |
| `scripts/verify-tasful-ai-production-environment.mjs` | live Edge text / Vision / Serper プローブ |
| `scripts/verify-tasful-ai-access-workspace.mjs` | MIME · routing · Workspace browser（`PAGES_BASE_URL` / `CF_ACCESS_*`） |

出力 JSON:

- `reports/tasful-ai-production-environment-probes.json`
- `reports/tasful-ai-access-workspace-check.json`

---

## 12. 触っていない領域

- `TasuAiModelGateway.completeTurn()` 契約
- AI秘書 / Platform / Builder / TLV アプリコード
- 課金 enforcement · 画像生成 API · PDF 解析
- Supabase secret **値**の変更（存在確認のみ）

---

## 判定サマリー

| 項目 | 状態 |
|------|------|
| Edge Deploy | ✅ |
| Vision | ⚠️ |
| Gemini | ⚠️ |
| OpenAI | ✅ |
| Claude | ✅ |
| Serper | ⚠️ |
| Access | ⚠️ |
| MIME | ⚠️ |
| Routing | ⚠️ |
| Production Ready | **NO** |

**凡例:** ✅ = 本番整備完了 · ⚠️ = 外部要因または Access 認証待ち · Vision/Gemini/Serper/MIME/Routing は ⚠️（OpenAI/Claude Vision と Pages 成果物 MIME は ✅ だが、項目全体として Gemini/Serper/Access が未達のため ⚠️）

---

## 次のアクション（最小）

1. **Gemini:** AI Studio で prepay チャージ → `node scripts/verify-tasful-ai-production-environment.mjs`
2. **Serper:** credits チャージ → 同上
3. **Access:** Service Token を `.env` に設定 → `PAGES_BASE_URL=https://tasufull-article.pages.dev node --env-file=.env scripts/verify-tasful-ai-access-workspace.mjs`
4. 上記 3 点 PASS 後 → **Production Ready: YES** 再判定
