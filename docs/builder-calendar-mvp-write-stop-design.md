# CAL-MAIN-09：MVP write 停止条件と Hub 正本化範囲

**作成日:** 2026-07-04  
**種別:** 調査・設計のみ（実装禁止）  
**前提:** CAL-MAIN-01〜08 完了（Talk Room · Realtime · ID map · partner-assignment Hub 読取 · 運営作成 dual-write）

関連正本: [builder-calendar-hub-mvp-integration-design.md](./builder-calendar-hub-mvp-integration-design.md)

> **注:** 本ファイルは **設計時点**の文書である。本文の履歴的記述（「次実装」等）は書き換えない。  
> **現在の完了状態**は [builder-calendar-hub-primary-completion.md](./builder-calendar-hub-primary-completion.md)（CAL-MAIN-19 · Hub Primary Go）を正とする。

---

## 0. 結論サマリ

| 決定項目 | 提案 |
| --- | --- |
| **MVP write を今すぐ全部止められるか** | **不可**。受諾/辞退・assignment・スレッド完了・board 応募は Hub に保存先が無い |
| **停止の最小単位（最初に切れる write）** | **運営カレンダー案件本体の MVP project 行作成を「読取ミラー」に格下げ**し、新規作成の正本を Hub のみにする（assignment / 通知は当面 MVP） |
| **先に Hub 化すべき write** | ① 運営案件作成の正本化（CAL-MAIN-08 の dual-write を Hub-primary に）② 受諾/辞退の Hub 表現 ③ 完了報告の Hub `completion_report` 寄せ |
| **当面残す MVP write** | assignment 一覧、受諾/辞退、MVP 通知、スレッドメッセージ/入退場、board 応募・選定、demo seed |
| **受諾/辞退の保存方針** | **短期:** `builder_projects` の **jsonb `assignment`**（schema 変更は別チケット承認後）。**中期:** 複数パートナーなら専用テーブル |
| **次実装** | **CAL-MAIN-10** = 受諾/辞退の Hub デュアルライト（local） | ✅ 実装済 · 次は CAL-MAIN-11 |

**原則:** 「MVP write 停止」は **一括スイッチではなく、フロー単位で切る**。運営カレンダー本線（案件作成 → 手配表示 → 受諾）から順に Hub 正本化し、board / 一般スレッドは後回し。

---

## 1. MVP write 一覧

### 1.1 ストレージキー（write 対象）

| キー | 用途 | 本線との関係 |
| --- | --- | --- |
| `tasful:builder:mvp:v1` | projects / specs / threads / applications / partners 等 | **系統 B 本体** |
| `tasful:builder:mvp:notifications:v1` | Builder 内ベル通知 | レガシー通知 |
| `tasful:builder:admin:calendarAssignments:v1` | 運営カレンダー手配行 | 手配 UI のマスター表示 |
| `tasful:builder:admin:partners:v1` | 運営パートナーマスタ | デモ/手配候補 |
| `tasful:builder:mvp:role` / `partner_id` 等 | ロール切替 | Auth 移行まで維持 |
| `tasu_builder_project_hub_v1` | Hub ミラー（系統 A） | **正本候補（local）** |
| `tasu_builder_project_id_map_v1` | legacy ↔ Hub | 移行キー（削除しない） |

入口はほぼ `mvp().commit` → `saveMvpState`（`builder.js`）。通知は `addMvpNotification` / `saveMvpNotifications`。手配は `saveAdminCalendarAssignments`。

### 1.2 運営カレンダー本線（CAL-MAIN 対象）

