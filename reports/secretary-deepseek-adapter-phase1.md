# AI 秘書 — DeepSeek Adapter Phase 1 実装報告

**実施日:** 2026-06-26  
**状態:** **Phase 1 実装完了** · **運用残件あり**（**未コミット · 未デプロイ**）  
**正本:** [docs/TODO.md](../docs/TODO.md) §P0-3 · [docs/AI/SECRETARY_AI.md](../docs/AI/SECRETARY_AI.md)  
**設計:** `reports/secretary-deepseek-adapter-design.md` · Phase 2: `reports/secretary-ops-context-builder-design.md`  
**制約:** AD-010 · AD-005 · Gateway 非変更 · API キー非保存

---

## 正本ステータス（2026-06-26）

### 完了（Phase 1 実装）

| 項目 | 状態 |
| --- | --- |
| DeepSeek Adapter Phase 1 | **完了** |
| Cloudflare Pages Function 経由 | **完了** |
| `DEEPSEEK_API_KEY` 読み込み | **完了**（ローカル · `.env` + `dist/.dev.vars`） |
| DeepSeek API 到達 | **完了**（`configured:true` · 502 `Insufficient Balance` まで） |
| Gateway 非混在 / AD-010 | **完了** |
| 503 / 502 graceful fallback | **完了** |
| `npm run build:pages` | **PASS** |
| ブラウザテスト | **10/10** · **8/8** PASS |

### 未完了（運用）

| 項目 | 状態 |
| --- | --- |
| DeepSeek 残高チャージ | **未** |
| HTTP 200 · `usedDeepSeek:true` · assistant text | **未**（残高不足で 502） |
| CF Production Secret `DEEPSEEK_API_KEY` | **未** |
| Production deploy | **未** |
| Production smoke | **未** |
| OpsContextBuilder（運営データ注入） | **Phase 2 実装完了** — `reports/secretary-ops-context-builder-phase2.md` |

---

## API Key 管理方針（統一）

| 項目 | 方針 |
| --- | --- |
| **Secret 名** | `DEEPSEEK_API_KEY` |
| **本番** | **Cloudflare Pages / Workers Secret**（Encrypted） |
| **ローカル** | **`.env`**（リポジトリルート）+ Pages Functions dev 用 **`deploy/cloudflare/dist/.dev.vars`**（Git 禁止 · wrangler が Function `env` に載せる） |
| **`npm run dev`** | `scripts/dev-pages.mjs` → wrangler `--env-file=<root>/.env` · CWD=`dist` |
| **Supabase Secret** | **使用しない** |
| **クライアント** | API Key を渡さない · 同一オリジン POST のみ |
| **禁止** | コード · Git · docs · reports · ログへのキー保存 |
| **未設定時** | HTTP 503 · モックフォールバック · 画面クラッシュなし |

---

## 概要

AI 運営秘書のテキスト LLM 呼び出しを `TasuAiModelGateway` から **`TasuSecretaryDeepSeekAdapter` + Cloudflare Pages Function** へ移行。

```
Browser
  └─ admin-ai-secretary-deepseek-adapter.js
       POST /api/secretary-deepseek-chat  （同一オリジン）
            └─ deploy/cloudflare/functions/api/secretary-deepseek-chat.js
                 env.DEEPSEEK_API_KEY → api.deepseek.com
```

OPS WATCH（`ops_watch`）は従来どおり Gateway。

---

## 新規ファイル

| ファイル | 役割 |
| --- | --- |
| `deploy/cloudflare/functions/_shared/secretary-deepseek.mjs` | DeepSeek API 呼び出し共有 |
| `deploy/cloudflare/functions/api/secretary-deepseek-chat.js` | Pages Function · Secret 未設定時 503 |
| `admin-ai-secretary-deepseek-adapter.js` | クライアント Adapter |
| `scripts/test-secretary-deepseek-adapter-browser.mjs` | Adapter ブラウザテスト |
| `.env.example` | ローカル用変数名テンプレ（値は空） |
| `scripts/dev-pages.mjs` | wrangler を `deploy/cloudflare/dist` から起動（Functions マウント） |

**削除:** `supabase/functions/secretary-deepseek-chat/` · `supabase/functions/_shared/secretary-deepseek.ts`（Supabase Secret 方針に反するため）

---

## 変更ファイル

| ファイル | 変更内容 |
| --- | --- |
| `admin-ai-secretary-phase2.js` | Adapter 経由 · CF Function 向けメッセージ |
| `admin-operations-dashboard.html` / `talk-ops-room.html` | Adapter script |
| `deploy/cloudflare/stage-cloudflare-pages.mjs` | `functions/` → `dist/functions/` コピー |
| `scripts/ensure-pages-dist.mjs` | dev 時 functions 同期 |
| `package.json` | `dev` → `scripts/dev-pages.mjs`（dist CWD · `--env-file`） |
| `docs/DECISIONS.md` AD-010 | Secret 保管先を明記 |
| `docs/AI/SECRETARY_AI.md` | Phase 1 状態 · 管理方針 |

