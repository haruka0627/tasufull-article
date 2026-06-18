# HP-MIGRATION-5 — TOP Wix Code Integration

**Date:** 2026-06-18  
**Target:** `/iwasho/index.html`  
**Verdict:** **PASS**（390 / 768 / 1280 検証済）

---

## Summary

Wix TOP ページ相当の embed HTML/CSS/JS を、**`.iwasho-home-page` スコープ**で `/iwasho/index.html` に統合しました。既存 `corp-header` / `corp-footer` / ダミー hero は **TOP 専用 UI に置換**しています（他 IWASHO 下位ページは従来の `corp-*` のまま）。

---

## 変更ファイル一覧

| File | Action |
|------|--------|
| `iwasho/index.html` | **全面置換** — Wix TOP 構造（header / hero / advantage / info / footer） |
| `corp-biz-home.css` | **新規** — 全スタイル `.iwasho-home-page` 配下にスコープ |
| `iwasho/iwasho-home.js` | **新規** — 3 段メッセージ演出 + 14 秒後ロゴ表示 |
| `scripts/migrate-corp-hp-content.mjs` | **更新** — `iwasho/index.html` 上書きを SKIP |
| `scripts/capture-iwasho-home-top.mjs` | **新規** — 390/768/1280 検証キャプチャ |

**未変更:** `corp-header.css`, `corp-footer.css`（TOP では未使用）

---

## Wix から移植した要素

| # | Wix 要素 | 実装 |
|---|----------|------|
| 1 | 固定ヘッダー near-black + rainbow shine | `.iwasho-home-header` + `__shine` + `@keyframes ih-rainbow-shine` |
| 1 | PC 140px / SP 90px | `--ih-header-h` + `@media (min-width:900px)` |
| 1 | IWASHO × TASFUL ロゴ | header brand + hero logo reveal |
| 2 | full viewport hero + video BG | `.iwasho-home-hero` `min-height:100svh` + Wix CDN mp4 |
| 2 | stars / nebula | CSS radial + `ih-stars-drift` / `ih-nebula-pulse` |
| 2 | 3 段メッセージ | `.iwasho-home-hero__line` + JS 3.5s 間隔 |
| 2 | 14 秒後ロゴ | `iwasho-home.js` → `.iwasho-home-hero__logo-reveal` |
| 3 | ADVANTAGE glass-card ×3 | `.iwasho-home-advantage` + inline SVG + hover glow |
| 4 | info-section ×6 | `.iwasho-home-info-card` + blue left accent + detail btn |
| 5 | modern-footer | `.iwasho-home-footer` sitemap / support 2 カラム |

### リンク修正（実ページへ）

| Label | href |
|-------|------|
| 会社概要 | `/iwasho/about.html` |
| 対応業務 | `/iwasho/services.html` |
| パートナー | `/iwasho/partners.html` |
| お問い合わせ | `/iwasho/contact.html` |
| 利用規約 | `/company/legal/terms.html` |
| プライバシーポリシー | `/iwasho/privacy.html` |
| 経営陣紹介 | `/iwasho/team.html` |

---

## 移植しなかった危険 CSS / パターン

| Wix / 一般パターン | 理由 | 代替 |
|--------------------|------|------|
| `html, body { margin:0 !important }` グローバル reset | プラットフォーム CSS 破壊 | `corp-layout.css` 既存 + `body.corp-body--iwasho-home` のみ背景色 |
| `body { overflow: hidden !important }` | スクロール不可 | **未使用** — audit で visible 確認 |
| `body { background: ... !important }` 乱用 | 他ページ汚染 | `body.corp-body--iwasho-home { background:#0a0a0f }` 1 行 |
| `100vw` + `margin-left: calc(-50vw + 50%)` hero ハック | horizontal overflow 原因 | `min-height:100svh` + padding-top header 分 |
| 素の `h3 {}` / `p {}` 上書き | corp-* 衝突 | `.iwasho-home-*__title` / `__text` のみ |
| Wix inline `<style>` 塊 | スコープ不可 | `corp-biz-home.css` に集約 |
| Wix Forms / Velo JS | 依存再導入 | 外部リンクのみ（contact ページ側） |
| `position:fixed` 全画面 overlay で scroll lock | UX 劣化 | hero 内 `__media` のみ `overflow:hidden` |

---

## 検証結果

```text
npm run build:pages                              # OK
node scripts/capture-iwasho-home-top.mjs         # PASS
```

| Viewport | overflow-x | scroll | header fixed | header h | footer | console |
|----------|------------|--------|--------------|----------|--------|---------|
| **390** | 0 | OK (3781px) | OK | 90px | OK | 0 |
| **768** | 0 | OK (2729px) | OK | 90px | OK | 0 |
| **1280** | 0 | OK (2458px) | OK | 140px | OK | 0 |

追加確認:
- video: `autoplay muted loop playsinline` — OK
- body/html `overflow`: **visible**（hidden なし）
- hero `min-height`: 100svh 相当

Screenshots: `reports/screenshots/hp-migration-5-iwasho-top/`
- `iwasho-top-{390,768,1280}-hero.png`
- `iwasho-top-{390,768,1280}-footer.png`
Audit JSON: `reports/screenshots/hp-migration-5-iwasho-top/audit.json`

Local: `npx --yes serve deploy/cloudflare/dist -p 8788` → http://127.0.0.1:8788/iwasho/

---

## 保守メモ

- `node scripts/migrate-corp-hp-content.mjs` は **iwasho/index.html を SKIP**（他 IWASHO ページのみ再生成）
- TOP 変更は `iwasho/index.html` + `corp-biz-home.css` + `iwasho/iwasho-home.js` を直接編集
- 14 秒ロゴ演出の確認はブラウザで hero を待機して目視推奨（キャプチャは 0.5s 時点）
