# HP-MIGRATION-2 — Content Migration Report

**Date:** 2026-06-18  
**Phase:** HP-MIGRATION-2（Wix 埋め込み → Cloudflare Pages 企業 HP）  
**Verdict:** **NEEDS_ASSETS**

---

## Summary

Wix から回収した企業 HP 埋め込み（`source/wix/tasful-company-home.embed.html`）を IWASHO / TASFUL 企業 HP へ分割移植しました。プラットフォーム本体（Auth / Supabase / Stripe / Builder / Market / Connect）には未着手です。

| Brand | Priority pages | Status |
|-------|----------------|--------|
| IWASHO | 6 + team（非表示） | 本文移植済 |
| TASFUL `/company/` | 9 | 本文移植済（法務は要追記） |

---

## Source Recovery

| Asset | Location |
|-------|----------|
| 統合 biz ページ HTML | `source/wix/tasful-company-home.embed.html` |
| 利用規約 MD | `source/wix/tasful-terms.md` |
| TASFUL 画像 | `source/wix/tasful-images/1.png`, `2.png` |
| IWASHO ロゴ | `Downloads/IWASHO ロゴ.jpg` → `images/corp/iwasho/logo.jpg` |

Wix 依存（インライン `<style>`、`100vw` hero ハック、Wix JS、`/contact` `/partner` 直リンク）は除去し、`corp-layout.css` の `.corp-biz-*` クラスへ集約しました。

---

## Generated / Updated Files

### Scripts
- `scripts/lib/corp-shell.mjs` — 共通 header/footer/page レンダラ（`visible: false` で nav 非表示）
- `scripts/migrate-corp-hp-content.mjs` — 本文生成（`node scripts/migrate-corp-hp-content.mjs`）

### CSS（HP-MIGRATION-1 + 2）
- `corp-layout.css` — `.corp-biz-*`（hero / pillars / cards / CTA / external CTA）
- `corp-header.css`, `corp-footer.css` — 変更なし

### Pages

**IWASHO** (`data-corp="iwasho"`, base `/iwasho/`)

| Page | robots | Nav |
|------|--------|-----|
| `index.html` | index | 表示 |
| `about.html` | index | 表示 |
| `services.html` | index | 表示 |
| `partners.html` | index | 表示 |
| `contact.html` | index | 表示（外部フォーム仮 CTA） |
| `privacy.html` | index | フッター法務 |
| `team.html` | **noindex** | **非表示**（ファイルは残存） |

**TASFUL company** (`data-corp="tasful"`, base `/company/`)

| Page | robots | Notes |
|------|--------|-------|
| `index.html` | index | Wix 全文相当（3 軸 + IWASHO / Platform / AI） |
| `services.html` | index | Platform + AI |
| `vision.html` | index | Hero + 3 軸 |
| `about.html` | index | 会社概要（〇〇表記） |
| `faq.html` | index | Wix 由来 FAQ 4 件 |
| `contact.html` | index | 外部フォーム仮 CTA |
| `legal/terms.html` | index | `tasful-terms.md` 全文 |
| `legal/privacy.html` | index | docx 要約 + 〇〇表記 |
| `legal/tokushoho.html` | index | 骨子のみ + 〇〇表記 |

### Images
- `images/corp/tasful/1.png`, `2.png` — ヘッダーロゴ（1.png 使用）
- `images/corp/iwasho/logo.jpg` — ヘッダーロゴ

---

## Content Mapping (Wix → Pages)

| Wix section | Destination |
|-------------|-------------|
| Hero（IWASHO × TASFUL） | `/company/index.html` 全文 / `/iwasho/index.html` は IWASHO 向け hero |
| 事業の全体像（3 pillars） | `/company/index.html`, `/company/vision.html` |
| 建設事業（IWASHO） | `/iwasho/*`, `/company/index.html` |
| TASFUL Platform | `/company/services.html`, `/company/index.html` |
| タスフルAI | `/company/services.html`, `/company/index.html` |
| CTA（/contact, /partner） | 各 brand の `contact.html` + ページ内 CTA（partner は準備中アンカー） |

---

## Verification

```text
node scripts/migrate-corp-hp-content.mjs   # OK
npm run build:pages                        # OK → deploy/cloudflare/dist
npm run verify:pages-stage                 # PASS (956 files)
npx --yes serve deploy/cloudflare/dist -p 8788
```

Local smoke (HTTP 200):

- http://127.0.0.1:8788/iwasho/
- http://127.0.0.1:8788/iwasho/about.html
- http://127.0.0.1:8788/company/
- http://127.0.0.1:8788/company/legal/terms.html

---

## Remaining Assets / Content Gaps

| Item | Severity | Action |
|------|----------|--------|
| 法人名・所在地・代表者（〇〇表記） | P1 | Wix docx / 特商法表記から正式値を転記 |
| プライバシーポリシー全文 | P1 | `Downloads/TASFUL_*.docx` から privacy / tokushoho を同期 |
| 外部お問い合わせフォーム URL | P1 | Wix フォーム URL を `contact.html` の CTA `href` に設定 |
| IWASHO `team.html` 本文 | P2 | Wix 原文未回収 — 回収後に差し替え |
| `images/corp/tasful/2.png` | P2 | ページ内ビジュアル用途があれば配置 |
| IWASHO 専用 Wix ページ原文 | P2 | 現状は統合 embed から IWASHO ブロックを分割 |

---

## Verdict Rationale

**NEEDS_ASSETS** — 構造・Wix 本文・ビルド検証は完了し、レイアウトの目視確認（visual review）は可能です。ただし法務表記の正式値、プライバシー全文、外部フォーム URL、team ページ原文が未充足のため、本番公開判定は保留です。

次ステップ候補:

1. docx から privacy / tokushoho 全文転記 + 〇〇置換
2. Wix フォーム URL 設定
3. ブラウザ目視（390 / 768 / 1280）→ **READY_FOR_VISUAL_REVIEW** へ昇格
4. 問題なければ HP-MIGRATION-3（ルーティング / apex 切替）へ

---

## Out of Scope（未変更）

- TASFUL プラットフォーム本体 HTML/JS
- Auth / Supabase / Stripe / Builder / Market / Connect
- Cloudflare `_redirects` / apex 本番切替
