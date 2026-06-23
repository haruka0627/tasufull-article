# Gate-A 実施結果 — 本番非公開テスト Preflight

| 項目 | 内容 |
|------|------|
| 実施日 | **2026-06-23** |
| 実施者 | Cursor Agent（リポジトリ grep / 目視 / curl プローブ） |
| 親チェックリスト | [`production-private-test-preflight.md`](production-private-test-preflight.md) |
| 制約 | コード変更なし · Access 未有効化 · デプロイなし · Supabase Dashboard 未変更 |

---

## 総合判定

| 判定 | 結果 |
|------|------|
| **Gate-A（リポジトリ・公開導線・SEO ソース）** | **Go** |
| **次フェーズ** | **Gate-B（Cloudflare Access 有効化）を直ちに実施** |

**根拠:** 本番絶対 URL の HTML/JS 露出 **0 件** · sitemap なし · OGP 本番ホストなし · ユーザー向け導線は相対パスのみ。  
**付記（Gate-A 外だが最優先）:** `tasufull-article.pages.dev` は **Access なしで HTTP 200**（NB-1C 既知）。Gate-B で封鎖必須。

---

## §2 grep 結果

| ID | 結果 | 件数 / 所見 | 判定 |
|----|------|-------------|------|
| G-URL-01 | HTML/JS/CSS（`deploy/` `reports/` 除外） | **0 件** | **PASS** |
| G-URL-02 | `deploy/cloudflare/dist` HTML/JS | **0 件** | **PASS** |
| G-URL-03 | `sitemap*.xml` / `robots.txt` | ファイル **なし** | **PASS** |
| G-URL-04 | `og:url` / `rel=canonical`（HTML） | **0 件** | **PASS** |
| G-URL-05 | `README.md` | **0 件**（`tasful.jp` / `pages.dev`） | **PASS** |
| G-URL-06 | `reports/*.md` | **約 22 ファイル**に `pages.dev` または `https://tasful.jp` | **PASS**（社内限定 · 外部 PR 禁止） |

### G-URL-06 内訳（代表）

| ファイル | 備考 |
|----------|------|
| `reports/nb1c-pages-dev-smoke.md` | pages.dev URL 記載 |
| `reports/nb1d-custom-domain-auth-precheck.md` | tasful.jp / pages.dev 手順 |
| `reports/nb1a-cloudflare-pages-hosting-plan.md` | ホスティング計画 |
| `reports/production-private-test-*.md` | 本ゲート文書自身 |

**修正候補（任意）:** リポジトリが GitHub public の場合、`reports/` を private 化するか、本番 URL を `[REDACTED]` に置換する運用ルールを追加。

### `tasful.jp` ホスト名のみ（許容）

| ファイル | 内容 |
|----------|------|
| `auth-current-user.js` | `PRODUCTION_HOSTS` |
| `member-auth.js` | 本番 host 判定コメント |
| `match/match-auth.js` | 本番 host 判定 |

→ URL 露出ではない（Preflight §1 許容範囲）。

---

## §3 目視チェック結果

### 3.1 HTML — 公開導線

| ID | 結果 | 判定 |
|----|------|------|
| V-HTML-01 | `index-top.html` — `live/` / 本番 URL **なし** | **PASS** |
| V-HTML-02 | `dashboard.html` — 本番 URL なし。`dashboard-mobile-home.js` に `shop-market-listing-new.html`（**相対**） | **PASS** |
| V-HTML-03 | `company/*.html` — `/builder/` **相対のみ** · 本番 URL なし | **PASS** |
| V-HTML-04 | `iwasho/*.html` — 同上 | **PASS** |
| V-HTML-05 | `live/*.html` — 本番 URL · SNS シェア **なし** | **PASS** |
| V-HTML-06 | `match/*.html` — 本番 URL **なし** | **PASS** |
| V-HTML-07 | `login.html` / `signup.html` — 外部は fonts/supabase CDN のみ · 本番 URL 文言 **なし** | **PASS** |
| V-HTML-08 | 全 HTML — `og:url` / `twitter:*` / `canonical` **未検出** | **PASS** |

### 3.2 JS — ランタイム露出

| ID | 結果 | 判定 |
|----|------|------|
| V-JS-01 | `auth-current-user.js` — `PRODUCTION_HOSTS` ホスト名のみ | **PASS** |
| V-JS-02 | `live/live-notify.js` — 本番絶対 URL なし。`talk-notifications-store.js` は DB 列マッピングのみ | **PASS** |
| V-JS-03 | `stripe-*` — ルートに `SITE_URL` / `tasful.jp` ハードコード **なし**（Edge シークレット依存） | **PASS** |
| V-JS-04 | `chat-supabase-config.js` — Supabase URL のみ · **service_role なし** | **PASS** |
| V-JS-05 | `stage-cloudflare-pages.mjs` — 生成物に `tasful.jp` **書き込みなし** | **PASS** |

### 3.3 sitemap / robots / OGP

| ID | 結果 | 判定 |
|----|------|------|
| V-SEO-01 | `sitemap.xml` / `sitemap_index.xml` **不存在** | **PASS** |
| V-SEO-02 | `robots.txt` **未存在**（ルート・dist とも） | **要対応**（小 PR · Gate-C 前） |
| V-SEO-03 | `_headers` に `X-Robots-Tag` **未設定** | **要対応**（小 PR · 計画通り） |
| V-SEO-04 | SNS 投稿 | **要人手確認**（運営者が未投稿を確認） |

