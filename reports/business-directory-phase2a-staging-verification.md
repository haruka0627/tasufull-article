# Business Directory — Phase 2a Staging Verification

> **Deprecated for apply path (2026-07-01):** Staging 分離なし · **Staging 名目 apply 禁止**.  
> **正本:** [Production controlled migration runbook](./business-directory-phase2a-production-controlled-migration.md) (Option B).  
> 本ファイルは post-apply SQL · E2E チェックリストの **参照用** として残す。

**Purpose:** Post-apply verification checklist (originally Staging-before-Production — superseded by Option B).  
**Status (2026-07-01):** **Option B** — apply via [production-controlled-migration runbook](./business-directory-phase2a-production-controlled-migration.md) · **未実行**  
**Prerequisite:** [business-directory-phase2a-migration-readiness.md](./business-directory-phase2a-migration-readiness.md)  
**Legacy Staging runbook:** [business-directory-phase2a-staging-operator-runbook.md](./business-directory-phase2a-staging-operator-runbook.md) — **apply 禁止**  
**Migration target:** `supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql`  
**Scope:** Verification procedure only — **does not execute migrations**

---

## 1. Apply scope & order

### Migrations to apply on Staging (full Business Directory chain)

Apply in timestamp order through Phase 2a:

| # | Version | File |
| --- | --- | --- |
| 1 | `20260711100000` | `business_directory_phase1_schema.sql` |
| 2 | `20260711100001` | `business_directory_phase1_seed.sql` |
| 3 | `20260712100000` | `business_directory_phase6_stripe_subscription.sql` |
| 4 | `20260715100000` | `business_directory_storage.sql` |
| 5 | `20260715110000` | `business_directory_content_update.sql` |
| 6 | `20260716100000` | `business_directory_ai_draft_usage.sql` |
| 7 | **`20260717120000`** | **`business_directory_page_content_phase2a.sql`** |

> If Staging already has 1–6 applied, apply **only** `20260717120000`.

### Deploy order (Staging & Production)

**Mandatory:** DB migration **before or simultaneous with** Edge deploy that upserts Phase 2 columns.

| Step | Staging | Production (after Staging green) |
| --- | --- | --- |
| 1 | **Staging DB migration** (through 2a) | — |
| 2 | **Staging Edge deploy** (`business-directory` function) | — |
| 3 | **Staging E2E** (this checklist) | — |
| 4 | — | **Production DB migration** |
| 5 | — | **Production Edge deploy** |
| 6 | — | **Production smoke test** |

**Never:** Deploy Edge that writes `seo_title` / `faq_items` / etc. to a database that does not yet have those columns.

---

## 2. Pre-apply (Staging)

### Operator checklist

- [ ] Supabase CLI linked to **Staging project only** (`supabase link --project-ref <STAGING_REF>`)
- [ ] `BD_PRODUCTION_PROJECT_REF` set locally — script refuses if linked ref matches (see verification script)
- [ ] Migration history reviewed: `supabase migration list`
- [ ] **Backup / PITR** confirmed available (Supabase dashboard → Database → Backups)
- [ ] Rollback runbook read (Section 8)
- [ ] Maintenance window / team notified (if applicable)
- [ ] Edge **not** yet deployed with Phase 2 upsert **OR** migration applied in same release window

### Apply command (human — not run by agents)

```bash
# Staging only — verify project ref before running
npx supabase db push --linked
# OR apply specific migration via your org's migration pipeline
```

### Post-apply migration history check

```sql
select version, name
from supabase_migrations.schema_migrations
where version >= '20260711100000'
order by version;
```

Expect `20260717120000` present after Phase 2a apply.

---

## 3. Post-apply DB verification (SELECT only)

Run via Supabase SQL Editor (Staging) or:

```bash
node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote
```

### 3.1 Column existence & nullability (`business_directory_profiles`)

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'business_directory_profiles'
  and column_name in (
    'short_description',
    'full_description',
    'seo_title',
    'meta_description',
    'faq_items',
    'recommended_uses'
  )
order by column_name;
```

**Expected:**

| column | data_type | is_nullable | column_default |
| --- | --- | --- | --- |
| short_description | text | NO | NULL |
| full_description | text | YES | NULL |
| seo_title | text | YES | NULL |
| meta_description | text | YES | NULL |
| faq_items | jsonb | NO | `'[]'::jsonb` |
| recommended_uses | ARRAY | NO | `'{}'::text[]` |

### 3.2 Row-level sanity (existing profiles)

```sql
select
  count(*)::int as total_profiles,
  count(*) filter (where faq_items is null)::int as null_faq,
  count(*) filter (where recommended_uses is null)::int as null_uses,
  count(*) filter (where jsonb_typeof(faq_items) = 'array')::int as faq_is_array
