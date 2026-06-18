# TASFUL TALK 通話 — Final Release Review（Phase7.2）

**日付:** 2026-06-17  
**レビュー種別:** Web Push 本番接続チェック / 通話機能 最終判定  
**credential 記載:** **なし**（本レポートに VAPID 秘密鍵・TURN credential は含めない）

---

## 総合判定: **WARNING**

**TALK 1:1 音声通話は限定公開可能。フル本番（背景 Web Push + 厳格 NAT 対応）は未完了。**

| 観点 | 判定 | 理由 |
|------|------|------|
| Phase1〜4 コア通話 | ✅ 投入可（限定） | E2E 全 PASS。foreground 着信・応答・履歴動作 |
| Phase5 TURN | ⚠️ STUN のみ | TURN env 未設定。厳格 NAT 下は relay 未検証 |
| Phase6〜7 Push 基盤 | ✅ コード完成 | enqueue / RLS / SW / Edge 実装済 |
| Phase7.1 Web Push 実送信 | ⚠️ **未接続** | DB migration 7.1 未適用・Edge 404・VAPID 未投入 |
| 実機 Web Push | ⬜ 未確認 | 本レビュー環境で実機検証不可 |
| credential 漏洩 | ✅ 問題なし | コード / DB サンプル / Edge 応答を確認 |

### 判定マトリクス

| シナリオ | 判定 |
|----------|------|
| フォアグラウンド通話のみ（通知センター着信） | **WARNING → 限定 GO** |
| 背景 Web Push 着信込みのフル本番 | **FAIL → 接続作業が必要** |
| TURN 込み厳格 NAT 本番 | **FAIL → TURN 投入 + relay 検証が必要** |

---

## Phase1〜7.1 完了状況

| Phase | 内容 | コード | テスト | 本番接続 |
|-------|------|--------|--------|----------|
| **1** | 1:1 音声 · シグナリング · overlay UI | ✅ | ✅ PASS | ✅ DB/RLS 適用済 |
| **2** | chat-detail 連携 · 📞 発信 | ✅ | ✅ PASS | ✅ |
| **3** | talk-home 通知センター着信 | ✅ | ✅ PASS | ✅ |
| **4** | 通話履歴 UI | ✅ | ✅ PASS | ✅ |
| **5** | ICE/TURN 設定レイヤー | ✅ | ✅ PASS | ⚠️ TURN 未投入 |
| **5.5** | TURN preflight | — | WARNING | STUN-only 継続 |
| **5.6** | TURN hardening / debug lock | ✅ | ✅ PASS | ✅ |
| **6** | Push event 設計 · enqueue | ✅ | ✅ PASS | ✅ 基盤テーブルあり |
| **7** | SW · subscription · Edge ガード | ✅ | ✅ PASS | ⚠️ 本番 RLS 想定 |
| **7.1** | web-push 実送信 · VAPID secrets | ✅ | ✅ PASS | ❌ **未 deploy / 未 migration** |
| **7.2** | 本番接続チェック（本レビュー） | — | ✅ 回帰 PASS | 本レポート |

---

## 1. DB / RLS 状態

### 1.1 テーブル到達性（linked Supabase · 2026-06-17 プローブ）

| テーブル | 到達 | 備考 |
|----------|------|------|
| `talk_call_push_events` | ✅ 200 | Phase6 スキーマ適用済 |
| `talk_push_subscriptions` | ✅ 200 | Phase6 スキーマ適用済 |
| `talk_current_user_id()` RPC | ✅ | RLS ヘルパー利用可 |

### 1.2 Phase7.1 migration — **未適用**

プローブ: `retry_eligible` / `talk_push_subscriptions.status` カラム SELECT → **400**

| カラム | 期待 | 状態 |
|--------|------|------|
| `talk_call_push_events.retry_eligible` | boolean | ❌ **未適用** |
| `talk_push_subscriptions.status` | active/inactive | ❌ **未適用** |

**必要アクション:**

```powershell
node scripts/apply-talk-call-push-supabase.mjs
```

（`sql/talk-call-push-phase71-migration.sql` を含む）

### 1.3 RLS ポリシー（ソースレビュー + Phase7 適用記録）

[`sql/talk-call-push-rls-production.sql`](../sql/talk-call-push-rls-production.sql) より:

| リソース | ポリシー | 要件 | ソース |
|----------|----------|------|--------|
| `talk_call_push_events` SELECT | `talk_call_push_events_select_callee` | callee + admin のみ | ✅ |
| `talk_call_push_events` INSERT | `talk_call_push_events_insert_caller` | caller · ringing セッションのみ | ✅ |
| `talk_call_push_events` UPDATE | `talk_call_push_events_update_participant` | caller/callee/admin | ✅ |
| `talk_push_subscriptions` ALL | `talk_push_subscriptions_own` | 本人 + admin のみ | ✅ |

dev ポリシー (`*_dev`) は production SQL で drop 済み定義。

