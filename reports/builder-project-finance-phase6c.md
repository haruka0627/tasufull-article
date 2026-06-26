# Builder Project Finance — Phase 6-C 実装報告

**実施日:** 2026-06-26  
**状態:** **実装完了 · 未コミット**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)

---

## 概要

Project Hub / Detail に **案件ごとの最低限の収支管理** を追加。`TasuBuilderProjectStore` を正本とし、見積・原価・粗利・支払状況を localStorage で管理する。

**Builder 専用（AD-002）** — Stripe / 請求書 PDF / Platform / AI秘書 非連携。

---

## 収支データ構造（`project.finance`）

| フィールド | 説明 |
| --- | --- |
| `estimateAmount` | 見積額（円） |
| `costAmount` | 原価（円） |
| `grossProfit` | 粗利（自動計算） |
| `grossProfitRate` | 粗利率 %（自動計算） |
| `paymentStatus` | unpaid / partial / paid |
| `paymentDueDate` | 支払予定日 |
| `paidAt` | 入金日 |
| `memo` | 収支メモ |
| `updatedAt` | 更新日時 |

---

## Store API

| API | 説明 |
| --- | --- |
| `updateFinance` | 収支保存 · タイムライン `finance_updated` |
| `calculateProjectFinance` | 粗利・粗利率再計算 |
| `getFinanceSummary` | 総見積/原価/粗利 · 未入金/遅延件数 |
| `getUnpaidProjects` | 未入金・一部入金案件 |
| `getOverduePaymentProjects` | 支払予定日超過（未入金済以外） |
| `previewFinanceIntent` | 自然文 → intent プレビュー |
| `applyFinanceIntent` | 将来 AI 用（テストのみ） |

---

## UI

| 画面 | 内容 |
| --- | --- |
| **案件詳細** | 収支パネル（編集 + 粗利/率表示） |
| **案件ハブ** | 収支サマリー + 一覧列（見積/原価/粗利/支払） |
| **Builder AI** | `prepareFinanceIntent`（プレビューのみ · 未接続） |

---

## 変更ファイル

| 種別 | パス |
| --- | --- |
| 変更 | `builder/builder-project-store.js` |
| 変更 | `builder/builder-project-detail.js` |
| 変更 | `builder/builder-project-hub.js` |
| 変更 | `builder/builder-project-hub.css` |
| 変更 | `builder/project-detail.html` |
| 変更 | `builder/project-hub.html` |
| 変更 | `builder/builder-ai-ui.js` |
| 新規 | `scripts/test-builder-project-finance-phase6c.mjs` |
| 変更 | `docs/AI/BUILDER_AI.md` · `docs/TODO.md` · `docs/ROADMAP.md` |

---

## 未実装

Stripe / 決済 · 請求書 PDF · 契約書 PDF · OCR · CAD · 3D · DB · cron · AI 自動更新接続 · 専用 finance ページ

---

## テスト

```bash
node scripts/test-builder-project-finance-phase6c.mjs
```

---

## commit / push / deploy

**未実施**