| # | write | 関数 / 箇所 | 書き込み内容 |
| --- | --- | --- | --- |
| W1 | **運営案件作成** | `createAdminCalendarProject` | MVP `projects[]` + `specs` + assignment 行 + 通知。**CAL-MAIN-08 で Hub も best-effort** |
| W2 | **手配 assignment** | `saveAdminCalendarAssignments` / 手配フォーム submit | `admin:calendarAssignments` |
| W3 | **パートナー割当** | `assignAdminCalendarPartner` | MVP `calendar_assigned_partner_id` / `assignment_status=pending` + 通知 |
| W4 | **受諾** | `acceptCalendarAssignment` | MVP `assignment_status=accepted` · `selected_partner_ids` · `main_thread_id` + 通知 |
| W5 | **辞退** | `declineCalendarAssignment` | MVP `assignment_status=declined` + 通知 |
| W6 | **demo seed（手配）** | `ensureAdminCalendarPartnerDemoData` | MVP projects + assignments（不足分のみ追加） |
| W7 | **運営カレンダー通知** | `sendCalendarAssignmentNotification` / `notifyCalendarAssignmentDecision` | MVP notifications（`hubProjectId` 付与済み） |

### 1.3 スレッド / 完了（運営フロー隣接）

| # | write | 関数 / 箇所 | 書き込み内容 |
| --- | --- | --- | --- |
| W8 | スレッドメッセージ | `sendMvpThreadMessage` | MVP `threads[].messages` |
| W9 | 入退場 | `markMvpThreadEnterLeave` 系 | MVP thread events / siteData |
| W10 | 完了報告提出 | `submitThreadCompletionReport` | MVP `threads[].completion_submission` |
| W11 | 完了承認 / 差し戻し | `approveThreadCompletionReport` / `rejectThreadCompletionReport` | MVP thread + project status |
| W12 | 現場写真 | site photo / `applySiteDataToThread` | MVP thread.siteData |

※ Hub 側は Calendar 詳細から `updateCompletion` / Talk システムメッセージ（CAL-MAIN-03）が別系統で存在。

### 1.4 Board / 一般案件（本線外だが同一 MVP キー）

| # | write | 内容 |
| --- | --- | --- |
| W13 | 案件投稿 | board / re-request フォーム → MVP projects |
| W14 | 応募 | applications[] |
| W15 | 選定 / 却下 | selected_partner_ids + applications status |
| W16 | 運営 dispatch | threads events + 通知 |
| W17 | パートナー登録 | partners[] |
| W18 | 各種 demo seed | `ensureMvpNotificationsDemoData` 等 |

**CAL-MAIN-09 の「MVP write 停止」スコープは W1–W7（運営カレンダー本線）を第一優先とする。** W8–W18 は別フェーズ（board / Talk 一本化）。

### 1.5 Hub 側の既存 write（参考）

| API | 保存先 | 用途 |
| --- | --- | --- |
| `saveProject` / `updateProject` | `tasu_builder_project_hub_v1` + Write Adapter → `builder_projects` | 案件本体・日程・ステータス |
| `updateCompletion` | 同上 `completion_report` jsonb | Calendar 完了 |
| `patchProjectLocal` | Hub LS のみ | Talk Room ID 昇格 |
| `linkIds` | `tasu_builder_project_id_map_v1` | ID 対応 |

Hub に **無い**もの: `assignment_status`、パートナー別手配行、MVP 通知ストア、スレッドメッセージ本体。

---

## 2. Hub 代替可否表

| ID | write | Hub 代替 | 分類 | 理由 / 前提 |
| --- | --- | --- | --- | --- |
| W1 | 運営案件作成（project 行） | **可能（ほぼ）** | **すぐ Hub 化可能** | CAL-MAIN-08 で dual-write 済み。次は Hub-primary + MVP ミラー縮小 |
| W2 | assignment 行 | 不可（現状） | **追加設計必要** | Hub に手配行モデル無し。jsonb or テーブル要 |
| W3 | パートナー割当 | 一部 | **追加設計必要** | `selected_partner_ids` は DB にあるが text/uuid 型と partner_id 体系が不一致 |
| W4 | 受諾 | 不可（現状） | **追加設計必要** | 下記 §3 |
| W5 | 辞退 | 不可（現状） | **追加設計必要** | 下記 §3 |
| W6 | demo seed | 部分 | **当面 MVP 維持** | ID map + Hub seed で段階統合（§4） |
| W7 | MVP 通知 | 部分 | **当面 MVP 維持** | Talk 通知がユーザー正本。MVP ベルはレガシー |
| W8–W12 | スレッド/完了 | 部分 | **追加設計必要** | メッセージは Talk Room。完了は Hub `completion_report` に寄せ可能だが thread UI 依存 |
| W13–W18 | board 等 | 別レーン | **当面 MVP 維持** | 運営カレンダー本線と分離 |

