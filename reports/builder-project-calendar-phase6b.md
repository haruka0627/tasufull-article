# Builder Project Calendar — Phase 6-B 実装報告

**実施日:** 2026-06-26  
**状態:** **実装完了 · 未コミット**  
**正本:** [docs/AI/BUILDER_AI.md](../docs/AI/BUILDER_AI.md)

---

## 概要

Project Hub（Phase 6-A）を拡張し、**工程・日程管理**と**案件カレンダー**を追加。`TasuBuilderProjectStore` を正本とし、案件詳細での日程変更がカレンダーに即時反映される。

**Builder 専用（AD-002）** — Platform · AI 秘書 · TASFUL AI 非展開。

---

## Calendar 構成

```
project-calendar.html
  ├─ サイドバー: 本日の案件 / 今週の案件 / 遅延案件
  └─ メイン: 月表示 | 週表示（案件クリック → project-detail.html）
```

| モジュール | 役割 |
| --- | --- |
| `builder-project-calendar.js` | 月/週グリッド · ウィジェット · ナビ |
| `builder-project-calendar.css` | カレンダー UI |
| `project-calendar.html` | カレンダー画面 |

---

## Project Hub 連携

```
案件詳細（日程フォーム）
  → TasuBuilderProjectStore.updateSchedule
  → タイムライン schedule_updated
  → カレンダー再読込で反映

案件ハブ一覧
  → 工程列 · 日程列 · カレンダーリンク
```

---

## 工程一覧（8）

問い合わせ · 現地調査 · 見積 · 契約 · 着工 · 施工中 · 完了 · アフター

---

## ストア拡張

| API | 説明 |
| --- | --- |
| `SCHEDULE_PHASES` | 工程マスタ |
| `updateSchedule` | 開始/終了/工程更新 |
| `getTodayProjects` / `getThisWeekProjects` / `getDelayedProjects` | ウィジェット用 |
| `getProjectsForDate` / `getProjectsForDateRange` | カレンダー描画 |
| `previewScheduleIntent` / `applyScheduleIntent` | Builder AI 将来連携（「来週へ変更」等） |
| `prepareScheduleIntent`（`builder-ai-ui.js`） | AI 側フック（**現時点未呼び出し**） |

---

## UI 変更

| 画面 | 変更 |
| --- | --- |
| `project-calendar.html` | **新規** — カレンダー + 3 ウィジェット |
| `project-detail.html` | 工程・日程フォーム · カレンダーリンク |
| `project-hub.html` | 工程/日程列 · カレンダーリンク |
| `index.html` | サイドバー/クイックリンク → カレンダー |

---

## 変更ファイル

| 種別 | パス |
| --- | --- |
| 新規 | `builder/builder-project-calendar.js` |
| 新規 | `builder/builder-project-calendar.css` |
| 新規 | `builder/project-calendar.html` |
| 新規 | `scripts/test-builder-project-calendar-phase6b.mjs` |
| 変更 | `builder/builder-project-store.js` |
| 変更 | `builder/builder-project-detail.js` |
| 変更 | `builder/builder-project-hub.js` |
| 変更 | `builder/project-detail.html` |
| 変更 | `builder/project-hub.html` |
| 変更 | `builder/index.html` |
| 変更 | `builder/builder-ai-ui.js` |
| 変更 | `docs/AI/BUILDER_AI.md` · `docs/TODO.md` · `docs/ROADMAP.md` |

---

## 未実装（今回スコープ外）

収支 · 請求 · 契約書 · 通知 · AI 秘書 · Platform · OCR · CAD · 3D · AI による実際の予定変更

---

## テスト

```bash
node scripts/test-builder-project-calendar-phase6b.mjs
```

- Phase 6-B ユニット（ストア · 静的 · intent）
- Phase 6-A 回帰
- `npm run build:pages`

---

## commit / push / deploy

**未実施**
