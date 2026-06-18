# TASFUL TALK 通話 Phase2 — chat-detail 連携

**作成日:** 2026-06-17  
**Epic:** TALK WebRTC 1:1 音声通話 Phase2（chat-detail 連携）  
**前提:** [Phase1 実装状況](talk-call-feature-status.md) · [Phase1 設計](talk-webrtc-call-mvp-design.md)

---

## サマリー

| 項目 | 結果 |
|------|------|
| **chat-detail から 1:1 音声発信** | ✅ 実装済 |
| **同一ルーム着信 overlay（フォアグラウンド）** | ✅ 実装済 |
| **応答 / 拒否 / 切断** | ✅ Phase1 コア再利用 |
| **390px ヘッダー崩れ** | ✅ E2E 確認 |
| **Phase1 回帰** | ✅ `SUPABASE_STRICT=1 test-talk-webrtc-call-browser.mjs` PASS |
| **Phase2 E2E** | ✅ `SUPABASE_STRICT=1 test-talk-call-chat-detail.mjs` PASS |
| **TURN / Push / ビデオ / 通話履歴 UI** | ⬜ 対象外（未実装のまま） |

---

## 1. 実装範囲

### 1.1 UI（最小変更）

| ファイル | 変更内容 |
|----------|----------|
| [`chat-detail.html`](../chat-detail.html) | `talk-call.css` + Phase1 通話 script 5 本 load。SP 用 `chat-mobile-head__slot--end` と PC 用 `chat-peer-header__actions` に 📞 ボタン（`data-talk-call-start-button`, `aria-label="音声通話を開始"`） |
| [`talk-call.css`](../talk-call.css) | chat-detail ヘッダー通話ボタン。SP（≤640px）では mobile head のみ表示、PC では peer header のみ表示 |
| [`chat-detail.js`](../chat-detail.js) | `setHeader()` 末尾で `TasuTalkCallChatDetail.syncFromThread(row)` を 1 行追加 |

### 1.2 連携ブリッジ（新規）

| ファイル | 責務 |
|----------|------|
| [`scripts/talk-call-chat-detail.js`](../scripts/talk-call-chat-detail.js) | アクティブ thread 保持 · `buildCallThread` · 通話ボタン表示制御 · クリックで `initiateCall` · `getActiveRoomId` / `getActiveThread`（ルームスコープ着信フィルタ用） |

**ボタン表示条件（`canCallThread` + chat-detail 側）**

- 1:1 ルームのみ（buyer/seller または partner 解決可能）
- 相手ユーザーが自分以外
- 公式 / system / グループ / static card / 自分自身ルームは非表示
- `currentUser` 未取得時は非表示
- Supabase 未接続時は非表示（demo / localStorage モードでは既存チャット体験を維持）

### 1.3 コア拡張

| ファイル | 変更内容 |
|----------|----------|
| [`scripts/talk-call-service.js`](../scripts/talk-call-service.js) | `getActiveCallRoomId` / `matchesActiveCallContext` による **同一ルーム着信のみ** overlay。`buildCallThreadFromAny` で chat-detail thread 正規化。`refreshIncomingForActiveRoom`（poll fallback）。**session sync poll**（Realtime 取りこぼし時の active / ended 同期）。`resolvePartnerId` buyer/seller fallback |
| [`scripts/talk-call-signaling.js`](../scripts/talk-call-signaling.js) | **JWT サインイン後の Realtime 再購読**（`onAuthStateChange`）。ログイン前 subscribe → 着信/状態更新取りこぼしを防止 |

### 1.4 発信・着信・切断フロー

```
chat-detail 📞 click
  → TasuTalkCallChatDetail.buildCallThread(activeThread)
  → TasuTalkCallService.initiateCall({ roomId, callerId, calleeId })
  → talk_call_sessions INSERT (ringing) + 発信中 overlay

callee が同一 room の chat-detail を表示中
  → Realtime / pollRingingSessions
  → matchesActiveCallContext(session) === true
  → 着信 overlay → accept / reject

active 後
  → WebRTC offer/answer（Phase1 同様）
  → hangup で ended + overlay 閉じ + 再発信可能
```

**二重発信防止:** `currentSession` 存在時・busy ユーザー検出時は `initiateCall` を拒否。

---

## 2. 対象外（今回実装しない）

