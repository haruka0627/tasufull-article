# ANPI Phase 12 — Human-reviewed Staging Schema Apply Procedure

> Historical phase result. Superseded by Phase 18 for current operational status. Do not use as current operational status.

**Status:** PACKAGE READY · **AUTO-APPLY FORBIDDEN**  
**Staging ref (only):** `ahlxuyvhzqdqaojiywmu` (`tasful-staging`)  
**Production ref (deny):** `ddojquacsyqesrjhcvmn`

## Absolute rules

- DO NOT auto-apply from agents/CI without human approval
- DO NOT apply to production
- DO NOT `db push` / deploy / git push / commit as part of this Phase
- DO NOT enable Realtime publication
- DO NOT create Push triggers
- DO NOT enable ANPI real mode / feature flags
- DO NOT run destructive DDL (`DROP TABLE` / `TRUNCATE` / data `DELETE` / data `UPDATE`)

## Package files

| File | Role |
| --- | --- |
| `sql/anpi-phase12-talk-staging-schema-sync.sql` | Forward sync (review then apply) |
| `sql/anpi-phase12-talk-staging-schema-sync-rollback.sql` | Default policy rollback |
| `scripts/verify-anpi-phase12-talk-staging-schema-local.mjs` | Local disposable verification |
| `scripts/test-anpi-phase12-talk-staging-schema-sync.mjs` | Static non-destructive proof |
| `reports/anpi-phase12-talk-staging-schema-sync.md` | Full audit / matrix / gates |
| `scripts/audit-anpi-phase11-talk-staging-parity.mjs` | Post-apply re-audit |

## Pre-apply checklist (human)

1. Confirm linked project is staging:
   - `Get-Content supabase/.temp/project-ref` → `ahlxuyvhzqdqaojiywmu`
   - `npx supabase projects list` shows linked ◁ on `tasful-staging`
2. Confirm `.env.staging` `SUPABASE_PROJECT_REF=ahlxuyvhzqdqaojiywmu`
3. Confirm production deny: ref ≠ `ddojquacsyqesrjhcvmn`
4. Read `sql/anpi-phase12-talk-staging-schema-sync.sql` end-to-end
5. Confirm intentional hardening vs production RLS:
   - authenticated **SELECT** own/admin: yes
   - authenticated **UPDATE** own/admin: yes (read_at / reconcile)
   - authenticated **INSERT**: **none** (service_role only)
   - authenticated **DELETE**: **none**
   - no `*_dev` / `using(true)` policies
   - no Realtime publication change
6. Confirm local verification already **PASS**:
   - `node scripts/test-anpi-phase12-talk-staging-schema-sync.mjs`
   - `node scripts/verify-anpi-phase12-talk-staging-schema-local.mjs`
7. Owner + security approval recorded outside git if required

## Apply steps (human only · staging)

```powershell
# 1) Safety gate
$ref = (Get-Content supabase\.temp\project-ref -Raw).Trim()
if ($ref -ne 'ahlxuyvhzqdqaojiywmu') { throw "BLOCKED: not staging" }
if ($ref -eq 'ddojquacsyqesrjhcvmn') { throw "BLOCKED: production" }

# 2) Apply package (Management API / linked)
npx supabase db query --linked -f sql/anpi-phase12-talk-staging-schema-sync.sql
```

Expected sanity row (from SQL footer):

- `table_exists = true`
- `column_count = 11`
- `rls_enabled = true`
- `leftover_dev_policies = 0`
- `insert_policies = 0`
- `realtime_membership = 0` (this package must not add publication)

## Post-apply: Phase 11 re-audit (mandatory)

```powershell
node scripts/audit-anpi-phase11-talk-staging-parity.mjs
node scripts/test-anpi-phase11-talk-staging-parity.mjs
```

Pass criteria after apply (minimum):

- `talk_notifications_exists = true`
- columns / PK / index present
- RLS enabled
- no `*_dev` policies
- insert policy count = 0 (Phase 12 hardening)
- Staging Real INSERT remains **NO-GO** until identity mapping CONFIRMED + enablement checklist complete

## Rollback (human)

Default (policies only):

```powershell
npx supabase db query --linked -f sql/anpi-phase12-talk-staging-schema-sync-rollback.sql
```

Full table teardown is **SECTION B** in the rollback file (commented).  
Uncomment only after confirming staging-only + empty/disposable rows.

## What this Phase does NOT greenlight

- Staging Real INSERT readiness GO
- Production Real INSERT
- Realtime / Push enablement
- ANPI `real` mode
- Client/schema contract changes
