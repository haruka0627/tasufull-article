# HP-MIGRATION-6G — Wix INFO Section Direct Port

**Date:** 2026-06-18  
**Target:** `/iwasho/` INFO セクション  
**Verdict:** **PASS**

---

## Summary

ユーザー提供の Wix info-section embed（HTML + CSS）を **原文値のまま** `iwasho/index.html` + `corp-biz-home.css` へ移植しました。6B 近似実装（`.iwasho-home-info` / `.iwasho-home-info-card*`）は削除し、`<section class="info-section">` へ置換しています。`href="#"` は指定どおり実ページリンクへ差し替え済みです。

---

## 1. 原文から変更した箇所一覧

| # | 原文 | 変更後 | 種別 |
|---|------|--------|------|
| 1 | `<style>` インライン | `corp-biz-home.css` 外部ファイル | ファイル分離 |
| 2 | `html, body { margin:0; padding:0; background: radial-gradient(...); background-attachment: fixed; }` | `.iwasho-home-page { background: radial-gradient(circle at 50% 50%, #1a2333 0%, #020617 100%) !important; background-attachment: fixed; }` — **`margin/padding/overflow` 未転記** | scope + 禁止遵守 |
| 3 | `.info-section` / `.container` 他各セレクタ | `.iwasho-home-page .info-section …` | scope |
| 4 | `h3 { … }` / `p { … }` 素セレクタ | `.iwasho-home-page .info-section h3` / `… p` | scope |
| 5 | `<a href="#" class="btn-detail">` ×6 | 実ページ URL へ差し替え（下表） | 許可されたリンク置換 |
| 6 | 6B `.iwasho-home-info` + 6カード近似 | ユーザー原文 `<section class="info-section">` へ **置換** | 原文復元 |

### href 差し替え（テキストは原文どおり）

| カード | ボタン | href |
|--------|--------|------|
| 対応業務 | 詳細へ | `/iwasho/services.html` |
| 経営陣紹介 | 詳細へ | `/iwasho/team.html` |
| 協力パートナー | 詳細へ | `/iwasho/partners.html` |
| 協力パートナー | 登録へ | `/iwasho/partners.html#partner` |
| 会社概要 | 詳細へ | `/iwasho/about.html` |
| お問い合わせ | 詳細へ | `/iwasho/contact.html` |

### 変更していないもの（INFO CSS 値）

- `.info-section` padding `100px 0`、transparent background
- `.container` width `92%` / max-width `1200px`
- `.info-list` column / gap `50px`
- `.info-item` padding `60px 70px`、backdrop-filter `blur(15px)`、border / shadow / hover transform
- `.info-item::before` 青ライン `4px × 36px`
- `.item-content` flex / gap `40px`
- `.button-container` width `180px` / gap `15px`
- `.simple-item` padding `40px 70px`
- `.btn-detail` padding `14px 0`、border `1.5px`、font-size `13px`、neon box-shadow
- `h3` `30px`、`p` `15px` / line-height `1.8`
- 全カード本文・見出しテキスト — **原文どおり**

---

## 2. 変更理由

| 変更 | 理由 |
|------|------|
| インライン → 外部 CSS | 既存ページ構成（6D header / 6E hero / 6F advantage）との統合 |
| `html, body` → `.iwasho-home-page` scope | 許可ルール: global background の局所化 |
| `margin/padding` 未転記 | ページ全体 reset の global 化を回避 |
| `h3` / `p` / `.container` を `.info-section` 配下へ scope | 許可ルール: 他セクションへの汎用セレクタ漏れ防止 |
| `href="#"` → 実 URL | ユーザー許可: 実ページリンクへ差し替え可 |
| 6B 近似 INFO 削除 | ユーザー指示: 既存近似は削除して Wix 原文へ置換 |
| `.iwasho-home-page` background を INFO 版 gradient に更新 | INFO embed の「Bright Black」統合ポイント（6F advantage 版を上書き） |

---

## 3. 検証結果

**URL:** http://127.0.0.1:8788/iwasho/

```powershell
npm run dev
node scripts/capture-iwasho-info-6g.mjs
```

| Viewport | layout | overflow-x | buttons overflow | button width | hrefs | console |
|----------|--------|------------|------------------|--------------|-------|---------|
| **390** | column ×6 | なし | なし | 180px | OK | **0** |
| **768** | column ×6 | なし | なし | 180px | OK | **0** |
| **1280** | column ×6 | なし | なし | 180px | OK | **0** |

- 旧 `.iwasho-home-info` DOM: **0**
- info-item: **6**（simple-item: **2**）
- btn-detail: **6**

### スクショ

`reports/screenshots/hp-migration-6g-info-section-direct-port/`

| Viewport | File |
|----------|------|
| 390 | `info-390.png` |
| 768 | `info-768.png` |
| 1280 | `info-1280.png` |

---

## 4. 変更ファイル

| File | Change |
|------|--------|
| `iwasho/index.html` | Wix INFO HTML 原文 + リンク差し替え |
| `corp-biz-home.css` | 6B INFO CSS 削除 → 6G 原文 CSS（scope 付き）追加 |
| `scripts/capture-iwasho-info-6g.mjs` | 390 / 768 / 1280 検証スクリプト（新規） |

---

## 5. ローカル確認手順

1. `npm run dev`（8788）
2. http://127.0.0.1:8788/iwasho/ を開く
3. ADVANTAGE 下の INFO で 6 縦カード・ネオンボタン・hover を目視確認
4. `node scripts/capture-iwasho-info-6g.mjs` → `pass: true`

**Note:** dist 反映には `iwasho/index.html` と `corp-biz-home.css` を `deploy/cloudflare/dist/` へ同期するか、`npm run build:pages`（Supabase env 要）を実行してください。
