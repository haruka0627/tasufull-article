# TASFUL AI 最終導線チェック

検証日時: 2026-06-30T02:23:09.799Z
検証URL: http://127.0.0.1:8788/ai-workspace.html

## 検証サマリー

| Viewport | HTTP | 横スクロール | Console Error | Network 4xx/5xx |
|----------|------|--------------|---------------|-----------------|
| 1280 | 200 | なし | 0 | 0 |
| 768 | 200 | なし | 0 | 0 |
| 390 | 200 | なし | 0 | 0 |

## モード相互遷移（API / サイドバー）

- **Welcome**: OK
- **Chat**: NG
- **Search**: OK
- **Builder**: OK
- **Analyze**: OK
- **Generate**: OK
- **History**: OK
- **Favorites**: OK

## 設定・プラン・モデル

- 設定セクション: 14件ナビゲーション確認
- 請求プラン表示: Lite / Pro / Max
- モデルプロバイダ: Gemini=true Claude=true GPT=true DeepSeek=true
- プラン比較タブ: lite, pro, max

## 生成導線

- image: OK
- code: OK
- analyze: OK
- search: OK
- builder: OK

## Q&A

- uiReview HTTP 200 / QA 12 / カード 7
- ライブQ&A「退会」: OK

---

## 未接続一覧

- カテゴリタブ `[data-ai-workspace-categories]` が HTML に存在しない（chat/image/video/music/document/history タブUI未接続）
- Welcome スターターチップ `[data-tga-starter-chip]` が0件（旧Welcome導線が ref レイアウトに未移植）
- ユーザーメニュー › ヘルプ › help_center
                ヘルプセンター: クリック後も ai-workspace 内（外部URL未接続）
- ユーザーメニュー › ヘルプ › new_releases
                リリースノート: クリック後も ai-workspace 内（外部URL未接続）
- ユーザーメニュー › ヘルプ › keyboard
                キーボードショートカット: クリック後も ai-workspace 内（外部URL未接続）
- ユーザーメニュー › ヘルプ › description
                利用規約: クリック後も ai-workspace 内（外部URL未接続）
- ユーザーメニュー › ヘルプ › shield
                プライバシーポリシー: クリック後も ai-workspace 内（外部URL未接続）
- ユーザーメニュー › ヘルプ › bug_report
                バグを報告: クリック後も ai-workspace 内（外部URL未接続）
- 1280px モード遷移 › Chat: 失敗 ({"category":"chat","welcomeHidden":false,"panelHidden":true,"messagesHidden":false,"tool":"consult","searchTarget":"tasful"})
- 768px モード遷移 › Chat: 失敗 ({"category":"chat","welcomeHidden":false,"panelHidden":true,"messagesHidden":false,"tool":"consult","searchTarget":"tasful"})
- 390px モード遷移 › Chat: 失敗 ({"category":"chat","welcomeHidden":false,"panelHidden":true,"messagesHidden":false,"tool":"consult","searchTarget":"tasful"})

## ダミーボタン一覧

- 請求 › 管理する / 領収書 / 支払い変更 / キャンセル: console.info デモのみ（Stripe未接続）
- プランアップグレード › プラン選択ボタン: demo select（checkout未接続）
- 設定 › help: 「準備中です（デモ）」プレースホルダー

## 404一覧

- （なし）

## 修正推奨一覧

- Welcome カード `[data-tga-welcome-card]` なし（意図的簡素化の可能性）
- 設定 › 請求: Free プランカードの表示が未確認