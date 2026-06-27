# AI 秘書 Phase 6 — Operations AI（Insight · Suggestion · Priority）

**Status:** 実装済 · レビュー待ち（**コミットなし · deploy なし**）  
**Base:** Phase 5 Operations Orchestrator · DeepSeek Adapter（AD-010）  
**VERSION:** `phase6-operations-engine`

---

## 目的

AI 秘書を「チャット AI」から **TASFUL 全体を監視・分析・提案するオペレーション AI** へ進化させる第一歩。

- Voice Core · Builder · Platform · TLV **本体は変更しない**
- DeepSeek Gateway 契約（`ai-model-gateway.js`）**変更しない**
- Phase 6 では **Action 候補のみ** — 自動実行なし

---

## 新規モジュール

| モジュール | 役割 |
|-----------|------|
| `admin-ai-secretary-ops-data-provider.js` | API/Mock/DeepSeek 抽象 · OpsSnapshot 正規化 |
| `admin-ai-secretary-insight-engine.js` | 集約データ分析 · 異常検知 · インサイト生成 |
| `admin-ai-secretary-priority-engine.js` | Critical / Warning / Info 分類 · 表示順 |
| `admin-ai-secretary-suggestion-engine.js` | 提案 · 質問 · 改善案 · Action 候補 |
| `admin-ai-secretary-operations-engine.js` | 上記統合ファサード |
| `admin-ai-secretary-phase6.js` | Intelligence パネル UI 連携 |

---

## クラス構成（グローバル API）

```
TasuSecretaryOpsDataProvider
  ├── createMockDataProvider()
  ├── createDeepSeekDataProvider()   # stub · LLM 未呼び出し
  ├── createCompositeDataProvider()
  └── resolveProvider()

TasuSecretaryInsightEngine
  ├── analyzeSnapshots(snapshots)
  └── summarize(insights)

TasuSecretaryPriorityEngine
  ├── classifyInsights(insights)
  ├── sortForDisplay(items)
  └── groupByPriority(items)

TasuSecretarySuggestionEngine
  ├── buildSuggestions(prioritizedItems)
  └── actionCandidatesFor(domain)

TasuSecretaryOperationsEngine
  ├── runAnalysis(options)
  └── refresh(options)

TasuAdminAiSecretaryPhase6
  └── renderIntelligencePanel()
```

---

## データフロー

```mermaid
flowchart TD
  A[Ops Data Provider] -->|OpsSnapshot[]| B[Insight Engine]
  B -->|OpsInsight[]| C[Priority Engine]
  C -->|PrioritizedItems| D[Suggestion Engine]
  D -->|Suggestions + ActionCandidates| E[Operations Engine]
  E --> F[Phase6 Intelligence Panel]
  G[DeepSeek Adapter 将来] -.->|enrichment stub| A
  H[KpiCenter / OpsWatch 読取のみ] -.-> A
```

### スキーマ

| 層 | schema |
|----|--------|
| スナップショット | `ops_snapshot_v1` |
| インサイト | `ops_insight_v1` |
| 提案 | `ops_suggestion_v1` |
| 分析バンドル | `ops_analysis_v1` |

---

## ドメイン · 検知例（Mock）

| ドメイン | メトリクス | インサイト例 |
|---------|-----------|-------------|
| Builder | 問い合わせ / 成約率 / 返信遅延 | 問い合わせ急増 · 成約率低下 |
| Platform | 投稿数 / Talk / NG投稿 | NG投稿増加 · Talk利用率低下 |
| TLV | 登録率 / 視聴時間 | 登録率低下 |
| Materials | DL数 / カテゴリ変化 | ダウンロード急増 |

---

## Action 候補（実行しない）

すべて `executable: false` · UI ボタンは `disabled`。

- 分析開始
- 詳細を見る
- Builder / Platform / TLV / Materials を開く（href 候補のみ）

---

## テスト

```bash
node scripts/test-secretary-operations-phase6.mjs
```

---

## 変更ファイル

| ファイル | 操作 |
|---------|------|
| `admin-ai-secretary-ops-data-provider.js` | 新規 |
| `admin-ai-secretary-insight-engine.js` | 新規 |
| `admin-ai-secretary-priority-engine.js` | 新規 |
| `admin-ai-secretary-suggestion-engine.js` | 新規 |
| `admin-ai-secretary-operations-engine.js` | 新規 |
| `admin-ai-secretary-phase6.js` | 実装（スタブ置換） |
| `admin-operations-dashboard.html` | script 6 本追加 |
| `scripts/test-secretary-operations-phase6.mjs` | 新規 |
| `reports/ai-secretary-operations-phase6-plan.md` | 本ドキュメント |

---

## 影響範囲

| 領域 | 影響 |
|------|------|
| AI 秘書 Intelligence パネル | **あり** — 分析結果表示 |
| Phase 5 Orchestrator | **なし** — 独立モジュール |
| DeepSeek Adapter / Gateway | **なし** |
| Builder / Platform / TLV / Voice Core | **なし** |

---

## 次フェーズ（未着手）

- Phase 6-B: 実 API / Supabase 集計接続
- Phase 6-C: DeepSeek 要約 enrichment（Adapter 経由 · Gateway 非混在）
- Phase 6-D: Action 実行 · Human Gate 連携
