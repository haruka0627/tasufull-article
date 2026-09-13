# Legacy classification

| Path | Class | Policy |
|---|---|---|
| `builder/new-project.html` | CANONICAL | 視覚 + 投稿入口 |
| `builder/provider-profile.html` | CANONICAL | 視覚 + 登録/編集 |
| `builder/provider-detail.html` | CANONICAL | 提供者詳細 |
| `builder/project-detail.html` | CANONICAL | 案件詳細（hub 併用） |
| `builder/mvp-post.html` | LEGACY_COMPAT | 削除禁止。同一 create core |
| `builder/mvp-project-new.html` | LEGACY_COMPAT | 削除禁止 |
| `builder/mvp-partner-register.html` | LEGACY_COMPAT | 削除禁止。同一 register core |
| `builder/mvp-project-detail.html` | LEGACY_COMPAT | 削除禁止 |
| `builder/board-project-detail.html` | LEGACY_COMPAT | 掲示板詳細（残置） |
| `builder/partner.html` / `partner-detail.html` | LEGACY_OTHER | 審査/ハブ系。検索カードは canonical へ書換 |
| `/partner-register.html?source=builder` | IWASHO_KEEP | TOP から維持 |
| `tasful:builder:mvp:v1` / ProviderStore | COMPAT_CACHE | 新規 SSOT にしない |
| `builder_projects` kind=`builder_board` | JOB_SSOT | flag `TASU_BUILDER_GENERAL_JOBS_REPO=true` のとき |
| `builder_partners` (+ `builder_workers` if present) | PROVIDER_SSOT | Sync 経由 |
| `builder_public_projects_v1` | PUBLIC_PROJECTION | 読取のみ |
| `supabase/migrations/20260914120000*` / `20260914130000*` | FORBIDDEN | 本 PR では追加・適用しない |
