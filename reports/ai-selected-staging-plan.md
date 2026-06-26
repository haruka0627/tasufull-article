# AI 選別ステージング手順

実施日: 2026-06-26  
目的: **`git add -A` を使わず**、今回の AI 関連実装だけを安全にステージングする（**コミットは別途**）。

---

## 判定（Go / No Go）

| 操作 | 判定 | 理由 |
| --- | --- | --- |
| `git add -A` 一括 | **No Go** | 622 件混在（ANPI / Live / TLV シミュ / Builder 全 HTML / プローブ等） |
| 本手順の選別ステージング | **Go** | ビルド・主要回帰テストは `pre-commit-final-check.md` で PASS。対象を ~180 件に限定可能 |
| 本手順実行後のコミット | **Go（条件付き）** | ステージング後の `git diff --cached` 確認 + ビルド/テスト再実行が PASS であること |

**保留（ステージしない）**

- `ai-model-gateway.js` / `deploy/cloudflare/dist/ai-model-gateway.js` — 直近フェーズ外の +73 行 diff。別 PR または diff レビュー後に判断
- `supabase/functions/_shared/ai-attachments.ts` — 添付連携。Gateway 除外とセットで判断
- `package.json` — wrangler `--compatibility-date` のみ（AI 無関係）

---

## 前提

```powershell
cd c:\Users\rubih\tasufull-article
# 作業前: ステージング領域を空にする（未コミットの staged がある場合）
git reset
```

**推奨順序:** ソース → テスト → レポート → `npm run build:pages` → dist ミラー

---

## 1. git add コマンド一覧（PowerShell）

### 1-A. AI 規約 / 免責

```powershell
git add ai-terms.html ai-disclaimer.html common-ai-disclaimer.js common-ai-disclaimer.css
git add builder/builder-ai-guidelines.html builder/builder-ai-disclaimer.js
```

### 1-B. TASFUL AI Workspace / Final（履歴・動画・音楽・資料・音声）

```powershell
git add ai-workspace.html ai-workspace.css ai-workspace-chat.js ai-workspace-chat.css
git add ai-workspace-links.js ai-generate-ui.js tasful-general-ai-shell.js
git add ai-history-store.js ai-video-generate.js ai-music-generate.js ai-document-generate.js
git add ai-media-gen-config.js ai-workspace-categories.js ai-workspace-categories.css
git add ai-workspace-history-bridge.js ai-workspace-tlv-source.js
git add ai-workspace-attachments.js ai-workspace-voice.js
git add tasful-ai-voice-core.js tasful-ai-voice.css
git add live/tlv-tasful-ai-entry.js
```

### 1-C. Builder AI

```powershell
git add builder/builder-ai.html
git add builder/builder-ai-actions.js builder/builder-ai-adapter.js builder/builder-ai-calculators.js
git add builder/builder-ai-candidate-recommend.js builder/builder-ai-context.js builder/builder-ai-core.js
git add builder/builder-ai-disclaimer.js builder/builder-ai-draft-store.js builder/builder-ai-draft-supabase.js
git add builder/builder-ai-engine.js builder/builder-ai-guidelines.html builder/builder-ai-jwt-resolver.js
git add builder/builder-ai-page.js builder/builder-ai-practice-assist.js builder/builder-ai-search-assist.js
git add builder/builder-ai-tax-assist.js builder/builder-ai-tool-router.js builder/builder-ai-tools.js
git add builder/tool-ai-cost-analysis.html builder/tool-ai-estimate.html
git add builder/tool-ai-quantity-support.html builder/tool-ai-schedule-suggest.html
git add sql/builder-ai-drafts-staging.sql
```

### 1-D. Platform AI / バッジ / お気に入り / AI 検索 / AI 比較

```powershell
git add platform-ai-recommend.js platform-badges.js platform-badges.css
git add platform-search-assist.js platform-compare-assist.js platform-search-hub.js platform-search-hub.css
git add platform-favorites-folders.js platform-google-auth.js platform-location-search.js platform-category-kyc.js
git add listing-renderer.js listing-category-page.js listing-feed.js
git add favorites-list.html favorites-list.js favorites-list.css
git add index-top.html business-board-page.js business-board-renderer.js
git add business.html product.html skill.html worker.html search.js
git add login.html login.js signup.html signup.js
```

### 1-E. 関連テスト（推奨セット）

```powershell
git add scripts/test-ai-terms-disclaimer.mjs
git add scripts/test-builder-ai-tools-adaptation.mjs scripts/test-builder-ai-p1-review.mjs
git add scripts/test-builder-ai-p1.mjs scripts/test-builder-ai-p2-a.mjs scripts/test-builder-ai-p2-b.mjs
git add scripts/test-platform-finish-phase.mjs scripts/test-platform-next-phase.mjs
git add scripts/test-tasful-ai-final-phase.mjs scripts/test-tlv-tasful-ai-entry.mjs
```

