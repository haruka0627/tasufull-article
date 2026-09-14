# Cloudflare Pages FAIL on HEAD `075347a`

Same root cause as PR29 `ee6b015`:

- Empty `destination_dir` made Pages validate the **repo root**
- `reports/manual-review/builder-vendor-search/trace-1280.zip` is 40.9 MiB > 25 MiB

Fix (copied from PR29, Materials unchanged):

- Repo-root `wrangler.toml` with `pages_build_output_dir = "deploy/cloudflare/dist"`
- `.cfignore` excludes `reports/` and `**/*.zip`