### 分類定義

| 分類 | 意味 |
| --- | --- |
| **すぐ Hub 化可能** | 既存 Hub API / カラムで足りる。schema 変更なしで実装可 |
| **Hub化に追加設計が必要** | jsonb / 列 / テーブル / RLS / partner ID 体系の設計が先 |
| **当面 MVP write 維持** | 停止すると E2E・デモ・他画面が即死。後続フェーズ |

---

## 3. 受諾 / 辞退の保存設計案

### 3.1 現状（MVP）

| 項目 | 保存場所 |
| --- | --- |
| 受諾/辞退フラグ | MVP `projects[].assignment_status`（`pending` / `accepted` / `declined`） |
| 担当パートナー | `calendar_assigned_partner_id` · `selected_partner_ids[]` |
| 手配メタ（表示用） | `admin:calendarAssignments`（houseName, reward, siteAccess 等） |
| スレッド | 受諾時 `main_thread_id`（ensureCalendarRequestThread） |
| 通知 | MVP notifications +（将来）Talk |

`acceptCalendarAssignment` / `declineCalendarAssignment` は **legacy `project_id` で MVP 行を更新**するのみ。Hub は読まない・書かない。

### 3.2 Hub 側の現状

| 項目 | 有無 |
| --- | --- |
| `builder_projects.status` | あり（inquiry / estimating / …）— **手配受諾とは意味が違う** |
| `selected_partner_ids uuid[]` | あり — **デモ partner_id（`demo-partner-001`）は UUID ではない** |
| `assignment_status` | **無し** |
| パートナー別複数手配 | **無し** |
| RLS で「自分に割当られた案件だけ」 | **未整備**（Staging は読取検証中心） |

### 3.3 設計案（推奨順）

#### 案 A — jsonb `assignment`（推奨・短期）

`builder_projects.assignment` jsonb（**schema 変更は別承認チケット**）:

```json
{
  "status": "pending|accepted|declined",
  "partner_id": "demo-partner-001",
  "partner_ids": ["demo-partner-001"],
  "assigned_at": "ISO",
  "decided_at": "ISO",
  "legacy_project_id": "proj-cal-…",
  "display": {
    "house_name": "…",
    "reward": "…",
    "site_access": "…"
  }
}
```

| 利点 | 欠点 |
| --- | --- |
| 1 案件 1 主担当の運営フローに十分 | 複数パートナー同時手配は弱い |
| Write Adapter 拡張で local + Supabase に載せられる | Migration / RLS が必要（Production は手動） |
| partner-assignment 読取アダプタがそのまま使える | `partner_id` を text のまま持つか Auth UUID に寄せるか要決定 |

**RLS 論点:**

- Partner は `assignment.partner_id = auth の partner 識別子` の行のみ UPDATE 可（status のみ）
- Owner / ops は自案件の assignment を UPDATE 可
- 現状 Staging の public SELECT 前提は **本番前に必ず締め**（既存 P3–P5 方針どおり）

#### 案 B — 専用テーブル `builder_project_assignments`

| 利点 | 欠点 |
| --- | --- |
| 複数パートナー・履歴・監査に強い | 設計・RLS・UI 変更が大きい |
| 正規化しやすい | CAL-MAIN の最小停止には重い |

**中期（複数手配がプロダクト要件になった時点）で案 B へ昇格。**

#### 案 C — local Hub Store のみ先行（schema なし）

`tasu_builder_project_hub_v1` の project に `assignment` フィールドを **normalizeProject で保持**（現状は strip されるため拡張が必要）。Supabase にはまだ書かない。

| 利点 | 欠点 |
| --- | --- |
| Migration 不要で受諾/辞退 dual-write を試せる | 端末間・本番同期なし |
| CAL-MAIN-10 の最小実装向き | 結局 schema が必要 |

