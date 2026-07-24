# Platform Request P5-7c — Edge Secrets 同期確認

**Date:** 2026-07-05  
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（**のみ**）  
**判定:** **Go** — P5-8 通知着手可（Edge match-sync ローカル動作確認済み）

---

## 1. 問題と解決

| 項目 | 内容 |
| --- | --- |
| **症状** | `/api/platform-request-match-sync` が **503** `supabase_not_configured` |
| **原因 1** | `SUPABASE_SERVICE_ROLE_KEY` が `.env.staging` にのみあり `.dev.vars` へ未同期 |
| **原因 2** | `npm run dev` が repo root `.env`（Production URL）を `--env-file` に使用し Staging vars と競合 |
| **解決** | `.env.staging` 優先同期 + `dev-pages.mjs` が `dist/.dev.vars` のみを `--env-file` に使用 |

---

## 2. 確認した env / vars

| ファイル | 役割 | service_role | URL ref |
| --- | --- | --- | --- |
| `.env` | ZEGO · DeepSeek 等 | なし | Production（ビルド用） |
| `.env.staging` | **Staging Supabase 正本** | ✅ | Staging |
| `deploy/cloudflare/dist/.dev.vars` | **Pages Functions binding** | ✅ | Staging |
| `chat-supabase-config.js` | フロント anon のみ | なし | Staging |

**同期スクリプト:** `scripts/lib/sync-pages-dev-vars.mjs`  
- Supabase 系 5 キーは **`.env.staging` 優先**  
- `validateStagingSupabaseVars()` で Production ref / Production service_role JWT を拒否

---

## 3. service_role key の配置先

| 配置先 | 許可 |
| --- | --- |
| `.env.staging`（gitignore） | ✅ 開発者ローカル |
| `deploy/cloudflare/dist/.dev.vars`（gitignore） | ✅ Wrangler Pages dev |
| Cloudflare Preview secrets（将来） | ✅ P5-8 前運用タスク |
| `chat-supabase-config.js` / dist JS | **禁止** |
| ブラウザ / anon key | **禁止** |

**Edge 内利用:** `deploy/cloudflare/functions/api/platform-request-match-sync.js` のみ（`context.env.SUPABASE_SERVICE_ROLE_KEY`）

---

## 4. 漏洩チェック

| 対象 | 結果 |
| --- | --- |
| `chat-supabase-config.js` | PASS — anon のみ · Staging ref |
| `platform-request-*-supabase-store.js` | PASS — service_role 文字列なし |
| `tasu-supabase-client.js` | PASS |
| `dist/` 上記ファイル | PASS |

---

## 5. `/api/platform-request-match-sync`

| 項目 | 結果 |
| --- | --- |
| HTTP Status | **200** |
| 認証 | Staging owner JWT（`talk-rls-a@tasful-dev.test`） |
| INSERT | `builder_partner` · `candidate_user_id` 解決済み |
| 重複 | `skipped: duplicate` |
| service_role | Edge 内のみ（フロント非露出） |

---

## 6. 回帰

| スクリプト | 結果 |
| --- | --- |
| P5-6 `platform_requests` CRUD | **PASS** |
| P5-7 matches CRUD | **PASS** |
| P5-7b Builder Candidate E2E | **PASS**（Edge HTTP 200） |
| Console Error | **0** |

**検証コマンド:** `node scripts/verify-platform-request-p5-7c-edge-secrets.mjs`

---

## 7. 変更ファイル（P5-7c）

| ファイル | 変更 |
| --- | --- |
| `scripts/lib/sync-pages-dev-vars.mjs` | Staging 優先同期 · 検証 |
| `scripts/dev-pages.mjs` | `--env-file` → `dist/.dev.vars` |
| `scripts/ensure-pages-dist.mjs` | Supabase presence ログ |
| `scripts/lib/platform-request-staging-config.mjs` | **新規** — テスト用 Staging config |
| `scripts/verify-platform-request-p5-7c-edge-secrets.mjs` | **新規** |
| `scripts/test-platform-request-p5-7-*.mjs` | Staging config ヘルパー利用 |
| `deploy/cloudflare/functions/api/platform-request-match-sync.js` | 503 hint 改善 |
| `deploy/cloudflare/.dev.vars.example` | コメント更新 |

---

## 8. Go / No-Go

| 環境 | 判定 |
| --- | --- |
| **Staging P5-7c** | **Go** |
| **P5-8 通知** | **着手可**（ローカル Edge match-sync 動作確認済み） |
| **Production** | **No-Go** 継続 |

---

## 9. ローカル dev 手順

```bash
# .env.staging に Staging SUPABASE_* + SUPABASE_SERVICE_ROLE_KEY を設定
npm run dev   # ensure-pages-dist → dist/.dev.vars 同期 → wrangler @ 8788
node scripts/verify-platform-request-p5-7c-edge-secrets.mjs
```

`[ensure-pages-dist] ... SUPABASE_SERVICE_ROLE_KEY=true, staging_ok=true` を確認。
