# TASFUL MATCH — Edge Function 設計レビュー

| 項目 | 内容 |
|------|------|
| 版 | v1.0（設計のみ） |
| 作成日 | 2026-06-21 |
| ステータス | 未実装・未適用 |
| 前提 | `reports/match-db-api-design-review.md`, `match-schema-draft-review.md`, `match-rls-draft-review.md` |
| 既存草案 | `20260621120000_match_schema_draft.sql`, `20260621130000_match_rls_draft.sql` |

---

## 0. 設計原則

### 0.1 絶対制約（client 禁止）

| 操作 | 実行者 |
|------|--------|
| `match_pairs` INSERT / UPDATE | **Edge（service_role）のみ** |
| `transaction_rooms` INSERT / UPDATE（マッチ用） | **Edge のみ** |
| `match_sanctions` INSERT / UPDATE | **match-admin-review のみ** |
| `match_daily_limits` UPSERT | **match-record-swipe のみ** |
| 通報内容を被通報者に返す | **禁止** |
| ブロック事実を被ブロック者に通知 | **禁止** |
| `match_verifications.metadata_json` を client レスポンスに含める | **禁止** |

### 0.2 認証モデル

| 項目 | 方針 |
|------|------|
| 会員 ID | `user_id text`（D1） |
| JWT | Supabase Auth `Authorization: Bearer` |
| 関数内解決 | `const userId = auth.uid()?.toString() ?? ''`（`auth.uid()::text` と同等） |
| 検証 | 全 user-facing Function で JWT 必須。無効時 `401` |
| service_role | `SUPABASE_SERVICE_ROLE_KEY` は **Edge 内のみ**。クライアントに渡さない |
| 運営 | `match-admin-review` は JWT + `app_metadata.role = 'match_admin'`（または別サービスキー + IP 制限） |

### 0.3 配置・既存コードとの分離

| 項目 | 方針 |
|------|------|
| パス | `supabase/functions/match-*/index.ts`（新規ディレクトリのみ） |
| 共有 | `supabase/functions/_shared/match-*.ts`（MATCH 専用。Builder/Stripe と混ぜない） |
| CORS | 既存 `_shared/cors.ts` を import |
| TALK | `chat-supabase.js` / `chat-service.js` は **変更しない**。Edge から REST で `transaction_rooms` を操作 |
| Marketplace / Builder Functions | 呼び出し・共有 state なし |

### 0.4 共通レスポンス形式

```json
{
  "ok": true,
  "data": { },
  "error": null
}
```

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "MATCH_DAILY_LIMIT_EXCEEDED",
    "message": "本日のいいね上限に達しました",
    "details": {}
  }
}
```

---

## 1. 既存 TALK（`transaction_rooms`）現状確認

**参照:** `supabase/transaction_chat.sql`, `chat-supabase.js`, `chat-room-status.js`

### 1.1 現在のスキーマ（変更なし・確認のみ）

| カラム | 型 | 備考 |
|--------|-----|------|
| `id` | uuid PK | |
| `listing_id` | text | 取引 listing ID。マッチ時は `match_pair_id` 文字列でも可 |
| `listing_type` | text | 現状コードは `"business"` 等。`"match"` は**未使用だが列は存在** |
| `title` | text NOT NULL | |
| `partner_id` | text | |
| `partner_display_name` | text | |
| `partner_avatar_url` | text | |
| `buyer_id` / `seller_id` | text | 参加者判定に使用 |
| `expires_at` | timestamptz **NOT NULL** | 現行 DDL |
| `status` | text default `'active'` | `active` / `completed` / `cancelled` 等（`chat-room-status.js`） |
| `created_at` / `updated_at` | timestamptz | |

**存在しない列（MATCH 用 optional）:** `match_pair_id`

### 1.2 既存ルーム作成パターン

`chat-supabase.js` の `createBusinessConsultRoom`:

- `listing_type: "business"`
- `buyer_id` = 依頼者、`seller_id` = 出品者
- `expires_at` = 14 日後（必須投入）
- `title` = `【業務】{listing.title}`

チャット一覧 `loadThreads()` は `transaction_rooms` を **listing_type フィルタなし**で全件取得 → マッチルームも一覧に出る（フィルタ UI は将来）。

### 1.3 期限・ステータスの挙動

`chat-room-status.js`:

- `expires_at` が過去 → lifecycle `expired`（送信不可）
- `status === 'cancelled'` → キャンセル扱い
- `expires_at` が空文字の場合 → 期限切れ判定は **スキップ**（`isExpiresAtPast` は false）

→ **D5 nullable 適用後**はマッチルームで `expires_at = NULL` が理想。適用前の workaround は遠い未来日時。

### 1.4 マッチから TALK へ遷移（UI モック現状）

`match-talk-bridge.html` → `../talk-home.html` または `chat-detail.html?room={id}`

**Edge 接続後の推奨:**

```
match-list / bridge
  → POST match-ensure-talk-room { matchPairId }
  → { talkRoomId, redirectUrl }
  → location.href = `/talk-home.html` または `/chat-detail.html?room=${talkRoomId}`
