# Builder Notification Center — Phase 6-G 実装報告

**実施日:** 2026-06-27  
**状態:** **実装完了 · 未コミット**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)

---

## 概要

案件管理に通知基盤（Foundation）を追加。工程期限・支払期限・契約・完了・Vision 診断などを Project Hub / Project Detail で確認可能。

**Builder 専用（AD-002）** — `TasuBuilderProjectStore` 正本 · **SCHEMA v7**

メール / Push / AI秘書 / cron / 他 surface 連携は **未実装**（今回スコープ外）。

---

## データ構造

### `project.notifications[]`

| フィールド | 説明 |
| --- | --- |
| id, type, title, message | 識別・表示 |
| priority | low / normal / high / urgent |
| status | unread / read / archived |
| source | schedule / finance / estimate / invoice / contract / completion / document / vision / manual |
| dueDate, createdAt, readAt, archivedAt | 期限・タイムスタンプ |
| linkedTimelineId, linkedDocumentId, linkedVisionId | リンク |
| metadata | 任意キー値 |

### デモサンプル（PRJ-2026-001: 5件）

工程期限 · 支払期限 · 契約確認 · 完了確認 · Vision診断

---

## Store API

| API | 説明 |
| --- | --- |
| `addNotification` | 追加 · `notification_added` |
| `updateNotification` | 更新 · `notification_updated` |
| `markNotificationRead` | 既読 · `notification_read` |
| `markNotificationUnread` | 未読に戻す · `notification_updated` |
| `archiveNotification` | アーカイブ · `notification_archived` |
| `getNotifications` / `getUnreadNotifications` | 一覧取得 |
| `getNotificationsByType` / `getNotificationsByPriority` | フィルタ |
| `getNotificationSummary` | Hub 全体サマリー |
| `getProjectNotificationCounts` | 案件別件数 |
| `generateProjectNotifications` | 既存データから候補生成のみ（永続化なし） |
| `previewNotificationIntent` | 将来 AI 用プレビュー |
| `applyNotificationIntent` | previewOnly（実更新未接続） |

---

## UI

| 画面 | 追加 |
| --- | --- |
| **案件詳細** | Notifications パネル（未読数 · 優先度/種別/状態フィルタ · 一覧 · 手動追加 · 既読/未読/アーカイブ） |
| **案件ハブ** | 通知サマリー（総数/未読/高優先度/期限超過/今日期限） · 一覧列（通知数/未読/高優先度） |
| **Builder AI** | `prepareNotificationIntent`（Gateway 未接続 · プレビューのみ） |

---

## テスト

`node scripts/test-builder-notification-center-phase6g.mjs`

- Store 単体（notifications 初期値 · CRUD · summary · generate · timeline · AI preview）
- Phase 6-F / 6-E / 6-D / 6-C 回帰
- Vision Phase 5 回帰
- `npm run build:pages` PASS

---

## 未実装（今回スコープ外）

メール送信 · Push / Web Push · LINE / Slack · AI秘書連携 · Platform / TLV / TASFUL AI 連携 · cron · Cloud Functions · DB migration · 実通知配信
