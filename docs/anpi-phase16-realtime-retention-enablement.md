# ANPI Phase 16 — Realtime / Retention / Enablement Runbook

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.

**Status:** PACKAGE APPLIED (purge function + index) · **Real INSERT NO-GO** · **Realtime KEEP_DISABLED**  
**Staging ref only:** `ahlxuyvhzqdqaojiywmu`  
**Production deny:** `ddojquacsyqesrjhcvmn`

## Prerequisites

- Phase 14 privilege hardening applied
- Phase 15 identity schema + 4 approved mapping rows
- Linked CLI project = staging
- Local static + local purge verification PASS

## Staging confirmation

```powershell
$ref = (Get-Content supabase\.temp\project-ref -Raw).Trim()
if ($ref -ne 'ahlxuyvhzqdqaojiywmu') { throw 'BLOCKED: not staging' }
if ($ref -eq 'ddojquacsyqesrjhcvmn') { throw 'BLOCKED: production' }
```

## Apply order

1. `sql/anpi-phase16-notification-retention-purge.sql` (BEGIN/COMMIT wrapper OK)
2. Dry-run: `select * from anpi_phase16_purge_expired_talk_notifications(500, true);`
3. Verify privileges / Phase 15 maps / inbox unchanged
4. Do **not** run with `p_dry_run=false` while inbox/eligible review incomplete
5. Do **not** run scheduler SQL (`…-scheduler-disabled.sql` is documentation only)

## Verification SQL (expected)

- `purge_fn_exists = true`
- `purge_index = 1`
- `anon_ex = false`, `auth_ex = false`, `svc_ex = true`
- `auth_insert = false`, `anon_select = false`
- `phase15_maps = 4`
- `inbox` unchanged (staging currently 0)
- `realtime_reg = 0`
- dry-run `deleted_count = 0`

## Rollback order

1. `sql/anpi-phase16-notification-retention-rollback.sql`
2. Confirm function/index gone
3. Confirm Phase 15 maps + inbox unchanged

## Prohibited operations (this Phase and until enablement GO)

- Real notification INSERT
- Realtime publication add/remove
- Push send
- Production apply / deploy
- Mapping row mutation
- Live purge (`p_dry_run=false`) without separate reviewed approval
- commit / push / deploy as part of Phase 16 automation

## Realtime decision (audit only)

**KEEP_DISABLED** for initial Real INSERT window.

Rationale: publication exists but `talk_notifications` is **not** registered; client still uses `event: '*'`; polling/fetch already works; enabling Realtime increases RLS/filter coupling before first controlled INSERT proof.

## Retention decision (SSOT = Phase 14)

| Class | Retain | Purge |
| --- | ---: | --- |
| Read (`read_at` set) | 90 days | YES (batch) |
| Unread | indefinite | NO |
| hold/retry/incident columns | n/a (absent) | excluded via unread never-purge |

## Expected Phase 16 outcome

```text
Real INSERT: NO-GO
Realtime: KEEP_DISABLED
Push: NO-GO
Production: NO-GO
```
