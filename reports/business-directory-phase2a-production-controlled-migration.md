# Business Directory Phase 2a — Production Controlled Migration

**Status:** Completed / Historical Archive  
**Archive date of planning:** 2026-07-01  
**Production apply completed:** 2026-07-01  
**Migration:** `20260717120000` · `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql`  
**Production project ref:** `ddojquacsyqesrjhcvmn` (`tasful-ai`)

> **DO NOT RE-RUN.** This file preserves the Option B plan and the 2026-07-01 execution record for Phase 2a.  
> It is **not** the current Production apply runbook. Executable CLI / SQL apply steps have been removed from this archive.

---

## Why this document is retained

- Records the Option B decision: treat Phase 2a DDL as a **Production controlled migration**, not a “Staging-named” apply on the wrong mental model.
- Preserves human-approval, backup/PITR, abort, and post-check thinking used for that change.
- Documents that `20260717120000` was applied on Production on **2026-07-01**, with follow-on Edge deploy and smoke notes.
- Separates Phase 2a (`17120000`) from later **dependent migration** work (`15110000` / `16100000` partial), which has its own tracked apply evidence.

---

## Current authoritative references

| Role | Path |
| --- | --- |
| Current dependent-migration apply runbook | `reports/business-directory-production-controlled-apply-runbook.md` |
| Current dependent-migration apply result | `reports/business-directory-production-controlled-apply-result.md` |
| Environments (human SSOT) | `docs/supabase-environments.md` |
| Production / Staging refs (machine SSOT) | `reports/tasful-supabase-staging-project-manifest.json` |
| Phase 2a verification checklist (tracked) | `reports/business-directory-phase2a-staging-verification.md` |
| Staging operator archive (superseded) | `reports/business-directory-phase2a-staging-operator-runbook.md` |
| Apply target migration (repo) | `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql` |
| Historical view baseline (rollback concept) | `supabase/migrations/20260715110000_business_directory_content_update.sql` |

**Project refs (identifiers only — not secrets):**

| Environment | Project ref |
| --- | --- |
| Production | `ddojquacsyqesrjhcvmn` |
| Staging | `ahlxuyvhzqdqaojiywmu` |

Do not confuse Production and Staging. Resolve current refs from the tracked manifest and `docs/supabase-environments.md`.

---

## Scope

Phase 2a added SEO / FAQ / recommended-uses columns on `business_directory_profiles` and updated `business_directory_listings_public` to expose six content columns:

| column | Role in Phase 2a |
| --- | --- |
| `short_description` | Existing · included in public view |
| `full_description` | Existing · included in public view |
| `seo_title` | New |
| `meta_description` | New |
| `faq_items` | New (`jsonb`, NOT NULL default `[]`) |
| `recommended_uses` | New (`text[]`, NOT NULL default `{}`) |

**Out of scope for this archive:** Stripe changes, UI redesign, Builder Engine, and later dependent DDL covered by the tracked controlled-apply runbook/result.

---

## Historical planning context (2026-07-01)

At planning time, BD Phase 2a apply was framed as **Option B — Production controlled migration**:

- A dedicated Staging rehearsal path was still unsettled for this change set.
- Calling the work “Staging apply” while touching the only known Production-connected ref risked mislabeling a Production DB change.
- Therefore the approved path was: human Ops/DBA approval, maintenance window, backup/PITR (or dump policy), apply, SELECT verification, then Edge deploy in the same window.

**Today:** A dedicated Staging project (`ahlxuyvhzqdqaojiywmu`) exists and is documented in the tracked manifest / environments doc. That does **not** reopen this archive as an apply recipe. Staging readiness scripts are **SELECT-only verification**, not migration apply.

A contemporaneous related draft name (filename mention only, not a clone dependency) was along the lines of dependent-migrations production readiness; current dependent-migration work is documented in the tracked controlled-apply runbook/result.

---

## Historical execution methods — DO NOT RUN

**HISTORICAL — DO NOT RUN.** The following names the *kinds* of operations planned and used. Concrete copy/paste CLI blocks are intentionally omitted.

| Method (name only) | Intent then | Status now |
| --- | --- | --- |
| Confirm Dashboard / CLI project ref = Production | Avoid wrong-project apply | Concept retained; do not re-apply from this file |
| Method A — linked DB push of pending migrations | Prefer when migration history allowed | **DO NOT RUN from this archive** |
| Method B — linked SQL file apply of `20260717120000` + migration history repair | Fallback when history drifted (Step 1 precedent) | **DO NOT RUN from this archive** |
| Edge deploy of `business-directory` after DB columns exist | Prevent Edge writes against missing columns | **DO NOT RUN from this archive** |
| Local static readiness / remote SELECT verification | Preflight and post-check | Use current tracked readiness script for live checks; not an apply path |

