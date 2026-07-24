# Source Modified 129 — Step 0 分類（HEAD `d7ffd51`）

**生成:** 2026-07-03 · **操作:** 分類のみ（reset/restore/build なし）

## 前提（3-way）

| 関係 | 件数 | 意味 |
| --- | ---: | --- |
| HEAD == ee2efea | **121/129** | Design Audit コミット済み · WT が上書き |
| HEAD != ee2efea | **8/129** | f910903 AI mobile · 条件検索等の post-audit コミット |
| WT != ee2efea | **129/129** | WT は別系統 WIP レイヤー（全体 +34k 行級） |

**8 files HEAD≠ee2efea:** `.env.example` · `ai-model-selector.js` · `ai-workspace.css/html` · `builder/builder.js` · `builder-search-repository.js` · `find-workers.html` · `partners.html`

## サマリー

- **本番へ載せる:** 10 件
- **保留:** 106 件
- **戻す候補:** 13 件

## 今回リリース対象外（抽出）

- AI ref-layout / platform-qa 統合（ai-workspace.* 大差分 · 依存 U 20+）
- Gateway 契約変更（ai-model-gateway.js）
- ai-cross-search / ai-generate-ui 大リライト
- post.html/js ポータル大改修
- builder.js 大改修 · builder-project-calendar 大改修
- favorites-list → dashboard-favorites 移行（依存 U）
- account-delete 導線（依存 U）
- help/QA ルート（_redirects · stage · help/ U）
- platform-qa / help 生成物（root U · dist U）
- live/ PoC（source U · dist のみ M）


---

## AI Workspace

### ■ 保留（14）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `ai-consult-bridge.js` | +30/-2 (32) | HEAD=ee2efea と一致していたファイルの WT 上書き | AI ref-layout / QA 統合 |
| `ai-faq-knowledge.js` | +1/-1 (2) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `ai-interaction-log.js` | +2/-0 (2) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `ai-model-selector.js` | +67/-5 (72) | HEAD に f910903/f4cf7d8 系コミット済 · WT は ref-layout 側の追加差分 | AI ref-layout / QA 統合 |
| `ai-modes.js` | +2/-1 (3) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `ai-search-result-ux.js` | +5/-5 (10) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `ai-search-target.js` | +125/-3 (128) | HEAD=ee2efea と一致していたファイルの WT 上書き | AI ref-layout / QA 統合 |
| `ai-search.js` | +78/-5 (83) | HEAD=ee2efea と一致していたファイルの WT 上書き | HEAD=ee2efea |
| `ai-workspace-category-demos.js` | +45/-57 (102) | HEAD=ee2efea と一致していたファイルの WT 上書き | HEAD=ee2efea |
| `ai-workspace-chat.css` | +89/-24 (113) | HEAD=ee2efea と一致していたファイルの WT 上書き | HEAD=ee2efea |
| `ai-workspace-response-ux.js` | +98/-9 (107) | HEAD=ee2efea と一致していたファイルの WT 上書き | HEAD=ee2efea |
| `ai-workspace-usage.js` | +69/-1 (70) | HEAD=ee2efea と一致していたファイルの WT 上書き | HEAD=ee2efea |
| `tasful-ai-voice-controller.js` | +63/-0 (63) | HEAD=ee2efea と一致していたファイルの WT 上書き | HEAD=ee2efea |
| `tasful-ai-voice-integration.js` | +15/-0 (15) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |

### ■ 戻す候補（8）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `ai-cross-search.js` | +1476/-108 (1584) | 大規模未コミット差分（+1584行級）— AI 基盤 · 単独レビュー必須 | HEAD=ee2efea |
| `ai-generate-ui.js` | +1124/-63 (1187) | 大規模未コミット差分（+1187行級）— AI 基盤 · 単独レビュー必須 | HEAD=ee2efea |
| `ai-model-gateway.js` | +48/-6 (54) | AD-005 契約変更（RoutingSettings 統合 · history 引数）— 本リリース対象外 | Gateway ルーティング設定 |
| `ai-workspace-categories.js` | +52/-3 (55) | HEAD=ee2efea 上書き · AI ref-layout/QA WIP（f910903 mobile composer と非両立） | AI ref-layout / QA 統合 |
| `ai-workspace-chat.js` | +211/-34 (245) | HEAD=ee2efea 上書き · AI ref-layout/QA WIP（f910903 mobile composer と非両立） | HEAD=ee2efea |
| `ai-workspace-voice.js` | +16/-0 (16) | HEAD=ee2efea 上書き · AI ref-layout/QA WIP（f910903 mobile composer と非両立） | AI ref-layout / QA 統合 |
| `ai-workspace.css` | +751/-315 (1066) | f910903 以降 HEAD を ref-layout WIP で上書き（+455/-159 html 等） | AI ref-layout / QA 統合 |
| `ai-workspace.html` | +455/-159 (614) | f910903 以降 HEAD を ref-layout WIP で上書き（+455/-159 html 等） | AI ref-layout / QA 統合, パンくず |


