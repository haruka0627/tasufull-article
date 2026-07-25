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
| **4** | — | 利用ゲージ | **完了（コード）** · [phase4 report](../reports/tasful-ai-core-phase4-usage-gauge-report.md) |
| **5** | — | プラン制御 | **完了（コード）** · [phase5 report](../reports/tasful-ai-core-phase5-plan-policy-report.md) |
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

## Phase 4 — 利用ゲージ（ユーザー Phase 4）

**ゴール:** 日次利用枠に対する消費率・残量目安・次回更新・状態ラベルを Workspace で把握できるようにする（原価・単価非公開）。

| 項目 | 方針 |
| --- | --- |
| 数値正本 | `ai_workspace_usage_daily` + Edge `ai-workspace-quota`（SAFE-05 と同一） |
| 計算 | `ai-usage-gauge`（Browser / Node / Edge 同契約）· 閾値は一箇所 |
| 期間 | **日次 Asia/Tokyo**（「今月」デモは廃止 · 偽の月次精密値を出さない） |
| API | 既存 quota `status`/`check` に `usage` オブジェクトを付与 |
| UI | チャット直下の簡易メーター + 設定›請求の詳細 |
| Auto/Manual | 同一ゲージ · Manual 高負荷チップ時のみ一般注意文 |
| Cost Ledger | **境界厳守** · 単価・推定原価を返さない · ゲージに使わない |
| anonymous | サーバー取得せず端末目安（`authoritative:false`）· 認証枠と混同しない |
| 新 migration | **なし**（既存 daily テーブルを利用） |

**表示する:** periodUsed/Limit · remaining · ratio · displayPercent · resetAt · status · canExecute · 一般注意文  
**表示しない:** Provider 原価 · 単価 · 利益率 · 内部重み · 他ユーザー · prompt/response · service_role

**完了条件（コード）**

- [x] `scripts/lib/ai-usage-gauge.mjs` · `ai-workspace-usage-gauge.js` · Edge `ai-usage-gauge.ts`
- [x] quota 応答に `usage` · JWT mismatch 拒否 · SQL 非露出
- [x] 簡易 / 詳細 UI · Billing デモ4本棒をライブ日次へ寄せ替え
- [x] `scripts/test-tasful-ai-usage-gauge-phase4.mjs` · `verify-ai-usage-gauge-phase4.mjs`
- [x] [phase4 report](../reports/tasful-ai-core-phase4-usage-gauge-report.md)

**Staging 未検証:** live quota 応答 · JWT 本番経路（paused 保留）

---

## Phase 5 — プラン制御（ユーザー Phase 5）

**ゴール:** plan / quota / model / feature を Plan Policy SSOT で統一し、UI とサーバー enforcement を一致させる（料金・Stripe は未確定のまま）。

| 項目 | 方針 |
| --- | --- |
| 正本 | `scripts/lib/ai-plan-policy.mjs` · `ai-plan-policy.js` · Edge `ai-plan-policy.ts` |
| Canonical ID | `anonymous` · `free` · `lite` · `pro` · `max`(inactive) |
| Alias | `basic_300`/`light`→lite · `pro_980`/`standard`→pro 等 |
| Quota | Policy.dailyTextLimit → Gauge / Guard 同一 |
| Models | allowedWorkspaceModels · Auto/Manual/Gateway/Edge 再検証 |
| Features | workspace_chat · gemini/openai/claude_chat · ocr（接続） |
| 未接続 | voice · image · media · search 専用制限 |
| claimed-only | **廃止**（quota/chat は JWT 必須 · `auth_required`） |
| 料金 | **非掲載** · Draft · 販売導線なし |

**完了条件（コード）**

- [x] Plan Policy SSOT
- [x] Guard/Quota JWT + model/feature deny
- [x] Auto/Manual plan 内ルーティング · Manual プラン外は明示拒否
- [x] Workspace bypass / URL plan override 権限無効化
- [x] `scripts/test-tasful-ai-plan-policy-phase5.mjs` · Playwright
- [x] [phase5 report](../reports/tasful-ai-core-phase5-plan-policy-report.md)

**Staging 未検証:** live JWT · live quota · subscription status

---

## Phase 6 — OpenRouter Limited Evaluation（ユーザー Phase 6）

**ゴール:** OpenRouter を本番機能として導入せず、既存 direct Provider と比較可能な **限定 PoC** を作り、採用判断材料を揃える。

| 項目 | 内容 |
| --- | --- |
| 対象モデル（最大 2） | `google/gemini-2.5-flash` · `openai/gpt-4o-mini`（workspace `or-gemini-flash` / `or-gpt`） |
| Edge | `supabase/functions/openrouter-chat` |
| Gate | `OPENROUTER_POC_ENABLED` + `OPENROUTER_POC_HARNESS_TOKEN` + JWT · allowlist 任意 |
| Plan | 全 production plan で `openrouter_chat` **不可** |
| Gateway | Workspace `ai-model-gateway.js` **非接続**（AD-005 維持） |
| UI | `/ai-workspace` · Billing · Manual/Auto **非表示** |
| Usage Log | `provider=openrouter` · slug · `route_type` / `upstream_provider` |
| Cost Ledger | provider 分離 · 公式単価 **未 seed** · test-only provisional fixture のみ |
| Fallback | Production route 無効 · PoC でも無言 Manual fallback なし |
| 採用判断 | **限定用途のみ候補**（全面移行はしない） |

**完了条件（コード）**

- [x] Identity / Edge / Guard / Usage Log / Cost Ledger 整合
- [x] migration（apply は Staging 再開後）
- [x] mock unit + static verify
- [x] [phase6 report](../reports/tasful-ai-core-phase6-openrouter-poc-report.md)

**Staging 未検証:** live OpenRouter secret · live JWT · migration apply

---

## Phase 5〜10（概要）

| Phase | 主要成果物 | 状態 |
| --- | --- | --- |
| 4 | 利用ゲージ | **コード完了** |
| 5 | プラン制御（上記） | **コード完了** |
| 5b | `gen_ai_*` migrations 昇格 | 未着手 |
| 6 | OpenRouter 限定検証（上記） / Cost Ledger（SAFE-07） | **コード完了**（OpenRouter PoC · Cost Ledger） |
| 7 | Guard 対象拡張 · 秘書 CF | 未着手 |
| 8 | WAF / Turnstile runbook | 未着手 |
| 9 | Queue | 未着手 |
| 10 | Admin | 未着手 |

> **historical:** 旧「Phase 4 = Billing UI→Stripe」は後続プラン制御 / Billing Adapter へ。本 Phase 4 は利用ゲージのみ。

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
node scripts/test-tasful-ai-usage-gauge-phase4.mjs  # Phase 4 Usage Gauge
node scripts/verify-ai-usage-gauge-phase4.mjs
node scripts/test-tasful-ai-plan-policy-phase5.mjs  # Phase 5 Plan Policy
node scripts/verify-ai-plan-policy-phase5.mjs
node scripts/test-tasful-ai-openrouter-poc-phase6.mjs  # Phase 6 OpenRouter PoC
node scripts/verify-ai-openrouter-poc-phase6.mjs
```

---

*本計画は `docs/TODO.md` / `docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md` と同期する。*
