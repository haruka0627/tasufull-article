# TASFUL 本番 TOP ルーティング調査・修正レポート

**実施日:** 2026-06-24  
**コミット:** `1b32aba` — *Route site root to TASFUL platform TOP (index-top) at build time.*

---

## 結論

| 項目 | 結果 |
|------|------|
| 原因 | `build:pages` が repo の `index.html`（掲載マーケット TOP）をそのまま `dist/index.html` に配置し、Pages の `/` がそれを配信していた |
| 修正 | ビルド時に `index-top.html` → `dist/index.html`、旧 `index.html` → `dist/market/index.html`、`_redirects` で `/index.html` → `/market/` |
| Local / Preview / Production deploy | **PASS** |
| Access / noindex / robots / flags | **変更なし** |

---

## 1. `index-top.html` の存在

| ファイル | 状態 |
|----------|------|
| `index-top.html`（リポジトリ直下） | ✅ 存在 |
| 内容 | `body.top-page` · `.tas-hero` — **TASFUL プラットフォーム TOP** |

---

## 2. 修正前の `build:pages` 動作

`stage-cloudflare-pages.mjs` はリポジトリ直下を再帰コピーするのみ。

| ソース | dist 出力 | 備考 |
|--------|-----------|------|
| `index.html` | `dist/index.html` | **掲載マーケット**（`home-page`） |
| `index-top.html` | `dist/index-top.html` | TASFUL TOP（別ファイル） |

**Cloudflare Pages の `/` は `index.html` を既定ドキュメントとする**ため、本番 `/` がマーケット TOP になっていた。

---

## 3. 修正前 `dist/index.html` の内容

```
body class="home-page"
h1: あなたの「得意」をつなぐマーケットプレイス
CSS: index-home.css
```

→ **MARKET / 掲載一覧 TOP 相当**（`shop-store.html` の TASFUL市場 UI とは別の legacy home）

---

## 4. 原因

```
リポジトリ
  index.html      → 掲載マーケット TOP（legacy）
  index-top.html  → TASFUL プラットフォーム TOP（正）

build:pages（修正前）
  dist/index.html      ← index.html（誤ってサイトルートに）
  dist/index-top.html  ← index-top.html

Cloudflare Pages
  /  → dist/index.html  → マーケット TOP が表示
```

`_redirects` にルート差し替えルールはなかった。

---

## 5. 実施した修正

### `deploy/cloudflare/stage-cloudflare-pages.mjs`

`applyRootTopRouting()` を追加:

1. `dist/index.html`（legacy market）を `dist/market/index.html` へコピー
2. `dist/index-top.html` を `dist/index.html` に上書き

### `deploy/cloudflare/_redirects`

```
/index.html   /market/   301
/market       /market/   301
```

- `/` → TASFUL TOP（`dist/index.html` = index-top 内容）
- `/index.html` 直リンク → legacy market へリダイレクト（既存リンク維持）

### `scripts/verify-cloudflare-pages-stage.mjs`

- `dist/index.html` が `top-page` / `tas-hero` であること
- `dist/market/index.html` が `home-page` であること
- `_redirects` に `/index.html → /market/` があること

---

## 6. MARKET TOP の URL 分離

| URL | 画面 |
|-----|------|
| `/` | **TASFUL プラットフォーム TOP**（index-top） |
| `/index-top` | 同上（従来どおり） |
| `/market/` | legacy 掲載マーケット TOP（旧 `index.html`） |
| `/shop-store` | **TASFUL市場** MARKET TOP（変更なし） |

TLV `/live/*` · TALK · MATCH · Builder · Partner · IWASHO の既存パスは変更なし。

---

## 7. 環境別確認

### Local — `http://127.0.0.1:8788/`

| URL | 期待 | 結果 |
|-----|------|------|
| `/` | TASFUL TOP | ✅ `top-page` · `tas-hero` |
| `/index-top` | TASFUL TOP | ✅ |
| `/market/` | legacy market | ✅ `home-page` |
| `/shop-store` | TASFUL市場 | ✅ `tasful-market-page` |

### Preview — `https://cf-pages-deploy.tasufull-article.pages.dev/`

deploy `5ffea447` / commit `1b32aba` — **PASS**（上表と同一）

### Production — `https://tasufull-article.pages.dev/`

| 項目 | 値 |
|------|-----|
| Active deploy | `43e87305` |
| Commit | **`1b32aba`** |
| Status | **Success / Active** |
| Deploy URL 検証 | https://43e87305.tasufull-article.pages.dev/ — **PASS** |

**注意:** Production alias は Cloudflare Access あり。未認証の自動取得はログイン HTML になる。Access ログイン後に `/` で `tas-hero` が表示されることを目視確認。

---

## 8. 検証コマンド

```powershell
npm run build:pages
npm run verify:pages-stage
node scripts/tmp-tasful-root-top-check.mjs
node scripts/tmp-tasful-root-top-check.mjs --base=https://cf-pages-deploy.tasufull-article.pages.dev
```

---

## 関連

- [global-local-preview-production-flow.md](./global-local-preview-production-flow.md) — TASFUL TOP は `/index-top` と記載（`/ ` は本修正で整合）
- [tlv-production-routing-investigation.md](./tlv-production-routing-investigation.md) — 別件（live パスの MARKET 落ち込み）
