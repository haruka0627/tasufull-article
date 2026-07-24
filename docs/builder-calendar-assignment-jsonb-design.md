# CAL-MAIN-12：assignment jsonb + MVP 通知縮小

**作成日:** 2026-07-04  
**種別:** 調査・設計のみ（実装・Migration 適用・RLS 変更禁止）  
**前提:** CAL-MAIN-01〜11 完了（Hub-primary 作成 · local assignment dual-write · ID map）

関連:

- [builder-calendar-mvp-write-stop-design.md](./builder-calendar-mvp-write-stop-design.md)（CAL-MAIN-09）
- [builder-calendar-hub-mvp-integration-design.md](./builder-calendar-hub-mvp-integration-design.md)（CAL-MAIN-05）
- Staging RLS: `supabase/migrations/20260718000000_builder_calendar_rls.sql`

---

## 0. 結論サマリ

| 決定項目 | 提案 |
| --- | --- |
| **assignment jsonb 採用** | **採用する** — 専用カラム `builder_projects.assignment jsonb` |
| **既存 jsonb に混ぜるか** | **混ぜない**（`completion_report` / `attachments` / `memo` とは責務分離） |
| **Migration** | Staging 手動適用用 SQL を本ドキュメントに記載。**リポジトリへの migration ファイル追加・適用は別承認後** |
| **RLS** | 現状の owner-only UPDATE では **partner 受諾不可**。partner 向け **status 限定 UPDATE policy が必要**（partner 識別子の Auth 紐付けが前提） |
| **dual-write → Hub-primary write** | jsonb + Read/Write Adapter + partner RLS が Staging で通ってから |
| **MVP 通知縮小の最小単位** | **運営カレンダー手配通知**（`calendar_assignment` / 受諾・辞退通知）を Talk タブ正本に寄せ、MVP ベルへの二重 write を止める |
| **次実装** | **CAL-MAIN-13** Adapter 往復 ✅ · **CAL-MAIN-14** Staging 手動 SQL + RPC 設計 ✅ → [runbook](./builder-calendar-assignment-staging-runbook.md) |

**原則:** schema / RLS は **Staging 手動・Production 禁止**（既存 P3–P5 方針）。実装コードは Adapter 層から入り、DDL は人間が Dashboard で適用する。

---

## 1. assignment 現状整理

### 1.1 データ置き場（4 層）

| 層 | キー / 場所 | 持つ情報 | 正本性（現状） |
| --- | --- | --- | --- |
| **A. Hub local assignment** | `tasu_builder_project_hub_v1` → `project.assignment` | `status`, `partnerId`, `partnerName`, `acceptedAt`, `declinedAt`, `updatedAt`, `source` | 表示優先（CAL-MAIN-10）· **端末ローカルのみ** |
| **B. MVP project** | `tasful:builder:mvp:v1` → `projects[]` | `assignment_status`, `calendar_assigned_partner_id`, `selected_partner_ids`, `hub_project_id`, `data_role` | 受諾 write の互換正本（まだ止めない） |
| **C. Admin assignment 行** | `tasful:builder:admin:calendarAssignments:v1` | 表示マスター（houseName, reward, siteAccess, workDate, partnerId, projectId） | **表示用メタ**（報酬・入場条件） |
| **D. DB `builder_projects`** | Supabase | `selected_partner_ids uuid[]`, `status`（工程）— **assignment オブジェクト無し** | 案件本体のみ |

### 1.2 Hub local assignment 構造（現行コード）

```js
assignment: {
  status: "pending" | "accepted" | "declined",
  partnerId: string,      // 例: "demo-partner-001"（UUID ではない）
  partnerName: string,
  acceptedAt: string,     // ISO
  declinedAt: string,
  updatedAt: string,
  source: "partner_assignment" | "admin_calendar_create" | "admin_calendar_hub_primary"
}
```

