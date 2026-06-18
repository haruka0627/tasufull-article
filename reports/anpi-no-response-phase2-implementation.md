# 安否未応答フロー — Phase2 実装レポート

**作成日:** 2026-06-17  
**種別:** 実装完了  
**前提:** RELEASE FROZEN 維持 · WebRTC Phase1 LOCK · AI音声 Phase1 LOCK · `chat-detail.html` 未変更

**関連資料:**

- [`anpi-no-response-phase2-design.md`](anpi-no-response-phase2-design.md)
- [`anpi-no-response-design-review.md`](anpi-no-response-design-review.md)
- [`talk-webrtc-call-phase1-implementation.md`](talk-webrtc-call-phase1-implementation.md)

---

## 1. エグゼクティブサマリー

安否未応答 Phase2 を **最小縦切り** で実装した。本人確認後のタイムアウト → `no_response` → 家族 TALK 通知 → ダッシュボード 3 CTA → WebRTC 橋渡し / 運営相談（`official_anpi`）の流れが動作する。

**禁止事項遵守:** `nr-remind` / `nr-call` / `tel:` / Twilio / WebRTC 本体 / AI音声 / `chat-detail.html` は **未変更**。

**Phase2 LOCK 判定:** ✅ **LOCK 可**（E2E・回帰 PASS、Supabase 適用済み）

---

## 2. 変更ファイル一覧

### 新規

| ファイル | 役割 |
|----------|------|
| `sql/anpi-no-response-phase2-schema.sql` | `anpi_check_sessions` / `anpi_no_response_audit_log` |
| `sql/anpi-no-response-phase2-rls.sql` | dev 全許可 + 本番ポリシー + Realtime publication |
| `scripts/anpi-no-response-service.js` | 状態機械・Supabase CRUD・LS フォールバック |
| `scripts/anpi-no-response-notify.js` | 家族向け TALK 通知生成 |
| `scripts/anpi-talk-call-bridge.js` | WebRTC 発信 URL 橋渡し / 運営相談導線 |
| `scripts/apply-anpi-no-response-phase2-supabase.mjs` | SQL 適用 |
| `scripts/test-anpi-no-response-phase2-browser.mjs` | Phase2 E2E |
| `reports/anpi-no-response-phase2-implementation.md` | 本レポート |

### 既存（最小修正）

| ファイル | 変更内容 |
|----------|----------|
| `anpi-notify-cards.js` | 3 CTA 差替え、Phase2 セッション merge、ポーリング |
| `anpi-dashboard.html` | Phase2 スクリプト 3 本追加 |
| `talk-home.html` | bridge + service 追加（WebRTC 後） |
| `talk-anpi-notify-master-v1.js` | 未応答通知文言更新 |
| `scripts/test-anpi-notify-dashboard-verify.mjs` | 新 CTA 検証 |
| `scripts/test-anpi-notify-dashboard-actions.mjs` | 新 CTA 検証 |

---

## 3. DB スキーマ

### `anpi_check_sessions`

| 列 | 用途 |
|----|------|
| `id` | anpi_check_id (uuid PK) |
| `target_user_id` | 利用者 |
| `contract_holder_id` | 契約者 |
| `status` | 状態機械（下記） |
| `target_user_name` / `relation` | 表示用 |
| `check_sent_at` / `response_deadline_at` | 本人確認 1 回 + 期限 |
| `no_response_at` / `family_notified_at` | 未応答・家族通知 |
| `handled_at` / `handled_by` / `action_type` | CTA 結果 |
| `metadata` | 拡張（timeout_ms 等） |

**重複防止:** `(target_user_id) WHERE status IN (pending, sent_to_user, no_response, family_notified)` unique index

### `anpi_no_response_audit_log`

| 列 | 用途 |
|----|------|
| `anpi_check_id` | FK |
| `actor_user_id` | 操作者 |
| `action_type` | `confirmed` / `talk_call_initiated` / `ops_consult` / `status_change` / `family_notified` |
| `payload` | jsonb |

**Supabase 適用:** `node scripts/apply-anpi-no-response-phase2-supabase.mjs` — **2026-06-17 適用済み**（linked project）

---

## 4. 状態遷移

```
pending → sent_to_user → answered（本人回答）
                      ↘ no_response（期限切れ・再通知なし）
                         → family_notified（TALK 通知 1 回）
                            → handled（状況を確認した）
                            → escalated（運営に相談）
                            → family_notified（TALKで通話 — 状態維持 + audit のみ）
```

**終端:** `answered` / `handled` / `escalated` / `expired`

