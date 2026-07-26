# ANPI Phase 15 — TALK Identity Namespace Mapping Foundation

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.


Date: 2026-07-27  
Final verdict: **Schema+Seed APPLIED · Reader/Writer Parity PASS (7/7) · Real INSERT NO-GO**

## Scope

Phase 14 で確定した reader/writer identity mismatch を解消するため、
`anpi_user_contexts` を TALK recipient 解決の正規 mapping source として staging に整備した。

実施:

1. identity namespace 正本確認
2. `anpi_user_contexts` schema 設計・適用
3. staging 既存ユーザー mapping 候補生成（redacted）
4. human-review package
5. local disposable DB 検証
6. staging schema + seed apply（tx）
7. mapping dry-run 検証
8. reader/writer parity 監査

未実施（禁止）:

- talk_notifications INSERT / Real INSERT
- Realtime / Push / Production / commit / push / deploy
- ANPI real mode
- client 変更 / schema 再設計（inbox）

## 1) Identity namespace 正本

| Layer | Source | Namespace |
| --- | --- | --- |
| Reader | `talk_current_user_id()` | JWT `talk_user_id` → `member_id` → `sub`/uid |
| Writer | `anpi_resolve_talk_user_id(uuid)` | `anpi_user_contexts.member_id` where `anpi_user_id` = uid text · else uid |
| Inbox | `talk_notifications.user_id` | text · must equal reader claim |

**Adopted chain:**

```text
auth.users.id
  → anpi_user_contexts.auth_user_id
  → anpi_user_contexts.talk_user_id
  → talk_notifications.user_id

Phase 10 mirrors (unchanged contract):
  anpi_user_id = auth_user_id::text
  member_id    = talk_user_id
```

Phase 10 migration hash: **unchanged** (`4fc078ea58672410`).

## 2) Schema design

Lean table compatible with Phase 10 resolver + Phase 15 canonical columns:

- `auth_user_id uuid UNIQUE` · `talk_user_id text NOT NULL`
- `anpi_user_id text UNIQUE` · `member_id text` (= talk_user_id)
- CHECK: `anpi_user_id = auth_user_id::text` · `member_id = talk_user_id`
- RLS: select own only · **no** authenticated INSERT/UPDATE/DELETE · **no** `*_dev`
- Grants: authenticated SELECT only · service_role ALL · anon none
- Function: `anpi_resolve_talk_user_id(uuid)` SECURITY DEFINER · service_role EXECUTE only

LINE OAuth columns omitted（mapping foundation 範囲）。legacy `user_id` 等の最小列は維持。

## 3) Mapping candidates（staging · catalog）

| Class | Count | Action |
| --- | --- | --- |
| candidate_map | 4 | APPROVE_MAP auth→talk_user_id |
| no_claim_uid_ok | 3 | NO_ROW (uid fallback OK) |
| claim_equals_uid | 0 | — |

Claim format: **alpha-prefix 4 / UUID 0**. Writer-without-mapping mismatch: 4.

## 4–5) Package + local verification

| Check | Result |
| --- | --- |
| Static | **9/9 PASS** |
| Local disposable | **PASS** (resolver map + fallback · rollback · no notif INSERT) |

## 6) Staging apply

| Step | Result |
| --- | --- |
| Preflight | table absent · resolve fn absent · 7 users · 4 claims |
| Schema tx | **PASS** — table=true · cols=18 · RLS=on · resolve=true · insert_policies=0 · rows=0 |
| Seed tx | **PASS** — seeded=4 · expected=4 · writer_matches_claim=4 · no_claim_fallback_ok=3 |
| Rollback used | **No** |

## 7–8) Dry-run parity + foundation audit

| Metric | Result |
| --- | --- |
| mapping_rows | 4 |
| writer_equals_reader_claim | **7/7** |
| remaining_mismatches | **0** |
| inbox_rows | **0** (no notification INSERT) |
| realtime_membership | 0 |
| talk triggers | 0 |
| Phase 11 re-audit | P0=0 · **P1=1** · P2=2 · Real INSERT **NO-GO** |

P1 残: Realtime publication 未加入（意図的）。identity P1（contexts absent）は解消。

## Gates

| Gate | Verdict |
| --- | --- |
| Canonical namespace confirmed | **PASS** |
| Schema foundation | **APPLIED / PASS** |
| Mapping candidates reviewed | **PASS** (4 APPROVE · redacted) |
| Seed applied | **PASS** |
| Reader/writer parity (dry-run) | **PASS 7/7** |
| Notification INSERT | **not executed** |
| Staging Real INSERT readiness | **NO-GO** (Realtime/retention/enablement checklist remain) |
| Production Real INSERT | **NO-GO** |
| Realtime / Push enablement | **NO-GO / unchanged** |

## Remaining blockers (Real INSERT 前)

1. Realtime publication 製品判断
2. Retention purge package 実装（Phase 14 で方針確定済み）
3. Enablement checklist（owner/security 承認）
4. Phase 10 full write-path functions（local migration）の staging 有無は別確認 — 本 Phase は identity foundation のみ

## Files

- `sql/anpi-phase15-talk-identity-mapping-foundation.sql`
- `sql/anpi-phase15-talk-identity-mapping-seed.sql`
- `sql/anpi-phase15-talk-identity-mapping-rollback.sql`
- `docs/anpi-phase15-talk-identity-mapping-apply.md`
- `scripts/test-anpi-phase15-talk-identity-mapping.mjs`
- `scripts/verify-anpi-phase15-talk-identity-mapping-local.mjs`
- `reports/anpi-phase15-talk-identity-mapping-foundation.md`
- `reports/_anpi-phase15-identity/`

## Git / safety

- commit / push / deploy: **not performed**
- production: **not contacted**
- Real INSERT / notification rows: **not created**
- Realtime / Push / ANPI real mode: **not enabled**