- `normalizeAssignment` / `normalizeProject` で LS 永続化（`builder-project-store.js`）
- 更新は `patchProjectLocal`（Write Adapter 非経由 · RLS 非接触）
- Supabase hydrate 時は列が無いため **常に `null` に戻る**（端末間・再 hydrate で消える）

### 1.3 MVP `assignment_status` 等

| フィールド | 意味 |
| --- | --- |
| `assignment_status` | `pending` / `accepted` / `declined` |
| `calendar_assigned_partner_id` | 主担当パートナー（1 名想定） |
| `selected_partner_ids[]` | 受諾後に partnerId を追加 |
| `hub_project_id` | Hub 正本 ID（ミラー時必須 · CAL-MAIN-11） |
| `data_role` | `hub_mirror` / `mvp_primary` |

### 1.4 `admin:calendarAssignments:v1`

- 運営カレンダーの **手配カード表示**（案件名・報酬・入場条件・日程）
- `projectId` は **legacy**（`proj-cal-*` / `builder_demo_001`）
- partner-assignment の表示オーバーレイに使用（Hub URL 以外）
- **受諾状態の正本ではない**（`status: "assigned"` は手配済みフラグ）

### 1.5 partner-assignment 表示優先順位（現行）

1. Hub `project.assignment.status`（あれば）
2. Admin assignment 行の表示フィールド（legacy URL）
3. MVP `assignment_status`
4. denied / empty

### 1.6 受諾 / 辞退 write（現行）

```text
accept/decline
  → MVP commit（assignment_status 等）        … 必須・成功条件
  → writeAssignmentDecision → patchProjectLocal … best-effort
  → MVP 通知（notifyCalendarAssignmentDecision）
```

**ギャップ:** Hub local は端末間共有されない。jsonb 化の主目的はここ。

---

## 2. assignment jsonb 設計案

### 2.1 採用可否

| 案 | 内容 | 判定 |
| --- | --- | --- |
| **A. 専用カラム `assignment jsonb`** | `completion_report` と同型の拡張 | **採用** |
| B. `completion_report` にネスト | 完了と手配が混線 | 不採用 |
| C. `memo` / 自由 jsonb | 型・索引・RLS が曖昧 | 不採用 |
| D. 専用テーブル | 複数パートナー・履歴向き | **中期**（複数手配要件が出たら） |

**理由:** 運営フローは当面「1 案件・主担当 1 名」。`completion_report` と同パターンで Adapter 実装が容易。専用テーブルは過剰。

### 2.2 推奨スキーマ（JSON）

```json
{
  "status": "pending",
  "partner_id": "demo-partner-001",
  "partner_name": "デモパートナー",
  "partner_user_id": null,
  "legacy_project_id": "proj-cal-…",
  "accepted_at": null,
  "declined_at": null,
  "updated_at": "2026-07-04T10:00:00.000Z",
  "source": "admin_calendar_hub_primary",
  "display": {
    "house_name": "案件名",
    "reward": "¥980,000",
    "site_access": "B1F 搬入口から入場",
    "summary": "概要",
    "schedule_label": "…"
  }
}
```

| キー | 必須 | 説明 |
| --- | --- | --- |
| `status` | ✅ | `pending` \| `accepted` \| `declined` |
| `partner_id` | ✅（手配後） | デモ/MVP 互換の text ID |
| `partner_user_id` | 任意 | 将来 Auth UUID（RLS 用）。未紐付け時は null |
| `legacy_project_id` | 推奨 | ID map 補助 |
| `accepted_at` / `declined_at` / `updated_at` | 推奨 | ISO8601 |
| `source` | 推奨 | 書き込み経路 |
| `display` | 任意 | admin assignment 行のメタを段階的に寄せる |

**制約（アプリ層）:**

- `status` は上記 3 値のみ
- `partner_id` は text（**`selected_partner_ids uuid[]` とは別** — デモ ID が UUID でないため。uuid 列への無理な詰め込みはしない）

### 2.3 DB カラム定義