**ライブ RLS 実効性:** service role プローブのみ。JWT ユーザー別の deny テストは本 Phase では未実施（Phase7 DB integration で enqueue 整合は PASS）。

---

## 2. Edge Function deploy 状態

### 2.1 デプロイ — **未デプロイ**

| 項目 | 結果 |
|------|------|
| URL | `{SUPABASE_URL}/functions/v1/talk-call-push-notify` |
| HTTP status | **404** |
| 判定 | **未 deploy** |

**必要アクション:**

```powershell
supabase functions deploy talk-call-push-notify --no-verify-jwt
```

### 2.2 実装レビュー（ソース · deploy 前でも確認済）

[`supabase/functions/talk-call-push-notify/index.ts`](../supabase/functions/talk-call-push-notify/index.ts)

| 要件 | ソース |
|------|--------|
| VAPID 未設定 → `skipped` | ✅ `isVapidConfigured` |
| pending のみ処理 | ✅ `delivery_status=eq.pending` |
| ringing ガード | ✅ `evaluateSessionGuard` |
| web-push 送信 | ✅ `webpush.sendNotification` |
| 410/404 → subscription `inactive` | ✅ `markSubscriptionInactive` |
| sent / failed / skipped 更新 | ✅ `patchEvent` |
| credential ログ禁止 | ✅ `safeLog` + `FORBIDDEN_LOG_KEYS` |

### 2.3 VAPID secrets — **未投入（推定）**

