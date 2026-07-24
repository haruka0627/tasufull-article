# Platform Request P5-7 — `platform_request_matches` CRUD

**Date:** 2026-07-05  
**Phase:** P5-7 Staging matches CRUD  
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（**のみ**）  
**Prior:** [P5.2a Apply](./platform-request-p5.2a-candidate-rls-fix.md) · [P5-6 CRUD](./platform-request-p5-6-supabase-crud.md)

---

## 1. 実装概要

| 層 | 内容 |
| --- | --- |
| **Matches Store** | `platform-request-matches-supabase-store.js` — SELECT（owner/candidate RLS）· Edge 経由 CREATE |
| **Edge Function** | `deploy/cloudflare/functions/api/platform-request-match-sync.js` — JWT 検証 · owner 確認 · `candidate_user_id` 解決 · service_role INSERT |
| **Adapter** | `platform-request.js` — `listMatchesForRequestAsync` / `listMatchesForCandidateAsync` / `syncMatchesForRequestAsync` |
| **UI** | 依頼詳細: Supabase matches **優先**、なければ P3 ローカル候補 · 一覧: 候補者向け「あなた宛のマッチ」最小パネル |
| **検証** | `scripts/test-platform-request-p5-7-matches-crud.mjs` |

**RLS 方針（変更なし）:** クライアント直 INSERT ポリシーは追加しない。INSERT は Edge + service_role のみ。

---

## 2. 変更ファイル一覧

| ファイル | 変更 |
| --- | --- |
| `platform-request-matches-supabase-store.js` | **新規** — matches read · Edge create |
| `deploy/cloudflare/functions/api/platform-request-match-sync.js` | **新規** — match job API |
| `platform-request.js` | Adapter + 候補 UI（DB 優先） |
| `platform-request.css` | 候補者向け incoming matches スタイル |
| `platform-request.html` | script + incoming panel |
| `platform-request-detail.html` | script + `data-prq-candidates-sub` |
| `platform-request-create.html` | script |
| `scripts/lib/sync-pages-dev-vars.mjs` | Supabase keys を Pages Functions に同期 |
| `deploy/cloudflare/.dev.vars.example` | match sync 用コメント |
| `scripts/test-platform-request-p5-7-matches-crud.mjs` | **新規** |
| `docs/platform-request-p5-integration.md` | P5-7 状態更新 |
| `reports/platform-request-p5-7-matches-crud.md` | 本レポート |

---

## 3. `candidate_user_id` 解決方法

| `candidate_type` | `candidate_id` | `candidate_user_id` |
| --- | --- | --- |
| `user` / `freelancer` | `auth.users.id` 想定 UUID | 同一（Edge / クライアント解決可） |
| `worker` | `builder_workers.id` | `builder_workers.owner_auth_uid`（service_role 参照） |
| `builder_partner` | `builder_partners.id` | `builder_partners.owner_auth_uid`（service_role 参照） |
| `company` / `listing` | — | **INSERT スキップ**（`unresolved_candidate_user_id`） |

Builder DDL は変更なし。

---

## 4. INSERT / SELECT 挙動

### INSERT

- **経路:** `POST /api/platform-request-match-sync`（Bearer JWT · 依頼 owner のみ）
- **サーバー:** service_role で `platform_request_matches` に INSERT
- **重複:** DB UNIQUE `(request_id, candidate_id, candidate_type)` + Edge が `duplicate` を skipped 記録
- **テスト:** Node から service_role 直接 INSERT（match job 相当 · フロント非露出）

### SELECT

| ロール | RLS | 確認 |
| --- | --- | --- |
| **owner** | `platform_request_matches_select_owner` | 自依頼の matches ✅ |
| **candidate** | `candidate_user_id = auth.uid()` | 自分宛 matches ✅ |
| **unrelated authenticated** | 両ポリシー不適合 | 0 件 ✅ |
| **anon** | authenticated のみ | 0 件 ✅ |

---

## 5. RLS 検証結果

| チェック | 結果 |
| --- | --- |
| Production ref 検知即失敗 | PASS |
| P5-5 DDL verify | PASS |
| P5.2a amendment verify | PASS |
| owner SELECT | PASS |
| candidate SELECT | PASS |
| unrelated user deny | PASS |
| anon deny | PASS |
| duplicate prevention | PASS |

---

## 6. P5-6 回帰

`node scripts/test-platform-request-p5-6-supabase-crud.mjs` — **PASS**（P5-7 テスト内で実行）

---

## 7. UI 検証（8788）

| 項目 | 結果 |
| --- | --- |
| HTTP Status | 200（detail / list） |
| Console Error | **0** |
| 詳細: Supabase matches 表示 | PASS（DB 行あり時） |
| 一覧: あなた宛マッチ | PASS（candidate_user_id 一致時） |
| local / supabase / dual | 既存 P5-6 挙動維持 |

**Viewport:** 1280 / 768 / 390 — Playwright スクリプトは dom 検証中心（手動 QA 推奨）

---

## 8. Go / No-Go

| 環境 | 判定 |
| --- | --- |
| **Staging P5-7** | **Go** — matches CRUD + RLS + P5-6 回帰 |
| **Production** | **No-Go** 継続（2026-10 まで） |
| **Builder candidate E2E** | P5-7 後に再判定 |

---

## 9. P5-7c Edge Secrets（2026-07-05）

| 項目 | 状態 |
| --- | --- |
| `dist/.dev.vars` Staging 同期 | ✅ `.env.staging` 優先 |
| `/api/platform-request-match-sync` | ✅ **HTTP 200** @ 8788 |
| service_role 漏洩 | ✅ なし（Edge のみ） |
| 詳細 | [platform-request-p5-7c-edge-secrets.md](./platform-request-p5-7c-edge-secrets.md) |

## 10. P5-8 着手条件

1. P5-7c Edge secrets **Go**（本レポート）
2. `platform_request_notifications` fan-out 設計（変更なし）
3. Cloudflare Preview に Staging `SUPABASE_SERVICE_ROLE_KEY` 設定（本番相当）
4. Talk / Stripe は P5-8+ で個別着手

---

## 10. ローカル開発メモ

```bash
npm run build:pages
npm run dev
# .env に Staging SUPABASE_SERVICE_ROLE_KEY（Edge match sync 用）
node scripts/test-platform-request-p5-7-matches-crud.mjs
```

`?prq_store=supabase` + ログインで matches SELECT。P3 ローカル候補は **Supabase 行が無いときのみ** 表示。