---

## テスト結果

### 実API疎通前 最終確認（2026-06-26）

#### セキュリティ

| 項目 | 結果 |
| --- | --- |
| `DEEPSEEK_API_KEY` 実値が code / docs / reports / ログに無い | **PASS** — 変数名・空テンプレのみ |
| `.env` が `.gitignore` 対象 | **PASS** — `.gitignore:4` · `git ls-files .env` 空 |
| `.env.example` に実キー無し | **PASS** — `DEEPSEEK_API_KEY=`（空） |
| `ai-model-gateway.js` 変更なし | **PASS** — `git diff HEAD -- ai-model-gateway.js` 0 行 |

#### 同一オリジン API · 503 · モック

| 項目 | 結果 |
| --- | --- |
| `npm run dev` で `/api/secretary-deepseek-chat` マウント | **PASS**（`scripts/dev-pages.mjs` で CWD=`dist` に修正後） |
| Secret 未設定時 HTTP 503 | **PASS** — `curl` / `fetch` → 503 · `"DEEPSEEK_API_KEY not configured"` |
| ブラウザ 503 → モック応答 · 画面クラッシュなし | **PASS** — dashboard 送信後 assistant 応答あり · `apiStatus:503` |
| Gateway 経由で秘書 LLM を呼ばない | **PASS** — Adapter テストで `gw=0` |

#### ビルド · ブラウザテスト

```text
npm run build:pages
  → 本セッション EPERM（dist が wrangler/workerd ロック · プロセス停止後も再発）
  → 既存 dist に functions/api/secretary-deepseek-chat.js あり · 前回ビルド成果で dev 検証実施

npm run dev
  → ✨ Compiled Worker successfully · Ready http://127.0.0.1:8788

node scripts/test-secretary-deepseek-adapter-browser.mjs   → 10/10 PASS
node scripts/test-admin-ai-secretary-text-chat-browser.mjs → 8/8 PASS
console error 0 / network error 0（秘書関連 · file:// 既知 CORS はフィルタ済み）
```

#### 実 DeepSeek API 疎通

| 項目 | 結果 |
| --- | --- |
| ローカル `.env` にキー設定 | **未設定**（空 · 値は読取・記録していない） |
| `api.deepseek.com` 実呼び出し | **未実施** — キー設定後に再試験 |

---

### clean build と実API疎通（2026-06-26 · 第2回）

#### 手順

1. `8788` / `workerd` / 残留 `node` プロセス停止
2. `npm run build:pages` 再実行
3. `npm run dev` 起動（`scripts/dev-pages.mjs` · `--env-file=.env`）
4. `POST /api/secretary-deepseek-chat` · dashboard 1 往復 · 既存 browser テスト

#### build:pages

| 項目 | 結果 |
| --- | --- |
| 初回 | **EPERM** — `deploy/cloudflare/dist` ロック（残留 node 多数） |
| node/workerd 全停止後 | **PASS** — `functions/` 同梱 · TLV 12 files · search-blocking 252 HTML |
| dist 関数 | `deploy/cloudflare/dist/functions/api/secretary-deepseek-chat.js` 存在確認 |

#### 実 DeepSeek API 疎通

| 項目 | 結果 |
| --- | --- |
| `.env` `DEEPSEEK_API_KEY` | **空**（存在チェックのみ · 実値未読取） |
| プロセス環境 `DEEPSEEK_API_KEY` | **未設定** |
| wrangler bindings 一覧 | `DEEPSEEK_API_KEY` **未表示**（空 .env のため） |
| `POST /api/secretary-deepseek-chat` | **503** · `configured:false` · `usedDeepSeek:false` · `error:"DEEPSEEK_API_KEY not configured"` |
| HTTP 200 / `configured:true` / DeepSeek 応答 | **未達** — **`.env` にキー設定後 · dev 再起動が必要** |

#### dashboard 1 往復（live dev · 8788）

| 項目 | 結果 |
| --- | --- |
| 送信 → assistant 表示 | **PASS**（2 messages · クラッシュなし） |
| API 応答 | **503** → モックフォールバック（Secret 未設定どおり） |
| console error（秘書関連） | **0** |
| network | API **503** 1 件（期待どおり · 秘書 UI は継続） |

#### ブラウザテスト（再実行）

```text
node scripts/test-secretary-deepseek-adapter-browser.mjs   → 10/10 PASS
node scripts/test-admin-ai-secretary-text-chat-browser.mjs → 8/8 PASS
```

`ai-model-gateway.js` diff: **0 行**

#### 実API再試験（2026-06-26 · 第3回 · キー設定後）