**Mandatory historical order:** Production DB Phase 2a **before or simultaneous with** Edge that upserts Phase 2 columns. Never deploy Phase 2 Edge alone onto a DB lacking those columns.

---

## Historical safety gates and abort conditions

Human gates that applied to the 2026-07-01 window (still useful as history):

- Maintenance window + named Ops/DBA approvers
- Backup / PITR **or** documented dump policy before apply
- Confirm Phase 1–6 prerequisites present; confirm `20260717120000` not already applied (at start of that window)
- Rollback concept reviewed (see next section — not an approved live procedure)
- Abort if Dashboard ref ≠ Production, backup unconfirmed, dependencies missing, migration already applied, Edge Phase 2 already live on a column-less DB, or Product/Ops approval missing

Post-check concepts (SELECT-only): profile six columns + nullability/defaults; public view six content columns; `schema_migrations` contains `20260717120000`; smoke of AI → save → edit → publish → planGate → content_update.

---

## Historical recovery concept — not an approved rollback procedure

**Historical recovery concept; not an approved rollback procedure.**  
Down migrations were not shipped in-repo. Recovery thinking at the time included:

1. Revert Edge so it no longer upserts Phase 2 columns (same maintenance window as DB recovery).
2. Restore public view to the pre-2a shape based on `20260715110000` content_update view definition.
3. Drop only the four Phase 2a-added columns (`seo_title`, `meta_description`, `faq_items`, `recommended_uses`) — accepting **data loss** for those fields.
4. Any `schema_migrations` history adjustment only under DBA judgment (can break CLI sync).

Executable DROP / CREATE VIEW / DELETE-from-history SQL is **not** reproduced here. Do not invent or paste rollback DDL from memory against Production.

---

## Completed Production execution record (2026-07-01)

| Item | Historical result (2026-07-01) |
| --- | --- |
| Option B adopted | Yes — documented in this planning track |
| Staging-named apply | Forbidden for this change set |
| Production migration `20260717120000` | **Applied** · migration history repair completed |
| First apply attempt | Failed with PostgreSQL `42P16` (`CREATE OR REPLACE VIEW` could not insert columns) → migration revised to `DROP VIEW` + `CREATE VIEW` + `GRANT`, then re-apply succeeded |
| Backup / PITR check | Human-confirmed; free plan without PITR/auto backup → dump policy used as substitute |
| Edge deploy Phase 2 | **Completed** to Production `ddojquacsyqesrjhcvmn` (included `profileFromDraft` partial-update fix among shared modules) |
| Production Ready (commercial) | **Not Ready** at that date — migration/Edge OK, but **dependent migrations** still incomplete (see tracked controlled-apply documents) |

---

## Verification and smoke results (historical, 2026-07-01)

These numbers are **dated historical observations**, not a current readiness SLA. Re-run tracked scripts for live status.

| Check | Historical result (2026-07-01) |
| --- | --- |
| Remote readiness (`phase2a-staging-readiness.mjs --remote`) | Recorded as **20 passed, 0 failed** (re-check that day) |
| Production smoke `--skip-stripe` | Recorded as **14 pass / 6 fail / 2 note** — draft Phase2 upsert and public API Phase2 OK; AI generate / content_update / owner detail still failing in that run |
| 8788 browser notes | edit Phase2 load issues noted; public detail OK when Supabase config injected |

Later dependent-migration work and cleaner smoke/readiness outcomes are tracked under the Production controlled-apply runbook/result — not under this Phase 2a archive.

---

## Lessons / supersession record

| Date | Note |
| --- | --- |
| 2026-07-01 | Option B plan written; Production Phase 2a applied after view-replace fix; Edge Phase 2 deployed |
| 2026-07-01 | Staging project later registered in environment SSOT (`ahlxuyvhzqdqaojiywmu`) — do not read old “no Staging project” present-tense claims as current truth |
| After Phase 2a | Dependent migrations (`15110000` / `16100000`) needed controlled **partial** apply so Phase 2a public view columns would not regress |
| 2026-07-25 | This file rewritten as **Completed / Historical Archive**: personal absolute paths removed; executable Production apply/rollback command blocks removed; Staging/Production refs aligned with tracked SSOT; untracked “正本” Markdown links removed; current work pointed at tracked controlled-apply documents |

*End of archive. For live dependent-migration operations, use only the Current authoritative references section.*
