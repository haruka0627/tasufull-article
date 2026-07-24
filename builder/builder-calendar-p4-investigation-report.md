# Builder Calendar P4 — Supabase Write 移行 調査レポート

> 調査日: 2026-07-04
> 調査者: Cursor
> 状態: **調査・分析のみ（実装未着手）**

---

## 1. Write 経路の洗い出し

### 1.1 全 Write 関数一覧（builder-project-store.js）

`builder-project-store.js` は **2902行の大規模ファイル** で、全 write が `localStorage` に依存。

| # | 関数 | 引数 | 呼び出し元 | 保存先 | 頻度 |
|---|------|------|-----------|--------|------|
| **A** | `saveProject(project)` | 案件オブジェクト全体 | 案件ハブUI | localStorage | 新規作成時 |
| **B** | `updateProject(id, patch)` | ID + 部分更新 | 全更新経路の中心 | localStorage | 高頻度 |
| **C** | `updateSchedule(projectId, patch)` | ID + 日程 | カレンダーUI / AI intent | → updateProject | 中 |
| **D** | `updateCompletion(projectId, patch)` | ID + 完了報告 | カレンダー詳細UI | localStorage | 中 |
| **E** | `updateFinance(projectId, patch)` | ID + 収支 | 案件詳細UI | localStorage | 低 |
| **F** | `updateEstimate(projectId, patch)` | ID + 見積 | 案件詳細UI / AI intent | localStorage | 低 |
| **G** | `updateInvoice(projectId, patch)` | ID + 請求 | 案件詳細UI / AI intent | localStorage | 低 |
| **H** | `updateContract(projectId, patch)` | ID + 契約 | 案件詳細UI / AI intent | localStorage | 低 |
| **I** | `addDocument(projectId, input)` | ID + ドキュメント | 詳細UI | → persistProjectDocuments | 低 |
| **J** | `updateDocument(projectId, docId, patch)` | ID + ドキュメントID | 詳細UI | → persistProjectDocuments | 低 |
| **K** | `removeDocument(projectId, docId, reason)` | ID + ドキュメントID | 詳細UI | → persistProjectDocuments | 低 |
| **L** | `archiveDocument(projectId, docId, reason)` | ID + ドキュメントID | 詳細UI | → persistProjectDocuments | 低 |
| **M** | `addNotification(projectId, input)` | ID + 通知 | 自動生成 | → persistProjectNotifications | 低 |
| **N** | `updateNotification(projectId, noteId, patch)` | ID + 通知ID | UI操作 | → persistProjectNotifications | 低 |
| **O** | `saveVisionDiagnosis(projectId, diagnosis)` | ID + AI診断 | Builder AI連携 | localStorage | 低 |
| **P** | `applyScheduleIntent(projectId, intent)` | ID + AI intent | AI連携予定地 | → updateSchedule | 予定のみ |
| **Q** | `applyFinanceIntent(projectId, intent)` | ID + AI intent | AI連携予定地 | → updateFinance | 予定のみ |
| **R** | `applyEstimateIntent(projectId, intent)` | ID + AI intent | AI連携予定地 | → updateEstimate | 予定のみ |
| **S** | `applyInvoiceIntent(projectId, intent)` | ID + AI intent | AI連携予定地 | → updateInvoice | 予定のみ |
| **T** | `applyContractIntent(projectId, intent)` | ID + AI intent | AI連携予定地 | → updateContract | 予定のみ |
| **U** | `applyCompletionIntent(projectId, intent)` | ID + AI intent | AI連携予定地 | → updateCompletion | 予定のみ |
| **V** | `applyDocumentIntent(projectId, intent)` | ID + AI intent | AI連携予定地 | → add/update/archive | 予定のみ |
| **W** | `clearForTests()` | — | テスト用 | localStorage削除 | テスト時のみ |

### 1.2 localStorage 永続化の内部構造

すべての write 関数は最終的に以下を呼ぶ:

```javascript
function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({...}));
}

function readAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = JSON.parse(raw || "{}");
  return { version: SCHEMA_VERSION, projects: Array.isArray(data.projects) ? data.projects : [] };
}
```

**単一キー `tasu_builder_project_hub_v1` に全案件が JSON 配列として保存。**

### 1.3 Calendar UI 固有の localStorage

`builder-project-calendar.js` 内:

