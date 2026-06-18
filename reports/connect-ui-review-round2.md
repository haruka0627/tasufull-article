# Connect UI — Gemini 2回目レビュー反映

実施: 2026-06-12T14:13:15.088Z

## 反映内容

### 優先度A

1. **本人確認フェーズのCTA一本化** — `Connectを始める` を非表示、`本人確認を始める` のみ
2. **connect-approved 表示崩れ修正** — `[hidden]` が `display:grid/flex` で無効化されていた問題を修正。ビューポートキャプチャでヘッダー重複を解消

### 優先度B

3. **ダッシュボード固定バナー文言** — 【重要】＋売上受け取り・安全な取引の訴求
4. **安心表示ブロック順序** — CTA → 安心表示 → 注意事項（ready時は安心→注意）

## 提出スクショ（390px）

- `screenshots/connect-ui-review/connect-identity-mobile390.png`
- `screenshots/connect-ui-review/connect-approved-mobile390.png`
- `screenshots/connect-ui-review/dashboard-connect-banner-mobile390.png`

## 検証

| ステップ | 結果 |
|----------|------|
| identity-single-cta | PASS |
| approved-layout | PASS |
| dashboard-banner-copy | PASS |

- QA Center 未登録 ⚠: **0**
- dashboard-connect-banner 検索: **1** 件

総合: **PASS**
