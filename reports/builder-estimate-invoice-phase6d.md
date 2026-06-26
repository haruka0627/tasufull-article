# Builder Estimate / Invoice — Phase 6-D 実装報告

**実施日:** 2026-06-26  
**状態:** **実装完了 · 未コミット**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)

---

## 概要

Project Hub / Detail に **見積・請求管理の基盤** を追加。`TasuBuilderProjectStore`（SCHEMA v4）を正本とする。

**Builder 専用（AD-002）** — Stripe / PDF / 電子署名 / メール / Platform / AI秘書 非連携。

---

## データ構造

### `project.estimate`

見積番号 · 状態 · 有効期限 · 顧客情報 · 明細 items[] · 小計/税/合計 · メモ

### `project.invoice`

請求番号 · 状態（draft/issued/paid/cancelled）· 請求日/期限/入金日 · 小計/税/合計 · メモ

消費税 **10%** 自動計算（MVP）。

---

## Store API

| API | 説明 |
| --- | --- |
| `updateEstimate` | 見積保存 · `estimate_updated` |
| `updateInvoice` | 請求保存 · `invoice_updated` |
| `calculateEstimate` / `calculateInvoice` | 税・合計再計算 |
| `getEstimateSummary` / `getInvoiceSummary` | Hub サマリー |
| `getOutstandingInvoices` | 発行済・未入金 |
| `getUninvoicedProjects` | 未請求案件 |
| `previewEstimateIntent` / `previewInvoiceIntent` | AI プレビュー |
| `applyEstimateIntent` / `applyInvoiceIntent` | 将来 AI 用（テストのみ） |

---

## UI

| 画面 | 追加 |
| --- | --- |
| **案件詳細** | 見積パネル · 請求パネル |
| **案件ハブ** | 見積・請求サマリー · 一覧列（状態/合計） |
| **Builder AI** | `prepareEstimateIntent` · `prepareInvoiceIntent`（未接続） |

---

## 変更ファイル

- `builder/builder-project-store.js`
- `builder/builder-project-detail.js`
- `builder/builder-project-hub.js`
- `builder/builder-project-hub.css`
- `builder/project-detail.html`
- `builder/project-hub.html`
- `builder/builder-ai-ui.js`
- `scripts/test-builder-estimate-invoice-phase6d.mjs`
- `docs/AI/BUILDER_AI.md` · `docs/TODO.md` · `docs/ROADMAP.md`

---

## 未実装

Stripe · 決済 · PDF · 帳票印刷 · 電子署名 · OCR · CAD · 3D · メール · DB · cron · Cloud Functions · AI 自動更新接続

---

## テスト

```bash
node scripts/test-builder-estimate-invoice-phase6d.mjs
```

---

## commit / push / deploy

**未実施**
