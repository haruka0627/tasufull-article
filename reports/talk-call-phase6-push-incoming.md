# TASFUL TALK 通話 Phase6 — Push 着信 設計・実装準備

**日付:** 2026-06-17  
**本番 Push credential 投入:** **未実施**  
**総合判定:** **PASS**

---

## 概要

1:1 音声通話について、**フォアグラウンド以外でも着信に気づける**ための Push 着信土台を構築。Phase3 の通知センター着信（foreground）と**競合しない** event 層を追加。

## 設計方針

### 採用前提: **Web Push + Supabase Edge Function**

| 方式 | 採用 | 理由 |
|------|------|------|
| **Web Push (VAPID)** | ✅ 本命 | ブラウザ/PWA 標準。TALK は静的 HTML + Supabase 構成と相性良い |
| PWA Service Worker | ⏳ Phase7 | Phase6 では SW 未登録。`talk_push_subscriptions` テーブルのみ準備 |
| Supabase Realtime のみ | ❌ 既存 | タブ閉じると着信不可 — Phase3 で foreground 対応済み |
| LINE Push (ANPI) | ❌ | 別チャネル。通話着信には使わない |

### 既存通知基盤との関係

| レイヤー | 役割 | Phase6 |
|----------|------|--------|
| `talk_call_sessions` | 通話状態の正 | 変更なし |
| `TasuTalkCallNotifyBridge` | talk-home **foreground** 通知カード | 変更なし（競合回避） |
| `talk_call_push_events` | **background Push キュー** | **新規** |
| Edge `talk-call-push-notify` | mock 送信 | **新規** |

### Push 対象ルール

| 条件 | Push |
|------|------|
| `status=ringing` 作成時 | ✅ callee のみ |
| caller | ❌ |
| `ended` / `rejected` / `missed` / `active` | ❌（pending は cancel） |
| 同一 `call_id` + `callee_user_id` | 重複不可（UNIQUE） |

---

## 実装ファイル

| ファイル | 内容 |
|----------|------|
| [`sql/talk-call-push-schema.sql`](../sql/talk-call-push-schema.sql) | `talk_call_push_events`, `talk_push_subscriptions` |
| [`sql/talk-call-push-rls-production.sql`](../sql/talk-call-push-rls-production.sql) | 本番 RLS |
| [`scripts/talk-call-push-events.js`](../scripts/talk-call-push-events.js) | enqueue / cancel / payload / tap URL |
| [`supabase/functions/talk-call-push-notify/index.ts`](../supabase/functions/talk-call-push-notify/index.ts) | mock Edge Function |
| [`scripts/talk-call-service.js`](../scripts/talk-call-service.js) | ringing enqueue / terminal cancel |
| [`scripts/talk-call-notify-bridge.js`](../scripts/talk-call-notify-bridge.js) | terminal cancel 連携 |

---

## Push payload（秘匿情報なし）

```json
{
  "type": "talk_call_incoming",
  "call_id": "<uuid>",
  "room_id": "<thread>",
  "caller_display_name": "Store"
}
```

**含めない:** email, phone, address, token, credential, payment

### タップ遷移

```
chat-detail.html?thread={room_id}&callId={call_id}&from=notify&userId=...
```

Phase2 `prepareIncomingForCallId` / overlay と同一導線（`buildPushTapUrl` = `buildAcceptHref`）。

---

## 権限制御

- **enqueue:** caller のみ、`ringing` セッション、callee は session participant
- **cancel:** `active` / `ended` / `rejected` / `missed` / `busy` で pending を `cancelled`
- **本番 RLS:** caller insert / callee+caller select / participant update
- **`_test`:** dev/test のみ（Phase5.6 パターン踏襲）

---

## Edge Function（mock）

`TALK_PUSH_MOCK=1` または VAPID 未設定時:

- pending event を `skipped` に更新
- payload に秘匿情報をログ出力しない
- 実 Web Push 送信は **Phase7 以降**

---

## 検証結果

```bash
node scripts/test-talk-call-push-notification-design.mjs
node scripts/test-talk-call-turn-config.mjs
node scripts/test-talk-call-relay-candidate.mjs
# Phase1〜4 E2E (SUPABASE_STRICT=1)
```

| スイート | 結果 |
|----------|------|
| Phase6 `test-talk-call-push-notification-design.mjs` | **PASS** |
| Phase5/5.6 回帰 | **PASS** |
| Phase1〜4 E2E | **PASS** |

### Phase6 必須確認

| 項目 | 結果 |
|------|------|
| ringing → callee 向け push event | ✅ |
| caller には push event なし | ✅ |
| ended/rejected/missed では enqueue しない | ✅ |
| 同一 call_id 重複防止 | ✅ UNIQUE |
| payload 秘匿情報なし | ✅ |
| tap URL = chat-detail + callId | ✅ |
| 通知センター着信を壊さない | ✅ Phase3 E2E PASS |

---

## 未対応（Phase7 以降）

- Service Worker 登録 + `push` / `notificationclick` ハンドラ
- VAPID 鍵本番投入 + 実 Web Push 送信
- Push permission UI（本格）
- DB Webhook → Edge 自動トリガー
- ビデオ通話 / TURN credential 投入

---

## DB 適用手順

```bash
# Supabase SQL Editor または linked project
sql/talk-call-schema.sql          # 未適用なら
sql/talk-call-push-schema.sql
sql/talk-call-push-rls-production.sql  # 本番
```

---

## 判定

**PASS** — Push 着信の土台完成。本番 credential 未投入。秘匿情報なし。重複防止あり。Phase1〜5.6 回帰 PASS。
