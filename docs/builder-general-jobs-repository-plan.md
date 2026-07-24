# Builder General Jobs — Repository / Auth / RLS Plan

**Phase:** P0-01 (B3 Phase 1 foundation)  
**Status:** Go — 土台実装完了 · Staging migration は手動適用待ち  
**Related:** [builder-general-jobs-commercial-readiness-report.md](../reports/builder-general-jobs-commercial-readiness-report.md)

---

## 1. 現状（P0-01 完了時点）

| 項目 | 状態 |
| --- | --- |
| 一般案件 UI/Talk | Production Ready · FROZEN（MVP localStorage 正本） |
| Hub Calendar | CAL-MAIN-19 Go · `builder_projects` Staging 適用済み |
| Repository 層 | **P0-01 スケルトン実装** · デフォルト `mvp_local` |
| UI 差し替え | **未接続**（`initMvpProjectFormPage` は従来どおり MVP） |
| Staging DDL | migration + RLS manual SQL 作成済み · **手動適用待ち** |

---

## 2. DB 設計 — 共用方針

### `builder_projects` は Calendar と一般案件で共用

| 区分 | `kind` | 主なカラム |
| --- | --- | --- |
| 運営/Calendar | `tasful_managed` | schedule_* · assignment jsonb · talk_room_id |
| 一般案件 | `builder_board` | spec jsonb · project_category · board_type |

**P0-01 追加カラム（Staging migration）:**

- `spec jsonb` — trade_tags · area_codes · period · description
- `project_category text`
- `board_type text` — `project` \| `worker`

### `builder_project_applications`（新規）

| カラム | 用途 |
| --- | --- |
| `applicant_auth_uid text` | RLS 正本（`auth.uid()::text`） |
| `partner_id uuid` | `builder_partners` FK（nullable） |
| `partner_key text` | MVP 互換 `demo-partner-001` |
| `status` | `applied` \| `selected` \| `rejected` |
| `payload jsonb` | 応募メモ・連絡先等 |

**採用状態の正本:** `builder_project_applications.status='selected'`（`selected_partner_ids` はキャッシュ扱い）

### 適用対象

| ファイル | 環境 |
| --- | --- |
| `supabase/migrations/20260719120000_builder_general_jobs_p0_01_staging.sql` | **Staging のみ** |
| `supabase/manual/staging_builder_general_jobs_p0_01_rls.sql` | **Staging のみ** |
| Production | **適用禁止**（P0-07 で別 runbook） |

---

## 3. Auth / owner_id 方針

### 投稿者 `owner_id`

- **Supabase 正本:** `auth.uid()::text`（P5 Calendar / CAL-MAIN-16 準拠）
- **Staging E2E UID:** `bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40`
- **local fallback:** `TasuBuilderSession.resolveOwnerIdForInsert()` → session → demo UID → `demo-owner-001`

### 応募者 `applicant_auth_uid`

- **Supabase 正本:** `auth.uid()::text`（応募者本人）
- **partner 解決:** `partner_key`（legacy）または `partner_id`（UUID）
- **local fallback:** `demo-applicant:{partner_key}` または Staging UID

### worker / partner と user の関係

| ロール | MVP | Supabase（将来） |
| --- | --- | --- |
| 一般ユーザー投稿 | `owner` role · `state.owner_id` | `owner_id = auth.uid()` |
| 協力会社応募 | `partner_id` 文字列 | `applicant_auth_uid` + `partner_key` / `partner_id` |
| ワーカー相談 | worker search lane | `builder_workers.owner_auth_uid`（P0-02 seed） |

### demo / anonymous

- `TASU_BUILDER_STORAGE_MODE=local`（既定）→ Repository は **常に local**
- `TASU_BUILDER_GENERAL_JOBS_REPO=true` + Supabase session 必須で Supabase 経路
- 本番ホストでは `builder-actor-identity.js` が JWT のみ（localStorage role 禁止）

---