```javascript
const COMPLETION_DRAFT_KEY = "tasu_builder_cal_completion_draft_v1";
// 完了報告の下書きを案件IDごとに保存
```

### 1.4 Supabase read 経路

`builder-project-calendar-supabase.js`:

- `mapRowToProject(row)` — DDL snake_case → Calendar project object
- `fetchProjectsFromSupabase()` — `builder_projects` から SELECT
- **write 関数は一切なし**（read のみ）

---

## 2. Supabase 移行対象の分類

### 2.1 「Supabase へ置き換える」部分（Calendar コア機能）

| 関数 | 優先度 | 理由 |
|------|--------|------|
| `saveProject()` | **[Phase 1]** | 新規案件作成 — 最も基本的な write |
| `updateProject()` | **[Phase 1]** | 案件編集（ステータス/日程/メモ）— カレンダー操作の中心 |
| `updateSchedule()` | **[Phase 1]** | 日程変更 — カレンダー表示に直接影響 |
| `updateCompletion()` | **[Phase 2]** | 完了報告 — カレンダー詳細UIから呼ばれる |
| `writeAll()` / `readAll()` | **全体** | localStorage を Supabase に置き換える基盤 |
| `hydrateFromSupabase()` | 改修 | read は既存。write 後に再 fetch するよう改修 |

### 2.2 「残す / 二重化する」部分

| 関数 | 残す理由 | 残し方 |
|------|---------|--------|
| `ensureSeed()` / `seedDemoProjects()` | Demo fallback 用 | localStorage に残す（Supabase 未接続時のフォールバック） |
| `listProjectsLocal()` | Demo/フォールバック用 | localStorage 読み取りとして残す |
| `COMPLETION_DRAFT_KEY` | 下書きの一時保存 | localStorage に残す（未送信の下書き） |
| `normalizeProject()` 系 | 正規化ロジック | 変更なし（Supabase write 前にも使用） |
| `addTimelineEvent()` | タイムライン | Supabase の timeline jsonb カラムに統合 |
| 全 intent preview 関数 | AI プレビュー | 変更なし（preview のみのロジック） |

### 2.3 「Adapter 化する」部分

| 対象 | Adapter 名 | 責務 |
|------|-----------|------|
| localStorage ↔ Supabase のwrite切替 | `builder-project-write-adapter.js` **(新規)** | `saveToSupabase()` / `saveToLocal()` / `writeProject()` |
| Completion 専用 write | 既存 adapter に統合 | `saveCompletion()` を adapter 経由に |
| 全 intent apply 関数 | 既存 adapter に統合 | `applyIntent()` を adapter 経由に |

### 2.4 置き換え不要な部分

| 関数 | 理由 |
|------|------|
| 全 `get*()`, `list*()`, `search*()` 系 | read は既存の `listProjects()` が Supabase/localStorage 透過的に処理 |
| `preview*Intent()` 系 | プレビューのみ。write は `apply*Intent()` 側 |
| `generateProjectNotifications()` | 通知自動生成ロジック — 保存は既存通知関数経由 |
| `format*()` / `calculate*()` 系 | 純粋計算。永続化不要 |

---

## 3. 実装計画

### 3.1 全体方針

1. **段階的置き換え**: localStorage をいきなり廃止せず、**二重書き込み期間** を設ける
2. **Adapter パターン**: 新しい `builder-project-write-adapter.js` で localStorage / Supabase を切り替え
3. **Supabase mode 時のみ write 先を変更**: `dataSourceMode === "supabase"` の場合に Supabase に write
4. **既存テストは全 PASS を維持**: 新規 adapter の単体テストを追加し、既存テストは変更しない

### Phase 1 — Core Write Adapter（Safe）

**目標:** 案件の基本 CRUD を Supabase 対応にする。リスク最小。

| 項目 | 内容 |
|------|------|
| **変更ファイル** | `builder-project-write-adapter.js` **(新規)** |
| | `builder-project-store.js`（writeAll → adapter 経由に改修） |
| | `builder-project-calendar-supabase.js`（write 関数追加） |
| **影響範囲** | `saveProject()`, `updateProject()`, `updateSchedule()` |
| | `listProjects()`（Supabase mode 時に remote を参照） |
| **リスク** | 低。既存の localStorage 書き込みを維持しつつ adapter を追加 |
| **回帰対象** | P3（79→増加） / Phase2（48） / Phase3（36） |
| **DB変更** | なし（既存 DDL で INSERT/UPDATE 可能） |
| **新規テスト** | `scripts/test-builder-calendar-p4-write-adapter.mjs` |