| 項目 | 結果 |
| --- | --- |
| `.env` `DEEPSEEK_API_KEY` 行 | **あり**（41 行目 · 値は未読取・未記録） |
| `dist/.dev.vars` 同期 | **必要** — `--env-file` のみでは Function `env` に未載せ（503）→ `.dev.vars` 後 wrangler `env.DEEPSEEK_API_KEY (hidden)` |
| `POST /api/secretary-deepseek-chat` | **502** · `configured:true` · `usedDeepSeek:false` · `error:"Insufficient Balance"` |
| HTTP 200 / DeepSeek assistant text | **未達** — DeepSeek アカウント **残高不足** |
| dashboard 1 往復 | **PASS**（502 → モックフォールバック · console 0 · UI 継続） |

**残運用:** DeepSeek 残高チャージ → dev 再起動 → 200 / `usedDeepSeek:true` / assistant text 再確認

#### 実API再試験チェックリスト（残高チャージ後 · 値は記録しない）

1. `.env` に `DEEPSEEK_API_KEY` を設定（Git 禁止）
2. `npm run dev` 再起動 → wrangler bindings に `DEEPSEEK_API_KEY` が **local** で表示されること
3. `POST /api/secretary-deepseek-chat` → **200** · `configured:true` · `usedDeepSeek:true` · `replyLen > 0`
4. dashboard 1 往復 → DeepSeek 応答（モックラベルなし）
5. 本表を **PASS** に更新

**実API疎通手順（次ステップ）**

1. `.env` に `DEEPSEEK_API_KEY=` を設定（Git 禁止）
2. `npm run dev` 再起動
3. 確認:
   ```bash
   curl -s -X POST "http://127.0.0.1:8788/api/secretary-deepseek-chat" \
     -H "Content-Type: application/json" \
     -d '{"message":"ping","surface":"ops_secretary"}'
   # → 200 · configured:true · usedDeepSeek:true（キー有効時）
   ```
4. dashboard で 1 往復送信 · DeepSeek 応答を目視
5. 本レポート「実 DeepSeek API 疎通」表を更新

---

### Phase 1 初回テスト（file:// モック）

```text
node scripts/test-secretary-deepseek-adapter-browser.mjs   → 10/10 PASS
node scripts/test-admin-ai-secretary-text-chat-browser.mjs → 8/8 PASS
console error 0 / network error 0（秘書関連 · file:// 既知 CORS はフィルタ済み）
```

`npm run build:pages` は dist 生成時に `functions/` を同梱（コミット前 QA で実施）。

---

## Secret 登録手順

### 本番（Cloudflare Pages）

1. Cloudflare Dashboard → **Workers & Pages** → 対象 Pages プロジェクト
2. **Settings → Environment variables → Production**
3. **Encrypt** で追加:
   - `DEEPSEEK_API_KEY` = DeepSeek ダッシュボードで発行（リポジトリに書かない）
   - （任意）`DEEPSEEK_CHAT_MODEL` = `deepseek-chat`
4. 再デプロイ（`build:pages` 後の dist に `functions/` が含まれること）

### ローカル

1. `.env.example` をコピーして **リポジトリルート** `.env` を作成
2. `DEEPSEEK_API_KEY=` にキーを設定（`.env` は gitignore 済み · **コミット禁止**）
3. **`deploy/cloudflare/dist/.dev.vars`** に同一変数行を置く（Pages Functions ローカル dev · **コミット禁止**）
4. `npm run dev` → `http://127.0.0.1:8788/admin-operations-dashboard.html`
5. wrangler bindings に `env.DEEPSEEK_API_KEY (hidden)` が出ること

### 動作確認（Secret 未設定）

```bash
curl -s -X POST "http://127.0.0.1:8788/api/secretary-deepseek-chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping","surface":"ops_secretary"}'
# → 503 · "DEEPSEEK_API_KEY not configured"
```

---

## コミット可否

**条件付き Go（Phase 1 コードコミット）** — 選別ステージング（AD-007）· **`.env` / `.dev.vars` は stage 禁止**。

| 条件 | 状態 |
| --- | --- |
| Phase 1 実装 | **完了** |
| セキュリティ · 503/502 fallback · Gateway 非変更 | **PASS** |
| ブラウザテスト 10/10 · 8/8 | **PASS** |
| `npm run build:pages` | **PASS** |
| DeepSeek API 到達 | **PASS**（502 残高不足まで） |
| HTTP 200 · 実 assistant 応答 | **未** — 残高チャージ後 |
| CF Production Secret + deploy + smoke | **未** |

**本番 deploy Go/No-Go:** **No-Go** — 残高チャージ · 200 実応答確認 · CF Secret · deploy · production smoke が必要。

**Phase 2:** OpsContextBuilder — `reports/secretary-ops-context-builder-design.md`（未実装）。
