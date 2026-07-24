# Platform Request P5-5 — Staging DDL Apply Verification Report

**Date:** 2026-07-05  
**Phase:** P5-5（人間手動適用 **後** の検証・記録）  
**SQL 正本:** `supabase/platform-request-p5.1-ddl-rls-draft.sql`  
**Staging ref:** `ahlxuyvhzqdqaojiywmu`（**のみ**）  
**Prior:** [P5-4 適用準備](./platform-request-p5-4-staging-ddl-apply-prep.md)

---

## 0. スコープ宣言

| 実施者 | 内容 | 状態 |
| --- | --- | --- |
| **人間** | Dashboard SQL Editor で P5.1 全文を実行 | ✅ SUCCESS |
| **Cursor** | 確認 SQL 照合 · 記録 · Go/No-Go | ✅ 完了 |
| **禁止遵守** | Production 接続 · コード変更 · DDL 再実行 | ✅ |

**検証方法:** Staging `ahlxuyvhzqdqaojiywmu` に CLI link 後、**読み取り専用 SELECT** で確認（`reports/platform-request-p5-5-staging-verify-result.json`）

---

## 1. 適用実行記録（人間）

| 項目 | 記入 |
| --- | --- |
| 実行日時（JST） | 2026-07-05（ユーザー報告） |
| 実行者 | 人間（Dashboard SQL Editor） |
| Dashboard Reference ID | `ahlxuyvhzqdqaojiywmu` ✅ |
| P5.1 SQL 実行結果 | **SUCCESS** — `Success. No rows returned` |
| エラーメッセージ | なし |

---

## 2. 期待値マトリクス

| 検証項目 | 期待値 | 実測 | 判定 |
| --- | --- | --- | --- |
| テーブル数 | 5 | **5** | ✅ |
| RLS 有効 | 5/5 | **5/5** | ✅ |
| RLS ポリシー数 | 10 | **10** | ✅ |
| インデックス（`pg_indexes`） | ≥17（名前付き12 + PK/UNIQUE） | **20** | ✅ |
| `updated_at` トリガー | 3 | **3** | ✅ |
| ヘルパー関数 | 1 | **1** | ✅ |
| `builder_projects` 存在 | 1 | **1** | ✅ |
| `builder_partners` 存在 | 1 | **1** | ✅ |

> `talk_notifications` は Staging に**元々未作成**（`exists_flag=0`）· P5.1 DDL による削除ではない。

---

## 3. 検証結果詳細

### 3.1 テーブル（5/5 ✅）

| table_name |
| --- |
| `platform_request_matches` |
| `platform_request_notifications` |
| `platform_request_payments` |
| `platform_request_subscriptions` |
| `platform_requests` |

### 3.2 RLS 有効化（5/5 ✅）

| relname | relrowsecurity |
| --- | --- |
| `platform_request_matches` | true |
| `platform_request_notifications` | true |
| `platform_request_payments` | true |
| `platform_request_subscriptions` | true |
| `platform_requests` | true |

### 3.3 ポリシー（10/10 ✅）

| tablename | policyname | cmd | roles |
| --- | --- | --- | --- |
| `platform_request_matches` | `platform_request_matches_select_candidate` | SELECT | authenticated |
| `platform_request_matches` | `platform_request_matches_select_owner` | SELECT | authenticated |
| `platform_request_notifications` | `platform_request_notifications_select_recipient` | SELECT | authenticated |
| `platform_request_payments` | `platform_request_payments_select_payer` | SELECT | authenticated |
| `platform_request_payments` | `platform_request_payments_select_request_owner` | SELECT | authenticated |
| `platform_request_subscriptions` | `platform_request_subscriptions_select_self` | SELECT | authenticated |
| `platform_requests` | `platform_requests_insert_owner` | INSERT | authenticated |
| `platform_requests` | `platform_requests_select_open` | SELECT | authenticated |
| `platform_requests` | `platform_requests_select_owner` | SELECT | authenticated |
| `platform_requests` | `platform_requests_update_owner` | UPDATE | authenticated |

### 3.4 インデックス（20 件 ✅）

**名前付き DDL インデックス（12/12）:**

| indexname | tablename |
| --- | --- |
| `platform_requests_owner_id_idx` | `platform_requests` |
| `platform_requests_status_created_idx` | `platform_requests` |
| `platform_requests_category_idx` | `platform_requests` |
| `platform_request_matches_request_id_idx` | `platform_request_matches` |
| `platform_request_matches_candidate_idx` | `platform_request_matches` |
| `platform_request_matches_status_idx` | `platform_request_matches` |
| `platform_request_notifications_recipient_idx` | `platform_request_notifications` |
| `platform_request_notifications_request_idx` | `platform_request_notifications` |
| `platform_request_payments_checkout_session_uidx` | `platform_request_payments` |
| `platform_request_payments_payer_idx` | `platform_request_payments` |
| `platform_request_payments_match_idx` | `platform_request_payments` |
| `platform_request_subscriptions_user_id_idx` | `platform_request_subscriptions` |

**追加（PK / UNIQUE 制約由来 · 期待どおり）:**

| indexname | tablename |
| --- | --- |
| `platform_requests_pkey` | `platform_requests` |
| `platform_requests_legacy_local_id_key` | `platform_requests` |
| `platform_request_matches_pkey` | `platform_request_matches` |
| `platform_request_matches_request_candidate_uniq` | `platform_request_matches` |
| `platform_request_notifications_pkey` | `platform_request_notifications` |
| `platform_request_payments_pkey` | `platform_request_payments` |
| `platform_request_subscriptions_pkey` | `platform_request_subscriptions` |
| `platform_request_subscriptions_user_role_uniq` | `platform_request_subscriptions` |

