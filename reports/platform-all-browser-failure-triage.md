# Platform all-browser 失敗棚卸し

実行日: 2026-06-26  
対象: `scripts/test-platform-all-browser.mjs`（読取のみ）  
関連ログ: `reports/platform-all-browser-current-failures.md`

## 実行環境

| 項目 | 値 |
|------|-----|
| コマンド | `BASE_URL=http://127.0.0.1:8788 node scripts/test-platform-all-browser.mjs` |
| BASE_URL | `http://127.0.0.1:8788`（wrangler pages dev） |
| コード変更 | なし |
| ReferenceError | 解消済み（`760ea15`） |

## 失敗 7件一覧

| # | 失敗名 | 分類 | 修正対象 |
|---|--------|------|----------|
| 1 | index-top: 求人一覧 | **B** | test |
| 2 | index-top: AI相談 | **B** | test |
| 3 | index-top: TALK導線(chat-list) | **A/B** | test |
| 4 | index.html: 求人 | **D + B** | test |
| 5 | index skill: カード0件 | **D** | test |
| 6 | index worker: カード0件 | **D** | test |
| 7 | index product: カード0件 | **D** | test |

分類凡例: **A** テスト期待値が古い / **B** 正しいUI変更にテスト未追従 / **C** 実装 regression / **D** dev server・ルーティング・fixture / **E** 判断不能

**source regression（C）: 0件** — Content Gate 起因の全件非表示は確認されず。

---

## 各失敗の詳細

### 1. index-top: 求人一覧

| 項目 | 内容 |
|------|------|
| 対象URL | `http://127.0.0.1:8788/index-top.html` |
| 期待セレクタ | `a[href="job-top.html"], a[href*="category=job"]` |
| 期待 | href に `job` を含む |
| 実DOM | 求人カテゴリカード: `href="public-board.html"`（ラベル「求人」） |
| ヘッダー導線 | `掲載を探す` → `/market/`、`案件・求人` クイックリンク → `public-board.html` |
| 現行UIとして正しいか | **Yes** — 求人TOPは `job-top.html` ではなく public board 導線に統合 |
| 修正対象 | **test** — `public-board.html` または `href*="public-board"` を期待 |

### 2. index-top: AI相談

| 項目 | 内容 |
|------|------|
| 対象URL | `index-top.html` |
| 期待セレクタ | `a[href="chat-list.html"]` |
| 実DOM | ヘッダー `AI相談` → `ai-workspace.html`；カテゴリカード `top-category-card--ai` → `ai-workspace.html` |
| 現行UIとして正しいか | **Yes** — Platform AI は TASFUL AI Workspace 遷移（`docs/AI/PLATFORM_AI.md`） |
| 修正対象 | **test** — `ai-workspace.html` を期待 |

### 3. index-top: TALK導線(chat-list)

| 項目 | 内容 |
|------|------|
| 対象URL | `index-top.html` |
| 期待セレクタ | `a.top-category-card--ai[href*="chat-list"]` |
| 実DOM | `top-category-card--ai` は `ai-workspace.html` 向け。`chat-list` リンクなし |
| 現行UIとして正しいか | **Yes** — AIカードは Workspace。TALK は別セクション（テスト §6 で chat-list→talk-home は **PASS**） |
| 修正対象 | **test** — ケース削除、または「AI Workspace カード」検証に差し替え |

### 4. index.html: 求人

| 項目 | 内容 |
|------|------|
| 対象URL | テストは `index.html` を open → **308 リダイレクト** → `/`（サイトルート） |
| 期待セレクタ | `a[href="job-top.html"]`（相対パス・完全一致） |
| 実DOM（マーケット正本） | `/market/` 上の `index.html` 相当: `href="/job-top.html"`（先頭スラッシュ付き） |
| ルーティング | `GET /index.html` → `308 Location: /`（マーケットではない） |
| 現行UIとして正しいか | **マーケット側は正しい**；テストが誤ページ＋誤セレクタ |
| 修正対象 | **test** — 検証対象を `/market/` にし、`a[href="/job-top.html"], a[href*="job-top"]` 等 |

### 5–7. index skill / worker / product: カード0件