Edge 404 のため live `sent` 検証不可。secrets 名（値は記載しない）:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`

投入手順: [`docs/talk-call-web-push-deploy.md`](../docs/talk-call-web-push-deploy.md)

---

## 3. Client config 確認

### 3.1 公開鍵のみ（ソースレビュー）

| 確認 | 結果 |
|------|------|
| `webPushVapidPublicKey` 対応 | ✅ [`scripts/talk-push-subscribe.js`](../scripts/talk-push-subscribe.js) |
| クライアントに private key 文字列なし | ✅ |
| `WEB_PUSH_VAPID_PRIVATE` クライアント参照なし | ✅ |
| 設定例は placeholder のみ | ✅ [`chat-supabase-config.example.js`](../chat-supabase-config.example.js) |

本番 HTML への公開鍵注入: **未確認**（デプロイ環境依存 · リポジトリには secret なし）

### 3.2 Service Worker scope

| SW | パス | scope | 衝突 |
|----|------|-------|------|
| TALK | `/talk-service-worker.js` | `/` | — |
| Builder PWA | `/builder/service-worker.js` | `/builder/`（相対 `./`） | **なし**（最長一致で分離） |

### 3.3 統合ポイント

- talk-home: `TasuTalkPushSubscribe.trySyncSubscription()`（notify-bridge init）
- chat-detail: 同上（chat-detail init）
- permission `default`/`denied`: **requestPermission しない**（Phase7 仕様維持）

---

## 4. 実機 / ブラウザ確認

**本レビュー環境では実機・実ブラウザ Push E2E は実施していない。** 以下は設計・単体テストに基づく記録。

| 環境 | Web Push 着信 | Push tap → chat-detail | Phase2 overlay 応答 | 状態 |
|------|---------------|--------------------------|----------------------|------|
| Chrome PC | ⬜ 未確認 | ⬜ 未確認 | ✅ E2E（Playwright） | 自動テストのみ |
| Android Chrome | ⬜ 未確認 | ⬜ 未確認 | ⬜ 未確認 | **要実機** |
| iPhone Safari | ⚠️ 制限あり | ⬜ 未確認 | ⬜ 未確認 | **PWA ホーム追加時のみ Web Push 可（iOS 16.4+）** |
| iPhone 通常 Safari タブ | ❌ 非対応想定 | — | foreground notify は可 | 設計上の制約 |

### foreground 着信（Phase3）— 自動 E2E PASS

- A 発信 → B 通知センター着信カード ✅
- タップ → chat-detail + incoming overlay ✅
- 応答 / 拒否 / 終了 ✅
- pending event キャンセルロジック: ソース + unit ✅（live Push なし）

---

## 5. セキュリティ確認

| 項目 | 方法 | 結果 |
|------|------|------|
| payload に email/phone/token/credential/payment/role なし | unit + forbidden keys | ✅ |
| DB payload サンプル（5件） | service role プローブ | ✅ 0件 · clean |
| DB に VAPID private key 保存なし | スキーマレビュー | ✅ カラムなし |
| Edge ログに private key なし | `safeLog` ソースレビュー | ✅ |
| Edge 応答に secret なし | 404 のため N/A | — |
| notification body 秘匿なし | SW 単体テスト | ✅ 表示名のみ |
| TURN credential リポジトリ露出 | grep | ✅ 例・env 名のみ |
| 本レポート credential 記載 | 目視 | ✅ **なし** |

---

## 6. TURN 状態

| 項目 | 状態 |
|------|------|
| デフォルト STUN | `stun:stun.l.google.com:19302` |
| TURN env | **未設定** |
| `turnEnabled` | false |
| relay candidate テスト | SKIP PASS |
| 厳格 NAT 本番 | **未検証** |

TURN 投入チェックリスト: [`docs/talk-call-turn-production-checklist.md`](../docs/talk-call-turn-production-checklist.md)

---

## 7. Push 状態（サマリー）

| レイヤ | 状態 |
|--------|------|
| enqueue（ringing → DB event） | ✅ 実装 · DB integration PASS |
| Edge 実送信 | ❌ 未 deploy |
| VAPID | ❌ 未投入 |
| Phase7.1 DB カラム | ❌ 未 migration |
| SW 本番文言 | ✅ 「音声通話の着信」 |
| subscription upsert | ✅ コード完成（VAPID + granted 時） |
| 410/404 cleanup | ✅ Edge コード完成 · live 未検証 |
| 背景 Push E2E | ⬜ **未確認** |

---

## 8. 回帰テスト結果（2026-06-17 · `SUPABASE_STRICT=1`）

| テスト | 結果 |
|--------|------|
| `test-talk-call-push-delivery.mjs` | **PASS** |
| `test-talk-call-push-notification-design.mjs` | **PASS** |
| `test-talk-call-service-worker.mjs` | **PASS** |
| `test-talk-webrtc-call-browser.mjs` | **PASS** |
| `test-talk-call-chat-detail.mjs` | **PASS** |
| `test-talk-call-notification-center.mjs` | **PASS** |
| `test-talk-call-history-ui.mjs` | **PASS** |
| `test-talk-call-turn-config.mjs` | **PASS** |
| `test-talk-call-relay-candidate.mjs` | **SKIP PASS**（TURN 未設定） |

**エラー数: 0**

---

## 9. 残件（本番 GO 前）

### 必須（背景 Web Push を有効にする場合）

1. ☐ Phase7.1 DB migration 適用
2. ☐ VAPID secrets 3 件設定（値は Dashboard/CLI のみ）
3. ☐ Edge Function deploy
4. ☐ クライアントに **公開鍵のみ** 設定
5. ☐ Chrome PC で Push 着信 E2E 1 回
6. ☐ Android Chrome 実機 1 回
7. ☐ iOS は PWA 前提で対応可否を運用ドキュメント化

### 推奨（フル本番品質）

8. ☐ TURN 投入 + relay candidate 実機確認
9. ☐ Edge deploy 後 `sent` / `failed` / `inactive` live 確認
10. ☐ JWT ユーザー別 RLS deny テスト（caller が push event を読めない等）
11. ☐ DB Webhook: push_events INSERT → Edge 自動 invoke

### 対象外（今回スコープ外）

- ビデオ通話
- Push permission UI 大改修
- TURN credential の変更

---

## 10. 本番投入条件

### A. 限定公開 GO（現時点で満たす条件）

- [x] Phase1〜4 E2E PASS
- [x] foreground 着信（通知センター）動作
- [x] credential コード / DB 漏洩なし
- [x] STUN-only で同一ネットワーク / 緩い NAT 向け
- [ ] 運用チームが「背景 Push なし · TURN なし」を理解

### B. フル本番 GO（未達）

- [ ] Phase7.1 migration 適用
- [ ] Edge deploy + VAPID secrets
- [ ] 実機 Web Push E2E（最低 Chrome PC + Android 各 1）
- [ ] TURN 投入 + relay 検証（厳格 NAT 必須の場合）
- [ ] pending event が terminal で残らない live 確認

---

## 11. 参照

| ドキュメント | 用途 |
|--------------|------|
| [`docs/talk-call-web-push-deploy.md`](../docs/talk-call-web-push-deploy.md) | VAPID · deploy · rollback |
| [`docs/talk-call-turn-production-checklist.md`](../docs/talk-call-turn-production-checklist.md) | TURN 投入 |
| [`reports/talk-call-phase7-1-web-push-delivery.md`](talk-call-phase7-1-web-push-delivery.md) | Phase7.1 実装 |
| [`scripts/probe-talk-call-phase72-review.mjs`](../scripts/probe-talk-call-phase72-review.mjs) | 本レビュー用プローブ |

---

## 12. 結論

**TASFUL TALK 1:1 音声通話**は、コード品質・自動回帰・セキュリティ設計の観点では **Phase7.1 まで完成**している。

ただし **Web Push 本番接続**（Phase7.1 migration · Edge deploy · VAPID · 実機）は **未完了**のため、総合判定は **WARNING** とする。

- **今すぐ可能:** 限定ロールアウト（foreground 着信 · STUN-only · 背景 Push なしと明記）
- **フル本番:** 残件 §9 完了後に **PASS** へ再判定

**本レポートに private key / TURN credential は記載していない。**