#### 1-E-optional. ブラウザ系（必要時のみ・迷ったらスキップ）

```powershell
# git add scripts/test-tasful-ai-final-smoke-browser.mjs
# git add scripts/test-ai-voice-core-browser.mjs
# git add scripts/test-tasful-ai-attach-vision-browser.mjs
```

### 1-F. 関連レポート

```powershell
git add reports/ai-terms-disclaimer.md
git add reports/builder-ai-architecture.md reports/builder-ai-jwt-rls-design.sql
git add reports/builder-ai-live-gateway-qa-checklist.md
git add reports/builder-ai-p1.md reports/builder-ai-p1-review.md
git add reports/builder-ai-p2-a.md reports/builder-ai-p2-b.md reports/builder-ai-tools-adaptation.md
git add reports/platform-finish-phase.md reports/platform-next-phase.md
git add reports/tasful-ai-final-phase.md reports/tasful-ai-final-smoke.md
git add reports/tlv-tasful-ai-entry.md
git add reports/ai-voice-core-first.md reports/tasful-ai-attach-vision-first.md
git add reports/pre-commit-final-check.md
git add reports/ai-selected-staging-plan.md
```

### 1-G. ビルド → dist ミラー（ソースステージ後）

```powershell
npm run build:pages
```

```powershell
# TASFUL AI / 規約
git add deploy/cloudflare/dist/ai-terms.html deploy/cloudflare/dist/ai-disclaimer.html
git add deploy/cloudflare/dist/common-ai-disclaimer.js deploy/cloudflare/dist/common-ai-disclaimer.css
git add deploy/cloudflare/dist/ai-workspace.html deploy/cloudflare/dist/ai-workspace.css
git add deploy/cloudflare/dist/ai-workspace-chat.js deploy/cloudflare/dist/ai-workspace-chat.css
git add deploy/cloudflare/dist/ai-workspace-links.js deploy/cloudflare/dist/ai-generate-ui.js
git add deploy/cloudflare/dist/ai-history-store.js deploy/cloudflare/dist/ai-video-generate.js
git add deploy/cloudflare/dist/ai-music-generate.js deploy/cloudflare/dist/ai-document-generate.js
git add deploy/cloudflare/dist/ai-media-gen-config.js
git add deploy/cloudflare/dist/ai-workspace-categories.js deploy/cloudflare/dist/ai-workspace-categories.css
git add deploy/cloudflare/dist/ai-workspace-history-bridge.js deploy/cloudflare/dist/ai-workspace-tlv-source.js
git add deploy/cloudflare/dist/ai-workspace-attachments.js deploy/cloudflare/dist/ai-workspace-voice.js
git add deploy/cloudflare/dist/tasful-general-ai-shell.js deploy/cloudflare/dist/tasful-general-ai.css
git add deploy/cloudflare/dist/tasful-ai-voice-core.js deploy/cloudflare/dist/tasful-ai-voice.css
git add deploy/cloudflare/dist/live/tlv-tasful-ai-entry.js

# Builder AI dist
git add deploy/cloudflare/dist/builder/builder-ai.html
git add deploy/cloudflare/dist/builder/builder-ai-actions.js deploy/cloudflare/dist/builder/builder-ai-adapter.js
git add deploy/cloudflare/dist/builder/builder-ai-calculators.js deploy/cloudflare/dist/builder/builder-ai-candidate-recommend.js
git add deploy/cloudflare/dist/builder/builder-ai-context.js deploy/cloudflare/dist/builder/builder-ai-core.js
git add deploy/cloudflare/dist/builder/builder-ai-disclaimer.js deploy/cloudflare/dist/builder/builder-ai-draft-store.js
git add deploy/cloudflare/dist/builder/builder-ai-draft-supabase.js deploy/cloudflare/dist/builder/builder-ai-engine.js
git add deploy/cloudflare/dist/builder/builder-ai-guidelines.html deploy/cloudflare/dist/builder/builder-ai-jwt-resolver.js
git add deploy/cloudflare/dist/builder/builder-ai-page.js deploy/cloudflare/dist/builder/builder-ai-practice-assist.js
git add deploy/cloudflare/dist/builder/builder-ai-search-assist.js deploy/cloudflare/dist/builder/builder-ai-tax-assist.js
git add deploy/cloudflare/dist/builder/builder-ai-tool-router.js deploy/cloudflare/dist/builder/builder-ai-tools.js
git add deploy/cloudflare/dist/builder/tool-ai-cost-analysis.html deploy/cloudflare/dist/builder/tool-ai-estimate.html
git add deploy/cloudflare/dist/builder/tool-ai-quantity-support.html deploy/cloudflare/dist/builder/tool-ai-schedule-suggest.html
git add deploy/cloudflare/dist/sql/builder-ai-drafts-staging.sql

# Platform dist
git add deploy/cloudflare/dist/platform-ai-recommend.js deploy/cloudflare/dist/platform-badges.js deploy/cloudflare/dist/platform-badges.css
git add deploy/cloudflare/dist/platform-search-assist.js deploy/cloudflare/dist/platform-compare-assist.js
git add deploy/cloudflare/dist/platform-search-hub.js deploy/cloudflare/dist/platform-search-hub.css
git add deploy/cloudflare/dist/platform-favorites-folders.js deploy/cloudflare/dist/platform-google-auth.js
git add deploy/cloudflare/dist/platform-location-search.js deploy/cloudflare/dist/platform-category-kyc.js
git add deploy/cloudflare/dist/listing-renderer.js deploy/cloudflare/dist/listing-category-page.js deploy/cloudflare/dist/listing-feed.js
git add deploy/cloudflare/dist/favorites-list.html deploy/cloudflare/dist/favorites-list.js deploy/cloudflare/dist/favorites-list.css
git add deploy/cloudflare/dist/index-top.html
git add deploy/cloudflare/dist/business-board-page.js deploy/cloudflare/dist/business-board-renderer.js deploy/cloudflare/dist/business.html
git add deploy/cloudflare/dist/product.html deploy/cloudflare/dist/skill.html deploy/cloudflare/dist/worker.html deploy/cloudflare/dist/search.js
git add deploy/cloudflare/dist/login.html deploy/cloudflare/dist/login.js
git add deploy/cloudflare/dist/signup.html deploy/cloudflare/dist/signup.js deploy/cloudflare/dist/signup.css
```

