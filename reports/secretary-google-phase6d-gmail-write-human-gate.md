# AI秘書 Phase 6-D — Gmail write + Human Gate

**日付:** 2026-06-27  
**状態:** ✅ 実装完了（未コミット）  
**前提:** Phase 6-C Gmail read-only (`ff86582`)

---

## スコープ

| 実装 | 禁止 |
| --- | --- |
| DeepSeek 返信案生成 | 自動送信 |
| `drafts.create`（HSG 後） | trash / delete |
| `drafts.send`（HSG + 確認後） | 確認なし `messages.send` |
| 返信下書き（threadId + replyTo） | token / client_secret 露出 |

---

## フロー

```
Gmail カード「返信案を作る」
  → DeepSeek 文案（API 操作なし）
  → 「下書き保存」→ HSG enqueue (draft_create)
  → 「下書きを承認作成」→ approveAndExecute → drafts.create
  → 「送信確認」→ HSG enqueue (send) + 確認 UI
  → チェック + 「送信する」→ approveAndExecute → drafts.send
```

---

## 主要ファイル

| ファイル | 変更 |
| --- | --- |
| `supabase/functions/_shared/secretary-google-gmail.ts` | `executeGmailWrite` · MIME · Human Gate assert |
| `supabase/functions/secretary-google-tools/index.ts` | `action=gmail_write` |
| `supabase/functions/_shared/secretary-google-oauth.ts` | `gmail.compose` scope |
| `admin-ai-human-send-gate.js` | `enqueueFromGmailDraft` · gmail execute branch |
| `admin-ai-secretary-google-gmail-client.js` | proposeReply · executeWriteApproved |
| `admin-ai-secretary-google-gmail-ui.js` | カード workflow · 状態バッジ |

---

## セキュリティ

- Edge `humanGateApproved` + `pendingId` 必須
- `access_token` / `refresh_token` / `client_secret` 非公開
- ログ・エラーに token なし（`sanitizeForClient` 維持）

---

## テスト

```bash
node scripts/test-secretary-google-gmail-phase6d.mjs
node scripts/test-secretary-google-gmail-phase6c.mjs
node scripts/test-secretary-google-oauth-phase6b.mjs
node scripts/test-secretary-ai-voice-integration-phase1.mjs
```

---

## 次フェーズ

**Phase 6-E:** Calendar read-only
