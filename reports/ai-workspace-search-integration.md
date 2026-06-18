# AI Workspace × TASFUL内検索 連携レポート

実施: 2026-06-12T13:02:45.584Z

## 方針

- 通常検索: **TASFUL内データ**（`TasuAiCrossSearch` / `TasuAiSearch`）
- AI API使用: **問い合わせ文作成・高度相談のみ**（`TasuAiGenerateUi` / Gateway）
- 共通履歴 / 応答元バッジ / モデル切替 / Gateway構造: **維持**

## 検証結果

### 埼玉で屋根修理業者を探して

- 結果: **PASS**
- カード数: 1
- 比較サマリー: false
- 検索条件表示: true
- 比較に追加ボタン: true
- 問い合わせ文ボタン: true
- [object Object]なし: true
- スクショ: `screenshots/ai-workspace-search/vendor-search.png`


### 評価4以上の草刈り業者を比較して

- 結果: **PASS**
- カード数: 4
- 比較サマリー: true
- 検索条件表示: true
- 比較に追加ボタン: true
- 問い合わせ文ボタン: true
- [object Object]なし: true


### Connect対応のワーカーを探して

- 結果: **PASS**
- カード数: 2
- 比較サマリー: true
- 検索条件表示: true
- 比較に追加ボタン: true
- 問い合わせ文ボタン: true
- [object Object]なし: true
- スクショ: `screenshots/ai-workspace-search/worker-search.png`


### 近くの商品を探して

- 結果: **PASS**
- カード数: 5
- 比較サマリー: true
- 検索条件表示: true
- 比較に追加ボタン: true
- 問い合わせ文ボタン: true
- [object Object]なし: true
- スクショ: `screenshots/ai-workspace-search/product-search.png`



## 提出スクリーンショット

- `screenshots/ai-workspace-search/vendor-search.png`
- `screenshots/ai-workspace-search/worker-search.png`
- `screenshots/ai-workspace-search/product-search.png`
