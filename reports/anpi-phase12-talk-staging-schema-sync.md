# ANPI Phase 12 — TALK Staging Schema Sync Preparation

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.


Date: 2026-07-27  
Verdict: **PACKAGE READY · STAGING AUTO-APPLY FORBIDDEN · Real INSERT still NO-GO**

## Scope

Phase 11 P0（`public.talk_notifications` missing on staging）を解消するための  
**human-reviewed apply package** を作成した。

実施:

1. 正本スキーマ特定
2. client contract 確認
3. production相当 RLS 抽出 + Phase 12 hardening
4. staging差分 SQL 生成
5. destructive 不在の静的証明
6. local disposable apply 検証
7. rollback SQL
8. 適用後 Phase 11 再監査手順

未実施（禁止）:

- staging / production 自動適用
- Realtime enable
- Push trigger
- ANPI real mode
- commit / push / deploy
- DROP TABLE 自動実行

## Canonical source decision (Phase 12-A)

| Priority | Source | Role |
| --- | --- | --- |
| 1 | `sql/talk-sync-schema.sql` | **DDL正本** — `talk_notifications` columns / PK / index |
| 2 | `sql/talk-rls-production.sql` | **RLS/helper正本** — `talk_current_user_id` / `talk_is_admin` / own SELECT·UPDATE |
| 3 | `sql/talk-rls-drop-dev-policies.sql` | dev `using(true)` 除去必須 |
| 4 | `supabase/functions/live-notify/index.ts` | service_role INSERT precedent |
| 5 | Phase 10 migration comments | honors talk-sync-schema facts |
| Reject | `talk-sync-schema.sql` 内 `*_dev` policies | **非正本**（open RLS） |
| Reject | `sql/talk-realtime-publication.sql` | Phase 12 で Realtime enable禁止 |
| Reject | fixture / local test CREATE TABLE | 非正本 |

**決定:** staging sync package は  
`talk-sync-schema` の **notifications DDLのみ** +  
`talk-rls-production` helper/SELECT/UPDATE パターン +  
**authenticated INSERT/DELETE なし** の hardening。

`talk_ai_drafts` / `talk_broadcast_drafts` / follow は今回のスコープ外（Phase 11 P0 は inbox table）。

## Client contract (Phase 12-B)

Source: `talk-notifications-store.js` + `talk-supabase-sync.js`

| Contract field | Client | Schema | Match |
| --- | --- | --- | --- |
| id | text id | `id text PK` | YES |
| user_id | text filter `eq(user_id)` | `user_id text NOT NULL` | YES |
| type | normalize; unknown → `system`; `anpi` allowed | `type text NOT NULL default 'system'` | YES |
| title / body | required strings | text NOT NULL default `''` | YES |
| target_url | maps `target_url`; default `#` | `target_url text NOT NULL default '#'` | YES |
| unread | `isUnread` = `!readAt` | `read_at timestamptz` nullable | YES* |
| created_at | order desc | `created_at timestamptz NOT NULL` | YES |
| Realtime filter | `user_id=eq.<uid>` | n/a (publication not enabled by package) | N/A |
| HTML | not rendered as HTML in store normalize | body is plain text column | YES |
| URL | `target_url` / href; `#` safe fallback | `#` default | YES |

\* Client contract wording `is_read` は **boolean列としては存在しない**。実装は `read_at` → `readAt`。  
これは **blockerではない**（命名差）。勝手に `is_read` 列を追加しない。

**Client upsert note:** client は authenticated upsert を行い得る。Phase 12 hardening で authenticated INSERT を禁止するため、staging では **service_role / Edge 作成が正**。client 新規 INSERT は RLS で拒否される（意図的）。UPDATE（既存在の read_at）は許可。

## Production RLS extraction (Phase 12-C)

Production SSOT policies on `talk_notifications`:

| Policy | Production | Phase 12 package |
| --- | --- | --- |
| select_own | authenticated own/admin | **kept** as `select_phase12` |
| update_own | authenticated own/admin | **kept** as `update_phase12` |
| insert_own | authenticated own | **OMITTED** (absolute: INSERT禁止) |
| insert_admin_fanout | authenticated admin | **OMITTED** |
| delete_own | authenticated own/admin | **OMITTED** (absolute: DELETE禁止優先) |
| *_dev | forbidden | **dropped if present** |

Helpers:

- `talk_current_user_id()` / `talk_is_admin()`
- `SECURITY DEFINER`
- `search_path = public`
- claims: `talk_user_id` → `member_id` → `sub` → `auth.uid()::text`

