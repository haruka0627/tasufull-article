# Route B — restore 予定一覧（未実行）

生成: 2026-07-03T15:26:47.334Z
HEAD: d7ffd51 以降 · Step 0 分類 · ルート B

## 方針

- 載せる 11 件は別コミット済み（またはコミット予定）
- 以下は `git restore --source=HEAD -- <path>` 予定（**まだ実行しない**）
- build:pages 前に HEAD 基準へ戻し REL-P0-04 を安全化

## サマリー

- 載せる（除外）: 11
- restore 予定合計: 118
  - 明示戻す（13）: 13
  - 保留→HEAD（105）: 105

---

## 明示戻す — 13 件

- ai-cross-search.js
- ai-generate-ui.js
- ai-model-gateway.js
- ai-workspace.css
- ai-workspace.html
- ai-workspace-categories.js
- ai-workspace-chat.js
- ai-workspace-voice.js
- builder/builder.js
- platform-builder-ops-partner-bench.js
- post.css
- post.html
- post.js

---

## 保留 → HEAD — 105 件

- .env.example
- .gitignore
- ai-consult-bridge.js
- ai-faq-knowledge.js
- ai-interaction-log.js
- ai-model-selector.js
- ai-modes.js
- ai-search.js
- ai-search-result-ux.js
- ai-search-target.js
- ai-workspace-category-demos.js
- ai-workspace-chat.css
- ai-workspace-response-ux.js
- ai-workspace-usage.js
- breadcrumb-config.js
- builder/builder.css
- builder/builder-event-hub.js
- builder/builder-project-calendar.css
- builder/builder-project-calendar.js
- builder/builder-search-repository.js
- builder/find-workers.html
- builder/partner.html
- builder/partners.html
- builder/project-calendar.html
- business-directory/business-directory.css
- business-directory/business-directory-common.js
- business-directory/business-directory-owner.js
- business-directory/edit.html
- business-directory/index.html
- business-directory/new.html
- business-directory/public/business-directory-public.css
- business-directory/public/business-directory-public.js
- business-directory/public/detail.html
- business-directory/public/list.html
- business-directory-repository.js
- chat.css
- chat-detail.html
- chat-detail.js
- chat-supabase-config.example.js
- chat-thread-store.js
- common-breadcrumb.js
- dashboard.css
- dashboard.js
- deploy/cloudflare/_redirects
- deploy/cloudflare/stage-cloudflare-pages.mjs
- detail-favorites.js
- detail-nav-context.js
- detail-product.css
- detail-product.html
- detail-product-mobile.css
- detail-skill.html
- detail-skill-premium.css
- detail-worker.html
- favorites-list.html
- favorites-list.js
- favorite-store.js
- images/rank/bronze.png
- images/rank/bronze.webp
- images/rank/gold.png
- images/rank/gold.webp
- images/rank/legend.png
- images/rank/legend.webp
- images/rank/new.png
- images/rank/new.webp
- images/rank/platinum.png
- images/rank/platinum.webp
- images/rank/silver.png
- images/rank/silver.webp
- index.html
- index-home.css
- index-home.js
- listing-category-page.js
- listing-detail-loader.js
- listing-local-store.js
- listing-renderer.js
- listing-route-resolver.js
- listing-seller-profile.js
- member-auth.js
- member-profile.js
- post-draft-agent.js
- product.html
- product-listing-fields.js
- profile-edit.html
- profile-settings.html
- profile-settings.js
- README.md
- search.js
- seller-rank-plate.css
- shared/voice-core/voice-core.js
- skill.html
- talk-chat-profile.js
- talk-chat-thread-model.js
- talk-home.css
- talk-home-data.js
- talk-line-room.js
- talk-notify-actions.js
- tasful-ai-voice-controller.js
- tasful-ai-voice-integration.js
- tasful-app-mobile.css
- tasful-app-mobile-detail.css
- tasful-general-ai.css
- tasful-general-ai-shell.js
- tasful-site-assistant.js
- top.css
- worker.html
