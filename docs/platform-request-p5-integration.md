# Platform Request — P5 接続 SSOT（設計のみ）

**Status:** **P5-10 Stripe Test Go** · **P5-11 商用監査完了** · **P5-12a Dual Default Go** · P5-12b 未着手  
**最終更新:** 2026-07-05  
**詳細 Blueprint:** [reports/platform-request-p5-integration-blueprint.md](../reports/platform-request-p5-integration-blueprint.md)  
**DDL/RLS 草案:** [supabase/platform-request-p5.1-ddl-rls-draft.sql](../supabase/platform-request-p5.1-ddl-rls-draft.sql) · [P5.1 報告書](../reports/platform-request-p5.1-ddl-rls-draft.md)  
**Staging レビュー:** [reports/platform-request-p5.2-staging-review.md](../reports/platform-request-p5.2-staging-review.md)  
**Candidate RLS 修正:** [reports/platform-request-p5.2a-candidate-rls-fix.md](../reports/platform-request-p5.2a-candidate-rls-fix.md) · [SQL 草案](../supabase/platform-request-p5.2a-candidate-rls-fix-draft.sql)  
**適用準備:** [reports/platform-request-p5-4-staging-ddl-apply-prep.md](../reports/platform-request-p5-4-staging-ddl-apply-prep.md)  
**適用検証:** [reports/platform-request-p5-5-staging-ddl-apply.md](../reports/platform-request-p5-5-staging-ddl-apply.md)  
**Supabase CRUD:** [reports/platform-request-p5-6-supabase-crud.md](../reports/platform-request-p5-6-supabase-crud.md)  
**P0 仕様:** [platform-request.md](./platform-request.md)

---

## 実装状態（P4.6 時点）

| 層 | 状態 |
| --- | --- |
| UI / 導線 | ✅ P4.6 完了（Talk Home 入口） |
| データ | Staging `platform_requests` + `platform_request_matches` CRUD 接続済み |
| ストア | `?prq_store=local|supabase|dual` · 候補は **Supabase matches 優先**、無ければ P3 local |
| マッチ | Edge match-sync + RLS SELECT · P3 `matchCandidates()` フォールバック |
| 通知 | `platform_request_notifications` · Edge fan-out · in_app UI（P5-8） |
| Talk | `platform-request-talk-bridge.js` · Edge create-talk · `transaction_rooms`（P5-9） |
| 決済 / 開示 | `platform-request-payment-bridge.js` · Stripe Test ¥550 · contact reveal（P5-10） |

---

## P5 で接続する順序

1. ~~Staging DDL + RLS 草案~~ → **P5.1 完了**
2. ~~Staging レビュー~~ → **P5.2 完了（Conditional Go — 手動適用可）**
3. ~~`TasuPlatformRequestStore` adapter（local）~~ → **P5-3 完了** · supabase/dual は stub
4. ~~Staging DDL 適用準備~~ → **P5-4 完了**
5. ~~Staging DDL 手動適用 + 検証~~ → **P5-5 Go**
6. ~~Adapter `supabase` mode（`platform_requests` CRUD）~~ → **P5-6 Go**
7. ~~Candidate RLS 修正案（S1）~~ → **P5.2a 設計 Go** · **P5.2a-Apply Staging 適用 Go**
8. ~~サーバー側マッチ + `platform_request_matches`~~ → **P5-7 Go**
9. ~~in_app 通知（`platform_request_notifications`）~~ → **P5-8 Go**
10. ~~Talk スレッド作成 + deep link~~ → **P5-9 Go**
11. ~~Stripe Test Checkout ¥550（`platform_request_match_contact`）~~ → **P5-10 Go**
12. ~~localStorage 移行（`legacy_local_id`）~~ → **P5-12a Go**（dual デフォルト · 任意同期 UI）
13. 商用硬化（Webhook · Talk 決済ゲート · Talk Home 通知）→ **P5-12b / P5-13**

---

## テーブル（名前のみ · SQL 禁止）

| テーブル | 責務 |
| --- | --- |
| `platform_requests` | 依頼正本 |
| `platform_request_matches` | マッチ・反応・Talk 状態 |
| `platform_request_notifications` | fan-out キュー |
| `platform_request_payments` | 550円 idempotent 台帳 |
| `platform_request_subscriptions` | 月額 entitlement（P6 寄り） |

