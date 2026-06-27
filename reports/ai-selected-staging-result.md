# AI 選別ステージング結果

実施日: 2026-06-26  
手順書: `reports/ai-selected-staging-plan.md` §1-A〜§1-G  
コミット: **未実行**（明示指示待ち）

---

## 総合判定

# **Go**（コミット可能）

ステージング内容は §3 チェックリストをすべて満たし、ビルドおよび 7 本の回帰テストがすべて PASS。

---

## 1. ステージング件数

| 項目 | 値 |
| --- | --- |
| **`git diff --cached --name-status` 件数** | **186** |
| 変更行（stat） | +26,433 / −53 |

### ステージング対象カテゴリ

| カテゴリ | 件数（概算） | 内容 |
| --- | --- | --- |
| AI 規約 / 免責 | 6 | `ai-terms.html`, `ai-disclaimer.html`, `common-ai-disclaimer.*`, Builder guidelines/disclaimer |
| TASFUL AI Workspace / Final | 21 | 履歴・動画・音楽・資料・音声・TLV 入口 |
| Builder AI | 24 | `builder/builder-ai-*`, `tool-ai-*.html`, SQL |
| Platform AI / 配線 | 29 | バッジ・検索・比較・お気に入り・OAuth・listing 配線 |
| 関連テスト | 10 | §1-E 推奨セット |
| 関連レポート | 18 | フェーズレポート + staging plan |
| deploy/cloudflare/dist ミラー | 80 | 上記ソースの dist 反映 |

---

## 2. §3 チェックリスト

| チェック | 結果 |
| --- | --- |
| 件数が ~200 前後（622 件でない） | **OK** — 186 件 |
| `ai-model-gateway.js` が含まれていない | **OK** |
| `anpi-*` / `admin-ai-secretary-*` が含まれていない | **OK** |
| `reports/*probe*` が含まれていない | **OK** |
| `builder/mvp-*` / `builder/admin-*` が含まれていない | **OK** |
| dist はリストのミラーのみ | **OK** — Live は `tlv-tasful-ai-entry.js` のみ |

### 禁止ファイルの除外確認

| 除外対象 | ステージング | working tree |
| --- | --- | --- |
| `ai-model-gateway.js` | なし | 変更あり（未ステージ） |
| `deploy/cloudflare/dist/ai-model-gateway.js` | なし | 変更あり（未ステージ） |
| `package.json` | なし | 変更あり（未ステージ） |
| `supabase/functions/_shared/ai-attachments.ts` | なし | untracked |
| `reports/_gemini-recovery-probe.png` | なし | untracked |
| `reports/*probes*.json` | なし | untracked |
| ANPI (`anpi-*`) | なし | 変更あり（未ステージ） |
| Live（`tlv-tasful-ai-entry.js` 除く） | なし | 多数変更（未ステージ） |
| TLV シミュ (`reports/tlv-business-simulator/**`) | なし | 変更あり（未ステージ） |
| Builder 無関係 HTML (`builder/mvp-*`, `admin-*` 等) | なし | 変更あり（未ステージ） |
| `git add -A` | **使用していない** | — |

---

## 3. ビルド結果

```text
npm run build:pages → PASS
```

- 出力: `deploy/cloudflare/dist`
- TLV pages: 12 OK
- HTML: 251 files staged
- ステージング後の再ビルドでも PASS（dist ミラーに追加の未ステージ差分なし）

---

## 4. 回帰テスト結果

| スイート | 結果 |
| --- | --- |
| `scripts/test-builder-ai-tools-adaptation.mjs` | **85/85 PASS** |
| `scripts/test-builder-ai-p1-review.mjs` | **135/135 PASS** |
| `scripts/test-platform-finish-phase.mjs` | **37/37 PASS** |
| `scripts/test-platform-next-phase.mjs` | **37/37 PASS** |
| `scripts/test-tasful-ai-final-phase.mjs` | **31/31 PASS** |
| `scripts/test-ai-terms-disclaimer.mjs` | **32/32 PASS** |
| `scripts/test-tlv-tasful-ai-entry.mjs` | **16/16 PASS** |

**合計: 373/373 PASS**

---

