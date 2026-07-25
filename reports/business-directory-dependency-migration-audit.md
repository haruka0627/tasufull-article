# Business Directory — Dependency Migration Audit

**Status:** Completed / Historical Archive  
**Archive date of audit:** 2026-07-01  
**Production apply completed:** 2026-07-01  
**Migrations audited (historical):** `20260715110000` · `20260716100000`  
**Production project ref:** `ddojquacsyqesrjhcvmn` (`tasful-ai`)

> **DO NOT RE-RUN.** This file preserves the **2026-07-01 dependency migration audit** that explained why `15110000` and `16100000` were required after Phase 2a (`17120000`) was already on Production.  
> It is a **historical audit record only**. It is **not** the current Production apply runbook and **not** an executable procedure.  
> Executable CLI, remote apply steps, and copy/paste smoke commands have been removed from this archive.

**Apply result (authoritative):** [business-directory-production-controlled-apply-result.md](./business-directory-production-controlled-apply-result.md)  
**Current apply runbook (authoritative):** [business-directory-production-controlled-apply-runbook.md](./business-directory-production-controlled-apply-runbook.md)  
**Related readiness archive:** [business-directory-dependent-migrations-production-readiness.md](./business-directory-dependent-migrations-production-readiness.md)

> **Historical outcome (2026-07-01, fixed):** Dependent migrations applied under the controlled-apply path · DB Production Ready Go · Commercial Launch Conditional · Rollback not required

---

## Why this document is retained

- Records the object-level inventory for `15110000` and `16100000` against live Edge/UI contracts.
- Preserves the RPC ↔ Edge quota contract analysis.
- Documents the **view-column drift** that made a full `15110000` apply unsafe after Phase 2a.
- Explains why Production needed **partial** `15110000` (view block skipped) — still the rationale behind the tracked partial-apply SQL.

---

## Current authoritative references

| Role | Path |
| --- | --- |
| Current dependent-migration apply runbook | [business-directory-production-controlled-apply-runbook.md](./business-directory-production-controlled-apply-runbook.md) |
| Current dependent-migration apply result | [business-directory-production-controlled-apply-result.md](./business-directory-production-controlled-apply-result.md) |
| Pre-apply readiness archive | [business-directory-dependent-migrations-production-readiness.md](./business-directory-dependent-migrations-production-readiness.md) |
| Partial apply SQL (tracked) | [business-directory-15110000-partial-apply.sql](./sql/business-directory-15110000-partial-apply.sql) |
| Environments (human SSOT) | [docs/supabase-environments.md](../docs/supabase-environments.md) |
| Production / Staging refs (machine SSOT) | [reports/tasful-supabase-staging-project-manifest.json](./tasful-supabase-staging-project-manifest.json) |
| Verification architecture (design only) | [docs/architecture/business-directory-verification-architecture.md](../docs/architecture/business-directory-verification-architecture.md) |

**Project refs (identifiers only — not secrets):**

| Environment | Project ref |
| --- | --- |
| Production | `ddojquacsyqesrjhcvmn` |
| Staging | `ahlxuyvhzqdqaojiywmu` |

Do not confuse Production and Staging. Resolve current refs from the tracked **manifest** and **`docs/supabase-environments.md`**.

---

## Historical audit scope (2026-07-01)

**Target migrations (as audited):**

| # | File | Version |
| --- | --- | --- |
| 1 | `supabase/migrations/20260715110000_business_directory_content_update.sql` | content_update |
| 2 | `supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql` | AI draft quota |

**Context at audit time:** Production already had Phase 2a (`20260717120000`) applied but was missing objects from migrations #1 and #2. Those gaps blocked owner detail, `content_update`, approve, AI generate, and quota.

**Audit methods used:** Migration file inspection · Edge/UI/doc grep · local static tests (no DB connection during this audit task).

**Not performed in this audit task (and not to be performed from this archive):** Production DB changes · migration apply · remote SQL · Edge deploy · env/DB mutation.

---

## Historical apply posture (decision record)

**Historical decision (2026-07-01):** On a Phase 2a–already-applied environment, `15110000` required **partial** apply only; `16100000` could be applied as a full file. That decision was later executed via the tracked controlled-apply runbook/result — **do not re-run from here**.