---

## TASFUL Talk

### ■ 本番へ載せる（1）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `talk-home.html` | +2/-0 (2) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線, Talk スレッド |

### ■ 保留（12）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `chat-detail.html` | +72/-1 (73) | Builder→Talk 導線 | Builder→Talk 導線 |
| `chat-detail.js` | +123/-14 (137) | Talk チャット詳細 +123/-14 — Review 後追い差分 · 目視要 | HEAD=ee2efea |
| `chat-supabase-config.example.js` | +3/-0 (3) | Talk 小差分 — HEAD=ee2efea からの WT 上書き | HEAD=ee2efea |
| `chat-thread-store.js` | +4/-0 (4) | Talk スレッド | Talk スレッド |
| `chat.css` | +932/-9 (941) | Talk 大差分 941行 — FROZEN 上の UI/モデル変更 | HEAD=ee2efea |
| `talk-chat-profile.js` | +21/-1 (22) | Talk 小差分 — HEAD=ee2efea からの WT 上書き | HEAD=ee2efea |
| `talk-chat-thread-model.js` | +35/-1 (36) | Talk スレッド | Talk スレッド |
| `talk-home-data.js` | +4/-3 (7) | Builder→Talk 導線 | Builder→Talk 導線 |
| `talk-home.css` | +72/-0 (72) | パンくず | パンくず |
| `talk-home.js` | +22/-0 (22) | Talk 小差分 — HEAD=ee2efea からの WT 上書き | HEAD=ee2efea |
| `talk-line-room.js` | +15/-4 (19) | Talk 小差分 — HEAD=ee2efea からの WT 上書き | HEAD=ee2efea |
| `talk-notify-actions.js` | +1/-1 (2) | Builder→Talk 導線 | Builder→Talk 導線 |


---

## Builder

### ■ 本番へ載せる（9）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `builder/board-projects.html` | +1/-1 (2) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |
| `builder/board-thread.html` | +17/-0 (17) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |
| `builder/board-threads.html` | +3/-0 (3) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |
| `builder/index.html` | +3/-3 (6) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |
| `builder/mvp-thread.html` | +23/-0 (23) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |
| `builder/mvp-threads.html` | +10/-1 (11) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |
| `builder/thread.html` | +24/-2 (26) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |
| `builder/threads.html` | +3/-1 (4) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |
| `builder/user-dashboard.html` | +6/-18 (24) | mvp-threads → talk-home 導線（Builder→Talk Review 整合 · 小差分） | Builder→Talk 導線 |

### ■ 保留（9）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `builder/builder-event-hub.js` | +14/-0 (14) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `builder/builder-project-calendar.css` | +1093/-118 (1211) | Builder FROZEN · 大差分 1211行 — 条件検索/カレンダー等 WIP の可能性 | パンくず |
| `builder/builder-project-calendar.js` | +772/-90 (862) | Builder FROZEN · 大差分 862行 — 条件検索/カレンダー等 WIP の可能性 | HEAD=ee2efea |
| `builder/builder-search-repository.js` | +57/-25 (82) | 条件検索 UI — HEAD に repository 済 · WT は追加調整 | Builder 条件検索 |
| `builder/builder.css` | +219/-0 (219) | Builder FROZEN · 大差分 219行 — 条件検索/カレンダー等 WIP の可能性 | HEAD=ee2efea |
| `builder/find-workers.html` | +89/-11 (100) | 条件検索 UI — HEAD に repository 済 · WT は追加調整 | パンくず, Talk スレッド, Builder 条件検索 |
| `builder/partner.html` | +12/-0 (12) | パンくず · Talk スレッド | パンくず, Talk スレッド |
| `builder/partners.html` | +5/-0 (5) | パンくず · Talk スレッド · Builder 条件検索 | パンくず, Talk スレッド, Builder 条件検索 |
| `builder/project-calendar.html` | +336/-51 (387) | Builder FROZEN · 大差分 387行 — 条件検索/カレンダー等 WIP の可能性 | パンくず |

### ■ 戻す候補（1）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `builder/builder.js` | +902/-129 (1031) | Builder FROZEN 上の大差分（902+129行）— Talk 導線以外の機能変更リスク | Talk スレッド |