### 3.4 Supabase Redirect URL

| ID | 結果 | 判定 |
|----|------|------|
| V-SB-01 | Site URL が `https://tasful.jp` か | **要人手確認**（Dashboard 未参照 · 変更禁止） |
| V-SB-02 | Redirect URLs に本番パス事前追加の有無 | **要人手確認** |
| V-SB-03 | Edge `SITE_URL` シークレット | **要人手確認** |
| V-SB-04 | Auth メール外部送信 | **要人手確認** |

**修正候補:** Gate-B 直前に Dashboard で Site URL / Redirect が本番化されていないことを運営者がスクリーンショット確認。

### 3.5 README / reports / SNS

| ID | 結果 | 判定 |
|----|------|------|
| V-DOC-01 | `README.md` — ローカル `127.0.0.1:8788` のみ · pages.dev **宣伝なし** | **PASS** |
| V-DOC-02 | `reports/` 内 pages.dev 多数 | **PASS**（社内限定） |
| V-DOC-03 | `git diff` に `tasful.jp` / `pages.dev` **追加なし** | **PASS** |
| V-SNS-01〜03 | 社外チャネル | **要人手確認** |

### 3.6 Cloudflare / DNS / CI

| ID | 結果 | 判定 |
|----|------|------|
| V-CF-01 | Access Application 草案 | **PASS**（[`production-private-test-access-plan.md`](production-private-test-access-plan.md) Ready） |
| V-CF-02 | デプロイ通知の公開チャネル | **要人手確認** |
| V-CF-03 | pages.dev 無防備共有 | **要対応**（下記インフラプローブ） |

### 3.7 モジュール導線

| ID | 結果 | 判定 |
|----|------|------|
| V-MOD-01 | `index-top.html` に LIVE 導線 **なし** | **PASS** |
| V-MOD-02 | `company/services.html` 等 — `/builder/` 相対のみ | **PASS** |
| V-MOD-03 | SNS で LIVE/MATCH 宣伝 | **要人手確認** |

---

## インフラプローブ（参考 · Gate-B トリガー）

| URL | curl 結果 | 所見 |
|-----|-----------|------|
| `https://tasful.jp/` | 接続失敗（exit 6） | apex **未解決 or 未到達**（[`nb1d-custom-domain-auth-precheck.md`](nb1d-custom-domain-auth-precheck.md) と一致） |
| `https://www.tasful.jp/` | 接続失敗 | 同上 |
| `https://tasufull-article.pages.dev/` | **HTTP 200** · Access ヘッダ **なし** | **要対応 — Gate-B で Access 必須** |

---

## Gate-A 判定表（更新）

| ID | 条件 | 状態 |
|----|------|------|
| GA-01 | G-URL-01 本番絶対 URL 0 件 | ✅ **PASS** |
| GA-02 | V-HTML-01〜08 | ✅ **PASS** |
| GA-03 | V-JS-01〜05 | ✅ **PASS** |
| GA-04 | V-SEO-01 sitemap なし | ✅ **PASS** |
| GA-05 | V-SB-01〜02 Access 前に本番化していない | ⚠️ **要人手確認** |
| GA-06 | V-SNS-01〜03 社外露出なし | ⚠️ **要人手確認** |
| GA-07 | V-CF-03 URL 無防備共有 | ⚠️ **要対応**（pages.dev 200 無認証 · Gate-B で封鎖） |
| GA-08 | LIVE P0 staging verify PASS | ✅ **PASS** |

**Gate-A 判定: Go** — リポジトリ・ソース・相対導線の条件を満たす。  
**Gate-B 着手条件:** 上記 ⚠️ は Access 有効化と運営者確認で解消。

---

## 修正候補一覧（本タスクでは未実施）

| 優先度 | 項目 | 対応案 |
|--------|------|--------|
| P0 | `pages.dev` 無認証 200 | Cloudflare Access Application（Gate-B） |
| P1 | `robots.txt` 未配置 | 小 PR — `Disallow: /` |
| P1 | `X-Robots-Tag` 未設定 | 小 PR — `_headers` |
| P1 | feature flags 未実装 | 小 PR — Gate-C |
| P2 | `reports/` 内 pages.dev 記載 | 社内限定運用 or redact |
| P2 | `chat-supabase-config.js` の `currentUserId` / `me` | 本番ビルドでは stage スクリプトが除去（[`stage-cloudflare-pages.mjs`](../deploy/cloudflare/stage-cloudflare-pages.mjs) コメント確認済） |
| 人手 | Supabase Site URL / Redirect | Dashboard 目視確認 |
| 人手 | SNS / メール署名 / GitHub Website | 運営者確認 |

---

## 次アクション

1. **Gate-B** — `tasful.jp`（DNS 後）と `tasufull-article.pages.dev` に Access · OTP · `rubi.hiro0613@gmail.com` のみ
2. **運営者** — V-SB / V-SNS / V-CF-02 の人手確認
3. **Gate-C** — robots · `_headers` · feature flags 小 PR → デプロイ

---

**署名:** Gate-A 実施記録 — 修正なし · Access 未有効化