| 項目 | 内容 |
|------|------|
| 対象URL（テスト） | `index.html?category=skill` 等 |
| HTTP | `308` → `/?category=skill`（`home-page` クラスなし、`TasuListingStore` 未ロード） |
| 期待セレクタ | `[data-home-featured] a, [data-home-rank-popular] a, .listing-card a` |
| 実DOM（誤URL） | featured 0 / rank 0 / listing-card 0 |
| 実DOM（正URL `/market/`） | **cardCount 12**（featured 9 + rankPopular 3）、`home-page` + demo マージ正常 |
| Content Gate | `/market/` でカード表示あり → **全件非表示の regression ではない** |
| `?category=` | `index-home.js` は URL クエリ未参照（別件・defer） |
| テスト順序 | 一覧チェックは detail 用 `seedGeneralDemoIfMissing` **より前**（今回の 0 件の主因ではない） |
| 修正対象 | **test** — URL を `/market/` または `market/?category=...` に変更 |

#### ルーティング確認（probe）

```
GET /index.html              → 308 /
GET /index.html?category=skill → 308 /?category=skill
GET /market/                 → 200 (home-page, cards OK)
```

---

## 特記論点

### TOP導線（index-top）

- ヘッダー正本: `掲載を探す` → `/market/`、`掲載する` → `post.html`、`AI相談` → `ai-workspace.html`
- `お知らせ` / `ご利用ガイド` は `#footerColAbout` / `#footerColGuide`（アンカー）— 既存合格項目と矛盾なし
- スキル/ワーカー/商品カテゴリは `/market/?category=*` へ遷移（テスト **PASS**）

### indexカード0件

| 仮説 | 判定 |
|------|------|
| データ未投入 | **No**（`/market/` で demo + 描画あり） |
| Content Gate で approved+public のみ → 0件 | **No**（同一 dev で shop/job は多数表示） |
| fixture / seed 期待値古い | **部分**（URL 誤りが主因） |
| 実装が全件非表示 | **No** |

---

## 修正範囲の整理

### test修正でよいもの（7件すべて）

1. 求人カテゴリ → `public-board.html`
2. AI相談 → `ai-workspace.html`
3. TALK(chat-list) カード → 削除 or Workspace 検証
4. index 求人 → `/market/` + `/job-top.html` セレクタ
5–7. 一覧 URL → `/market/`（必要なら `?category=` は将来別タスク）

### source修正が必要なもの

**なし**（本棚卸し範囲）

### fixture修正が必要なもの

**なし**（dev server の 308 ルーティングは本番 Pages と同系。テスト側で正URLを使う）

### 今すぐコミットしてよい範囲

- `scripts/test-platform-all-browser.mjs` の期待値・URL 更新のみ
- Platform source / dist / post.js / shop-market-product-data.js は **不要**

### defer（別タスク）

- `index-home.js` が `?category=` を読まない仕様とテスト意図の整合
- `index.html` vs `/market/` のドキュメント化
- ダッシュボード等の `index.html?category=*` リンクとルーティングの横断確認

---

## Go / No-Go

| 項目 | 判定 |
|------|------|
| **test expectation update** | **Go** — 7件すべてテスト側 |
| **source fix** | **No-Go** — regression 証拠なし |
| **fixture update** | **No-Go** |
| **defer** | `?category=` URL セマンティクス、ルーティング文書化 |

**総合: Go（テスト期待値更新のみ）**

Content Gate コミット（`bf89ec7`）を阻害する Platform regression は **見つからず**。

---

## 推奨次コミット

```
test(platform): align all-browser expectations with current UI
```

変更案（概要）:

- `TOP_LINKS_INDEX_TOP`: 求人 → `public-board.html`；AI → `ai-workspace.html`；TALK 行を Workspace 検証に変更
- `TOP_LINKS_INDEX`: path を `market/`（または nav 検証を market ページに移動）；求人セレクタを `/job-top.html` 対応
- `LIST_PAGES`: `index.html?category=*` → `market/?category=*`（または `market/`）
- 任意: 一覧前 `waitForSelector('[data-home-featured] a')` で安定化

**非推奨（今回不要）:**

```
fix(platform): restore index marketplace cards
```

カードは `/market/` で正常表示のため。
