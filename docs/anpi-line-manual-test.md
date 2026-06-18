# LINE安否通知 — 手動確認ガイド

本番公開前に運用者がブラウザで確認する手順です。

## 事前準備

1. 安否ユーザーとして `anpi-register.html` で登録済みであること
2. 管理者フラグを ON:
   - `localStorage.setItem('tasu_anpi_line_admin_v1', '1')`
   - または URL に `?anpi_admin=1` を付与
3. ローカル検証時は `tasu_anpi_line_send_mock_v1=1` でモック送信可（本番前に削除）

## モックモード / 本番モード

| 状態 | 条件 |
|------|------|
| モック | `tasu_anpi_line_send_mock_v1=1` または Supabase URL 未設定 |
| 本番 | 上記 OFF かつ `TASU_CHAT_SUPABASE_CONFIG` に URL / anon key あり |

**期待結果:** `anpi-line-admin.html` または dashboard のモードバッジが意図どおり表示される。

## Healthcheck

1. `anpi-line-admin.html` を開く
2. Healthcheck 一覧を確認

**期待結果:**

- `LINE_LOGIN_CHANNEL_ID` — 本番では ok
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — ok
- `anpi-line-send` / `anpi-line-token-exchange` — ok（到達性は warning 可）
- Secrets 系（TOKEN / SECRET）は「クライアントから未確認」warning でよい

## 管理カード（dashboard / anpi-dashboard）

1. `dashboard.html` または `anpi-dashboard.html` を開く
2. 「LINE設定状態」カードを確認

**期待結果:** 管理者のみ表示。統計・Healthcheck 要約・運用画面リンクが見える。一般ユーザーには非表示。

## LINE Login

1. `anpi-register.html` で「LINEアカウントを連携する」
2. LINE 認可 → `anpi-line-callback.html` → 登録画面に戻る
3. 連携済み表示・マスク ID を確認

**期待結果:** `line_user_id` / `line_linked_at` が保存される。`line_notification_enabled` は自動 ON にならない。

## LINE連携解除（P8-3）

1. 連携済み状態で「LINE連携を解除」
2. 確認ダイアログで OK

**期待結果:** userId / token 削除、`line_oauth_unlinked` ログ作成、失敗カード・再送ボタン非表示。

## テストPush（管理者）

1. `anpi-line-admin.html` を開く
2. 「テストPush送信」をクリック

**期待結果:**

- 成功メッセージ表示
- LINE に「TASFUL安否サービス / LINE通知テストです。」が届く（本番時）
- 通知ログに `line_test_push`（未読バッジ対象外）

失敗時は `error_code` / `error_message` が画面に表示される。

## Push送信（緊急通知）

1. LINE 通知を「利用する」+ `notify_line` を ON にして保存
2. AI 相談等で緊急キーワードを含むメッセージを送信（または既存フロー）

**期待結果:** `urgent_keyword_detected` ログが `line_status: sent` になる。

## 失敗通知

1. モックで `force_fail` 相当の失敗を発生させる、または本番で無効 userId を検証
2. 通知センターで失敗バッジ・エラーメッセージを確認
3. dashboard / anpi-dashboard の LINE 失敗カードを確認

**期待結果:** `line_error_message` / `line_error_code` が表示される。

## 再送

1. 失敗ログの詳細を開く
2. 「LINE再送」をクリック

**期待結果:** `line_status: sent`、失敗カード消滅、未読バッジは増えない。

## 確認画面一覧

| 画面 | URL |
|------|-----|
| LINE運用（管理者） | `anpi-line-admin.html` |
| 安否登録 | `anpi-register.html` |
| 通知センター | `anpi-notifications.html` |
| ダッシュボード | `dashboard.html` |
| 安否ダッシュボード | `anpi-dashboard.html` |

## E2E 一括

```bash
node scripts/test-anpi-all.mjs
```

すべて PASS であることを確認してからデプロイしてください。
