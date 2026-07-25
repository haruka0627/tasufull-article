# TASFUL AI Core — 8月実装計画（正本）

**作成:** 2026-07-05  
**スコープ:** SAFE 運用基盤の完成（既存 Gateway 上に追加）  
**環境:** **Staging のみ** · Production / Stripe Live / CF Production **禁止**  
**前提調査:** [reports/tasful-ai-core-current-state-audit.md](../reports/tasful-ai-core-current-state-audit.md)

---

## 目的

Builder · Platform · Talk · Business Directory · TLV が共通利用する **TASFUL AI Core** を、新機能追加なしで **SAFE 運用層**として完成させる。

```
各サービス（Builder / Platform / Talk / BD / TLV）
        ↓
   AI Gateway（既存 · AD-005）
        ↓
   SAFE Layer（今回追加）
        ↓
   Provider Edge / CF Functions
```

**禁止:** Gateway 全面リファクタ · 新 AI フレームワーク · 各製品新機能 · Production 操作

---

## 既存資産（再利用必須）

| 資産 | 正本 |
| --- | --- |
| Gateway | `ai-model-gateway.js` |
| Quota | `supabase/functions/_shared/ai-workspace-quota.ts` |
| Workspace 利用 | `ai-workspace-usage.js` · `ai-workspace-chat.js` |
| Subscription | `gen_ai_subscriptions` · `stripe-*-genai-*` Edge |
| カタログ | `shared/pricing/generated/tasful-pricing-config.js` |
| Voice guard | `voice-realtime-edge-guard.ts` |
| 秘書 | `admin-ai-secretary-deepseek-adapter.js`（Gateway 外） |

---

## フェーズ一覧

| Phase | ID | 内容 | 状態 |
| --- | --- | --- | --- |
| **1** | SAFE-05 | Usage Guard（Chat + OCR） | **完了** |
| **2** | SAFE-06 | Usage Log（`ai_usage_events` + ingest） | **完了（コード）** · Staging DB 適用は別ゲート · [phase2 report](../reports/tasful-ai-core-phase2-safe06-report.md) |
| **3** | — | Auto Mode 完成（Auto/Manual · Identity · Usage routing） | **完了（コード）** · [phase3 report](../reports/tasful-ai-core-phase3-auto-mode-report.md) |
| **4** | — | 利用ゲージ | 未着手 |
| **5** | — | manual SQL → migrations（Staging） | 未着手（`ai_usage_events` migration は追加済 · 適用は Staging 手動） |
| **6** | SAFE-07 | Cost Ledger | **完了（コード）** · Staging 適用は別ゲート · [cost ledger report](../reports/tasful-ai-core-phase2-cost-ledger-safe07-report.md) |
| **7** | SAFE-05 拡張 | 秘書 · Vision · TTS 等 | 未着手 |
| **8** | SAFE-01〜03 | WAF · Turnstile · Rate Limit runbook | 未着手 |
| **9** | SAFE-08 | Queue | 未着手 |
| **10** | SAFE-16 | AI Admin Console | 未着手 |

各 Phase 完了レポート: `reports/tasful-ai-core-phase{N}-*.md`

---

## Phase 1 — SAFE-05 Usage Guard（Chat + OCR）

**ゴール:** 統一 `ai-usage-guard` 経由で Chat 3 Edge + CF OCR を制御。

| 項目 | 方針 |
| --- | --- |
| Chat | 既存 quota を `ai-usage-guard.ts` でラップ（挙動維持） |
| OCR | `ocr_turn` → quota 上は `vision_turn` バケット（DB 変更なし） |
| CF OCR | Staging Supabase RPC 呼び出し · Production ref 拒否 |
| クライアント | `chat-ocr.js` が `user_id` + `surface` を POST |

**完了条件**

- [x] `ai-usage-guard.ts` 新設
- [x] gemini/openai/claude-chat が guard 経由
- [x] `gemini-ocr.js` が guard 経由
- [x] `scripts/test-tasful-ai-safe-ops-guard-phase1.mjs` PASS
- [x] `test-tasful-ai-final-phase.mjs` 隔離 PASS（HTML 2件は既知）
- [x] 8788 `/ai-workspace.html` HTTP 200

---

## Phase 2 — SAFE-06 Usage Log（`ai_usage_events`）

**ゴール:** 誰が・いつ・どの機能・Provider/モデル・units・success/error/denied を一貫形式で記録する（Cost Ledger / ゲージ / 管理画面の土台）。

| 項目 | 方針 |
| --- | --- |
| テーブル | `public.ai_usage_events` · `request_id` UNIQUE 冪等 |
| 書き込み | `ingest_ai_usage_event` RPC · **service_role のみ** · RLS deny-all |
| 公開 API | **作らない**（browser → service_role 直接禁止） |
| 接続（本 Phase） | `gemini-chat` · `/api/gemini-ocr` のみ（初期） |
| 接続（Phase 3 拡張） | `openai-chat` · `claude-chat`（Workspace Chat · routing metadata） |
| 未接続 | Voice · Media · 秘書 · BD · Search |
| 原価 | `estimated_cost` は **null**（SAFE-07 Cost Ledger で集計） |
| 保存しない | プロンプト · 回答本文 · OCR 原文 · 添付 · 個人情報本文 |
| Production | **適用しない** · deploy / push しない |

**完了条件（コード）**

- [x] migration `20260726120000_ai_usage_events.sql`
- [x] `_shared/ai-usage-log.ts` · CF `ai-usage-log.mjs`
- [x] gemini-chat / gemini-ocr 接続（denied · success · error · 二重記録防止）
- [x] `scripts/test-tasful-ai-safe-ops-usage-log-phase2.mjs`
- [ ] Staging DB への migration 適用（環境 paused / ゲート待ち · コード完了とは分離）