---

## Platform

### ■ 保留（32）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `dashboard.css` | +314/-0 (314) | Platform 公開面 大差分 314行 — portal/listing WIP | HEAD=ee2efea |
| `dashboard.js` | +13/-2 (15) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | Builder→Talk 導線, お気に入り URL 整理, 退会ページ導線 |
| `detail-favorites.js` | +2/-1 (3) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | お気に入り URL 整理 |
| `detail-nav-context.js` | +1/-1 (2) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | Builder→Talk 導線, お気に入り URL 整理 |
| `detail-product-mobile.css` | +1/-3 (4) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `detail-product.css` | +1/-3 (4) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `detail-product.html` | +16/-3 (19) | ランクプレート | ランクプレート |
| `detail-skill-premium.css` | +12/-0 (12) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `detail-skill.html` | +24/-12 (36) | HEAD=ee2efea と一致していたファイルの WT 上書き | ランクプレート |
| `detail-worker.html` | +16/-3 (19) | ランクプレート | ランクプレート |
| `favorite-store.js` | +66/-1 (67) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | お気に入り URL 整理 |
| `favorites-list.html` | +11/-121 (132) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | お気に入り URL 整理, パンくず |
| `favorites-list.js` | +9/-678 (687) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | お気に入り URL 整理, Design Audit 系 |
| `index.html` | +3/-1 (4) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | お気に入り URL 整理 |
| `listing-category-page.js` | +5/-0 (5) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `listing-detail-loader.js` | +8/-2 (10) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `listing-local-store.js` | +34/-7 (41) | Platform 中差分 — polish / listing 調整 | HEAD=ee2efea |
| `listing-renderer.js` | +97/-4 (101) | Platform 中差分 — polish / listing 調整 | Design Audit 系 |
| `listing-route-resolver.js` | +7/-1 (8) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `listing-seller-profile.js` | +62/-5 (67) | Platform 中差分 — polish / listing 調整 | ランクプレート |
| `member-auth.js` | +1/-0 (1) | account-delete 導線 — account-delete.html 等が U（未コミット依存） | 退会ページ導線 |
| `member-profile.js` | +112/-8 (120) | Platform 中差分 — polish / listing 調整 | HEAD=ee2efea |
| `post-draft-agent.js` | +95/-32 (127) | Platform 中差分 — polish / listing 調整 | Design Audit 系 |
| `product-listing-fields.js` | +25/-3 (28) | HEAD=ee2efea と一致していたファイルの WT 上書き | HEAD=ee2efea |
| `product.html` | +1/-0 (1) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `profile-edit.html` | +17/-0 (17) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `profile-settings.html` | +87/-7 (94) | account-delete 導線 — account-delete.html 等が U（未コミット依存） | 退会ページ導線 |
| `profile-settings.js` | +185/-2 (187) | Platform 公開面 大差分 187行 — portal/listing WIP | HEAD=ee2efea |
| `search.js` | +8/-1 (9) | Design Audit 系 | Design Audit 系 |
| `shared/voice-core/voice-core.js` | +2/-0 (2) | Voice Phase 3 準備 — Gemini Live 系 · Future | HEAD=ee2efea |
| `skill.html` | +1/-0 (1) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |
| `worker.html` | +1/-0 (1) | 小差分 — HEAD 基準で影響範囲要確認 | HEAD=ee2efea |

### ■ 戻す候補（4）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `platform-builder-ops-partner-bench.js` | +8/-6 (14) | 運営ベンチ用 JS — 本番公開面外 | Builder→Talk 導線 |
| `post.css` | +93/-225 (318) | 投稿/ポータル UI 大規模書き換え — NB-1M FROZEN 外の WIP | HEAD=ee2efea |
| `post.html` | +361/-474 (835) | 投稿/ポータル UI 大規模書き換え — NB-1M FROZEN 外の WIP | パンくず |
| `post.js` | +511/-371 (882) | 投稿/ポータル UI 大規模書き換え — NB-1M FROZEN 外の WIP | HEAD=ee2efea |


---

## Business Directory

