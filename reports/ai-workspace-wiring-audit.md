# TASFUL AI 配線監査レポート

**スコープ:** 追加ページ・ボタン・設定系（Q&A 除外 · 調査のみ · 修正なし）

検証日時: 2026-06-30T02:52:21.306Z
検証URL: http://127.0.0.1:8788/ai-workspace.html

## 検証サマリー

| Viewport | HTTP | Console Error | Network 4xx/5xx | 横スクロール |
|----------|------|---------------|-----------------|--------------|
| 1280 | 200 | 9 | 0 | なし |
| 768 | 200 | 0 | 0 | なし |
| 390 | 200 | 0 | 0 | なし |

## 機能別結果

### 設定ナビ（14セクション）
- general: 表示
- ai: 表示
- model: 表示
- chat: 表示
- voice: 表示
- image: 表示
- library: 表示
- notification: 表示
- personalize: 表示
- data: 表示
- security: 表示
- account: 表示
- billing: 表示
- help: 表示 · **デモ**

### 設定保存
- modelMode: OK
- chatToggle: **NG**
- personalizeSave: OK
- generalToggle: OK

### プラン切替
- 比較タブ: lite, pro, max
- 請求プランカード: Lite / Pro / Max

### モデル選択
- Composer model: claude
- 設定パネル: Gemini=true Claude=true GPT=true DeepSeek=true

### 生成系ページ（カテゴリパネル）
- 画像（image）: OK
- 動画（video）: OK
- 音楽（music）: OK
- 資料（document）: OK

### 生成チャット
- image: OK
- code: OK

### 検索系（ツール切替 + 送信）
- tasful: OK
- web: OK
- both: OK
- consult: OK

---

## 未接続ボタン / 導線

- Welcome スターターチップ `[data-tga-starter-chip]` 0 件
- プラン比較 › タブ切替で比較パネルが更新されない

## 404リンク

- （なし）

## ダミーボタン

- 設定 › ヘルプ: renderDummyPanel（準備中デモ）
- ai-workspace-billing-settings.js: console.info デモハンドラ 9 件
- ai-workspace-account-settings.js: console.info デモハンドラ 9 件
- ai-workspace-security-settings.js: console.info デモハンドラ 9 件
- ai-workspace-data-settings.js: console.info デモハンドラ 6 件
- ai-workspace-personalization-settings.js: console.info デモハンドラ 1 件
- ai-workspace-library-settings.js: console.info デモハンドラ 4 件
- ai-workspace-plan-upgrade.js: console.info デモハンドラ 1 件
- 設定 › help: 準備中プレースホルダー
- 請求 › manage-plan: デモ / 未接続ハンドラ（console.info または遷移なし）
- 請求 › view-all-usage: デモ / 未接続ハンドラ（console.info または遷移なし）
- 請求 › upgrade-plan: デモ / 未接続ハンドラ（console.info または遷移なし）
- 請求 › change-payment: デモ / 未接続ハンドラ（console.info または遷移なし）
- 請求 › add-payment: デモ / 未接続ハンドラ（console.info または遷移なし）
- 請求 › view-receipt: デモ / 未接続ハンドラ（console.info または遷移なし）
- 請求 › view-all-history: デモ / 未接続ハンドラ（console.info または遷移なし）
- 請求 › cancel-plan: デモ / 未接続ハンドラ（console.info または遷移なし）
- 請求 › contact-support: デモ / 未接続ハンドラ（console.info または遷移なし）
- 一般 › MFAを設定: 1 件（デモ想定）
- パーソナライズ › 管理する: 1 件（デモ想定）
- データ管理 › increase-storage: デモ / 未接続ハンドラ（console.info または遷移なし）
- データ管理 › export: デモ / 未接続ハンドラ（console.info または遷移なし）
- データ管理 › import: デモ / 未接続ハンドラ（console.info または遷移なし）
- データ管理 › delete-history: デモ / 未接続ハンドラ（console.info または遷移なし）
- データ管理 › delete-uploads: デモ / 未接続ハンドラ（console.info または遷移なし）
- データ管理 › delete-all: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › change-password: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › add-passkey: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › manage-login-providers: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › manage-sessions: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › logout-other-devices: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › manage-api-keys: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › manage-oauth-apps: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › logout-all-devices: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › delete-all-api-keys: デモ / 未接続ハンドラ（console.info または遷移なし）
- セキュリティ › reset-security: デモ / 未接続ハンドラ（console.info または遷移なし）
- アカウント › edit-name: デモ / 未接続ハンドラ（console.info または遷移なし）
- アカウント › change-email: デモ / 未接続ハンドラ（console.info または遷移なし）
- アカウント › change-avatar: デモ / 未接続ハンドラ（console.info または遷移なし）
- アカウント › manage-provider: デモ / 未接続ハンドラ（console.info または遷移なし）
- アカウント › disconnect-provider: デモ / 未接続ハンドラ（console.info または遷移なし）
- アカウント › connect-provider: デモ / 未接続ハンドラ（console.info または遷移なし）
- アカウント › logout: デモ / 未接続ハンドラ（console.info または遷移なし）
- アカウント › delete-account: デモ / 未接続ハンドラ（console.info または遷移なし）
- ライブラリー › cleanup-unused: デモ / 未接続ハンドラ（console.info または遷移なし）
- ライブラリー › empty-trash: デモ / 未接続ハンドラ（console.info または遷移なし）
- ライブラリー › increase-storage: デモ / 未接続ハンドラ（console.info または遷移なし）
- ライブラリー › view-file-details: デモ / 未接続ハンドラ（console.info または遷移なし）
- プランアップグレード › 選択: 1 件（デモ想定）
- ユーザーメニュー › ヘルプ › center: デモ / 未接続ハンドラ（console.info または遷移なし）
- ユーザーメニュー › ヘルプ › releases: デモ / 未接続ハンドラ（console.info または遷移なし）
- ユーザーメニュー › ヘルプ › shortcuts: デモ / 未接続ハンドラ（console.info または遷移なし）
- ユーザーメニュー › ヘルプ › terms: デモ / 未接続ハンドラ（console.info または遷移なし）
- ユーザーメニュー › ヘルプ › privacy: デモ / 未接続ハンドラ（console.info または遷移なし）
- ユーザーメニュー › ヘルプ › bug: デモ / 未接続ハンドラ（console.info または遷移なし）

## 設定保存漏れ

- 設定 › チャット › トグル変更が tasu_ai_chat_settings に反映されない

## 修正推奨

- コンポーザー › ツール切替 UI は hidden（`TasuTgaShell.applyWorkspaceTool` API のみ）
- 1280px Console Error 9 件
- 1280px: Failed to load resource: the server responded with a status of 401 ()