from public.business_directory_profiles;
```

**Expected:** `null_faq = 0`, `null_uses = 0`, `faq_is_array = total_profiles`.

### 3.3 Public list view columns

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'business_directory_listings_public'
  and column_name in (
    'short_description',
    'full_description',
    'seo_title',
    'meta_description',
    'faq_items',
    'recommended_uses'
  )
order by column_name;
```

**Expected:** All 6 columns listed.

### 3.4 View definition spot-check

```sql
select pg_get_viewdef('public.business_directory_listings_public'::regclass, true);
```

Confirm SELECT list includes `p.seo_title`, `p.meta_description`, `p.faq_items`, `p.recommended_uses`, `p.full_description`.

### 3.5 Migration version recorded

```sql
select version
from supabase_migrations.schema_migrations
where version = '20260717120000';
```

**Expected:** 1 row.

---

## 4. Edge E2E verification (Staging)

**Environment:** Staging Cloudflare Pages preview or Staging host + Staging Supabase + Staging Edge.  
**Do not use Production URLs or Production project ref.**

### 4.1 Automated (local / CI against Staging URL)

Set env (examples):

```bash
export BASE_URL=https://<staging-pages-host>
export TASFUL_SUPABASE_URL=https://<staging-ref>.supabase.co
export TASFUL_SUPABASE_ANON_KEY=<staging-anon>
# Owner test account JWT or use devSkipAuth only on non-prod hosts
```

| Step | Script / action | Pass criteria |
| --- | --- | --- |
| Static Phase 2a | `node scripts/test-business-directory-page-content-phase2a.mjs` | All critical asserts green |
| Static Phase 2 API | `node scripts/test-business-directory-phase2-api.mjs` | Service exports OK |
| DB remote | `node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote` | Column + view checks PASS |
| Edge health | `node scripts/test-business-directory-production-step2-edge.mjs --remote` | `business-directory` health OK (Staging functions URL) |
| AI flow (mock UI) | `node scripts/test-business-directory-create-mode-phase3c-browser.mjs` | AI → apply → no auto-save |
| Save flow | `node scripts/test-business-directory-create-mode-phase3d-browser.mjs` | Save → edit fields persisted |
| Plan placeholders | `node scripts/test-business-directory-page-renderer-phase3f-browser.mjs` | Free placeholders / Standard rich |

> Browser scripts default to `http://127.0.0.1:8788`. For Staging UI, set `BASE_URL` to Staging host and run against real Edge (not `bdMock=1`).

### 4.2 Manual E2E script (Staging + real Edge)

Use one test listing per run; record `listing_id` and `slug`.

#### A. AI generate → save → edit

1. Open `…/business-directory/new.html` (Staging, authenticated owner).
2. Choose **AIでページを作成** → fill minimum fields → **AIでページを生成**.
3. Confirm Free ai-preview shows **plan placeholders** (Phase 3f), not raw FAQ/full on Free.
4. **この内容を反映** → confirm unsaved banner + save emphasis.
5. **下書き保存** → redirect `edit.html?id=…&created=1`.
6. On edit **基本情報**: verify `short_description`, `full_description`, `seo_title`, `meta_description`, FAQ rows, `recommended_uses`.
7. **プレビュー** tab: shared renderer shows content; Free hides rich sections.

#### B. Initial publish

8. **公開設定** → **公開を申請する** → status `review_requested`.
9. Ops **approve** (admin UI or Edge `approve_listing`).
10. Open **public detail** by slug → verify `short_description`; Standard listing shows FAQ / full / uses; Free hides rich (planGate).

#### C. content_update → approve

11. On published listing (Standard+ recommended): edit `full_description` + FAQ → **変更を保存** (pending path).
12. **内容更新を申請** → status `review_requested` (content_update).
13. Public page still shows **old live** content during review.
14. Ops **approve** → public detail shows **new** rich content.
15. SQL (optional): `pending_updates` row cleared for listing.

```sql
select listing_id from public.business_directory_pending_updates where listing_id = '<uuid>';
-- Expected: 0 rows after approve
```

#### D. Free / Standard planGate

| Plan | Public detail | AI preview (new.html) |
| --- | --- | --- |
| Free | No `data-bd-public-full-description` / FAQ / uses in DOM | Placeholder cards (`data-bd-plan-preview-note`) |
| Standard+ | Rich sections visible | Rich sections visible, no placeholders |

---

## 5. content_update & review integrity

