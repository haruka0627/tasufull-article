# Business Directory Phase 2a — Staging Operator Runbook

**Status:** Superseded / Historical Archive  
**Archive date:** 2026-07-01  
**Retention:** Historical operations record only — **not** a current runbook

> **DO NOT RUN** any Phase B / migration apply / `supabase link` / `db push` / `db query` / `migration repair` / Edge deploy steps described historically below.  
> This file is retained as a dated archive of the 2026-07-01 Phase A–C *concept*, not as executable procedure.

---

## Why this document is retained

- Records the original Phase A (prep) / Phase B (human Staging apply) / Phase C (post-apply verification) plan for BD Phase 2a (`20260717120000`).
- Documents the intent to avoid Production mis-operations (wrong project link, Edge before DB columns, etc.).
- Explains why a “Staging operator apply” path was later superseded when Production controlled apply became the approved path for Phase 2a DDL.
- Points operators to **current** Staging readiness tooling and environment SSOT.

---

## Current authoritative references

Use these for **current** Staging environment identity and readiness checks:

| Role | Path |
| --- | --- |
| Staging readiness script | `scripts/test-business-directory-phase2a-staging-readiness.mjs` |
| Production / Staging project SSOT (machine) | `reports/tasful-supabase-staging-project-manifest.json` |
| Environments (human) | `docs/supabase-environments.md` |
| Post-apply / verification checklist (tracked) | `reports/business-directory-phase2a-staging-verification.md` |
| Production controlled apply evidence (tracked) | `reports/business-directory-production-controlled-apply-result.md` |
| Production controlled apply runbook (tracked) | `reports/business-directory-production-controlled-apply-runbook.md` |

**Migration file (repo):** `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql`

**Project refs (identifiers only — not secrets):**

| Environment | Project ref |
| --- | --- |
| Production | `ddojquacsyqesrjhcvmn` |
| Staging | `ahlxuyvhzqdqaojiywmu` |

Do not confuse Production and Staging. Resolve refs from the tracked manifest / `docs/supabase-environments.md`, not from memory or this archive’s old placeholders.

---

## Historical context (2026-07-01)

Around 2026-07-01, Staging separation was still unsettled in BD Phase 2a planning:

- Early drafts assumed a separate Staging apply path (this document).
- At the same time, Option B — **Production controlled migration** — was adopted as the approved apply path for Phase 2a DDL when a clean Staging rehearsal path was not yet the operational default for that change.
- A contemporaneous follow-on draft was titled along the lines of `business-directory-phase2a-production-controlled-migration` (filename mention only; **not** a current required link or clone dependency).
- Separately, a dedicated Staging project (`ahlxuyvhzqdqaojiywmu`) was registered and is now the Staging SSOT in the tracked manifest and `docs/supabase-environments.md`.

**Today:** Staging exists and is documented. This archive must **not** be read as “Staging does not exist” or as permission to run Staging-named apply against Production.

**Supersession reason:** Executable apply / link / push steps in this file were retired so operators would not copy/paste outdated Phase B commands. Current apply evidence and runbooks are the tracked Production controlled apply documents listed above; current Staging **read** verification is the readiness script + verification report.

---

## Historical Phase A summary (prep only)

Phase A was meant as **local prep** before any human DB work:

- Read migration readiness / verification docs.
- Confirm operator would not be linked to Production for Staging-named work.
- Run local static readiness only (no DB link required for Phase A as designed).

Historical prep command shape (safe — local static only; no apply):

```text
node scripts/test-business-directory-phase2a-staging-readiness.mjs
```

Run from the repository root (whatever path your clone uses). Do not hard-code machine-specific directories.

**Historical result note (2026-07-01):** A Phase A prep run was recorded as local static PASS with remote skipped. Exact pass/fail/note counts from that day are **not** a current SLA — re-run the tracked readiness script for live numbers.

Migration dependency order contemplated at the time (versions only; **do not apply from this archive**):

1. `20260711100000` — phase1 schema  
2. `20260711100001` — phase1 seed  
3. `20260712100000` — phase6 stripe subscription  
4. `20260715100000` — storage  
5. `20260715110000` — content update  
6. `20260716100000` — AI draft usage  
7. `20260717120000` — Phase 2a page content  

---

## Historical Phase B outline — DO NOT RUN

**HISTORICAL — DO NOT RUN.** The following names the *kinds* of operations that were planned for a human Ops/DBA Phase B. They are **not** current instructions and are intentionally **not** provided as copy/pasteable command blocks.

| Historical step (name only) | Intent then | Status now |
| --- | --- | --- |
| Supabase project link to a Staging ref | Point CLI at Staging | **DO NOT RUN from this doc** |
| Migration list on linked project | See applied versions | **DO NOT RUN from this doc** |
| Linked DB push of pending migrations | Apply migration chain | **DO NOT RUN from this doc** |
| Linked SQL file apply + migration repair | Fallback when history drifted | **DO NOT RUN from this doc** |
| Staging Edge deploy after DB columns | Avoid Edge writing missing columns | **DO NOT RUN from this doc** |

Any concrete CLI strings for those operations have been removed from this archive to prevent accidental execution. If apply work is required, use **current tracked** Production controlled apply runbooks / human-approved processes — not this file.

---

## Historical Phase C outline (verification concept)

Phase C was planned only **after** a completed human Phase B:

- Remote SELECT-only readiness via `test-business-directory-phase2a-staging-readiness.mjs --remote`
- Staging Edge / browser E2E per the tracked staging verification report
- Production Go / No-Go sign-off criteria (columns, view, migration history, planGate, deploy order)

**Current practice:** Prefer the tracked readiness script and `reports/business-directory-phase2a-staging-verification.md` for verification design. Do not reconstruct Phase B from this archive in order to “reach” Phase C.

---

## Production guard (current readiness script — read-only)

For `--remote` checks on the **current** readiness script:

- If `BD_PRODUCTION_PROJECT_REF` (or related env overrides documented in `docs/supabase-environments.md`) is set, that value is used for the Production ref.
- If unset, the Production / Staging refs are resolved from the **tracked** manifest `reports/tasful-supabase-staging-project-manifest.json`.
- If the CLI linked project equals Production (`ddojquacsyqesrjhcvmn`), remote verification **aborts**.
- If the linked project is neither Staging nor Production, the script may proceed with a **NOTE** (intent must be verified by the operator).
- Remote work is **SELECT-only** (schema / migration history / profile sanity). No migration apply, no DB writes, no deploy, no Stripe from this script.

Older wording that claimed “unset Production env ⇒ guard skipped” is **obsolete** now that the tracked manifest supplies refs.

---

## Safety notes

- Never treat Staging-named apply docs as safe if the CLI is linked to Production.
- Never deploy Edge that writes Phase 2a profile fields before those columns exist.
- Never paste historical Phase B operations from chat logs or old checklists into Production.
- Credentials (anon / service role / DB password / tokens) must never be committed; this archive intentionally contains none.
- Personal machine paths (e.g. user home directories) must not appear in runbooks — use repository root only.

---

## Supersession record

| Date | Change |
| --- | --- |
| 2026-07-01 | Original Staging operator Phase A/B/C draft written |
| 2026-07-01 | Option B Production controlled apply adopted for Phase 2a DDL path |
| 2026-07-01 | Staging project registered in environment SSOT (`ahlxuyvhzqdqaojiywmu`) |
| 2026-07-25 | This file rewritten as **Historical Archive**: personal absolute paths removed; executable Phase B command blocks removed; current refs / guard behavior documented; untracked “正本” Markdown links removed |

*End of archive. For live Staging readiness, use the Current authoritative references section only.*
