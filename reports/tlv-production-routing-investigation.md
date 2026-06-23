# TLV 本番ルーティング調査 — `/live/videos.html` が MARKET TOP になる問題

**日付:** 2026-06-23  
**URL:** `https://tasufull-article.pages.dev/live/videos.html`  
**期待:** TLV Phase 7–15 動画一覧（`VIEW | TASFUL LIVE` · `data-page="live-videos"`）  
**実際:** TASFUL市場（MARKET TOP / `shop-store.html` 相当）

---

## 1. 調査結果サマリー

| 確認項目 | 結果 |
|----------|------|
| `live/videos.html` ソース | ✅ ローカルに存在 · TLV 正しい内容 |
| `deploy/cloudflare/dist/live/videos.html`（ローカル build 後） | ✅ 存在 · `data-page="live-videos"` |
| `build:pages` で dist 生成 | ✅ `stage-cloudflare-pages.mjs` が `live/` をコピー |
| `_redirects` に `/live/` → market ルール | ✅ **なし**（talk-home / builder のみ） |
| `_headers` の `/live/*` | ✅ nosnippet のみ（リダイレクトなし） |
| **git 追跡** | ❌ **Phase 4–15 の TLV ファイルが未コミット** |
| 本番 CF Pages ビルド | ❌ git checkout に `live/videos.html` 等が無い → **dist に含まれない** |

**根本原因:** Cloudflare Pages は **git の checkout** から `npm run build:pages` を実行する。TLV YouTube 系ファイル（`live/videos.html` 他）が **git 未追跡（`??`）** のため、本番ビルド成果物に含まれず `/live/videos.html` が配信されない。欠落時に別画面（市場 TOP 等）に見える、またはダッシュボード経由で市場へ遷移した可能性あり。

---

## 2. 詳細

### 2.1 ローカル dist（正常）

```
deploy/cloudflare/dist/live/videos.html
  title: VIEW | TASFUL LIVE
  data-page="live-videos"
  data-tlv-page="view"
```

`npm run dev`（8788）でも `/live/videos.html` → 308 `/live/videos` → TLV ページを返すことを確認。

### 2.2 git 未追跡ファイル（本番欠落の直接原因）

```
?? live/videos.html
?? live/watch-video.html
?? live/my-videos.html
?? live/video-upload.html
?? live/creator-dashboard.html
?? live/admin-videos.html
?? live/live-videos.js
?? live/live-watch-video.js
…（tlv-nav.js / tlv-feature-flags.js 等も未追跡）
```

`git ls-files deploy/cloudflare/dist/live/videos.html` → **空**（dist 内 videos も未コミット）。

本番にコミット済みの `live/` は Phase 6 以前（`index.html` · `shorts.html` · `profile.html` 等）のみ。

### 2.3 `_redirects` / `_headers`

- `_redirects`: `/live/` 関連ルール **なし**
- `_headers`: `/live/*` に `X-Robots-Tag: noindex...` のみ

リポジトリ内に TLV → market へのリダイレクト設定はない。

### 2.4 Cloudflare Access

`/live/videos.html` は Access 保護下（未認証時 302 → ログイン）。認証後も **静的ファイルが無ければ TLV は表示されない**。

---

## 3. 修正内容（実装済み）

| 変更 | 目的 |
|------|------|
| `scripts/lib/tlv-dist-manifest.mjs` | TLV 必須 dist / git 一覧と検証 |
| `deploy/cloudflare/stage-cloudflare-pages.mjs` | ビルド終了時に TLV dist 必須チェック（欠落で exit 1） |
| `scripts/verify-live-youtube-p15-*.mjs` | dist TLV + git 追跡 + redirects 検証を追加 |
| `scripts/verify-cloudflare-pages-stage.mjs` | `live/videos.html` 等を REQUIRED_PATHS に追加 |

---

## 4. 本番復旧手順（必須）

```bash
# 1. TLV ソースを git に追加
git add live/videos.html live/watch-video.html live/my-videos.html \
  live/video-upload.html live/creator-dashboard.html live/admin-videos.html \
  live/live-videos.js live/live-watch-video.js live/live-my-videos.js \
  live/live-video-upload.js live/live-creator-dashboard.js live/live-admin-videos.js \
  live/live-monetization-service.js live/tlv-nav.js live/tlv-feature-flags.js \
  live/tlv-private-test-gate.js \
  live/index.html live/live-config.js live/live.css live/profile.html

# 2. コミット & push
git commit -m "Add TLV Phase 4-15 pages for production Pages deploy"
git push

# 3. 本番ビルド・デプロイ（CF Pages が build:pages を実行）
npm run build:pages   # ローカル確認
npm run verify:live-youtube-p15

# 4. Production デプロイ完了後、Access 認証下で確認
#    /live/videos.html → title「VIEW | TASFUL LIVE」
```

**注意:** `deploy/cloudflare/dist/` を git にコミットする必要はない（ビルド時に生成）。**ソース `live/` をコミットすることが重要。**

---

## 5. 本番 smoke（デプロイ後）

- [ ] `/live/videos.html` — VIEW 一覧 · `data-page="live-videos"`
- [ ] `/live/index.html` — TLV ハブ
- [ ] `/live/profile.html` — プロフィール
- [ ] `/live/creator-dashboard.html` — 収益ダッシュボード
- [ ] `/live/admin-videos.html` — 管理（admin JWT）
- [ ] いずれも `shop-store.html` / TASFUL市場 ではないこと

---

## 6. 再発防止

- `npm run build:pages` 終了時に TLV 12 ファイル必須チェック
- `npm run verify:live-youtube-p15` で **git 追跡** + **dist 内容** を検証
- デプロイ前チェックリスト §D に「TLV ソース git 追跡済み」を追加推奨