```

`talk-home` は既存のまま。マッチルームは `listing_type === 'match'` でバッジ表示（Phase 2 UI）。

---

## 2. TALK 接続設計（`match-ensure-talk-room`）

### 2.1 `match_pairs` からルームを作る方法

```
1. match_pairs を ID で取得（参加者検証）
2. talk_room_id が既にあれば transaction_rooms を SELECT して返す（idempotent）
3. なければ transaction_rooms INSERT:
     listing_type     = 'match'
     listing_id       = match_pairs.id::text
     title            = '【マッチ】' || {相手 nickname}
     buyer_id         = user_low_id
     seller_id        = user_high_id
     partner_id       = {相手 user_id}
     partner_display_name = {相手 nickname}
     partner_avatar_url   = {署名 URL または空}
     status           = 'active'
     expires_at       = NULL（nullable 後）| 遠い未来（nullable 前）
4. match_pairs.talk_room_id を UPDATE
5. { talkRoomId } を返す
```

**冪等性:** 同一 `match_pair_id` で再呼び出ししても同じ `room_id` を返す。

### 2.2 `listing_type = 'match'` の扱い

| 用途 | 方針 |
|------|------|
| DB 値 | `listing_type = 'match'` 固定文字列 |
| TALK UI | 既存 thread モデルは `listing.type` を参照 → バッジ「マッチ」表示（将来） |
| 取引フロー | 開始料・完了・キャンセル等の **Bench フローはスキップ**（`listing_type === 'match'` 分岐） |
| AI 監視 | 既存 `chat-service.moderateMessage` をそのまま利用 |

**Optional future（TALK JS、今回変更しない）:**

```javascript
// chat-detail.js / platform-chat-* — match ルームは取引ステートマシンを bypass
if (thread.listingType === 'match') { /* fee / complete UI off */ }
```

### 2.3 `match_pair_id` optional 列の必要性

| 方式 | メリット | デメリット |
|------|----------|------------|
| **A: 列なし（Phase 1）** | TALK テーブル非改変 | `listing_id = pair.id` で逆引きのみ |
| **B: 列あり（推奨 Phase 1.5）** | ルーム→ペアの一意逆引き、運営調査が容易 | ALTER 必要 |

**推奨:** Optional migration で `transaction_rooms.match_pair_id uuid` を追加。Phase 1 スタブは `listing_id` + `listing_type` のみでも可。

### 2.4 `expires_at` nullable（D5）

| 段階 | 投入値 |
|------|--------|
| nullable **前** | `'2099-12-31T23:59:59Z'` 等の定数 `MATCH_ROOM_FAR_FUTURE_EXPIRES_AT` |
| nullable **後** | `null`（期限なし。未使用ルーム整理は将来バッチ） |

`chat-room-status.js` は `expires_at` 空/null で期限切れにしないため、**nullable は TALK と整合**。

### 2.5 ブロック時の `transaction_rooms` 扱い

設計メモの `archived` は **TALK 既存 status に存在しない**。

| 推奨（TALK 互換） | 値 |
|-------------------|-----|
| ブロック時 | `status = 'cancelled'` |
| 送信 | `chat-room-status` が送信不可にする |

**Optional future migration / JS:**

- `status = 'archived'` を MATCH 専用に追加する場合は `chat-room-status.js` 拡張が必要 → **Phase 1 は `cancelled` を採用**

---

## 3. 共通エラーコード

| code | HTTP | 説明 |
|------|------|------|
| `MATCH_UNAUTHORIZED` | 401 | JWT なし / 無効 |
| `MATCH_FORBIDDEN` | 403 | 他人のリソース / 運営権限なし |
| `MATCH_NOT_FOUND` | 404 | pair / profile / room 不在 |
| `MATCH_VALIDATION_ERROR` | 400 | payload 不正 |
| `MATCH_CONFLICT` | 409 | 既スワイプ済み / 既ブロック |
| `MATCH_USER_BANNED` | 403 | 有効 sanctions あり |
| `MATCH_TARGET_BLOCKED` | 403 | ブロック関係で操作不可 |
| `MATCH_TARGET_NOT_VISIBLE` | 403 | 非公開 / 審査中プロフィール |
| `MATCH_DAILY_LIMIT_EXCEEDED` | 429 | いいね上限 |
| `MATCH_RATE_LIMITED` | 429 | 関数レート制限 |
| `MATCH_VERIFICATION_PENDING` | 403 | 本人確認未完了でスワイプ不可 |
| `MATCH_INTERNAL_ERROR` | 500 | 予期せぬ DB エラー |

---

## 4. Rate limit / Daily limit

| Function | Rate limit（案） | Daily limit |
|----------|------------------|-------------|
| `match-record-swipe` | 120 req / user / 10min | `likes` のみ `match_daily_limits`（JST 日付、default quota 10） |
| `match-submit-report` | 20 / user / day | — |
| `match-block-user` | 50 / user / day | — |
| `match-ensure-talk-room` | 60 / user / hour | — |
| `match-submit-verification` | 10 / user / day | — |
| `match-moderation-log` | 200 / user / hour | — |
| `match-admin-review` | 運営 IP + 1000 / day | — |

**実装:** Edge 内で `match_daily_limits` をトランザクション UPSERT。Redis 等は Phase 2。

**スーパーいいね:** Phase 1 は **未実装**（`action: 'super_like'` は `501` または `MATCH_NOT_IMPLEMENTED`）。スキーマ拡張は optional。

---

## 5. 監査ログ方針

| 層 | 内容 |
|----|------|
| `match_moderation_logs` | コンテンツ審査（warning/blocked） |
| Function stdout | `safeLog(event, { userId, pairId, reportId })` — PII・本文はマスク |
| `match_reports` / `match_sanctions` | 業務監査の正 |
| 将来 | `match_audit_events` テーブル（optional） |

**原則:** 通報 `detail`・身分証パス・`metadata_json` を Cloud Logs に出さない。

---

## 6. Function 別設計

---

### 6.1 `match-record-swipe`

| 項目 | 内容 |
|------|------|
| **目的** | いいね / スキップ記録、上限・安全ゲート、相互いいねで `match_pairs` 作成 |
| **認証** | JWT 必須（authenticated） |
| **service_role** | `match_swipes` INSERT、`match_daily_limits` UPSERT、`match_pairs` INSERT、競合時の再読込 |

#### 入力 payload

```json
{
  "targetUserId": "string (text, required)",
  "action": "like | skip",
  "superLike": false
}
```

| フィールド | validation |
|------------|------------|
| `targetUserId` | 非空、≠ 自分、存在する active profile |
| `action` | `like` \| `skip` |
| `superLike` | Phase 1 は `false` のみ許可 |

#### 出力 response

```json
{
  "ok": true,
  "data": {
    "swipeId": "uuid",
    "action": "like",
    "matched": false,
    "matchPairId": null,
    "likesRemaining": 7,
    "dailyQuota": 10
  }
}
```

相互マッチ時:

```json
{
  "matched": true,
  "matchPairId": "uuid",
  "talkRoomId": null
}
```

（TALK ルームは **本 Function では作らない**。`match-ensure-talk-room` に委譲。オプションで内部呼び出し可。）

#### 処理フロー

```
1. JWT → userId
2. 本人 profile: active, verified ゲート（設定による）
3. match_has_active_match_ban(userId) → 403
4. match_users_are_blocked(userId, targetUserId) → 403
5. target が match_profiles_public 条件を満たすか（service_role で確認）
6. 既存 match_swipes (userId, target) → 409
7. action=like → daily_limits チェック・increment（トランザクション）
8. INSERT match_swipes
9. action=like → 逆方向 like 存在確認
10. あれば INSERT match_pairs (user_low_id, user_high_id) ON CONFLICT DO NOTHING
11. レスポンス（matched フラグ）
```

#### 使用テーブル

`match_profiles`, `match_swipes`, `match_pairs`, `match_daily_limits`, `match_blocks`, `match_sanctions`

#### UI 接続ポイント（将来・UI 変更は別 PR）

| 画面 | 要素 | 接続 |
|------|------|------|
| `match-swipe.html` | いいね / スキップボタン | `data-match-api-swipe` + `MatchAPI.recordSwipe({ targetUserId, action })` |
| マッチモーダル | `matched === true` | `match-list.html` または `match-talk-bridge.html` へ |

---

### 6.2 `match-ensure-talk-room`

| 項目 | 内容 |
|------|------|
| **目的** | `match_pairs` に紐づく `transaction_rooms` を get-or-create |
| **認証** | JWT 必須。pair 参加者のみ |
| **service_role** | `transaction_rooms` INSERT/SELECT、`match_pairs.talk_room_id` UPDATE |

#### 入力 payload

```json
{
  "matchPairId": "uuid (required)"
}
```

#### 出力 response

```json
{
  "ok": true,
  "data": {
    "matchPairId": "uuid",
    "talkRoomId": "uuid",
    "created": true,
    "redirectUrl": "/chat-detail.html?room={talkRoomId}",
    "listingType": "match"
  }
}
```

#### validation

- pair 存在
- `userId in (user_low_id, user_high_id)`
- `pair.status = 'active'`（blocked なら 403）
- ブロック関係なし

#### UI 接続

| 画面 | 接続 |
|------|------|
| `match-talk-bridge.html` | CTA「TASFUL TALKで話す」→ `MatchAPI.ensureTalkRoom({ matchPairId })` → redirect |
| `match-list.html` | 行タップ時同様 |

---

### 6.3 `match-submit-report`

| 項目 | 内容 |
|------|------|
| **目的** | 通報作成、重大度タグ、関連モデレーションログ紐付け |
| **認証** | JWT 必須 |
| **service_role** | INSERT `match_reports`、INSERT `match_moderation_logs`（集約時） |

#### 入力 payload

```json
{
  "reportedUserId": "string",
  "reason": "inappropriate_message | impersonation | harassment | other",
  "detail": "string optional, max 2000",
  "contextType": "profile | swipe | chat",
  "contextId": "string optional",
  "matchPairId": "uuid optional",
  "talkRoomId": "uuid optional"
}
```

#### 出力 response

```json
{
  "ok": true,
  "data": {
    "reportId": "uuid",
    "status": "open",
    "severity": "normal | high",
    "message": "通報を受け付けました"
  }
}
```

**被通報者への通知:** なし。レスポンスに相手向け情報を含めない。

#### 重大度判定（Phase 1 ルール）

| 条件 | severity |
|------|----------|
| `reason in (impersonation, harassment)` | `high` |
| 同一 reported への通報が 24h 内 3 件以上 | `high` |
| 直近 `match_moderation_logs` に blocked | `high` |
| それ以外 | `normal` |

#### pair status について

現行スキーマに `reported` / `review` **なし**。

| Phase 1 | `match_reports` のみ。pair は `active` 維持 |
| Optional future | `match_pairs.status` に `under_review` 追加、または `match_pair_flags` テーブル |

#### UI 接続

| 画面 | 要素 |
|------|------|
| `match-report.html` | `data-report-submit` → `MatchAPI.submitReport(...)` |
| `match-swipe.html` | 通報モーダル → `match-report.html` または直接 API |

---

### 6.4 `match-block-user`

| 項目 | 内容 |
|------|------|
| **目的** | ブロック作成、pair を blocked、TALK ルーム停止 |
| **認証** | JWT 必須 |
| **service_role** | `match_blocks` UPSERT、`match_pairs` UPDATE、`transaction_rooms` UPDATE |

#### 入力 payload

```json
{
  "blockedUserId": "string",
  "source": "swipe | profile | chat | report",
  "matchPairId": "uuid optional"
}
```

#### 出力 response

```json
{
  "ok": true,
  "data": {
    "blockId": "uuid",
    "message": "ブロックしました"
  }
}
```

**被ブロック者:** 通知なし。相手の API レスポンスにブロック事実を返さない（候補から消えるのみ）。

#### 処理

```
1. INSERT match_blocks (active) ON CONFLICT → reactivate
2. IF match_pair exists:
     UPDATE match_pairs SET status='blocked', blocked_by_user_id=userId
