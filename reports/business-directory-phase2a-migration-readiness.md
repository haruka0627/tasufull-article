# Business Directory — Phase 2a Migration Readiness Checklist

**Purpose:** Pre-apply audit for Commercial Launch (AI page content save columns)  
**Scope:** Verification / documentation only — **no migration applied in this audit**  
**Date:** 2026-07-01  
**Auditor:** Cursor agent (P0 Phase 2a pre-flight)  
**Status (2026-07-01):** **Option B — Production controlled migration** · [runbook](./business-directory-phase2a-production-controlled-migration.md) · Staging 名目 apply **禁止** · apply **未実施**

---

## Target columns

| Column | Introduced in | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `short_description` | Phase 1 (`20260711100000`) | NOT NULL | — | Already in prod path if Phase 1 applied |
| `full_description` | Phase 1 | NULL | — | Already exists; Phase 2a only extends public view |
| `seo_title` | **Phase 2a** (`20260717120000`) | NULL | — | App max 60 chars |
| `meta_description` | **Phase 2a** | NULL | — | App max 160 chars |
| `faq_items` | **Phase 2a** | NOT NULL | `'[]'::jsonb` | App max 5 items |
| `recommended_uses` | **Phase 2a** | NOT NULL | `'{}'::text[]` | App max 5 lines |

---

## Migration file

| Item | Value |
| --- | --- |
| **Primary migration** | `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql` |
| **Also modifies** | `public.business_directory_listings_public` view (replaces) |
| **Does not touch** | `business_directory_listings`, RLS policies, triggers (except view), `pending_updates`, `review_requests` table DDL |

### Dependency order (apply sequence)

1. `20260711100000_business_directory_phase1_schema.sql`
2. `20260711100001_business_directory_phase1_seed.sql`
3. `20260712100000_business_directory_phase6_stripe_subscription.sql`
4. `20260715100000_business_directory_storage.sql`
5. `20260715110000_business_directory_content_update.sql` — **required before 2a** (view already replaced once)
6. `20260716100000_business_directory_ai_draft_usage.sql` — independent (quota table)
7. `20260717120000_business_directory_page_content_phase2a.sql` — **this audit target**

### Rollback notes (manual — no down migration in repo)

- **Reverse DDL:** `ALTER TABLE business_directory_profiles DROP COLUMN IF EXISTS seo_title, meta_description, faq_items, recommended_uses;`
- **Restore view:** Re-run view definition from `20260715110000` (without SEO/FAQ/uses columns) or Phase 1 baseline.
- **Data loss:** Values stored in dropped columns are lost.
- **App impact after rollback:** Edge `updateDraftListing` / `profileFromDraft` upsert will fail until app reverted or columns re-added.
- **Safe apply:** `ADD COLUMN IF NOT EXISTS` + NOT NULL columns with defaults → existing profile rows backfill automatically.

---

## Phase 2a Migration Readiness Checklist

### Migration / schema

- [x] **Migration order confirmed** — 2a after Phase 1 + content_update (see order above)
- [x] **All six logical fields accounted for** — 4 new in 2a; 2 pre-existing in Phase 1
- [x] **Nullable / default reviewed** — `seo_*` nullable; `faq_items` / `recommended_uses` NOT NULL with safe defaults
- [x] **Index review** — No new indexes on content columns (acceptable for MVP; list view uses existing listing indexes)
- [ ] **Staging apply executed** — Not run in this audit (human / CI step)
- [ ] **Production apply executed** — Out of scope / not ready

### Security / infra

- [x] **RLS impact** — No policy changes in 2a; `profiles` owner/published/ops policies apply to whole row (`SELECT *` / upsert)
- [x] **Trigger impact** — Only existing `business_directory_set_updated_at` on profiles; unchanged
- [x] **View exposure** — `business_directory_listings_public` now exposes SEO + rich fields for published rows (app-layer plan gate still hides on detail renderer)
- [x] **`pending_updates` alignment** — `content_json` stores full `profile` object via Edge; Phase 2 fields flow in pending bundle after code deploy
- [x] **`review_requests` alignment** — `snapshot_json` / `published_snapshot_json` use `buildFullContentSnapshot` / `buildListingSnapshot(profile select *)`; Phase 2 fields included when present

