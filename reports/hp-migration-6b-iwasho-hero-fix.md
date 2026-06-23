# HP-MIGRATION-6B — IWASHO TOP Hero Fix

**Date:** 2026-06-18  
**Target:** `/iwasho/` TOP ヒーロー  
**Verdict:** **PASS**

---

## Summary

Wix embed 相当のクラス構造（`.top-hero` / `.video-background` / `.hero-msg` / `.ultimate-logo` 等）に差し替え、**14 秒タイムライン**（メッセージ 3 段 → 動画フェードイン + ロゴ表示）を再実装しました。

旧 `.iwasho-home-hero__*`（半透明動画オーバーレイ・建設画像風の見え方）は **削除** しています。

---

## 変更ファイル

| File | Change |
|------|--------|
| `iwasho/index.html` | Wix 構造 `.top-hero` へ置換 |
| `corp-biz-home.css` | hero CSS を `.iwasho-home-page .top-hero` 配下に再定義 |
| `iwasho/iwasho-home.js` | 3.5s 間隔メッセージ + 14s 動画/ロゴ演出 |
| `scripts/capture-iwasho-hero-6b.mjs` | **新規** — タイムライン検証 |
| `scripts/capture-iwasho-home-top.mjs` | セレクタ `.top-hero` に更新 |

---

## HTML 構造（実装後）

```html
<section class="top-hero">
  <div class="video-background"><video autoplay muted loop playsinline>…</video></div>
  <div class="stars"></div>
  <div class="nebula"></div>
  <div class="viewport">
    <div class="text-stage">
      <p class="hero-msg m-1">建設と美装を、</p>
      <p class="hero-msg m-2">光の速さで統合する。</p>
      <p class="hero-msg m-3">未来の現場を、今ここに。</p>
    </div>
    <div class="logo-stage" hidden>
      <div class="flare"></div>
      <div class="ultimate-logo">…</div>
    </div>
  </div>
</section>
```

---

## タイムライン

| 時刻 | 動作 |
|------|------|
| **0s** | 星 + nebula 背景。`m-1` 表示開始 |
| **3.5s** | `m-2` 表示 |
| **7s** | `m-3` 表示 |
| **14s** | メッセージ非表示 · `.video-background.is-visible`（2.4s fade） · `.logo-stage.is-visible` + flare |

動画 URL:  
`https://video.wixstatic.com/video/a911fb_9099502c3b6a4338b9061afa0360a027/720p/mp4/file.mp4`

---

## 削除した要素

- 旧 `.iwasho-home-hero__overlay`（建設画像風の暗幕）
- 動画常時 `opacity: 0.45` 表示
- 旧 `.iwasho-home-hero__line` / `__logo-reveal` 構造
- ヒーロー内の薄い中央テキストのみロゴ（14s 前はメッセージのみ）

---

## スコープ / 禁止事項遵守

| 項目 | 状態 |
|------|------|
| CSS スコープ | `.iwasho-home-page` 配下のみ |
| hero 内 `overflow: hidden` | ✅ `.top-hero` のみ |
| `body` / `html` `overflow: hidden` | ❌ 未使用（`visible`） |
| グローバル `*` reset | ❌ 未追加 |
| header fixed 干渉 | ✅ `padding-top: var(--ih-header-h)` |
| ADVANTAGE へスクロール | ✅ 可能 |

---

## 検証

**URL:** http://127.0.0.1:8788/iwasho/  
**コマンド:**

```powershell
npm run dev
node scripts/capture-iwasho-hero-6b.mjs
```

| Viewport | overflow-x | scroll | header | hero overflow | console | t15s video+logo |
|----------|------------|--------|--------|---------------|---------|-----------------|
| **390** | 0 | OK (3781px) | fixed 90px | hidden | **0** | ✅ |
| **768** | 0 | OK (2729px) | fixed 90px | hidden | **0** | ✅ |
| **1280** | 0 | OK (2458px) | fixed 140px | hidden | **0** | ✅ |

タイムラインスクショ: `reports/screenshots/hp-migration-6b-iwasho-hero/`

- `hero-{390,768,1280}-t{00,05,10,15}s.png`
- `hero-*-footer-scroll.png`
- `audit.json`

---

## 保守メモ

- TOP 変更は `iwasho/index.html` + `corp-biz-home.css` + `iwasho/iwasho-home.js` を直接編集
- `npm run build:pages` 後に dist へ反映
- 14s 演出の目視確認: ブラウザで `/iwasho/` を開き 15 秒待機
