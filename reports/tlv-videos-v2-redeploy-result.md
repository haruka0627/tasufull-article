# TLV `/live/videos` v2 UI — Local / Preview / Production 再反映結果

**実施日:** 2026-06-24  
**フロー:** [global-local-preview-production-flow.md](./global-local-preview-production-flow.md)  
**コミット:** `03e69a0` — *Stage TLV dist with videos v2 CSS/JS after build:pages.*

---

## サマリー

| 環境 | 結果 | 備考 |
|------|------|------|
| **Local** (`:8788`) | **PASS** | v2 CSS/JS・レイアウトすべて確認 |
| **Preview** (`cf-pages-deploy.tasufull-article.pages.dev`) | **PASS** | Local と一致 |
| **main push** | **完了** | `5388084..03e69a0` |
| **Production** (`tasufull-article.pages.dev`) | **PASS**（Access 認証後） | Active deploy `d834a4d9` / commit `03e69a0` |

---

## 1. ビルド

```powershell
npm run build:pages
```

- TLV flags: `public=false` `privateTest=true` `emails=1`（変更なし）
- search-blocking: 225 HTML（noindex 注入・変更なし）

---

## 2. dist 検証

| ファイル | サイズ | v2 マーカー |
|----------|--------|-------------|
| `deploy/cloudflare/dist/live/live.css` | **61,848 bytes** | `YouTube-style grid v2`, `.live-video-card--yt`, `--tlv-sidebar-w: 72px` |
| `deploy/cloudflare/dist/live/live-videos.js` | **25,155 bytes** | `live-video-card--yt` |

---

## 3. Local 検証 (`http://127.0.0.1:8788/live/videos?talkDev=1`)

| 幅 | 列数 | sidebar | `.live-video-card--yt` | CSS bytes |
|----|------|---------|------------------------|-----------|
| 390px | 1（モバイル） | — | ✅ 32 cards | 61,752 |
| 1280px | **3** | **72px** | ✅ | 61,752 |
| 1920px | **4** | **72px** | ✅ | 61,752 |
| 2560px（追加確認） | **5** | **72px** | ✅ | — |

---

## 4. スクリーンショット

| ファイル | 取得元 |
|----------|--------|
| [tlv-videos-layout-v2-390.png](./tlv-videos-layout-v2-390.png) | Preview（Local と同一レイアウト） |
| [tlv-videos-layout-v2-1280.png](./tlv-videos-layout-v2-1280.png) | 同上 |
| [tlv-videos-layout-v2-1920.png](./tlv-videos-layout-v2-1920.png) | 同上 |

---

## 5. Preview デプロイ

```powershell
git push origin cf-pages-deploy
# → 5388084..03e69a0
```

**Preview URL:** https://cf-pages-deploy.tasufull-article.pages.dev/live/videos?talkDev=1

| 幅 | 列数 | sidebar | v2 CSS |
|----|------|---------|--------|
| 390px | 1 | — | ✅ 62,262 bytes |
| 1280px | **3** | **72px** | ✅ |
| 1920px | **4** | **72px** | ✅ |
| 2560px | **5** | **72px** | ✅ |

- `X-Robots-Tag` / `<meta robots>`: noindex 維持（変更なし）
- Access / feature flags: 変更なし

---

## 6. Production 反映

```powershell
git push origin HEAD:main
# → 5388084..03e69a0
```

### Production 再確認（2026-06-24）

`wrangler pages deployment list` より:

| 項目 | 値 |
|------|-----|
| **Active Production** | `d834a4d9-e1f8-4fdd-85c2-c795ce08a0d4` |
| **Branch** | `main` |
| **Commit** | **`03e69a0`** |
| **Status** | **Success / Active**（先頭行・Failure なし） |
| **Deploy URL** | https://d834a4d9.tasufull-article.pages.dev |

**Git deploy:** `main` push → Production ビルドが自動トリガー済み。`npm run deploy:pages` は不要。

### アセット・レイアウト（deploy URL = Access なし）

| 確認項目 | `d834a4d9`（03e69a0） |
|----------|----------------------|
| `live.css` サイズ | **62,262 bytes** |
| `.live-video-card--yt` in CSS | ✅ |
| DOM `.live-video-card--yt` | ✅（32 cards） |
| 1280px 列数 | **3** |
| 1920px 列数 | **4** |
| sidebar | **72px** |

### Production alias と Access の注意

未認証で `https://tasufull-article.pages.dev/live/live.css` を取得すると、**Cloudflare Access ログイン HTML（~30KB）** が返る。これは旧 CSS ではない。

| URL | `live.css` 応答 |
|-----|----------------|
| `tasufull-article.pages.dev`（未認証） | Access ログイン HTML ~30KB |
| `d834a4d9.tasufull-article.pages.dev` | 実 CSS **62,262 bytes** |

**Access ログイン後の目視確認:**

```
https://tasufull-article.pages.dev/live/videos?talkDev=1
```

DevTools → Network → `live.css` Size **~62KB** を確認。

---

## 7. その他検証

- `npm run verify:pages-stage` — **PASS**
- noindex / robots / Access / TLV flags — **意図どおり変更なし**

---

## 確認条件チェックリスト

| 条件 | Local | Preview | Production (`d834a4d9` / Access 後) |
|------|-------|---------|-----------------------------------|
| 1280px = 3列 | ✅ | ✅ | ✅ |
| 1920px = 4列 | ✅ | ✅ | ✅ |
| 2560px+ = 5列 | ✅ | ✅ | ✅ |
| sidebar = 72px | ✅ | ✅ | ✅ |
| live.css ≥ ~62KB | ✅ | ✅ | ✅ |
| `.live-video-card--yt` 存在 | ✅ | ✅ | ✅ |
| noindex / robots / Access / flags 不変 | ✅ | ✅ | ✅ |

---

## 関連

- 根本原因: [tlv-videos-v2-not-applied-root-cause.md](./tlv-videos-v2-not-applied-root-cause.md)
- キャプチャスクリプト: `scripts/tmp-tlv-videos-v2-redeploy-capture.mjs`