**提案:** CAL-MAIN-10 は **案 C（local Hub）で受諾/辞退 dual-write** → 安定後に **案 A（jsonb + Migration 別チケット）**。

### 3.4 受諾時の Talk Room

- Hub は既に `talk_room_id`（CAL-MAIN-02）
- MVP 受諾は別途 `ensureCalendarRequestThread`（legacy thread）
- **統合方針:** 受諾成功後は **Hub `talk_room_id` の chat-detail のみ**（mvp-thread リダイレクトは現状維持可）

---

## 4. demo seed 統合案

### 4.1 対応表

| MVP / legacy | Hub（local demo） | Hub（Supabase seed） | ID map |
| --- | --- | --- | --- |
| `builder_demo_001` | `PRJ-2026-001` | `a0000000-…0001` | ✅ 済み（CAL-MAIN-06） |
| `demo-project-001` | `PRJ-2026-002` | `a0000000-…0002` | ✅ |
| `pub-board-project-001` | `PRJ-2026-003` | `a0000000-…0003` | ✅ |
| `builder_thread_demo_001` | talkRoom（昇格後 UUID / local-room） | — | talkRoom マップ |
| `partner-cal-demo-a/b` 等 | **無し** | **無し** | 未マップ — **legacy seed として残す** |
| 運営作成 `proj-cal-*` | `PRJ-ADMIN-*` | （Write Adapter 経由） | 実行時 linkIds |

### 4.2 方針

| 種別 | 方針 |
| --- | --- |
| **ID map で吸収** | `builder_demo_001` ↔ Hub。タイトル差は assignment オーバーレイで吸収（現状どおり） |
| **Hub へ寄せる** | 運営フローの「新着案件」デモは Hub `PRJ-2026-001` + assignment display を正とする |
| **legacy に残す** | `partner-cal-demo-*`（パートナー別カレンダー一覧デモ）、board 系 `demo-project-001` の board UI 専用データ |
| **二重シード注意** | Supabase UUID と `PRJ-2026-*` は別名。map で同一 legacy に寄せ済み。**新規は UUID / PRJ-ADMIN のみ** |

### 4.3 統合ステップ（実装時）

1. `ensureAdminCalendarPartnerDemoData` が Hub に `PRJ-2026-001` が無ければ `saveProject` で保証（MVP project 行は任意）
2. assignment 行の `projectId` は当面 legacy のまま（URL 互換）
3. Talk 通知 master の `OPS_PROJECT_ID` は legacy 維持（既存 E2E）
4. MVP project 行の demo は **読取フォールバック用**に残し、write はしない方向へ

---

## 5. MVP write 停止ロードマップ

```text
[今] CAL-MAIN-08
  運営作成 = MVP write + Hub best-effort
  受諾/辞退 = MVP only
  assignment = MVP only

     │
     ▼
CAL-MAIN-10  受諾/辞退 Hub dual-write（local assignment フィールド） ✅
  · accept/decline が Hub も更新
  · partner-assignment 表示は Hub assignment 優先
  · MVP write はまだ残す（ロールバック容易）

     │
     ▼
CAL-MAIN-11  運営作成 Hub-primary ✅
  · createAdminCalendarProject の正本を Hub
  · MVP project 行は互換ミラー（data_role=hub_mirror）
  · assignment / 通知はまだ MVP

     │
     ▼
CAL-MAIN-12  assignment jsonb（schema 別承認）+ 通知 Talk 一本化
  · MVP assignment write 停止
  · MVP 通知 write 縮小

     │
     ▼
CAL-MAIN-13+  スレッド/完了/board
  · W8–W18
  · MVP キー削除は Production 安定後（M6）
```

### 5.1 停止の最小単位（最初の「止められる」単位）

**「新規運営案件の MVP `projects[]` への必須 write」を止めること。**

条件（すべて満たすこと）:

