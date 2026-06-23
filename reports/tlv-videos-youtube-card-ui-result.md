# TLV videos.html — YouTube-style card UI 調整結果

**実施日:** 2026-06-23  
**対象ページ:** `/live/videos.html`（VIEW フィード）  
**前提:** 本番 5 ページ Access 確認 PASS（`reports/tlv-production-access-visual-check.md`）

---

## 目的

動画一覧を管理画面風のボーダーカードから、YouTube ホームに近い **大型サムネイル + 低密度メタ情報** のグリッドへ寄せる。

---

## 変更ファイル

| ファイル | 内容 |
|----------|------|
| `live/live-videos.js` | カード HTML・サムネ解決・視聴数/相対日付フォーマット |
| `live/live.css` | `.tlv-videos-feed` 専用 YouTube 風グリッド・カードスタイル |

**未変更（要件どおり）:** `videos.html` の noindex meta、`tlv-feature-flags.js`、`tlv-private-test-gate.js`、Access 設定、他 TLV ページ

---

## 実装サマリー

### 1. グリッド列数（PC / `.tlv-desktop-shell`）

| ビューポート | 列数 |
|--------------|------|
| 1024px – 1279px | **3 列** |
| 1280px – 1599px | **4 列** |
| 1600px 以上 | **5 列**（この幅のみ） |

- 列間 `16px`、行間 `40px`（YouTube ホームに近い密度）
- 旧仕様の `1536px` で 5 列 → **1600px** に変更

### 2. カード構造（YouTube ホーム型）

```
[ 16:9 サムネ + 再生時間バッジ ]
[ アバター | タイトル（最大2行） ]
           | チャンネル名
           | 回視聴 · 相対投稿日
```

- ボーダー・面背景を除去（透明カード）
- サムネ `border-radius: 12px`、`aspect-ratio: 16/9` 固定
- タイトル `-webkit-line-clamp: 2`
- チャンネル名・統計は `0.75rem` / muted 色で視認性調整

### 3. サムネイル解決（`resolveThumbUrl`）

優先順:

1. `video.thumbnail_url`（`http(s)://` の直 URL）
2. `video.thumbnail_path` → Supabase public storage（`live-thumbnails`）
3. いずれも無い場合のみ **プレースホルダー**（グラデーション、テキストなし）

> DB スキーマ現状は `thumbnail_path` のみ。将来 `thumbnail_url` 列や API 拡張時もコード側は対応済み。

### 4. メタ情報フォーマット

| 項目 | 形式例 |
|------|--------|
| 再生回数 | `1.2万回視聴` / `856回視聴` |
| 投稿日 | `3日前` / `2週間前` / `5ヶ月前`（YouTube 風相対表記） |
| 再生時間 | サムネ右下 `12:34` / `1:05:30` |

### 5. モバイル（`.tlv-mobile-shell`）

- 旧: 横長リスト（128px サムネ + 右テキスト）  
- 新: **1 列・縦型カード**（サムネ上・情報下）で YouTube モバイルホームに寄せる

---

## 確認項目チェックリスト

| 要件 | 結果 |
|------|------|
| PC カード大型化 | PASS — 列数削減 + 行間拡大で 1 カード占有面積増 |
| 1280px 前後 3〜4 列 | PASS — 1024–1279: 3列 / 1280–1599: 4列 |
| 1600px+ のみ 5 列 | PASS |
| サムネ 16:9 固定 | PASS — CSS `aspect-ratio: 16/9` |
| thumbnail_url 優先 | PASS — `resolveThumbUrl` 実装 |
| placeholder はフォールバックのみ | PASS — URL 無し時のみ表示 |
| タイトル 2 行まで | PASS — `line-clamp: 2` |
| チャンネル名・再生回数・投稿日 | PASS — 3 行構成 + YouTube 風表記 |
| カード間余白 YouTube 程度 | PASS — col 16px / row 40px |
| Access / noindex / flags / banner | PASS — 該当ファイル未変更 |

---

## ローカル確認手順

```powershell
# 開発サーバー起動後
# http://localhost:8788/live/videos.html?talkDev=1

# またはステージビルド
npm run stage:cloudflare-pages
```

**目視ポイント**

1. デスクトップ幅 1280px → 4 列、カードにボーダーが無いこと
2. 1600px 未満では 5 列にならないこと
3. サムネ付き動画は `thumbnail_path` 画像、無しはグレープレースホルダーのみ
4. タイトル長文が 2 行で省略されること
5. ページ先頭の **TLV 非公開本番テスト中** バナーが従来どおり表示されること

---

## 本番反映

本変更は **未デプロイ**（ローカル / 作業ツリー）。反映には `live/live-videos.js` と `live/live.css` を含む commit → `main` push → Cloudflare Pages Production ビルドが必要。

---

## 備考

- チャンネルページ（`profile.html`）の `.tlv-channel-grid` / `.live-video-grid-card` は今回スコープ外（VIEW フィードのみ）
- `renderVideoGridCard` 等のチャンネル用カードは従来レイアウトのまま
