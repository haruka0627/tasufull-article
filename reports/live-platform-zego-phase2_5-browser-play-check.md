# Live Platform — Phase 2.5 Browser Play Check

**日付:** 2026-06-28  
**目的:** headless SKIP `audience:play` の通常ブラウザ（headed Playwright）確認  
**PoC URL:** http://127.0.0.1:8788/platform-live/zego-platform-poc.html  
**Verdict:** **GO**  
**Phase 3:** Phase 3 着手可

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
| 8 | host:publish | **PASS** | — |
| 9 | host:local-video | **SKIP** | videos=0 children=0 provider=live |
| 10 | audience:initialize | **PASS** | — |
| 11 | audience:join | **PASS** | — |
| 12 | audience:play | **PASS** | remote=1 video=0 stageChildren=1 |
| 13 | signals:provider | **PASS** | PROVIDER_CONNECTING, PROVIDER_CONNECTED |
| 14 | signals:broadcast | **PASS** | BROADCAST_PROVIDER_STARTING, BROADCAST_PROVIDER_STARTED |
| 15 | console:clean | **PASS** | — |

**Summary:** PASS 14 · FAIL 0

---

## audience play 詳細

| 項目 | 値 |
| --- | --- |
| roomId | `browser-play-1782668122147` |
| 判定 | PASS |
| 詳細 | remote=1 video=0 stageChildren=1 |

### DOM 診断（viewer · join 後最大 30s ポーリング）

```json
{
  "remoteCount": 1,
  "videoCount": 0,
  "stageChildCount": 1,
  "stageHtmlLen": 200,
  "status": "audience join · provider=watching · session=CONNECTED",
  "providerState": "watching"
}
```

---

## Signals

**Host provider:** PROVIDER_CONNECTING, PROVIDER_CONNECTED  
**Host broadcast:** BROADCAST_PROVIDER_STARTING, BROADCAST_PROVIDER_STARTED

---

## Console

| context | error 件数 |
| --- | --- |
| host | 0 |
| viewer | 0 |

---

## スクリーンショット

| ファイル | 用途 |
| --- | --- |
| `reports/live-platform-zego-phase2_5-browser-play-check/host-after-publish-1280.png` | host publish 後 |
| `reports/live-platform-zego-phase2_5-browser-play-check/viewer-after-join-390.png` | audience join 後 |

---

## Phase 3 判断

| 判断 | 結果 |
| --- | --- |
| **Phase 2.5 Browser Play** | **GO** |
| **Phase 3 開始** | **Phase 3 着手可** |