1. 受諾/辞退が Hub（少なくとも local Hub Store）に書ける（CAL-MAIN-10）
2. partner-assignment が Hub assignment だけで受諾 UI を描画できる
3. 既存 E2E（ops notify → partner-assignment）が legacy URL + map で PASS
4. Hub 作成失敗時のユーザー向けエラー方針が決まっている（現在は MVP 成功で握りつぶし）

**今の時点では条件 1 未達のため、MVP project write は停止しない。**

### 5.2 先に Hub 化すべき write（優先順）

| 順 | write | 狙い |
| --- | --- | --- |
| 1 | 受諾 / 辞退（W4/W5） | 手配フローの状態正本を Hub に |
| 2 | 運営作成の Hub-primary（W1） | dual-write の主従逆転 |
| 3 | assignment display の Hub 寄せ（W2 の一部） | jsonb.display |
| 4 | 完了報告（W10/W11 → Hub completion） | Calendar と一本化 |

### 5.3 当面残すべき MVP write

| write | 理由 |
| --- | --- |
| assignment 行（W2） | 一覧・複数デモ・報酬/入場条件のマスター |
| MVP 通知（W7） | Builder 内ベル・既存テスト |
| demo seed（W6） | partner-cal-demo-* 等 |
| スレッド/入退場/写真（W8–W12） | Talk Room 完全移行前 |
| board / 応募 / 選定（W13–W18） | 別プロダクトレーン |

---

## 6. CAL-MAIN-10 実装（完了）

**タイトル:** 受諾 / 辞退の Hub dual-write（local assignment）

| 成果物 | 内容 |
| --- | --- |
| Hub project の `assignment` フィールド | `normalizeProject` で保持（LS）。Supabase 列は **作らない** |
| `writeAssignmentDecision` | `builder-partner-assignment-hub-adapter.js` · `patchProjectLocal` |
| `acceptCalendarAssignment` / `declineCalendarAssignment` | MVP commit 後に Hub best-effort |
| partner-assignment 読取 | Hub `assignment.status` 優先 |
| テスト | `scripts/test-builder-calendar-cal-main-10-assignment-dual-write.mjs`（25 PASS） |

**やらなかった:** MVP write 停止、schema/Migration/RLS、MVP キー削除。

**依存・ブロッカー:**

- partner_id が UUID でない（デモ ID）→ local では text のまま可
- Production `builder_projects` 未適用 → local / Staging のみ検証
- AD-008 UI 凍結 → データ層のみ

---

## 7. リスク

| # | リスク | 緩和 |
| --- | --- | --- |
| R1 | 受諾が MVP のみだと端末間でズレる | CAL-MAIN-10 dual-write → 後で jsonb |
| R2 | schema を急ぐと凍結基盤（P3–P5）と衝突 | local 先行、Migration は別承認 |
| R3 | MVP write を早すぎる停止 | 条件チェックリスト（§5.1） |
| R4 | demo タイトル差（店舗内装 vs 世田谷） | assignment display オーバーレイ維持 |
| R5 | 無限ループ（assignments-changed） | CAL-MAIN-08 で demo seed 比較を修正済み。新規 write でもイベント再入に注意 |

---

## 8. 承認チェックリスト（実装前）

- [ ] MVP write 停止は **一括ではなくフロー単位**で進めることに合意
- [ ] 受諾/辞退は **local Hub assignment → 後で jsonb** の二段で合意
- [ ] schema / Migration は CAL-MAIN-10 に含めないことに合意
- [ ] CAL-MAIN-10（受諾/辞退 dual-write）着手承認
- [ ] board / スレッド write は本線外として後回しに合意

---

## 9. 参照

| 文書 / コード |
| --- |
| [builder-calendar-hub-mvp-integration-design.md](./builder-calendar-hub-mvp-integration-design.md) |
| `builder/builder.js`（`createAdminCalendarProject` · `acceptCalendarAssignment` · `saveAdminCalendarAssignments`） |
| `builder/builder-admin-calendar-hub-write.js` · `builder-partner-assignment-hub-adapter.js` · `builder-project-id-map.js` |
| `builder/builder-project-store.js`（`saveProject` · `updateCompletion`） |
| `supabase/migrations/20260717130000_builder_calendar_projects_read.sql` |