### Phase 2 — Completion / Finance / Estimate / Invoice / Contract Write

**目標:** 案件サブリソース（完了報告/収支/見積/請求/契約）の Supabase 対応。

| 項目 | 内容 |
|------|------|
| **変更ファイル** | `builder-project-write-adapter.js`（拡張） |
| | `builder-project-store.js`（updateCompletion 等を adapter 経由に） |
| **影響範囲** | `updateCompletion()`, `updateFinance()`, `updateEstimate()`, `updateInvoice()`, `updateContract()` |
| | カレンダー詳細UIの完了報告保存 |
| **リスク** | 中。jsonb カラムのスキーマが未確定 |
| **回帰対象** | P1 Detail（45） / P2 Talk（44） / P3（増加） / Phase2 / Phase3 |
| **DB変更** | なし（既存 jsonb カラム利用） |

### Phase 3 — Document / Notification / Vision Write

**目標:** ドキュメント・通知・Vision診断の Supabase 対応。

| 項目 | 内容 |
|------|------|
| **変更ファイル** | `builder-project-write-adapter.js`（拡張） |
| | `builder-project-store.js`（persistProjectDocuments 等を adapter 経由に） |
| **影響範囲** | `addDocument()` / `updateDocument()` / `addNotification()` / `saveVisionDiagnosis()` |
| **リスク** | 低〜中。ドキュメントは jsonb 配列として attachments カラムに保存 |
| **回帰対象** | 全テスト |
| **DB変更** | なし |

### Phase 4 — localStorage 廃止判断

**目標:** Supabase が安定したら localStorage を完全廃止するか判断。

| 項目 | 内容 |
|------|------|
| **判断基準** | 全ユーザーが Supabase 接続可能 / RLS 整備 / エラーレート < 1% |
| **変更** | `writeAll()` / `readAll()` / `ensureSeed()` のローカル保存を削除 |
| **残すもの** | `COMPLETION_DRAFT_KEY`（未送信下書き）/ `seedDemoProjects()`（初回起動時） |
| **リスク** | 高。完全にネットワーク依存になる |

---

## 4. Adapter 設計案

### 4.1 アーキテクチャ

```text
Calendar UI / Store API
       │
       ▼
builder-project-store.js
  ┌─────────────────────┐
  │ writeAll(data)       │ ← 既存（localStorage）
  │ saveToStorage(data)  │ ← 新規 adapter 経由
  └─────────┬───────────┘
            │
            ▼
builder-project-write-adapter.js（新規）
  ┌─────────────────────┐
  │ writeProject(row)    │ → Supabase INSERT/UPDATE
  │ saveToLocal(data)    │ → localStorage（従来）
  │ getMode()            │ → 現在の dataSourceMode
  │ isSupabaseReady()    │ → Supabase client 接続確認
  └─────────────────────┘
```

### 4.2 Supabase write 関数シグネチャ（案）

```javascript
async function insertProject(row) {
  // Supabase INSERT → builder_projects
  // 成功: { ok: true, id: uuid }
  // 失敗: { ok: false, error: "..." }
}

async function updateProject(id, patch) {
  // Supabase UPDATE → builder_projects
  // patch は DDL カラム名 (snake_case) に変換
  // 成功: { ok: true }
  // 失敗: { ok: false, error: "..." }
}

async function upsertProject(row) {
  // INSERT on conflict(id) DO UPDATE
  // 成功: { ok: true, id }
}
```

---

## 5. リスク一覧

| # | リスク | Severity | 対策 |
|---|--------|----------|------|
| 1 | Supabase write 失敗時のデータ喪失 | **P1** | localStorage にフォールバック。二重書き込み期間を設ける |
| 2 | DDL カラム名と Store プロパティ名の不一致 | **P1** | P3 で確認済みの mapper を write にも使用 |
| 3 | オフライン時の動作不能 | **P2** | localStorage 二重化でオフラインでも編集可能 |
| 4 | RLS ポリシー未整備 | **P2** | P4 実装と並行して RLS を整備 |
| 5 | 既存テストの回帰 | **P2** | Phase ごとに全テストを実行。新規テストを追加 |
| 6 | jsonb スキーマの不整合 | **P3** | P3.7 監査レポートの jsonb スキーマ定義を先に確定 |
| 7 | calendar.js の完了報告下書き（localStorage）の統合 | **P3** | Supabase completion_report に直接保存するよう変更 |
| 8 | AI intent 適用時の冪等性 | **P3** | Supabase の UPDATE は冪等。二重適用防止は別途 |