| 項目 | 値 |
| --- | --- |
| カラム名 | `assignment` |
| 型 | `jsonb null` |
| default | `null`（未手配） |
| CHECK | 任意: `(assignment is null) or (assignment ? 'status')` |

### 2.4 Index 要否

| Index | 要否 | 理由 |
| --- | --- | --- |
| `(assignment->>'status')` | **任意（後回し可）** | 一覧フィルタが増えたら |
| `(assignment->>'partner_id')` | **推奨（Staging）** | partner の「自分の案件」検索 |
| GIN on `assignment` | 不要（初期） | 過剰 |

```sql
create index if not exists builder_projects_assignment_partner_id_idx
  on public.builder_projects ((assignment->>'partner_id'));
```

### 2.5 `selected_partner_ids` との関係

| 列 | 役割（今後） |
| --- | --- |
| `assignment` jsonb | **手配状態の正本**（pending/accepted/declined + partner_id text） |
| `selected_partner_ids uuid[]` | 既存 board / 複数選定用。運営カレンダーでは **触らない or 空のまま** |
| `status` | 工程ステータス（inquiry / in_progress / …）。受諾と混同しない |

受諾時に `selected_partner_ids` へ UUID を書く必要は **現状なし**（デモ partner が UUID でない）。

---

## 3. Migration SQL 案（適用しない · 文書のみ）

> **禁止事項どおり、この SQL をリポジトリの migrations に追加したり Staging/Production に適用したりしない。**  
> 承認後に人間が Staging Dashboard で手動実行する想定のドラフト。

### 3.1 Forward（Staging）

```sql
-- DRAFT ONLY — CAL-MAIN-12 / do not apply without approval
-- Target: Staging ahlxuyvhzqdqaojiywmu only

alter table public.builder_projects
  add column if not exists assignment jsonb null;

comment on column public.builder_projects.assignment is
  'Partner assignment state (pending|accepted|declined). Local Hub assignment mirror.';

-- optional expression index for partner lookup
create index if not exists builder_projects_assignment_partner_id_idx
  on public.builder_projects ((assignment->>'partner_id'));

-- optional lightweight check
alter table public.builder_projects
  drop constraint if exists builder_projects_assignment_status_chk;

alter table public.builder_projects
  add constraint builder_projects_assignment_status_chk
  check (
    assignment is null
    or (assignment->>'status') in ('pending', 'accepted', 'declined')
  );
```

### 3.2 Rollback

```sql
-- DRAFT ONLY — rollback
alter table public.builder_projects
  drop constraint if exists builder_projects_assignment_status_chk;

drop index if exists public.builder_projects_assignment_partner_id_idx;

alter table public.builder_projects
  drop column if exists assignment;
```

### 3.3 データ移行（任意・後続）

- localStorage `assignment` → ログインユーザーの Hub 行へ backfill は **クライアント起動時の best-effort** で足りる（サーバー一括移行は不要）
- MVP `assignment_status` からの一括変換は **しない**（依頼どおり）

---

## 4. RLS 方針

### 4.1 現状（P5-2）

| 操作 | anon | authenticated |
| --- | --- | --- |
| SELECT | `visibility = public` のみ | public **または** `owner_id = auth.uid()` **または** partner_only/team_only（**割当不問で広い**） |
| INSERT | 不可 | `owner_id = auth.uid()` |
| UPDATE | 不可 | **owner のみ** |
| DELETE | 不可 | owner のみ |

**問題:**

1. **Partner は受諾/辞退を DB に書けない**（UPDATE が owner 限定）
2. `partner_only` SELECT が **全 partner_only 行を読める**可能性（割当フィルタ無し）— 本番前に要締め
3. `partner_id` が Auth UUID と未接続（`demo-partner-001`）

### 4.2 目標ポリシー（案）

| ロール | SELECT | UPDATE assignment |
| --- | --- | --- |
| **anon** | public のみ（現状維持）。**partner_only は不可** | 不可 |
| **owner** | 自案件 | 行全体（現状） |
| **partner** | `assignment.partner_id` が自分、または `assignment.partner_user_id = auth.uid()` | **`assignment` キーの status / timestamps のみ**（理想は RPC） |
| **service_role** | 全件 | 全件（Edge / 管理） |

