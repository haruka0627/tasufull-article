# Wire notes — Rich Job publish closeout

## Hypothesis

**Accepted.** After successful `insertPrivateDraft` / `updatePrivateDraft`, call existing `TasuBuilderProjectRepository.publishGeneralProject` when submit intent is publish. Draft button skips publish.

## Button semantics (labels/design unchanged)

| Control | Attribute | Intent | Persist |
|---|---|---|---|
| 下書きとして保存 | `data-canonical-job-draft` `type=button` | `draft` | sessionStorage + DualWrite `private_draft` only |
| 案件を投稿する | `data-canonical-job-submit` `type=submit` | `publish` | create/update `private_draft` → `publishGeneralProject` → redirect `project-detail.html?id=` |

## Path

```
Rich new-project persist(intent)
  → insertPrivateDraft | updatePrivateDraft  (publication_state=private_draft)
  → [publish only] publishGeneralProject      (UPDATE published)
  → builder_public_projects_v1                 (read)
  → Search: searchJobs / board-projects merge
  → project-detail getJob / getGeneralProjectById
```

## Files

- `builder/builder-new-project-general-jobs-wire.js` — `persist(fields, { intent })`
- `builder/builder-new-project-wire.js` — draft click calls persist with `intent=draft`
- `builder/builder-project-repository.js` — `updatePrivateDraft`, `listPublicProjects`; publish tries `project_key` then `id`
- `builder/builder-general-jobs-repo.js` — `listPublicProjects` + existing `getJob` view fallback
- `builder/builder-search-repository.js` — job search prefers `builder_public_projects_v1`
- `builder/builder-search-ui-adapter.js` — `mapPublicProjectRow`
- `builder/builder-board-feed.js` — job/project detail href → canonical `project-detail.html`
- `builder/builder.js` — board list hydrates published public rows
- `builder/board-projects.html` — Staging repo stack + search-detail-bridge (no UI redesign)

Provider files were not modified.

## Staging QA client

Scripted E2E builds an isolated REST client from env (`TASU_STAGING_SUPABASE_*`). It does **not** rewrite committed `chat-supabase-config.js` (still Production ref for Pages). Human browser QA should load Staging via local override (`chat-supabase-config.local.js` / host env), not by editing the committed Production file.
