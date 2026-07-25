# TASFUL AI Core — Phase 2 完了レポート（SAFE-06 Usage Log）

**日付:** 2026-07-26  
**スコープ:** `ai_usage_events` + server-side ingest · gemini-chat / gemini-ocr 最小接続  
**環境:** コードのみ · **Staging DB 未適用** · Production / deploy / push **なし**  
**計画正本:** [docs/tasful-ai-core-august-2026-plan.md](../docs/tasful-ai-core-august-2026-plan.md)  
**設計正本:** [docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md](../docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md)

> ユーザー実装順の「Phase 1: SAFE-06」= 本リポジトリ 8月計画の **Phase 2（SAFE-06）**。

---

## 概要

AI 利用イベントを **誰が / いつ / どの機能 / Provider·モデル / units / success|error|denied** で記録する基盤を追加した。公開 ingest API は作らず、Edge 内から `service_role` RPC のみで書き込む。

```
gemini-chat / gemini-ocr
        ↓（サーバー側 · 1 request_id = 1 row）
ingest_ai_usage_event (service_role)
        ↓
ai_usage_events
```

---

## 変更ファイル

| 種別 | パス |
| --- | --- |
| Migration | `supabase/migrations/20260726120000_ai_usage_events.sql` |
| Ingest（Supabase） | `supabase/functions/_shared/ai-usage-log.ts` |
| Ingest（CF） | `deploy/cloudflare/functions/_shared/ai-usage-log.mjs` |
| Chat | `supabase/functions/gemini-chat/index.ts` |
| OCR | `deploy/cloudflare/functions/api/gemini-ocr.js` |
| テスト | `scripts/test-tasful-ai-safe-ops-usage-log-phase2.mjs` |
| 計画 | `docs/tasful-ai-core-august-2026-plan.md` |
| SAFE 設計 | `docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md` |

---

## DB 設計

| 項目 | 内容 |
| --- | --- |
| テーブル | `public.ai_usage_events` |
| 冪等 | `request_id` UNIQUE · `ON CONFLICT DO NOTHING` |
| Index | created_at · user_id+created · feature · status · provider |
| RLS | enable · deny-all policy |
| 書き込み | `ingest_ai_usage_event` · **service_role のみ**（anon/authenticated revoke） |
| Production | **適用しない**（本レポート時点） |

### 保存する情報

- `request_id`, `user_id`（JWT 検証できた場合のみ）, `anonymous_id`
- `feature`, `provider`, `model`, `status`（success / error / denied）
- `input_units` / `output_units` / `total_units`（文字数等の raw · 本文は保存しない）
- `estimated_cost`（本 Phase は **null**）
- `error_code`, 許可 metadata（`surface` · `intent` · `http_status` · `source` · `quota_feature`）
- `created_at`

### 保存しない情報

- プロンプト · ユーザーメッセージ · 回答本文 · OCR 原文
- 添付 · base64 · history · system_prompt · search_context
- Provider 価格表のハードコード

---

## 接続した AI 経路

| 経路 | Guard 拒否 | Provider 成功 | Provider 失敗 |
| --- | --- | --- | --- |
| `gemini-chat` | ✅ | ✅ | ✅ |
| `/api/gemini-ocr` | ✅ | ✅ | ✅ |

**未接続:** openai-chat · claude-chat · Voice · Media generate · 秘書 DeepSeek · BD AI · Web Search

**二重記録防止:** `createUsageLogOnce()`（リクエスト内）+ DB `request_id` UNIQUE

**ログ失敗:** ingest 失敗は握りつぶし · AI 本処理は再実行しない · 内部エラー詳細はクライアント非露出

---

## SAFE-07 Cost Ledger との境界

| SAFE-06（本 Phase） | SAFE-07（次） |
| --- | --- |
| raw event · units | 日次 / プロバイダ別コスト集計 |
| `estimated_cost` = null 可 | 単価適用 · ledger 行 |
| イベント正本 | 集計正本 |

---

## Rollback

1. （Staging 適用後のみ）`drop function public.ingest_ai_usage_event(...);` → `drop table public.ai_usage_events;`
2. Edge: usage log import / `usageOnce.record` 呼び出しを削除
3. テスト・docs の Phase 2 記述を戻す（historical report は残してよい）

---

## テスト

```bash
node scripts/test-tasful-ai-safe-ops-usage-log-phase2.mjs
node scripts/test-tasful-ai-safe-ops-guard-phase1.mjs
node scripts/test-tasful-ai-final-phase.mjs
```

Staging DB への insert 実機検証は **未実施**（適用ゲート待ち）。

---

## 残課題（本 Phase 内）

- Staging への migration 適用（paused / 手動ゲート）
- openai/claude 等への横展開は **対象外**（後続 Phase / Guard 拡張）
