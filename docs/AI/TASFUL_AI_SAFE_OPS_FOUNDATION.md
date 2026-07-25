# TASFUL AI — 安全運用基盤（2026年8月予定）

**Status:** **Future · 設計のみ** — 実装は正式展開前（2026-08 目標）  
**最終更新:** 2026-07-05  
**関連:** [TASFUL_AI.md](./TASFUL_AI.md) · [SECRETARY_AI.md](./SECRETARY_AI.md) · [DECISIONS.md](../DECISIONS.md) AD-005 · AD-010 · AD-011

---

## 目的

TASFUL AI の正式展開前に、**AI API コスト管理 · 不正利用防止 · 監視基盤**を実装する。  
全世界対応を前提とし、利用者増加時でも安全に運営できる構成にする。

**開発方針**

- AI は便利なため、公開直後から利用が集中する可能性がある。
- AI API はコストが直接発生するため、**通常機能より優先**して防御を実装する。
- **Cloudflare ＋ アプリ側ガード**の二重防御を基本設計とする（AD-011 海外設計と整合）。

---

## 既存資産（再利用 · 拡張）

| 項目 | 状態 | 参照 |
| --- | --- | --- |
| Voice Kill Switch + IP Rate Limit | ✅ Phase 1 | `supabase/functions/_shared/voice-realtime-edge-guard.ts` |
| JWT opt-in + user bucket 20/min | ✅ Phase 2 | `VOICE_REALTIME_REQUIRE_JWT` · `f4cf7d8` |
| 分散 Rate Limit（Redis 等） | 📋 Future | `VOICE_REALTIME_RATE_LIMIT_DISTRIBUTED` |
| Gateway 契約 | 🔒 凍結 | `ai-model-gateway.js`（AD-005） |
| 秘書 利用状況集計 | ✅ 部分 | [SECRETARY_AI.md](./SECRETARY_AI.md) |

本基盤は **Voice 限定ではなく** Chat · OCR · Vision · Media 全 API 入口に横断適用する。

---

## 優先実装（バックログ）

| ID | 項目 | 層 |
| --- | --- | --- |
| **SAFE-01** | Cloudflare WAF | Edge / CF |
| **SAFE-02** | Cloudflare Turnstile | Edge + フロント |
| **SAFE-03** | Cloudflare Rate Limiting | Edge / CF |
| **SAFE-04** | Bot 対策 | CF + アプリ |
| **SAFE-05** | AI Usage Guard（実行前チェック統合） | Edge / RPC |
| **SAFE-06** | AI 利用ログ | Supabase / Edge · **コード完了**（`ai_usage_events` · gemini/openai/claude-chat · OCR · routing metadata · **Phase 6: `openrouter` provider allowlist**）· Staging 適用は別ゲート · [phase2 report](../../reports/tasful-ai-core-phase2-safe06-report.md) · [phase6 OpenRouter](../../reports/tasful-ai-core-phase6-openrouter-poc-report.md) |
| **SAFE-07** | AI コスト集計 | Supabase · **コード完了**（query 時推定 · `ai_model_price_rates` + aggregate RPC · OpenRouter は provider 列準備済 · **公式単価未 seed**）· Staging 適用は別ゲート · [report](../../reports/tasful-ai-core-phase2-cost-ledger-safe07-report.md) |
| **SAFE-08** | Queue 化（非同期 · バースト吸収） | CF Queue / Worker |
| **SAFE-09** | 同時実行数制限 | Edge / KV |
| **SAFE-10** | ユーザー別利用制限 | RLS + Edge |
| **SAFE-11** | IP 別利用制限 | CF + Edge |
| **SAFE-12** | Feature 別利用制限（OCR · Chat 等） | Edge + plan |
| **SAFE-13** | 日次 · 月次利用上限 | Supabase entitlement |
| **SAFE-14** | 異常利用時の自動停止 | Edge Kill Switch 拡張 |
| **SAFE-15** | API コストアラート | 監視 · 秘書連携 |
| **SAFE-16** | 管理画面（AI 利用状況） | admin（秘書と分離） |
| **SAFE-17** | 運営 AI 秘書による毎朝レポート | Secretary（AD-010） |

---

## OCR · AI API — 実行前ガード（必須順序）

**AI API 実行後に制限する設計は禁止。** すべて **呼び出し前** に判定する。

```
1. 認証確認
2. Turnstile
3. Rate Limit（CF + アプリ）
4. User 制限
5. IP 制限
6. 重複送信確認
7. ファイルサイズ確認
8. 利用枠確認（plan · 日次/月次）
9. AI API 実行
```

**対象入口（例）**

| Feature | 入口 |
| --- | --- |
| AI Chat | Gateway · Workspace Edge |
| OCR | `/api/gemini-ocr` 等 |
| Vision | Gateway attachments |
| Voice Live | 既存 `voice-realtime-edge-guard` → 本ガードへ統合 |
| Media 生成 | 各 generate Edge |

