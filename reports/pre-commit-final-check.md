# コミット前最終確認

実施日: 2026-06-26  
種別: **確認のみ**（コード変更なし）

---

## 判定

# **No Go**（現状の `git add -A` 一括コミット）

# **Go**（AI関連を選別ステージングしたうえでのコミット）

**理由:** ビルド・全回帰テストは PASS。秘密情報リスクも低い。ただし working tree が **622 件**と広く、TLV シミュレータ / ANPI / Live / Builder 全ページ HTML など **AI スコープ外の変更が混在**。プローブ画像・JSON も untracked に残存。選別なしの一括コミットは推奨しない。

---

## 1. git status

| 区分 | 件数 |
| --- | --- |
| **合計** | 622 |
| 変更 (M) | 249 |
| 新規 (??) | 372 |
| 削除 (D) | 1 |

### 削除

- `deploy/cloudflare/dist/live/live-notifications-page.js`

### 主な AI 関連（新規 · 未追跡ソース）

| 領域 | 代表ファイル |
| --- | --- |
| Builder AI | `builder/builder-ai-*.js`, `builder/builder-ai.html`, `builder/builder-ai-guidelines.html` |
| Platform | `platform-*.js`, `platform-badges.css`, `platform-search-hub.*` |
| TASFUL AI Final | `ai-history-store.js`, `ai-video-generate.js`, `ai-music-generate.js`, `ai-document-generate.js`, `ai-workspace-categories.*` |
| AI 規約 | `ai-terms.html`, `ai-disclaimer.html`, `common-ai-disclaimer.*` |
| TLV 入口 | `live/tlv-tasful-ai-entry.js`, `ai-workspace-tlv-source.js` |
| Google OAuth | `platform-google-auth.js` (+ `login.js` / `login.html` 変更) |
| テスト | `scripts/test-builder-ai-*.mjs`, `scripts/test-platform-*.mjs`, `scripts/test-tasful-ai-final-phase.mjs`, `scripts/test-ai-terms-disclaimer.mjs`, `scripts/test-tlv-tasful-ai-entry.mjs` 等 |
| レポート | `reports/ai-terms-disclaimer.md`, `reports/platform-*.md`, `reports/tasful-ai-final-phase.md`, `reports/builder-ai-tools-adaptation.md` 等 |

### 主な AI 関連（変更 · ソース）

`ai-workspace.html`, `ai-workspace-chat.js`, `ai-workspace-links.js`, `ai-generate-ui.js`, `listing-renderer.js`, `favorites-list.*`, `index-top.html`, `business-board-*.js`, `login.js`, `tasful-general-ai-shell.js` 等

### 想定外 · 要確認（AI スコープ外の可能性）

| 種別 | 例 |
| --- | --- |
| Gateway 変更 | `ai-model-gateway.js` (**+73 / -6 行**, mockReply + attachments 関連) |
| TLV ビジネス | `reports/tlv-business-simulator/**`, `live/*.js`, `live/data/*.json` |
| ANPI | `anpi-*.html`, `anpi-rls.js` |
| Admin / Ops | `admin-operations-dashboard.*`, `ai-ops-case-store.js` |
| Builder 大量 HTML | `builder/*.html` 多数（MVP / admin ページ） |
| Edge | `supabase/functions/openai-chat/index.ts` |
| dist 新規 untracked | **264 件**（`deploy/cloudflare/dist/` 配下） |

> **注:** 直近フェーズでは Gateway 契約変更なし方針だったが、working tree 上は `ai-model-gateway.js` に差分あり。コミット前に diff レビュー推奨。

---

## 2. ビルド

```text
npm run build:pages → PASS
```

- 出力: `deploy/cloudflare/dist`
- TLV pages: 12 OK
- HTML: 251 files staged

---

## 3. テスト結果（主要回帰）

| スイート | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `test-builder-ai-tools-adaptation.mjs` | **85/85 PASS** |
| `test-builder-ai-p1-review.mjs` | **135/135 PASS** |
| `test-platform-finish-phase.mjs` | **37/37 PASS** |
| `test-platform-next-phase.mjs` | **37/37 PASS** |
| `test-tasful-ai-final-phase.mjs` | **31/31 PASS** |
| `test-ai-terms-disclaimer.mjs` | **32/32 PASS** |
| `test-tlv-tasful-ai-entry.mjs` | **16/16 PASS** |
| `test-admin-ai-secretary-text-chat-browser.mjs` | **PASS**（6 checks） |

**失敗:** なし

---

## 4. 不要ファイル確認

| 項目 | 状態 |
| --- | --- |
| `.wrangler/tmp` | **git status に出現なし**（`.gitignore` 対象） |
| `dist/.wrangler/tmp` | **同上** |
| `node_modules` | 対象外（ignored） |
| `reports/tmp` | なし |
| `screenshots/` | gitignore 済（ただし下記 probe は reports 直下） |