## 4. RLS 方針（Staging manual）

### `builder_projects`（既存 + 補強）

- authenticated INSERT/UPDATE: `owner_id = auth.uid()::text`（20260718000000）
- 一般案件 public 一覧: `kind=builder_board` AND visibility public/partner_only

### `builder_project_applications`（新規）

| 操作 | 許可 |
| --- | --- |
| INSERT | authenticated · `applicant_auth_uid = auth.uid()` · status=applied |
| SELECT | 応募者本人 OR 案件 owner |
| UPDATE | 案件 owner（選定/却下） |

---

## 5. Repository 設計

### ファサード

| モジュール | グローバル |
| --- | --- |
| Project | `TasuBuilderProjectRepository` |
| Application | `TasuBuilderApplicationRepository` |

### ルーティング

```text
TasuBuilderConfig.isGeneralJobsRepositoryEnabled()
  ├─ true  + TasuSupabase client → TasuBuilderRepositoriesSupabase
  └─ false / no client            → TasuBuilderRepositoriesLocal (MVP fallback)
```

### メソッド一覧

**Project:** `createGeneralProject` · `listGeneralProjects` · `getGeneralProjectById` · `updateGeneralProjectStatus` · `ensureTalkRoomForGeneralProject`

**Application:** `createApplication` · `listApplicationsByProject` · `listApplicationsByUser` · `updateApplicationStatus` · `selectApplication` · `rejectApplication`

### MVP 差し替えポイント（P0-02）

| 現行 | 関数 | P0-02 接続 |
| --- | --- | --- |
| 投稿 submit | `initMvpProjectFormPage` L13031 | `ProjectRepository.createGeneralProject` + MVP ミラー |
| 応募 | `boardApplyToProject` L11552 | `ApplicationRepository.createApplication` |
| 選定/却下 | `commitBoardApplicationDecision` L11496 | `selectApplication` / `rejectApplication` |

---

## 6. 実装ファイル

| ファイル | 役割 |
| --- | --- |
| `builder/builder-general-mapper.js` | MVP ↔ DDL payload |
| `builder/builder-config.js` | storage mode · flags |
| `builder/builder-session.js` | auth uid 解決 |
| `builder/builder-repository.js` | ok/fail · pickBackend |
| `builder/builder-repositories-local.js` | MVP fallback CRUD |
| `builder/builder-repositories-supabase.js` | Supabase CRUD |
| `builder/builder-project-repository.js` | Project ファサード |
| `builder/builder-application-repository.js` | Application ファサード |
| `builder/builder-data-provider.js` | getter 公開 |
| `builder/builder-b3-init.js` | `__TASU_BUILDER_B3_READY__` |

**HTML 読込（参照実装）:** `mvp-project-new.html` · `board-project-detail.html`

---

## 7. 検証

```bash
npm run build:pages
node scripts/test-builder-general-jobs-p0-01-repository.mjs
```

成果物: `reports/builder-general-jobs-p0-01/result.json`

---

## 8. P0-02 引き継ぎ

1. Staging に migration + RLS manual SQL を適用
2. `TASU_BUILDER_STORAGE_MODE=supabase` + `TASU_BUILDER_GENERAL_JOBS_REPO=true` をビルド/環境で有効化
3. `initMvpProjectFormPage` / `boardApplyToProject` を Repository デュアルライト
4. `builder_partners` seed + partner_key → UUID 解決
5. Authenticated write E2E（CAL-MAIN-16 パターン流用）

---

## 9. Go / No-Go

| 判定 | **Go** |
| --- | --- |
| DB 差分 | migration SQL 作成済み |
| Repository | ファサード + local/supabase 実装 |
| Auth 方針 | owner_id / applicant_auth_uid 定義済み |
| RLS | Staging manual SQL 作成済み |
| 回帰 | `test-builder-general-jobs-p0-01-repository.mjs` PASS |
| 本番 | **No-Go**（Staging migration 未適用 · UI 未接続） |
