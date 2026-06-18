# TASFUL TALK 通話 Phase7 Preflight — Push 実接続前チェック

**日付:** 2026-06-17  
**監査種別:** コード・SQL・Edge・回帰（変更なし）  
**本番 VAPID / TURN credential 投入:** **未実施**  
**Supabase DB SQL 適用:** **未実施**（リモートに `talk_call_push_events` 未存在を確認）

---

## 総合判定: **WARNING**

**結論:** DB 適用 → Service Worker 実装 → VAPID 投入の順で**進行可能**。credential 漏洩リスクや foreground 着信破壊は確認されず **FAIL 条件には該当しない**。Edge Function のセッション状態ガード不足・DB 未適用・TALK 専用 SW 未実装は Phase7 実接続タスクとして対応推奨。

| 観点 | 結果 |
|------|------|
| SQL / RLS 設計 | ⚠️ 改善推奨（caller も SELECT 可・dev RLS 全開） |
| Push payload 秘匿 | ✅ 合格 |
| Edge Function | ⚠️ 改善推奨（ringing 再確認・pending 残留） |
| Service Worker 方針 | ⚠️ 未実装（Builder SW との衝突なし） |
| Phase1〜6 回帰 | ✅ 全 PASS |
| foreground 着信 | ✅ Phase3 E2E PASS |

---

## 確認ファイル一覧

| ファイル | 監査内容 |
|----------|----------|
| [`sql/talk-call-push-schema.sql`](../sql/talk-call-push-schema.sql) | テーブル定義・UNIQUE・dev RLS |
| [`sql/talk-call-push-rls-production.sql`](../sql/talk-call-push-rls-production.sql) | 本番 RLS |
| [`scripts/talk-call-push-events.js`](../scripts/talk-call-push-events.js) | enqueue / cancel / payload |
| [`supabase/functions/talk-call-push-notify/index.ts`](../supabase/functions/talk-call-push-notify/index.ts) | mock Edge Function |
| [`scripts/test-talk-call-push-notification-design.mjs`](../scripts/test-talk-call-push-notification-design.mjs) | 設計テスト |
| [`scripts/talk-call-service.js`](../scripts/talk-call-service.js) | enqueue / cancel 連携 |
| [`scripts/talk-call-notify-bridge.js`](../scripts/talk-call-notify-bridge.js) | terminal cancel・foreground 着信 |
| [`builder/service-worker.js`](../builder/service-worker.js) | 既存 SW（Builder スコープ） |
| [`talk-home.html`](../talk-home.html) / [`chat-detail.html`](../chat-detail.html) | script 読込 |

---

## 1. SQL / RLS 監査

### 1.1 `talk_call_push_events` 列構成

| 列 | 型 | 評価 |
|----|-----|------|
| `id` | uuid PK | ✅ |
| `call_id` | uuid FK → `talk_call_sessions` ON DELETE CASCADE | ✅ |
| `callee_user_id` | text | ✅ |
| `caller_user_id` | text | ✅ |
| `room_id` | text | ✅ |
| `event_type` | text CHECK `talk_call_incoming` | ✅ |
| `delivery_status` | pending / sent / skipped / cancelled / failed | ✅ |
| `payload` | jsonb | ✅ |
| `target_url` | text | ✅（tap URL 用） |
| `created_at` / `sent_at` / `cancelled_at` | timestamptz | ✅ |

**重複防止:** `UNIQUE (call_id, callee_user_id)` ✅  
**インデックス:** `(callee_user_id, delivery_status, created_at desc)` ✅

### 1.2 `talk_push_subscriptions` 列構成

| 列 | 型 | 評価 |
|----|-----|------|
| `user_id` | text | ✅ |
| `endpoint` | text | ✅ |
| `p256dh_key` / `auth_key` | text | ✅（Web Push 標準鍵・サーバ側のみ使用想定） |
| `UNIQUE (user_id, endpoint)` | | ✅ |

### 1.3 本番 RLS（`talk-call-push-rls-production.sql`）

| 操作 | ポリシー | 評価 |
|------|----------|------|
| SELECT events | admin / **callee** / **caller** | ⚠️ callee のみではなく caller も可読 |
| INSERT events | caller のみ + `talk_call_sessions.status='ringing'` 存在チェック | ✅ |
| UPDATE events | admin / callee / caller | ✅ cancel 可能 |
| subscriptions ALL | admin / **本人 user_id のみ** | ✅ 他ユーザー読取不可 |

**service role 漏洩:** Edge Function は `SUPABASE_SERVICE_ROLE_KEY` を Deno env のみ使用。クライアント JS / anon key 経由で service role 処理は露出していない ✅

