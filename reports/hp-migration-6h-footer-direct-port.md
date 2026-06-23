# HP-MIGRATION-6H — Wix FOOTER Direct Port

**Date:** 2026-06-18  
**Target:** `/iwasho/` フッター  
**Verdict:** **PASS**

---

## Summary

ユーザー提供の Wix footer embed（HTML + CSS）を **原文値のまま** `iwasho/index.html` + `corp-biz-home.css` へ移植しました。旧 `.iwasho-home-footer` 近似実装は削除し、`<footer class="modern-footer">` へ置換しています。`href="#"` は指定どおり実ページリンクへ差し替え済みです。

---

## 1. 原文から変更した箇所一覧

| # | 原文 | 変更後 | 種別 |
|---|------|--------|------|
| 1 | `<style>` インライン | `corp-biz-home.css` 外部ファイル | ファイル分離 |
| 2 | `body { margin: 0; padding: 0; }` | **未転記** | scope + 禁止遵守 |
| 3 | `.modern-footer` 他各セレクタ | `.iwasho-home-page .modern-footer …` | scope |
| 4 | `.name` / `.desc` 素セレクタ | `.iwasho-home-page .modern-footer .name` / `.desc` | scope |
| 5 | `.link-col h4` | `.iwasho-home-page .modern-footer .link-col h4` | scope |
| 6 | `<a href="#">` ×8 | 実ページ URL へ差し替え（下表） | 許可されたリンク置換 |
| 7 | 旧 `.iwasho-home-footer` | ユーザー原文 `<footer class="modern-footer">` へ **置換** | 原文復元 |

### href 差し替え（テキストは原文どおり）

**サイトマップ**

| リンク | href |
|--------|------|
| トップ | `/iwasho/` |
| 会社概要 | `/iwasho/about.html` |
| 経営陣紹介 | `/iwasho/team.html` |
| 対応業務 | `/iwasho/services.html` |

**サポート**

| リンク | href |
|--------|------|
| 協力パートナー登録 | `/iwasho/partners.html` |
| お問い合わせ | `/iwasho/contact.html` |
| 利用規約 | `/iwasho/terms.html` |
| プライバシーポリシー | `/iwasho/privacy.html` |

### 変更していないもの（FOOTER CSS 値）

- `.modern-footer` background `#0f0f0f`、padding `50px 5% 40px`
- `.footer-main` flex / gap `40px` / margin-bottom `40px`
- `.footer-logo` font-size `32px`（SP `28px`）、gradient text
- `.name` `18px`、`.desc` `14px` opacity `0.6`
- `.footer-nav` gap `clamp(30px, 8vw, 80px)`
- `.link-col h4` `15px` / border-bottom
- `.link-list a` `14px` / hover transform `translateX(3px)`
- `.footer-bottom` padding-top `25px`
- `.note` `13px`、`.copy` `11px`
- `@media (max-width: 768px)` ルール一式 — **原文どおり**
- ロゴ文言 `IWASHO × TASFUL`、会社情報、note、copyright — **原文どおり**

---

## 2. 変更理由

| 変更 | 理由 |
|------|------|
| インライン → 外部 CSS | 既存ページ構成（6D–6G）との統合 |
| `body { margin/padding }` 未転記 | 許可ルール: global reset の局所化 |
| 全セレクタを `.iwasho-home-page .modern-footer` 配下へ scope | 他ページ・他セクションへの漏れ防止 |
| `href="#"` → 実 URL | ユーザー許可: href 差し替え可 |
| 旧 footer 削除 | ユーザー指示: 近似実装を Wix 原文へ置換 |

---

## 3. 検証結果

**URL:** http://127.0.0.1:8788/iwasho/

```powershell
npm run dev
node scripts/capture-iwasho-footer-6h.mjs
```

| Viewport | layout | overflow-x | links | company | console |
|----------|--------|------------|-------|---------|---------|
| **390** | column（縦積み） | なし | 8 OK | IWASHO合同会社 | **0** |
| **768** | column（縦積み） | なし | 8 OK | IWASHO合同会社 | **0** |
| **1280** | row（左右2カラム） | なし | 8 OK | IWASHO合同会社 | **0** |

- 旧 `.iwasho-home-footer` DOM: **0**
- `.footer-inner` / `.footer-bottom` / `.modern-footer`: ✅
- 1280px: brand 左 + nav 右（twoColumn: true）

### スクショ

`reports/screenshots/hp-migration-6h-footer-direct-port/`

| Viewport | File |
|----------|------|
| 390 | `footer-390.png` |
| 768 | `footer-768.png` |
| 1280 | `footer-1280.png` |

---

## 4. 変更ファイル

| File | Change |
|------|--------|
| `iwasho/index.html` | Wix FOOTER HTML 原文 + リンク差し替え |
| `corp-biz-home.css` | 旧 footer CSS 削除 → 6H 原文 CSS（scope 付き）追加 |
| `scripts/capture-iwasho-footer-6h.mjs` | 390 / 768 / 1280 検証スクリプト（新規） |

---

## 5. ローカル確認手順

1. `npm run dev`（8788）
2. http://127.0.0.1:8788/iwasho/ を開きページ最下部へスクロール
3. PC: ブランド左 + サイトマップ/サポート右、SP: 縦積みを目視確認
4. `node scripts/capture-iwasho-footer-6h.mjs` → `pass: true`

**Note:** dist 反映には `iwasho/index.html` と `corp-biz-home.css` を `deploy/cloudflare/dist/` へ同期するか、`npm run build:pages`（Supabase env 要）を実行してください。
