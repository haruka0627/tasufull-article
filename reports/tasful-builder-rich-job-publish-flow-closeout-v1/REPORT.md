# TASFUL Builder — Rich Job Publish Flow Closeout V1

## Outcome

Closed the missing **Job** path only:

`private_draft` → existing `publishGeneralProject` → `builder_public_projects_v1` → Search → `project-detail`.

Provider flow was not touched. Rich UI labels/layout were not redesigned. No new publish state machine.

## Hypothesis

Call existing `TasuBuilderProjectRepository.publishGeneralProject` after successful create/update when submit intent is publish; draft button skips publish.

**Accepted and implemented.**

## QA

```bash
node scripts/qa-builder-rich-job-publish-flow-closeout.mjs
node scripts/qa-builder-canonical-rich-4page-core-smoke.mjs
node scripts/qa-builder-canonical-rich-4page.mjs
```

`qa-static.json` is the static/optional-live ledger. Staging secrets were not present in this agent env, so live JWT E2E is SKIP unless a human exports Staging anon+JWT. Secrets are never printed.

Cloudflare Pages `pages_build_output_dir` remains `deploy/cloudflare/dist` (do not reintroduce the 25 MiB zip fail).

## Safety

| Item | Status |
|---|---|
| READY_FOR_PRODUCTION | **NO** |
| PRODUCTION_MIGRATION | NO |
| Production writes / config | NO |
| Anon RLS loosened | NO |
| Direct published INSERT | FORBIDDEN |
| Provider flow changed | NO |
| Rich UI redesign | NO |
| wrangler output dir kept | YES |

**READY_FOR_PRODUCTION = NO**

STOP before merge.