---

## 6. 推奨実装順

```
Phase 1 [Core Write]
  ├─ 新規: builder-project-write-adapter.js
  │    ├─ isSupabaseReady()
  │    ├─ writeProject(row)     ← INSERT + UPDATE
  │    └─ saveToLocal(data)     ← localStorage（既存維持）
  ├─ 改修: builder-project-store.js
  │    ├─ saveProject() → adapter 経由
  │    ├─ updateProject() → adapter 経由
  │    └─ updateSchedule() → adapter 経由
  ├─ 改修: builder-project-calendar-supabase.js
  │    └─ writeProjectToSupabase() 追加
  └─ 新規: scripts/test-builder-calendar-p4-write-adapter.mjs
       └─ mapper 単体テスト + adapter 単体テスト

Phase 2 [Completion + Finance Sub-resources]
  ├─ 改修: builder-project-write-adapter.js（拡張）
  │    └─ writeSubResource(type, id, patch) 追加
  ├─ 改修: builder-project-store.js
  │    ├─ updateCompletion() → adapter 経由
  │    ├─ updateFinance() → adapter 経由
  │    ├─ updateEstimate() → adapter 経由
  │    ├─ updateInvoice() → adapter 経由
  │    └─ updateContract() → adapter 経由
  └─ 拡張: scripts/test-builder-calendar-p4-write-adapter.mjs

Phase 3 [Documents + Notifications + Vision]
  └─ 同様に adapter 経由に置き換え

Phase 4 [localStorage Cleanup]
  └─ 判断後、不要な localStorage コードを削除
```

---

## 7. テスト戦略

| Phase | 既存テスト | 新規テスト | 確認内容 |
|-------|-----------|-----------|---------|
| Phase 1 | 全5本（252） | `p4-write-adapter` | Adapter 単体 + mapper write 互換 |
| Phase 2 | 全5本 | 同テスト拡張 | Sub-resource write + jsonb 整合性 |
| Phase 3 | 全5本 | 同テスト拡張 | Document/Notification write |
| Phase 4 | 全5本 | localStorage 廃棄テスト | localStorage 非依存の動作確認 |

**全 Phase で以下を確認:**
- Supabase mode 時の write 成功
- localStorage 二重保存の維持
- Demo fallback の不変
- Console Error 0
- HTTP Status 200
- 全ビューポート（1280 / 768 / 390）

---

## 8. DB 変更の有無

**P4 では DDL 変更不要。** 既存の `builder_projects` 33カラムで全ての write が可能。

| 書き込み内容 | 保存先カラム |
|-------------|-------------|
| 案件基本（title/status/category） | 各 text カラム |
| 日程（schedule_start/end/phase） | `date` / `text` カラム |
| 現場住所 | `site_address` |
| 担当者・顧客 | `manager_name` / `manager_phone` / `customer_name` / `customer_contact` |
| 完了報告 | `completion_report jsonb` |
| 添付ファイル | `attachments jsonb` |
| 現場写真 | `site_photos jsonb` |
| メモ | `memo text` |
| Talk連絡先 | `talk_room_id` / `talk_thread_id` |
| タイムライン | `completion_report` 内の `timeline` として統合（将来） |
| 通知 | 未対応（P4 スコープ外） |

---

## 9. 結論

### P4 準備完了

| 観点 | 状態 |
|------|------|
| ① Write 経路の洗い出し | ✅ 全25関数を特定 |
| ② Supabase 移行対象の分類 | ✅ 置換/残存/Adapter 化を分類 |
| ③ 実装計画 | ✅ 4 Phase に分割。リスク・回帰対象まで整理 |
| ④ DDL 整合性 | ✅ 既存33カラムで全 write 対応可能（変更不要） |
| ⑤ テスト戦略 | ✅ 既存252 PASS + 新規テスト追加計画 |

**次のステップ:** Phase 1（Core Write Adapter）の実装に進めます。