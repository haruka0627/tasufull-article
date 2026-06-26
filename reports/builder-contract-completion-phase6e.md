# Builder Contract / Completion — Phase 6-E 実装報告

**実施日:** 2026-06-27  
**状態:** **実装完了 · 未コミット**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)

---

## 概要

案件ライフサイクル（見積 → 請求 → **契約 → 着工 → 施工 → 完了 → 引渡し**）の基盤を追加。`TasuBuilderProjectStore`（**SCHEMA v5**）を正本とする。

**Builder 専用（AD-002）** — Stripe / PDF / 電子署名 / メール / 通知 / Platform / AI秘書 非連携。

---

## データ構造

### `project.contract`

契約番号 · 状態（draft/sent/signed/cancelled）· 契約日 · 着工予定 · 完了予定 · 保証期間（月）· 特記事項

### `project.completion`

完了状態（not_started/working/inspection/completed/handed_over）· 着工日/完了日/引渡し日 · オーナー/パートナー確認 · 完了メモ · 写真一覧（表示のみ）

### デモ案件

| 案件 | 契約 | 完了 |
| --- | --- | --- |
| PRJ-2026-001 | draft | not_started |
| PRJ-2026-002 | sent | working |
| PRJ-2026-003 | signed | completed |

---

## Store API

| API | 説明 |
| --- | --- |
| `updateContract` | 契約保存 · `contract_updated` |
| `updateCompletion` | 完了保存 · `completion_updated` |
| `getContractSummary` | 契約待ち/締結済 件数 |
| `getCompletionSummary` | 工事中/完了待ち/完了済み 件数 |
| `getWorkingProjects` | 施工中案件 |
| `getCompletedProjects` | 完了・引渡し済案件 |
| `previewContractIntent` / `previewCompletionIntent` | AI プレビュー |
| `applyContractIntent` / `applyCompletionIntent` | 将来 AI 用（テストのみ） |

---

## UI

| 画面 | 追加 |
| --- | --- |
| **案件詳細** | 契約パネル · 完了パネル（写真一覧は表示のみ） |
| **案件ハブ** | 契約・完了サマリー · 一覧列（契約状態/完了状態/着工予定/完了予定） |
| **Builder AI** | `prepareContractIntent` · `prepareCompletionIntent`（未接続） |

---

## 変更ファイル

- `builder/builder-project-store.js`
- `builder/builder-project-detail.js`
- `builder/builder-project-hub.js`
- `builder/builder-project-hub.css`
- `builder/project-detail.html`
- `builder/project-hub.html`
- `builder/builder-ai-ui.js`
- `scripts/test-builder-contract-completion-phase6e.mjs`
- `scripts/test-builder-estimate-invoice-phase6d.mjs`（SCHEMA v5 回帰更新）
- `docs/AI/BUILDER_AI.md` · `docs/TODO.md` · `docs/ROADMAP.md`

---

## 未実装

Stripe · 決済 · PDF · 帳票印刷 · 電子署名 · OCR · CAD · 3D · メール · 通知 · DB · cron · Cloud Functions · AI 自動更新接続

---

## テスト

```bash
node scripts/test-builder-contract-completion-phase6e.mjs
```

Phase 6-D / 6-C / 6-B / 6-A / Vision / `build:pages` 回帰含む。