**Rollback:** migration を Staging で `drop function ingest_ai_usage_event(...); drop table ai_usage_events;`（適用後のみ）。Edge は usage log 呼び出しを削除して戻す。

**SAFE-07 境界:** 本テーブルは raw event / units。日次コスト集計・プロバイダ単価は **SAFE-07（下記 Phase）** で query 時算出 · `estimated_cost` 列は書き換えない（選択 A）。

---

## Phase — SAFE-07 Minimum Cost Ledger（8月計画 Phase 6 · ユーザー Phase 2）

**ゴール:** `ai_usage_events` の units から **推定 API 原価**を Provider/model/feature/user · 日次/月次で集計（顧客請求・Stripe ではない）。

| 項目 | 方針 |
| --- | --- |
| 価格表 | `ai_model_price_rates` · effective_from/to · overlap 禁止 · service_role のみ |
| 算出 | **選択 A** — query 時に価格表 join · 生イベント非破壊 · 再計算可 |
| 課金対象 | **success のみ** · error/denied は `not_billable` |
| 未知 model | `unknown_rate` · **0 円確定しない** |
| 集計 RPC | `ai_cost_ledger_aggregate` · service_role のみ |
| fixture | gemini-2.5-flash provisional（公式単価ではない） |
| Production | **適用しない** |

**完了条件（コード）**

- [x] migration `20260726200000_ai_cost_ledger_safe07.sql`
- [x] `scripts/lib/ai-cost-ledger.mjs`（計算鏡）
- [x] `scripts/test-tasful-ai-safe-ops-cost-ledger-phase2.mjs`
- [ ] Staging DB 適用（paused / ゲート待ち）

**Rollback:** Staging 適用後のみ `drop function ai_cost_ledger_aggregate(...); drop function ai_estimate_event_cost(...); drop view ai_usage_cost_enriched; drop table ai_model_price_rates;`

---

## Phase 3 — Auto Mode 完成（ユーザー Phase 3）

**ゴール:** モデルを選ばなくても用途に応じて自動ルーティング · Auto/Manual 明確分離 · 実行モデルを SAFE-06/07 で追跡。

| 項目 | 方針 |
| --- | --- |
| Identity | `ai-model-identity.js` が UI / Workspace / Gateway / Provider / Cost Ledger ID の正本 |
| Auto | intent + モードプリセット（決定的）· 高度分類器 / 新 Router API なし |
| Manual | チップ選択を尊重 · 無言で Auto に戻さない · 不可時のみ明示 1 回 FB |
| Fallback | 最大 1 回 · metadata 記録 · silent failure 禁止 |
| Usage Log | `requested_mode` 等を allowlist 拡張 · gemini/openai/claude-chat |
| Cost Ledger | 価格変更なし · `providerModelId` で lookup 整合 |
| 非対象 | OpenRouter · ゲージ · Billing · OCR/Voice/Media/秘書/Builder 横展開 |

**完了条件（コード）**

- [x] Auto/Manual 分離 · `resolveTurnDecision`
- [x] Gateway allowlist 再検証 · Provider 障害時 1 回 FB
- [x] Usage Log routing metadata · 3 Chat Edge
- [x] `scripts/test-tasful-ai-auto-mode-phase3.mjs`
- [x] [phase3 report](../reports/tasful-ai-core-phase3-auto-mode-report.md)

**後続フック（未実装）:** 安価/高性能優先の高度最適化 · 残量低下時切替 · OpenRouter · プラン別 allowlist 強化（構造のみ用意）

---

## Phase 4〜10（概要）

| Phase | 主要成果物 | 状態 |
| --- | --- | --- |
| 3 | Auto Mode（上記） | **コード完了** |
| 4 | 利用ゲージ | 未着手 |
| 5 | `gen_ai_*` / `ai_workspace_usage_daily` migrations 昇格 | 未着手 |
| 6 | Cost Ledger（SAFE-07） | **コード完了**（上記） |
| 7 | 秘書 CF · gemini-image-character · gemini-tts Guard 拡張 | 未着手 |
| 8 | `docs/runbooks/cf-waf-turnstile-staging.md` | 未着手 |
| 9 | CF Queue + async worker 設計 | 未着手（後回し可） |
| 10 | Admin 画面（Usage/Cost/Events） | 未着手 |

> **historical:** 旧「Phase 3 = Router→Gateway 配線のみ」は Phase 3 Auto Mode に吸収。配線単体の記述は本節を正本とする。

**Future（後回し）:** Queue · Redis · BYOK · 従量パック · OpenRouter 全面 · 高度分析 · PDF/PPT · 履歴 Supabase 同期 · 操作アシスタント · Site Assistant Phase 2+

---

## 検証コマンド（共通）

```bash
npm run build:pages
npm run dev
node scripts/test-tasful-ai-final-phase.mjs
node scripts/test-tasful-ai-safe-ops-guard-phase1.mjs   # Phase 1 SAFE-05
node scripts/test-tasful-ai-safe-ops-usage-log-phase2.mjs  # Phase 2 SAFE-06
node scripts/test-tasful-ai-safe-ops-cost-ledger-phase2.mjs  # SAFE-07 Cost Ledger
node scripts/test-tasful-ai-auto-mode-phase3.mjs  # Phase 3 Auto Mode
```

---

*本計画は `docs/TODO.md` / `docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md` と同期する。*