| 機能 | 備考 |
|------|------|
| TURN / coturn | STUN のみ（Phase1 同様） |
| Web Push / バックグラウンド着信 | フォアグラウンド着信のみ |
| ビデオ通話 | ボタン・UI なし |
| 通話履歴 UI | DB `talk_call_sessions` のみ |
| talk-home 以外からの着信ルーティング変更 | talk-home 既存動作維持 |
| ANPI / TALK 通知センター着信カード | 既存連携を変更しない |

---

## 3. 検証結果

### 3.1 Phase2 専用 E2E

```bash
SUPABASE_STRICT=1 node scripts/test-talk-call-chat-detail.mjs
```

| チェック | 結果 |
|----------|------|
| chat-detail で通話モジュール load | ✅ |
| 390px ヘッダー overflow なし | ✅ |
| 通話ボタン DOM（PC + SP 2 箇所） | ✅ |
| 1:1 thread でボタン enabled | ✅ |
| official thread で非表示 / disabled | ✅ |
| 他ルーム着信を誤表示しない | ✅ |
| A→B 発信（chat-detail） | ✅ |
| B 同一ルーム着信 overlay | ✅ |
| accept 後 both active | ✅ |
| hangup 後 session クリア | ✅ |
| ringing 中の二重発信ブロック | ✅ |

**成果物:** [`scripts/test-talk-call-chat-detail.mjs`](../scripts/test-talk-call-chat-detail.mjs)

### 3.2 Phase1 回帰

```bash
SUPABASE_STRICT=1 node scripts/test-talk-webrtc-call-browser.mjs
```

| チェック | 結果 |
|----------|------|
| talk-home 1:1 発信 / 着信 / active / hangup | ✅ |
| WebRTC audio connected | ✅ |
| busy / timeout missed | ✅ |
| 通話専用 E2E FAIL | **0** |

着信待ちに `refreshIncomingForActiveRoom` poll fallback を追加（Realtime 遅延対策）。

### 3.3 非 STRICT smoke

```bash
node scripts/test-talk-call-chat-detail.mjs
```

| チェック | 結果 |
|----------|------|
| モジュール load · 390px · ボタン DOM | ✅ |
| 1:1 / official 表示制御 | ✅ |

### 3.4 既存 chat-detail smoke

```bash
node scripts/test-chat-detail-browser.mjs
```

| 結果 | 備考 |
|------|------|
| ⚠️ FAIL | `createThreadViaDetail` の `waitForURL(..., load)` タイムアウト（通話変更とは無関係の既存テスト基盤問題）。Phase2 側で 390px ヘッダー専用チェックは PASS |

---

## 4. 既知の制約

1. **フォアグラウンド着信のみ** — chat-detail を開いていない相手には overlay 不出力（Push 未実装）。
2. **ルーム参加者前提** — callee が thread 参加者でない場合は発信不可（Phase1 RLS + `canCallThread`）。
3. **Realtime + poll 併用** — JWT ログイン前 subscribe 取りこぼしは auth 再購読 + session poll で緩和。厳格 NAT 下のメディアは TURN なしの Phase1 制約のまま。
4. **合成 ROOM_ID テスト** — E2E は `syncFromThread` 注入。本番は `setHeader` → Supabase thread row から partner 解決。

---

## 5. 変更ファイル一覧

| 種別 | パス |
|------|------|
| 新規 | `scripts/talk-call-chat-detail.js` |
| 新規 | `scripts/test-talk-call-chat-detail.mjs` |
| 新規 | `reports/talk-call-phase2-chat-detail.md` |
| 変更 | `chat-detail.html` |
| 変更 | `chat-detail.js` |
| 変更 | `scripts/talk-call-service.js` |
| 変更 | `scripts/talk-call-signaling.js` |
| 変更 | `talk-call.css` |
| 変更 | `scripts/test-talk-webrtc-call-browser.mjs`（着信 poll fallback · session cleanup） |

---

## 6. 完了条件チェック

| 条件 | 状態 |
|------|------|
| Phase1 E2E PASS 維持 | ✅ |
| chat-detail 連携テスト PASS | ✅ |
| 通話専用 E2E FAIL 0 | ✅ |
| 既存 TALK チャット smoke | ⚠️ chat-detail-browser は別途タイムアウト（通話非関連） |
| レポート記載 | ✅ 本ドキュメント |

---

## 7. Phase3 以降の候補

- TURN サーバ導入
- Web Push 着信
- 通話履歴一覧 UI
- `chat-detail` バックグラウンド着信 → talk-home / 通知センター連携
