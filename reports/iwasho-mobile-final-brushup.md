# IWASHO スマホUI 最終調整レポート（Geminiレビュー反映）

生成: 2026-06-20

## 修正ファイル

- `corp-biz-mobile.css`（768px以下のみ・PC版変更なし）

## 修正内容

### 【最優先】1. パートナー登録セクション画像

| 項目 | 対応 |
|------|------|
| 原因 | CSSセレクタ不一致（前回修正済）＋モバイルで background 未強制 |
| 画像URL | `/iwasho/images/partner/card-partner-bg.png` |
| object-fit | `background-size: cover` |
| lazyload | 背景画像のため該当なし |

**390 / 430 / 768px:** 画像読込 OK（監査0件）

### 【最優先】2. 「一般のお客様へ」文字被り

**採用:** タイトル・説明 → 画像 → 機能リスト（白背景カード内）

- カード背景画像を解除
- `.feature-row::before` で説明文直下に画像を挿入
- 文字は白背景上に表示（画像に埋もれない）

### 【最優先】3. CTAボタン間隔

- `.iw-hero__actions` の `gap: 18px`
- 「事業内容を見る」「パートナー登録はこちら」の誤タップ防止

### 【中】4. 施工イメージグリッド

- セクション上下 `32px`
- グリッド `gap: 16px` 統一
- 各画像 `height: 120px` + `cover`

### 【中】5. フッター余白

- フッター全体 `padding: 56px 0 40px`
- カラム間 `gap: 36px`
- SNS・会社名・メニューの上下余白を拡大

### 【中】6. 強みカードアイコン

- `.iw-hero__feature` → `align-items: flex-start`
- アイコン `margin-top: 3px` で1行目テキストに合わせる

## 確認結果

| 項目 | 390px | 430px | 768px |
|------|-------|-------|-------|
| 横スクロール | OK | OK | OK |
| 画像欠損 | 0件 | 0件 | 0件 |
| 404 | 0件 | 0件 | 0件 |
| 黒プレースホルダー | 0件 | 0件 | 0件 |
| 文字切れ | OK | OK | OK |
| ボタン押下可能 | OK | OK | OK |

## スクショ（修正後）

| 内容 | パス |
|------|------|
| 全体 390px | `reports/screenshots/iwasho-home-mobile-final/home-full-390.png` |
| カード 390px | `reports/screenshots/iwasho-home-mobile-final/home-cards-390.png` |
| カード 430px | `reports/screenshots/iwasho-home-mobile-final/home-cards-430.png` |
| カード 768px | `reports/screenshots/iwasho-home-mobile-final/home-cards-768.png` |
| ギャラリー 390px | `reports/screenshots/iwasho-home-mobile-final/home-gallery-390.png` |

修正前参考: `reports/screenshots/iwasho-home-partner-cards-390.png`（黒アイコン・文字被り）

## 残課題

- パートナーカード背景（`card-partner-bg.png`）は淡い写真のため、環境によっては背景が目立ちにくい（欠損ではない）
- 他6ページ（事業内容〜お問い合わせ）は前回モバイルCSS適用済み。今回はホーム重点調整

## 完了判定

**完了** — Geminiレビュー最優先3項目＋中優先3項目を `corp-biz-mobile.css` で反映。画像監査・レイアウト確認済み。

## 再実行

```bash
node scripts/audit-iwasho-images.mjs
node scripts/capture-iwasho-home-mobile-final.mjs
```
