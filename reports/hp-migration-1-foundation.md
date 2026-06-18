# HP-MIGRATION-1 — 企業 HP 共通土台

**実施日:** 2026-06-18  
**目的:** Wix 移植前に Cloudflare Pages 上の企業サイト土台を作成  
**判定:** **READY_FOR_CONTENT_MIGRATION**

---

## サマリ

| 項目 | 状態 |
|------|------|
| TASFUL `/company/` | ✅ 9 ページ |
| IWASHO `/iwasho/` | ✅ 7 ページ |
| 共通 CSS ×3 | ✅ |
| プラットフォーム JS/CSS 非依存 | ✅ |
| モバイル優先 + PC ナビ | ✅ |
| 共通ヘッダー / フッター | ✅ |
| Wix コード移植 | ⏸ 未実施（意図どおり） |
| `npm run build:pages` | PASS（946 files） |
| `npm run verify:pages-stage` | PASS |

---

## URL マップ

### TASFUL

| パス | ファイル |
|------|----------|
| `/company/index.html` | ホーム |
| `/company/services.html` | サービス |
| `/company/vision.html` | ビジョン |
| `/company/about.html` | 会社概要 |
| `/company/faq.html` | FAQ |
| `/company/contact.html` | お問い合わせ |
| `/company/legal/terms.html` | 利用規約 |
| `/company/legal/privacy.html` | プライバシーポリシー |
| `/company/legal/tokushoho.html` | 特定商取引法 |

### IWASHO

| パス | ファイル |
|------|----------|
| `/iwasho/index.html` | ホーム |
| `/iwasho/services.html` | サービス |
| `/iwasho/about.html` | 会社概要 |
| `/iwasho/team.html` | チーム |
| `/iwasho/partners.html` | パートナー |
| `/iwasho/contact.html` | お問い合わせ |
| `/iwasho/privacy.html` | プライバシーポリシー |

---

## 共通アセット

| ファイル | 役割 |
|----------|------|
| `corp-layout.css` | タイポ · ヒーロー · カード · FAQ · レスポンシブ grid |
| `corp-header.css` | スティッキーヘッダー · モバイル `<details>` メニュー · PC 横並び nav |
| `corp-footer.css` | ダークフッター · 法務リンク |

**ブランド切替:** `<body data-corp="tasful">` / `data-corp="iwasho"` で CSS 変数（アクセント色・ヒーロー背景）を切替。

**パス規約:** サイトルート絶対パス（`/corp-layout.css`, `/company/...`）— Cloudflare Pages 配信向け。

---

## プラットフォーム独立性

| 確認 | 結果 |
|------|------|
| `member-auth.js` / Supabase / `talk-runtime` | **読み込みなし** |
| プラットフォーム CSS（`style.css` 等） | **読み込みなし** |
| JavaScript | **なし**（静的 HTML + CSS のみ） |
| `robots` | `noindex, nofollow`（仮土台 · 移植完了後に変更可） |

---

## 実装ファイル

### 新規

| 種別 | パス |
|------|------|
| CSS | `corp-layout.css`, `corp-header.css`, `corp-footer.css` |
| HTML | `company/**`（9）, `iwasho/**`（7） |
| 生成スクリプト | `scripts/scaffold-corp-hp.mjs` |

### 変更なし

- `deploy/cloudflare/stage-cloudflare-pages.mjs` — 既存 copy ルールで `company/` · `iwasho/` · corp CSS を dist に同梱
- プラットフォーム既存ページ — 非接触

---

## ローカル確認

```powershell
npm run build:pages
npx --yes serve deploy/cloudflare/dist -p 8788
# http://127.0.0.1:8788/company/
# http://127.0.0.1:8788/iwasho/
```

ページ再生成（文言テンプレ更新時）:

```powershell
node scripts/scaffold-corp-hp.mjs
```

---

## 次フェーズ（HP-MIGRATION-2 想定）

1. Wix から正式文案 · 画像 · ロゴ SVG/PNG を移植
2. `noindex` 解除 · OGP / favicon 追加
3. お問い合わせフォーム（Wix Form / 外部 SaaS / Edge Function）
4. 必要に応じ `tasful.jp/company` · サブドメイン / パスルーティング設計
5. デザイン QA（390 / 768 / 1280）

---

## 判定根拠

| 条件 | 状態 |
|------|------|
| 要求 URL ツリー完備 | ✅ |
| 共通 header/footer | ✅ |
| モバイル + PC | ✅ |
| dist 同梱 | ✅ |
| Wix 未移植（スコープどおり） | ✅ |

**READY_FOR_CONTENT_MIGRATION** — Wix コンテンツ・デザイン資産の差し替えフェーズへ進行可能。

**BLOCKED 理由なし**
