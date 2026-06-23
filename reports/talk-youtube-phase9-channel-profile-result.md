# TASFUL LIVE YouTube P1 — Phase 9 チャンネルページ強化

**実施日:** 2026-06-23  
**検証:** `npm run verify:live-youtube-p9` → **PASS** (40/40)  
**Phase 8 回帰:** `npm run verify:live-youtube-p8` → **PASS**（p9 内で実行）

---

## 目的

投稿者ごとのチャンネル価値を高め、YouTube ライクなチャンネル体験を `profile.html` に追加する。Phase 7/8 の PC/スマホ分離シェルは維持。

---

## 作成 / 変更ファイル

| ファイル | 種別 |
|---------|------|
| `live/profile.html` | タイトル「チャンネル」、シェル nav 維持 |
| `live/live-profile.js` | チャンネルヘッダー + タブ連携へ全面刷新 |
| `live/live-videos.js` | チャンネル統計 / タブ別取得 / グリッド描画 |
| `live/live-follow.js` | チャンネル登録 UI + 未ログイン導線 |
| `live/live.css` | YouTube 風チャンネルレイアウト |
| `scripts/verify-live-youtube-p9-channel-profile.mjs` | **新規** |
| `scripts/verify-live-youtube-p8-shell-extension.mjs` | プロフィールマウント判定をチャンネルヘッダー対応 |
| `package.json` | `verify:live-youtube-p9` |
| `deploy/cloudflare/dist/live/*` | 同期 |

**DB / RLS / Edge:** 変更なし

---

## チャンネルヘッダー（`tlv-channel-header`）

| 要素 | 実装 |
|------|------|
| アイコン | `resolveAvatarUrl` |
| 表示名 | `resolveDisplayName` |
| @handle | `userId` |
| 自己紹介 | `live_creator_profiles.bio` |
| 投稿数 | 公開対象の長尺動画件数 |
| フォロワー数 | `follower_count` |
| 総再生数 | 長尺動画 `views_count` 合計 |
| 登録ボタン | 既存 `TasuLiveFollow` + `channelMode`（「チャンネル登録」/「登録済み」） |
| 未ログイン | 「ログインして登録」→ dashboard |
| 自分のページ | 「プロフィールを編集」「動画を投稿」「応援履歴」 |

---

## タブ構成

| タブ | 内容 | 並び |
|------|------|------|
| 動画 | 長尺動画 | `published_at` desc |
| ショート | `live_shorts` | `published_at` desc |
| ライブ | `live_broadcasts` | `created_at` desc |
| 人気 | 長尺動画 | `views_count` → `likes_count` desc |
| 新着 | 長尺動画 | `created_at` desc |

- 他人閲覧: `published` + `public` のみ
- 本人閲覧: `removed` 以外（マイ動画と同じ方針）

---

## グリッドカード

- サムネイル / タイトル / 再生数 / 投稿日
- 種別バッジ（動画 / ショート / ライブ）
- PC: 3〜5 列（`tlv-channel-grid`）
- スマホ: 2 列 → タブは横スクロール

---

## 空状態

- 共通: 「まだ動画がありません」
- 本人: 「動画を投稿する」+ ショートタブでは「ショートを投稿」

---

## レイアウト方針

| | PC (≥1024px) | スマホ (<1024px) |
|---|-------------|-----------------|
| シェル | Phase 7/8 `tlv-desktop-shell` 維持 | `tlv-mobile-shell` 維持 |
| ヘッダー | 横長バナー + アバター横並び | 縦積み |
| タブ | 下線スタイル | 横スクロール |
| 下部ナビ | — | MY（自分）/ VIEW（他人）active 維持 |

---

## 検証結果

| 項目 | 結果 |
|------|------|
| 390 / 768 / 1280 console error 0 | PASS |
| 自分 / 他人 / 未ログイン | PASS |
| タブ切替（動画 / 人気 / 新着 / ショート） | PASS |
| フォロー CTA | PASS |
| `verify:live-youtube-p8` 回帰 | PASS |

```bash
npm run verify:live-youtube-p9
# PASS 40/40
```

---

## 判定

**GO** — `profile.html` がチャンネルページとして成立。PC/スマホ双方で破綻なく、投稿者ごとの動画一覧・タブ・登録導線が利用可能。既存 TLV 機能（投稿 / 再生 / フォロー / シェル）は回帰なし。