### ■ 保留（11）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `business-directory-repository.js` | +22/-0 (22) | BD polish 小差分 — FROZEN 扱い · 別バンドル | HEAD=ee2efea |
| `business-directory/business-directory-common.js` | +196/-15 (211) | BD UI/Owner 大差分 211行 — DB Prod Go 済 · Commercial Launch 外 WIP | HEAD=ee2efea |
| `business-directory/business-directory-owner.js` | +598/-88 (686) | BD UI/Owner 大差分 686行 — DB Prod Go 済 · Commercial Launch 外 WIP | HEAD=ee2efea |
| `business-directory/business-directory.css` | +458/-0 (458) | BD UI/Owner 大差分 458行 — DB Prod Go 済 · Commercial Launch 外 WIP | HEAD=ee2efea |
| `business-directory/edit.html` | +49/-0 (49) | BD polish 小差分 — FROZEN 扱い · 別バンドル | HEAD=ee2efea |
| `business-directory/index.html` | +18/-3 (21) | BD polish 小差分 — FROZEN 扱い · 別バンドル | Help/QA redirect |
| `business-directory/new.html` | +47/-3 (50) | BD polish 小差分 — FROZEN 扱い · 別バンドル | HEAD=ee2efea |
| `business-directory/public/business-directory-public.css` | +135/-0 (135) | BD polish 小差分 — FROZEN 扱い · 別バンドル | HEAD=ee2efea |
| `business-directory/public/business-directory-public.js` | +142/-109 (251) | BD UI/Owner 大差分 251行 — DB Prod Go 済 · Commercial Launch 外 WIP | HEAD=ee2efea |
| `business-directory/public/detail.html` | +4/-0 (4) | BD polish 小差分 — FROZEN 扱い · 別バンドル | HEAD=ee2efea |
| `business-directory/public/list.html` | +1/-0 (1) | BD polish 小差分 — FROZEN 扱い · 別バンドル | HEAD=ee2efea |


---

## deploy

### ■ 保留（2）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `deploy/cloudflare/_redirects` | +28/-1 (29) | favorites · ai-workspace · help/QA 301 追加 — 依存ページ（help/* · dashboard-favorites）が U のため単独載せ不可 | お気に入り URL 整理, 退会ページ導線, Help/QA redirect |
| `deploy/cloudflare/stage-cloudflare-pages.mjs` | +95/-0 (95) | stage 定義 +95行（help/platform-qa 等のステージ追加想定）— 生成物 U とセット判断 | AI ref-layout / QA 統合, Help/QA redirect, Design Audit 系 |


---

## 共通UI/CSS

### ■ 保留（23）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `breadcrumb-config.js` | +6/-2 (8) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | Builder→Talk 導線, お気に入り URL 整理, パンくず |
| `common-breadcrumb.js` | +1/-1 (2) | favorites-list → dashboard-favorites 移行 WIP（REL-P1-02 · 依存 U 多数） | お気に入り URL 整理, パンくず |
| `images/rank/bronze.png` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/bronze.webp` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/gold.png` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/gold.webp` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/legend.png` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/legend.webp` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/new.png` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/new.webp` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/platinum.png` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/platinum.webp` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/silver.png` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `images/rank/silver.webp` | binary | ランクプレート画像バイナリ差分 — trim-rank-plates 系 · 要デザイン確認 | ランクプレート |
| `index-home.css` | +134/-11 (145) | ランクプレート | ランクプレート |
| `index-home.js` | +96/-18 (114) | ランクプレート | ランクプレート |
| `seller-rank-plate.css` | +92/-0 (92) | ランクプレート | ランクプレート |
| `tasful-app-mobile-detail.css` | +0/-1 (1) | Design Audit 後の追加 polish（HEAD=ee2efea から差分） | HEAD=ee2efea |
| `tasful-app-mobile.css` | +28/-0 (28) | Design Audit 後の追加 polish（HEAD=ee2efea から差分） | HEAD=ee2efea |
| `tasful-general-ai-shell.js` | +151/-16 (167) | General AI シェル +167行 — ref-layout / QA 連動 WIP | AI ref-layout / QA 統合 |
| `tasful-general-ai.css` | +6/-6 (12) | AI ref-layout / QA 統合 | AI ref-layout / QA 統合 |
| `tasful-site-assistant.js` | +1/-1 (2) | Design Audit 後の追加 polish（HEAD=ee2efea から差分） | HEAD=ee2efea |
| `top.css` | +9/-2 (11) | Design Audit 後の追加 polish（HEAD=ee2efea から差分） | HEAD=ee2efea |


---

## その他

### ■ 保留（3）

| パス | HEAD差分 | 変更理由（推定） | 備考 |
| --- | --- | --- | --- |
| `.env.example` | +18/-4 (22) | リポジトリ設定 — 意図確認後に別コミット | HEAD≠ee2efea |
| `.gitignore` | +1/-0 (1) | リポジトリ設定 — 意図確認後に別コミット | HEAD=ee2efea |
| `README.md` | +4/-2 (6) | リポジトリ設定 — 意図確認後に別コミット | Builder→Talk 導線 |

