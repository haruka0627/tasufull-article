# Live Platform — Phase 2.5 Browser Play Check

**日付:** 2026-06-29  
**目的:** headless SKIP `audience:play` の通常ブラウザ確認（headed Playwright + 診断）  
**PoC URL:** http://127.0.0.1:8788/platform-live/zego-platform-poc.html  
**Verdict:** **NO-GO（自動ブラウザ）**  
**Phase 3:** **不可** — host publish が SDK/WebRTC 層で完了しない（手動 Chrome 確認が別途必要）

---

## Executive summary

| 層 | 結果 |
| --- | --- |
| Token API（host / audience） | **PASS** · HTTP 200 |
| initialize / Adapter path | **PASS** |
| **host publish（RTC）** | **FAIL** · `host publish 中…` で 120s ハング |
| audience join / play | **未実施**（host publish 未完了） |
| **Phase 3** | **不可**（自動確認時点） |

**headless E2E の `host publish` PASS は誤判定:** 正規表現 `host publish|live` が進行中ステータス `host publish 中…` にマッチしていた。厳密パターン `host publish · provider=live` では **タイムアウト**。

---

## 前提

| 項目 | 状態 |
| --- | --- |
| Token API 503 | 解消済（`.dev.vars` 同期） |
| headless E2E | PASS 31 · FAIL 0 · SKIP 1 |
| Secret ログ | なし（mask のみ） |

---

## 確認結果

| # | 項目 | 結果 | 詳細 |
| --- | --- | --- | --- |
| 1 | env:zego | **PASS** | — |
| 2 | config:dev-vars | **PASS** | runtime ready |
| 3 | dev:8788 | **PASS** | http://127.0.0.1:8788 |
| 4 | page:poc | **PASS** | HTTP 200 |
| 5 | token:host | **PASS** | len=338 |
| 6 | token:audience | **PASS** | len=338 |
| 7 | host:initialize | **PASS** | — |
| 8 | host:publish | **FAIL** | page.waitForFunction: Timeout 120000ms exceeded. · status="host publish 中…" |

**Summary:** PASS 7 · FAIL 1

---

## audience play 詳細

| 項目 | 値 |
| --- | --- |
| roomId | `browser-play-1782666514384` |
| 判定 | — |
| 詳細 | 未実施（host publish 未完了） |

### DOM 診断（viewer · join 後最大 30s ポーリング）

```json
{}
```

---

## Signals

**Host provider:** —  
**Host broadcast:** —

---

## Console

| context | error 件数 |
| --- | --- |
| host | — |
| viewer | — |

---

## スクリーンショット

| ファイル | 用途 |
| --- | --- |
| `host-publish-stuck-1280.png` | host publish 120s ハング時 |
| `host-after-publish-1280.png` | （旧 run · 誤 PASS 時） |
| `viewer-after-join-390.png` | （旧 run · remote なし） |

---

## 手動ブラウザ確認手順（人間 Go 用）

Playwright（headed 含む）は WebRTC / カメラ権限で **loginRoom/publish が完了しない** 可能性あり。**Chrome / Edge を手動で 2 ウィンドウ** 開いて以下を確認してください。

1. `http://127.0.0.1:8788/platform-live/zego-platform-poc.html`
2. **Host:** initialize → create session → host publish  
   - 成功目安: ステータス `host publish · provider=live` · ローカル video 表示
3. **Viewer（別ウィンドウ / シークレット）:** 同一 roomId · initialize → audience join  
   - 成功目安: `audience join · provider=watching` · `.live-zego-poc__remote` または video 表示
4. DevTools Console に error がないこと

手動で audience play PASS → **Phase 3 Go** 再判定。

---

## Phase 3 判断

| 判断 | 結果 |
| --- | --- |
| **Phase 2.5 Browser Play** | **NO-GO** |
| **Phase 3 開始** | **Phase 3 不可 — host publish が SDK/WebRTC 層で完了しない** |


## 停止点

**host publish · ZEGO loginRoom/publish 待ち（PROVIDER_CONNECTING のまま · PROVIDER_CONNECTED 未到達）**

| 観測 | 値 |
| --- | --- |
| UI status | `host publish 中…`（120s） |
| provider state | `ready`（`live` にならない） |
| session state | `READY`（`LIVE` 未到達） |
| local video DOM | 0 |
| signals | `PROVIDER_CONNECTING` · `BROADCAST_PROVIDER_STARTING` のみ |

**層:** Token API ✅ → Adapter initialize ✅ → **SDK loginRoom / createStream / publish ❌** → remote attach（未到達）

```json
{
  "status": "host publish 中…",
  "provider": "ready",
  "session": "READY",
  "debug": {
    "providerSignals": [
      {
        "signal": "PROVIDER_CONNECTING",
        "payload": {
          "surface": "platform",
          "roomId": "browser-play-1782666514384",
          "userId": "browser_host"
        },
        "at": "2026-06-28T17:08:36.065Z"
      }
    ],
    "broadcastSignals": [
      {
        "signal": "BROADCAST_PROVIDER_STARTING",
        "payload": {
          "surface": "platform",
          "roomId": "browser-play-1782666514384",
          "broadcastId": "bc-browser-play-1782666514384"
        },
        "at": "2026-06-28T17:08:36.080Z"
      }
    ],
    "sessionSnapshot": {
      "state": "READY",
      "session": {
        "id": "sess-1782666516032",
        "roomId": "browser-play-1782666514384",
        "role": "host",
        "surface": "platform",
        "createdAt": "2026-06-28T17:08:36.032Z",
        "presence": {
          "status": "online",
          "lastHeartbeatAt": "2026-06-28T17:08:36.032Z",
          "seq": 0,
          "userId": "browser_host"
        }
      },
      "providerState": "ready",
      "surface": "platform",
      "lastEvent": {
        "event": "LIVE_CREATED",
        "payload": {
          "sessionId": "sess-1782666516032",
          "roomId": "browser-play-1782666514384",
          "surface": "platform",
          "hostUserId": null,
          "role": "host",
          "createdAt": "2026-06-28T17:08:36.032Z"
        },
        "at": "2026-06-28T17:08:36.032Z"
      },
      "stubFallback": false
    },
    "providerId": "zego",
    "stubFallback": false,
    "usesAdapterPath": true
  }
}
```