| Migration | Historical posture (Phase 2a already on Production) |
| --- | --- |
| `20260715110000` | **Partial only** — DDL from [partial-apply snippet](./sql/business-directory-15110000-partial-apply.sql) APPLY block; view block skipped |
| `20260715110000` full file | **Forbidden** in that drift state — would have replaced the public view without Phase 2a columns |
| `20260715110000` view block | **Must skip** — `CREATE OR REPLACE VIEW` / view replace would regress SEO/FAQ columns |
| `20260716100000` | **Full file OK** — no view change |

**Greenfield note (environment identity only):** Where Phase 2a was not yet applied, timestamp order `15110000` full → `16100000` full → `17120000` full was the clean path. That does **not** reopen this archive as an apply recipe.

---

## Executive summary (historical)

| Question | Historical answer |
| --- | --- |
| Were these migrations required for then-current Edge/UI? | **Yes** — Edge already depended on the missing objects |
| Were they additive (no data wipe)? | **Yes** — new tables/column/RPC only; no table-wipe or truncate statements in the migration bodies |
| Safe on greenfield Staging (timestamp order)? | **Yes** (planning judgment) |
| Safe on Production with Phase 2a already applied? | **Conditional Go** — `15110000` partial only |
| Safe on Staging with Phase 2a already applied? | Same as Production — partial `15110000` if view already at Phase 2a |
| Edge redeploy needed after apply? | **No** — Phase 2 Edge already deployed |
| Migration file edits required? | **Not blocking** — document partial apply; optional comment/split backlog |

**Bottom line (historical):** Both migrations were **safe and necessary**. The critical risk was applying `15110000` **in full** after Phase 2a, which would have **regressed** `business_directory_listings_public` and dropped SEO/FAQ columns from the public view. That risk was avoided by the completed partial-apply path.

---

## 1. Migration #1 — historical object inventory

### 1.1 Object inventory

| Category | Object | Operation | Notes |
| --- | --- | --- | --- |
| **Table** | `public.business_directory_pending_updates` | `CREATE TABLE IF NOT EXISTS` | PK `listing_id` → FK `business_directory_listings(id)` ON DELETE CASCADE |
| **Columns** | `listing_id uuid` | PK | Matches Edge upsert `onConflict: listing_id` |
| | `content_json jsonb NOT NULL DEFAULT '{}'` | | Stores `ContentBundle` (listing, profile, photos, business_hours) |
| | `updated_at timestamptz NOT NULL DEFAULT now()` | | Edge sets on upsert |
| **Index** | `idx_business_directory_pending_updates_updated` | `CREATE INDEX IF NOT EXISTS` | `(updated_at DESC)` |
| **Column (alter)** | `business_directory_review_requests.published_snapshot_json` | `ADD COLUMN IF NOT EXISTS jsonb NOT NULL DEFAULT '{}'` | Requires Phase 1 table `business_directory_review_requests` |
| **View** | `public.business_directory_listings_public` | `CREATE OR REPLACE VIEW` | Adds `review_requested + published_at` visibility rule; **Phase 1 columns only** (no Phase 2a SEO/FAQ) |
| **RLS** | `business_directory_pending_updates` | `ENABLE ROW LEVEL SECURITY` | No policies — direct client access blocked |
| **Grants** | `pending_updates` | `REVOKE ALL` from anon, authenticated; `GRANT ALL` to service_role | Edge uses service_role |
| **Triggers** | — | none | |
| **Functions/RPC** | — | none | |
| **Policies** | — | none on `pending_updates` | Intentional — service_role bypass |
| **Constraints** | PK, FK cascade | implicit | |

**View columns present in this migration’s view block (historical note):**

```text
id, listing_type, plan_code, category_id, display_name, slug,
service_areas, hp_mode, website_url, published_at,
company_name, short_description, full_description, prefecture, city
WHERE: published OR (review_requested AND published_at IS NOT NULL)
```

**Missing vs Phase 2a view (`17120000`):** `seo_title`, `meta_description`, `faq_items`, `recommended_uses`  
**Missing vs Phase 2a:** explicit `GRANT SELECT … TO anon, authenticated` (Phase 2a used `DROP VIEW` + recreate with explicit grant)

### 1.2 Prior migration dependencies (historical)

