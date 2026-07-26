# ANPI Phase 16 — Realtime / Retention / Enablement Gate

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.


Date: 2026-07-27  
Final verdict: **Phase 16 PASS · Real INSERT NO-GO · Realtime KEEP_DISABLED · Push NO-GO · Production NO-GO**

## 1. Conclusion

```text
Phase 16: PASS
Real INSERT: NO-GO
Realtime: KEEP_DISABLED
Push: NO-GO
Production: NO-GO
```

## 2. Git start / end state

### Start snapshot (16-A)

| Item | Value |
| --- | --- |
| HEAD | `ebf44989c576b69746b12876402be2b731234a70` |
| staged | **0** |
| tracked dirty | large pre-existing working tree (Builder/AI/dist/etc.) — **not modified this Phase** |
| untracked | includes prior ANPI Phase 12–15 packages + new Phase 16 |
| Linked ref | `ahlxuyvhzqdqaojiywmu` (`tasful-staging`) |
| Production deny proof | linked ≠ `ddojquacsyqesrjhcvmn`; projects list shows ◁ on tasful-staging |
| `.env.staging` | `SUPABASE_PROJECT_REF=ahlxuyvhzqdqaojiywmu` |

### Phase 15 artifacts present

- `sql/anpi-phase15-talk-identity-mapping-foundation.sql`
- `sql/anpi-phase15-talk-identity-mapping-seed.sql`
- `docs/anpi-phase15-talk-identity-mapping-apply.md`
- `reports/anpi-phase15-talk-identity-mapping-foundation.md`

### This Phase touched (only)

```text
sql/anpi-phase16-*.sql
docs/anpi-phase16-*.md
reports/anpi-phase16-*.md
reports/_anpi-phase16-enablement/**
scripts/test-anpi-phase16-notification-retention.mjs
scripts/verify-anpi-phase16-notification-retention-local.mjs
scripts/verify-anpi-phase16-enablement.mjs
```

### Untouched by design

App writers/readers, Push, Edge Functions, TALK UI, publication, mapping rows, auth.users, Phase 15 seed data, unrelated dirty files.

### Commit / push / deploy

**not performed**

## 3. Realtime audit (16-B) — no changes

| Item | Result |
| --- | --- |
| publication | **PASS** — `supabase_realtime` exists |
| table registration | **NO** — `talk_notifications` not in publication (`public_tables_in_publication=[]`) |
| currently Realtime enabled for inbox | **NO** |
| change needed this Phase | **NO** |
| replica identity | **DEFAULT** + PK present |
| REPLICA IDENTITY FULL | **not required for INSERT-only notification delivery** (DEFAULT emits full INSERT row; FULL only needed for old-row UPDATE/DELETE payloads) |
| RLS compatibility | **PASS** — SELECT `user_id = talk_current_user_id()` (not auth.uid()); authenticated INSERT=false; anon SELECT=false; service_role writer |
| Realtime+RLS design | Supabase Realtime applies table RLS to postgres_changes for authenticated JWT; filter `user_id=eq.<claim>` must match SELECT policy identity |
| event scope (design) | Prefer **INSERT only**; client today uses `event: '*'` — change deferred (audit only) |
| recommendation | **KEEP_DISABLED** |

### Realtime vs Polling

| Item | Realtime | Polling / Refresh |
| --- | --- | --- |
| immediacy | high | medium |
| complexity | higher (pub + filter + reconnect) | lower (existing pull) |
| failure points | publication, RLS filter mismatch | fetch errors only |
| RLS dependency | strong | same SELECT path |
| initial-release safety | lower until INSERT proven | **higher** |
| ops cost | higher | lower |

**Can enable later:** YES (READY_WITH_CHANGES if choosing enable path: add publication + tighten client to INSERT-only + confirm filter uses talk_user_id).  
**Should enable for first Real INSERT:** **NO** → **KEEP_DISABLED**.

## 4. Retention design (16-C) — Phase 14 SSOT