### Application layer

- [x] **Repository (`business-directory-repository.js`)** — Pass-through POST body to Edge; no field stripping
- [x] **Edge insert (`createDraftListing`)** — `profileFromDraft` writes all Phase 2 fields
- [x] **Edge update (`updateDraftListing`)** — Explicit upsert includes `seo_title`, `meta_description`, `faq_items`, `recommended_uses`, `full_description`
- [x] **Edge content_update (`updatePublishedPendingListing`)** — Merges `profileFromDraft` into `pending_updates.content_json`
- [x] **Edge approve (`approveListing` + `applyContentSnapshotToLive`)** — Profile upsert spreads snapshot fields (includes Phase 2)
- [x] **Edge public read (`getPublicListingDetail`)** — `profiles.select("*")` → renderer receives full profile
- [x] **Renderer** — Reads `profile.full_description`, `faq_items`, `recommended_uses`; plan gate at display layer (unchanged)

### Staging operator runbook

- [x] **Operator runbook published** — [business-directory-phase2a-staging-operator-runbook.md](./business-directory-phase2a-staging-operator-runbook.md) — **Staging apply 禁止 · 参照のみ**
- [x] **Option B runbook published** — [business-directory-phase2a-production-controlled-migration.md](./business-directory-phase2a-production-controlled-migration.md)
- [ ] **Production controlled migration** — pending human execution
- [ ] **Post-apply smoke + Go/No-Go** — pending

### Testing / ops

- [x] **Static Phase 2a script** — `node scripts/test-business-directory-page-content-phase2a.mjs` (29/30; see issues)
- [x] **Static Phase 2 API script** — `node scripts/test-business-directory-phase2-api.mjs` (transitions OK; deno env note)
- [ ] **Staging remote column check** — `information_schema.columns` for 2a columns (use extended Step 1 script or manual SQL)
- [ ] **Staging Edge E2E** — `scripts/test-business-directory-production-step2-edge.mjs` against staging project
- [ ] **Production preflight** — Repeat remote checks + smoke on 8788 against prod-backed staging

### Launch gate

- [ ] **Production migration apply** — Blocked until staging green
- [ ] **Production Edge deploy** — Must ship with migration (order: migration → Edge, or simultaneous)
- [ ] **Commercial Launch sign-off**

---

## Repository verification summary

`business-directory-repository.js` is a thin wrapper: every owner/public action sends JSON to `supabase/functions/business-directory`. **No client-side field filtering** — Phase 2 fields are carried in the request body from `business-directory-owner.js` → Edge.

| Flow | Phase 2 fields |
| --- | --- |
| Save (create) | Body → `create_draft_listing` → `profileFromDraft` → INSERT |
| Save (update draft) | Body → `update_draft_listing` → UPSERT profiles |
| Save (published pending) | Body → pending `content_json.profile` merge |
| Read (owner detail) | Edge `select("*")` on profiles + pending overlay |
| Read (public detail) | Edge `select("*")` on profiles |
| Review snapshot | Full profile in `snapshot_json` |
| Approve content_update | `applyContentSnapshotToLive` upserts profile from snapshot |

Mock path (`bdMock=1`): `business-directory-common.js` `profileFieldsFromBody` includes all six fields.

---

## Edge verification summary

File: `supabase/functions/_shared/business-directory.ts`

| Operation | Phase 2 field handling |
| --- | --- |
| **insert** (`createDraftListing`) | `profileFromDraft` optional fields |
| **update** (`updateDraftListing`) | Explicit upsert column list |
| **content_update** | `profileFromDraft` → `pending_updates` |
| **approve** | `applyContentSnapshotToLive` profile upsert (all snapshot keys) |
| **publish** (initial) | Data already in profiles before `review_requested`; approve transitions status only |
| **get_public_*** | `select("*")` — data available to renderer |

