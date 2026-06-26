# Builder Document Center — Phase 6-F 実装報告

**実施日:** 2026-06-27  
**状態:** **実装完了 · 未コミット**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)

---

## 概要

案件ごとのドキュメント一元管理基盤を追加。`TasuBuilderProjectStore`（**SCHEMA v6**）を正本とする。

**Builder 専用（AD-002）** — OCR / PDF / Cloud Storage / 実アップロード / Platform / AI秘書 非連携。

---

## データ構造

### `project.documents[]`

| フィールド | 説明 |
| --- | --- |
| id, type, title, description | 識別・種別・表示 |
| filename, mimeType, size | メタデータ（ダミー） |
| tags[], linkedVisionId, linkedTimelineId | タグ・リンク |
| status | active / archived / deleted |
| createdAt, updatedAt | タイムスタンプ |

### デモサンプル（PRJ-2026-001: 5件）

施工前写真 · 施工後写真 · 図面 · 契約書 · 見積書

---

## Store API

| API | 説明 |
| --- | --- |
| `addDocument` | 追加 · `document_added` |
| `updateDocument` | 更新 · `document_updated` |
| `archiveDocument` | アーカイブ · `document_archived` |
| `removeDocument` | 論理削除 · `document_deleted` |
| `getDocuments` / `getDocumentsByType` | 一覧取得 |
| `searchDocuments` | キーワード/種別/タグ検索 |
| `getDocumentSummary` | Hub 全体サマリー |
| `getProjectDocumentCounts` | 案件別件数 |
| `previewDocumentIntent` / `applyDocumentIntent` | 将来 AI 用（テストのみ） |

---

## UI

| 画面 | 追加 |
| --- | --- |
| **案件詳細** | Documents パネル（カテゴリ/検索/タグ/一覧/追加編集/アーカイブ/削除） |
| **案件ハブ** | ドキュメントサマリー · 一覧列（Document数/写真数/PDF数） |
| **Builder AI** | `prepareDocumentIntent`（未接続） |

---

## 変更ファイル

- `builder/builder-project-store.js`
- `builder/builder-project-detail.js`
- `builder/builder-project-hub.js`
- `builder/builder-project-hub.css`
- `builder/project-detail.html`
- `builder/project-hub.html`
- `builder/builder-ai-ui.js`
- `scripts/test-builder-document-center-phase6f.mjs`
- `scripts/test-builder-contract-completion-phase6e.mjs`（SCHEMA v6 回帰）
- `scripts/test-builder-estimate-invoice-phase6d.mjs`（SCHEMA v6 回帰）
- `docs/AI/BUILDER_AI.md` · `docs/TODO.md` · `docs/ROADMAP.md`

---

## 未実装

OCR · Gemini解析 · PDF生成 · Cloud Storage · Supabase Storage · 実ファイルアップロード · メール · 通知 · DB · cron · Cloud Functions · AI 自動更新接続

---

## テスト

```bash
node scripts/test-builder-document-center-phase6f.mjs
```

Phase 6-E / 6-D / 6-C / 6-B / 6-A / Vision / `build:pages` 回帰含む。
