# TASFUL AI Core — Phase 3 完了レポート（Auto Mode）

**日付:** 2026-07-26  
**スコープ:** Workspace 通常チャットの Auto / Manual 分離 · 決定的ルーティング · Usage Log routing metadata · Cost Ledger 識別子整合  
**環境:** コード · UI · unit/static test · **Staging DB 未適用** · Production / deploy / push **なし**  
**前提:** SAFE-06 `d49c9c6` · SAFE-07 `cad00e8` · Staging paused 条件はリリース前確認として保留  

> ユーザー実装順の「Phase 3: Autoモード完成」。8月計画の旧 Phase 3（Router→Gateway 配線）を拡張して完成させた。

---

## 判定

**CONDITIONAL PASS** — Staging live Provider / DB は未検証。静的・単体・回帰は PASS。

---

## 監査結果（実装前）

| 区分 | 内容 |
| --- | --- |
| 完成済み | 設定 UI の Auto カード · Manual チップ · `resolveModelId` / `resolveGatewayModelId` · Chat→Gateway 配線 |
| 不足 | Auto/Manual 意味の曖昧さ · Identity 分散 · Usage Log に routing なし · openai/claude 未ログ · Provider 障害時の無限/無言切替リスク |
| 今回変更 | Identity 単一表 · `resolveTurnDecision` · Gateway 1回フォールバック · Usage metadata · 3 Chat Edge ログ · UI バッジ |

---

## Auto / Manual

| モード | 挙動 |
| --- | --- |
| **Auto** | 用途（intent）+ モードプリセット（auto/speed/quality/cost）で workspace モデルを決定。チップは参考表示。 |
| **Manual** | `TasuAiPlanModels` チップ選択を尊重。intent で無言上書きしない。不可時のみ明示 1 回フォールバック（plan 既定）。 |

保存: `localStorage` key `tasu_ai_model_router_settings` · 不正値は sanitize で Auto / `auto` へ復旧。query 注入なし。サーバ allowlist 再検証あり。

---

## Model ID 対応（`ai-model-identity.js` 正本）

| UI 表示 | Workspace ID | Gateway ID | Provider model | Cost Ledger model |
| --- | --- | --- | --- | --- |
| 最速 | `gemini-flash` | `gemini-flash` | `gemini-2.5-flash` | `gemini-2.5-flash` |
| 標準 | `gpt` | `gpt` | `gpt-4o-mini` | `gpt-4o-mini` |
| 高精度 | `claude` | `claude` | `claude-haiku-4-5` | `claude-haiku-4-5` |

カタログ別名（`claude-sonnet` · `gpt-5` 等）は Identity 経由で上記へ正規化。

---

## Fallback

- 最大 **1 回**（ルーティング側 or Provider 429/5xx 側のどちらか）
- `fallback_used` / `fallback_from` / `fallback_reason` を metadata 記録
- silent failure 禁止 · secret 非露出 · 存在しない model へ送信しない

---

## Usage Log metadata（allowlist 拡張）

`requested_mode` · `requested_model` · `resolved_workspace_id` · `routing_reason` · `fallback_used` · `fallback_from` · `fallback_reason` · `use_case`  

主要列 `provider` / `model` = **実際に実行した** Provider model。Guard 拒否は成功扱いで実行モデルを書かない。

**接続:** gemini-chat · openai-chat · claude-chat（Workspace Chat）· OCR は既存のまま（Auto 横展開なし）

---

## Cost Ledger 境界

- 価格表・単価・fixture **変更なし**
- lookup キー = Identity の `provider` + `providerModelId`
- ブラウザへ価格表を公開しない · クライアント原価計算なし

---

## テスト

```bash
node scripts/test-tasful-ai-auto-mode-phase3.mjs
node scripts/test-tasful-ai-safe-ops-usage-log-phase2.mjs
node scripts/test-tasful-ai-safe-ops-cost-ledger-phase2.mjs
node scripts/test-tasful-ai-safe-ops-guard-phase1.mjs
```

---

## 非スコープ（今回）

OpenRouter · 利用ゲージ · Billing UI · プラン料金 · Admin · Queue · OCR/Voice/Media/秘書/Builder への Auto 横展開 · Staging/Production DB · deploy · push

---

## 次 Phase

**Phase 4: 利用ゲージ**（実装は開始しない）
