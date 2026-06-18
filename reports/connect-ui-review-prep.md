# Connect UI — Gemini レビュー準備

実施: 2026-06-12T14:02:24.928Z

## Connect 導線一覧

| # | 画面 | 導線 | sourceUrl |
|---|------|------|-----------|
| 1 | Connectトップ | 会員メニュー → 支払い方法・口座管理 | payment-settings.html |
| 2 | ダッシュボードバナー | 本人確認未完了 — マイページ上部の固定案内 | dashboard.html |
| 3 | Connect開始 | Connectトップ「Connectを始める」→ 本人確認 / TALK通知 | payment-settings.html → talk-home.html |
| 4 | 本人確認 | 通知「本人確認を進める」→ Connect本人確認パネル | talk-home.html → payment-settings.html |
| 5 | 資格確認 | 本人確認提出後 → 振込先口座セクション | payment-settings.html |
| 6 | Connect審査中 | 振込先保存後 → 審査中ステータス | payment-settings.html |
| 7 | Connect承認 | 審査完了（デモ） | payment-settings.html |
| 8 | Connect利用開始 | 利用可能ステータス | payment-settings.html |
| 9 | Connectあり取引導線 | スキル詳細（demoConnect=1）購入CTA | detail-skill.html |
| 10 | Connectなし取引導線 | スキル詳細（demoConnect=0）決済未設定案内 | detail-skill.html |

## 登録スクショ一覧

- `screenshots/connect-ui-review/connect-top-mobile390.png` — connect-top（Gemini: `connect-top.png`）
- `screenshots/connect-ui-review/dashboard-connect-banner-mobile390.png` — dashboard-connect-banner
- `screenshots/connect-ui-review/connect-apply-mobile390.png` — connect-apply（Gemini: `connect-apply.png`）
- `screenshots/connect-ui-review/connect-identity-mobile390.png` — connect-identity
- `screenshots/connect-ui-review/connect-qualification-mobile390.png` — connect-qualification
- `screenshots/connect-ui-review/connect-reviewing-mobile390.png` — connect-reviewing
- `screenshots/connect-ui-review/connect-approved-mobile390.png` — connect-approved（Gemini: `connect-approved.png`）
- `screenshots/connect-ui-review/connect-ready-mobile390.png` — connect-ready
- `screenshots/connect-ui-review/connect-trade-with-mobile390.png` — connect-trade-with（Gemini: `connect-trade-flow.png`）
- `screenshots/connect-ui-review/connect-trade-without-mobile390.png` — connect-trade-without

### Gemini 提出用

- `screenshots/connect-ui-review/connect-top.png`
- `screenshots/connect-ui-review/connect-apply.png`
- `screenshots/connect-ui-review/connect-verification.png`
- `screenshots/connect-ui-review/connect-approved.png`
- `screenshots/connect-ui-review/connect-trade-flow.png`

## QA Center

- Viewer: `screenshots-viewer.html?search=connect`（http://localhost:5500/screenshots-viewer.html?search=connect）
- 検索キーワード: **connect**（登録済み 15 枚）
- IMAGE_META 登録数: 49
- 未登録 ⚠: 0


## 実操作検証

| ステップ | 結果 |
|----------|------|
| dashboard-connect-banner | PASS |
| connect-top-ui | PASS |
| connect-start-click | PASS |
| notify-to-identity | PASS |
| bank-save-reviewing | PASS |
| connect-ready | PASS |
| trade-with-connect | PASS |
| trade-without-connect | PASS |

総合: **PASS**