| Prerequisite | Source | Required by |
| --- | --- | --- |
| `business_directory_listings` | `20260711100000` | FK on `pending_updates` |
| `business_directory_profiles` | `20260711100000` | View JOIN |
| `business_directory_review_requests` | `20260711100000` | `published_snapshot_json` ALTER |
| `business_directory_listings_public` (Phase 1) | `20260711100000` | View REPLACE target |

**Not required for DDL success:** `16100000`, `17120000`, Stripe, storage migrations.

---

## 2. Migration #2 — historical object inventory

### 2.1 Object inventory

| Category | Object | Operation | Notes |
| --- | --- | --- | --- |
| **Table** | `public.business_directory_ai_draft_usage_daily` | `CREATE TABLE IF NOT EXISTS` | Composite PK `(user_id, date_jst)` |
| **Columns** | `user_id uuid` | FK → `auth.users(id)` ON DELETE CASCADE | Supabase Auth always present |
| | `date_jst text NOT NULL` | | Edge key via `getTokyoDateKey()` (ja-JP locale string) |
| | `used_count integer NOT NULL DEFAULT 0 CHECK (>= 0)` | | |
| | `updated_at timestamptz NOT NULL DEFAULT now()` | | |
| **Index** | `idx_bd_ai_draft_usage_daily_date` | `(date_jst)` | |
| **RLS** | table | `ENABLE ROW LEVEL SECURITY` | |
| **Policy** | `bd_ai_draft_usage_daily_deny_all` | `FOR ALL USING (false) WITH CHECK (false)` | `DROP POLICY IF EXISTS` first — idempotent |
| **Function** | `public.consume_business_directory_ai_draft_quota(uuid, text, integer)` | `CREATE OR REPLACE` · `SECURITY DEFINER` · `search_path = public` | Returns `jsonb` |
| **Grants** | RPC | `GRANT EXECUTE … TO service_role` | No anon/authenticated grant |
| **View / triggers / table alters** | — | none | Independent of `15110000` and Phase 2a |

### 2.2 RPC contract vs Edge (historical analysis)

**Edge caller** (`business-directory-ai-quota.ts`) — contract shape as reviewed:

```typescript
supabase.rpc("consume_business_directory_ai_draft_quota", {
  p_user_id: userId,
  p_date_jst: dateJst,
  p_limit: limit,
});
```

| Aspect | Migration | Edge | Match |
| --- | --- | --- | --- |
| Function name | `consume_business_directory_ai_draft_quota` | same | ✅ |
| Args | `(uuid, text, integer)` | `p_user_id`, `p_date_jst`, `p_limit` | ✅ |
| Success shape | `{ ok: true, used, limit, remaining }` | reads `row.ok === true` | ✅ |
| Quota exceeded | `{ ok: false, error: 'quota_exceeded', … }` | → `429 quota_exceeded` | ✅ |
| RPC/DB error | SQL error | → `500 internal_error "Quota check failed"` | ✅ |
| Daily limits | enforced in RPC via `p_limit` | `BD_AI_DRAFT_DAILY_LIMITS` all plans **10** | ✅ |

---

## 3. Edge / application compatibility (historical)

### 3.1 Edge (`supabase/functions`)

| Flow / action | File | DB dependency | If missing (pre-apply) |
| --- | --- | --- | --- |
| `get_owner_listing_detail` | `business-directory.ts` | `loadPendingContent` → `pending_updates` | **500** db_error |
| `update_draft_listing` (published) | same | `ensurePendingFromLive` / `savePendingContent` | **500** |
| `submit_listing_for_review` (`content_update`) | same | pending row + `published_snapshot_json` insert | **400/500** |
| `approve_listing` / `reject_listing` (content_update) | same | `applyContentSnapshotToLive` + `clearPendingContent` | broken approve path |
| Public list during review | view rule in `15110000` | `review_requested AND published_at` visible | live hidden during review (regression risk if wrong view applied) |
| `generate_listing_draft` | `business-directory-ai.ts` | `consumeAiDraftQuota` → RPC + table | **500** Quota check failed |

**Router:** `supabase/functions/business-directory/index.ts` — `generate_listing_draft` delegates to `generateListingDraft` (no extra DB contract).

**Phase 2 fields in pending:** `profileFromDraft` merges `seo_title`, `meta_description`, `faq_items`, `recommended_uses` into `content_json.profile` — stored in jsonb; **no extra columns on `pending_updates`**. Compatible with Phase 2a profile columns on approve.