**Partner UPDATE の現実的な二段:**

| 段 | 内容 | 前提 |
| --- | --- | --- |
| **P0（CAL-MAIN-13）** | Adapter は **owner JWT または service** では書かず、クライアントは従来どおり **local patch + MVP**。DB 書き込みは **owner 作成時の pending** と **将来 partner RPC** | schema のみ先に入れる |
| **P1** | `SECURITY DEFINER` RPC `builder_set_assignment_status(project_id, status)` が partner を検証して jsonb 更新 | `partner_user_id` または profiles マッピング表 |
| **P2** | column-level / jsonb path 制限（Postgres だけでは難しいので RPC 推奨） | — |

**Production 前の anon SELECT:**

- `visibility = 'public'` のみ許可（現状 policy で概ね満たす）
- 運営案件は `partner_only` / `private` で作成し **anon に見せない**
- `partner_only` の authenticated SELECT を「割当 partner のみ」に狭める policy を **Production チェックリストに必須化**

### 4.3 現状 RLS で足りるか

| 要件 | 足りるか |
| --- | --- |
| Owner が pending assignment を INSERT/UPDATE | ✅（行 owner） |
| Partner が accepted/declined を DB に書く | ❌ |
| Partner が自分の案件だけ読む | ❌（広すぎ） |
| anon が運営案件を読む | ⚠️ visibility 次第 |

**結論:** jsonb カラム追加だけでは partner 受諾の DB 正本化は完了しない。**RPC or partner マッピング + policy 追加が別途必要。**

---

## 5. MVP 通知縮小案

### 5.1 現状の運営カレンダー関連 write

| 経路 | 関数 | 保存先 |
| --- | --- | --- |
| 手配通知 | `sendCalendarAssignmentNotification` | `tasful:builder:mvp:notifications:v1`（+ `hubProjectId` / `hubHref`） |
| 受諾/辞退通知 | `notifyCalendarAssignmentDecision` | 同上 |
| Talk 通知 master | `talk-builder-notify-master-v1` | Talk タブ（デモシード） |
| Talk dispatch | `TasuBuilderNotifyDispatch` | 任意・薄い入口 |

ユーザー向け正本は **Talk 通知タブ**（CAL-MAIN-05）。MVP ベルは Builder 内レガシー。

### 5.2 重複

| イベント | MVP ベル | Talk タブ | Hub |
| --- | --- | --- | --- |
| 新着手配 | ✅ write | ✅ master / dispatch | payload に hub フィールドのみ |
| 受諾/辞退 | ✅ write | 部分（ops-flow デモ） | なし |

### 5.3 縮小できる write（最小単位）

**運営カレンダーの `calendar_assignment` 系 MVP 通知 write を止める（または no-op）。**

条件:

1. 同等イベントが Talk 通知（dispatch or master）で届く
2. partner-assignment への href が legacy + map で動く（現状満たす）
3. Builder 内通知ページ依存の E2E が無い、または Talk 側に寄せ済み

### 5.4 当面残すべき write

| write | 理由 |
| --- | --- |
| board 応募/選定通知 | Talk と未完全統合 |
| スレッドメッセージ通知 | MVP thread UI 依存 |
| 完了報告 MVP 通知 | thread completion 依存 |
| demo seed 通知 | E2E / デモ |

### 5.5 Hub 通知との関係

- Hub project に通知配列（`project.notifications`）はあるが **ユーザー向け正本ではない**
- 縮小先は **Talk タブ**であり、Hub `notifications[]` への寄せはしない

---

## 6. dual-write から Hub-primary write へ移る条件

すべて満たすこと:

