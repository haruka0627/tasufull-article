# LINE安否通知 — デプロイ前チェックリスト

本番運用前に、以下を順に確認してください。

## LINE Developers

- [ ] LINE Login チャネルを作成済み
- [ ] **Callback URL** に `{origin}/anpi-line-callback.html` を登録済み
- [ ] Messaging API チャネル（または Login 連携先）を確認済み
- [ ] Channel Access Token（長期）を発行済み
- [ ] Webhook URL（必要な場合）を設定済み

## LINE Login（P8-1〜P8-3）

- [ ] クライアントに `TASU_ANPI_LINE_LOGIN_CHANNEL_ID` を設定
- [ ] Supabase Secrets に `LINE_LOGIN_CHANNEL_SECRET` を設定
- [ ] `anpi-line-token-exchange` Edge Function をデプロイ
- [ ] LINE Login → トークン交換 → `line_user_id` 保存が成功すること
- [ ] **LINE連携解除** 後、再送ボタン・失敗カードが出ないこと

## Supabase Secrets

- [ ] `LINE_CHANNEL_ACCESS_TOKEN`（Messaging API Push 用）
- [ ] `LINE_LOGIN_CHANNEL_SECRET`（トークン交換用）
- [ ] `ANPI_LINE_MOCK` を **未設定** または `0`（本番）
- [ ] ステージングのみモックの場合は `ANPI_LINE_MOCK=1` を明示

## Edge Deploy

- [ ] `anpi-line-send` をデプロイ

```bash
supabase functions deploy anpi-line-send
```

- [ ] `anpi-line-token-exchange` をデプロイ

```bash
supabase functions deploy anpi-line-token-exchange
```

- [ ] デプロイ後、OPTIONS / POST が 200 系で応答すること

## クライアント設定

- [ ] `TASU_CHAT_SUPABASE_CONFIG`（または `TASU_SUPABASE_CONFIG`）に **SUPABASE_URL** / **SUPABASE_ANON_KEY**
- [ ] ブラウザ `localStorage` の `tasu_anpi_line_send_mock_v1` を **削除**（本番）
- [ ] 管理者確認: `localStorage.setItem('tasu_anpi_line_admin_v1','1')` または `?anpi_admin=1`

## Healthcheck

- [ ] `anpi-line-admin.html` または dashboard / anpi-dashboard で管理者表示を ON
- [ ] Healthcheck で **エラー 0**（警告は内容を確認）
- [ ] LINE Login / Messaging API / Token Exchange / Push API の状態を確認
- [ ] 送信モードが **本番モード** であること

## テストPush（管理者）

- [ ] `anpi-line-admin.html` で **テストPush送信** が成功すること
- [ ] 通知ログに `line_test_push` が記録されること（未読バッジに含まれないこと）

## 動作確認

- [ ] 緊急キーワード等の送信対象イベントで Push が届くこと
- [ ] 送信済みログへの **二重送信が発生しない** こと
- [ ] 意図的な失敗で `line_error_code` / `line_error_message` が表示されること
- [ ] 失敗ログから **LINE再送** が成功すること
- [ ] 再送後、dashboard / 安否ダッシュボードの失敗カードが消えること
- [ ] 未読・緊急バッジ集計に LINE 失敗 / テストPush が影響しないこと

## E2E

```bash
node scripts/test-anpi-all.mjs
```

すべて PASS であること。

## 送信対象イベント（参考）

- `urgent_keyword_detected`
- `emergency`
- `anpi_alert`
- `manual_alert`

送信対象外の例: `line_notification_preview`, `line_test_push`, `line_oauth_unlinked`, `ai_search`, `call_consent_*`, `site_navigation`

## 関連ドキュメント

- [手動確認ガイド](./anpi-line-manual-test.md)
