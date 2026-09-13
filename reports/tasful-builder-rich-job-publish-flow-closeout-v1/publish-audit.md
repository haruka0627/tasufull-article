# MVP publish audit (Job only)

## Existing transition (reused)

`TasuBuilderProjectRepository.publishGeneralProject(id)` is the MVP publish helper:

1. `INSERT` is **never** `published` (`insertPrivateDraft` forces `private_draft`; if DB returns `published` → `RLS_PUBLISH_ON_INSERT_FORBIDDEN`).
2. Publish is an **UPDATE** `builder_projects.publication_state = 'published'` by `project_key`, then `id`.
3. No new state machine. No direct published INSERT.

There was **no call site** before this closeout. Rich `persist` always stopped at `private_draft`. MVP `JobCreateCore.insertJob` does not set `publication_state` and does not call publish.

## Ownership / auth / compliance gates

| Gate | Where | Behavior |
|---|---|---|
| Flag + client | `TasuBuilderGeneralJobsStagingFlags.isRepositoryActive()` | No Staging write if flag/mapper/repo/client missing |
| Insert RLS | `sql/builder-rls-policies.sql` (design) | owner actor + `owner_id = builder_current_owner_id()`, or admin |
| Update / publish RLS | same | owner_id match or admin. Anon without owner claim → 42501 |
| JS owner | `persist` → `resolveOwnerId` | auth `getUser().id` if session exists, else field / `owner-demo` |
| Direct published INSERT | forbidden | expect 42501; persist never sends `published` on insert |
| Draft vs publish | UI already split | `下書きとして保存` → `intent=draft`; `案件を投稿する` → `intent=publish` |

Anon RLS is **not** loosened. Production migrations / writes / dashboard config are **not** applied.

## Public projection

`builder_public_projects_v1` is read-only. After a successful UPDATE to `published`, Search (`listPublicProjects` / `searchJobs`) and `getJob` can see the row. Detail already fell back to this view.