**タイマー:** クライアント `processDueTimeouts()` ポーリング（本番は Edge cron 化推奨）。デフォルト **2 時間**、`window.__ANPI_NO_RESPONSE_TIMEOUT_MS__` で上書き可。

---

## 5. CTA 動作

| CTA | action | 動作 |
|-----|--------|------|
| **状況を確認した** | `nr-confirmed` | `status → handled`、`handled_at/by`、`action_type=confirmed`、audit INSERT |
| **TALKで通話する** | `nr-talk-call` | `anpi-talk-call-bridge` URL → `talk-home` → ephemeral direct thread → `TasuTalkCallService.initiateCall`（契約者→利用者） |
| **運営に相談する** | `nr-ops-consult` | `status → escalated`、`action_type=ops_consult`、audit INSERT → `official_anpi` ルーム + composer 下書き |

**廃止（UI から削除）:** `nr-remind` / `nr-call` / `tel:`

---

## 6. WebRTC 連携

- **新規:** `scripts/anpi-talk-call-bridge.js` のみ
- **発信 API:** 既存 `TasuTalkCallService.initiateCall(thread)` — **本体未変更**
- **thread:** ephemeral `{ id: anpi-direct-{target}, threadKind: "direct", partnerUserId }`
- **URL 例:** `talk-home.html?userId=u_me&tab=chat&anpiCallTarget=u_store&anpiCallAuto=1&checkId=...`
- **疎結合:** `talk_call_sessions` スキーマ変更なし。`anpi_check_id` は audit / bridge metadata のみ

---

## 7. localStorage / Supabase 分離

| データ | デモ | 本番 |
|--------|------|------|
| ダッシュボード UI デモ | `tasful_anpi_notify_demo_v1` 維持 | Phase2 行は DB hydrate |
| チェックセッション | `tasu_anpi_check_sessions_v1`（mock） | `anpi_check_sessions` |
| 監査 | `tasu_anpi_no_response_audit_v1`（mock） | `anpi_no_response_audit_log` |
| 通話状態 | — | `talk_call_sessions`（既存 WebRTC） |

Mock 有効: `localStorage tasu_anpi_no_response_phase2_mock_v1=1` または `window.__ANPI_NO_RESPONSE_MOCK__`

---

## 8. テスト結果

| テスト | 結果 |
|--------|------|
| `node scripts/test-anpi-no-response-phase2-browser.mjs` | **PASS** |
| `node scripts/test-talk-webrtc-call-browser.mjs` | **PASS**（回帰） |
| `node scripts/test-voice-settings-browser.mjs` | **PASS**（回帰） |

**Phase2 E2E 検証項目:**

- ✅ `no_response` 作成（timeout）
- ✅ `family_notified` + TALK 通知
- ✅ 3 CTA 表示
- ✅ 状況を確認した → `handled` + audit
- ✅ TALK bridge URL → WebRTC 導線
- ✅ 運営に相談 → `official_anpi` + `escalated` + audit
- ✅ `nr-remind` / `nr-call` / `tel:` 非表示

---

## 9. Phase2 LOCK 可否

| 観点 | 判定 |
|------|------|
| 設計準拠 | ✅ |
| 禁止事項 | ✅ |
| WebRTC / AI 回帰 | ✅ PASS |
| Supabase スキーマ | ✅ 適用済み |
| E2E | ✅ PASS |
| RELEASE FROZEN | ✅ 限定解凍のみ |

### **Phase2 LOCK: ✅ 可**

**残課題（Phase3 以降）:**

- Edge Function `anpi-check-timeout` + cron（クライアントポーリングからの移行）
- 本番 RLS: dev ポリシー削除 → `anpi-rls-production.sql` 連携確認
- 複数緊急連絡先
- 運営 Hub / admin-ai 深い接続

---

## 10. 運用メモ

```bash
# SQL 適用
node scripts/apply-anpi-no-response-phase2-supabase.mjs

# E2E
node scripts/test-anpi-no-response-phase2-browser.mjs

# 短い timeout で手動確認
# ブラウザ console: window.__ANPI_NO_RESPONSE_TIMEOUT_MS__ = 3000
```

**手動確認フロー:**

1. `TasuAnpiNoResponseService.createAndDispatchCheck({ targetUserId:'u_store', contractHolderId:'u_me', targetUserName:'田中一郎', timeoutMs:3000 })`
2. 3 秒後 `TasuAnpiNoResponseService.processDueTimeouts()`
3. `anpi-dashboard.html#no-response` で 3 CTA 確認