### 3.5 トリガー（3/3 ✅）

| tgname | table_name |
| --- | --- |
| `platform_requests_set_updated_at` | `platform_requests` |
| `platform_request_matches_set_updated_at` | `platform_request_matches` |
| `platform_request_subscriptions_set_updated_at` | `platform_request_subscriptions` |

### 3.6 サマリ（§3.8 相当）

| kind | cnt |
| --- | --- |
| tables | 5 |
| policies | 10 |
| rls_enabled | 5 |
| triggers | 3 |
| function | 1 |

### 3.7 既存テーブル無破壊

| table_name | exists_flag | 判定 |
| --- | --- | --- |
| `builder_projects` | 1 | ✅ 存続 |
| `builder_partners` | 1 | ✅ 存続 |
| `talk_notifications` | 0 | ℹ️ Staging 未作成（P5.1 非起因） |

---

## 4. 検証チェックリスト（V1–V12）

| # | 検証項目 | 期待 | 実測 | 判定 |
| --- | --- | --- | --- | --- |
| V1 | 適用 ref = `ahlxuyvhzqdqaojiywmu` | ✅ | ✅ 人間報告 + CLI link 確認 | ✅ |
| V2 | Production ref 非接触 | ✅ | ✅ `ddojquacsyqesrjhcvmn` 未使用 | ✅ |
| V3 | P5.1 SQL 実行 | SUCCESS | SUCCESS | ✅ |
| V4 | テーブル数 | 5 | 5 | ✅ |
| V5 | RLS 全有効 | 5/5 | 5/5 | ✅ |
| V6 | ポリシー数 | 10 | 10 | ✅ |
| V7 | 名前付きインデックス | 12 | 12 | ✅ |
| V8 | `updated_at` トリガー | 3 | 3 | ✅ |
| V9 | ヘルパー関数 | 1 | 1 | ✅ |
| V10 | `builder_projects` 存在 | 1 | 1 | ✅ |
| V11 | `builder_partners` 存在 | 1 | 1 | ✅ |
| V12 | `talk_notifications` | — | 0（Staging 既存状態） | ℹ️ 非ブロッカー |

**総合: 11/11 必須項目 PASS · V12 は Staging 既存ギャップ（P5.1 無関係）**

---

## 5. 証跡

| ファイル | 内容 |
| --- | --- |
| [platform-request-p5-5-staging-verify-result.json](./platform-request-p5-5-staging-verify-result.json) | 読み取り専用確認 SQL の生出力 |
| 人間報告 | P5.1 SQL `Success. No rows returned` @ `ahlxuyvhzqdqaojiywmu` |

**再検証コマンド（任意）:**

```bash
npx supabase link --project-ref ahlxuyvhzqdqaojiywmu --yes
node scripts/verify-platform-request-p5-5-staging.mjs
```

---

## 6. Rollback 参照（緊急時 · Staging のみ）

[P5-4 §6.2](./platform-request-p5-4-staging-ddl-apply-prep.md#62-rollback-sql緊急時--staging-sql-editor) — 本検証では **不要**

---

## 7. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| DDL 再実行（Cursor） | なし ✅ |
| Production 接続 | なし ✅ |
| JS / HTML / CSS（製品 UI） | 変更なし ✅ |
| Cloudflare / Stripe / Talk | 未着手 ✅ |

---

## 8. Go / No-Go 判定

### 8.1 Staging DDL 適用検証

| 項目 | 判定 |
| --- | --- |
| 5 テーブル作成 | **Go** ✅ |
| RLS 全有効（5/5） | **Go** ✅ |
| 10 ポリシー | **Go** ✅ |
| インデックス · トリガー · 関数 | **Go** ✅ |
| Builder 既存テーブル無破壊 | **Go** ✅ |

### **判定 A: Go — Staging DDL 適用・検証 PASS**

P5.1 SQL は Staging `ahlxuyvhzqdqaojiywmu` に正常適用済み。構造検証すべて期待値と一致。

---

### 8.2 Staging 次フェーズ

| 条件 | 判定 |
| --- | --- |
| P5-6 Adapter `supabase` mode 着手 | **Go** |
| Builder マッチ E2E（`builder_partner` candidate RLS） | **Conditional No-Go** — P5.2a 修正案が必要（S1） |

---

### 8.3 Production

### **判定 B: No-Go — Production 適用禁止（継続）**

| 項目 | 理由 |
| --- | --- |
| Production ref `ddojquacsyqesrjhcvmn` | 2026年10月リリース窓まで禁止 |
| `supabase/migrations/` 未登録 | 意図的（Staging 手動適用のみ） |

---

## 9. 次アクション

| 優先 | タスク | Phase |
| --- | --- | --- |
| 1 | Adapter `supabase` mode 実装（CRUD） | **P5-6** |
| 2 | `scripts/test-platform-request-p5-staging.mjs` 追加 | P5-6 |
| 3 | P5.2a `candidate_owner_id` / builder_partner RLS 修正案 | P5-6 並行 |
| 4 | localStorage 移行（`legacy_local_id`） | P5-7+ |

---

## 10. 参照

| ドキュメント | 用途 |
| --- | --- |
| [platform-request-p5.1-ddl-rls-draft.sql](../supabase/platform-request-p5.1-ddl-rls-draft.sql) | 適用 SQL |
| [platform-request-p5-4-staging-ddl-apply-prep.md](./platform-request-p5-4-staging-ddl-apply-prep.md) | 適用前準備 |
| [platform-request-p5.2-staging-review.md](./platform-request-p5.2-staging-review.md) | S1 既知ギャップ |
| [docs/supabase-environments.md](../docs/supabase-environments.md) | ref 正本 |

---

*Completed: Platform Request P5-5 · Staging DDL verified · Go*