### コミットから除外推奨（untracked）

| ファイル | 理由 |
| --- | --- |
| `reports/_gemini-recovery-probe.png` | プローブ用スクリーンショット |
| `reports/gemini-billing-recovery-probes.json` | プローブ出力 |
| `reports/tasful-ai-production-environment-probes.json` | プローブ出力 |
| `reports/tasful-ai-production-preflight-probe.json` | プローブ出力 |

---

## 5. Secret 確認

| 項目 | 結果 |
| --- | --- |
| `.env` / `.env.local` / `.env.production` | **git 未追跡**（`.gitignore`） |
| `git ls-files .env*` | **空** |
| `platform-google-auth.js` | client secret **出力なし**（テストでも確認済） |
| `ai-media-gen-config.js` | endpoint のみ · secret なし |
| AI 設定 JS 直書きキー | **検出なし** |

> レポート類（`reports/*.md`）に `SUPABASE_SERVICE_ROLE_KEY` 等の**プレースホルダ記述**はあるが、実値は含まれていない。

---

## 6. AI 実装 · dist 反映確認

`npm run build:pages` 後、`deploy/cloudflare/dist/` に存在確認済:

| 機能 | dist パス | 存在 |
| --- | --- | --- |
| Builder AI Core | `builder/builder-ai-core.js` | ✅ |
| Builder AI Actions (24) | `builder/builder-ai-actions.js` | ✅ |
| Worker / 業者検索 | `builder/builder-ai-search-assist.js` | ✅ |
| 候補推薦 | `builder/builder-ai-candidate-recommend.js` | ✅ |
| Platform バッジ | `platform-badges.js` | ✅ |
| AI 検索 / 比較 | `platform-search-assist.js`, `platform-compare-assist.js` | ✅ |
| Google OAuth | `platform-google-auth.js` | ✅ |
| AI 規約 | `ai-terms.html`, `common-ai-disclaimer.js` | ✅ |
| TASFUL AI 履歴 | `ai-history-store.js` | ✅ |
| 動画 / 音楽 / 資料 | `ai-video-generate.js`, `ai-music-generate.js`, `ai-document-generate.js` | ✅ |
| Workspace カテゴリ | `ai-workspace-categories.js` | ✅ |
| TLV 入口 | `live/tlv-tasful-ai-entry.js`（テストで dist 確認） | ✅ |

---

## 7. 未コミット対象の整理（推奨）

### コミットに含める（AI バンドル）

- 上記 AI / Platform / Builder AI / 規約 / テスト / レポート（probe 除く）
- `npm run build:pages` 後の **`deploy/cloudflare/dist` 更新**（264 新規含む — 本リポジトリでは dist も追跡）

### コミットから外す · 別 PR 検討

- `reports/*probe*.png/json`
- TLV シミュレータ出力のみの変更（意図確認後）
- ANPI / Live 横断変更（AI PR と無関係なら分割）

### コミット前レビュー必須

- `ai-model-gateway.js`（+73 行）

---

## 8. コミット可否サマリー

| 観点 | 判定 |
| --- | --- |
| ビルド | ✅ |
| 回帰テスト | ✅ |
| Secret | ✅ |
| 不要 tmp / wrangler | ✅ |
| dist AI 反映 | ✅ |
| 変更スコープの純度 | ⚠️ 要選別 |
| 一括コミット | ❌ No Go |

---

## 9. 推奨コミットメッセージ（選別ステージング後）

```text
feat(ai): Builder AI, Platform finish, TASFUL AI final, and AI terms

Unify multi-surface AI work: Builder practice actions and search assists,
Platform badges/favorites/search hub, TASFUL AI history and media/document
generators, and shared AI terms/disclaimers. All surfaces keep using the
existing gateway contract; regression tests pass.
```

**分割コミット案（より安全）:**

1. `feat(builder-ai): 24 actions, search assists, disclaimers`
2. `feat(platform): badges, favorites folders, search/compare hub, Google OAuth wiring`
3. `feat(tasful-ai): history, video/music/document generators, workspace categories`
4. `docs(reports): ai-terms, platform-finish, tasful-ai-final phase reports`
5. `chore(dist): refresh Cloudflare Pages staging output`

---

## 10. 次のアクション

1. `git diff ai-model-gateway.js` をレビュー（意図的変更か確認）
2. probe 画像 · JSON をステージングから除外（または `.gitignore` 追加検討）
3. AI 関連パスのみ `git add`（または上記 5 分割）
4. コミット後: 必要なら `test-builder-ai-p1.mjs` 等の追加スモーク
