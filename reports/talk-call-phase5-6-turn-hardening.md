# TASFUL TALK 通話 Phase5.6 — TURN 運用ハードニング

**日付:** 2026-06-17  
**本番 credential 投入:** **未実施**  
**総合判定:** **PASS**

---

## 概要

Phase5 / Phase5.5 の TURN 設定レイヤーについて、本番 credential 投入前の運用リスクを最小化するハードニングを実施。機能追加ではなく、**内部 API 公開範囲・診断・ドキュメント・テスト**の整理。

## 総合判定: PASS

| 観点 | 結果 |
|------|------|
| credential 露出なし | ✅ |
| `_test` / `getIceConfig` 本番非公開 | ✅ |
| 本番投入チェックリスト | ✅ 完成 |
| relay candidate 診断準備 | ✅ |
| Phase1〜5 回帰 | ✅ 全 PASS |

Phase5.5 の WARNING 項目（docs 不足・`_test` 露出）を Phase5.6 で解消。

---

## 変更ファイル

| ファイル | 内容 |
|----------|------|
| [`scripts/talk-call-ice-config.js`](../scripts/talk-call-ice-config.js) | `_test` / `getIceConfig` の dev/test 限定、`allowDebug`、`getTalkCallConnectionSummary()` |
| [`scripts/talk-call-webrtc.js`](../scripts/talk-call-webrtc.js) | ICE candidate 集計（host/srflx/relay）、`getConnectionDiagnostics()` |
| [`tasu-supabase-client.js`](../tasu-supabase-client.js) | `getTalkCallConnectionSummary()` 委譲 |
| [`docs/talk-call-turn-config.md`](../docs/talk-call-turn-config.md) | 優先順位・credential 保護・本番確認手順を追記 |
| [`docs/talk-call-turn-production-checklist.md`](../docs/talk-call-turn-production-checklist.md) | **新規** 本番チェックリスト |
| [`scripts/test-talk-call-turn-config.mjs`](../scripts/test-talk-call-turn-config.mjs) | Phase5.6 テスト追加 |
| [`scripts/test-talk-call-relay-candidate.mjs`](../scripts/test-talk-call-relay-candidate.mjs) | **新規** relay 診断スケルトン |
| [`chat-supabase-config.example.js`](../chat-supabase-config.example.js) | `allowDebug` コメント |
| [`README.md`](../README.md) | チェックリストリンク |

---

## 1. `_test` API 公開範囲

### 本番ブラウザ（`NODE_ENV=production`, talkDev なし）

- `TasuTalkCallIceConfig._test` → **undefined**
- `TasuTalkCallIceConfig.getIceConfig()` → **undefined**

### dev / test のみ

| 条件 | 有効 |
|------|------|
| `process.env.NODE_ENV === "test"` | ✅ |
| `process.env.TASFUL_TALK_CALL_INTERNAL_TEST === "1"` | ✅ |
| `?talkDev=1` | ✅ |
| `TASU_TALK_CALL_CONFIG.internalTest === true` | ✅ |

`getIceConfig()` は URL 一覧と `hasUsername` / `hasCredential` フラグのみ（credential 値なし）。

---

## 2. 本番 debug ロック

```javascript
window.TASU_TALK_CALL_CONFIG = { allowDebug: false };
```

- `allowDebug: false` → `talkCallDebug=1` / localStorage / `debug: true` すべて無効
- 本番 URL で debug が勝手に on になる経路を遮断（意図的な talkDev 開発時は別）

---

## 3. relay candidate 診断

### API（debug 時のみ）

```javascript
TasuTalkCallIceConfig.getTalkCallConnectionSummary();
TasuSupabase.getTalkCallConnectionSummary();
```

返却例（credential なし）:

```javascript
{
  candidateCounts: { host: 1, srflx: 1, relay: 0, prflx: 0, unknown: 0 },
  typesSeen: ["host", "srflx"],
  hasHost: true,
  hasSrflx: true,
  hasRelay: false,
  connectionState: "connected",
  iceConnectionState: "connected",
  iceGatheringState: "complete",
  turnEnabled: true,
  debug: true
}
```

UI 変更なし。`talk-call-webrtc.js` が candidate を集計。

---

## 4. 検証結果

```powershell
node scripts/test-talk-call-turn-config.mjs          # 33 assertions PASS
node scripts/test-talk-call-relay-candidate.mjs      # SKIP PASS (TURN 未設定)
$env:SUPABASE_STRICT="1"; node scripts/test-talk-webrtc-call-browser.mjs   # PASS
$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-chat-detail.mjs      # PASS
$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-notification-center.mjs  # PASS
$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-history-ui.mjs       # PASS
```

| スイート | 結果 |
|----------|------|
| Phase5/5.6 `test-talk-call-turn-config.mjs` | **PASS** |
| Phase5.6 `test-talk-call-relay-candidate.mjs` | **SKIP PASS** |
| Phase1〜4 E2E | **PASS** |

---

## 5. 残件 — Phase6 候補

| # | 内容 | 優先度 |
|---|------|--------|
| 1 | ステージングで `TASFUL_TALK_CALL_RELAY_E2E=1` + 実 TURN による relay 確認 | 中 |
| 2 | time-limited TURN credential 発行 API（サーバサイド） | 低 |
| 3 | TURN ヘルスチェック / 自動フェイルオーバー | 低 |
| 4 | Push 通知 / ビデオ通話 | スコープ外 |

---

## 6. 本番 credential 投入前の最終確認

[`docs/talk-call-turn-production-checklist.md`](../docs/talk-call-turn-production-checklist.md) を使用。

1. `allowDebug: false` を設定
2. `getTalkCallIceSummary()` で `turnEnabled: true`（値は見ない）
3. ステージングで relay candidate 確認
4. モバイル実機 1:1 通話
5. credential 漏洩なしを確認

**本リポジトリ・本レポートに実 credential は記載していない。**
