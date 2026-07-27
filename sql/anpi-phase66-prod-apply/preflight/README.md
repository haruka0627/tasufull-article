# Preflight + Phase 2 verify splits (SELECT only)

Supabase SQL Editor shows **only the last Result**. Run **one file per execution**.

## Pre-APPLY (before Phase 2)

| Order | File |
|------:|------|
| 1 | `preflight/01-ref-confirm-readonly.sql` |
| 2 | `preflight/02-phase2-collision-readonly.sql` |
| 3 | `preflight/03-gen-random-uuid-readonly.sql` |
| 4 | `preflight/04-extensions-readonly.sql` |
| 5 | `preflight/05-anpi-inventory-readonly.sql` |
| 6 | `00-legacy-guard-readonly.sql` |

Index pointer: `00-preflight-readonly.sql`

## Post-APPLY Phase 2 verify (only after human GO + APPLY — currently APPLY forbidden)

| Order | File |
|------:|------|
| 1–12 | `verify-phase2/01-…` through `12-legacy-guard-readonly.sql` |

Index pointer: `verify-after-phase2.sql`

**Forbidden here:** APPLY packages · Phase 3+ · Phase 65 · Worker · Cron · Canary
