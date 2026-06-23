# IWASHO ヘッダー・フッター復元 — git commit スコープ

作成日: 2026-06-23  
目的: `restore iwasho header footer` のみをステージするためのファイル選定（**commit は未実施**）

---

## 概要

| 区分 | 件数 |
|------|------|
| コミット対象（ステージ推奨） | **24** |
| 意図的に除外 | 多数（下記参照） |

復元内容:
- TASFUL 共通 `custom-header` / `modern-footer`（または旧 `corp-header` / `corp-footer`）を、完成版 **`.iw-site-header`** + **`.footer-wrapper`** に差し替え
- 復元スクリプト群と検証スクリプトを追加
- スタイルは `corp-biz-home.css`、モバイルメニューは `iwasho/iwasho-home.js`

---

## 1. コミット対象ファイル一覧（24 件）

### A. 復元スクリプト・参照ソース（6 件・新規 untracked）

| ファイル | 役割 |
|----------|------|
| `scripts/lib/iwasho-site-shell.mjs` | ヘッダー/フッター HTML 生成モジュール |
| `scripts/restore-iwasho-site-shell.mjs` | 全 IWASHO HTML への一括復元 |
| `scripts/fix-iwasho-shell-layout.mjs` | フッター位置・script タグの後処理 |
| `scripts/verify-iwasho-chrome-viewports.mjs` | 390/768/1280 表示確認 |
| `source/wix/iwasho-footer.embed.html` | フッター復元元（Wix embed） |
| `source/wix/iwasho-header.embed.html` | ヘッダー復元元（Wix embed） |

### B. スタイル（2 件・modified）

| ファイル | 状態 | 備考 |
|----------|------|------|
| `corp-biz-home.css` | M | `.iw-site-header` / `.footer-wrapper` を含む。**ページ本体スタイルも同ファイルに混在** |
| `deploy/cloudflare/dist/corp-biz-home.css` | M | dist 同期 |

### C. モバイルメニュー JS（2 件・modified）

| ファイル | 状態 | 備考 |
|----------|------|------|
| `iwasho/iwasho-home.js` | M | `[data-iw-menu-toggle]` 用（旧 hero timeline から差し替え） |
| `deploy/cloudflare/dist/iwasho/iwasho-home.js` | M | dist 同期 |

### D. IWASHO HTML ページ（14 件・modified）

`restore-iwasho-site-shell.mjs` が処理した **既存 7 ページ × source/dist**:

| source | dist |
|--------|------|
| `iwasho/index.html` | `deploy/cloudflare/dist/iwasho/index.html` |
| `iwasho/about.html` | `deploy/cloudflare/dist/iwasho/about.html` |
| `iwasho/contact.html` | `deploy/cloudflare/dist/iwasho/contact.html` |
| `iwasho/partners.html` | `deploy/cloudflare/dist/iwasho/partners.html` |
| `iwasho/privacy.html` | `deploy/cloudflare/dist/iwasho/privacy.html` |
| `iwasho/services.html` | `deploy/cloudflare/dist/iwasho/services.html` |
| `iwasho/team.html` | `deploy/cloudflare/dist/iwasho/team.html` |

---

## 2. 注意: 混在ファイル（ファイル単位では分離不可）

以下は **ヘッダー/フッター復元が含まれる** が、**HP 移行（ページ本体・画像・レイアウト）の変更も同じ diff に混在** しています。

| ファイル | diff 規模（source） | 混在内容の例 |
|----------|---------------------|--------------|
| `iwasho/index.html` | +333 / -131 | ヒーロー・セクション全体 |
| `iwasho/about.html` | +355 / -61 | 事業内容セクション |
| `iwasho/contact.html` | +211 / -62 | フォーム周辺 |
| `iwasho/partners.html` | +803 / -60 | パートナーページ本体 |
| `iwasho/services.html` | +384 / -55 | 対応業務セクション |
| `iwasho/team.html` | +251 / -52 | チームカード等 |
| `iwasho/privacy.html` | +91 / -41 | **比較的シェル中心**（CSS link 変更含む） |
| `corp-biz-home.css` | +1739 行規模 | ヘッダー/フッター + 全ページ用 IWASHO スタイル |

**厳密にシェル差分だけ** をコミットしたい場合は `git add -p` による hunk 分割が必要です。  
本レポートの `git add` コマンドは **ファイル単位** で「IWASHO 復元関連のみ」をステージする想定です。

---

## 3. 意図的に除外したもの

### 3a. 旧・中間実装（復元後は未使用）

