# Builder AI — Tool Integration Phase 3 実装報告

**実施日:** 2026-06-26  
**状態:** **完了** · **commit 済** · **未デプロイ · 未 push**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)  
**前提:** UI Phase 1 `5d28acc` · Vision Phase 2 `4aff9ec`

---

## 概要

自然文から Builder 内部計算ツールを選択・実行し、**deterministic 関数で算出**した結果のみを AI が要約する。新規 CF Function · Gateway 契約変更 · Secret 変更 **なし**。

```
自然文 → CalcIntent → CalcOrchestrator → Calculators / builder-tool-material-calculator
  → precalc（数値再計算禁止）→ Gateway 要約（任意）
```

**設計:** AI は計算しない。Builder 内部ツールを選択・実行し、結果だけを要約する。

---

## 完了

| 項目 | 状態 |
| --- | --- |
| 自然文 intent 抽出 | **完了** · `builder-ai-calc-intent.js` |
| Tool Orchestrator | **完了** · `builder-ai-calc-orchestrator.js` |
| 既存 deterministic calculator 流用 | **完了** |
| `precalc`（数値再計算禁止） | **完了** · `builder-ai-core.js` |
| 現場 UI から計算ルート | **完了** · `builder-ai-ui.js` |
| Gateway 要約（optional） | **完了** · `preferRemote: false` デフォルト |

### 対応 MVP

| 例 | 経路 |
| --- | --- |
| 坪 → ㎡ | `area_unit_calc` / exterior チェーン |
| 材料数量（缶/本/箱） | `material_units` + `builder-tool-material-calculator` |
| 外壁塗装概算 | `exterior_paint` チェーン |
| 利益率逆算 | `target_profit` チェーン |
| 消費税 / インボイス | `invoice_tax_calc` |

---

## 新規 / 変更

| 種別 | パス |
| --- | --- |
| 新規 | `builder/builder-ai-calc-intent.js` |
| 新規 | `builder/builder-ai-calc-orchestrator.js` |
| 変更 | `builder/builder-ai-core.js`（`precalc`） |
| 変更 | `builder/builder-ai-ui.js` |
| 変更 | `builder/builder-ai.html` |
| テスト | `scripts/test-builder-ai-calc-phase3.mjs` |

**非変更:** `builder-ai-calculators.js` · `builder-tool-material-calculator.js`（参照のみ）

---

## 検証

| スクリプト | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `test-builder-ai-calc-phase3.mjs` | **15/15 PASS** |
| `test-builder-ai-tools-adaptation.mjs` | **85/85 PASS** |
| `test-builder-ai-p1-review.mjs` | **135/135 PASS** |
| `test-builder-ai-vision-phase2.mjs` | **8/8 PASS** |
| `test-builder-ai-ui-phase1.mjs` | **14/14 PASS** |

---

## 今後（計算 / 業務拡張）

- 足場 · 屋根 · 人工 · 原価
- 白色申告 · 青色申告 · 確定申告
- 顧客管理 · 現場管理
