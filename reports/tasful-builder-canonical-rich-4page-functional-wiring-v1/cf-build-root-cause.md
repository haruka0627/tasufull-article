# Cloudflare Pages build FAIL — root cause (HEAD 61d772f / deployment bf65112d)

## What failed

Build command **succeeded**:

```
[stage-cloudflare-pages] OK → /opt/buildhome/repo/deploy/cloudflare/dist
```

Then Cloudflare Pages **asset validation** ran with an **empty `destination_dir`** (repo root), not the staged dist.

```
Error: Pages only supports files up to 25 MiB in size
reports/manual-review/builder-vendor-search/trace-1280.zip is 40.9 MiB
```

Same class of failure appears on older preview commits. It is **not** caused by Rich 4-page wiring logic. It **does** block this PR deploy.

## Why

| Setting | Observed |
|---|---|
| Build command | `npm run build:pages` → writes `deploy/cloudflare/dist` (excludes `reports/`) |
| Pages `destination_dir` / output directory | **empty** → validator walks **repository root** |
| Tracked oversized file | `reports/manual-review/builder-vendor-search/trace-1280.zip` (~40.9 MiB) still in git (`.gitignore` added later; file remains tracked) |

`deploy/cloudflare/stage-cloudflare-pages.mjs` already excludes `reports/` from dist. Dist itself is fine. Validation never looked at dist.

## Fix (this PR)

1. Repo-root `wrangler.toml`:

```toml
name = "tasufull-article"
pages_build_output_dir = "deploy/cloudflare/dist"
compatibility_date = "2026-06-24"
compatibility_flags = [ "nodejs_compat" ]
```

This is output-dir only. No Production secrets, no dashboard env wipe, no Production migrations.

2. Repo-root `.cfignore` — defense in depth if output dir is mis-set again (`reports/`, `**/*.zip`, backups, screenshots).

3. Do **not** delete the zip from history in this change (optional later). Dist never contained it.

## Expected after push

Cloudflare Pages preview must get past asset validation (no 25 MiB zip error) because validation target is `deploy/cloudflare/dist`.