**dev RLS 注意:** schema 同梱の dev ポリシーは `using (true)` 全開。ステージング/本番では **必ず** `talk-call-push-rls-production.sql` を適用すること ⚠️

**DB 適用状態:** リンク済み Supabase で `talk_call_push_events` は **404 PGRST205（未作成）**。Phase7 最初のタスクは SQL 適用 ✅（想定内）

---

## 2. Push payload 監査

### 2.1 `buildPushPayload()` 出力（jsonb）

| キー | 含む | 評価 |
|------|------|------|
| `type` | `talk_call_incoming` | ✅ 許可 |
| `call_id` | ✅ | ✅ 許可 |
| `room_id` | ✅ | ✅ 許可 |
| `caller_display_name` | ✅（80 文字・HTML 除去） | ✅ 許可 |

### 2.2 `target_url` 列（payload 外）

| 項目 | 評価 |
|------|------|
| `chat-detail.html?thread=&callId=&from=notify` | ✅ Phase2 overlay 導線と一致 |

### 2.3 禁止項目

| 項目 | payload | DB 行 | ログ |
|------|---------|-------|------|
| email / phone / address | なし | なし | Edge `safeLog` 除去 |
| auth token / TURN credential | なし | なし | `FORBIDDEN_PAYLOAD_KEYS` |
| payment 情報 | なし | なし | ✅ |
| internal role | なし | なし | ⚠️ `role` は forbidden リスト未明示（含まれない） |

**テスト:** `test-talk-call-push-notification-design.mjs` で credential / email 非含有を検証済み ✅

---

## 3. Edge Function 監査（`talk-call-push-notify`）

| 項目 | 結果 |
|------|------|
| VAPID 未設定時 skip | ✅ `isMockMode()` → `TALK_VAPID_PUBLIC_KEY` なしで mock |
| credential をログに出さない | ✅ `safeLog` + `FORBIDDEN_LOG_KEYS` |
| pending event のみ fetch | ✅ `delivery_status=eq.pending` |
| 状態更新（mock） | ✅ `skipped` + `sent_at` |
| ended / rejected / active の call を送らない | ⚠️ **セッション状態未確認** — pending 残留時に mock 送信しうる |
| 同一 event 重複送信 | ⚠️ pending→skipped 更新前の並行 invoke で理論上二重処理余地（低） |
| 本番 Web Push 実装 | ❌ 未実装（`web_push_not_implemented` で skip、**event は pending のまま**） |

### Phase7.1 推奨修正（コード変更は別タスク）

1. Edge で `talk_call_sessions` を join し `status='ringing'` かつ `expires_at > now()` のみ送信
2. 条件不一致時は event を `cancelled` に更新
3. `web_push_not_implemented` / 送信失敗時は `failed` に更新
4. 送信成功時は `sent` に更新（`sent` 状態は schema 定義済み）

---

## 4. Service Worker / subscription 方針

### 4.1 既存 Service Worker

| ファイル | スコープ | push ハンドラ | TALK 衝突 |
|----------|----------|---------------|-----------|
| [`builder/service-worker.js`](../builder/service-worker.js) | `builder/` のみ | **なし**（install/activate/fetch のみ） | **なし** |
| [`builder-admin/service-worker.js`](../builder-admin/service-worker.js) | builder-admin | なし | なし |
| `talk-home.html` / `chat-detail.html` | — | **SW 未登録** | — |

Builder PWA と TALK 通話 Push は **スコープが分離**されており、現状衝突なし ✅

### 4.2 Phase7 実装案（新規ファイル）

```
talk-service-worker.js     # リポジトリ root、scope: /
scripts/talk-push-subscribe.js  # 購読登録 helper（最小）
```

**SW 必須ハンドラ（案）:**

- `push` → `showNotification`（title/body/data に payload + target_url のみ）
- `notificationclick` → `clients.openWindow(target_url)`

**subscription 登録タイミング（案）:**

| タイミング | 内容 |
|------------|------|
| talk-home 初回ログイン後 | サイレント試行（UI 大改修なし） |
| 設定画面（将来） | 明示 opt-in |
| 通話発信/着信成功後 | 再同期（任意） |

**permission UI:** 本格実装は Phase8 以降。Phase7 では `Notification.permission` が `default` なら **何もしない**（既存 foreground 着信を優先） ✅

### 4.3 subscription 保存

- `talk_push_subscriptions` テーブルへ upsert
- RLS: 本人のみ ✅
- `auth_key` / `p256dh_key` は Edge の service role からのみ読取（本番ポリシー維持）

