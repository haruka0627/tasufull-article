# IWASHO スマホ最適化 監査レポート

生成日時: 2026-06-20T13:50:18.520Z

## 実施内容（共通）

- `corp-biz-mobile.css` を全7ページに追加（768px以下のみ適用）
- `body { overflow-x: hidden }`（IWASHOページ）
- 横パディング 20px、セクション上下 64px を基準に統一
- ボタン高さ 52px+、幅100%（max 320px 中央）
- 会社概要・パートナー・お問い合わせヒーローをテキスト上・画像下に統一
- フォーム入力100%、横スクロール禁止

## ページ別結果

### ホーム (`/iwasho/`)

#### 修正内容
- 共通モバイルCSS適用

#### 監査結果

| 幅 | 横スクロール | 画像欠損 | ヒーロー左右分割 | mobile.css |
|----|-------------|---------|-----------------|------------|
| 390px | OK | OK | OK | OK |
| 430px | OK | OK | OK | OK |
| 768px | OK | OK | OK | OK |

#### スクショ
- 390px: `reports/screenshots/iwasho-mobile-audit/home-390.png`
- 430px: `reports/screenshots/iwasho-mobile-audit/home-430.png`
- 768px: `reports/screenshots/iwasho-mobile-audit/home-768.png`

#### 残課題 / 要確認
- 390px: 小さいボタン 1件
- 430px: 小さいボタン 1件
- 768px: 小さいボタン 1件

### 事業内容 (`/iwasho/about.html`)

#### 修正内容
- 共通モバイルCSS適用

#### 監査結果

| 幅 | 横スクロール | 画像欠損 | ヒーロー左右分割 | mobile.css |
|----|-------------|---------|-----------------|------------|
| 390px | OK | OK | OK | OK |
| 430px | OK | OK | OK | OK |
| 768px | OK | OK | OK | OK |

#### スクショ
- 390px: `reports/screenshots/iwasho-mobile-audit/about-390.png`
- 430px: `reports/screenshots/iwasho-mobile-audit/about-430.png`
- 768px: `reports/screenshots/iwasho-mobile-audit/about-768.png`

#### 残課題 / 要確認
- 特になし（自動監査範囲内）

### 対応業務 (`/iwasho/services.html`)

#### 修正内容
- 共通モバイルCSS適用

#### 監査結果

| 幅 | 横スクロール | 画像欠損 | ヒーロー左右分割 | mobile.css |
|----|-------------|---------|-----------------|------------|
| 390px | OK | OK | OK | OK |
| 430px | OK | OK | OK | OK |
| 768px | OK | OK | OK | OK |

#### スクショ
- 390px: `reports/screenshots/iwasho-mobile-audit/services-390.png`
- 430px: `reports/screenshots/iwasho-mobile-audit/services-430.png`
- 768px: `reports/screenshots/iwasho-mobile-audit/services-768.png`

#### 残課題 / 要確認
- 特になし（自動監査範囲内）

### パートナー募集 (`/iwasho/partners.html`)

#### 修正内容
- 共通モバイルCSS適用
- ヒーローを縦積み（テキスト上・画像下）に統一

#### 監査結果

| 幅 | 横スクロール | 画像欠損 | ヒーロー左右分割 | mobile.css |
|----|-------------|---------|-----------------|------------|
| 390px | OK | OK | OK | OK |
| 430px | OK | OK | OK | OK |
| 768px | OK | OK | OK | OK |

#### スクショ
- 390px: `reports/screenshots/iwasho-mobile-audit/partners-390.png`
- 430px: `reports/screenshots/iwasho-mobile-audit/partners-430.png`
- 768px: `reports/screenshots/iwasho-mobile-audit/partners-768.png`

#### 残課題 / 要確認
- 特になし（自動監査範囲内）

### チーム紹介 (`/iwasho/team.html`)

#### 修正内容
- 共通モバイルCSS適用

#### 監査結果

| 幅 | 横スクロール | 画像欠損 | ヒーロー左右分割 | mobile.css |
|----|-------------|---------|-----------------|------------|
| 390px | OK | OK | OK | OK |
| 430px | OK | OK | OK | OK |
| 768px | OK | OK | OK | OK |

#### スクショ
- 390px: `reports/screenshots/iwasho-mobile-audit/team-390.png`
- 430px: `reports/screenshots/iwasho-mobile-audit/team-430.png`
- 768px: `reports/screenshots/iwasho-mobile-audit/team-768.png`

#### 残課題 / 要確認
- 特になし（自動監査範囲内）

### 会社概要 (`/iwasho/company.html`)

#### 修正内容
- 共通モバイルCSS適用
- ヒーローを縦積み（テキスト上・画像下）に統一

#### 監査結果

| 幅 | 横スクロール | 画像欠損 | ヒーロー左右分割 | mobile.css |
|----|-------------|---------|-----------------|------------|
| 390px | OK | OK | OK | OK |
| 430px | OK | OK | OK | OK |
| 768px | OK | OK | OK | OK |

#### スクショ
- 390px: `reports/screenshots/iwasho-mobile-audit/company-390.png`
- 430px: `reports/screenshots/iwasho-mobile-audit/company-430.png`
- 768px: `reports/screenshots/iwasho-mobile-audit/company-768.png`

#### 残課題 / 要確認
- 特になし（自動監査範囲内）

### お問い合わせ (`/iwasho/contact.html`)

#### 修正内容
- 共通モバイルCSS適用
- ヒーローを縦積み（テキスト上・画像下）に統一
- フォームラベル縦並び・入力欄100%

#### 監査結果

| 幅 | 横スクロール | 画像欠損 | ヒーロー左右分割 | mobile.css |
|----|-------------|---------|-----------------|------------|
| 390px | OK | OK | OK | OK |
| 430px | OK | OK | OK | OK |
| 768px | OK | OK | OK | OK |

#### スクショ
- 390px: `reports/screenshots/iwasho-mobile-audit/contact-390.png`
- 430px: `reports/screenshots/iwasho-mobile-audit/contact-430.png`
- 768px: `reports/screenshots/iwasho-mobile-audit/contact-768.png`

#### 残課題 / 要確認
- 特になし（自動監査範囲内）

## 手動確認推奨

- ハンバーガーメニューの開閉・リンク遷移
- 各ページCTAボタンのタップ領域
- PC 1280px 表示が大きく変わっていないこと
