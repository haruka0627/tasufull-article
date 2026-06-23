# HP-MIGRATION-6F — Wix ADVANTAGE Direct Port

**Date:** 2026-06-18  
**Target:** `/iwasho/` ADVANTAGE セクション  
**Verdict:** **PASS**

---

## Summary

ユーザー提供の Wix ADVANTAGE embed（HTML + CSS）を **原文値のまま** `iwasho/index.html` + `corp-biz-home.css` へ移植しました。6B 近似実装（`.iwasho-home-advantage` / `.iwasho-home-glass-*`）は削除し、`<section class="advantage-section">` へ置換しています。

---

## 1. 原文から変更した箇所一覧

| # | 原文 | 変更後 | 種別 |
|---|------|--------|------|
| 1 | `<style>` インライン | `corp-biz-home.css` 外部ファイル | ファイル分離 |
| 2 | `html, body { margin:0; padding:0; background: radial-gradient(...); overflow-x: hidden; }` | `.iwasho-home-page { background: radial-gradient(circle at 50% 50%, #111827 0%, #030712 100%) !important; }` — **`margin/padding/overflow-x:hidden` 未転記** | scope + 禁止遵守 |
| 3 | `.advantage-section` 他各セレクタ | `.iwasho-home-page .advantage-section …` | scope |
| 4 | `h3 { … }` / `p { … }` 素セレクタ | `.iwasho-home-page .advantage-section h3` / `… p` | scope |
| 5 | 6B `.iwasho-home-advantage` + 3×近似カード | ユーザー原文 `<section class="advantage-section">` へ **置換** | 原文復元 |

### 変更していないもの（ADVANTAGE CSS 値）

- `.advantage-section` padding `80px 0`、transparent background
- `.particles-bg` radial-gradient `rgba(59,130,246,0.12)`
- `.full-container` width `94%` / max-width `1500px`
- `.sub-line` / `.main-title` font-size・letter-spacing・text-shadow
- `.advantage-grid` flex / gap `40px`（1280px 以下 `25px`、980px 以下 column）
- `.glass-card` padding `60px 45px 40px`、min-height `460px`（1280px 以下 `480px`）、backdrop-filter `blur(15px)`、border / shadow / hover transform
- `.icon-block` `105px`、`:before` glow
- `h3` `24px`（1280px 以下 `22px`）、`p` `16px` / line-height `1.9`
- SVG 3種（40 emblem / check diamond / orbit circle）— **path・text 含め原文どおり**
- カード本文・見出しテキスト — **原文どおり**

---

## 2. 変更理由

| 変更 | 理由 |
|------|------|
| インライン → 外部 CSS | 既存ページ構成（6D header / 6E hero）との統合 |
| `html, body` → `.iwasho-home-page` scope | 許可ルール: global background / reset の局所化 |
| `overflow-x: hidden` 未転記 | 許可ルール: body/html でページスクロールを阻害しない |
| `h3` / `p` を `.advantage-section` 配下へ scope | 許可ルール: INFO 等他セクションへの素セレクタ漏れ防止 |
| 6B 近似 ADVANTAGE 削除 | ユーザー指示: 既存近似は削除して Wix 原文へ置換 |

---

## 3. 検証結果

**URL:** http://127.0.0.1:8788/iwasho/

```powershell
npm run dev
node scripts/capture-iwasho-advantage-6f.mjs
```

| Viewport | layout | overflow-x | body overflow | cards | SVG | console |
|----------|--------|------------|---------------|-------|-----|---------|
| **390** | 1 column | なし | visible | 3 | 3 | **0** |
| **768** | 1 column | なし | visible | 3 | 3 | **0** |
| **1280** | 3 row | なし | visible | 3 | 3 | **0** |

- hero 直下から ADVANTAGE へ自然接続（scrollIntoView 時 gap 0）
- 旧 `.iwasho-home-advantage` DOM: **0**
- 1280px 時 card min-height: **480px**（原文 `@media (max-width: 1280px)` どおり）

### スクショ

`reports/screenshots/hp-migration-6f-advantage-direct-port/`

| Viewport | File |
|----------|------|
| 390 | `advantage-390.png` |
| 768 | `advantage-768.png` |
| 1280 | `advantage-1280.png` |

---

## 4. 変更ファイル

| File | Change |
|------|--------|
| `iwasho/index.html` | Wix ADVANTAGE HTML 原文を `<main>` 内へ挿入 |
| `corp-biz-home.css` | 6B ADVANTAGE CSS 削除 → 6F 原文 CSS（scope 付き）追加 |
| `scripts/capture-iwasho-advantage-6f.mjs` | 390 / 768 / 1280 検証スクリプト（新規） |

---

## 5. ローカル確認手順

1. `npm run dev`（8788）
2. http://127.0.0.1:8788/iwasho/ を開く
3. hero 下の ADVANTAGE で 3 カード・glass hover・navy radial を目視確認
4. `node scripts/capture-iwasho-advantage-6f.mjs` → `pass: true`

**Note:** dist 反映には `iwasho/index.html` と `corp-biz-home.css` を `deploy/cloudflare/dist/` へ同期するか、`npm run build:pages`（Supabase env 要）を実行してください。