---

## 5. クライアント連携監査

| 経路 | 動作 | foreground 競合 |
|------|------|-----------------|
| `initiateCall` → `enqueueForRingingSession` | caller のみ ringing enqueue | なし |
| `onSessionChange` terminal/active → `cancelForSession` | pending cancel | なし |
| `notify-bridge.onSessionUpdate` | 従来どおり local 通知カード | **Phase3 E2E PASS** ✅ |
| `invokeMockSender` | `talkCallPushFunctionUrl` 設定時のみ | 任意 |

table 未存在時は `table_missing` で **silent skip** — 既存通話を壊さない ✅

---

## 6. 検証コマンドと結果

実行環境: `SUPABASE_STRICT=1`, `BASE_URL=http://127.0.0.1:8765`  
日付: 2026-06-17

```powershell
$env:SUPABASE_STRICT="1"
$env:BASE_URL="http://127.0.0.1:8765"
node scripts/test-talk-call-push-notification-design.mjs
node scripts/test-talk-webrtc-call-browser.mjs
node scripts/test-talk-call-chat-detail.mjs
node scripts/test-talk-call-notification-center.mjs
node scripts/test-talk-call-history-ui.mjs
node scripts/test-talk-call-turn-config.mjs
node scripts/test-talk-call-relay-candidate.mjs
```

| コマンド | 結果 |
|----------|------|
| `test-talk-call-push-notification-design.mjs` | **PASS**（DB integration **SKIP** — テーブル未適用） |
| `test-talk-webrtc-call-browser.mjs` | **PASS** |
| `test-talk-call-chat-detail.mjs` | **PASS** |
| `test-talk-call-notification-center.mjs` | **PASS** |
| `test-talk-call-history-ui.mjs` | **PASS** |
| `test-talk-call-turn-config.mjs` | **PASS** |
| `test-talk-call-relay-candidate.mjs` | **SKIP PASS** |

---

## 7. Phase7 実接続タスク一覧

| # | タスク | 優先度 | 状態 |
|---|--------|--------|------|
| 1 | `sql/talk-call-push-schema.sql` を Supabase に適用 | **必須** | 未 |
| 2 | `sql/talk-call-push-rls-production.sql` 適用 | **必須** | 未 |
| 3 | Edge: ringing / expires_at ガード + sent/failed/cancelled 更新 | **必須** | 未 |
| 4 | `talk-service-worker.js` 新規 + talk-home/chat-detail 登録 | **必須** | 未 |
| 5 | `scripts/talk-push-subscribe.js` — subscription upsert | 高 | 未 |
| 6 | Edge: web-push ライブラリ + VAPID 送信実装 | 高 | 未 |
| 7 | VAPID 鍵生成・Supabase secrets 投入 | 高 | **未投入** |
| 8 | DB Webhook: `talk_call_push_events` INSERT → Edge 自動 invoke | 中 | 未 |
| 9 | `SUPABASE_STRICT=1` push integration テストを SKIP から PASS へ | 中 | 未 |
| 10 | Push permission 本格 UI | 低（Phase8） | 対象外 |

---

## 8. 軽微修正候補（Phase7.1 — 本 preflight では未実施）

| # | 内容 | 理由 |
|---|------|------|
| 1 | Edge で session status / expires_at 検証 | 遅延 Push 防止 |
| 2 | `web_push_not_implemented` 時に event を `failed` 更新 | pending 残留防止 |
| 3 | `FORBIDDEN_PAYLOAD_KEYS` に `role` 追加 | 防御的深度 |
| 4 | production SELECT を callee のみに限定するか設計判断 | 最小権限 |

---

## 9. セキュリティサマリー

- **本番 VAPID 鍵:** 未投入 ✅（意図通り）
- **TURN credential:** 未投入 ✅
- **Push payload / ログ:** 秘匿情報なし ✅
- **subscription 鍵:** クライアント DB 行に含まれるが RLS 本人限定。Edge は service role のみ ✅
- **foreground 着信:** 破壊なし ✅

---

## 10. 判定根拠

| 判定 | 条件 | 該当 |
|------|------|------|
| **FAIL** | credential 漏洩 / foreground 破壊 / RLS 致命的欠陥 | ❌ 該当なし |
| **WARNING** | 進行可能だが改善推奨 | ✅ Edge ガード・DB 未適用・SW 未実装 |
| **PASS** | 即実接続 GO | —（上記 WARNING のため） |

**WARNING → PASS への条件:** タスク 1〜3 完了 + Phase7 integration テスト PASS + SW 骨格マージ
