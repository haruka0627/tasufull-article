# TASFUL TALK 通話 Phase5.5 — 本番 TURN 接続前チェック（Preflight）

**日付:** 2026-06-17  
**監査種別:** 設定・セキュリティ・回帰（コード変更なし）  
**本番 credential 投入:** 未実施（本監査では実 TURN サービス契約・実 credential 注入は行っていない）

> **Phase5.6 追記:** 本レポート WARNING 項目（`_test` 露出・docs 不足）は [`talk-call-phase5-6-turn-hardening.md`](talk-call-phase5-6-turn-hardening.md) で解消済み。最新判定は **PASS**。

---

## 総合判定: **WARNING**

**結論:** 本番 TURN credential の投入に**進んでよい**。ただし、credential 漏洩リスクによる **FAIL 条件は該当せず**（ログ / storage / DOM / summary 経路は安全）。運用上の改善推奨が残るため **WARNING** とする。

| 観点 | 結果 |
|------|------|
| TURN config 正しさ | ✅ 合格 |
| credential 漏洩（ログ / storage / DOM） | ✅ 合格 |
| debug mode | ⚠️ 改善推奨（本番 URL でも有効化可能だが credential は出ない） |
| ドキュメント | ⚠️ 改善推奨（優先順位・Vite バンドル注意の追記余地） |
| Phase1〜5 回帰 | ✅ 全 PASS |

---

## 確認ファイル一覧

| ファイル | 監査内容 |
|----------|----------|
| [`scripts/talk-call-ice-config.js`](../scripts/talk-call-ice-config.js) | ICE/TURN 解決・debug・summary |
| [`scripts/talk-call-webrtc.js`](../scripts/talk-call-webrtc.js) | PeerConnection 生成・debug ハンドラ |
| [`scripts/talk-call-service.js`](../scripts/talk-call-service.js) | 接続失敗 toast・console.warn |
| [`scripts/talk-call-signaling.js`](../scripts/talk-call-signaling.js) | シグナリング（credential 非接触） |
| [`scripts/talk-call-ui.js`](../scripts/talk-call-ui.js) | overlay DOM（credential 非表示） |
| [`tasu-supabase-client.js`](../tasu-supabase-client.js) | `getTalkCallIceSummary()` |
| [`chat-supabase-config.example.js`](../chat-supabase-config.example.js) | TURN 設定例・env コメント |
| [`docs/talk-call-turn-config.md`](../docs/talk-call-turn-config.md) | 本番導入手順 |
| [`README.md`](../README.md) | TURN ドキュメントリンク |
| [`chat-detail.html`](../chat-detail.html) | script 読み込み順 |
| [`talk-home.html`](../talk-home.html) | script 読み込み順 |
| [`scripts/test-talk-call-turn-config.mjs`](../scripts/test-talk-call-turn-config.mjs) | Phase5 単体 |
| Phase1〜4 E2E テスト | 回帰 |

---

## 1. TURN config 監査

### 1.1 STUN fallback

| 項目 | 結果 | 根拠 |
|------|------|------|
| デフォルト STUN 維持 | ✅ | `DEFAULT_STUN_URL = "stun:stun.l.google.com:19302"`。TURN 未設定・無効化時は `[{ urls: DEFAULT_STUN_URL }]` のみ |
| webrtc フォールバック | ✅ | `Ice()` 未ロード時も同一 STUN で `RTCPeerConnection` 生成（`talk-call-webrtc.js` L71–73） |

### 1.2 TURN 有効化条件

| 条件 | 結果 |
|------|------|
| TURN URL なし | STUN のみ ✅ |
| TURN URL + username + credential あり | STUN + 各 TURN URL ✅ |
| TURN URL のみ / username または credential 不足 | TURN 無効化 + 固定文言 `console.warn`（credential 値は含まない）✅ |

### 1.3 複数 URL / スキーム

| 項目 | 結果 |
|------|------|
| カンマ区切り | `parseTurnUrls()` で分割 ✅ |
| 配列形式 | `Array.isArray` 分岐 ✅ |
| `turn:` / `turns:` | `normalizeTurnUrl()` が `/^(stun\|turn\|turns):/i` を許容。スキーム省略時は `turn:` 付与 ✅ |
| 各 URL が独立した `iceServers` エントリ | `turnUrls.forEach` で `{ urls, username, credential }` を push ✅ |

### 1.4 設定ソースの優先順位

