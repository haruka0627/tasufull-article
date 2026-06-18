# TASFUL AI 検索 — 公開前ベータチェック

Serper 検索復旧後の手動確認用チェックリストです。E2E は `scripts/test-ai-search-orchestrator-browser.mjs` と `scripts/test-ai-plan-model-selector-browser.mjs` で自動化しています。

## 対象ページ

- `ai-workspace.html`
- `gen-ai-workspace.html`
- `talk-home.html`（AI パネル）

## プラン切替（課金なし・検証用）

URL パラメータまたは localStorage:

- `?ai_plan=free` / `trial` / `light` / `standard` / `premium`
- `localStorage.setItem('tasu_ai_user_plan', 'standard')`

生成AIの Stripe プランは自動マッピング: `basic_300` → Light、`pro_980` → Standard。

## 検索あり質問（バッジ表示・Serper 実行）

| 質問例 | 期待 |
|--------|------|
| 最新の補助金を調べて | 検索 ON・バッジ |
| 2026年のStripe Connect手数料を調べて | 検索 ON |
| 今のAIニュースを教えて | 検索 ON |
| 埼玉県のリフォーム補助金を調べて | 検索 ON |
| 今日の為替を調べて | 検索 ON |

確認: `search-intent-detector` → Edge `serper-search` → 上位5件が `searchContext` → 「Web検索を利用しました」→ AI 応答継続。

## 検索なし質問

| 質問例 | 期待 |
|--------|------|
| ありがとう | 検索 OFF・バッジなし |
| TASFULとは？ | 検索 OFF |
| 文章を丁寧にして | 検索 OFF |
| JavaScriptのif文を説明して | 検索 OFF |
| 1+1は？ | 検索 OFF |

## Serper フォールバック

API / Edge / ネットワークエラー・0件時:

- エラー UI なし
- チャット継続
- AI のみ応答（モック含む）
- ログ: `search_used=false` または `search_result_count=0`、`fallback_used=true`

## プラン別モデル

| プラン | 選択可能 |
|--------|----------|
| Free / Trial | Gemini Flash のみ |
| Light | Gemini Flash（GPT は disabled 表示可） |
| Standard | Gemini / GPT / Claude |
| Premium | 上記 + Grok（準備中・disabled） |

チャット上部: **現在のAI: …** とモデル選択。検索バッジとは別表示。

## ログ（localStorage `tasu_ai_interaction_logs_v1`）

各ターンに記録:

- `selected_model`, `selected_provider`, `user_plan`
- `search_used`, `search_query`, `search_provider`, `search_result_count`
- `fallback_used`

## Edge 環境変数（本番デプロイ時）

- `SERPER_API_KEY` — `serper-search`
- `GEMINI_API_KEY` — `gemini-chat`
- `OPENAI_API_KEY` — `openai-chat`（任意）
- `ANTHROPIC_API_KEY` — `claude-chat`（任意）
