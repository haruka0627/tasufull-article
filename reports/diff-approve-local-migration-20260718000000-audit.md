# Diff & Approve — Local-only Migration `20260718000000` Audit

**Audit date:** 2026-07-28  
**Starting HEAD:** `b7cc5618ead33673d7c6bcc2eccc3555b3f6b6d3`  
**Branch:** `cf-pages-deploy`  
**Scope:** Identity audit only — no SQL apply, no repair, no schema/code change, no Production, no push.

---

# Verdict

```text
IDENTITY_CONFIRMED
HISTORY_CLASS: LOCAL_ONLY + UNTRACKED_WORKING_TREE
SCHEMA_CLASS: PARTIALLY_PRESENT
RECOMMENDED_ACTION: REQUIRES_MANUAL_REVIEW
```

This version is **Builder Calendar P5-2 RLS** for Staging `builder_projects`. It is **not** a Diff & Approve artifact. It sits on disk as an **untracked** migration file, appears in `supabase migration list` as **local-only**, and has **never been committed** to any git branch.

---

# Migration File

| Field | Value |
| --- | --- |
| Path | `supabase/migrations/20260718000000_builder_calendar_rls.sql` |
| Exists on disk | **YES** |
| Size | 3174 bytes |
| Filesystem created | 2026-07-04 15:45:53 (local) |
| Filesystem modified | 2026-07-04 15:46:01 (local) |
| Git tracked | **NO** (`??` untracked) |
| Present in `HEAD` | **NO** (`exists on disk, but not in 'HEAD'`) |
| Present in any commit (`git log --all`) | **NO** |

Header intent (from file):

- Purpose: Staging Supabase `builder_projects` production-style RLS
- Target: Staging `ahlxuyvhzqdqaojiywmu` **only**
- Explicit: Production apply forbidden in this file
- Design source: `builder/builder-calendar-p5-1-rls-design.md`

Objects defined (policies only; no tables/RPC):

| Action | Policy names |
| --- | --- |
| DROP (temp P3.8) | `builder_projects_select_anon_p38`, `builder_projects_select_auth_p38` |
| CREATE SELECT | `builder_projects_select_anon`, `builder_projects_select_auth` |
| CREATE INSERT/UPDATE/DELETE | `builder_projects_insert_auth`, `builder_projects_update_auth`, `builder_projects_delete_auth` |

---

# Git History

| Question | Finding |
| --- | --- |
| Which branch introduced it? | **None.** Not in any commit; working-tree only under current checkout `cf-pages-deploy`. |
| `git log --follow` / `git blame` | Empty / fatal — path not in `HEAD`. |
| Author / commit | **N/A** (never committed). |
| Rename / merge origin | **None found.** |
| When added to disk | **2026-07-04** (filesystem + design docs dated 2026-07-04). |
| Attempted commit context | 2026-07-25 dirty-tree commit plan **Commit 14** listed this file among 9 “production migrations”; sibling Talk/TLV/BD files were later committed (`e4d207b`), while **this file and `20260717130000_builder_calendar_projects_read.sql` remained untracked**. |

Committed references to the **filename** (docs only; SQL not in git):

- `builder/builder-calendar-p5-1-rls-design.md`
- `builder/builder-calendar-p4-phase4-localStorage-deprecation-report.md`
- `docs/builder-calendar-assignment-jsonb-design.md`
- `docs/builder-calendar-assignment-staging-runbook.md`
- `docs/builder-general-jobs-repository-plan.md`

Near-equivalent **Production manual** (also untracked):

- `supabase/manual/production_builder_calendar_rls.sql` (`??`)
- Same five policy names; different header / SHA256 (not byte-identical)

---

# Purpose

Builder Calendar **P5-2**: replace temporary P3.8 read policies (`*_p38`) with owner-scoped authenticated write + public/visibility-aware SELECT on `public.builder_projects`.

Not related to Diff & Approve / Apply Plan / Decision Write.

---

# Current Schema

```text
SCHEMA_STATUS: PARTIALLY_PRESENT
```

| Evidence | Result |
| --- | --- |
| Live `pg_policies` / information_schema query this phase | **NOT PERFORMED** (SQL execution forbidden) |
| Staging MCP | Unavailable in this session |
| Doc claim | `docs/builder-calendar-assignment-staging-runbook.md` describes **現行 Staging policy** `builder_projects_select_anon` and lists this file as 現行 RLS |
| Behavioral | `reports/builder-general-jobs-p0-03-authenticated-write-e2e.md` — RLS deny on foreign `owner_id` insert **PASS** (implies owner-scoped INSERT policy exists on Staging) |
| Later untracked migration comment | `20260719120000_…` notes `builder_projects` RLS already set by `20260718000000` |

Interpretation: schema **effects consistent with this migration are likely present on Staging**, but this audit **does not** assert a live `pg_policies` inventory. Hence **PARTIALLY_PRESENT** (documented + behavioral), not live-proven **SCHEMA_PRESENT**.

No RPC / new table / grants are defined by this file (policies only).

---

# Current Migration History

Linked Staging project (CLI list, read-only): `ahlxuyvhzqdqaojiywmu`

| Version | Local file | Remote `schema_migrations` |
| --- | --- | --- |
| `20260718000000` | Present on disk | **MISSING** |

Diff & Approve versions relevant to prior work remain aligned (context only):

| Version | Local | Remote |
| --- | --- | --- |
| `20260728140000` | Yes | Yes |
| `20260728160000` | Yes | Yes |
| `20260728180000` | Yes | Yes |

Other local-only / untracked neighbors exist (out of scope; listed for context only), e.g. `20260717130000`, `20260719120000`, `20260705120000`.