`resolveTurnSettings()` の `pickStr()` は**先に見つかった非空値を採用**（後勝ちではない）。

**URL（例）:**

1. `options.turnUrl`（テスト / 内部呼び出し）
2. `window.TASU_TALK_CALL_CONFIG` の `turnUrl` / `turn_url` / `TURN_URL` / `urls`
3. `window.TASFUL_TURN_URL`
4. `process.env.TASFUL_TURN_URL`
5. `process.env.VITE_TASFUL_TURN_URL`

**username / credential** も同パターン（`TASU_TALK_CALL_CONFIG` → `window.TASFUL_TURN_*` → `TASFUL_*` env → `VITE_*` env）。

**所見:** ブラウザ本番では `chat-supabase-config.js` の `TASU_TALK_CALL_CONFIG` が env より優先。Vite ビルドでは `import.meta.env.VITE_*` 相当が `process.env` 経由で注入される想定。**優先順位は docs に明文化されていない**（改善推奨）。

---

## 2. credential 漏洩監査

### 2.1 console 出力

| 経路 | credential 混入 | 結果 |
|------|-----------------|------|
| `console.warn`（TURN 不足） | 固定文言のみ | ✅ |
| `console.debug`（`logIceDebug`） | `sanitizeDebugPayload` で `credential` / `turnCredential` / `username` / `password` を delete | ✅ |
| `logIceDebug("rtc-config", getConfigSummary())` | summary に credential フィールドなし | ✅ |
| `console.warn`（WebRTC / Service / Signaling エラー） | ICE candidate / session エラーのみ。TURN config を stringify していない | ✅ |
| `TasuSupabase.logConnectionInfo()` | Supabase url / anonKeyPrefix のみ。TURN 非接触 | ✅ |

**自動テスト:** `test-talk-call-turn-config.mjs` ケース7 で debug on + 意図的 payload 混入時もログ文字列に secret が含まれないことを検証済み ✅

### 2.2 storage

| ストア | 保存内容 | 結果 |
|--------|----------|------|
| `localStorage` | `tasu_talk_call_debug=1` のみ（debug フラグ） | ✅ credential なし |
| `sessionStorage` | 通話モジュールからの读写なし | ✅ |

### 2.3 DOM / data 属性

| 項目 | 結果 |
|------|------|
| `talk-call-ui.js` overlay | `data-talk-call-*` は UI 状態のみ（title / timer / action） | ✅ |
| credential を DOM / innerHTML に出力するコード | なし | ✅ |

### 2.4 レポート / debug summary

| API | 返却フィールド | credential |
|-----|----------------|------------|
| `getConfigSummary()` | `stun`, `turnConfigured`, `turnEnabled`, `turnUrlCount`, `debug` | 含まない ✅ |
| `TasuSupabase.getTalkCallIceSummary()` | 上記委譲 | 含まない ✅ |

### 2.5 メモリ / クライアント露出（FAIL 対象外だが運用注意）

| 経路 | 説明 | 判定 |
|------|------|------|
| `getTalkCallIceServers()` 戻り値 | WebRTC 必須の in-memory `iceServers` | 想定内 |
| `TasuTalkCallIceConfig._test.resolveTurnSettings()` | 本番 window に公開。DevTools から credential 取得可能 | ⚠️ Phase5.6 で `_test` を dev のみに限定推奨 |
| `VITE_TASFUL_TURN_CREDENTIAL` | Vite ビルド時に JS バンドルへ埋め込まれる | ⚠️ ブラウザ TURN の構造上避けられない。docs で「ビルド成果物に含まれる」旨を強調推奨 |

**credential 漏洩リスク（ログ / storage / DOM / error summary）:** **なし → FAIL 条件不該当**

---

## 3. debug mode 監査

| 項目 | 結果 |
|------|------|
| `?talkCallDebug=1` | `isTalkCallDebugEnabled()` が true。`icecandidate` / `iceconnectionstate` / `connectionstate` / `rtc-config` summary が `console.debug` 出力 | ✅ |
| debug off（デフォルト） | 上記ログは出ない | ✅ |
| debug on でも credential | `sanitizeDebugPayload` + summary 経路で除外 | ✅ |
| 本番で勝手に on | デフォルト off。ただし **URL クエリ / localStorage / `TASU_TALK_CALL_CONFIG.debug`** で誰でも有効化可能 | ⚠️ credential は出ないが、本番では debug 有効化をデプロイ設定で禁止する運用推奨 |

