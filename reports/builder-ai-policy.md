# Builder AI 方針・監査メモ

最終更新: 2026-06-21

## 方針

| 項目 | Builder AI | TASFUL AI |
|------|------------|-----------|
| 位置づけ | Builder 専用・建設業務限定 | プラットフォーム全般（市場・求人・スキル等） |
| Builder 内 | 「Builder AI」表記で統一 | **導線・表記ともに使わない** |

Builder AI の対象例: 案件相談、職人/協力会社検索、人工・材料・見積補助、工程相談。

## 完了確認（2026-06-21）

- [x] Builder 内に `ai-workspace.html` / `gen-ai-workspace.html` / 「TASFUL AI」への導線 **なし**
- [x] `builder/construction-tools.html` の AI 表記を **Builder AI** に統一済み
- [x] 390 / 430 / 768 / 1280px で横スクロールなし（construction-tools）

## TALK AI 下書き連携 — **現状維持**

### 対象ファイル

- `builder/mvp-project-new.html` — `talk-ai-drafts-store.js`, `talk-ai-draft-apply.js`
- `builder/builder.js` — `TasuTalkAiDraftApply.tryApplyProjectPage()`

### 維持理由

- TASFUL AI Workspace への導線**ではない**
- Builder 内で TASFUL AI を呼び出している**わけではない**
- 案件投稿フォームの**入力補助**として機能している
- 削除すると既存の便利機能を失う可能性がある

### 今後の移行（将来）

Builder AI 本実装時に、TALK AI 下書き連携を **Builder AI 専用下書き連携**へ移行する。現時点では削除しない。

関連コメント: `mvp-project-new.html`（script 読み込み付近）、`builder.js`（`renderMvpProjectNewPage`）。