---

# Local History

```text
LOCAL_HISTORY: FILE_PRESENT + UNTRACKED
CLI_LOCAL_SLOT: YES (supabase migration list shows Local column)
GIT_HISTORY: ABSENT
```

---

# Remote History

```text
REMOTE_HISTORY: ABSENT for 20260718000000
CLASSIFICATION: LOCAL_ONLY
```

Not `REMOTE_ONLY`. Not `ALIGNED`. Not formally `SUPERSEDED` by a later tracked migration that redefines the same policies.

Production delivery path uses a **separate manual SQL** file rather than this migration version — that is a **process supersession for Production apply**, not a migration-history supersession of `20260718000000`.

---

# Is Schema Already Applied?

| Claim | Confidence |
| --- | --- |
| Remote history row for `20260718000000` | **No** |
| Equivalent RLS behavior on Staging | **Likely yes** (docs + E2E), not live-proven this phase |
| Applied via official `migration up` / recorded version | **No evidence** |
| Applied via Dashboard / `db query` / manual SQL outside history | **Plausible / intended by design doc** (“Dashboard SQL Editor で手動実行”) |

⑦ Past `db query` of **this exact version into schema_migrations**: **No** (remote blank).  
⑦ Past application of **equivalent SQL content** outside history: **Likely**, unproven by live SQL here.

---

# Is Repair Required?

```text
REPAIR_REQUIRED_NOW: NO
```

Reasons:

- This audit phase forbids repair.
- Diff & Approve Staging history for `2026072814/16/180000` is already aligned; this file is unrelated noise in the CLI list.
- `migration repair --status applied` would only be appropriate **after** live confirmation that the five policies match, and after deciding whether an **untracked** file should enter the official migration set at all.
- Naive repair without committing/tracking the file leaves operators with history pointing at SQL that is not in git.

---

# Is Migration Obsolete?

```text
OBSOLETE: NO
```

- Still cited as Staging Calendar RLS SSOT path in committed docs.
- Content still matches the intended P5-2 policy model.
- Production uses a parallel manual file; that does **not** make the Staging migration content obsolete.
- Completely unnecessary for **Diff & Approve** runtime: **yes (orthogonal)** — but not “safe to discard as dead SQL” without Calendar/Builder owner review.

---

# Ten Required Determinations

| # | Question | Answer |
| --- | --- | --- |
| ① | Migration file exists? | **YES** (disk) |
| ② | Which branch? | **None committed** — untracked working tree on `cf-pages-deploy` |
| ③ | When added? | **2026-07-04** (filesystem + design); never git-added |
| ④ | Currently referenced? | **YES** (committed docs + sibling staging SQL comments) |
| ⑤ | Production target? | **NO** (file forbids Production; Production uses `supabase/manual/production_builder_calendar_rls.sql`) |
| ⑥ | Staging target? | **YES** (`ahlxuyvhzqdqaojiywmu`) |
| ⑦ | Past db query / history apply of this version? | **History: NO.** Equivalent SQL outside history: **likely / unproven live** |
| ⑧ | Schema already reflected? | **PARTIALLY_PRESENT** (doc + E2E; no live SQL this phase) |
| ⑨ | Remote history only missing? | **LOCAL_ONLY**, and stronger: **untracked + history absent**; not a simple “committed migration missing remote row” case |
| ⑩ | Completely unnecessary? | **Not obsolete** as Calendar RLS SQL; **orthogonal** to Diff & Approve |

---

# Recommended Action

```text
REQUIRES_MANUAL_REVIEW
```

**Why not the others:**

| Option | Why rejected |
| --- | --- |
| `NO_ACTION_REQUIRED` | Acceptable only as “Diff & Approve ignore”; still leaves CLI local-only drift and untracked SSOT SQL — needs an owner decision. |
| `SAFE_TO_REPAIR` | Live policy inventory not verified this phase; file not in git; repair alone is premature. |
| `SAFE_TO_DELETE_LOCAL` | Would erase the only on-disk Staging RLS migration SSOT while docs still point here; risk if Staging ever needs re-apply / audit. |

**Manual review should decide one of:**

1. Live-verify `pg_policies` on Staging → if match → optionally commit file + history-only repair **as a Builder Calendar task** (not Diff & Approve).  
2. Move SQL to `supabase/manual/` (Staging manual) and remove from `migrations/` to clear CLI drift.  
3. Keep dirty/untracked intentionally and document as known local-only (explicit ignore policy).

---

# Risk

| Risk | Level | Note |
| --- | --- | --- |
| Accidental `db push` / migrate applying untracked local-only set | Medium | Multiple local-only neighbors; push forbidden in Diff & Approve work |
| Repair without live verify | Medium | Could mark applied while policies differ |
| Delete local without replacement | Medium | Loses SSOT SQL referenced by docs |
| Production confusion | Low | File header forbids Production; manual Production path exists separately |
| Diff & Approve regression | None | Orthogonal domain |

---

# Production Status

```text
Production: NOT TOUCHED
Production project: NOT SELECTED
Production schema: NOT QUERIED
Production migration history: NOT MODIFIED
```

---

# Final Conclusion

`20260718000000` is an **untracked Builder Calendar Staging RLS migration** created ~2026-07-04, never committed, absent from remote `schema_migrations`, and only visible to the CLI because the file remains under `supabase/migrations/`. Equivalent Staging RLS behavior is **documented/behaviorally indicated** but was **not live-verified** in this audit. Diff & Approve does not depend on it. No repair, delete, SQL, or schema change was performed.

```text
Production was not touched.
No SQL was executed.
No migration repair was executed.
No schema was modified.
No push was performed.
```