| Class | Retain | Purge? | Protection |
| --- | ---: | --- | --- |
| Read (`read_at` not null) | **90 days** | YES | age cutoff |
| Unread | **indefinite** | NO | never eligible |
| retry / hold / incident | n/a (no columns) | NO | excluded via unread never-purge |
| mapping rows | n/a | NO | purge never touches `anpi_user_contexts` |
| failed/invalid (no schema) | — | NO | not inventing columns |

No large schema expansion this Phase. Future hold flag = separate design if product requires purge of old unread.

## 5. Purge verification (16-D/E/F/J/L)

| Check | Result |
| --- | --- |
| static | **10/10 PASS** |
| local apply / reapply | **PASS** |
| idempotency | **PASS** (0,0 on re-run) |
| target-only deletion | **PASS** (unread + recent retained) |
| batch limit | **PASS** (batch=2) |
| unauthorized execute | **PASS** (anon/authenticated false) |
| rollback + restore | **PASS** |
| staging dry-run | **PASS** — deleted=0 · eligible=0 |
| staging deleted rows | **0** (no live purge) |
| index | partial `talk_notifications_purge_read_created_idx (created_at,id) WHERE read_at IS NOT NULL` |
| EXPLAIN (local tiny table) | Seq Scan acceptable at n≈7; index ready for growth |
| scheduler | **disabled** — manual service_role; pg_cron absent on staging |

## 6. Enablement checklist (16-G/H)

```text
PASS: 29
FAIL: 0
BLOCKED: 0
NOT_APPLICABLE: 0
NOT_TESTED: 5
FINAL: NO-GO
```

NOT_TESTED (intentional): Realtime enable approval · client INSERT-only scope · feature flag · emergency disable · scheduler enabled.

## 7. Phase re-audit (16-M)

```text
Phase 14 privilege: PASS (authenticated INSERT=false · anon none)
Phase 15 identity: PASS
Mapping rows: 4 approved_phase15
Reader/writer parity: PASS (mismatches=0)
Identity mismatches: 0
Inbox rows: 0
P0: 0
P1: 1 — Realtime publication not joined (KEEP_DISABLED)
P2: 1 — (purge RPC implemented; prior purge-missing P2 cleared; remaining: RLS not FORCED / ops items)
```

## 8. Artifacts

- `sql/anpi-phase16-notification-retention-purge.sql`
- `sql/anpi-phase16-notification-retention-rollback.sql`
- `sql/anpi-phase16-notification-retention-scheduler-disabled.sql`
- `docs/anpi-phase16-realtime-retention-enablement.md`
- `docs/anpi-phase16-real-insert-enablement-checklist.md`
- `reports/anpi-phase16-realtime-retention-enablement.md`
- `scripts/test-anpi-phase16-notification-retention.mjs`
- `scripts/verify-anpi-phase16-notification-retention-local.mjs`
- `scripts/verify-anpi-phase16-enablement.mjs`
- `reports/_anpi-phase16-enablement/` (audit/apply/postcheck/enablement JSON)

Checksum (purge SQL): `SHA256=88ec1822ab12a8e0a391de526643dcfb33ac3f5c96599ec4f0041e672011f2b6`

## 9. Remaining blockers (Real INSERT order)

1. Close checklist NOT_TESTED for first controlled test (test user, payload, owner, emergency disable)
2. Confirm staging has Phase 10 write-path RPCs (or approved alternate writer) — **NOT_TESTED**
3. Decide whether first INSERT uses **polling only** (recommended) vs Realtime enable package
4. If Realtime later: publication add (separate reviewed SQL) + client `event: INSERT` + filter=talk_user_id proof
5. Live purge (`p_dry_run=false`) only after eligible review when inbox grows
6. Explicit human GO on enablement checklist

## Safety confirmation

- Real INSERT: **not executed**
- Realtime: **not enabled** / publication **unchanged**
- Push: **not sent**
- Production: **not contacted**
- Mapping / Phase 15 seed: **unchanged** (4 rows)
- Staging notification DELETE: **0 rows**