### 3.2 Owner / admin UI

| Surface | Expectation | Migration support |
| --- | --- | --- |
| `business-directory-owner.js` | `has_pending_update`, `content_update_review`, submit `content_update` | Edge detail fields from pending + review_requests |
| `edit.html` | `data-bd-submit-content-update`, pending banner | UI only; DB via Edge |
| `business-directory-common.js` | mock `readMockPending()`, `canSubmitContentUpdate` | mirrors Edge contract |

### 3.3 Verification architecture (design only)

[docs/architecture/business-directory-verification-architecture.md](../docs/architecture/business-directory-verification-architecture.md) explicitly **extends** (does not replace):

- `content_update` / `pending_updates` / `approve_listing`
- `review_requests` snapshots

**No naming conflict** with `published_snapshot_json` or `content_json`. Future verification migrations would add new tables; these two migrations remain valid prerequisites historically.

### 3.4 Environments note

At audit time, Staging (`ahlxuyvhzqdqaojiywmu`) was the rehearsal identity and Production guard used `BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn`. Current identity SSOT is the tracked **manifest** plus [docs/supabase-environments.md](../docs/supabase-environments.md).

---

## 4. Migration order assessment (historical analysis)

### 4.1 Repository canonical order (greenfield reference)

```text
20260711100000  phase1 schema
20260711100001  seed
20260712100000  stripe
20260715100000  storage
20260715110000  content_update      ← audit #1
20260716100000  ai_draft_usage      ← audit #2
20260717120000  phase2a
```

