# HP-MIGRATION-6E — Wix Hero Direct Port

**Date:** 2026-06-18  
**Target:** `/iwasho/` ヒーロー  
**Verdict:** **PASS**

---

## Summary

ユーザー提供の Wix Hero embed（HTML + CSS）を **原文値のまま** `iwasho/index.html` + `corp-biz-home.css` へ移植しました。タイムラインは **CSS animation のみ**（1s / 5s / 9s / 14s）。`iwasho-home.js` は不要のため HTML から script タグを削除しました。

---

## 1. 原文から変更した箇所一覧

| # | 原文 | 変更後 | 種別 |
|---|------|--------|------|
| 1 | `<style>` インライン | `corp-biz-home.css` 外部ファイル | ファイル分離 |
| 2 | `* { margin:0; padding:0; box-sizing }` | `.iwasho-home-page, .iwasho-home-page * { … }` | scope |
| 3 | `body, html { width:100%; height:100%; background:#000; overflow:hidden }` | `.iwasho-home-page { width:100%; background:#000 }` — **`overflow:hidden` 未転記** | scope + 禁止遵守 |
| 4 | `.top-hero` 他各セレクタ | `.iwasho-home-page .top-hero` 等 | scope |
| 5 | `@keyframes` 名（starsMove 等） | **変更なし** | — |
| 6 | 6B の `<p class="hero-msg">` + img ロゴ | 原文 `<h2>` + `.txt-blue-glow` テキストロゴへ **置換** | 原文復元 |
| 7 | `iwasho-home.js` タイムライン JS | **削除**（CSS animation と重複） | 原文は JS なし |
| 8 | `<section class="top-hero">` | `<div class="top-hero">` | 原文どおり |

### 変更していないもの（hero CSS 値）

- stars / nebula / video / focusEffect / logoFlash / flarePulse / flowLight の **gradient・opacity・delay・font-size・text-shadow・animation 名・duration**
- video URL
- メッセージ文言 3 行
- mobile `@media (max-width: 768px)` ルール

---

## 2. 変更理由

| 変更 | 理由 |
|------|------|
| インライン → 外部 CSS | 既存ページ構成との統合（値は転記のみ） |
| `*` / `body` / `html` → `.iwasho-home-page` scope | 許可ルール: global reset の局所化 |
| `overflow: hidden` 未転記 | 許可ルール: ページ全体スクロール不能を防止 |
| JS 削除 | Wix 原文は CSS `@keyframes` + `animation-delay` のみ。6B JS は delay を上書きするため除去 |
| 建設画像・img ロゴ削除 | 6B 近似実装の撤去 → ユーザー原文（テキスト `.ultimate-logo`）へ |

---

## 3. タイムライン（原文）

| 時刻 | 演出 |
|------|------|
| **1s** | `.m-1` focusEffect 開始 |
| **5s** | `.m-2` focusEffect 開始 |
| **9s** | `.m-3` focusEffect 開始 |
| **14s** | `.logo-stage` logoFlash + `.video-background` videoFadeIn |

---

## 4. 検証結果

**URL:** http://127.0.0.1:8788/iwasho/

```powershell
npm run dev
node scripts/capture-iwasho-hero-6e.mjs
```

| Viewport | overflow-x | scroll | body overflow | hero img | m1 delay | video delay | logo delay | console |
|----------|------------|--------|---------------|----------|----------|-------------|------------|---------|
| **390** | 0 | OK | visible | **0** | 1s | 14s | 14s | **0** |
| **768** | 0 | OK | visible | **0** | 1s | 14s | 14s | **0** |
| **1280** | 0 | OK | visible | **0** | 1s | 14s | 14s | **0** |

- ADVANTAGE / footer 到達: ✅
- 横スクロール: なし

### スクショ

`reports/screenshots/hp-migration-6e-hero-direct-port/`

- `hero-{390,768,1280}-t{00,05,10,15}s.png`
- `hero-*-advantage-scroll.png`
- `audit.json`

---

## 5. 変更ファイル

| File | Action |
|------|--------|
| `iwasho/index.html` | Hero HTML 原文移植 · script タグ削除 |
| `corp-biz-home.css` | 6B hero CSS 削除 → 6E 原文転記（scope のみ） |
| `iwasho/iwasho-home.js` | CSS-only 注記（未使用） |
| `source/wix/iwasho-hero.embed.html` | 参照用 |
| `scripts/capture-iwasho-hero-6e.mjs` | 検証 |

---

## 6. 削除した 6B 近似要素

- 建設現場風 overlay / 低 opacity 常時動画
- `<img>` ロゴ + `.ultimate-logo__label`
- JS `is-visible` / `animation-delay` 上書き
- `padding-top: var(--ih-header-h)` on hero（原文に無い）
- radial-gradient 手描き stars（原文は stardust.png texture）
