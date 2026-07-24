# CAL-MAIN-18 — assignment_status 参照棚卸し（Hub Read 正本化）

**日付:** 2026-07-04  
**前提:** CAL-MAIN-17 Go（DB 成功時 MVP `assignment_status` write no-op）  
**後続:** CAL-MAIN-19 で Hub Primary **完了（Go）** — [hub-primary-completion](./builder-calendar-hub-primary-completion.md)

今回は **削除しない**。本線表示の Read を Hub assignment 優先にし、MVP は fallback に限定する。

## localStorage / キー

| キー | 内容 | 扱い |
| --- | --- | --- |
| `tasu_builder_project_hub_v1` | Hub `project.assignment` | **Read 正本** |
| `tasful:builder:mvp:v1` | `projects[].assignment_status` | fallback / write 互換（CAL-MAIN-17） |
| `tasful:builder:admin:calendarAssignments:v1` | 運営割当行 | 割当権限・デモ文言（status 正本ではない） |
| `tasful:builder:mvp:notifications:v1` | 通知 | 触らない |

## 分類

### A. Hub assignment に寄せた本線表示（実装済み）

| 箇所 | 関数 / UI |
| --- | --- |
| 共通リゾルバ | `resolveCalendarAssignmentStatus` · `HubAdapter.readHubAssignmentStatus` |
| ステータスラベル | `getCalendarAssignmentStatusLabel` |
| partner 判定 | `isPartnerAcceptedAssignment` / `Pending` / `Declined` |
| partner-assignment 詳細 | `renderPartnerAssignmentDetailOnly` |
| calendar partner 詳細 | `renderMvpCalendarPartnerAssignmentDetail` |
| 受諾後スレッド href | `partnerAcceptedThreadHref` |
| 一覧バッジ | `getCalendarListItemClass`（`is-accepted` / `is-declined`） |
| 受諾一覧 | `renderPartnerAcceptedScheduleList`（上記判定経由） |
| admin 詳細の状態表示 | `renderMvpCalendarAdminDetail`（label 経由） |

**優先順位:** Hub `assignment.status` → live MVP `assignment_status` → 引数オブジェクト上の埋め込み値 → `pending`

### B. MVP fallback として残す

| 箇所 | 理由 |
| --- | --- |
| CAL-MAIN-17 accept/decline write | DB 失敗時のみ MVP `assignment_status` を更新 |
| `resolveCalendarAssignmentStatus` の live MVP 段 | Hub assignment が無いとき |
| partner-assignment `source=mvp` パス | Hub 案件が解決できないとき |

### C. demo / test / admin 専用（今回そのまま）

| 箇所 | 理由 |
| --- | --- |
| `ensureAdminCalendarPartnerDemoData` の `assignmentStatus` seed | デモ fixture |
| `scripts/test-builder-calendar-cal-main-*.mjs` | 回帰アサーション |
| admin 作成時 `assignment_status: "pending"` write | 運営作成ミラー |

### D. 削除候補だが今回は削除しない

| 箇所 | 理由 |
| --- | --- |
| MVP `projects[].assignment_status` フィールド自体 | write fallback / 互換 |
| `builder-talk-bridge.js` の `assignment_status === "accepted"` | thread 復旧（thread は触らない） |
| 通知・completion・board 応募 | スコープ外 |

## 検証

```bash
node scripts/test-builder-calendar-cal-main-18-hub-read-primary.mjs
```

## やらなかったこと

- MVP / localStorage の削除
- projects mirror・通知・thread・completion・admin assignments の改修
- Feature flag `TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK` の変更