---

## 運営 AI 秘書 — 毎朝レポート

**Surface:** AI 運営秘書のみ（Builder AI / TASFUL AI Workspace と統合しない · AD-002 / AD-010）

| 項目 | 内容 |
| --- | --- |
| AI 利用回数 | feature / model / surface 別 |
| API 利用料金 | プロバイダ別コスト推定 |
| 売上 · 利益 | Stripe / 課金連携（Test 期は Staging） |
| 広告費 · サーバー費用 | 手入力 or 連携 API（将来） |
| エラー件数 | Edge / Gateway ログ集計 |
| 異常アクセス | WAF · Rate Limit トリガー |
| 上位利用ユーザー | user_id 別（PII マスク） |
| モデル価格変更 | プロバイダ changelog 監視 |
| 改善提案 | 秘書 DeepSeek 要約（draft のみ） |

---

## 自動実行ポリシー

### 許可（自律実行可）

- FAQ 返信 · 定型回答
- エラー検知 · ログ整理
- コスト集計 · レポート作成

### 承認必須（人間 Go/No-Go）

- Production 変更
- SQL 適用 · migration
- Cloudflare 本番設定変更
- Stripe Live 変更
- 本番デプロイ

---

## スコープ外 · 禁止（本フェーズ）

| 項目 | 理由 |
| --- | --- |
| Gateway 契約の破壊的変更 | AD-005 |
| Builder AI への統合 | AD-002 |
| Platform / TLV 専用 AI エンジン新設 | AD-003 / AD-004 |
| Production Supabase MCP / 自動 migration | AGENTS.md · 2026-10 まで |
| service_role のフロント露出 | セキュリティ |

---

## 着手条件（2026-08）

1. TASFUL AI Production Ready 検証の残タスク整理（[tasful-ai-production-ready-verification.md](../../reports/tasful-ai-production-ready-verification.md)）
2. Staging で Usage Guard + ログの縦スライス 1 本（例: OCR または Chat 1 feature）— **SAFE-05 完了 · SAFE-06 コード完了 · Staging DB 適用はゲート待ち**
3. CF WAF / Turnstile の Staging Preview 設定手順（runbook）
4. 秘書毎朝レポートのデータソース確定（SAFE-06/07）— SAFE-06 テーブルがイベント正本 · コスト集計は SAFE-07

### SAFE-06 記録契約（要約）

| 保存する | 保存しない |
| --- | --- |
| request_id · user_id（JWT 検証時のみ）· anonymous_id · feature · provider · model · status · units · error_code · 許可 metadata | プロンプト · 回答 · OCR 原文 · 添付 · 個人情報本文 |

**書き込み:** `ingest_ai_usage_event` · service_role のみ · 公開 ingest endpoint なし  
**接続済:** gemini-chat · openai-chat · claude-chat · gemini-ocr  
**未接続:** Voice / Media / 秘書 等（Auto Mode 横展開なし）  
**routing metadata（Phase 3）:** `requested_mode` · `requested_model` · `resolved_workspace_id` · `routing_reason` · `fallback_*` · `use_case`（prompt/response 禁止）  
**Cost Ledger 境界:** `estimated_cost` 列は生イベント上 **書き換えない**（選択 A）。単価は `ai_model_price_rates` · 集計は `ai_cost_ledger_aggregate`（service_role）。顧客請求・利益倍率は対象外。Model ID 正本は `ai-model-identity.js`。  
**Auto Mode:** [phase3 report](../../reports/tasful-ai-core-phase3-auto-mode-report.md) · Workspace Chat のみ  
**Usage Gauge（Phase 4）:** 数値正本は `ai-workspace-quota` / `ai_workspace_usage_daily`（日次 JST）。Cost Ledger 単価はゲージに使わない · UI に原価を出さない · [phase4 report](../../reports/tasful-ai-core-phase4-usage-gauge-report.md)。  
**Plan Enforcement（Phase 5）:** `ai-plan-policy` が plan/quota/model/feature の正本 · claimed-only 廃止（JWT 必須）· 料金は Draft のまま未確定 · [phase5 report](../../reports/tasful-ai-core-phase5-plan-policy-report.md)。

---

## 検証（着手後）

```bash
# 回帰（既存）
node scripts/test-tasful-ai-final-phase.mjs
node scripts/test-tasful-ai-safe-ops-guard-phase1.mjs
node scripts/test-tasful-ai-safe-ops-usage-log-phase2.mjs
node scripts/test-tasful-ai-safe-ops-cost-ledger-phase2.mjs
```

**完了報告:** HTTP 200 @ `http://127.0.0.1:8788` · Console Error 0 · ガード拒否時は 4xx + ユーザー向け文言（toast 方針 AD-012）
