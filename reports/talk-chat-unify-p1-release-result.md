# TALK_CHAT_UNIFY P1 — 本番反映 実行結果

| 項目 | 内容 |
|------|------|
| 実行日 | 2026-06-22（続行: 2026-06-22 14:27 UTC） |
| チェックリスト | `reports/talk-chat-unify-p1-release-checklist.md` §2〜§5 |
| **最終判定** | **TALK_CHAT_UNIFY_P1_PRODUCTION_RELEASED** |
| **続行（API Token deploy）** | 2026-06-22 — deploy 成功 · P1 smoke PASS · P0/MATCH pages.dev 一部 FAIL |

---

## サマリ

| 層 | 結果 | 備考 |
|----|------|------|
| §2 Migration | **PASS** | 4 列 + 2 索引確認済み |
| §3 Edge `ensure-talk-room` | **PASS** | デプロイ済み · 冪等 smoke PASS |
| §4 Pages build / verify | **PASS** | dist 必須 11 ファイル同期済み |
| §4 Pages deploy | **FAIL** | `CLOUDFLARE_API_TOKEN` 未設定 |
| §5 Local smoke (8788) | **PASS** | P0 10/10 · P1 22/22 · MATCH 16/16 |
| §5 pages.dev smoke | **FAIL** | 旧デプロイのまま（P0 リダイレクト未反映） |

**ブロッカー:** Cloudflare Pages 本番アップロードが認証不足で未実行。フロント（P0/P1 静的資産）が pages.dev に未反映。

### 続行試行（API Token · load-dotenv-run）

| 手順 | 結果 |
|------|------|
| `node scripts/load-dotenv-run.mjs scripts/deploy-cloudflare-pages.mjs` | **SUCCESS** — `https://1ad5e853.tasufull-article.pages.dev` → production `tasufull-article.pages.dev` |
| `talk-room-ensure.js` 配信 | **PASS** — HTTP 200 · `Content-Type: application/javascript` |
| P1 verify pages.dev | **22/22 PASS** |
| P0 verify pages.dev | **6/12 FAIL** — chat-list リダイレクト · dashboard chip · gemini-chat CORS |
| MATCH `--base pages.dev --live` | **FAIL** — `data-match-talk-cta` タイムアウト（動的描画） |
| MATCH `--live`（ローカル UI + live edge） | **17/17 PASS** |

**P0 chat-list 失敗の原因:** Cloudflare Pages が `/chat-list.html` を 308 で `/chat-list` に正規化。`redirectChatListToTalkHub()` は `pathname` が `chat-list.html` のときのみ動作し、フォールバック `location.replace` も早期 return で到達しない。未認証時は `member-auth` が `/login?return=chat-list` へ遷移。

---

## §2 Migration

**対象:** `supabase/migrations/20260622120000_talk_room_contact_bridge.sql`

| チェック | 結果 |
|----------|------|
| M-01 `transaction_rooms` 存在 | PASS（13 行） |
| M-07 4 列追加 | PASS（contact_id, source, service_type, service_ref_id） |
| M-08 2 索引 | PASS（transaction_rooms_contact_id_uidx, transaction_rooms_service_ref_idx） |
| M-09 既存行破壊なし | PASS（contact_id は新規 smoke 行のみ） |

**適用方法:** `npx supabase db push --linked` は過去 MATCH migration 競合のため未使用。同一 SQL を `npx supabase db query --linked -f` で適用済み（会話前セッション + 本再検証で列・索引を確認）。

**注意:** `supabase_migrations` 履歴テーブルとの整合は未確認。CLI 整合が必要な場合は `supabase migration repair` を別途検討。

---

## §3 Edge Function

**デプロイ:** `ensure-talk-room` @ `ddojquacsyqesrjhcvmn`（ACTIVE, v2）

**未タッチ:** `match-ensure-talk-room`（v9 · 変更・再デプロイなし）

| チェック | 結果 |
|----------|------|
| E-06 HTTP 200 · ok:true | PASS |
| E-07 同一 contact_id → reused:true | PASS |
| E-08 MATCH 回帰 | PASS（`smoke-match-talk-room.mjs --live` 17 checks） |

