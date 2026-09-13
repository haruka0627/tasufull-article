# Human QA — Rich Job publish (Staging)

Visual QA is human-only in external Chrome. This agent does not drive Browser Automation.

## Staging client (do not retarget Production config globally)

1. Keep committed `chat-supabase-config.js` as-is.
2. Point the browser session at Staging `ahlxuyvhzqdqaojiywmu` via local override only, for example `chat-supabase-config.local.js` on a local host, or a Staging Pages preview env. Do not paste secrets into the repo.
3. Sign in so `tasu-supabase-auth` has a JWT whose owner claim can update own `builder_projects` rows.
4. In DevTools: `localStorage.setItem('TASU_BUILDER_GENERAL_JOBS_REPO','true')`.

## Flow

1. Open `/builder/new-project.html`.
2. Fill タイトル / カテゴリー / 依頼詳細 (and optional address keys).
3. Click **下書きとして保存** — stay on the page. Staging row (if repo active) must remain `private_draft`. Status must not say published.
4. Click **案件を投稿する** — create/update `private_draft`, then existing publish UPDATE. Redirect to `/builder/project-detail.html?id=`.
5. Open `/builder/board-projects.html` (Search). The published job should appear from `builder_public_projects_v1` (flag ON + Staging client).
6. Open the card → `project-detail.html?id=` (not a fake success).
7. Confirm the job is **not** inserted as `published` in one shot. If publish UPDATE fails (42501), status must warn and must not claim published.

## Scripted E2E

```bash
# optional, values never printed
export TASU_STAGING_SUPABASE_URL=https://ahlxuyvhzqdqaojiywmu.supabase.co
export TASU_STAGING_SUPABASE_ANON_KEY=...
export TASU_STAGING_SUPABASE_AUTH_JWT=...
node scripts/qa-builder-rich-job-publish-flow-closeout.mjs
node scripts/qa-builder-canonical-rich-4page-core-smoke.mjs
```

Without JWT, live Staging steps SKIP. Production URL is denied.