**想定ステージ件数:** ソース ~95 + dist ~85 + テスト 10 + レポート 18 ≈ **208 件**（optional テスト除く）

---

## 2. 除外ファイル一覧

### 2-A. ユーザー指定の除外

| パス | 理由 |
| --- | --- |
| `reports/_gemini-recovery-probe.png` | プローブ画像 |
| `reports/gemini-billing-recovery-probes.json` | `*probes*.json` |
| `reports/tasful-ai-production-environment-probes.json` | プローブ |
| `reports/tasful-ai-production-preflight-probe.json` | プローブ |
| `reports/tasful-ai-access-workspace-check.json` | チェック用 JSON |
| `reports/tlv-business-simulator/**` | TLV シミュレータ（AI スコープ外） |
| `anpi-*`, `deploy/cloudflare/dist/anpi-*` | ANPI |
| `live/*`（`live/tlv-tasful-ai-entry.js` 除く） | Live 無関係 |
| `deploy/cloudflare/dist/live/*`（`tlv-tasful-ai-entry.js` 除く） | 同上 |
| `builder/*.html`（`builder-ai*` / `tool-ai-*` 除く） | Builder 無関係 HTML |
| `.wrangler/**`, `node_modules/**` | tmp / cache |
| `.env`, `.env.*` | 環境変数 |
| 秘密情報ファイル全般 | token / secret |

### 2-B. AI 近傍だが今回ステージしない（要別判断）

| パス | 理由 |
| --- | --- |
| `ai-model-gateway.js` | Gateway 契約外 diff (+73 行) |
| `deploy/cloudflare/dist/ai-model-gateway.js` | 同上 |
| `ai-ops-case-store.js` | Ops / Secretary 系 |
| `deploy/cloudflare/dist/ai-ops-case-store.js` | 同上 |
| `admin-ai-secretary-*`, `admin-ai-*` | AI Secretary（別スコープ） |
| `admin-operations-dashboard.*` | Admin Ops |
| `post.js`, `deploy/cloudflare/dist/post.js` | AI 配線対象外 |
| `platform-chat-*`, `platform-ops-*`, `platform-content-gate-*`, `platform-moderation-*` | Platform chat/ops（Finish フェーズ外） |
| `deploy/cloudflare/dist/platform-chat-*` 等 | 同上 |
| `platform-actor-resolver.js` | 配線根拠が本フェーズレポートに無い |
| `supabase/functions/*/index.ts` | Edge chat 変更（スコープ外） |
| `supabase/functions/_shared/ai-attachments.ts` | Gateway 添付。迷うため保留 |
| `package.json` | dev スクリプトの compatibility-date のみ |
| `deploy/cloudflare/_redirects`, `deploy/cloudflare/dist/_redirects` | リダイレクト全体変更 |
| `deploy/cloudflare/dist/business-listings-db.js` 等 listing 周辺 DB | バッジ配線外 |
| `scripts/test-tasful-ai-production-preflight.mjs` | 本番プローブ |
| `scripts/test-builder-ai-live-e2e.mjs`, `test-builder-ai-live-qa.mjs` | Live/Gateway QA（別タイミング） |
| `scripts/test-admin-ai-*` | Secretary |
| `reports/tasful-ai-production-*.md/json` | 本番調査・プローブ |
| `reports/tasful-ai-current-status.md` | ステータスメモ（フェーズ成果物外） |
| `reports/ai-secretary-text-chat-first.md` | Secretary |
| `reports/_staging-status.tmp` | 作業用一時ファイル |
| `reports/platform-nb1m-frontend-prod-deploy-ready.md` (M) | デプロイ準備（AI フェーズ外） |