Grants in package:

- `anon`: no table privileges
- `authenticated`: `SELECT, UPDATE` only
- `service_role`: `ALL` (RLS bypass for internal writer)

## Staging diff SQL (Phase 12-D)

Created:

- `sql/anpi-phase12-talk-staging-schema-sync.sql`
- `sql/anpi-phase12-talk-staging-schema-sync-rollback.sql`

Forward package contents:

1. Idempotent helper recreate (SSOT)
2. `CREATE TABLE IF NOT EXISTS talk_notifications` (11 columns)
3. `CREATE INDEX IF NOT EXISTS talk_notifications_user_created_idx`
4. `ENABLE ROW LEVEL SECURITY`
5. Drop leftover `*_dev` + recreate Phase 12 policies
6. Least-privilege grants
7. Footer sanity SELECT
8. **No** Realtime publication / triggers / data DML

## Non-destructive proof

Static checks (`scripts/test-anpi-phase12-talk-staging-schema-sync.mjs`):

- no `DROP TABLE` / `TRUNCATE` / `DELETE FROM` / destructive `ALTER ... DROP`
- no `ALTER PUBLICATION`
- no `CREATE TRIGGER`
- `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` only for structure
- `DROP POLICY IF EXISTS` allowed (policy replace)
- authenticated INSERT/DELETE policies absent
- no `using(true)`

## Local disposable verification

Command:

```text
node scripts/verify-anpi-phase12-talk-staging-schema-local.mjs
```

Asserts on `supabase_db_tasufull-article` only:

- table/columns/PK/index/RLS
- select+update policies present
- insert/delete/dev policies = 0
- target_url default contains `#`
- owner insert + PK conflict path
- default rollback removes Phase 12 policies
- no staging/production contact

## Rollback

Default (`SECTION A`):

- drop Phase 12 policies (+ clear mistaken insert/delete/dev policies)
- **table retained**

Optional (`SECTION B`, commented):

- `DROP INDEX` / `DROP TABLE` — human only after empty/disposable confirmation

## Post-apply Phase 11 re-audit procedure

Documented in `docs/anpi-phase12-talk-staging-schema-apply.md`.

After human staging apply:

```text
node scripts/audit-anpi-phase11-talk-staging-parity.mjs
node scripts/test-anpi-phase11-talk-staging-parity.mjs
```

Even if schema P0 clears, **Staging Real INSERT remains NO-GO** until:

- identity mapping CONFIRMED
- enablement checklist complete
- Realtime/Push side effects re-reviewed
- owner/security approval

## Parity expectation after human apply

| Item | Before (Phase 11) | After package (expected) |
| --- | --- | --- |
| table | missing | present |
| columns | missing | 11 |
| PK | missing | id text |
| index | missing | user_created |
| RLS | n/a | enabled |
| insert policies | n/a | 0 |
| Realtime | not member | still not member (package) |
| Staging Real INSERT | NO-GO | still NO-GO |

## Blockers remaining after package apply

1. Identity mapping PARTIAL（`anpi_user_contexts` absent · format未確認）
2. Realtime publication product decision未決
3. Retention/cleanup policy未定義
4. Authenticated INSERT hardening vs production SSOT divergence（文書化済み · 意図的）
5. ANPI sidecar / real_dry→real enablement は別Phase

## Gates

| Gate | Verdict |
| --- | --- |
| Canonical schema identified | **PASS** |
| Client contract compatible | **PASS** (is_read naming note only) |
| Sync SQL package ready | **PASS** |
| Non-destructive proof | **PASS** (static) |
| Local apply verification | see command result |
| Staging auto-apply | **FORBIDDEN** |
| Staging Real INSERT readiness | **NO-GO** |
| Production Real INSERT | **NO-GO** |
| Realtime/Push enablement | **NO-GO** |

## Files added

- `sql/anpi-phase12-talk-staging-schema-sync.sql`
- `sql/anpi-phase12-talk-staging-schema-sync-rollback.sql`
- `docs/anpi-phase12-talk-staging-schema-apply.md`
- `scripts/verify-anpi-phase12-talk-staging-schema-local.mjs`
- `scripts/test-anpi-phase12-talk-staging-schema-sync.mjs`
- `reports/anpi-phase12-talk-staging-schema-sync.md`

## Git / safety

- commit / push / deploy: **not performed**
- staging apply: **not performed**
- production: **not contacted**
- FROZEN UI: unchanged
- Phase 2–10 migrations: unchanged