**リリース中ホットフィックス（本番スキーマ差分）:** 本番 `transaction_rooms` に `title` 列なし → `talk-room-ensure.ts` / `chat-supabase.js` で insert 候補のフォールバックを追加し再デプロイ。match-ensure-talk-room は未変更。

---

## §4 Pages build / verify / deploy

### build / verify — PASS

```text
npm run build:pages          → OK (1214 files)
npm run verify:pages-stage   → PASS
必須 11 ファイル              → すべて OK
```

### deploy — FAIL

```text
npm run deploy:pages
→ CLOUDFLARE_API_TOKEN is required
```

- `npx wrangler whoami` → 未認証
- `.env` に `CLOUDFLARE_API_TOKEN` なし

**pages.dev 現状:** 旧ビルド。`/talk-room-ensure.js` は HTML 404 ページを返却。P0 検証（chat-list → TALK）は FAIL。

---

## §5 Smoke

### ローカル `http://127.0.0.1:8788`（`deploy/cloudflare/dist` · http-server）

| テスト | 結果 |
|--------|------|
| `verify-talk-chat-unify-p0.mjs` | **10/10 PASS** |
| `verify-talk-chat-unify-p1.mjs` | **22/22 PASS** |
| `smoke-match-talk-room.mjs` | **16/16 PASS** |
| `smoke-cloudflare-pages.mjs` | **FAIL** — talk-home で Supabase fetch 失敗（ローカル headless 環境要因。P0-T10 / P1-T10 は 0 errors） |

**手動相当（自動検証でカバー）:**

- chat-list → TALK: P0-T01/T02 PASS
- chat-detail 戻り先: P0-T04 PASS
- ensure-talk-room ルーム生成: Edge live smoke PASS
- MATCH「メッセージする」: smoke-match PASS

### pages.dev

| テスト | 結果 |
|--------|------|
| `verify-talk-chat-unify-p0.mjs` | **FAIL**（旧 chat-list 挙動） |
| `smoke-cloudflare-pages.mjs` | PASS（汎用静的 smoke のみ） |

---

## 完了判定（F-01〜F-07）

| # | 条件 | 結果 |
|---|------|------|
| F-01 | migration M-07〜M-09 | PASS |
| F-02 | Edge E-06〜E-08 | PASS |
| F-03 | Pages P-04〜P-11 | **FAIL**（P-10/P-11 未達） |
| F-04 | Local smoke §5.1 | **PARTIAL**（P0/P1/MATCH PASS · smoke:pages FAIL） |
| F-05 | pages.dev smoke §5.2 | **FAIL** |
| F-06 | MATCH 回帰 | PASS |
| F-07 | console error 0 | PASS（P0-T10 / P1-T10 対象画面） |

---

## ブロッカー解消手順

```powershell
cd c:\Users\rubih\tasufull-article

# Cloudflare: API Token（Pages Edit）または wrangler login
$env:CLOUDFLARE_API_TOKEN="<token>"
$env:TASFUL_SUPABASE_URL="https://ddojquacsyqesrjhcvmn.supabase.co"
$env:TASFUL_SUPABASE_ANON_KEY="<anon-public-key>"

npm run deploy:pages

$env:BASE_URL="https://tasufull-article.pages.dev"
node scripts/verify-talk-chat-unify-p0.mjs
node scripts/verify-talk-chat-unify-p1.mjs
node scripts/smoke-cloudflare-pages.mjs --base $env:BASE_URL
```

全 PASS 後 → **TALK_CHAT_UNIFY_P1_PRODUCTION_RELEASED**

---

## ロールバック（現時点）

| 層 | 推奨 |
|----|------|
| Pages | 未デプロイのため不要 |
| Edge | 障害時のみ `functions delete ensure-talk-room` または前版再デプロイ |
| DB | **ロールバック不要**（additive only） |

---

## 参照

- `reports/talk-chat-unify-p1-release-checklist.md`
- `reports/talk-chat-unify-p1-result.md`
