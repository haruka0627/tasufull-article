# TASFUL LIVE YouTube P1 — Phase 8 PC/スマホシェル展開

**実施日:** 2026-06-23  
**検証:** `npm run verify:live-youtube-p8` → **PASS** (42/42)  
**Phase 7 回帰:** `npm run verify:live-youtube-p7` → **PASS**（p8 内で実行）

---

## 目的

Phase 7 で導入した `tlv-desktop-shell` / `tlv-mobile-shell` を **マイ動画 / プロフィール / 投稿** へ展開し、TLV 全体の導線を統一する。

- PC: YouTube ライク（左サイドバー + 上検索 + 投稿ボタン）
- スマホ: TLV 専用 UI（下部固定ナビ HOME/TALK/LIVE/VIEW/MY）
- `admin-videos.html` は対象外（現状維持）

---

## 作成 / 変更ファイル

| ファイル | 種別 |
|---------|------|
| `live/my-videos.html` | Phase 7 二重シェルへ移行 |
| `live/profile.html` | 同上 |
| `live/video-upload.html` | 同上（ユーザー指定 `upload.html` は本ファイルが実体） |
| `live/tlv-nav.js` | `initPageShell` / `pickContentRoot` / `setProfileSubtitle` / モバイルヘッダー拡張 |
| `live/live-my-videos.js` | デュアル root 描画 + アクション再バインド |
| `live/live-profile.js` | デュアル root + TLV サブタイトル連携 |
| `live/live.css` | Phase 8 モバイル投稿・プロフィール・マイ動画スタイル |
| `scripts/verify-live-youtube-p8-shell-extension.mjs` | **新規** |
| `package.json` | `verify:live-youtube-p8` |
| `deploy/cloudflare/dist/live/*` | 同期 |

**DB / RLS / Edge:** 変更なし

---

## 実装方針

### 共通シェル（`tlv-nav.js`）

- `initPageShell({ desktopNavId, mobileTabId, topbarTitle, ... })` — サイドバー / トップバー / モバイルヘッダー / タブバーを一括マウント
- `pickContentRoot(desktopSel, mobileSel)` — ビューポートに応じた単一マウント先（投稿フォーム用）
- `setProfileSubtitle(text)` — モバイルヘッダー `[data-tlv-profile-subtitle]` を更新
- デスクトップ検索は `videos.html?q=` へリダイレクト

### ページ別ナビ active

| ページ | desktopNavId | mobileTabId |
|--------|--------------|-------------|
| my-videos | `my-videos` | `my` |
| profile（自分） | `my-videos` | `my` |
| profile（他人） | `videos` | `view` |
| video-upload | `upload` | `my` |

### コンテンツマウント

| ページ | 方式 |
|--------|------|
| my-videos | デュアル root（desktop + mobile へ同一 HTML） |
| profile | デュアル root + フォロー / TALK CTA を両 root にバインド |
| video-upload | **単一 root**（`pickContentRoot` — file input の二重バインド回避） |

### スマホ UX 補強（`live.css`）

- 投稿フォーム: 入力・ボタン min-height 48px、フル幅アクション
- プロフィール CTA: 縦積みフル幅ボタン
- マイ動画: タッチしやすいアクションボタン

---

## 維持した既存機能

- マイ動画一覧 / 公開・非表示・削除 / visibility 変更（RLS 直接 UPDATE）
- プロフィール表示・編集導線 / フォロー / チャンネル動画グリッド
- 長尺動画投稿（Storage + `live_videos` insert）
- 認証（`talk_user_id` / Supabase session）
- `tasful-app-mobile.js` は未使用

---

## 検証結果

| 項目 | 結果 |
|------|------|
| 静的ファイル + dist 同期 | PASS |
| 390px / 768px / 1280px console error 0 | PASS（my-videos / profile / video-upload） |
| シェル出し分け（PC vs スマホ） | PASS |
| マイ動画 / プロフィール / 投稿マウント | PASS |
| スマホ投稿フォーム表示 | PASS |
| `verify:live-youtube-p7` 回帰 | PASS |

```bash
npm run verify:live-youtube-p8
# PASS 42/42
```

---

## 判定

**GO** — Phase 8 完了。my-videos / profile / video-upload が Phase 7 と同じ TLV 導線で統一され、PC/スマホそれぞれの操作性を維持したまま既存機能を保持している。