**P5.1 草案:** Staging `ahlxuyvhzqdqaojiywmu` に **適用済み**（2026-07-05 · migrations 未登録）

**P5-6 CRUD:** [reports/platform-request-p5-6-supabase-crud.md](../reports/platform-request-p5-6-supabase-crud.md) — `platform_requests` Staging CRUD **Go**

**P5-7 Matches:** [reports/platform-request-p5-7-matches-crud.md](../reports/platform-request-p5-7-matches-crud.md) — `platform_request_matches` Staging CRUD **Go**

**P5-7b Builder Candidate E2E:** [reports/platform-request-p5-7-builder-candidate-e2e.md](../reports/platform-request-p5-7-builder-candidate-e2e.md) — Staging **Go**

**P5-7c Edge Secrets:** [reports/platform-request-p5-7c-edge-secrets.md](../reports/platform-request-p5-7c-edge-secrets.md) — `/api/platform-request-match-sync` ローカル **Go**

**P5-8 Notifications:** [reports/platform-request-p5-8-notifications.md](../reports/platform-request-p5-8-notifications.md) — `platform_request_notifications` Staging **Go**

**P5-9 Talk:** [reports/platform-request-p5-9-talk-integration.md](../reports/platform-request-p5-9-talk-integration.md) — Platform Request → Talk Staging **Go**

**P5-10 Stripe / Contact Reveal:** [reports/platform-request-p5-10-stripe-contact-reveal.md](../reports/platform-request-p5-10-stripe-contact-reveal.md) — ¥550 Staging Test **Go**

**P5-11 Commercial Audit:** [reports/platform-request-p5-11-commercial-audit.md](../reports/platform-request-p5-11-commercial-audit.md) — 商用運用監査 **Conditional Go / Production No-Go**

**P5-12a Dual Default / Migration:** [reports/platform-request-p5-12a-dual-default-and-migration.md](../reports/platform-request-p5-12a-dual-default-and-migration.md) — ログイン時 dual デフォルト · 任意 local→Supabase 同期 **Go**

**P5.2a 修正案:** `candidate_user_id` — Staging **適用済み**（2026-07-05）· [設計](../reports/platform-request-p5.2a-candidate-rls-fix.md) · [SQL](../supabase/platform-request-p5.2a-candidate-rls-fix-draft.sql)

**Store 切替:** ログイン時デフォルト `dual` · 明示 `?prq_store=local|supabase|dual` · 未ログインは `local`

---

## 凍結

| 対象 | 期限 |
| --- | --- |
| Production Supabase migration | 2026年10月まで **禁止** |
| Cloudflare Production 有効化 | 同上 |
| Stripe Live | 同上 |
| 作業環境 | Staging `ahlxuyvhzqdqaojiywmu` · Preview · `http://127.0.0.1:8788` |

---

## 検証（P5 着手後）

```bash
node scripts/test-platform-request-p2.mjs   # local 回帰 必須
node scripts/test-platform-request-p3.mjs
node scripts/test-platform-request-p4.mjs
node scripts/test-platform-request-p5-3-store-adapter.mjs
node scripts/verify-platform-request-p5-5-staging.mjs   # Staging DDL 構造確認（read-only）
node scripts/test-platform-request-p5-6-supabase-crud.mjs   # platform_requests CRUD
node scripts/verify-platform-request-p5-2a-staging.mjs   # P5.2a amendment 構造確認
node scripts/test-platform-request-p5-7-matches-crud.mjs   # platform_request_matches CRUD
node scripts/test-platform-request-p5-7-builder-candidate-e2e.mjs   # Builder Candidate E2E
node scripts/verify-platform-request-p5-7c-edge-secrets.mjs   # Edge secrets + match-sync HTTP 200
node scripts/test-platform-request-p5-8-notifications.mjs   # P5-8 notifications foundation
node scripts/test-platform-request-p5-9-talk-bridge.mjs   # P5-9 Talk bridge
node scripts/test-platform-request-p5-10-stripe-contact-reveal.mjs   # P5-10 Stripe + reveal
```

---

*P4.7 — Markdown only. 実装は [Blueprint](../reports/platform-request-p5-integration-blueprint.md) に従う。*
