# HP-MIGRATION-6D — Wix Embed Direct Port

**Date:** 2026-06-18  
**Target:** `/iwasho/` ヘッダー + ヒーロー  
**Verdict:** **HEADER PASS** / **HERO PENDING（embed 未提出）**

---

## Summary

方針変更に従い、**ユーザー提示の Wix header embed を原文のまま** `iwasho/index.html` + `corp-biz-home.css` へ移植しました。

**ヒーロー:** 本タスクのメッセージに **hero embed 原文が含まれていなかった** ため、6D では **未変更**（6B 実装のまま）。hero 原文の提出後に同手順で直接移植します。

---

## 1. 原文から変更した箇所一覧

| # | 原文 | 変更後 | 種別 |
|---|------|--------|------|
| 1 | `<style>` インライン | `corp-biz-home.css` 外部ファイル | ファイル分離 |
| 2 | `body { margin:0; padding:0; font-family:… }` | `.iwasho-home-page { margin:0; padding:0; font-family:… }` | scope |
| 3 | `.custom-header { … }` | `.iwasho-home-page .custom-header { … }` | scope |
| 4 | `.header-inner { … }` | `.iwasho-home-page .header-inner { … }` | scope |
| 5 | `.logo { … }` | `.iwasho-home-page .logo { … }` | scope |
| 6 | `.logo span { … }` | `.iwasho-home-page .logo span { … }` | scope |
| 7 | `.header-nav …` 各ルール | `.iwasho-home-page .header-nav …` | scope |
| 8 | `@media (max-width: 1000px) { .custom-header … }` | 同上 + `.iwasho-home-page` 接頭 | scope |
| 9 | `body` / `html` の `overflow:hidden` | **未追加** | 禁止遵守 |
| 10 | ヒーロー HTML/CSS/JS | **変更なし** | embed 未提出 |

### 変更していないもの（header）

- HTML タグ構造（`custom-header` / `header-inner` / `logo` / `header-nav`）
- 全 CSS 値（height / rgba / blur / gradient stops / animation / font-size / text-shadow / gap / padding）
- `@keyframes shine-rainbow` 定義
- ナビ href ・ active クラス
- モバイル breakpoint `1000px`

---

## 2. 変更理由

| 変更 | 理由 |
|------|------|
| インライン `<style>` → 外部 CSS | 既存ページ構成（`corp-biz-home.css` リンク）との統合。値は転記のみ |
| `body` → `.iwasho-home-page` | 許可ルール: global reset をページスコープへ限定。`overflow:hidden` は body に入れない |
| 各セレクタへ `.iwasho-home-page` 接頭 | 許可ルール: 他ページ（corp-layout / builder 等）との class 衝突防止 |
| 6A/6B で追加した header `::before` 帯スイープ | **削除** — ユーザー提示原文に存在しないため |
| 6A のロゴのみ構成 | **nav 復元** — ユーザー提示 HTML 原文どおり |
| ヒーロー未変更 | 6D メッセージに hero embed 原文なし。推測移植禁止 |

---

## 3. 検証結果

**URL:** http://127.0.0.1:8788/iwasho/

```powershell
npm run dev
node scripts/capture-iwasho-wix-direct-port-6d.mjs
```

| Viewport | header h | logo size | animation | nav | overflow-x | body overflow | console |
|----------|----------|-----------|-----------|-----|------------|---------------|---------|
| **390** | 90px | 24px | shine-rainbow | 5 links | 0 | visible | **0** |
| **768** | 90px | 24px | shine-rainbow | 5 links | 0 | visible | **0** |
| **1280** | 140px | 30px | shine-rainbow | 5 links | 0 | visible | **0** |

### スクショ

`reports/screenshots/hp-migration-6d-wix-direct-port/`

- `header-390.png`
- `header-768.png`
- `header-1280.png`
- `audit.json`

---

## 4. 変更ファイル

| File | Action |
|------|--------|
| `iwasho/index.html` | header HTML を提示原文どおり（nav 含む） |
| `corp-biz-home.css` | header CSS を提示原文転記 + scope のみ |
| `source/wix/iwasho-header.embed.html` | 参照用原文保存 |
| `scripts/capture-iwasho-wix-direct-port-6d.mjs` | 6D 検証 |

---

## 5. ヒーロー — 次アクション

ヒーローも **同ルール（原文そのまま + scope のみ）** で移植するには、Wix hero embed（HTML + `<style>` + JS があれば）の提出が必要です。

提出後:

1. `iwasho/index.html` の `.top-hero` ブロックを原文置換
2. `corp-biz-home.css` に hero CSS を原文転記（`.iwasho-home-page` scope）
3. `iwasho-home.js` は原文 JS があればそのまま、なければ原文内 `<script>` 転記
4. タイムラインスクショ（0 / 5 / 10 / 15s）で再検証

**現状の hero は 6B 近似実装のまま — 6D 対象外。**
