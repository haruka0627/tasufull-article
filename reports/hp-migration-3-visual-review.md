# HP-MIGRATION-3 — Visual Review Report

**Date:** 2026-06-18  
**Phase:** HP-MIGRATION-3（企業 HP 目視レビュー準備）  
**Verdict:** **READY_FOR_CODE_SELECTION**

---

## Summary

移植済み IWASHO / TASFUL 企業 HP（計 15 ページ）を 390 / 768 / 1280px で自動キャプチャ・監査し、目視レビュー可能な状態に整えました。Wix 完全移植は未実施（選別前レビュー段階）。

| Brand | Pages | Screenshots | Auto audit |
|-------|-------|-------------|------------|
| IWASHO | 6 | 18 + nav-open×1 | PASS |
| TASFUL `/company/` | 9 | 27 + nav-open×1 | PASS |

---

## Verification

```text
node scripts/capture-corp-hp-visual-review.mjs   # 47 PNG + audit.json
npm run build:pages                              # OK
npm run verify:pages-stage                       # PASS
```

Local base: `http://127.0.0.1:8788`（`npx serve deploy/cloudflare/dist -p 8788`）

Screenshots: `reports/screenshots/hp-migration-3-visual-review/`  
Audit data: `reports/screenshots/hp-migration-3-visual-review/audit.json`

---

## Checklist Results (15 pages × 3 widths)

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | ヘッダー崩れ | **FIXED** | 1280px で TASFUL 6 項目 nav が viewport 外に溢れていた → `display:contents` 等で修正 |
| 2 | フッター崩れ | OK | 390px リンク縦積み CSS 追加 |
| 3 | 余白 | OK | `--corp-gutter` / section padding 一貫 |
| 4 | 文字詰まり | OK | 390px badge letter-spacing 調整済 |
| 5 | 画像比率 | OK | ロゴ 40×40 `object-fit:contain`、broken img 0 |
| 6 | CTA位置 | OK | 390px CTA 全幅スタック |
| 7 | リンク切れ | OK | 内部リンク全 200、`#partner` / `#contact-form` 追加 |
| 8 | Wix 不要コード | **NOTE** | 実行コードなし。本文中の「Wix」文言（移行メモ）は残存 |
| 9 | スマホ可読性 | OK | overflow-x 0 / 全 viewport |
| 10 | 企業 HP 違和感 | **NOTE** | 絵文字 pillar・プ AI 文案は Wix 選別前の暫定 |

---

## CSS Fixes Applied (HP-MIGRATION-3)

### `corp-header.css`
- **BLOCKER fix:** `details.corp-nav` が desktop で幅 0 → nav が viewport 外に描画
  - `@media (min-width:900px) { .corp-nav { display: contents; } }`
  - `.corp-nav__list` に `width:auto`, `flex-wrap:nowrap`, `> li { flex:0 0 auto }`
- 900–1280px 向け nav フォント縮小

### `corp-layout.css`
- `.corp-container--wide` セレクタ修正（HP-MIGRATION-2 バグ）
- 390px CTA 全幅 / badge letter-spacing / prose h1 / scroll-margin
- インライン style 代替クラス（`corp-contact-cta-wrap` 等）

### `corp-footer.css`
- 390px フッターナビ・法務リンク縦積み

### `scripts/migrate-corp-hp-content.mjs`（既存ページ再生成）
- `#partner` アンカー追加
- インライン `style=` 除去

---

## Page Review Notes

### IWASHO
| Page | 390 | 768 | 1280 | Notes |
|------|-----|-----|------|-------|
| `/iwasho/` | OK | OK | OK | Hero + 強み + CTA |
| `about.html` | OK | OK | OK | 会社概要 dl |
| `services.html` | OK | OK | OK | 6 カード grid |
| `partners.html` | OK | OK | OK | 3 カード + CTA |
| `contact.html` | OK | OK | OK | 外部フォーム仮 CTA |
| `privacy.html` | OK | OK | OK | prose 簡易版 |

### TASFUL company
| Page | 390 | 768 | 1280 | Notes |
|------|-----|-----|------|-------|
| `/company/` | OK | OK | OK | 全セクション（長ページ） |
| `about.html` | OK | OK | OK | 〇〇表記 placeholder |
| `services.html` | OK | OK | OK | Platform + AI |
| `vision.html` | OK | OK | OK | Hero + 3 軸 |
| `faq.html` | OK | OK | OK | details 開閉 |
| `contact.html` | OK | OK | OK | partner ブロック追加 |
| `legal/terms.html` | OK | OK | OK | MD 全文 · meta に source パス |
| `legal/privacy.html` | OK | OK | OK | 骨子 + 〇〇 |
| `legal/tokushoho.html` | OK | OK | OK | 骨子 + 〇〇 |

---

## Wix Code Selection — Candidates (next phase)

| Source | Keep / Drop | Rationale |
|--------|-------------|-----------|
| `source/wix/tasful-company-home.embed.html` inline `<style>` | **Drop** | 既に `corp-biz-*` へ移行済 |
| Wix hero gradient / badge copy | **Keep (text)** | 現行 hero に反映済 |
| `/contact`, `/partner` Wix paths | **Drop** | brand 別 contact + `#partner` に置換 |
| 外部フォーム embed JS | **Defer** | URL 確定後に iframe or リンク |
| docx 法務全文 | **Keep (content)** | privacy / tokushoho 転記待ち |
| 絵文字 pillar icons | **Replace?** | 企業 HP として SVG/画像に差替検討 |

---

## Remaining for Human Visual Review

1. **ブランドトーン** — TASFUL gold vs IWASHO teal の使い分け（意図通りか）
2. **長文 legal** — terms 390px での折返し・目次要否
3. **CTA 文言** — 「URL 設定待ち」は本番前に差替
4. **Wix 移行メモ** — `corp-legal-meta` の source 表記を本番前に削除
5. **ビジュアル資産** — hero 背景画像・pillar イラスト（Wix 側にあれば選別）

---

## Out of Scope（未変更）

- TASFUL プラットフォーム本体
- Auth / Supabase / Stripe / Builder / Market / Connect
- 新規ページ追加
- Wix embed 完全移植

---

## Verdict Rationale

**READY_FOR_CODE_SELECTION** — 全優先ページが 3 幅で overflow なし・リンク正常・スクリーンショット揃い。desktop nav 崩れは修正済み。Wix コード選別と人間目視の次フェーズに進める状態。