### 2-C. ステージング後に `--cached` に出てはいけない代表例

```
admin-operations-dashboard.*
anpi-*
builder/admin-*.html
builder/mvp-*.html
builder/board-*.html
ai-model-gateway.js
ai-ops-case-store.js
reports/_gemini-recovery-probe.png
reports/*probes*.json
live/live-notifications-page.js  (削除のみの場合は意図確認)
.wrangler/**
```

---

## 3. ステージング後確認

### 3-A. キャッシュ diff

```powershell
git diff --cached --name-status
git diff --cached --stat
```

**チェックリスト**

- [ ] 件数が ~200 前後（622 件になっていない）
- [ ] `ai-model-gateway.js` が含まれていない
- [ ] `anpi-*` / `admin-ai-secretary-*` が含まれていない
- [ ] `reports/*probe*` が含まれていない
- [ ] `builder/mvp-*` / `builder/admin-*` が含まれていない
- [ ] dist は上記リストのミラーのみ（dist 全 264 新規 untracked を add していない）

### 3-B. ビルド

```powershell
npm run build:pages
```

期待: **PASS**（dist に未ステージの差分が出た場合は 1-G を再実行）

### 3-C. 主要テスト

```powershell
node scripts/test-builder-ai-tools-adaptation.mjs
node scripts/test-builder-ai-p1-review.mjs
node scripts/test-platform-finish-phase.mjs
node scripts/test-platform-next-phase.mjs
node scripts/test-tasful-ai-final-phase.mjs
node scripts/test-ai-terms-disclaimer.mjs
node scripts/test-tlv-tasful-ai-entry.mjs
```

**pre-commit-final-check.md 時点の期待結果**

| スイート | 期待 |
| --- | --- |
| Builder tools + p1-review | 85/85 + 135/135 PASS |
| Platform finish + next | 37/37 + 37/37 PASS |
| TASFUL AI final | 31/31 PASS |
| AI terms | 32/32 PASS |
| TLV entry | 16/16 PASS |

---

## 4. コミットメッセージ（案・未実行）

```text
feat(ai): Builder AI, Platform finish, TASFUL AI final, and AI terms

Unify multi-surface AI work: Builder practice actions and search assists,
Platform badges/favorites/search hub, TASFUL AI history and media/document
generators, and shared AI terms/disclaimers. Regression tests pass.
```

**分割コミット案（任意）**

1. `feat(builder-ai): practice assists, tools, and disclaimers`
2. `feat(platform): badges, favorites folders, AI search/compare hub`
3. `feat(tasful-ai): history, video/music/document generators, voice`
4. `docs(reports): AI phase reports and staging plan`
5. `chore(dist): sync deploy/cloudflare/dist AI mirrors`

---

## 5. 最終 Go / No Go

| ゲート | 条件 | 判定 |
| --- | --- | --- |
| 選別ステージング手順 | 本ドキュメント 1-A〜1-G を順守 | **Go** |
| `git add -A` | 使用しない | **No Go** |
| ステージ内容 | §3-A チェックリスト OK | 実行後に確認 |
| ビルド | `npm run build:pages` PASS | 実行後に確認 |
| 回帰テスト | §3-C 全 PASS | 実行後に確認 |
| コミット実行 | ユーザー明示指示まで保留 | **保留** |

**総合:** 手順どおり選別すれば **Go**。`git diff --cached` に除外ファイルが混ざった時点で **No Go**（`git reset` して再選別）。

---

## 付録: ワンショット用（コピペ）

```powershell
# §1-A 〜 1-F を順に実行 → npm run build:pages → §1-G
# 確認
git diff --cached --name-status | Measure-Object -Line
npm run build:pages
node scripts/test-tasful-ai-final-phase.mjs
# 問題なければコミット（ユーザー指示後）
# git commit -m "feat(ai): ..."
```