| ファイル | 理由 |
|----------|------|
| `iwasho-site-chrome.css` | 簡易版 chrome（白/navy）。完成版復元で置換済み |
| `iwasho-site-chrome.js` | 同上 |
| `scripts/apply-iwasho-site-chrome.mjs` | 同上 |
| `deploy/cloudflare/dist/iwasho-site-chrome.css` | dist 側の中間成果物 |
| `deploy/cloudflare/dist/iwasho-site-chrome.js` | 同上 |

### 3b. ページ本体・画像（ヘッダー/フッター以外）

| ファイル | 理由 |
|----------|------|
| `iwasho/company.html` | 新規ページ全体（HEAD 未追跡）。ナビリンク先だが shell 復元単体の対象外 |
| `deploy/cloudflare/dist/iwasho/company.html` | 同上 |
| `iwasho/images/**` | ページ用画像アセット |
| `deploy/cloudflare/dist/iwasho/images/**` | 同上 |
| `tas-top-page.css` | ページレイアウト用（シェル CSS ではない） |
| `corp-company-hp.css` | 同上 |
| `deploy/cloudflare/dist/tas-top-page.css` | 同上 |
| `deploy/cloudflare/dist/corp-company-hp.css` | 同上 |
| `source/wix/iwasho-hero.embed.html` | ヒーロー用（ヘッダー/フッター外） |

### 3c. キャプチャ・監査スクリプト（復元ツールチェーン外）

例: `scripts/capture-iwasho-*.mjs`, `scripts/audit-iwasho-*.mjs`, `scripts/measure-iwasho-*.mjs`, `scripts/probe-iwasho-*.mjs`, `scripts/verify-iwasho-hero-text-shift.mjs` など **50+ 件**

### 3d. 他ドメイン（ユーザー指定除外）

| カテゴリ | 例 |
|----------|-----|
| MATCH | `match-*.js`, `supabase/functions/match-*`, `scripts/smoke-match-*`, `scripts/verify-match-*` |
| LIVE | `live-*.js`, `supabase/functions/live-*`, `scripts/verify-live-*` |
| Builder | `builder/**`, `scripts/test-builder-*`, `scripts/verify-builder-*` |
| Legal | `company/legal/privacy.html`, `terms.html`, `tokushoho.html` + dist |
| Supabase / Auth hook | `supabase/**`, `sql/auth-hook-*` |
| TASFUL 本体 | `company/**`, `dashboard*`, `chat-*`, `tas-hp-header-menu.js` 等 |
| レポート | `reports/iwasho-*.md`, `reports/hp-migration-*` 等 |

---

## 4. git add コマンド（PowerShell / bash 共通）

**commit は実行しない。** ステージのみ。

```bash
git add \
  scripts/lib/iwasho-site-shell.mjs \
  scripts/restore-iwasho-site-shell.mjs \
  scripts/fix-iwasho-shell-layout.mjs \
  scripts/verify-iwasho-chrome-viewports.mjs \
  source/wix/iwasho-footer.embed.html \
  source/wix/iwasho-header.embed.html \
  corp-biz-home.css \
  deploy/cloudflare/dist/corp-biz-home.css \
  iwasho/iwasho-home.js \
  deploy/cloudflare/dist/iwasho/iwasho-home.js \
  iwasho/index.html \
  iwasho/about.html \
  iwasho/contact.html \
  iwasho/partners.html \
  iwasho/privacy.html \
  iwasho/services.html \
  iwasho/team.html \
  deploy/cloudflare/dist/iwasho/index.html \
  deploy/cloudflare/dist/iwasho/about.html \
  deploy/cloudflare/dist/iwasho/contact.html \
  deploy/cloudflare/dist/iwasho/partners.html \
  deploy/cloudflare/dist/iwasho/privacy.html \
  deploy/cloudflare/dist/iwasho/services.html \
  deploy/cloudflare/dist/iwasho/team.html
```

### ステージ後の確認コマンド

```bash
git diff --cached --stat
git status --short
```

期待: 上記 **24 ファイル** のみが staged（`reports/git-commit-scope-iwasho.md` 自身は未ステージのまま）

---

## 5. 推奨コミットメッセージ案（参考・未実行）

```
Restore IWASHO completed site header and footer shell

Replace TASFUL shared chrome with .iw-site-header and .footer-wrapper
on all IWASHO pages, with restore scripts and viewport verification.
```

---

## 6. 作業ツリー全体の規模（参考）

- `git status --short` 全体: **数百ファイル**（modified + untracked）
- 本スコープ: **24 ファイル**（約 1% 未満）
- リポジトリ全体の変更には MATCH / LIVE / Builder / Legal / Supabase / TASFUL 本体改修が大量に含まれる
