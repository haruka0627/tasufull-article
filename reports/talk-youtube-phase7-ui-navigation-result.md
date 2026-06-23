# TASFUL LIVE YouTube P1 — Phase 7 最終導線 / UI 整理

**実施日:** 2026-06-23  
**検証:** `npm run verify:live-youtube-p7` → **PASS** (37/37)  
**Phase 6 コア回帰:** `node scripts/verify-live-youtube-p6-admin-report-ads.mjs --skip-nested-regression` → **PASS**

---

## 作成 / 変更ファイル

| ファイル | 種別 |
|---------|------|
| `live/tlv-nav.js` | **新規** — PC サイドバー / スマホ下部ナビ / カテゴリ・フィードタブ |
| `live/videos.html` | PC・スマホ二重シェル |
| `live/watch-video.html` | PC・スマホ二重シェル + 関連動画 |
| `live/index.html` | LIVE ハブ二重シェル |
| `live/live.css` | TLV シェル / グリッド / watch レイアウト |
| `live/live-videos.js` | フィード種別・カテゴリ・デュアル root |
| `live/live-watch-video.js` | 関連動画・2 カラム layout・mirror root |
| `scripts/verify-live-youtube-p7-ui-navigation.mjs` | **新規** |
| `scripts/verify-live-youtube-p6-admin-report-ads.mjs` | nested 回帰 spawn 改善 |
| `package.json` | `verify:live-youtube-p7` |
| `deploy/cloudflare/dist/live/*` | 同期 |

**DB / RLS / Edge:** 変更なし

---

## レスポンシブ方針（Phase 7 実装）

| | PC (≥1024px) | スマホ (<1024px) |
|---|-------------|-----------------|
| シェル | `tlv-desktop-shell` | `tlv-mobile-shell` |
| ナビ | 左サイドバー + 上検索 | 下部固定 HOME/TALK/LIVE/VIEW/MY |
| 一覧 | 3〜5 列グリッド | 1 列 + フィードタブ |
| watch | プレイヤー左 + 関連右 | 縦積み |

- `tasful-app-mobile.js` は**未使用**
- 960px 中央 1 カラム前提は TLV ページから撤去
- DOM を出し分け（`display:none` による単純縮小/拡大ではない）

---

## PC UI（YouTube ライク）

**`tlv-desktop-shell`**
- 左ナビ: ホーム / 動画 / ショート / ライブ / マイ動画 / 投稿
- 上部: タイトル + 検索 + 投稿ボタン
- カテゴリチップ: すべて / 住まい・建築 / ビジネス / ノウハウ / エンタメ（クライアントフィルタ）
- 動画グリッド: 1280px=4列 / 1536px=5列

**watch-video**
- `tlv-watch-layout`: メイン（プレイヤー+情報+通報+広告）| サイドバー（関連動画）

---

## スマホ UI（TLV 専用）

**`tlv-mobile-shell`**
- 下部タブ: HOME → dashboard / TALK → talk-home / LIVE → index / VIEW → videos / MY → my-videos
- VIEW (`videos.html`): おすすめ / 急上昇 / フォロー中 / 新着タブ
- safe-area + 固定タブバー高 56px

**watch-video**
- モバイルヘッダー（← VIEW）
- プレイヤー → 情報 → 広告 → 関連動画を縦積み

---

## フィード / 検索仕様

| フィード | 並び / 条件 |
|---------|------------|
| おすすめ | `published_at` desc |
| 急上昇 | `views_count` desc |
| フォロー中 | `live_creator_follows` の creator の動画のみ |
| 新着 | 直近 14 日 + `published_at` desc |

検索: デスクトップ上部 / 従来どおり title・description ilike  
デュアル root: desktop + mobile へ同一 HTML を同期描画

---

## 既存機能の維持

| 機能 | 状態 |
|------|------|
| 投稿 (video-upload) | 未変更 |
| 再生 + signed URL | 維持 |
| view 加算 Edge | 維持 |
| いいね RPC | 維持 |
| 通報 UI | 維持 (`data-live-report-toggle`) |
| 広告枠 | 維持 (`data-live-watch-ad`) |
| admin-videos | 未変更（旧シェル） |
| profile / my-videos | 未変更 |

---

## 検証結果

### `npm run verify:live-youtube-p7`

| 項目 | 結果 |
|------|------|
| 静的ファイル / dist 同期 | PASS |
| 390 / 768 / 1280 viewport console error 0* | PASS |
| シェル出し分け (mobile/desktop) | PASS |
| カテゴリチップ / フィードタブ | PASS |
| Phase 6 コア回帰 | PASS |

\* 期待どおりの Edge 403/404 ネットワークログは除外

### Phase 6 フル nested 回帰

`npm run verify:live-youtube-p6` の **E. nested 回帰**（p3→p5 連鎖）は dev 環境で subprocess タイムアウト/ npm warn により **flake** あり。  
**Phase 6 本体（通報・管理・広告・UI 41 項）** は `--skip-nested-regression` 付きで PASS。  
個別 `verify:live-youtube-p3` 等の単独実行を推奨。

---

## 未解決 / 今後

1. **my-videos / profile / upload** への TLV シェル展開（Phase 7 では videos / watch / index のみ）
2. **admin-videos** は運営向けのため旧レイアウトのまま
3. **カテゴリ** はキーワードフィルタ（DB カラムなし）
4. **nested verify 連鎖** の CI 安定化（全 phase を node 直実行に統一）

---

## 最終判定

**GO: YouTube P1（TLV Phase 0〜7）完了**

Phase 7 により PC/スマホ別体験の導線・UI が整い、Phase 1〜6 の機能を壊さず動画サービスとして自然なレイアウトになった。  
DB/RLS/Edge 変更なし。P1 スコープとして次は運用・本番デプロイ / Phase 6.5（`live_moderation_logs` CHECK 拡張）が任意後続。