| # | 条件 |
| --- | --- |
| 1 | Staging に `assignment jsonb` が存在し、Read/Write Adapter が往復できる |
| 2 | 運営作成時に DB 上で `assignment.status=pending` が残る（hydrate 後も） |
| 3 | 受諾/辞退が **少なくとも owner 経路または RPC** で DB に反映される |
| 4 | partner-assignment 表示が DB hydrate 後も Hub assignment を示す |
| 5 | CAL-MAIN-07/08/10/11 回帰 PASS |
| 6 | MVP `assignment_status` write を止めても受諾 UI が壊れない |

**未達のまま MVP write を止めることは禁止**（CAL-MAIN-09 と同方針）。

---

## 7. 段階移行ロードマップ

```text
[今] local assignment dual-write（CAL-MAIN-10/11）
        │
        ▼
CAL-MAIN-13  Adapter が assignment を読む/書く（列がある環境のみ）
             · patchProjectLocal 成功後、Write Adapter best-effort で jsonb
             · 列が無い / RLS 失敗でも local+MVP 成功
             · Migration ファイルは「ドラフト適用手順」のみ（自動 apply しない）
        │
        ▼
CAL-MAIN-14  Staging 手動 Migration + partner RPC 設計実装
             · anon/partner SELECT 締め
             · 受諾を RPC で DB 更新
        │
        ▼
CAL-MAIN-15  MVP 通知縮小（calendar_assignment 系）
             · Talk dispatch を唯一のユーザー通知に
        │
        ▼
CAL-MAIN-16  assignment jsonb DB 往復 preflight（P5-5 Auth）✅ Go
        │
        ▼
CAL-MAIN-17  MVP assignment_status write 停止（条件付き）✅
             · flag: TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK（default true）
             · DB write 成功 + hydrate(source=supabase) で status 一致時のみ no-op
             · 失敗時は従来どおり MVP assignment_status write · local は常に維持
        │
        ▼
CAL-MAIN-18  本線表示 Read を Hub assignment 優先（MVP は fallback）✅
             · resolveCalendarAssignmentStatus · 削除なし
        │
        ▼
CAL-MAIN-19  Hub Primary 最終監査 · 完了判定 ✅ Go
             · レポート: docs/builder-calendar-hub-primary-completion.md
```

---

## 8. CAL-MAIN-13 実装（完了）

**タイトル:** assignment の Read/Write Adapter 往復（jsonb 列がある場合のみ）+ local 維持

| 成果物 | 内容 |
| --- | --- |
| Read mapper | `mapRowToProject` が `assignment` を camelCase 化。hydrate 時 DB 優先、無ければ local 維持 |
| Write | `writeAssignment`（assignment のみ UPDATE）。`toDdlRow` には載せない（列無しで本体 write を壊さない） |
| Feature detection | `select('assignment').limit(1)` をメモ化 |
| `writeAssignmentDecision` / Hub-primary 作成 | local 後に best-effort `writeAssignment` |
| テスト | `scripts/test-builder-calendar-cal-main-13-assignment-adapter.mjs`（23 PASS） |

**やらなかった:** Migration 追加/適用、RLS 変更、MVP write 停止、partner RPC、通知縮小。

---

## 9. 承認チェックリスト

- [ ] `assignment jsonb` 専用カラム方針に合意
- [ ] Migration は Staging 手動・Production 禁止に合意
- [ ] partner 受諾の DB 書き込みは RPC 段が必要であることに合意
- [ ] MVP 通知縮小は calendar_assignment 系からに合意
- [ ] CAL-MAIN-13（Adapter 往復のみ）着手承認

---

## 10. 参照

| パス |
| --- |
| `builder/builder-partner-assignment-hub-adapter.js`（`writeAssignmentDecision`） |
| `builder/builder-project-store.js`（`normalizeAssignment`） |
| `builder/builder-admin-calendar-hub-write.js`（Hub-primary） |
| `builder/builder-project-write-adapter.js` / `builder-project-calendar-supabase.js` |
| `supabase/migrations/20260717130000_builder_calendar_projects_read.sql` |
| `supabase/migrations/20260718000000_builder_calendar_rls.sql` |