Validation: `normalizeProfileFaqItems` (max 5), `normalizeRecommendedUses` (max 5), text length trims in `profileFromDraft`.

---

## Public data path (no gap at app layer)

```text
Public page (detail.html + business-directory-public.js)
  → TasuBusinessDirectoryRepository.getPublicListingDetail
  → Edge get_public_listing_detail
  → DB profiles.* (after migration)
  → TasuBusinessDirectoryPageRenderer.renderBusinessDirectoryPage (planGate)
```

**Display:** Free hides rich sections in renderer; data may still exist in DB/API (by design since Phase 1 `full_description`).

---

## Production risk register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Migration applied after Edge deploy | **High** | Upsert fails on unknown columns — apply migration first or gate deploy |
| Edge deploy before migration | **High** | Same — coordinate release order |
| Migration failure mid-apply | Medium | Transaction wraps single migration file; retry idempotent (`IF NOT EXISTS`) |
| Rollback without app rollback | Medium | Prepare manual view restore + column drop script; redeploy previous Edge |
| Existing production profiles NULL rich fields | Low | Defaults on `faq_items` / `recommended_uses`; nullable SEO fields OK |
| Public list view exposes rich JSON to anon | Low | Pre-existing pattern for `full_description`; document for ops; renderer still gates UI |
| `profiles_select_published` RLS vs content_update live view | Low | Public list view uses published OR review_requested+published_at; aligned with content_update migration |
| Free/Standard plan display | None at DB | Plan gate unchanged in renderer / owner UI |
| Step 1 migration test script stale | Ops | Extend `test-business-directory-production-step1-migration.mjs` to include migrations through 2a |
| Phase 2a static test expects new.html without `full_description` | Low | Test drift after Phase 3c hidden field — update test separately |

---

## Issues found (non-blocking for staging apply)

1. **`scripts/test-business-directory-production-step1-migration.mjs`** lists only Phase 1 + Phase 6 migrations — does not verify 2a columns remotely.
2. **`scripts/test-business-directory-page-content-phase2a.mjs`** one stale assertion (`new.html` now has hidden `full_description` for Phase 3c AI apply).
3. **Deno check** in Phase 2 API test fails locally (`npm:@types/node` resolution) — environment issue, not schema issue.
4. **No automated down migration** — rollback runbook must be manual.

---

## Staging / production verdict

| Environment | Verdict | Rationale |
| --- | --- | --- |
| **Staging apply** | **禁止** | No separate Staging project — see [separation report](./business-directory-phase2a-staging-production-separation.md) |
| **Production controlled apply (Option B)** | **Migration applied** (2026-07-01) · Edge deploy + full smoke **pending** |
| **Production apply executed** | **DB Phase 2a yes** · **Production Ready no** (Edge + smoke) |

### Recommended staging apply procedure (human)

1. Apply full migration chain through `20260717120000` on staging Supabase.
2. Verify columns:
   ```sql
   select column_name, is_nullable, column_default
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'business_directory_profiles'
     and column_name in ('short_description','full_description','seo_title','meta_description','faq_items','recommended_uses');
   ```
3. Verify view columns on `business_directory_listings_public`.
4. Run Edge integration tests against staging.
5. Smoke: create draft with AI fields → owner detail → public preview (Standard listing) → content_update → approve.

---

## Related commands (local static — run in this audit)

```bash
node scripts/test-business-directory-page-content-phase2a.mjs
node scripts/test-business-directory-phase2-api.mjs
node scripts/test-business-directory-page-content-phase2b.mjs
node scripts/test-business-directory-page-renderer-phase3a.mjs
```

---

*This document is the canonical pre-flight checklist for Phase 2a DB apply. Update checkboxes after staging/production execution.*

**Next step:** [Production controlled migration runbook](./business-directory-phase2a-production-controlled-migration.md) · 将来の Staging 分離: [tasful-supabase-staging-project-plan.md](./tasful-supabase-staging-project-plan.md).