3. IF talk_room_id exists:
     UPDATE transaction_rooms SET status='cancelled'  -- TALK 互換
4. （通知送信なし）
```

#### UI 接続

| 画面 | 要素 |
|------|------|
| `match-swipe.html` | `data-match-block-confirm` |
| `match-block.html` | 解除は client UPDATE `archived_at`（RLS）または将来 `match-unblock-user` |

---

### 6.5 `match-submit-verification`

| 項目 | 内容 |
|------|------|
| **目的** | 本人確認申請（電話 / 身分証）。Phase 1 は手動審査キュー投入 |
| **認証** | JWT 必須 |
| **service_role** | INSERT `match_verifications`、UPDATE `match_profiles.verification_status` → `pending` |

#### 入力 payload

```json
{
  "verificationType": "phone | identity_document | composite",
  "phoneVerified": true,
  "idDocumentType": "drivers_license | mynumber | passport | residence_card",
  "idDocumentStoragePath": "string (Storage path, server-side validated)",
  "clientSubmittedAt": "iso8601 optional"
}
```

**client は `metadata_json` を送らない。** Edge がサーバー側で組み立て:

```json
{
  "phase": "manual_review",
  "submitted_from": "match-verify.html",
  "ekyc": {
    "provider": null,
    "session_id": null,
    "vendor_payload": null
  },
  "document": {
    "type": "drivers_license",
    "storage_path": "...",
    "uploaded_at": "..."
  }
}
```

#### 出力 response（client 向け）

```json
{
  "ok": true,
  "data": {
    "verificationId": "uuid",
    "status": "submitted | under_review",
    "profileVerificationStatus": "pending"
  }
}
```

**含めない:** `metadata_json`, `phone_hash`, `id_document_storage_path`（パスは返さない。ステータスのみ）

#### UI 接続

| 画面 | 要素 |
|------|------|
| `match-verify.html` | `data-verify-next` → `MatchAPI.submitVerification(...)` |

---

### 6.6 `match-admin-review`

| 項目 | 内容 |
|------|------|
| **目的** | 運営: 本人確認承認/却下、通報更新、BAN 付与 |
| **認証** | JWT + `match_admin` ロール **または** 内部サービスキー（バックオフィスのみ） |
| **service_role** | 全 WRITE |

#### 入力 payload（action 分岐）

```json
{
  "action": "verify_approve | verify_reject | report_update | sanction_create | sanction_revoke",
  "targetUserId": "string",
  "verificationId": "uuid",
  "reportId": "uuid",
  "reportStatus": "reviewing | resolved | dismissed",
  "sanctionType": "warning | feature_restrict | temporary_ban | permanent_ban",
  "endsAt": "iso8601 optional",
  "reasonCode": "string",
  "reasonDetail": "string internal"
}
```

#### 出力 response

```json
{
  "ok": true,
  "data": {
    "action": "verify_approve",
    "updated": { "verificationId": "...", "profileVerificationStatus": "verified" }
  }
}
```

#### 主な副作用

| action | DB |
|--------|-----|
| `verify_approve` | `match_verifications.status=approved`, `match_profiles.verification_status=verified` |
| `verify_reject` | `rejected` + `reject_reason` |
| `report_update` | `match_reports.status` |
| `sanction_create` | INSERT `match_sanctions`, 必要なら `profile_status=suspended` |
| `sanction_revoke` | `match_sanctions.revoked_at` |

**UI:** 運営ダッシュボード（未実装）。MATCH モック UI には接続しない。

---

### 6.7 `match-moderation-log`

| 項目 | 内容 |
|------|------|
| **目的** | ルール / AI 監視結果を `match_moderation_logs` に記録 |
| **認証** | JWT（本人コンテンツ）または **内部のみ** service（チャット連携） |
| **service_role** | INSERT |

#### 入力 payload

```json
{
  "contentType": "profile_bio | profile_photo | chat_message",
  "contentRef": "string",
  "inputText": "string optional",
  "level": "ok | warning | blocked",
  "reasons": ["phone", "line"],
  "allowed": true,
  "engine": "rules | ai",
  "relatedUserId": "string optional"
}
```

#### 出力

```json
{ "ok": true, "data": { "logId": "uuid" } }
```

#### 導線

| 呼び出し元 | タイミング |
|------------|------------|
| プロフィール保存 Edge（将来 `match-profile-publish`） | bio / 写真 |
| `match-submit-report` | 通報時のコンテキストスナップショット |
| TALK `chat-service` 連携（将来） | `listing_type=match` ルーム送信前。既存 `moderation_logs` と併用可 |

**Phase 1:** `engine = 'rules'` のみ（`chat-moderation.js` ロジックを Deno 移植）。

---

## 7. 追加 Edge Function（設計メモ・Phase 1 スタブ対象外でも可）

| Function | 用途 |
|----------|------|
| `match-get-candidates` | `match_profiles_public` 相当を Edge から返す（ページング） |
| `match-list-pairs` | マッチ一覧 + TALK 最終メッセージ join |
| `match-unblock-user` | ブロック解除 + pair 復帰（任意） |
| `match-profile-publish` | 公開 + bio モデレーション |

UI モック接続の優先は **swipe / talk / report / block / verify**。

---

## 8. Optional future migrations（今回適用しない）

```sql
-- transaction_rooms: D5 nullable + match 逆引き
-- alter table public.transaction_rooms alter column expires_at drop not null;
-- alter table public.transaction_rooms add column match_pair_id uuid references match_pairs(id);

