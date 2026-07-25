# TASFUL AI Core — Phase 2 完了レポート（SAFE-07 Minimum Cost Ledger）

**日付:** 2026-07-26  
**スコープ:** 推定 API 原価の価格表 · query 時算出 · 集計 RPC（顧客請求なし）  
**環境:** コードのみ · **Staging DB 未適用** · Production / deploy / push **なし**  
**前提:** SAFE-06 `d49c9c6` · live insert はリリース時確認として保留  

> ユーザー実装順の「Phase 2: Cost Ledger」= 8月計画 **Phase 6 / SAFE-07**。

---

## 概要

```
ai_usage_events (raw · SAFE-06 · 非破壊)
        ×
ai_model_price_rates (effective period · provisional 可)
        ↓ query 時
ai_estimate_event_cost / ai_usage_cost_enriched
        ↓
ai_cost_ledger_aggregate (day/month/provider/model/feature/user)
```

**選択 A（採用）:** イベント記録時は raw units のみ。集計時に価格表と結合して推定原価を算出。  
**理由:** 価格改定・再計算・監査に耐える · SAFE-06 生データを破壊しない · Provider 請求額と推定原価を分離。

**選択 B を採らなかった理由:** イベント時に `estimated_cost` を確定すると、単価変更時に履歴が陳腐化し、再計算・監査が困難。

---

## 変更ファイル

| パス |
| --- |
| `supabase/migrations/20260726200000_ai_cost_ledger_safe07.sql` |
| `scripts/lib/ai-cost-ledger.mjs` |
| `scripts/test-tasful-ai-safe-ops-cost-ledger-phase2.mjs` |
| `docs/tasful-ai-core-august-2026-plan.md` |
| `docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md` |
| `docs/AI/TASFUL_AI.md` |
| `reports/tasful-ai-core-phase2-cost-ledger-safe07-report.md` |

gemini-chat / OCR の実行パスは **変更なし**（データソースは既存 SAFE-06 イベント）。

---

## 価格設定

| 項目 | 内容 |
| --- | --- |
| 保存 | `public.ai_model_price_rates` |
| 識別 | `provider` + `model` + `unit_type` |
| 単価 | `unit_price` / `per_units`（input · output · image · request） |
| 通貨 | `currency`（fixture は USD） |
| 期間 | `effective_from` · `effective_to` · overlap trigger 拒否 · unique start |
| OpenRouter | provider allowlist に `openrouter` を先行追加 |
| fixture | gemini-2.5-flash · **provisional=true**（公式単価ではない） |

---

## 原価計算

| 項目 | 内容 |
| --- | --- |
| 方式 | **query 時算出（A）** |
| success | billable · rate があれば `estimated` |
| error / denied | `not_billable` · 推定原価 null |
| unknown model | `unknown_rate` · **null（0 円にしない）** |
| 精度 | `numeric` / round 8 桁 |
| 顧客請求 | **対象外**（note で invoice / billing と区別） |

---

## 集計

`ai_cost_ledger_aggregate(p_from, p_to, p_group_by, p_currency, p_tz)`  
`group_by`: `day` · `month` · `provider` · `model` · `feature` · `user`  
**execute:** service_role のみ（anon/authenticated revoke）

---

## Security / Privacy

- 価格表 · 集計 RPC · enriched view: RLS deny-all / service_role のみ
- プロンプト・回答・OCR 本文を追加保存しない
- クライアントへ単価を埋め込まない
- Edge への価格ハードコードなし

---

## Rollback

Staging 適用後のみ:

```sql
drop function if exists public.ai_cost_ledger_aggregate(timestamptz, timestamptz, text, text, text);
drop function if exists public.ai_estimate_event_cost(text, text, text, numeric, numeric, timestamptz, text);
drop view if exists public.ai_usage_cost_enriched;
drop trigger if exists trg_ai_model_price_rates_no_overlap on public.ai_model_price_rates;
drop function if exists public.ai_model_price_rates_assert_no_overlap();
drop table if exists public.ai_model_price_rates;
```

---

## 残課題（本 Phase）

- Staging migration 適用と live aggregate 検証
- 公式単価への provisional 解除（原価確定後）
- units が char であることと token 請求の対応表（後続）
