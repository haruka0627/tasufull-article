# Platform Request P5.1 — Supabase DDL/RLS Draft Report

**Date:** 2026-07-05  
**Phase:** P5.1（Staging 用 SQL 草案 · **未適用**）  
**Prior:** P4.7 `reports/platform-request-p5-integration-blueprint.md`

---

## 1. 目的

Platform Request の Supabase 化に向け、**Staging 専用**の DDL + RLS 草案をリポジトリに追加する。  
**今回はファイル作成とドキュメント更新のみ** — Supabase への適用・Production 接触・コード変更は行わない。

---

## 2. 作成ファイル

| File | 種別 | 状態 |
| --- | --- | --- |
| `supabase/platform-request-p5.1-ddl-rls-draft.sql` | DDL + RLS 草案 | ✅ 新規 · **未適用** |
| `reports/platform-request-p5.1-ddl-rls-draft.md` | 本報告書 | ✅ 新規 |
| `docs/platform-request-p5-integration.md` | SSOT 追記 | ✅ 最小更新 |

**変更なし:** JS / HTML / CSS · Edge Functions · Stripe · Talk · Cloudflare · `supabase/migrations/`（自動適用経路に入れない）

---

## 3. SQL の責務

### 3.1 テーブル一覧

| テーブル | 責務 | 主キー | 主要 FK |
| --- | --- | --- | --- |
| `platform_requests` | 依頼投稿の正本 | `id` uuid | — |
| `platform_request_matches` | 依頼×候補のマッチ行 | `id` uuid | `request_id` → `platform_requests` |
| `platform_request_notifications` | 通知 fan-out キュー | `id` uuid | `request_id` · `match_id`（nullable） |
| `platform_request_payments` | ¥550 都度課金台帳 | `id` uuid | `request_id` · `match_id` |
| `platform_request_subscriptions` | 月額 entitlement（P6 先行定義） | `id` uuid | — |

### 3.2 `platform_requests`

| カラム | 責務 |
| --- | --- |
| `legacy_local_id` | LS 移行キー（`prq-*`）· UNIQUE nullable |
| `owner_id` | 投稿者 `auth.users.id` |
| `title` / `body` / `category` / `area` | P2 localStorage 互換 |
| `urgency` | `通常` / `急ぎ` / `至急` |
| `budget` | 任意 |
| `photos` | jsonb 配列 |
| `status` | `open` / `closed` / `cancelled`（P2 互換） |

**更新タイミング:** INSERT=投稿 · UPDATE=オーナーのステータス変更

### 3.3 `platform_request_matches`

| カラム | 責務 |
| --- | --- |
| `candidate_id` + `candidate_type` | **疎結合** — 将来 `builder_partners` / `builder_workers` / listings 等 |
| `match_score` / `match_reasons` | クライアント `matchCandidates` 相当 |
| `status` | `candidate` → `notified` → `responded` → `payment_pending` → `talk_started` |

**UNIQUE:** `(request_id, candidate_id, candidate_type)` — 重複マッチ防止

### 3.4 `platform_request_notifications`

| カラム | 責務 |
| --- | --- |
| `recipient_id` | 通知受信者 |
| `channel` | P5 は `in_app` のみ想定 |
| `status` | `pending` / `sent` / `failed` / `skipped` |

**書き込み:** service_role（fan-out Edge）のみ想定 · クライアント INSERT ポリシーなし

### 3.5 `platform_request_payments`

| カラム | 責務 |
| --- | --- |
| `amount_jpy` | 既定 550 |
| `purpose` | 既定 `platform_request_match_contact` |
| `stripe_*` | Checkout / PaymentIntent 参照 |
| `status` | `pending` / `paid` / `cancelled` / `refunded` |

**UNIQUE:** `stripe_checkout_session_id`（where not null）— Webhook 冪等

### 3.6 `platform_request_subscriptions`

| カラム | 責務 |
| --- | --- |
| `role` | `poster` / `receiver` |
| `plan_sku` | catalog SKU 参照 |
| `stripe_subscription_id` | P6 接続用 |

**UNIQUE:** `(user_id, role)`

### 3.7 補助オブジェクト

| オブジェクト | 責務 |
| --- | --- |
| `platform_request_set_updated_at()` | `platform_request_*` テーブルの `updated_at` 自動更新 |
| インデックス | owner · status · candidate · recipient · checkout session |

---

## 4. RLS 方針

| テーブル | authenticated | service_role |
| --- | --- | --- |
| `platform_requests` | owner SELECT/INSERT/UPDATE · 全員 SELECT where `status=open` | 全操作（RLS バイパス） |
| `platform_request_matches` | request owner SELECT · candidate SELECT（`candidate_id=auth.uid()` かつ type ∈ user/worker/freelancer） | 全操作 |
| `platform_request_notifications` | `recipient_id=auth.uid()` SELECT のみ | INSERT/UPDATE/SEND |
| `platform_request_payments` | payer SELECT · request owner SELECT | INSERT/UPDATE（Webhook） |
| `platform_request_subscriptions` | `user_id=auth.uid()` SELECT のみ | INSERT/UPDATE（P6） |

