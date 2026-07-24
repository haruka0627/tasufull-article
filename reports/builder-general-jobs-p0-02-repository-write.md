# Builder General Jobs P0-02 — Repository Write / Dual-Write Report

**実施日:** 2026-07-05  
**Phase:** P0-02  
**判定:** **Go**（コード・回帰 PASS · Staging SQL 手動適用は別途）

---

## 0. Staging SQL 前提確認

```bash
node scripts/verify-builder-general-jobs-staging-schema.mjs
```

| 結果 | 状態 |
| --- | --- |
| `builder_project_applications` | **未適用**（404 PGRST205） |
| `builder_projects.spec` 等 | **未適用**（42703） |

**停止条件:** Production には適用していない（要件どおり）。  
**Staging:** P0-01 SQL は **未適用** のため、flag ON 時の live Supabase write は失敗し **MVP fallback** となる。適用後に flag ON で primary 化が有効になる。

### Staging 適用手順（人間実行）

1. Supabase Dashboard → プロジェクト `ahlxuyvhzqdqaojiywmu` → SQL Editor
2. 実行: `supabase/migrations/20260719120000_builder_general_jobs_p0_01_staging.sql`
3. 実行: `supabase/manual/staging_builder_general_jobs_p0_01_rls.sql`
4. 確認: `node scripts/verify-builder-general-jobs-staging-schema.mjs` → exit 0

---

## 1. 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `builder/builder-general-jobs-dual-write.js` | **新規** — Supabase primary + MVP mirror |
| `builder/builder.js` | 投稿 · 応募 · 選定/却下を dual-write 接続 |
| `builder/builder-config.js` | VERSION p0-02 |
| `builder/mvp-project-new.html` | dual-write script |
| `builder/mvp-post.html` | B3 + dual-write scripts |
| `builder/board-projects.html` | B3 + dual-write scripts |
| `builder/board-project-detail.html` | dual-write script |
| `scripts/test-builder-general-jobs-p0-02-repository-write.mjs` | **新規** 回帰 |
| `scripts/verify-builder-general-jobs-staging-schema.mjs` | **新規** preflight |

---

## 2. 投稿フロー

**入口:** `initMvpProjectFormPage` submit（`mvp-project-new.html` / `mvp-post.html`）

```text
submit
  → TasuBuilderGeneralJobsDualWrite.createProjectWithMirror()
       ├─ flag ON: createGeneralProject() → 成功 → MVP mirror（supabase_uuid 付与）
       ├─ flag ON: Supabase 失敗 → console.warn → MVP fallback
       └─ flag OFF: MVP mirror のみ（従来同等）
  → 通知 · redirect（既存 UI 維持）
```

**Supabase payload（primary）:**

- `owner_id` / `owner_auth_uid` = `TasuBuilderSession.resolveOwnerIdForInsert()`
- `kind` = `builder_board`
- `project_category` = `general`
- `board_type` = `project`（Calendar `tasful_managed` と分離）
- `talk_room_id` = 未設定（P0-03 以降）

---

## 3. 応募フロー

**入口:** `boardApplyToProject`（一覧 · 詳細の応募ボタン）

```text
既存バリデーション（重複 · 枠 · ステータス）
  → applyWithMirror()
       ├─ flag ON: createApplication() → 成功 → MVP applications[] mirror
       ├─ flag ON: 失敗 → MVP fallback + warn
       └─ flag OFF: MVP のみ
  → pushNotification（既存）
```

**Payload:**

- `applicant_auth_uid` = session UID
- `status` = `applied`（DB · RLS 制約）
- `payload.display_status` = `pending`（UI ラベル用）
- 重複応募チェックは **既存仕様維持**

---

## 4. 選定 / 却下フロー

**入口:** `commitBoardApplicationDecision`

```text
mutateBoardApplicationDecision + api.commit（MVP · Talk thread 生成 — 既存）
  → notifyBoardApplicationDecision（既存）
  → syncDecisionWithMirror()（非同期 · flag ON 時のみ）
       ├─ selectApplication() / rejectApplication()
       └─ 失敗時 warn · UI は既に MVP 成功済み
```

Calendar 連携 · 通知変更 · Talk Room UUID 正本化は **未着手**（スコープ外）。

---

## 5. Feature Flag 挙動

| 条件 | 挙動 |
| --- | --- |
| `TASU_BUILDER_GENERAL_JOBS_REPO` 未設定 / false | 完全従来 MVP |
| flag ON + `TASU_BUILDER_STORAGE_MODE=supabase` + client OK | Supabase primary + MVP mirror |
| flag ON + Supabase NG / schema 未適用 | MVP fallback（warn ログ） |

---

## 6. 検証結果

```bash
npm run build:pages
node scripts/test-builder-general-jobs-p0-01-repository.mjs
node scripts/test-builder-general-jobs-p0-02-repository-write.mjs
```

| スクリプト | 結果 |
| --- | --- |
| P0-01 回帰 | **PASS** |
| P0-02 新規 | **PASS** |
| Staging preflight | **未適用（記録済み）** |
| `board-project-detail` Console Error | **0** |

レポート: `reports/builder-general-jobs-p0-02/result.json`

---

## 7. P0-03 への引き継ぎ

| # | タスク |
| --- | --- |
| 1 | **Staging SQL 手動適用**（上記手順） |
| 2 | flag ON で authenticated write E2E（CAL-MAIN-16 パターン） |
| 3 | `builder_partners` seed + `partner_key` → UUID 解決 |
| 4 | Talk Room `ensureTalkRoomForGeneralProject`（選定後） |
| 5 | Hub Calendar 統合は P1 以降 |

---

## 8. Go / No-Go

| 観点 | 判定 |
| --- | --- |
| P0-02 完了条件 | **Go** |
| Live Supabase primary（Staging） | **No-Go**（SQL 未適用 · fallback 動作確認済み） |
| 商用リリース | **No-Go** |