| Check | How | Pass |
| --- | --- | --- |
| Pending stores Phase 2 fields | After save on published listing, inspect pending JSON (service role or ops tool) | `profile.seo_title`, `faq_items`, etc. present in `content_json` |
| Review snapshot | Row in `business_directory_review_requests` for content_update | `snapshot_json.profile` contains updated fields |
| Approve applies live | Public detail after approve | Matches pending values |
| Reject discards pending | Reject content_update | Live unchanged; pending row removed |
| Initial publish snapshot | `request_type = initial_publish` | `snapshot_json.profile` includes Phase 2 fields when saved pre-submit |

---

## 6. Rollback decision

### When to rollback on Staging

- Migration applied but view broken (list API 500)
- Mass upsert failures on profiles
- Unexpected NOT NULL violations

### Rollback steps (manual — Staging drill)

1. Stop Edge deploy that writes Phase 2 columns (revert function).
2. Restore view (from `20260715110000` or Phase 1 definition).
3. Drop Phase 2a columns:

```sql
alter table public.business_directory_profiles
  drop column if exists seo_title,
  drop column if exists meta_description,
  drop column if exists faq_items,
  drop column if exists recommended_uses;
```

4. Remove migration row only if your process requires (coordinate with DBA):

```sql
-- DBA discretion — may break supabase migration sync
-- delete from supabase_migrations.schema_migrations where version = '20260717120000';
```

5. Re-run Staging E2E on reverted stack.

- [ ] Rollback drill performed on Staging **OR** runbook reviewed and signed off

---

## 7. Production Go / No-Go

### Go (all required)

| # | Criterion |
| --- | --- |
| G1 | All 6 columns exist on Staging `business_directory_profiles` with expected nullability/defaults |
| G2 | `business_directory_listings_public` includes all 6 content columns |
| G3 | `20260717120000` in `schema_migrations` on Staging |
| G4 | Staging Edge E2E: AI → apply → save → edit displays Phase 2 fields |
| G5 | Staging: initial publish → approve → public detail OK |
| G6 | Staging: content_update → approve → live reflects pending |
| G7 | Free / Standard+ planGate PASS (public + ai-preview placeholders) |
| G8 | Rollback runbook reviewed (Section 6) |
| G9 | Deploy order agreed: **Production DB migration before/simultaneous with Edge** |
| G10 | `test-business-directory-phase2a-staging-readiness.mjs --remote` PASS on Staging link |

### No-Go (any triggers block Production)

| Condition | Action |
| --- | --- |
| Phase 2a migration not applied on Staging | Fix Staging before Production |
| View missing Phase 2 columns | Re-run 2a migration view section |
| Edge save fails (unknown column / 500) | Migration first; redeploy Edge |
| `pending_updates.content_json.profile` missing Phase 2 fields | Fix Edge before Production |
| Approve does not apply rich fields to live | Block — debug `applyContentSnapshotToLive` |
| planGate broken (Free shows FAQ publicly) | Block — renderer regression |
| Rollback runbook not reviewed | Complete drill or sign-off |
| Edge deployed to Production before migration | **Stop** — apply migration immediately or rollback Edge |

### Sign-off template

| Role | Name | Date | Staging E2E | Production Go |
| --- | --- | --- | --- | --- |
| Engineering | | | ☐ | ☐ |
| Ops / DBA | | | ☐ | ☐ |
| Product | | | ☐ | ☐ |

---

## 8. Current status (document creation)

| Item | Status |
| --- | --- |
| Pre-apply audit | Complete — schema/Edge review OK |
| Staging / Production separation | **None** — single ref · Staging apply **禁止** |
| **Option B** | **Adopted** — [production-controlled-migration runbook](./business-directory-phase2a-production-controlled-migration.md) |
| Production migration executed | **Pending** — maintenance window + Go/No-Go |
| Post-apply smoke | **Pending** |

---

## Related files

| File | Role |
| --- | --- |
| [business-directory-phase2a-production-controlled-migration.md](./business-directory-phase2a-production-controlled-migration.md) | **正本** · Option B apply · backup · rollback · Go/No-Go |
| [business-directory-phase2a-staging-production-separation.md](./business-directory-phase2a-staging-production-separation.md) | 分離調査 · Option B 背景 |
| [business-directory-phase2a-staging-operator-runbook.md](./business-directory-phase2a-staging-operator-runbook.md) | Human Staging apply prep · Phase A/B/C commands |
| [business-directory-phase2a-migration-readiness.md](./business-directory-phase2a-migration-readiness.md) | Pre-apply audit |
| `scripts/test-business-directory-phase2a-staging-readiness.mjs` | Automated DB column/view checks (Staging link) |
| `scripts/test-business-directory-production-step2-edge.mjs` | Edge health (configure Staging URL) |

---

*Update checkboxes and sign-off after Staging verification run.*