| Scenario (as assessed) | #1 `15110000` | #2 `16100000` | Phase 2a `17120000` |
| --- | --- | --- | --- |
| Greenfield Staging (no 2a yet) | Full file | Full file | Apply after — view wins with 6 content columns |
| Greenfield Staging (2a last) | Full file — view superseded by 2a | Full | Final view definition correct |
| Production at audit time (2a applied, #1/#2 missing) | **Partial only** | Full file | Already applied — do not re-run |
| After partial #1 + full #2 on Production | History alignment via current runbook only | same | unchanged |

### 4.2 After Phase 2a?

| Migration | After Phase 2a? | Reason |
| --- | --- | --- |
| `16100000` | **Yes — full file** | No view/profile DDL; purely additive |
| `15110000` | **Only partial** | View block **overwrites** Phase 2a public columns |

### 4.3 Before Phase 2a on Staging?

**Yes (historical greenfield path).** The `15110000` view added the content_update visibility rule. Phase 2a then dropped/recreated the view with Phase 2 columns **and** the same visibility rule.

### 4.4 Ordering between #1 and #2

**Independent.** Either order worked. Canonical repo order (`15110000` then `16100000`) was preferred for clarity.

**History alignment:** Any migration-history bookkeeping after apply belongs exclusively to the current apply runbook. This archive does **not** retain history-repair flags, CLI forms, or re-run instructions.

---

## 5. Risk assessment (historical)

| Risk | Severity | Migration | Mitigation (as planned / later done) |
| --- | --- | --- | --- |
| **View regression** (lose Phase 2a columns) | **Critical** | `15110000` view block | Partial apply: skip view block; verify Phase 2a columns post-apply |
| Destructive wipe SQL (table drop / truncate) | None | both | — |
| `DROP POLICY IF EXISTS` | Low | `16100000` | Idempotent; recreates deny-all |
| RLS blocks Edge | Low | both | Edge uses service_role; RPC `SECURITY DEFINER` + grant |
| Missing grants on public view | Low | `15110000` if run alone after Phase 1 | Phase 2a re-grants; partial apply skips view |
| RPC signature mismatch | None | `16100000` | Verified against `business-directory-ai-quota.ts` |
| Table/column name mismatch | None | both | Edge `.from("business_directory_pending_updates")` etc. match |
| Missing prior migration | Medium | `15110000` | Requires Phase 1 (`listings`, `profiles`, `review_requests`) |
| Production data impact | Low | both | New empty tables; `published_snapshot_json` defaults `{}` on existing rows |
| Idempotency | Medium | `15110000` view | Re-running **full** file after 2a is harmful; table/column parts are IF NOT EXISTS |
| Rollback difficulty | Medium | both | Free tier / no PITR — conceptual manual rollback; pending data lost on #1 rollback concept |
| Concurrent quota consume | Low | `16100000` | Atomic `UPDATE … WHERE used_count < p_limit` |
| `auth.users` FK | Low | `16100000` | Standard Supabase; test users must exist in Auth |

### 5.1 Production data impact (as assessed)

| Object | Impact on existing rows |
| --- | --- |
| `pending_updates` | New table — empty |
| `published_snapshot_json` | Added with default `{}` — no backfill required |
| `ai_draft_usage_daily` | New table — counts start at 0 |
| Live listings / profiles | **Unchanged** |
| Stripe / subscriptions | **Unchanged** |

### 5.2 Idempotency notes

| Statement | Safe to re-run? |
| --- | --- |
| `CREATE TABLE IF NOT EXISTS` | ✅ |
| `ADD COLUMN IF NOT EXISTS` | ✅ |
| `CREATE INDEX IF NOT EXISTS` | ✅ |
| `CREATE OR REPLACE VIEW` (`15110000`) | ⚠️ **Harmful** after Phase 2a |
| `CREATE OR REPLACE FUNCTION` | ✅ (replaces body only) |
| `DROP POLICY IF EXISTS` + CREATE | ✅ |

---

## 6. Fixes and partial-apply rationale (historical)

### 6.1 Blocking issues

**None in migration SQL logic** — Edge and UI already aligned with schema. The operational fix was apply procedure (executed later under the tracked runbook), not code edits in this audit.

### 6.2 Partial apply SQL — historical rationale

**Tracked snippet (authoritative SQL artifact):** [business-directory-15110000-partial-apply.sql](./sql/business-directory-15110000-partial-apply.sql)

| Content theme | Where recorded |
| --- | --- |
| Executable DDL themes (table · column · index · RLS · grant · comment) | snippet APPLY section |
| Excluded view block (must not run after Phase 2a) | snippet SKIPPED section |
| Phase 2a view six-column VERIFY | snippet VERIFY section |
| Rollback examples (comments only in snippet) | snippet ROLLBACK / EMERGENCY sections |
| `16100000` full apply | separate migration file |

**Historical decision (completed 2026-07-01):** On Phase 2a–applied Production, apply only the partial `15110000` APPLY themes, verify Phase 2a columns remained, then apply `16100000` full. Migration-history alignment was handled under the current apply runbook — **not documented as executable steps here**.

Executable apply / verify / smoke procedures: see [business-directory-production-controlled-apply-runbook.md](./business-directory-production-controlled-apply-runbook.md) and [business-directory-production-controlled-apply-result.md](./business-directory-production-controlled-apply-result.md).

### 6.3 Optional migration file patch (backlog — never applied in this audit)

| Patch idea | Purpose |
| --- | --- |
| Header comment on `15110000` | Warn to skip view block if `17120000` already applied |
| Split view into separate migration | Reduce partial-apply operator error long-term |
| Machine-readable partial-safe markers | Apply hints in tooling |

**Migration files were not edited** during this audit.

---

## 7. Staging judgment (historical decision record)

| Condition assessed | Historical judgment |
| --- | --- |
| New Staging DB, BD chain not yet applied | **Go** — full `15110000` → `16100000` → `17120000` in timestamp order |
| Staging with Phase 2a already applied, #1/#2 missing | **Conditional Go** — partial `15110000` + full `16100000` (same as Production) |
| Staging with all three already applied | **No action** — verify only |
| Edge redeploy | Not required if Phase 2 Edge already on Staging |
| Pre-apply identity | Staging ref `ahlxuyvhzqdqaojiywmu`; Production guard must not be confused |
| Post-apply verification themes | Staging readiness remote check · Staging MVP1 smoke (Stripe skipped) — outcomes live in other tracked reports/scripts; **not re-run from this archive** |

**Historical preference:** Staging-first greenfield order avoided partial apply and validated the full chain before Production drift correction. Actual Production correction completed 2026-07-01 under the controlled-apply path.

---

## 8. Production judgment (historical decision record)

| Item | Historical judgment (pre-apply) | Outcome after 2026-07-01 |
| --- | --- | --- |
| Verdict | **Conditional Go** | Completed under controlled-apply runbook |
| `15110000` | Partial only — skip view block | Done via tracked snippet |
| `16100000` | Full file | Done |
| `17120000` | Do not re-apply — already live | Unchanged |
| Edge | No redeploy | Unchanged |
| Pre-apply identity | Dashboard ref `ddojquacsyqesrjhcvmn`; backup/dump plan; Ops sign-off | Confirmed in apply result |
| Post-apply SELECT themes | pending table · snapshot column · RPC · Phase 2a view columns retained | PASS (see apply result) |
| Post-apply smoke themes | Production smoke (Stripe skipped) — AI draft / owner detail / content_update chain | Recorded in apply result |
| No-Go condition | Applying `15110000` **including view block** while Phase 2a live | Avoided |

This section is a **decision record**, not an apply recommendation to execute again.

---

## 9. Static verification (historical results from the audit session)

No remote DB, link, migration, or deploy was performed during this audit task.

| Check (script name only) | Historical result |
| --- | --- |
| `test-business-directory-content-update.mjs` | **15/15 PASS** |
| `test-business-directory-ai-draft-phase1b-edge.mjs` | **27/27 PASS** |
| Migration file inspection | Object inventory §1–2 |
| Edge/UI/doc grep | Compatibility §3 |

These are **historical results**. They are not instructions to re-execute from this archive. Production apply and smoke outcomes after this audit are in the tracked apply result.

---

## 10. Capabilities blocked until apply (pre-apply observation)

| Capability | Blocked by missing object (at audit time) |
| --- | --- |
| Owner detail (`has_pending_update`) | `business_directory_pending_updates` |
| Published edit → pending | same |
| `content_update` submit | pending + `published_snapshot_json` |
| Ops approve/reject content_update | pending |
| `generate_listing_draft` | RPC + `ai_draft_usage_daily` |
| Daily AI quota enforcement | same |

**Status after 2026-07-01 apply:** these blockers were cleared per the controlled-apply result.

---

## 11. Related files (reference index)

| Path | Role |
| --- | --- |
| `reports/sql/business-directory-15110000-partial-apply.sql` | Partial apply SQL artifact · view excluded · VERIFY · rollback comments |
| [business-directory-production-controlled-apply-runbook.md](./business-directory-production-controlled-apply-runbook.md) | **Current** Production apply procedure |
| [business-directory-production-controlled-apply-result.md](./business-directory-production-controlled-apply-result.md) | **Current** apply outcome record |
| [business-directory-dependent-migrations-production-readiness.md](./business-directory-dependent-migrations-production-readiness.md) | Pre-apply readiness archive |
| `supabase/migrations/20260715110000_business_directory_content_update.sql` | Audit target #1 (full file unsafe after Phase 2a) |
| `supabase/migrations/20260716100000_business_directory_ai_draft_usage.sql` | Audit target #2 (full file OK) |
| `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql` | Applied on Production; view SSOT at audit time |
| `supabase/functions/_shared/business-directory.ts` | pending / content_update / approve |
| `supabase/functions/_shared/business-directory-ai-quota.ts` | RPC client |
| `supabase/functions/_shared/business-directory-ai.ts` | `generateListingDraft` |
| `supabase/functions/business-directory/index.ts` | Action router |
| `business-directory/business-directory-owner.js` | Owner UI |
| `scripts/test-business-directory-content-update.mjs` | Static content_update checks |
| `scripts/test-business-directory-ai-draft-phase1b-edge.mjs` | Static quota + AI checks |
| `docs/supabase-environments.md` | Human environment SSOT |
| `reports/tasful-supabase-staging-project-manifest.json` | Machine ref SSOT |

---

## 12. Archive status

| Item | Status |
| --- | --- |
| Document role | Completed / Historical Archive — dependency migration audit |
| Migration object inventory | Retained (§1–2) |
| Edge/app compatibility | Retained (§3) |
| Order / risk / partial-apply rationale | Retained (§4–6) |
| Production migration execution | Completed 2026-07-01 — see apply result |
| Current executable procedure | apply runbook only |
| Re-run from this file | **Forbidden** |

---

*This archive is a historical audit record only. Do not treat it as an apply, repair, rollback, smoke, or deploy procedure. Agents must not execute migration, remote SQL, or deploy steps from this document.*