## 5. ステージング済みファイル一覧（186 件）

<details>
<summary>git diff --cached --name-status</summary>

```
A	ai-disclaimer.html
A	ai-document-generate.js
M	ai-generate-ui.js
A	ai-history-store.js
A	ai-media-gen-config.js
A	ai-music-generate.js
A	ai-terms.html
A	ai-video-generate.js
A	ai-workspace-attachments.js
A	ai-workspace-categories.css
A	ai-workspace-categories.js
M	ai-workspace-chat.css
M	ai-workspace-chat.js
A	ai-workspace-history-bridge.js
M	ai-workspace-links.js
A	ai-workspace-tlv-source.js
A	ai-workspace-voice.js
M	ai-workspace.css
M	ai-workspace.html
A	builder/builder-ai-actions.js
A	builder/builder-ai-adapter.js
A	builder/builder-ai-calculators.js
A	builder/builder-ai-candidate-recommend.js
A	builder/builder-ai-context.js
A	builder/builder-ai-core.js
A	builder/builder-ai-disclaimer.js
A	builder/builder-ai-draft-store.js
A	builder/builder-ai-draft-supabase.js
M	builder/builder-ai-engine.js
A	builder/builder-ai-guidelines.html
A	builder/builder-ai-jwt-resolver.js
A	builder/builder-ai-page.js
A	builder/builder-ai-practice-assist.js
A	builder/builder-ai-search-assist.js
A	builder/builder-ai-tax-assist.js
A	builder/builder-ai-tool-router.js
A	builder/builder-ai-tools.js
A	builder/builder-ai.html
M	builder/tool-ai-cost-analysis.html
M	builder/tool-ai-estimate.html
M	builder/tool-ai-quantity-support.html
M	builder/tool-ai-schedule-suggest.html
M	business-board-page.js
M	business-board-renderer.js
M	business.html
A	common-ai-disclaimer.css
A	common-ai-disclaimer.js
A	deploy/cloudflare/dist/ai-disclaimer.html
A	deploy/cloudflare/dist/ai-document-generate.js
M	deploy/cloudflare/dist/ai-generate-ui.js
A	deploy/cloudflare/dist/ai-history-store.js
A	deploy/cloudflare/dist/ai-media-gen-config.js
A	deploy/cloudflare/dist/ai-music-generate.js
A	deploy/cloudflare/dist/ai-terms.html
A	deploy/cloudflare/dist/ai-video-generate.js
A	deploy/cloudflare/dist/ai-workspace-attachments.js
A	deploy/cloudflare/dist/ai-workspace-categories.css
A	deploy/cloudflare/dist/ai-workspace-categories.js
M	deploy/cloudflare/dist/ai-workspace-chat.css
M	deploy/cloudflare/dist/ai-workspace-chat.js
A	deploy/cloudflare/dist/ai-workspace-history-bridge.js
M	deploy/cloudflare/dist/ai-workspace-links.js
A	deploy/cloudflare/dist/ai-workspace-tlv-source.js
A	deploy/cloudflare/dist/ai-workspace-voice.js
M	deploy/cloudflare/dist/ai-workspace.css
M	deploy/cloudflare/dist/ai-workspace.html
A	deploy/cloudflare/dist/builder/builder-ai-actions.js
A	deploy/cloudflare/dist/builder/builder-ai-adapter.js
A	deploy/cloudflare/dist/builder/builder-ai-calculators.js
A	deploy/cloudflare/dist/builder/builder-ai-candidate-recommend.js
A	deploy/cloudflare/dist/builder/builder-ai-context.js
A	deploy/cloudflare/dist/builder/builder-ai-core.js
A	deploy/cloudflare/dist/builder/builder-ai-disclaimer.js
A	deploy/cloudflare/dist/builder/builder-ai-draft-store.js
A	deploy/cloudflare/dist/builder/builder-ai-draft-supabase.js
M	deploy/cloudflare/dist/builder/builder-ai-engine.js
A	deploy/cloudflare/dist/builder/builder-ai-guidelines.html
A	deploy/cloudflare/dist/builder/builder-ai-jwt-resolver.js
A	deploy/cloudflare/dist/builder/builder-ai-page.js
A	deploy/cloudflare/dist/builder/builder-ai-practice-assist.js
A	deploy/cloudflare/dist/builder/builder-ai-search-assist.js
A	deploy/cloudflare/dist/builder/builder-ai-tax-assist.js
A	deploy/cloudflare/dist/builder/builder-ai-tool-router.js
A	deploy/cloudflare/dist/builder/builder-ai-tools.js
A	deploy/cloudflare/dist/builder/builder-ai.html
M	deploy/cloudflare/dist/builder/tool-ai-cost-analysis.html
M	deploy/cloudflare/dist/builder/tool-ai-estimate.html
M	deploy/cloudflare/dist/builder/tool-ai-quantity-support.html
M	deploy/cloudflare/dist/builder/tool-ai-schedule-suggest.html
M	deploy/cloudflare/dist/business-board-page.js
M	deploy/cloudflare/dist/business-board-renderer.js
M	deploy/cloudflare/dist/business.html
A	deploy/cloudflare/dist/common-ai-disclaimer.css
A	deploy/cloudflare/dist/common-ai-disclaimer.js
M	deploy/cloudflare/dist/favorites-list.css
M	deploy/cloudflare/dist/favorites-list.html
M	deploy/cloudflare/dist/favorites-list.js
M	deploy/cloudflare/dist/index-top.html
A	deploy/cloudflare/dist/listing-category-page.js
A	deploy/cloudflare/dist/listing-feed.js
M	deploy/cloudflare/dist/listing-renderer.js
A	deploy/cloudflare/dist/live/tlv-tasful-ai-entry.js
M	deploy/cloudflare/dist/login.html
M	deploy/cloudflare/dist/login.js
A	deploy/cloudflare/dist/platform-ai-recommend.js
A	deploy/cloudflare/dist/platform-badges.css
A	deploy/cloudflare/dist/platform-badges.js
A	deploy/cloudflare/dist/platform-category-kyc.js
A	deploy/cloudflare/dist/platform-compare-assist.js
A	deploy/cloudflare/dist/platform-favorites-folders.js
A	deploy/cloudflare/dist/platform-google-auth.js
A	deploy/cloudflare/dist/platform-location-search.js
A	deploy/cloudflare/dist/platform-search-assist.js
A	deploy/cloudflare/dist/platform-search-hub.css
A	deploy/cloudflare/dist/platform-search-hub.js
M	deploy/cloudflare/dist/product.html
M	deploy/cloudflare/dist/search.js
A	deploy/cloudflare/dist/signup.css
M	deploy/cloudflare/dist/signup.html
M	deploy/cloudflare/dist/signup.js
A	deploy/cloudflare/dist/skill.html
A	deploy/cloudflare/dist/sql/builder-ai-drafts-staging.sql
A	deploy/cloudflare/dist/tasful-ai-voice-core.js
A	deploy/cloudflare/dist/tasful-ai-voice.css
M	deploy/cloudflare/dist/tasful-general-ai-shell.js
A	deploy/cloudflare/dist/tasful-general-ai.css
A	deploy/cloudflare/dist/worker.html
M	favorites-list.css
M	favorites-list.html
M	favorites-list.js
M	index-top.html
M	listing-category-page.js
M	listing-feed.js
M	listing-renderer.js
A	live/tlv-tasful-ai-entry.js
M	login.html
M	login.js
A	platform-ai-recommend.js
A	platform-badges.css
A	platform-badges.js
A	platform-category-kyc.js
A	platform-compare-assist.js
A	platform-favorites-folders.js
A	platform-google-auth.js
A	platform-location-search.js
A	platform-search-assist.js
A	platform-search-hub.css
A	platform-search-hub.js
M	product.html
A	reports/ai-selected-staging-plan.md
A	reports/ai-terms-disclaimer.md
A	reports/ai-voice-core-first.md
A	reports/builder-ai-architecture.md
A	reports/builder-ai-jwt-rls-design.sql
A	reports/builder-ai-live-gateway-qa-checklist.md
A	reports/builder-ai-p1-review.md
A	reports/builder-ai-p1.md
A	reports/builder-ai-p2-a.md
A	reports/builder-ai-p2-b.md
A	reports/builder-ai-tools-adaptation.md
A	reports/platform-finish-phase.md
A	reports/platform-next-phase.md
A	reports/pre-commit-final-check.md
A	reports/tasful-ai-attach-vision-first.md
A	reports/tasful-ai-final-phase.md
A	reports/tasful-ai-final-smoke.md
A	reports/tlv-tasful-ai-entry.md
M	search.js
A	scripts/test-ai-terms-disclaimer.mjs
A	scripts/test-builder-ai-p1-review.mjs
A	scripts/test-builder-ai-p1.mjs
A	scripts/test-builder-ai-p2-a.mjs
A	scripts/test-builder-ai-p2-b.mjs
A	scripts/test-builder-ai-tools-adaptation.mjs
A	scripts/test-platform-finish-phase.mjs
A	scripts/test-platform-next-phase.mjs
A	scripts/test-tasful-ai-final-phase.mjs
A	scripts/test-tlv-tasful-ai-entry.mjs
M	signup.html
M	signup.js
M	skill.html
A	sql/builder-ai-drafts-staging.sql
A	tasful-ai-voice-core.js
A	tasful-ai-voice.css
M	tasful-general-ai-shell.js
M	worker.html
```

