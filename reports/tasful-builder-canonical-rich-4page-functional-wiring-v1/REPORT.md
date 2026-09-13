# TASFUL Builder — Canonical Rich 4-Page Functional Wiring V1

## Outcome

Builder TOP の主 Create は Rich `new-project.html` を開く。Builder 内部の Register は Rich `provider-profile.html`。IWASHO `/partner-register.html`・案件検索・職人検索は維持。MVP 暗色ルートは削除していない。

`origin/cf-pages-deploy` には仮説の移植済み Rich HTML / `builder-new-project-general-jobs-wire.js` / `builder-top-route-bridge.js` は無かった。添付 ui4-03 / ui4-02 を視覚 SSOT にした **isolated light host** を追加し、機能だけ MVP から抽出した。暗色 `builder.css` は Rich 3 ページに import していない。

## Persistence

| Kind | SSOT | Gate |
|---|---|---|
| Job | `builder_projects` `kind=builder_board`（public 投影 `builder_public_projects_v1` は読取） | `TASU_BUILDER_GENERAL_JOBS_REPO=true` |
| Provider | `builder_partners` + 可能なら `builder_workers` | `TasuBuilderPartnerSupabaseSync`（client があるとき） |
| localStorage | COMPAT_CACHE only | 常時ミラー可。新規 SSOT にしない |

Dual-write: **Supabase first → MVP/ProviderStore mirror**。Staging 失敗時は成功表示しない。

Production マイグレーション（とくに `20260914120000` / `20260914130000` `builder_projects*`）は **追加も適用もしない**。

## QA

```bash
node scripts/qa-builder-canonical-rich-4page.mjs
node scripts/qa-builder-canonical-rich-4page-core-smoke.mjs
```

静的判定 21 PASS / 0 FAIL / 1 SKIP（Staging シークレット無し）。  
コア smoke: job/provider COMPAT_CACHE 作成と canonical redirect を確認。flag OFF では Supabase を叩かない。  
Staging シークレットが CI/env にある場合のみ live write を試みる（値は出力しない）。

### Human QA（8788）

1. `http://127.0.0.1:8788/builder/builder-top.html` — 案件を投稿する → `/builder/new-project.html`
2. 同 TOP の IWASHO 協力パートナー登録 → `/partner-register.html?source=builder`
3. フッター「職人・協力会社プロフィール登録」→ `/builder/provider-profile.html`
4. Staging persist: ブラウザで `localStorage.setItem('TASU_BUILDER_GENERAL_JOBS_REPO','true')` のうえ、Staging anon client が載っているホストで投稿。`project-detail.html?id=` に遷移し、Staging `builder_projects` を確認。
5. Provider 保存後 `provider-detail.html?id=`。
6. `find-workers.html` で検索 → 詳細 → `provider-detail.html?id=`。
7. MVP URL（`mvp-post.html` 等）が 404 にならないこと。
8. CTA: Talk は thread 無しなら NOT_BOUND。正式依頼 / 質問は NOT_BOUND。応募は job id があるときのみ。

Visual QA は人間が外部 Chrome で行う（本エージェントは Browser Automation を使わない）。

## Files

Wire / repo:

- `builder/builder-canonical-routes.js`
- `builder/builder-compat-cache.js`
- `builder/builder-general-jobs-repo.js`
- `builder/builder-partner-supabase-sync.js`
- `builder/builder-provider-store.js`
- `builder/builder-job-create-core.js`
- `builder/builder-partner-register-core.js`
- `builder/builder-new-project-wire.js`
- `builder/builder-provider-profile-wire.js`
- `builder/builder-provider-detail-wire.js`
- `builder/builder-project-detail-canonical-wire.js`
- `builder/builder-top-route-bridge.js`
- `builder/builder-search-detail-bridge.js`
- `builder/builder-cta-bind.js`
- `builder/builder-canonical-rich.css`

Hosts: `new-project.html` / `provider-profile.html` / `provider-detail.html`  
既存: `project-detail.html`（bind パネル追加） / `builder-top.html` / `find-workers.html` / `partners.html` / `mvp-post.html` / `mvp-partner-register.html` / `mvp-project-new.html` / `builder.js`（submit を core 経由）

## Safety

| Item | Status |
|---|---|
| PRODUCTION_MIGRATION | NO |
| SECRET_LEAK | NO |
| Dark MVP CSS on Rich hosts | NO |
| MVP routes deleted | NO |
| Fake CTA success | NO |