### 4.1 意図的にクライアント INSERT しないテーブル

- `platform_request_matches` — マッチジョブ / Edge
- `platform_request_notifications` — fan-out worker
- `platform_request_payments` — Stripe Checkout + Webhook
- `platform_request_subscriptions` — Stripe Subscription Webhook（P6）

### 4.2 P5.2 レビュー論点（company / builder_partner）

`candidate_type` が `company` / `builder_partner` / `listing` のとき、`candidate_id` は auth.uid() と一致しない。  
P5.2 で以下いずれかを決定:

1. `candidate_owner_id uuid` カラム追加
2. 解決 VIEW + SECURITY DEFINER RPC
3. 当該 type の SELECT は service_role 経由 API のみ

---

## 5. 未適用であること

| 項目 | 状態 |
| --- | --- |
| Staging `ahlxuyvhzqdqaojiywmu` への SQL 実行 | **未実施** |
| Production `ddojquacsyqesrjhcvmn` | **未接触** |
| `supabase/migrations/` への登録 | **なし**（草案は `supabase/platform-request-p5.1-ddl-rls-draft.sql` のみ） |
| MCP / CLI apply | **なし** |

SQL ファイル先頭に `DRAFT ONLY / NOT APPLIED` · `PRODUCTION 適用禁止` を明記済み。

---

## 6. Staging 適用前レビュー項目（P5.2）

| # | 項目 | 担当 |
| --- | --- | --- |
| R1 | `owner_id` / `candidate_id` が `auth.uid()` uuid 型と整合 | database-agent |
| R2 | RLS: 他人の `closed` 依頼が見えないこと | security-agent |
| R3 | RLS: open 依頼が認証ユーザーに見えること | qa-agent |
| R4 | `legacy_local_id` UPSERT 衝突テスト設計 | tasful-ai-agent / P5 adapter |
| R5 | `platform_request_payments` RESTRICT delete — 依頼削除時の挙動 | database-agent |
| R6 | company 型 candidate の閲覧経路（§4.2） | architecture-agent |
| R7 | 既存 `builder_*` / `talk_notifications` テーブル無変更 | review-agent |
| R8 | Production ref ガード（手動 apply runbook） | devops-infra-agent |

### 適用時チェックリスト（草案）

```text
[ ] 対象 ref = ahlxuyvhzqdqaojiywmu（Staging）を目視確認
[ ] Production ref ではないことを二重確認
[ ] SQL Editor で platform-request-p5.1-ddl-rls-draft.sql を実行
[ ] information_schema.tables で 5 テーブル存在確認
[ ] pg_policies でポリシー件数確認
[ ] テストユーザー A/B で RLS 手動 SELECT
[ ] ロールバック手順（DROP TABLE cascade）を runbook に記載
```

---

## 7. Blueprint との差分

| Blueprint（P4.7） | P5.1 草案 |
| --- | --- |
| `user_id` | `owner_id`（ユーザー指定スキーマに合わせた） |
| `receiver_user_id` | `candidate_id` + `candidate_type`（疎結合） |
| `public_id` | `legacy_local_id` のみ（URL は `id` uuid または adapter で生成） |
| `idempotency_key` on notifications | P5.2 で追加検討（現草案は未含） |

---

## 8. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| Supabase 適用 | なし ✅ |
| Production SQL | なし ✅ |
| JS / HTML / CSS | 変更なし ✅ |
| localStorage | 変更なし ✅ |
| Builder / Talk / Pricing 既存テーブル | 非接触 ✅ |
| Edge / Stripe / Cloudflare | なし ✅ |

---

## 9. Go / No-Go 判定

| 項目 | 結果 |
| --- | --- |
| 5 テーブル DDL 草案 | ✅ |
| RLS 草案（authenticated + service_role 方針） | ✅ |
| Draft / Production 禁止コメント | ✅ |
| `supabase/migrations/` 未登録（自動適用回避） | ✅ |
| P5.2 レビュー可能なレポート | ✅ |
| DB 未適用 · コード変更ゼロ | ✅ |

### **判定: Go（P5.2 Staging レビュー・適用判断へ進行可）**

**No-Go（P5.2 適用時まで継続）:**

- Production Supabase / 10月以前の本番 migration → **No-Go**
- 草案を `supabase db push` / CI migration で自動適用 → **No-Go**（人間承認 + 手動 Staging のみ）
- company 型 candidate RLS 未解決のまま本番接続 → **No-Go**（P5.2 で R6 解決必須）

---

## 10. 参照

| ドキュメント | 用途 |
| --- | --- |
| [platform-request-p5-integration-blueprint.md](./platform-request-p5-integration-blueprint.md) | P5 全体設計 |
| [docs/platform-request-p5-integration.md](../docs/platform-request-p5-integration.md) | SSOT |
| [docs/supabase-environments.md](../docs/supabase-environments.md) | Staging / Production ref |

---

*Generated: Platform Request P5.1 · SQL draft only · not applied*
