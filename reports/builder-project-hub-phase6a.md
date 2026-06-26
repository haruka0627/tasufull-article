# Builder Project Hub — Phase 6-A 実装報告

**実施日:** 2026-06-26  
**状態:** **実装完了 · 未コミット**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)

---

## 概要

Builder を **案件管理プラットフォーム** へ拡張する第一歩として **案件ハブ MVP** を実装。Builder 経由案件を localStorage で集約し、**Builder AI Vision 診断 JSON** を案件に保存する。

**Builder 専用（AD-002）** — Platform · AI 秘書 · TASFUL AI 非展開。

---

## 案件フロー

```
案件ハブ（project-hub.html）
  → 案件詳細（project-detail.html?id=PRJ-…）
  → Builder AI（builder-ai.html?projectId=…）
  → Vision 診断（写真 + 相談文）
  → 診断 JSON（TasuBuilderAIVisionAnalyzer）
  → TasuBuilderProjectStore.saveVisionDiagnosis
  → 案件タイムライン + 診断履歴に反映
```

---

## 新規モジュール

| モジュール | 役割 |
| --- | --- |
| `builder-project-store.js` | `TasuBuilderProjectStore` — CRUD · 検索 · タイムライン · Vision 保存 |
| `builder-project-hub.js` | 一覧 · フィルタ · テーブル描画 |
| `builder-project-detail.js` | 詳細 · タイムライン · メモ保存 · AI リンク |

---

## UI 一覧

| 画面 | パス | 内容 |
| --- | --- | --- |
| **案件ハブ** | `builder/project-hub.html` | 検索 · 一覧テーブル |
| **案件詳細** | `builder/project-detail.html` | 案件/顧客/業者 · メモ · 診断履歴 · タイムライン |
| **Builder AI 連携** | `builder/builder-ai.html?projectId=` | 案件コンテキストバナー · 診断後自動保存 |

**ナビ:** `builder/index.html` サイドバーに「案件ハブ」リンク追加。

---

## ステータス（5）

問い合わせ · 見積中 · 契約済 · 施工中 · 完了

---

## Builder AI 連携

- 詳細画面「Builder AI で診断」→ `projectId` / `projectName` クエリ付き遷移
- `builder-ai-ui.js`: `usedVision` + `diagnosis` 成功時に `saveVisionDiagnosis`
- タイムラインに `ai_diagnosis` イベント追加
- 画像比較は **未実装**

---

## 変更ファイル

| 種別 | パス |
| --- | --- |
| 新規 | `builder/builder-project-store.js` |
| 新規 | `builder/builder-project-hub.js` |
| 新規 | `builder/builder-project-detail.js` |
| 新規 | `builder/builder-project-hub.css` |
| 新規 | `builder/project-hub.html` |
| 新規 | `builder/project-detail.html` |
| 変更 | `builder/builder-ai.html`（案件連携バナー · store script） |
| 変更 | `builder/builder-ai-ui.js`（診断 → 案件保存） |
| 変更 | `builder/index.html`（ナビリンク） |
| テスト | `scripts/test-builder-project-hub-phase6a.mjs` |

---

## 未実装（意図的）

収支 · カレンダー · 請求 · 契約書 · 写真比較 · OCR · CAD · 寸法 · 3D · 通知 · AI 秘書連携

---

## テスト

```bash
node scripts/test-builder-project-hub-phase6a.mjs
```

| 項目 | 結果 |
| --- | --- |
| 一覧 / 詳細 / 検索 | PASS |
| Vision JSON 保存 + タイムライン | PASS |
| Builder AI 連携（static） | PASS |
| phase5 回帰 | PASS |
| build:pages | PASS |

---

**commit / push / deploy:** 未実施