-- match_pairs: 通報レビュー状態
-- alter table public.match_pairs add column review_status text;
--   check (review_status in ('none','under_review','cleared'));

-- match_swipes: スーパーいいね
-- alter table public.match_swipes add column is_super_like boolean default false;

-- match_audit_events: 運営監査
-- create table public.match_audit_events (...);
```

---

## 9. 実装順（スタブ → 本番）

| 順 | Function | 理由 |
|----|----------|------|
| 1 | `_shared/match-auth.ts`, `_shared/match-errors.ts` | 共通 |
| 2 | `match-moderation-log` | 他 Function から利用 |
| 3 | `match-record-swipe` | コアループ |
| 4 | `match-ensure-talk-room` | マッチ → TALK |
| 5 | `match-block-user` | 安全 |
| 6 | `match-submit-report` | 安全 |
| 7 | `match-submit-verification` | ゲート |
| 8 | `match-admin-review` | 運営（staging のみ） |

**スタブ段階:** 各 `index.ts` は payload 検証 + mock JSON 返却 + `501` 未接続 DB でも可。

---

## 10. UI 接続マップ（`match-api.js` 将来・data 属性）

| data 属性 / API | ページ | Function |
|-----------------|--------|----------|
| `MatchAPI.recordSwipe` | `match-swipe.html` | `match-record-swipe` |
| `MatchAPI.ensureTalkRoom` | `match-talk-bridge.html`, `match-list.html` | `match-ensure-talk-room` |
| `MatchAPI.submitReport` | `match-report.html`, swipe 通報 | `match-submit-report` |
| `MatchAPI.blockUser` | `match-swipe.html` | `match-block-user` |
| `MatchAPI.unblockUser` | `match-block.html` | client RLS or `match-unblock-user` |
| `MatchAPI.submitVerification` | `match-verify.html` | `match-submit-verification` |
| `MatchAPI.getCandidates` | `match-swipe.html` | `match-get-candidates`（将来） |
| `MatchAPI.listPairs` | `match-list.html` | `match-list-pairs`（将来） |

**新規 data 属性案（UI 変更時）:**

- `data-match-api-swipe="{action}"`
- `data-match-api-talk-room`
- `data-match-api-report`
- `data-match-api-block`
- `data-match-api-verify`

現行モックの `data-report-submit` 等は **MatchAPI 呼び出しに差し替え**可能な位置として維持。

---

## 11. 危険ポイント

| # | リスク | 緩和 |
|---|--------|------|
| 1 | 相互いいねの二重 pair | `UNIQUE (user_low_id, user_high_id)` + トランザクション |
| 2 | `expires_at NOT NULL` でマッチルームが期限切れ | 遠い未来 workaround → nullable migration |
| 3 | 取引チャット UI がマッチルームに誤適用 | `listing_type === 'match'` 分岐（TALK JS・将来） |
| 4 | service_role 漏洩 | Edge のみ。クライアント禁止 |
| 5 | 通報 / ブロック情報漏洩 | レスポンス最小化 |
| 6 | `metadata_json` 漏洩 | Edge のみ保持。client レスポンス除外 |
| 7 | admin Function の公開 | `match_admin` claim + staging 限定デプロイ |

---

## 12. 適用前確認

| # | 項目 |
|---|------|
| 1 | schema + RLS migration を staging 適用済みか |
| 2 | `auth.uid()::text` と `user_id` の一致 |
| 3 | `transaction_rooms.expires_at` nullable の要否と日程 |
| 4 | ブロック時 room status: **`cancelled` 採用**の合意 |
| 5 | スーパーいいね Phase 1 スコープ外の合意 |
| 6 | `match_admin` JWT claim の定義 |

---

## 13. 未決事項と推奨デフォルト

| ID | 論点 | 推奨 |
|----|------|------|
| E1 | ブロック時 TALK room status | **`cancelled`**（既存 TALK 互換） |
| E2 | `match_pair_id` 列 | Phase 1.5 で追加。スタブは `listing_id` のみ |
| E3 | 通報時 pair status | Phase 1 は **変更しない** |
| E4 | スーパーいいね | **Phase 2** |
| E5 | マッチルームの取引 UI | **`listing_type=match` で bypass**（TALK JS は別 PR） |

E1–E5 は推奨デフォルトで **スタブ実装に進める**。

---

## 14. 判定

| チェック | 結果 |
|----------|------|
| 7 Function の payload / response / 認証 / テーブル | OK |
| service_role 分離 | OK |
| TALK 現状確認と接続方針 | OK |
| client 禁止事項の反映 | OK |
| UI 接続ポイント整理 | OK |
| Optional migration の分離 | OK |

### 総合判定

```
READY_FOR_EDGE_FUNCTION_STUB
```

次ステップ: `supabase/functions/match-*/index.ts` スタブ（検証 + mock 応答）と `_shared/match-auth.ts` 草案。DB 接続は staging migration 適用後。

---

## 15. 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| v1.0 | 2026-06-21 | 初版（Edge Function 設計レビュー） |
