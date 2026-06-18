# TALK 音声通話 — TURN / ICE 設定（Phase5 / 5.6）

## 概要

Phase1〜4 の WebRTC 通話はデフォルトで Google STUN のみです。Phase5 以降、`scripts/talk-call-ice-config.js` 経由で **TURN credentials を環境から注入**できます。

- TURN 未設定 → **従来どおり STUN のみ**（既存 E2E PASS）
- TURN 設定済み → STUN + TURN を `RTCPeerConnection` に反映

## 設定ソースの優先順位

各項目（URL / username / credential）は **先に見つかった非空値** を採用します（後勝ちではありません）。

| 順位 | ソース | 例 |
|------|--------|-----|
| 1 | 関数引数 `options` | テスト・内部呼び出し |
| 2 | `window.TASU_TALK_CALL_CONFIG` | `turnUrl`, `turnUsername`, `turnCredential` |
| 3 | `window.TASFUL_TURN_*` | `window.TASFUL_TURN_URL` 等 |
| 4 | `process.env.TASFUL_*` | Node / CI |
| 5 | `process.env.VITE_TASFUL_*` | Vite ビルド注入 |

**ブラウザ本番:** 通常は `chat-supabase-config.js` の `TASU_TALK_CALL_CONFIG` が最優先。  
**Vite ビルド:** `VITE_TASFUL_TURN_*` は **JS バンドルに埋め込まれます**（後述）。

## STUN fallback

TURN が未設定・無効化された場合、常に次のみ使用します:

```
stun:stun.l.google.com:19302
```

TURN URL があるが username / credential が不足している場合も **STUN のみ** にフォールバックし、`console.warn` を 1 回出力します（credential 値は含みません）。

## TURN 未設定時の挙動

- `getTalkCallIceServers()` → STUN 1 件のみ
- 既存 Phase1〜4 通話 E2E はそのまま PASS
- relay candidate は生成されない（NAT 越えは STUN + P2P のみ）

## credential の取り扱い

### ログに出さない

- `console.log` / `console.warn` / `console.debug` / `getConfigSummary()` / `getTalkCallConnectionSummary()` には **credential を含めません**
- debug モードでも `sanitizeDebugPayload` で除去

### ブラウザ TURN credential は「秘匿情報ではないが保護対象」

WebRTC の TURN username / credential は **クライアント JS に渡す必要があり**、完全秘匿はできません（`VITE_*` ビルド時はバンドルに含まれる）。

それでも以下は必須です:

- Git / レポート / ログへの平文保存禁止
- DevTools で `_test.resolveTurnSettings()` 等から **意図せず読み取れないよう** dev/test 以外では内部診断 API を公開しない（Phase5.6）
- 本番では `allowDebug: false` を推奨（URL / localStorage による debug 無効化）

```javascript
window.TASU_TALK_CALL_CONFIG = {
  allowDebug: false, // 本番推奨
  turnUrl: "...",
  turnUsername: "...",
  turnCredential: "...",
};
```

## 設定方法

### 1. `chat-supabase-config.js`（静的ホスト / ローカル）

```javascript
window.TASU_TALK_CALL_CONFIG = {
  turnUrl: "turn:turn.example.com:3478,turns:turn.example.com:5349",
  turnUsername: "your-user",
  turnCredential: "your-secret",
  allowDebug: false,
};
```

**credential を Git に commit しないでください。**

### 2. 環境変数（Vite / CI / Node テスト）

| 変数 | 説明 |
|------|------|
| `TASFUL_TURN_URL` / `VITE_TASFUL_TURN_URL` | カンマ区切りで複数 URL 可 |
| `TASFUL_TURN_USERNAME` / `VITE_TASFUL_TURN_USERNAME` | TURN ユーザー名 |
| `TASFUL_TURN_CREDENTIAL` / `VITE_TASFUL_TURN_CREDENTIAL` | TURN パスワード |

### 3. デバッグログ（開発のみ）

`allowDebug !== false` のときのみ有効:

- URL: `?talkCallDebug=1`
- localStorage: `tasu_talk_call_debug=1`
- `TASU_TALK_CALL_CONFIG.debug = true`

`iceConnectionState` / `connectionState` / candidate **type**（host / srflx / relay）のみ。

## 本番投入後の確認手順

詳細チェックリスト: [`talk-call-turn-production-checklist.md`](talk-call-turn-production-checklist.md)

1. **設定確認（credential 値は表示しない）**
   - DevTools: `TasuSupabase.getTalkCallIceSummary()` → `turnEnabled: true`
2. **debug off**
   - `allowDebug: false`、本番 URL に `talkCallDebug=1` を付けない
3. **relay candidate（ステージングのみ）**
   - `?talkCallDebug=1` で 1:1 通話開始
   - `TasuSupabase.getTalkCallConnectionSummary()` → `hasRelay: true`
4. **credential 漏洩確認**
   - Console / Network / Application storage に credential 文字列がないこと
5. **実機**
   - モバイル LTE + 企業 Wi‑Fi で 1:1 通話
6. **回帰**
   - Phase1〜5 テスト PASS

## API

```javascript
// 公開（本番可 — credential なし）
TasuTalkCallIceConfig.getTalkCallIceServers();
TasuTalkCallIceConfig.buildTalkCallPeerConnectionConfig();
TasuTalkCallIceConfig.getConfigSummary();
TasuSupabase.getTalkCallIceSummary();

// debug 時のみ — relay / srflx / host 診断
TasuTalkCallIceConfig.getTalkCallConnectionSummary();
TasuSupabase.getTalkCallConnectionSummary();

// dev/test のみ（talkDev=1 / NODE_ENV=test）
TasuTalkCallIceConfig.getIceConfig(); // URL のみ、hasUsername/hasCredential フラグ
TasuTalkCallIceConfig._test;          // 本番ブラウザでは undefined
```

## ステージング relay 診断テスト

```bash
# TURN 未設定 → skip（CI 安全）
node scripts/test-talk-call-relay-candidate.mjs

# ステージングで relay 待機 E2E を実行
TASFUL_TALK_CALL_RELAY_E2E=1 node scripts/test-talk-call-relay-candidate.mjs
```

## 対象外

- 外部 TURN サービスの契約・課金
- Push 通知 / ビデオ通話