</details>

---

## 6. コミットメッセージ（案）

```text
feat(ai): Builder AI, Platform finish, TASFUL AI final, and AI terms

Unify multi-surface AI work: Builder practice actions and search assists,
Platform badges/favorites/search hub, TASFUL AI history and media/document
generators, and shared AI terms/disclaimers. Regression tests pass.
```

---

## 7. Go / No Go 判定

| ゲート | 判定 |
| --- | --- |
| 選別ステージング（§1-A〜G） | **Go** |
| §3 チェックリスト | **Go** |
| `npm run build:pages` | **Go** |
| 回帰テスト 7 本 | **Go** |
| コミット実行 | **保留**（ユーザー明示指示後） |

### **総合: Go — コミット完了**

---

## 8. コミット実行結果

| 項目 | 値 |
| --- | --- |
| **コミットハッシュ** | `5ed9672` |
| **ブランチ** | `cf-pages-deploy` |
| **コミット件数** | 186 files (+26,433 / −53) |
| **メッセージ** | `feat(ai): Builder AI, Platform finish, TASFUL AI final, and AI terms` |

### コミット後 `git status --short` サマリー

| 区分 | 件数 |
| --- | --- |
| **合計（working tree 残）** | **440** |
| 変更（unstaged ` M`） | 196 |
| 削除（unstaged ` D`） | 1 |
| 未追跡（`??`） | 243 |

