# Builder AI — Vision Phase 5 実装報告

**実施日:** 2026-06-26  
**状態:** **実装完了 · 未コミット**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)

---

## 概要

Builder AI に **Gemini Vision 構造化診断（JSON 正本）** を正式統合。既存 Gateway → `gemini-chat` → Gemini Vision 経路を維持し、テキスト Gateway は変更なし。Builder 専用 · TASFUL AI / AI 秘書 / Platform 非展開。

---

## Vision フロー

```
現場写真選択 / Live スナップショット
  → builder-ai-ui.js（解析中ステータス）
  → builder-ai-vision.js runFieldDiagnosis
  → builder-ai-vision-analyzer.js analyze
      · カテゴリ検出 · 構造化プロンプト生成
      · builder-ai-core.js runFieldVision（systemPromptOverride · rawOutput）
      · TasuAiModelGateway.completeTurn（attachments → Gemini Vision）
  → JSON 正本 → normalizeDiagnosisJson
  → formatDiagnosisDisplay / formatDiagnosisHtml
  → UI（診断完了パネル + チャットログ）
```

**フォールバック:** Gateway 未接続 / API 失敗 / JSON 解析失敗 → `mockDiagnosis`（カテゴリ別テンプレート）

---

## 診断カテゴリ（11）

| id | ラベル |
| --- | --- |
| `exterior_wall` | 外壁 |
| `roof` | 屋根 |
| `interior` | 室内 |
| `floor` | 床 |
| `wet_area` | 水回り |
| `glass` | ガラス |
| `fixtures` | 建具 |
| `wallpaper` | クロス |
| `stain` | 汚れ |
| `scratch` | キズ |
| `other` | その他 |

---

## JSON 形式（正本）

```json
{
  "version": "1",
  "category": "exterior_wall",
  "categoryLabel": "外壁",
  "status": "reference_only",
  "condition": "状態の説明",
  "checkItems": ["確認事項"],
  "possibleCauses": ["考えられる原因"],
  "additionalChecks": ["追加確認推奨"],
  "aiComment": "AIコメント",
  "safetyNotice": "本診断はAIの参考診断であり、断定・保証するものではありません。最終判断は現地確認・専門業者の判断を優先してください。"
}
```

UI は `displayHtml` / `formatDiagnosisDisplay` で JSON を表示するのみ。

---

## Builder Safety

統一文言:

> 本診断はAIの参考診断であり、断定・保証するものではありません。最終判断は現地確認・専門業者の判断を優先してください。

---

## 変更 / 新規ファイル

| 種別 | パス |
| --- | --- |
| **新規** | `builder/builder-ai-vision-analyzer.js` |
| 変更 | `builder/builder-ai-core.js`（`systemPromptOverride` · `rawOutput`） |
| 変更 | `builder/builder-ai-vision.js`（Analyzer 委譲 · `TEXT_ONLY_STUB` export） |
| 変更 | `builder/builder-ai-ui.js`（Vision 状態 · 診断パネル） |
| 変更 | `builder/builder-ai-ui.css`（`.builder-ai-ui-vision-result*`） |
| 変更 | `builder/builder-ai.html`（script · 診断パネル slot） |
| テスト | `scripts/test-builder-ai-vision-phase5.mjs` |
| dist | `deploy/cloudflare/dist/builder/builder-ai-*` |

---

## UI 変更点（最小）

- チャット上部に **AI参考診断** パネル（`data-builder-ai-ui-vision-result`）
- 状態: `analyzing` · `complete` · `error` · `no_image`
- ステータス文言: 解析中 / 診断完了 / エラー / 画像なし
- 既存レイアウト・クイック相談・Live · Voice は維持

---

## テスト

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-builder-ai-vision-phase5.mjs` | **28/28 PASS** |
| `node scripts/test-builder-ai-vision-phase2.mjs` | **8/8 PASS**（回帰） |
| `npm run build:pages` | **PASS** |

カバー: 外壁/屋根/キズ/汚れ mock · 画像なし · Gateway 失敗 fallback · JSON 解析 · script 順

---

## 未実装（意図的）

| 項目 | 理由 |
| --- | --- |
| OCR | Phase 5 スコープ外（ユーザー指定禁止） |
| CAD / 寸法測定 / 3D | 別フェーズ · 専用パイプラインが必要 |
| Voice 拡張 | Live 4-A 既存を維持 · Vision Phase 5 は静止画診断に集中 |
| AI 秘書 / TASFUL AI / Platform 連携 | AD-002 · Builder 専用 surface 維持 |

---

## 非変更

- `ai-model-gateway.js` 契約（attachments 既存利用のみ）
- 新規 Cloudflare Function / Secret
- TASFUL AI · AI 秘書 · Platform · TLV

---

**commit / push / deploy:** 未実施
