# Builder General Jobs P0-01 — Repository / Auth / RLS Foundation

**実施日:** 2026-07-05  
**Phase:** B3 Phase 1 / P0-01  
**判定:** **Go**（P0-02 着手可能 · Staging migration 手動適用は別タスク）

---

## サマリ

一般案件の Supabase 化に向け、**DDL 差分 · RLS 案 · Repository スケルトン · Auth 方針** を確定し、最小実装を landing した。UI（投稿/応募）は **未差し替え** — デフォルトは従来どおり MVP localStorage 正本。

| 成果 | 状態 |
| --- | --- |
| Staging migration SQL | ✅ 作成 |
| Staging RLS manual SQL | ✅ 作成 |
| Repository ファサード + local/supabase | ✅ 実装 |
| Mapper（payload 形） | ✅ 実装 |
| Auth UID 解決 | ✅ `builder-session.js` |
| 単体 + ブラウザ smoke | ✅ PASS |
| Production 適用 | ❌ 禁止（意図どおり） |

---

## 1. 既存 DDL との差分

### 共用: `builder_projects`

Calendar migration（`20260717130000`）済みテーブルに **一般案件用 3 カラム** を追加:

| カラム | 型 | 用途 |
| --- | --- | --- |
| `spec` | jsonb | MVP `specs{}` 相当 |
| `project_category` | text | UI カテゴリ |
| `board_type` | text | `project` \| `worker` |

`kind=builder_board` で一般案件 · `tasful_managed` で Calendar — **テーブル共用可**。

### 新規テーブル

| テーブル | P0-01 | 備考 |
| --- | --- | --- |
| `builder_project_applications` | ✅ DDL | `applicant_auth_uid` が RLS 核心 |
| `builder_partners` | ✅ 最小 DDL | 応募 FK · 検索 seed 前提 |
| `builder_workers` | ✅ 最小 DDL | P0-02 seed 前提 |
| `builder_contact_reveals` | ✅ DDL のみ | Phase 12 課金 · 今回未接続 |

### 設計 DDL（`sql/builder-schema.sql`）との差分

| 項目 | 設計 | P0-01 migration |
| --- | --- | --- |
| applications.partner_id | NOT NULL FK | **nullable** + `partner_key` + `applicant_auth_uid` |
| applications 一意制約 | (project_id, partner_id) | (project_id, applicant_auth_uid) |
| owner_id 型 | text | 維持 · `auth.uid()::text` |
| partners.owner_auth_uid | なし | **追加**（将来プロフィール owner 紐付け） |

---

## 2. owner_id / applicant_id 関係整理

```text
投稿:
  MVP: state.owner_id (demo-owner-001 等)
  Supabase: owner_id = auth.uid()::text
  Staging E2E: bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40

応募:
  MVP: applications[].partner_id (文字列)
  Supabase:
    applicant_auth_uid = auth.uid()::text  ← RLS 正本
    partner_key = demo-partner-001         ← MVP 互換
    partner_id = uuid                      ← builder_partners 解決後（P0-02）

選定/却下:
  MVP: status selected/rejected + selected_partner_ids[]
  Supabase: applications.status 更新（owner RLS）
```

---

## 3. Repository 実装サマリ

### ルーティング

- `TASU_BUILDER_GENERAL_JOBS_REPO !== true` → **mvp_local**（既定）
- flag on + `TasuSupabase.getClient()` → **supabase**

### 検証済み payload

**createGeneralProject:**

```json
{
  "owner_id": "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40",
  "kind": "builder_board",
  "title": "...",
  "spec": { "trade_tags": [], "area_codes": [], "period": {}, "description": "" },
  "board_type": "project",
  "visibility": "public",
  "source": "public_user"
}
```

**createApplication:**

```json
{
  "project_id": "<uuid>",
  "applicant_auth_uid": "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40",
  "partner_key": "demo-partner-001",
  "status": "applied"
}
```

---

## 4. MVP fallback 方針

| 層 | 動作 |
| --- | --- |
| `builder.js` | **変更なし** — `mvp().commit()` が正本 |
| Repository local | `tasful:builder:b3:general:*` LS + 同一 payload 形 |
| P0-02 | デュアルライト（Supabase primary · MVP mirror） |

---

## 5. 適用手順（Staging · 人間実行）

```text
1. Supabase Dashboard (ahlxuyvhzqdqaojiywmu) SQL Editor
2. 20260719120000_builder_general_jobs_p0_01_staging.sql
3. staging_builder_general_jobs_p0_01_rls.sql
4. 確認クエリ（migration 末尾コメント参照）
```

**Production:** 適用しない。

---

## 6. テスト結果

```bash
node scripts/test-builder-general-jobs-p0-01-repository.mjs
```

| チェック | 結果 |
| --- | --- |
| Mapper owner_id / applicant_auth_uid | PASS |
| Default routing mvp_local | PASS |
| Local create/list/apply | PASS |
| Supabase routing when flag+client | PASS |
| mvp-project-new HTTP 200 + B3 ready | PASS（dev 起動時） |
| Console Error | 0 |

レポート: `reports/builder-general-jobs-p0-01/result.json`

---

## 7. 意図的に未実装（スコープ外）

- 投稿フォーム完全差し替え
- 応募フロー完全差し替え
- Stripe / ¥550 / 手数料
- Worker/業者 Talk CTA
- Production migration

---

## 8. P0-02 への引き継ぎ

| # | タスク |
| --- | --- |
| 1 | Staging migration + RLS 手動適用 |
| 2 | `initMvpProjectFormPage` デュアルライト |
| 3 | `boardApplyToProject` / `commitBoardApplicationDecision` 接続 |
| 4 | `builder_partners` seed + partner UUID 解決 |
| 5 | Authenticated write E2E（P5-5 / CAL-MAIN-16 パターン） |

---

## 9. Go / No-Go

| 観点 | 判定 |
| --- | --- |
| P0-01 完了条件 | **Go** |
| 商用リリース | **No-Go**（データ層 Staging 未適用 · UI 未接続） |
| P0-02 着手 | **Go** |

正本設計: [docs/builder-general-jobs-repository-plan.md](../docs/builder-general-jobs-repository-plan.md)