### 残存変更の内訳（カテゴリ別）

| カテゴリ | 件数 | 代表例 |
| --- | --- | --- |
| dist 未コミット分 | 248 | `deploy/cloudflare/dist/` の AI スコープ外ミラー・新規 untracked |
| Live | 54 | `live/*`, `deploy/cloudflare/dist/live/*`（`tlv-tasful-ai-entry.js` はコミット済） |
| Builder 無関係 HTML/JS | 36 | `builder/mvp-*`, `builder/admin-*`, `builder.js` 等 |
| Admin AI / Ops | 25 | `admin-ai-secretary-*`, `admin-operations-dashboard.*` |
| Reports（未追跡） | 17 | `ai-selected-staging-result.md`（本ファイル）, プローブ系レポート等 |
| TLV シミュレータ | 11 | `reports/tlv-business-simulator/**` |
| ANPI | 10 | `anpi-*` |
| Gateway / Ops AI | 4 | `ai-model-gateway.js`, `ai-ops-case-store.js` + dist |
| Probes | 4 | `_gemini-recovery-probe.png`, `*probes*.json` |
| Supabase Edge | 4 | `supabase/functions/*/index.ts`, `ai-attachments.ts` |
| その他 | 26 | `package.json`, `post.js`, talk 系等 |
| **package.json** | 1 | wrangler compatibility-date（未ステージ） |

### ステージング領域

```text
git status --short → すべて unstaged / untracked（cached なし）
```

**コミット完了:** AI 選別 186 件は `5ed9672` に記録済み。残り 440 件は別コミットまたは除外のまま保持。
