# Cloudflare Pages FAIL on HEAD `075347a`

Same root cause as PR29 `ee6b015`:

- Empty `destination_dir` made Pages validate the **repo root**
- `reports/manual-review/builder-vendor-search/trace-1280.zip` is 40.9 MiB > 25 MiB

Fix (copied from PR29, Materials unchanged):

- Repo-root `wrangler.toml` with `pages_build_output_dir = "deploy/cloudflare/dist"`
- `.cfignore` excludes `reports/` and `**/*.zip`

## Cloudflare Pages PASS

- **HEAD:** `18b8534eab0ddf9fff8ee9423cb14a556f85dc55`
- **Check:** Cloudflare Pages — **success**
- **Dashboard:** https://dash.cloudflare.com/?to=/002d3d2e2ea8fc31da54a2c79a2dad12/pages/view/tasufull-article/4c79d360-a59c-4fc6-ac2a-6e54bf7a09f4
- **PR:** https://github.com/haruka0627/tasufull-article/pull/30
