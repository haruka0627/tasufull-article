# HP-MIGRATION-6A — IWASHO TOP Header Fix

**Date:** 2026-06-18  
**Target:** `/iwasho/index.html`  
**Verdict:** **PASS**

---

## Summary

Wix embed の `custom-header` 構成に合わせ、TOP ヘッダーを **ロゴのみ・左寄せ・near-black 固定帯** に再実装しました。HP-MIGRATION-5 で入れていた横並びナビ + ロゴ画像は **この段階では除去** しています（Wix 原本の見た目優先）。

---

## 変更ファイル

| File | Change |
|------|--------|
| `iwasho/index.html` | `custom-header` / `header-inner` / `.logo` 構造へ置換（ナビ削除） |
| `corp-biz-home.css` | `.iwasho-home-page .custom-header` スコープ CSS に差し替え |
| `scripts/capture-iwasho-home-top.mjs` | 監査セレクタ `.custom-header` に更新 |

**未変更:** `iwasho/iwasho-home.js`（hero 演出のみ・header 非依存）

---

## HTML 構成（実装後）

```html
<header class="custom-header">
  <div class="header-inner">
    <div class="logo">
      IWASHO <span>×</span> TASFUL
    </div>
  </div>
</header>
```

---

## CSS 要点（Wix custom-header 準拠）

| 項目 | 値 |
|------|-----|
| height | SP **90px** / PC **140px**（`--ih-header-h`, `@media min-width:900px`） |
| background | `rgba(10, 10, 10, 0.96)` |
| backdrop-filter | `blur(20px)` |
| position | `fixed` |
| z-index | **9999** |
| header-inner max-width | **1250px** |
| header-inner padding | **0 40px** |
| logo 配置 | 左寄せ（`justify-content: flex-start`） |
| logo font-size | SP **24px** / PC **30px** |
| × | 白・**opacity 0.6**・**18px** |
| rainbow shine | ヘッダー帯 `::before` スイープ + ロゴ `background-clip` グラデーション |

**スコープ:** すべて `.iwasho-home-page .custom-header …` 配下（汎用 `.logo` 衝突回避）

**意図的に入れていないもの:** active nav / ハンバーガー / ロゴ画像 / body・html グローバル reset

---

## hero との関係

- `--ih-header-h`（90 / 140）を hero の `padding-top: calc(var(--ih-header-h) + 2rem)` に継続利用
- fixed header 下で hero 本文が隠れないことを確認

---

## 検証結果

```text
npm run build:pages
npx serve deploy/cloudflare/dist -p 8788
node scripts/capture-iwasho-home-top.mjs
```

### 計測（ページロード時）

| Viewport | header height | logo font | × font / opacity | logo left | overflow-x | console |
|----------|---------------|-----------|------------------|-----------|------------|---------|
| **390** | 90px | 24px | 18px / 0.6 | 40px | false | 0 |
| **1280** | 140px | 30px | 18px / 0.6 | 55px* | false | 0 |

\* 1280px 時: `max-width:1250px` センタリング + `padding-left:40px` → 左端 55px

### capture-iwasho-home-top.mjs

| Viewport | headerFixed | headerHeight | overflowX | consoleErrors |
|----------|-------------|--------------|-----------|---------------|
| 390 | true | 90 | false | 0 |
| 768 | true | 90 | false | 0 |
| 1280 | true | 140 | false | 0 |

**pass: true / issues: []**

### スクリーンショット

- `reports/screenshots/hp-migration-6a-iwasho-top/header-390.png`
- `reports/screenshots/hp-migration-6a-iwasho-top/header-1280.png`
- `reports/screenshots/hp-migration-5-iwasho-top/iwasho-top-*-hero.png`（再キャプチャ済）

---

## Before → After

| 項目 | Before (HP-5) | After (HP-6A) |
|------|---------------|---------------|
| 構造 | ロゴ画像 + テキスト + ナビ横並び | **ロゴテキストのみ左寄せ** |
| クラス | `.iwasho-home-header` | **`.custom-header`**（Wix 同名） |
| 背景 | `#0a0a0f` 不透明 + border/shadow | **`rgba(10,10,10,0.96)` + blur** |
| z-index | 300 | **9999** |
| max-width | 72rem | **1250px** |
| padding | clamp gutter | **0 40px** |

---

## 次フェーズ（未着手）

- Wix 原本どおりの **別レイヤー nav**（ヘッダー外）の復帰
- ロゴクリック → TOP リンク
- 1280px 時ロゴ位置の Wix ピクセルパーフェクト微調整