**ICE candidate 文字列:** debug 時は IP を `[ip]` に置換。type / protocol のみ残す ✅

---

## 4. 本番導入手順レビュー（`docs/talk-call-turn-config.md`）

| 必須項目 | 記載 | 評価 |
|----------|------|------|
| 必要な env | `TASFUL_TURN_*` / `VITE_TASFUL_TURN_*` 表あり | ✅ |
| 設定例 | `TASU_TALK_CALL_CONFIG` 例あり | ✅ |
| STUN fallback | 「TURN 未設定 → STUN のみ」明記 | ✅ |
| credential をログに出さない | warn / debug の説明あり | ✅ |
| TURN 未設定時の挙動 | 明記 | ✅ |
| 本番接続後の確認手順 | relay candidate 確認・実機 NAT テスト（概要） | ⚠️ チェックリスト形式・`getTalkCallIceSummary()` 確認手順の追記余地 |
| 設定優先順位 | 未記載 | ⚠️ |
| Vite バンドルに credential が含まれる注意 | 間接的のみ | ⚠️ |

---

## 5. 検証コマンドと結果

実行環境: `BASE_URL=http://127.0.0.1:8765`, `SUPABASE_STRICT=1`  
日付: 2026-06-17

```powershell
$env:SUPABASE_STRICT="1"
$env:BASE_URL="http://127.0.0.1:8765"
node scripts/test-talk-call-turn-config.mjs
node scripts/test-talk-webrtc-call-browser.mjs
node scripts/test-talk-call-chat-detail.mjs
node scripts/test-talk-call-notification-center.mjs
node scripts/test-talk-call-history-ui.mjs
```

| コマンド | 結果 |
|----------|------|
| `test-talk-call-turn-config.mjs` | **PASS**（21 assertions） |
| `test-talk-webrtc-call-browser.mjs` | **PASS**（0 errors） |
| `test-talk-call-chat-detail.mjs` | **PASS**（0 errors） |
| `test-talk-call-notification-center.mjs` | **PASS**（0 errors） |
| `test-talk-call-history-ui.mjs` | **PASS**（0 errors） |

TURN 未設定（STUN のみ）状態での Phase1〜4 回帰影響: **なし**

---

## 6. 残件 — Phase5.6 / Phase6 候補

今回は**監査のみ**のため、以下は修正せずレポートに記録（別タスク）。

### Phase5.6（TURN 投入前後の改善・任意）

| # | 内容 | 優先度 |
|---|------|--------|
| 1 | `docs/talk-call-turn-config.md` に設定ソース優先順位・Vite バンドル警告・本番確認チェックリストを追記 | 中 |
| 2 | `TasuTalkCallIceConfig._test` を `talkDev=1` / `NODE_ENV=test` 時のみ公開 | 低 |
| 3 | 本番ビルドで `TASU_TALK_CALL_CONFIG.debug` および URL debug を無視するオプション（例: `TASU_TALK_CALL_CONFIG.allowDebug=false`） | 低 |
| 4 | TURN 投入後の relay candidate E2E（モック TURN / ステージング credential） | 中 |

### Phase6 候補（スコープ外）

- 外部 TURN サービス契約・課金・DNS
- time-limited TURN credential 発行 API（サーバサイド）
- Push 通知 / ビデオ通話
- TURN ヘルスチェック・フェイルオーバー

---

## 7. 本番 credential 投入時の推奨手順（監査後メモ）

1. TURN プロバイダで URL / username / credential を発行（**本リポジトリ・本レポートには記載しない**）
2. ステージングで `TASU_TALK_CALL_CONFIG` または CI secret 経由で注入
3. ブラウザ DevTools → `TasuSupabase.getTalkCallIceSummary()` で `turnEnabled: true` を確認（credential は返らない）
4. `?talkCallDebug=1`（ステージングのみ）で **relay** 型 candidate を確認
5. 厳格 NAT（モバイル LTE / 企業 Wi‑Fi）で 1:1 通話 E2E
6. 問題なければ本番 env / config へ反映

---

## 8. 監査サマリー

- **実 credential 投入:** 未実施
- **外部 TURN 契約:** 未実施
- **コード変更:** なし（Phase5.5 は監査のみ）
- **UI 変更:** なし
- **総合判定:** **WARNING** — credential 投入可能。ドキュメント強化と `_test` / 本番 debug 制御は Phase5.6 で対応推奨
